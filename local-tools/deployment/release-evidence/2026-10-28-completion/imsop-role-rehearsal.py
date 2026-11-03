import pathlib,subprocess,json,secrets,time,urllib.parse,hashlib,os
p=pathlib.Path('/opt/imsop-app-backend'); root=pathlib.Path(os.environ.get('IMSOP_REHEARSAL_ROOT',str(p/'hardening-20261028'))); root.mkdir(mode=0o700,exist_ok=True)
r=root/'isolated';r.mkdir(mode=0o700,exist_ok=True)
image=os.environ.get('IMSOP_CANDIDATE_IMAGE','ghcr.io/druhustle/imsop-backend@sha256:68a33836b22888a4ec214d5ac57cf1deedf958b16244cdae61b5b3c104f8ee48')
db='imsop-role-db-20261028';app='imsop-role-app-20261028';network='imsop-role-check-20261028'
def run(args,name,stdin=None):
 result=subprocess.run(args,input=stdin,capture_output=True,text=True);log=root/(name+'.log');log.write_text(result.stdout+result.stderr);log.chmod(0o600)
 if result.returncode:print(json.dumps({'failed':name,'exitCode':result.returncode,'protectedLog':str(log)}),flush=True);raise RuntimeError(name)
 return result.stdout
for n in ['compose.yaml','compose.runtime.json']:
 target=root/('before-'+n)
 if not target.exists():target.write_bytes((p/n).read_bytes());target.chmod(0o600)
run(['docker','run','--rm','--env-file',str(p/'recovery-20261028-def73e5/pg.env'),'-e','PGSSLROOTCERT=system','-v',str(root)+':/backup','postgres:18-alpine','pg_dump','-Fc','-f','/backup/database-before-hardening.dump'],'backup-before-hardening')
dump=root/'database-before-hardening.dump';dump.chmod(0o600)
password=secrets.token_hex(24)
(r/'database.env').write_text(f'POSTGRES_USER=imsop_restore\nPOSTGRES_PASSWORD={password}\nPOSTGRES_DB=imsop_restore\n');(r/'database.env').chmod(0o600)
adminUrl=f'postgresql://imsop_restore:{password}@{db}:5432/imsop_restore'
(r/'admin.env').write_text('ADMIN_DATABASE_URL='+adminUrl+'\n');(r/'admin.env').chmod(0o600)
run(['docker','network','create','--internal',network],'create-isolated-network')
try:
 run(['docker','run','-d','--name',db,'--network',network,'--memory=512m','--cpus=1','--tmpfs','/var/lib/postgresql:rw,size=256m','--env-file',str(r/'database.env'),'-v',str(root)+':/backup:ro','postgres:18-alpine'],'start-isolated-database')
 for i in range(40):
  if subprocess.run(['docker','exec',db,'pg_isready','-U','imsop_restore'],capture_output=True).returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('isolated database startup')
 run(['docker','exec',db,'pg_restore','--no-owner','--no-acl','--exit-on-error','-U','imsop_restore','-d','imsop_restore','/backup/database-before-hardening.dump'],'restore-isolated-database')
 job=['docker','run','--rm','--network',network,'--env-file',str(r/'admin.env'),'-v',str(r)+':/release','-v','/tmp/imsop-role-tools:/scripts:ro','--user','0','--entrypoint','node',image]
 roleReport=json.loads(run(job+['/scripts/imsop-role-admin.cjs'],'isolated-role-grants-and-denials'))
 connections=json.loads((r/'runtime-role-connections.json').read_text());creds=connections['credentials'];urls=connections['connections']
 settings={'NODE_ENV':'production','ASPNETCORE_ENVIRONMENT':'Production','DOTNET_ENVIRONMENT':'Production','DATABASE_URL':urls['imsop_node_runtime'],'ConnectionStrings__DefaultConnection':f'Host={db};Database=imsop_restore;Username=imsop_supply_runtime;Password={creds["imsop_supply_runtime"]}',
 'JWT_SECRET':secrets.token_hex(32),'RESET_DELIVERY_KEY':secrets.token_hex(32),'LOGISTICS_WEBHOOK_SECRETS':json.dumps({'isolated':'isolated-role-webhook-secret-at-least-32-characters'}),
 'EMAIL_PROVIDER':'gmail','GMAIL_APP_PASSWORD':'abcdefghijklmnop','GMAIL_FROM':'isolated@example.invalid','EMAIL_FROM':'isolated@example.invalid','PASSWORD_RESET_BASE_URL':'https://imsop-app.vercel.app/#/reset-password','ALLOWED_ORIGIN':'https://imsop-app.vercel.app','CORS_ALLOWED_ORIGINS':'https://imsop-app.vercel.app','RUN_NODE_MIGRATIONS':'false','Database__AutoMigrate':'false','ServiceBus__Enabled':'false','EMAIL_NOTIFICATIONS_ENABLED':'true'}
 env=r/'runtime.env';env.write_text('\n'.join(k+'='+v for k,v in settings.items())+'\n');env.chmod(0o600)
 run(['docker','run','-d','--name',app,'--network',network,'--env-file',str(env),'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=128m,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory=1536m',image],'start-restricted-runtime')
 for i in range(60):
  probe=subprocess.run(['docker','exec',app,'curl','-fsS','http://127.0.0.1:10000/ready'],capture_output=True,text=True)
  if probe.returncode==0 and json.loads(probe.stdout).get('status')=='ready':break
  time.sleep(1)
 else:raise RuntimeError('restricted runtime readiness')
 candidateVersion=json.loads(run(['docker','exec',app,'curl','-fsS','http://127.0.0.1:10000/version'],'restricted-candidate-version'))
 if os.environ.get('IMSOP_EXPECTED_REVISION'):
  assert candidateVersion['revision']==os.environ['IMSOP_EXPECTED_REVISION']
  assert 'optional-adapters-v1' in candidateVersion['capabilities']
 workflows=json.loads(run(job+['/scripts/imsop-role-workflows.cjs'],'isolated-restricted-runtime-workflows'))
 run(['docker','rm','-f',app],'stop-candidate-before-rollback-check')
 rollback=os.environ.get('IMSOP_ROLLBACK_IMAGE','ghcr.io/druhustle/imsop-backend@sha256:b9d452a3a354abd9e0c24a08dff8c333a99f517d243f48ead9e91c9cb76f60b4')
 run(['docker','run','-d','--name',app,'--network',network,'--env-file',str(env),'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=128m,mode=1777','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory=1536m',rollback],'start-restricted-rollback')
 for i in range(60):
  probe=subprocess.run(['docker','exec',app,'curl','-fsS','http://127.0.0.1:10000/ready'],capture_output=True,text=True)
  if probe.returncode==0 and json.loads(probe.stdout).get('status')=='ready':break
  time.sleep(1)
 else:raise RuntimeError('restricted rollback readiness')
 rollbackVersion=json.loads(run(['docker','exec',app,'curl','-fsS','http://127.0.0.1:10000/version'],'restricted-rollback-version'))
 assert rollbackVersion['revision']==os.environ.get('IMSOP_ROLLBACK_REVISION','22a956100fed2441a31ded1c18aff131b2b86475')
 for endpoint in ['/api/operations/shipments?limit=1','/supply-chain/api/v1/orders?offset=0']:
  code=run(['docker','exec',app,'curl','-sS','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:10000'+endpoint],'restricted-rollback-anonymous')
  assert code=='401'
 receipt={'candidate':{'image':image,'version':candidateVersion,'ready':True},'roleBoundaries':roleReport,'workflows':workflows,'rollback':{'version':rollbackVersion,'ready':True,'anonymousAccess':'rejected','restrictedRuntimeRoles':True},'backupSha256':hashlib.sha256(dump.read_bytes()).hexdigest(),'productionChanges':False}
 (root/'role-rehearsal-receipt.json').write_text(json.dumps(receipt,indent=2));(root/'role-rehearsal-receipt.json').chmod(0o600)
 print(json.dumps(receipt),flush=True)
finally:
 for container in [app,db]:subprocess.run(['docker','rm','-f',container],capture_output=True)
 subprocess.run(['docker','network','rm',network],capture_output=True)
