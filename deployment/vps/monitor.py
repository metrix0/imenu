#!/usr/bin/env python3
import datetime, json, pathlib, shutil, subprocess, urllib.request
root = pathlib.Path("/opt/imenu-migration")
alerts = []
ps = subprocess.run(["docker", "ps", "-a", "--format", "{{.Names}}|{{.Status}}"], capture_output=True, text=True, check=True)
required = ["imenu-stage-app", "supabase-db", "supabase-auth", "supabase-envoy",
            "supabase-storage", "supabase-rest", "imenu-stage-proxy", "realtime-dev.supabase-realtime", "supabase-edge-functions",
            "imenu-kinghost-waha", "imenu-stage-mcp-gateway"]
if (root/"ops/PRODUCTION_JOBS_ENABLED").exists(): required.append("imenu-production-app")
states = dict(line.split("|", 1) for line in ps.stdout.splitlines())
for name in required:
    if not states.get(name, "").startswith("Up") or "(unhealthy)" in states.get(name, ""):
        alerts.append("container:" + name)
app_container="imenu-production-app" if (root/"ops/PRODUCTION_JOBS_ENABLED").exists() else "imenu-stage-app"
info=json.loads(subprocess.check_output(["docker","inspect",app_container],text=True))[0]
ip=info["NetworkSettings"]["Networks"]["imenu-stage_default"]["IPAddress"]
try:
    with urllib.request.urlopen("http://"+ip+":3000/api/health", timeout=20) as response:
        if response.status != 200: alerts.append("application-health")
except Exception: alerts.append("application-health")
retention = subprocess.run(["systemctl", "show", "imenu-docker-retention.service", "-p", "Result", "--value"], capture_output=True, text=True)
if retention.returncode != 0 or retention.stdout.strip() != "success":
    alerts.append("docker-retention-failed")
timer = subprocess.run(["systemctl", "is-active", "--quiet", "imenu-docker-retention.timer"])
if timer.returncode != 0: alerts.append("docker-retention-timer-inactive")
if subprocess.run(["systemctl", "is-active", "--quiet", "imenu-io-forensics.service"]).returncode != 0:
    alerts.append("io-forensics-inactive")
disk=shutil.disk_usage(root)
if disk.used/(disk.used+disk.free) >= .80: alerts.append("disk-over-80-percent")
memory=dict(line.split(":",1) for line in pathlib.Path("/proc/meminfo").read_text().splitlines())
memory_used=1-int(memory["MemAvailable"].split()[0])/int(memory["MemTotal"].split()[0])
if memory_used >= .90: alerts.append("memory-over-90-percent")
latest=root/"backups/latest-encrypted"
if not latest.exists(): alerts.append("no-encrypted-backup")
elif not pathlib.Path(latest.read_text().strip()).exists(): alerts.append("backup-file-missing")
elif datetime.datetime.now().timestamp()-pathlib.Path(latest.read_text().strip()).stat().st_mtime>36*3600:
    alerts.append("backup-older-than-36-hours")
# Optional operational checks extend the existing heartbeat without disrupting host checks.
try:
    from operational_alerts import inspect
    operations = inspect(root, alerts)
except Exception as error:
    print("OPERATIONAL_MONITOR_FAILED", type(error).__name__)
    operations = {"ok": False, "error": type(error).__name__}

# CPU delta covers the existing five-minute interval; no extra process or timer.
cpu_ticks=[int(value) for value in pathlib.Path("/proc/stat").read_text().splitlines()[0].split()[1:9]]
cpu_total=sum(cpu_ticks);cpu_idle=cpu_ticks[3]+cpu_ticks[4]
try:
    previous=json.loads((root/"ops/health.json").read_text())
except Exception:
    previous={}
previous_cpu=previous.get("cpu_ticks",{})
delta=cpu_total-previous_cpu.get("total",cpu_total)
cpu_percent=round(100*(1-(cpu_idle-previous_cpu.get("idle",cpu_idle))/delta),1) if delta>0 else None
result={"cpu_ticks":{"total":cpu_total,"idle":cpu_idle},"cpu_used_percent":cpu_percent,"checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"ok":not alerts,
        "alerts":alerts,"disk_used_percent":round(disk.used/(disk.used+disk.free)*100,1),
        "memory_used_percent":round(memory_used*100,1),"containers":states,"operations":operations}
p=root/"ops/health.json"; temp=p.with_suffix(".tmp");temp.write_text(json.dumps(result));temp.replace(p)
print(json.dumps({k:result[k] for k in ["checked_at","ok","alerts","disk_used_percent","memory_used_percent"]}))

try:
    payload=json.dumps(result).replace("'","''")
    statement="INSERT INTO imenu_ops.health(id,reported_at,data) VALUES(true,now(),'"+payload+"'::jsonb) ON CONFLICT(id) DO UPDATE SET reported_at=excluded.reported_at,data=excluded.data;"
    statement += "INSERT INTO public.dev_health_history(reported_at,cpu_percent,memory_percent,disk_percent) VALUES('"+result["checked_at"]+"',"+(str(cpu_percent) if cpu_percent is not None else "NULL")+","+str(result["memory_used_percent"])+","+str(result["disk_used_percent"])+") ON CONFLICT DO NOTHING;"
    # Indexed retention runs once daily, on the existing heartbeat.
    if previous.get("checked_at", "")[:10] != result["checked_at"][:10]:
        statement += "DELETE FROM public.dev_health_history WHERE reported_at<now()-interval '30 days';DELETE FROM public.dev_alerts WHERE created_at<now()-interval '90 days';"
    subprocess.run(["docker","exec","-i","supabase-db","psql","-U","supabase_admin","-d","postgres","-Xq","-v","ON_ERROR_STOP=1"],input=statement,text=True,capture_output=True,check=True,timeout=20)
except Exception as error:
    print("MONITOR_HEARTBEAT_PUBLISH_FAILED",type(error).__name__)
