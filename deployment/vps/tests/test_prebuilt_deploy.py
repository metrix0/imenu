import hashlib,json,os,pathlib,subprocess,tempfile,unittest
SCRIPT=(pathlib.Path(__file__).resolve().parents[1]/'deploy-prebuilt.sh').read_text()
SHA='a'*40
OLD='b'*40
class DeploymentTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(); self.root=pathlib.Path(self.tmp.name)
  self.base=self.root/'base'; self.bin=self.root/'bin'; self.bin.mkdir()
  self.state=self.base/'ops/production-deploy-state'; self.state.mkdir(parents=True)
  self.releases=self.base/'ops/production-releases'; (self.releases/SHA).mkdir(parents=True)
  (self.base/'ops/config').mkdir(); (self.base/'secrets').mkdir()
  (self.base/'ops/PRODUCTION_JOBS_ENABLED').touch()
  public={'NEXT_PUBLIC_SUPABASE_URL':'https://api.imenuapp.com.br'}
  for name in ['app-production-build.env','app-production.env']:
   (self.base/'secrets'/name).write_text('NEXT_PUBLIC_SUPABASE_URL=https://api.imenuapp.com.br\n')
  for name,value in [('.imenu-commit-sha',SHA),('.imenu-public-config-sha256',hashlib.sha256(json.dumps(public,sort_keys=True).encode()).hexdigest())]:
   (self.releases/SHA/name).write_text(value+'\n')
  (self.base/'ops/config/compose.production.yml').write_text('OLD_CONFIG\n')
  (self.state/'active-prebuilt.yml').write_text('OLD_OVERLAY\n')
  (self.state/'deployed-sha').write_text(OLD+'\n')
  (self.root/'active').write_text('old')
  self.script=self.root/'deploy.sh'; self.script.write_text(SCRIPT.replace('BASE=/opt/imenu-migration',f'BASE={self.base}'))
  self.mock('sleep','exit 0\n')
  self.mock('git',f"printf '%s\\trefs/heads/main\\n' {SHA}\n")
  self.mock('install','exit 0\n')
  self.mock('docker', r'''python3 - "$@" <<'CODE'
import os,pathlib,sys
r=pathlib.Path(os.environ['FIXTURE']); a=sys.argv[1:]
with (r/'calls').open('a') as f: f.write(' '.join(a)+'\n')
if a[:2]==['network','inspect']: print('true')
elif a[0]=='inspect':
 if 'Health.Status' in a[-1]:
  bad=os.environ.get('FAIL_ACTIVATION')=='1' and (r/'active').read_text()=='new' and a[1]=='imenu-production-app'
  print('unhealthy' if bad else 'healthy')
 elif 'State.Running' in a[-1]: print('true')
 elif 'WorkingDir' in a[-1]: print('/app')
 else: print('sha256:runtime')
elif a[0]=='exec' and 'cat' in a: print('a'*40)
elif a[0]=='compose':
 if '--no-env-resolution' in a:
  print('OLD_FULL_CONFIG' if 'active-prebuilt.yml' in ' '.join(a) else 'NEW_FULL_CONFIG')
 elif 'up' in a:
  rollback='restore-release.yml' in ' '.join(a) or 'rollback-release.yml' in ' '.join(a) or 'before-manual-rollback.yml' in ' '.join(a)
  (r/'active').write_text('old' if rollback else 'new')
CODE
''')
  self.env={**os.environ,'PATH':str(self.bin)+':'+os.environ['PATH'],'FIXTURE':str(self.root)}
 def mock(self,name,body):
  p=self.bin/name;p.write_text('#!/usr/bin/env bash\n'+body);p.chmod(0o755)
 def run_script(self,action,**env):
  args=['bash',str(self.script),'production',action]
  if action not in ['rollback','check-rollback']:args.append(SHA)
  return subprocess.run(args,env={**self.env,**env},text=True,capture_output=True)
 def tearDown(self):self.tmp.cleanup()
 def test_success_and_manual_rollback(self):
  r=self.run_script('activate');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertEqual((self.state/'deployed-sha').read_text().strip(),SHA)
  self.assertEqual((self.state/'rollback-sha').read_text().strip(),OLD)
  self.assertEqual((self.state/'rollback-release.yml').read_text().strip(),'OLD_FULL_CONFIG')
  r=self.run_script('rollback');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertEqual((self.state/'deployed-sha').read_text().strip(),OLD)
 def test_failed_activation_restores_previous(self):
  r=self.run_script('activate',FAIL_ACTIVATION='1');self.assertNotEqual(r.returncode,0)
  self.assertEqual((self.root/'active').read_text(),'old')
  self.assertEqual((self.state/'deployed-sha').read_text().strip(),OLD)
  self.assertEqual((self.state/'failed-sha').read_text().strip(),SHA)
  self.assertIn('Previous application restored and healthy',r.stderr)
 def test_verify_does_not_switch(self):
  r=self.run_script('verify');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_smoke_is_bounded_and_does_not_launch_browser(self):
  r=self.run_script('verify');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  calls=(self.root/'calls').read_text()
  self.assertIn('smoke-limits.yml run -d --no-deps',calls)
  self.assertNotIn("puppeteer",SCRIPT[SCRIPT.index('# Check the real release'):SCRIPT.index('echo "TIMING preflight=')])
  self.assertFalse((self.state/'smoke-limits.yml').exists())
  self.assertEqual((self.state/'deployed-sha').read_text().strip(),OLD)
 def test_config_mismatch_leaves_live_untouched(self):
  (self.releases/SHA/'.imenu-public-config-sha256').write_text('wrong')
  r=self.run_script('activate');self.assertNotEqual(r.returncode,0)
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_obsolete_sha_is_skipped(self):
  self.mock('git',f"printf '%s\\trefs/heads/main\\n' {OLD}\n")
  r=self.run_script('activate');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_cached_installers_omit_transfer(self):
  content=b'installer'; digest=hashlib.sha256(content).hexdigest()
  cache=self.base/'ops/release-assets';cache.mkdir();(cache/digest).write_bytes(content)
  manifest=[{'path':'public/downloads/Setup 1.exe','sha256':digest,'size':len(content)}]
  r=subprocess.run(['bash',str(self.script),'production','assets-ready'],input=json.dumps(manifest),env=self.env,text=True,capture_output=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual(r.stdout.strip(),'READY')
 def test_missing_installer_requests_full_archive(self):
  manifest=[{'path':'public/downloads/Setup 1.exe','sha256':'0'*64,'size':9}]
  r=subprocess.run(['bash',str(self.script),'production','assets-ready'],input=json.dumps(manifest),env=self.env,text=True,capture_output=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr);self.assertEqual(r.stdout.strip(),'FULL')
 def test_invalid_asset_path_rejected(self):
  manifest=[{'path':'public/downloads/../../../secrets/private.exe','sha256':'0'*64,'size':9}]
  r=subprocess.run(['bash',str(self.script),'production','assets-ready'],input=json.dumps(manifest),env=self.env,text=True,capture_output=True)
  self.assertNotEqual(r.returncode,0)
 def test_wrong_checksum_rejects_download(self):
  self.mock('curl',r"""
while [[ "$1" != --output ]]; do shift; done
printf corrupt > "$2"
""")
  r=subprocess.run(['bash',str(self.script),'production','pull-release',SHA,'0'*64],input='https://release-assets.githubusercontent.com/test\n',env=self.env,text=True,capture_output=True)
  self.assertNotEqual(r.returncode,0)
  self.assertIn('SHA256 mismatch',r.stderr)
  self.assertFalse(list(self.releases.glob('.download-*')))
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_complete_partial_is_reused_without_network(self):
  data=b'complete';digest=hashlib.sha256(data).hexdigest()
  (self.releases/('.download-'+digest+'.part')).write_bytes(data)
  self.mock('curl','touch "$FIXTURE/network-called"; exit 99\n')
  source=self.script.read_text()
  source=source.replace('if [[ "$action" == upload ]]; then', 'if [[ "$action" == upload ]]; then exit 0; fi\nif [[ "$action" == upload ]]; then',1)
  self.script.write_text(source)
  r=subprocess.run(['bash',str(self.script),'production','pull-release',SHA,digest],input='https://release-assets.githubusercontent.com/test\n',env=self.env,text=True,capture_output=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertFalse((self.root/'network-called').exists())
  self.assertIn('Reusing completed',r.stdout)
 def test_download_resumes_partial_bytes(self):
  import hashlib
  self.mock('curl',r"""
python3 - "$@" <<'CODE'
import os,pathlib,sys
r=pathlib.Path(os.environ['FIXTURE']);a=sys.argv[1:];out=pathlib.Path(a[a.index('--output')+1])
assert '--continue-at' in a and a[a.index('--continue-at')+1]=='-'
if not (r/'interrupted').exists():
 out.write_bytes(b'partial-');(r/'interrupted').touch();sys.exit(28)
assert out.read_bytes()==b'partial-'
out.write_bytes(b'partial-complete')
CODE
""")
  self.mock('zstd','exit 0\n')
  self.mock('tar',r"""
python3 - "$@" <<'CODE'
import os,pathlib,sys,shutil
r=pathlib.Path(os.environ['FIXTURE']);a=sys.argv[1:];d=pathlib.Path(a[a.index('-C')+1])
src=r/'base/ops/production-releases'/('a'*40)
shutil.copytree(src,d,dirs_exist_ok=True)
(d/'server.js').touch();(d/'.next').mkdir();(d/'.next/BUILD_ID').write_text('build')
(d/'node_modules/next').mkdir(parents=True);(d/'node_modules/next/package.json').write_text('{}')
CODE
""")
  digest=hashlib.sha256(b'partial-complete').hexdigest()
  r=subprocess.run(['bash',str(self.script),'production','pull-release',SHA,digest],input='https://release-assets.githubusercontent.com/test\n',env=self.env,text=True,capture_output=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertIn('retaining partial bytes',r.stderr)
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_preview_toggle_off_leaves_app_untouched(self):
  self.script.write_text(self.script.read_text().replace('BRANCH=main','BRANCH=preview').replace('if [[ "$target" == preview ]]','if [[ "$target" == production ]]'))
  self.mock('curl',"printf 'OFF'\n")
  r=self.run_script('activate');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
  self.assertEqual((self.root/'active').read_text(),'old')
 def test_deploy_lock_blocks_concurrent_activation(self):
  import fcntl
  with (self.state/'deploy.lock').open('w') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   r=self.run_script('activate')
  self.assertEqual(r.returncode,75,r.stdout+r.stderr)
if __name__=='__main__':unittest.main()
