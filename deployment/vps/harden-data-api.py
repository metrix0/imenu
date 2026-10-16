#!/usr/bin/env python3
"""Apply tenant isolation to the previously unprotected staging tables."""
import argparse,json,pathlib,subprocess,datetime
root=pathlib.Path("/opt/imenu-migration")
public={"categories","coupons","item_subcategories","items","menu","subitems","upsell"}
direct={"categories","coupons","integrations","items","menu","orders","payouts","print_jobs","tracking_integrations","upsell"}
tables=sorted(public|direct|{"order_items","order_item_subitems"})
def sql(q):
 r=subprocess.run(["docker","exec","-i","supabase-db","psql","-U","supabase_admin","-d","postgres","-XqAt","-v","ON_ERROR_STOP=1"],input=q,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr[:800])
 return r.stdout.strip()
def owns(table):
 if table in direct:
  return f"EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id={table}.restaurant_id AND r.user_id=(SELECT auth.uid()))"
 if table=="item_subcategories":
  return "EXISTS (SELECT 1 FROM public.items i JOIN public.restaurants r ON r.id=i.restaurant_id WHERE i.id=item_subcategories.item_id AND r.user_id=(SELECT auth.uid()))"
 if table=="subitems":
  return "EXISTS (SELECT 1 FROM public.item_subcategories c JOIN public.items i ON i.id=c.item_id JOIN public.restaurants r ON r.id=i.restaurant_id WHERE c.id=subitems.item_subcategory_id AND r.user_id=(SELECT auth.uid()))"
 if table=="order_items":
  return "EXISTS (SELECT 1 FROM public.orders o JOIN public.restaurants r ON r.id=o.restaurant_id WHERE o.id=order_items.order_id AND r.user_id=(SELECT auth.uid()))"
 return "EXISTS (SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id JOIN public.restaurants r ON r.id=o.restaurant_id WHERE i.id=order_item_subitems.order_item_id AND r.user_id=(SELECT auth.uid()))"
parser=argparse.ArgumentParser();parser.add_argument("--apply-staging",action="store_true");args=parser.parse_args()
if not args.apply_staging:raise SystemExit("Pass --apply-staging explicitly")
if (root/"ops/PRODUCTION_JOBS_ENABLED").exists():raise SystemExit("Production marker present; refusing")
env=dict(l.split("=",1) for l in (root/"secrets/app-stage.env").read_text().splitlines() if "=" in l and not l.startswith("#"))
if "api-vps-stage.imenuapp.com.br" not in env.get("NEXT_PUBLIC_SUPABASE_URL",""):raise SystemExit("Not staging")
snapshot=root/"ops/data-api-security-before.json"
if not snapshot.exists():
 before=sql("SELECT json_build_object('policies',(SELECT json_agg(p) FROM pg_policies p WHERE schemaname='public'),'tables',(SELECT json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'));")
 snapshot.write_text(before);snapshot.chmod(0o600)
statements=["BEGIN;","SET LOCAL lock_timeout='5s';"]
for table in tables:
 statements += [f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;",
 f'DROP POLICY IF EXISTS imenu_public_catalog_read ON public.{table};',
 f'DROP POLICY IF EXISTS imenu_owner_access ON public.{table};',
 f'DROP POLICY IF EXISTS imenu_owner_read ON public.{table};']
 if table in public:
  condition="active=true" if table=="coupons" else "true"
  statements.append(f"CREATE POLICY imenu_public_catalog_read ON public.{table} FOR SELECT TO anon,authenticated USING ({condition});")
 if table=="payouts":
  statements.append(f"CREATE POLICY imenu_owner_read ON public.{table} FOR SELECT TO authenticated USING ({owns(table)});")
 else:
  condition=owns(table)
  statements.append(f"CREATE POLICY imenu_owner_access ON public.{table} FOR ALL TO authenticated USING ({condition}) WITH CHECK ({condition});")
statements += [
"DROP POLICY IF EXISTS \"public insert item media\" ON public.item_media;",
"DROP POLICY IF EXISTS imenu_owner_media ON public.item_media;",
"CREATE POLICY imenu_owner_media ON public.item_media FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.items i JOIN public.restaurants r ON r.id=i.restaurant_id WHERE i.id=item_media.item_id AND r.user_id=(SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.items i JOIN public.restaurants r ON r.id=i.restaurant_id WHERE i.id=item_media.item_id AND r.user_id=(SELECT auth.uid())));",
"DROP POLICY IF EXISTS \"users can read files\" ON storage.objects;",
"DROP POLICY IF EXISTS imenu_owner_storage_listing ON storage.objects;",
"CREATE POLICY imenu_owner_storage_listing ON storage.objects FOR SELECT TO authenticated USING (owner_id=(SELECT auth.uid())::text OR (storage.foldername(name))[1]=(SELECT auth.uid())::text);",
"""DO $fix$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path=pg_catalog,public,extensions',f.signature);
 END LOOP;
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prorettype='trigger'::regtype AND p.prosecdef LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $fix$;""",
"NOTIFY pgrst,'reload schema';","COMMIT;"]
sql("\n".join(statements))
print("STAGING_RLS_ENABLED_TABLES",len(tables))
report={"checked_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"tables":tables,"public_catalog_tables":sorted(public),"payout_writes":"server only","production_modified":False}
(root/"ops/data-api-security-applied.json").write_text(json.dumps(report,indent=2))
