"""Restricted management of iMenu's production API-route systemd timers."""
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

OPS = Path('/opt/imenu-migration/ops')
UNITS = Path('/etc/systemd/system')
CONFIG = OPS / 'job-config'
REGISTRY = CONFIG / 'managed-jobs.json'
DEPLOYED_SHA = OPS / 'production-deploy-state/deployed-sha'
RELEASES = OPS / 'production-releases'
APPLIED = CONFIG / 'release-schedule.json'
LEGACY = CONFIG / 'legacy-schedule.json'
MANIFEST = '.imenu-cron-schedule.json'
BUILTINS = frozenset(('daily-payout', 'reconcile-payouts', 'addon-expiry-whatsapp',
                      'ia-vendas-analysis', 'storage-cleanup'))
NAME = re.compile(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*\Z')
CALENDAR = re.compile(r'[A-Za-z0-9*.:,_+/~\- ]+\Z')

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
    run(['/usr/bin/systemd-analyze', 'calendar', '--iterations=1', '--', value])
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

def deployed_route(name, sha=None):
    """Validate the active compiled production release, not the obsolete source checkout."""
    valid_name(name)
    if sha is None:
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

def unit_active(name):
    _, code = run(['systemctl', 'is-active', 'imenu-job-' + name + '.timer'], allow_failure=True)
    return code == 0


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

def timer_snapshot(name):
    timer = path_for(name, '.timer')
    service = path_for(name, '.service')
    if timer.exists() != service.exists():
        raise ValueError('Timer and service must either both exist or both be absent')
    if not timer.is_file():
        return None, None, False, False
    verify_service(name)
    return timer.read_text(), service.read_text(), current_enabled(name), unit_active(name)


def write_timer(name, calendar, snapshot):
    old_timer, _, _, _ = snapshot
    timer = path_for(name, '.timer')
    if old_timer is not None:
        schedules = [line for line in old_timer.splitlines() if line.startswith('OnCalendar=')]
        if len(schedules) != 1:
            raise ValueError('Only single-schedule timers can be edited')
        new_timer = old_timer.replace(schedules[0], 'OnCalendar=' + calendar, 1)
    else:
        new_timer = ('[Unit]\nDescription=iMenu ' + name + ' schedule\n'
                     '[Timer]\nOnCalendar=' + calendar + '\nPersistent=false\n'
                     '[Install]\nWantedBy=timers.target\n')
        service = ('[Unit]\nDescription=iMenu ' + name + '\nAfter=docker.service\n'
                   'ConditionPathExists=/opt/imenu-migration/ops/PRODUCTION_JOBS_ENABLED\n'
                   '[Service]\nType=oneshot\n'
                   'ExecStart=/usr/bin/python3 /opt/imenu-migration/ops/run_job.py ' + name + '\n'
                   'TimeoutStartSec=25min\nUMask=0077\n')
        atomic_write(path_for(name, '.service'), service, 0o644)
    if old_timer == new_timer:
        return False
    atomic_write(timer, new_timer, 0o644)
    return True


def apply_timers(desired, enable=True, save=False, stage=False):
    with exclusive():
        previous = read_schedule(APPLIED) if save and APPLIED.exists() else {}
        removed = previous.keys() - desired.keys()
        jobs = read_registry()
        old_registry = REGISTRY.read_text()
        snapshots = {name: timer_snapshot(name) for name in sorted(desired.keys() | removed)}
        changed = set()
        touched = []
        try:
            registered = set(jobs) | (desired.keys() - BUILTINS)
            if registered != set(jobs):
                atomic_write(REGISTRY, json.dumps({'jobs': sorted(registered)}) + '\n', 0o600)
            for name, calendar in desired.items():
                touched.append(name)
                if write_timer(name, calendar, snapshots[name]):
                    changed.add(name)
            if changed:
                run(['systemctl', 'daemon-reload'], timeout=20)
            for name in removed:
                if snapshots[name][2] or snapshots[name][3]:
                    touched.append(name)
                    set_enabled(name, False)
                    changed.add(name)
            for name in desired:
                _, _, was_enabled, was_active = snapshots[name]
                if stage:
                    continue
                if (enable and not was_enabled) or (not enable and (was_enabled or was_active)):
                    set_enabled(name, enable)
                    changed.add(name)
                elif enable and (name in changed or not was_active):
                    run(['systemctl', 'restart', 'imenu-job-' + name + '.timer'], timeout=20)
                    changed.add(name)
            if save:
                atomic_write(APPLIED, json.dumps(desired, sort_keys=True) + '\n', 0o600)
            return changed
        except Exception:
            rollback_errors = []
            for name in touched:
                timer, service, _, _ = snapshots[name]
                try:
                    if timer is None:
                        if path_for(name, '.timer').exists():
                            set_enabled(name, False)
                        path_for(name, '.timer').unlink(missing_ok=True)
                        path_for(name, '.service').unlink(missing_ok=True)
                    else:
                        atomic_write(path_for(name, '.timer'), timer, 0o644)
                        atomic_write(path_for(name, '.service'), service, 0o644)
                except Exception as error:
                    rollback_errors.append(str(error))
            try:
                atomic_write(REGISTRY, old_registry, 0o600)
                run(['systemctl', 'daemon-reload'], timeout=20)
            except Exception as error:
                rollback_errors.append(str(error))
            for name in touched:
                timer, _, was_enabled, was_active = snapshots[name]
                if timer is None:
                    continue
                try:
                    unit = 'imenu-job-' + name + '.timer'
                    run(['systemctl', 'enable' if was_enabled else 'disable', unit], timeout=20)
                    run(['systemctl', 'restart' if was_active else 'stop', unit], timeout=20)
                except Exception as error:
                    rollback_errors.append(str(error))
            if rollback_errors:
                print('Timer recovery failed: ' + '; '.join(rollback_errors), file=sys.stderr)
            raise


def upsert_timer(args):
    require_confirm(args)
    name = valid_name(args.get('name'))
    calendar = verify_calendar(args.get('calendar'))
    enabled = args.get('enabled')
    if type(enabled) is not bool:
        raise ValueError('enabled must be a boolean')
    deployed_route(name)
    created = not path_for(name, '.timer').is_file()
    changed = apply_timers({name: calendar}, enable=enabled)
    return {'changed': name in changed, 'created': created, **unit_status(name)}


def read_schedule(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 65536:
        raise ValueError('Cron schedule must be a regular JSON file')
    def unique_jobs(pairs):
        jobs = dict(pairs)
        if len(jobs) != len(pairs):
            raise ValueError('Duplicate job name in cron schedule')
        return jobs

    schedule = json.loads(path.read_text(), object_pairs_hook=unique_jobs)
    if not isinstance(schedule, dict):
        raise ValueError('Cron schedule must map job names to calendars')
    return {valid_name(name): verify_calendar(calendar) for name, calendar in schedule.items()}


def release_schedule(sha, validate_only=False, stage=False):
    if not re.fullmatch(r'[a-f0-9]{40}', sha):
        raise ValueError('Invalid release identity')
    release = RELEASES / sha
    if not release.is_dir():
        raise ValueError('Release directory unavailable')
    manifest = release / MANIFEST
    source = manifest if manifest.exists() or manifest.is_symlink() else LEGACY
    if source == LEGACY and not LEGACY.exists():
        return
    schedule = read_schedule(source)
    for name in schedule:
        deployed_route(name, sha)
    if validate_only:
        return
    # Keep the cutover/rollback inventory separate from manually managed jobs.
    changed = apply_timers(schedule, save=not stage, stage=stage)
    operation = 'prepared' if stage else 'reconciled'
    print(f'Production cron schedule {operation}: ' + (', '.join(sorted(changed)) or 'already current'))


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3 or sys.argv[1] not in {'validate-release', 'prepare-release', 'sync-release'}:
            raise ValueError('Expected validate-release, prepare-release or sync-release followed by a release SHA')
        release_schedule(sys.argv[2], validate_only=sys.argv[1] == 'validate-release',
                         stage=sys.argv[1] == 'prepare-release')
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        sys.exit(str(error))
