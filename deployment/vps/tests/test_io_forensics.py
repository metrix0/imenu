import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('io_forensics', pathlib.Path(__file__).resolve().parents[1] / 'io_forensics.py')
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


class DiskForensicsTests(unittest.TestCase):
    def test_diskstats_and_pressure(self):
        before = mod.disk_counters('202 0 xvda 100 0 200 1000 200 0 300 3000 0 4000 0')
        after = mod.disk_counters('202 0 xvda 110 0 240 1500 205 0 340 3500 0 4500 0')
        x = mod.disk_interval(before, after, 10)
        self.assertEqual(x['io_ops'], 15)
        self.assertEqual(x['await_ms'], 66.7)
        self.assertEqual(x['read_kib_s'], 2)
        self.assertEqual(x['write_kib_s'], 2)
        self.assertEqual(mod.pressure('some avg10=22.5 avg60=1.0 avg300=0.0 total=10\nfull avg10=17.3 total=13'), {'some':22.5,'full':17.3})
        self.assertFalse(mod.should_flag({'io_ops':1,'await_ms':900},{'some':0,'full':0},0))
        self.assertTrue(mod.should_flag({'io_ops':12,'await_ms':210},{'some':2,'full':0},0))
        self.assertTrue(mod.should_flag({'io_ops':0,'await_ms':0},{'some':1,'full':16},0))

    def test_process_and_cgroup_deltas(self):
        before = {'123': {'read_bytes': 2, 'write_bytes': 5, 'comm': 'postgres', 'container_id':'abcdef123456'}}
        after = {'123': {'read_bytes': 2002, 'write_bytes': 15, 'comm': 'postgres', 'container_id':'abcdef123456'}}
        results = mod.counter_deltas(after, before)
        self.assertEqual(results[0]['total_bytes'], 2010)
        self.assertEqual(results[0]['comm'], 'postgres')
        self.assertEqual(mod.cgroup_io('202:0 rbytes=120 wbytes=34 rios=3\n'), {'read_bytes': 120, 'write_bytes': 34})

    def test_actual_incident_detection_and_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            tick = [400]
            recorder = mod.IncidentRecorder(directory=pathlib.Path(tmp), blocked_fn=lambda:[{'pid': 42, 'comm':'postgres', 'wchan':'io_schedule'}],
                                            containers_fn=lambda:{'abcdef123456':'supabase-db'},
                                            pg_fn=lambda incident: incident.update(postgres_waits=[{'event':'IO:DataFileRead','count':2}]),
                                            clock=lambda:tick[0])
            def sample(time_no, latency=10):
                return {'ts':f'2026-10-23T19:40:{time_no:02d}+00:00','io':{'io_ops':20,'await_ms':latency,'read_kib_s':12,'write_kib_s':30},
                        'io_psi_avg10':{'some':40 if latency>100 else 0,'full':0},'blocked_count':5,
                        'top_processes':[{'id':'42','comm':'postgres','read_bytes':100,'write_bytes':5000}],
                        'top_containers':[{'id':'abcdef123456','read_bytes':100,'write_bytes':5000}]}
            recorder.step(sample(1))
            recorder.step(sample(2,210))
            self.assertIsNone(recorder.incident)
            recorder.step(sample(3,210))
            self.assertIsNotNone(recorder.incident)
            self.assertFalse(list(pathlib.Path(tmp).glob('*.json')), 'do not write during I/O storm')
            recorder.step(sample(4))
            recorder.step(sample(5))
            recorder.step(sample(6))
            saved = list(pathlib.Path(tmp).glob('io-incident-*.json'))
            self.assertEqual(len(saved),1)
            evidence = json.loads(saved[0].read_text())
            self.assertEqual(evidence['containers']['abcdef123456'],'supabase-db')
            self.assertEqual(evidence['blocked_processes_at_trigger'][0]['wchan'],'io_schedule')
            self.assertEqual(evidence['prelude_samples'][1]['io']['await_ms'],210)
            self.assertEqual(evidence['samples'][0]['io']['await_ms'],210)
            self.assertEqual(stat.S_IMODE(saved[0].stat().st_mode),0o600)
            self.assertEqual(stat.S_IMODE(pathlib.Path(tmp).stat().st_mode),0o700)
            recorder.step(sample(7,210))
            recorder.step(sample(8,210))
            recorder.step(sample(9))
            recorder.step(sample(10))
            recorder.step(sample(11))
            self.assertEqual(len(list(pathlib.Path(tmp).glob('*.json'))),1,'cooldown')

    def test_rotation(self):
        with tempfile.TemporaryDirectory() as tmp:
            for i in range(14):
                evidence = {'detected_at':f'2026-10-23T19:{i:02d}:00+00:00','samples':[]}
                mod.save_evidence(evidence,pathlib.Path(tmp))
            self.assertEqual(len(list(pathlib.Path(tmp).glob('*.json'))), mod.KEEP)


if __name__ == '__main__':
    unittest.main()