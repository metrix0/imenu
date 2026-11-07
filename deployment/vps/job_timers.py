"""Restricted management of iMenu's production API-route systemd timers."""
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

OPS = Path('/opt/imenu-migration/ops')
UNITS = Path('/etc/systemd/system')
CONFIG = OPS / 'job-config'
REGISTRY = CONFIG / 'managed-jobs.json'
DEPLOYED_SHA = OPS / 'production-deploy-state/deployed-sha'
RELEASES = OPS / 'production-releases'
BUILTINS = frozenset(('daily-payout', 'reconcile-payouts', 'addon-expiry-whatsapp',
                      'ia-vendas-analysis', 'storage-cleanup'))
NAME = re.compile(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z')
CALENDAR = re.compile(r'[A-Za-z0-9*.:,_+/\- ]+\Z')

def valid_name(value):
    if not isinstance(value, str) or len(value) > 60 or not NAME.fullmatch(value):
        raise ValueError('Invalid iMenu job name')
    return value

def run(argv, timeout=12, allow_failure=False):
    p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False)
    if p.returncode and not allow_failure:
        raise ValueError((p.stderr or p.stdout or 'systemd operation failed').strip()[:400])
    return p.stdout.strip(), p.returncode

def verify_calendar(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 120 or not CALENDAR.fullmatch(value):
        raise ValueError('Invalid systemd calendar expression')
    run(['/usr/bin/systemd-analyze', 'calendar', '--iterations=1', value])
    return value

def path_for(name, suffix):
    valid_name(name)
    path = UNITS / ('imenu-job-' + name + suffix)
    if path.is_symlink():
        raise ValueError('Symlink unit not allowed')
    return path

def verify_service(name):
    path = path_for(name, '.service')
    if not path.is_file():
        raise ValueError('Matching iMenu job service does not exist')
    contents = path.read_text()
    expected = 'ExecStart=/usr/bin/python3 /opt/imenu-migration/ops/run_job.py ' + name
    if expected not in contents.splitlines() or \
       'ConditionPathExists=/opt/imenu-migration/ops/PRODUCTION_JOBS_ENABLED' not in contents.splitlines():
        raise ValueError('Refusing to manage a nonstandard iMenu job service')
    return path

def deployed_route(name):
    """Validate the active compiled production release, not the obsolete source checkout."""
    valid_name(name)
    if DEPLOYED_SHA.is_symlink() or not DEPLOYED_SHA.is_file():
        raise ValueError('Production release identity unavailable')
    sha = DEPLOYED_SHA.read_text().strip()
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid deployed release identity')
    server = RELEASES / sha / '.next/server'
    manifest = server / 'app-paths-manifest.json'
    if manifest.is_symlink() or not manifest.is_file():
        raise ValueError('Production route manifest unavailable')
    try:
        routes = json.loads(manifest.read_text())
    except (OSError, ValueError) as error:
        raise ValueError('Invalid production route manifest') from error
    relative = 'app/api/cron/' + name + '/route.js'
    if not isinstance(routes, dict) or routes.get('/api/cron/' + name + '/route') != relative:
        raise ValueError('GET /api/cron/' + name + ' is absent from the deployed release')
    compiled = server / relative
    if compiled.is_symlink() or not compiled.is_file():
        raise ValueError('GET /api/cron/' + name + ' has no compiled route')

def read_registry():
    if not REGISTRY.is_file() or REGISTRY.is_symlink():
        raise ValueError('Managed-job registry unavailable')
    data = json.loads(REGISTRY.read_text())
    if not isinstance(data, dict) or set(data) != {'jobs'} or not isinstance(data['jobs'], list):
        raise ValueError('Managed-job registry malformed')
    jobs = data['jobs']
    if len(jobs) != len(set(jobs)) or not all(isinstance(n, str) and len(n) <= 60 and NAME.fullmatch(n) for n in jobs):
        raise ValueError('Managed-job registry contains invalid names')
    return jobs

def atomic_write(path, data, mode):
    if path.is_symlink():
        raise ValueError('Symlink unit not allowed')
    fd, temp = tempfile.mkstemp(prefix='.imenu-job-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

@contextlib.contextmanager
def exclusive():
    with (CONFIG / 'manage.lock').open('a+') as f:
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another timer change is in progress')
        yield

def current_enabled(name):
    output, code = run(['systemctl', 'is-enabled', 'imenu-job-' + name + '.timer'], allow_failure=True)
    return output == 'enabled'

def unit_status(name):
    unit = 'imenu-job-' + name
    timer, _ = run(['systemctl', 'show', unit + '.timer', '--no-pager',
                    '-p', 'LoadState', '-p', 'ActiveState', '-p', 'UnitFileState',
                    '-p', 'NextElapseUSecRealtime', '-p', 'LastTriggerUSec'], allow_failure=True)
    service, _ = run(['systemctl', 'show', unit + '.service', '--no-pager',
                      '-p', 'ActiveState', '-p', 'Result', '-p', 'ExecMainStatus'], allow_failure=True)
    def parse(raw):
        return dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
    path = path_for(name, '.timer')
    lines = path.read_text().splitlines()
    schedules = [line.partition('=')[2] for line in lines if line.startswith('OnCalendar=')]
    return {'name': name, 'api_route': '/api/cron/' + name,
            'calendar': schedules, 'enabled': current_enabled(name),
            'timer': parse(timer), 'service': parse(service)}

def list_timers(_):
    result = []
    for path in sorted(UNITS.glob('imenu-job-*.timer')):
        name = path.name[len('imenu-job-'):-len('.timer')]
        try:
            valid_name(name)
            verify_service(name)
            result.append(unit_status(name))
        except (ValueError, OSError):
            continue
    return {'timers': result, 'scope': 'iMenu application API jobs only'}

def get_timer(args, clean):
    name = valid_name(args.get('name'))
    verify_service(name)
    if not path_for(name, '.timer').is_file():
        raise ValueError('Timer does not exist')
    lines = args.get('lines', 30)
    if type(lines) is not int or not 1 <= lines <= 100:
        raise ValueError('lines must be 1-100')
    output, _ = run(['journalctl', '-u', 'imenu-job-' + name + '.service',
                     '--no-pager', '-n', str(lines), '--output=cat'], allow_failure=True)
    return {**unit_status(name), 'recent_logs': clean(output, 10000)}

def require_confirm(args):
    if args.get('confirm') is not True:
        raise ValueError('Explicit confirm=true required')

def set_enabled(name, enabled):
    verb = 'enable' if enabled else 'disable'
    run(['systemctl', verb, '--now', 'imenu-job-' + name + '.timer'], timeout=20)

def change_enabled(args):
    require_confirm(args)
    name = valid_name(args.get('name'))
    enabled = args.get('enabled')
    if type(enabled) is not bool:
        raise ValueError('enabled must be a boolean')
    with exclusive():
        verify_service(name)
        if not path_for(name, '.timer').is_file():
            raise ValueError('Timer does not exist')
        if current_enabled(name) != enabled:
            set_enabled(name, enabled)
        return unit_status(name)

def upsert_timer(args):
    require_confirm(args)
    name = valid_name(args.get('name'))
    calendar = verify_calendar(args.get('calendar'))
    enabled = args.get('enabled')
    if type(enabled) is not bool:
        raise ValueError('enabled must be a boolean')
    deployed_route(name)
    with exclusive():
        timer_path = path_for(name, '.timer')
        service_path = path_for(name, '.service')
        if timer_path.exists() != service_path.exists():
            raise ValueError('Timer and service must either both exist or both be absent')
        existing = timer_path.is_file()
        if existing:
            verify_service(name)
        old_timer = timer_path.read_text() if existing else None
        old_service = service_path.read_text() if existing else None
        old_registry = REGISTRY.read_text()
        jobs = read_registry()
        old_enabled = current_enabled(name) if existing else False
        if existing:
            schedules = [s for s in old_timer.splitlines() if s.startswith('OnCalendar=')]
            if len(schedules) != 1:
                raise ValueError('Only single-schedule timers can be edited')
            new_timer = old_timer.replace(schedules[0], 'OnCalendar=' + calendar, 1)
        else:
            new_timer = ('[Unit]\nDescription=iMenu ' + name + ' schedule\n'
                         '[Timer]\nOnCalendar=' + calendar + '\nPersistent=false\n'
                         '[Install]\nWantedBy=timers.target\n')
        new_service = ('[Unit]\nDescription=iMenu ' + name + '\nAfter=docker.service\n'
                       'ConditionPathExists=/opt/imenu-migration/ops/PRODUCTION_JOBS_ENABLED\n'
                       '[Service]\nType=oneshot\n'
                       'ExecStart=/usr/bin/python3 /opt/imenu-migration/ops/run_job.py ' + name + '\n'
                       'TimeoutStartSec=25min\nUMask=0077\n')
        if existing and old_timer == new_timer and old_enabled == enabled:
            return {'changed': False, **unit_status(name)}
        try:
            if not existing:
                if name not in BUILTINS and name not in jobs:
                    atomic_write(REGISTRY, json.dumps({'jobs': sorted(jobs + [name])}) + '\n', 0o600)
                atomic_write(service_path, new_service, 0o644)
            if not existing or old_timer != new_timer:
                atomic_write(timer_path, new_timer, 0o644)
                run(['systemctl', 'daemon-reload'], timeout=20)
            if enabled != old_enabled:
                set_enabled(name, enabled)
            elif enabled and old_timer != new_timer:
                run(['systemctl', 'restart', 'imenu-job-' + name + '.timer'], timeout=20)
            return {'changed': True, 'created': not existing, **unit_status(name)}
        except Exception:
            if old_timer is None:
                try:
                    set_enabled(name, False)
                except Exception:
                    pass
                timer_path.unlink(missing_ok=True)
                service_path.unlink(missing_ok=True)
            else:
                atomic_write(timer_path, old_timer, 0o644)
                atomic_write(service_path, old_service, 0o644)
            atomic_write(REGISTRY, old_registry, 0o600)
            run(['systemctl', 'daemon-reload'], allow_failure=True)
            if existing:
                try:
                    set_enabled(name, old_enabled)
                except Exception:
                    pass
            raise

