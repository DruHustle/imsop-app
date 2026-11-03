const {Client}=require('/app/node-api/node_modules/pg');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const roles=['imsop_node_runtime','imsop_supply_runtime'];
const nodeWritable=['auth_sessions','shipments','orders','telemetry','logistics_events','reset_deliveries','review_cases','review_actions','notification_reads','notification_preferences','notification_deliveries','forecast_observations','forecast_runs'];
const supplyWritable=['inventories','purchase_orders','purchase_order_items','order_outbox','purchase_receipts','purchase_receipt_items'];
const quote=v=>'"'+v.replaceAll('"','""')+'"';
async function connect(url){const c=new Client({connectionString:url,connectionTimeoutMillis:10000});await c.connect();return c;}
async function prepare(admin,credentials){
 const db=(await admin.query('SELECT current_database() AS name')).rows[0].name;
 await admin.query('BEGIN');
 try{
  for(const role of roles){
   assert.match(credentials[role],/^[a-f0-9]{64}$/);
   assert.equal((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0,'Runtime role already exists; do not rotate implicitly');
   await admin.query(`CREATE ROLE ${quote(role)} LOGIN PASSWORD '${credentials[role]}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
   await admin.query(`GRANT CONNECT ON DATABASE ${quote(db)} TO ${quote(role)}`);
   await admin.query(`ALTER ROLE ${quote(role)} SET search_path TO public`);
  }
  await admin.query('GRANT USAGE ON SCHEMA public TO imsop_node_runtime,imsop_supply_runtime');
  await admin.query('GRANT SELECT ON public.schema_migrations,public.workspaces,public.workspace_memberships,public.logistics_connectors,public.users TO imsop_node_runtime');
  await admin.query('GRANT INSERT ON public.users TO imsop_node_runtime');
  await admin.query('GRANT UPDATE(name,password,password_reset_version,session_version) ON public.users TO imsop_node_runtime');
  // PostgreSQL row-sharing locks require UPDATE on at least one column. Workspace/provider rebinding stays denied.
  await admin.query('GRANT UPDATE(enabled) ON public.logistics_connectors TO imsop_node_runtime');
  await admin.query('GRANT SELECT,INSERT,UPDATE ON '+nodeWritable.map(t=>'public.'+quote(t)).join(',')+' TO imsop_node_runtime');
  await admin.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO imsop_node_runtime');
  await admin.query('GRANT USAGE ON SCHEMA supply_chain TO imsop_supply_runtime');
  await admin.query('GRANT SELECT ON ALL TABLES IN SCHEMA supply_chain TO imsop_supply_runtime');
  await admin.query('GRANT INSERT,UPDATE ON '+supplyWritable.map(t=>'supply_chain.'+quote(t)).join(',')+' TO imsop_supply_runtime');
  await admin.query('GRANT SELECT ON public."__EFMigrationsHistory" TO imsop_supply_runtime');
  await admin.query('COMMIT');
 }catch(e){await admin.query('ROLLBACK');throw e;}
}
async function denied(c,sql){await c.query('BEGIN');let denied=false;try{await c.query(sql);}catch(e){assert.equal(e.code,'42501');denied=true;}finally{await c.query('ROLLBACK');}assert(denied,'Unexpected privilege: '+sql);}
async function verify(url,role){
 const c=await connect(url);try{
  const attrs=(await c.query('SELECT current_user AS role,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.equal(attrs.role,role);for(const [k,v]of Object.entries(attrs))if(k!=='role')assert.equal(v,false,k);
  const schema=(await c.query("SELECT has_schema_privilege(current_user,'public','CREATE') AS public_create,has_schema_privilege(current_user,'supply_chain','CREATE') AS supply_create")).rows[0];assert.equal(schema.public_create,false);assert.equal(schema.supply_create,false);
  await denied(c,'CREATE TABLE public.imsop_runtime_ddl_probe(id integer)');
  await denied(c,'UPDATE public.schema_migrations SET checksum=checksum WHERE false');
  await denied(c,'INSERT INTO public.workspaces(id,name) VALUES(gen_random_uuid(),\'forbidden\')');
  await denied(c,'SELECT * FROM public.provisioning_runs LIMIT 0');
  if(role==='imsop_node_runtime'){
   await c.query('SELECT count(*) FROM public.users');await c.query('SELECT count(*) FROM public.schema_migrations');
   await denied(c,'SELECT * FROM supply_chain.purchase_orders LIMIT 0');
   await denied(c,'UPDATE public.users SET role=role WHERE false');
   await denied(c,'UPDATE public.users SET active_workspace_id=active_workspace_id WHERE false');
   await denied(c,'UPDATE public.logistics_connectors SET workspace_id=workspace_id WHERE false');
   await denied(c,'DELETE FROM public.users WHERE false');
  }else{
   await c.query('SELECT count(*) FROM supply_chain.purchase_orders');await c.query('SELECT * FROM public."__EFMigrationsHistory"');
   await denied(c,'SELECT * FROM public.users LIMIT 0');
   await denied(c,'UPDATE supply_chain.organizations SET name=name WHERE false');
   await denied(c,'DELETE FROM supply_chain.purchase_orders WHERE false');
  }
  return {role,attributes:attrs,persistentDdl:'denied',provisioning:'denied',migrationWrites:'denied',crossSchemaData:'denied',delete:'denied'};
 }finally{await c.end();}
}
function urls(adminUrl,credentials){return Object.fromEntries(roles.map(role=>{const u=new URL(adminUrl);u.username=role;u.password=credentials[role];return [role,u.toString()];}));}
module.exports={roles,prepare,verify,connect,urls,quote};
if(require.main===module)(async()=>{
 const adminUrl=process.env.ADMIN_DATABASE_URL;assert(adminUrl);
 const credentials=Object.fromEntries(roles.map(r=>[r,crypto.randomBytes(32).toString('hex')]));
 const admin=await connect(adminUrl);try{await prepare(admin,credentials);}finally{await admin.end();}
 const connections=urls(adminUrl,credentials);
 const report=[];for(const role of roles)report.push(await verify(connections[role],role));
 fs.writeFileSync('/release/runtime-role-connections.json',JSON.stringify({credentials,connections}),{mode:0o600});
 console.log(JSON.stringify({roles:report,verifiedAt:new Date().toISOString()}));
})().catch(e=>{console.error(JSON.stringify({phase:'role_prepare',error:e.code||e.name}));process.exit(1)});
