#!/usr/bin/env python3
"""Low-overhead VPS disk-I/O incident recorder. No network or application changes.

A 10-second sampler keeps recent process/container I/O deltas in RAM. Detailed
records are written once after the disk recovers, not repeatedly during stalls.
"""
import collections
import datetime as dt
import json
import os
import pathlib
import re
import signal
import subprocess
import sys
import threading
import time

ROOT = pathlib.Path('/opt/imenu-migration/ops')
EVIDENCE = ROOT / 'io-forensics'
DEVICE = os.environ.get('IMENU_IO_DEVICE', 'xvda')
INTERVAL = 10
KEEP = 12
HISTORY = 12  # 2 minutes before a detected event
MAX_INCIDENT_SAMPLES = 90  # 15 minutes, bounded even if storage stays blocked
COOLDOWN = 120  # seconds after recovery, avoid repeat files
CGROUP_ROOT = pathlib.Path('/sys/fs/cgroup/system.slice')
CGROUP_PATTERN = re.compile(r'^docker-([0-9a-f]{64})\.scope$')


def disk_counters(text, device=DEVICE):
    """Parse /proc/diskstats; values are cumulative since boot."""
    for line in text.splitlines():
        f = line.split()
        if len(f) >= 14 and f[2] == device:
            return {'read_ops': int(f[3]), 'read_sectors': int(f[5]),
                    'read_ms': int(f[6]), 'write_ops': int(f[7]),
                    'write_sectors': int(f[9]), 'write_ms': int(f[10]),
                    'inflight': int(f[11]), 'busy_ms': int(f[12])}
    raise ValueError('missing block device ' + device)


def pressure(text):
    result = {}
    for line in text.splitlines():
        f = line.split()
        if f and f[0] in ('some', 'full'):
            fields = dict(x.split('=', 1) for x in f[1:] if '=' in x)
            result[f[0]] = float(fields.get('avg10', 0))
    return result


def disk_interval(before, after, elapsed):
    reads = max(0, after['read_ops'] - before['read_ops'])
    writes = max(0, after['write_ops'] - before['write_ops'])
    ops = reads + writes
    service_ms = max(0, after['read_ms'] - before['read_ms']) + max(0, after['write_ms'] - before['write_ms'])
    return {'io_ops': ops, 'reads': reads, 'writes': writes,
            'read_kib_s': round(max(0, after['read_sectors'] - before['read_sectors']) / 2 / elapsed, 1),
            'write_kib_s': round(max(0, after['write_sectors'] - before['write_sectors']) / 2 / elapsed, 1),
            'await_ms': round(service_ms / ops, 1) if ops else 0,
            'busy_percent': round(max(0, after['busy_ms'] - before['busy_ms']) / (elapsed * 10), 1),
            'inflight': after['inflight']}


def should_flag(disk, psi, blocked):
    # Avoid false positives from one isolated slow I/O operation.
    return (disk['io_ops'] >= 5 and disk['await_ms'] >= 100) or psi.get('full', 0) >= 15 or psi.get('some', 0) >= 35 or (blocked >= 6 and psi.get('some', 0) >= 10)


def proc_io(text):
    fields = {}
    for line in text.splitlines():
        if ': ' in line:
            key, value = line.split(': ', 1)
            if key in ('read_bytes', 'write_bytes', 'cancelled_write_bytes'):
                fields[key] = int(value)
    return fields if 'read_bytes' in fields and 'write_bytes' in fields else None


def cgroup_io(text):
    counts = {'read_bytes': 0, 'write_bytes': 0}
    for line in text.splitlines():
        columns = line.split()
        if not columns:
            continue
        # Include both whole-disk and partition IO; values belong to their cgroup.
        for key in ('rbytes', 'wbytes'):
            for column in columns[1:]:
                if column.startswith(key + '='):
                    counts['read_bytes' if key == 'rbytes' else 'write_bytes'] += int(column.split('=', 1)[1])
    return counts


def counter_deltas(current, previous, limit=12):
    changes = []
    for key, info in current.items():
        old = previous.get(key, {})
        read = max(0, info['read_bytes'] - old.get('read_bytes', info['read_bytes']))
        write = max(0, info['write_bytes'] - old.get('write_bytes', info['write_bytes']))
        if read or write:
            changes.append({'id': str(key), 'read_bytes': read, 'write_bytes': write, 'total_bytes': read + write,
                            **{k: info[k] for k in ('comm', 'container_id') if k in info}})
    return sorted(changes, key=lambda x: x['total_bytes'], reverse=True)[:limit]


def get_proc_counters(cache):
    result = {}
    for pid_dir in pathlib.Path('/proc').glob('[0-9]*'):
        pid = pid_dir.name
        try:
            values = proc_io((pid_dir / 'io').read_text())
            if values is None:
                continue
            if pid not in cache:
                comm = (pid_dir / 'comm').read_text().strip()[:32]
                group = (pid_dir / 'cgroup').read_text()
                match = re.search(r'docker-([0-9a-f]{64})\.scope', group)
                cache[pid] = {'comm': comm, 'container_id': match.group(1)[:12] if match else None}
            result[pid] = {**values, **cache[pid]}
        except (OSError, ValueError):
            continue
    for pid in list(cache):
        if pid not in result:
            cache.pop(pid, None)
    return result


def get_cgroup_counters():
    result = {}
    for path in CGROUP_ROOT.glob('docker-*.scope/io.stat'):
        match = CGROUP_PATTERN.match(path.parent.name)
        if match:
            try:
                result[match.group(1)[:12]] = cgroup_io(path.read_text())
            except (OSError, ValueError):
                pass
    return result


def get_blocked_processes():
    blocked = []
    for pid_dir in pathlib.Path('/proc').glob('[0-9]*'):
        try:
            raw = (pid_dir / 'stat').read_text()
            # /proc/PID/stat comm may contain spaces and closing parentheses.
            state = raw.rsplit(')', 1)[1].split()[0]
            if state == 'D':
                blocked.append({'pid': int(pid_dir.name),
                                'comm': (pid_dir / 'comm').read_text().strip()[:32],
                                'wchan': (pid_dir / 'wchan').read_text().strip()[:64]})
        except (OSError, IndexError):
            continue
    return blocked[:25]


def get_pg_waits(report):
    # One time-limited, read-only aggregation; never captures query text or rows.
    sql = "SELECT coalesce(wait_event_type,'running') || ':' || coalesce(wait_event,'none'), count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC LIMIT 15"
    try:
        p = subprocess.run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-U', 'supabase_admin',
                            '-d', 'postgres', '-XAt', '-c', sql], timeout=3, text=True,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        report['postgres_waits'] = [{'event': line.split('|', 1)[0], 'count': int(line.split('|', 1)[1])}
                                    for line in p.stdout.splitlines() if '|' in line][:15] if p.returncode == 0 else {'error': 'query-failed'}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        report['postgres_waits'] = {'error': 'unavailable-during-spike'}


def container_names():
    try:
        p = subprocess.run(['docker', 'ps', '--no-trunc', '--format', '{{.ID}}|{{.Names}}'],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=3)
        if p.returncode == 0:
            return {line.split('|', 1)[0][:12]: line.split('|', 1)[1] for line in p.stdout.splitlines() if '|' in line}
    except (OSError, subprocess.TimeoutExpired):
        pass
    return {}


def one_sample(previous, proc_prev, cg_prev, cache):
    time_s = time.monotonic()
    disk = disk_counters(pathlib.Path('/proc/diskstats').read_text())
    io_psi = pressure(pathlib.Path('/proc/pressure/io').read_text())
    memory_psi = pressure(pathlib.Path('/proc/pressure/memory').read_text())
    procs = get_proc_counters(cache)
    cgroups = get_cgroup_counters()
    blocked_raw = next((line for line in pathlib.Path('/proc/stat').read_text().splitlines()
                        if line.startswith('procs_blocked ')), 'procs_blocked 0')
    blocked = int(blocked_raw.split()[1])
    elapsed = max(0.01, time_s - previous['time']) if previous else INTERVAL
    disk_measures = disk_interval(previous['disk'], disk, elapsed) if previous else {}
    sample = {'ts': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
              'io': disk_measures, 'io_psi_avg10': io_psi,
              'memory_psi_avg10': memory_psi, 'blocked_count': blocked,
              'top_processes': counter_deltas(procs, proc_prev),
              'top_containers': counter_deltas(cgroups, cg_prev)}
    return sample, {'time': time_s, 'disk': disk}, procs, cgroups


def save_evidence(evidence, directory=EVIDENCE):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    stamp = evidence['detected_at'].replace('-', '').replace(':', '').replace('+00:00', 'Z')
    name = 'io-incident-' + stamp.replace('T', '-') + '.json'
    output = directory / name
    tmp = directory / (name + '.partial')
    with tmp.open('x', encoding='utf-8') as f:
        json.dump(evidence, f, separators=(',', ':'), ensure_ascii=True)
    os.chmod(tmp, 0o600)
    tmp.replace(output)
    for stale in sorted(directory.glob('io-incident-*.json'), reverse=True)[KEEP:]:
        stale.unlink(missing_ok=True)
    return output


def run_once():
    # Read-only field verification. Does not write synthetic incidents.
    sample, *_ = one_sample(None, {}, {}, {})
    print(json.dumps({'io_psi_avg10': sample['io_psi_avg10'],
                      'blocked_count': sample['blocked_count'],
                      'processes_seen': len(get_proc_counters({})),
                      'containers_seen': len(get_cgroup_counters()),
                      'device': DEVICE}))


class IncidentRecorder:
    """Bounded incident state machine; separates polling from forensic capture."""

    def __init__(self, directory=EVIDENCE, blocked_fn=get_blocked_processes,
                 containers_fn=container_names, pg_fn=get_pg_waits, clock=time.monotonic):
        self.directory = directory
        self.blocked_fn = blocked_fn
        self.containers_fn = containers_fn
        self.pg_fn = pg_fn
        self.clock = clock
        self.past = collections.deque(maxlen=HISTORY)
        self.bad = 0
        self.good = 0
        self.last_saved = -COOLDOWN
        self.incident = None

    def finish(self, ended_at):
        incident = self.incident
        if incident is None:
            return
        incident['ended_at'] = ended_at
        if ended_at != 'interrupted':
            incident['blocked_processes_at_end'] = self.blocked_fn()
        try:
            output = save_evidence(incident, self.directory)
            print('IMENU_IO_FORENSICS incident_saved=' + str(output), flush=True)
            self.last_saved = self.clock()
            self.incident = None
        except OSError as error:
            # Retain data in RAM and retry after the disk starts responding.
            print('IMENU_IO_FORENSICS persist_error=' + type(error).__name__, flush=True)

    def step(self, sample):
        if not sample['io']:
            self.past.append(sample)
            return
        flagged = should_flag(sample['io'], sample['io_psi_avg10'], sample['blocked_count'])
        self.bad = self.bad + 1 if flagged else 0
        self.good = 0 if flagged else self.good + 1
        if self.incident:
            incident = self.incident
            incident['latest_at'] = sample['ts']
            incident['sample_count'] += 1
            incident['samples'].append(sample)
            # Preserve the first two minutes plus the most recent samples.
            if len(incident['samples']) > MAX_INCIDENT_SAMPLES:
                incident['samples'].pop(HISTORY)
            if self.good >= 3:
                self.finish(sample['ts'])
        elif (self.bad >= 2 or (flagged and sample['io_psi_avg10'].get('full', 0) >= 35)) and self.clock() - self.last_saved >= COOLDOWN:
            incident = {'version': 1, 'device': DEVICE, 'detected_at': sample['ts'],
                        'latest_at': sample['ts'], 'sample_count': 1,
                        'prelude_samples': list(self.past), 'samples': [sample],
                        'blocked_processes_at_trigger': self.blocked_fn(),
                        'containers': self.containers_fn()}
            self.incident = incident
            threading.Thread(target=self.pg_fn, args=(incident,), daemon=True).start()
            print('IMENU_IO_FORENSICS incident_detected=' + sample['ts'], flush=True)
        self.past.append(sample)


def run():
    os.umask(0o077)
    proc_cache = {}
    prev = None
    proc_prev = {}
    cg_prev = {}
    recorder = IncidentRecorder()
    stopped = False

    def stop(*_):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print('IMENU_IO_FORENSICS started device=' + DEVICE + ' interval_s=10', flush=True)
    next_tick = time.monotonic()
    while not stopped:
        try:
            sample, prev, proc_prev, cg_prev = one_sample(prev, proc_prev, cg_prev, proc_cache)
            recorder.step(sample)
        except (OSError, ValueError, KeyError) as error:
            print('IMENU_IO_FORENSICS sample_error=' + type(error).__name__, flush=True)
        next_tick = max(next_tick + INTERVAL, time.monotonic() + INTERVAL)
        while not stopped and time.monotonic() < next_tick:
            time.sleep(min(0.5, max(0.01, next_tick - time.monotonic())))
    if recorder.incident:
        recorder.finish('interrupted')


if __name__ == '__main__':
    if len(sys.argv) == 2 and sys.argv[1] == '--once':
        run_once()
    elif len(sys.argv) == 1:
        run()
    else:
        raise SystemExit('Usage: io_forensics.py [--once]')