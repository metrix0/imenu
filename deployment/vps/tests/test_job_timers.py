import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import job_timers


class ScheduleTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        config = root / "config"
        config.mkdir()
        units = root / "units"
        units.mkdir()
        patches = patch.multiple(
            job_timers, CONFIG=config, UNITS=units, RELEASES=root / "releases",
            REGISTRY=config / "managed-jobs.json", APPLIED=config / "release-schedule.json",
            LEGACY=config / "legacy-schedule.json",
        )
        patches.start()
        self.addCleanup(patches.stop)
        job_timers.REGISTRY.write_text('{"jobs": []}')
        self.enabled = set()
        self.active = set()
        self.fail_enable = None
        self.calls = []
        mock_run = patch.object(job_timers, "run", side_effect=self.fake_run)
        mock_run.start()
        self.addCleanup(mock_run.stop)

    def fake_run(self, args, **kwargs):
        self.calls.append(args)
        if args[0] != "systemctl" or args[1] == "daemon-reload":
            return "", 0
        action, unit = args[1], args[-1]
        if action == "is-enabled":
            return ("enabled", 0) if unit in self.enabled else ("disabled", 1)
        if action == "is-active":
            return ("active", 0) if unit in self.active else ("inactive", 3)
        if action == "enable":
            if unit == self.fail_enable:
                raise ValueError("enable failed")
            self.enabled.add(unit)
        if action == "disable":
            self.enabled.discard(unit)
        if action == "restart" or action == "enable" and "--now" in args:
            self.active.add(unit)
        if action == "stop" or action == "disable" and "--now" in args:
            self.active.discard(unit)
        return "", 0

    def release(self, sha, jobs, with_manifest=True):
        root = job_timers.RELEASES / sha
        server = root / ".next/server"
        server.mkdir(parents=True)
        entries = {}
        for job in jobs:
            route = f"app/api/cron/{job}/route.js"
            entries[f"/api/cron/{job}/route"] = route
            path = server / route
            path.parent.mkdir(parents=True)
            path.touch()
        (server / "app-paths-manifest.json").write_text(json.dumps(entries))
        if with_manifest:
            (root / job_timers.MANIFEST).write_text(json.dumps(jobs))

    def test_enable_update_and_rollback(self):
        old, new = "a" * 40, "b" * 40
        previous = {"existing": "*-*-* 12:00:00 UTC"}
        desired = {"existing": "*-*-* 13:00:00 UTC", "new-cron": "*-*-* 14:00:00 UTC"}
        self.release(old, previous, with_manifest=False)
        job_timers.LEGACY.write_text(json.dumps(previous))
        self.release(new, desired)
        job_timers.release_schedule(old)
        job_timers.release_schedule(new)
        self.assertEqual(self.enabled, {"imenu-job-existing.timer", "imenu-job-new-cron.timer"})
        self.assertIn("OnCalendar=" + desired["existing"], job_timers.path_for("existing", ".timer").read_text())
        self.calls.clear()
        job_timers.release_schedule(new)
        self.assertFalse(any(a[0] == "systemctl" and a[1] in {"enable", "disable", "restart", "daemon-reload"} for a in self.calls))
        job_timers.release_schedule(old)
        self.assertEqual(self.enabled, {"imenu-job-existing.timer"})
        self.assertEqual(self.active, self.enabled)
        self.assertIn("OnCalendar=" + previous["existing"], job_timers.path_for("existing", ".timer").read_text())

    def test_failed_enable_restores_prior_timer_and_registry(self):
        old, new = "a" * 40, "b" * 40
        previous = {"existing": "*-*-* 12:00:00 UTC"}
        self.release(old, previous)
        self.release(new, {"existing": "*-*-* 13:00:00 UTC", "new-cron": "*-*-* 14:00:00 UTC"})
        job_timers.release_schedule(old)
        self.fail_enable = "imenu-job-new-cron.timer"
        with self.assertRaisesRegex(ValueError, "enable failed"):
            job_timers.release_schedule(new)
        self.assertEqual(self.enabled, {"imenu-job-existing.timer"})
        self.assertFalse(job_timers.path_for("new-cron", ".service").exists())
        self.assertEqual(json.loads(job_timers.APPLIED.read_text()), previous)
        self.assertEqual(job_timers.read_registry(), ["existing"])
        self.assertIn("OnCalendar=" + previous["existing"], job_timers.path_for("existing", ".timer").read_text())

    def test_prepare_creates_units_without_enabling_them(self):
        sha = "a" * 40
        self.release(sha, {"new-cron": "*-*-* 14:00:00 UTC"})
        job_timers.release_schedule(sha, stage=True)
        self.assertTrue(job_timers.path_for("new-cron", ".timer").is_file())
        self.assertFalse(self.enabled)
        self.assertFalse(job_timers.APPLIED.exists())
        job_timers.release_schedule(sha)
        self.assertEqual(self.enabled, {"imenu-job-new-cron.timer"})

    def test_preflight_checks_route_without_installing_timer(self):
        sha = "a" * 40
        self.release(sha, {"new-cron": "*-*-* 14:00:00 UTC"})
        job_timers.release_schedule(sha, validate_only=True)
        self.assertFalse(self.enabled)
        (job_timers.RELEASES / sha / ".next/server/app/api/cron/new-cron/route.js").unlink()
        with self.assertRaisesRegex(ValueError, "no compiled route"):
            job_timers.release_schedule(sha)
        self.assertFalse(job_timers.APPLIED.exists())


if __name__ == "__main__":
    unittest.main()
