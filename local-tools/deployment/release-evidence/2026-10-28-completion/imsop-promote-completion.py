import pathlib,json,subprocess,os,fcntl,sys,time,hashlib,urllib.parse
image=sys.argv[1];revision=sys.argv[2]
assert image.startswith('ghcr.io/druhustle/imsop-backend@sha256:') and len(image.rsplit(':',1)[1])==64
assert len(revision)==40
p=pathlib.Path('/opt/imsop-app-backend');r=p/('release-'+revision[:7]+'-20261028')
lock=open(p/'.deployment.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def run(args,name):
 result=subprocess.run(args,capture_output=True,text=True);log=r/(name+'.log');log.write_text(result.stdout+result.stderr);log.chmod(0o600)
 if result.returncode:print(json.dumps({'failed':name,'protectedLog':str(log)}),flush=True);raise RuntimeError(name)
 return result.stdout
rehearsal=json.loads((r/'role-rehearsal-receipt.json').read_text())
assert rehearsal['candidate']['version']['revision']==revision and rehearsal['rollback']['ready']
assert (p/'compose.runtime.json').read_bytes()==(r/'before-compose.runtime.json').read_bytes(),'Runtime configuration changed since qualification snapshot'
assert (p/'compose.yaml').read_bytes()==(r/'before-compose.yaml').read_bytes(),'Installed image changed since qualification snapshot'
prior=(p/'compose.yaml').read_bytes();config=json.loads(prior)
for n in ['compose.yaml','compose.runtime.json']:
 saved=r/('installed-before-'+n);saved.write_bytes((p/n).read_bytes());saved.chmod(0o600)
info=json.loads(run(['docker','image','inspect',image],'candidate-image'))[0]
assert info['Architecture']=='arm64' and info['Config']['Labels']['org.opencontainers.image.revision']==revision
config['services']['app']['image']=image;config['services']['app']['platform']='linux/arm64'
new=r/'candidate.compose.yaml';new.write_text(json.dumps(config,indent=2)+'\n');new.chmod(0o600)
compose=['docker','compose','--project-directory',str(p),'-f',str(new),'-f',str(p/'compose.runtime.json')]
run(compose+['config','--quiet'],'candidate-compose-validation')
current=json.loads(subprocess.check_output(['docker','inspect','imsop-app-backend-app-1']))[0]
environment=dict(x.split('=',1) for x in current['Config']['Env'])
assert urllib.parse.urlsplit(environment['DATABASE_URL']).username=='imsop_node_runtime'
assert 'Username=imsop_supply_runtime' in environment['ConnectionStrings__DefaultConnection']
assert all(environment.get(k)=='false' for k in ['FORECAST_ENABLED','SAP_ENABLED','ServiceBus__Enabled','EMAIL_NOTIFICATIONS_ENABLED','RUN_NODE_MIGRATIONS','Database__AutoMigrate'])
validate=r/'current-validation.env';validate.write_text('\n'.join(k+'='+v for k,v in environment.items() if k!='APP_REVISION')+'\n');validate.chmod(0o600)
run(['docker','run','--rm','--env-file',str(validate),'--entrypoint','node','-w','/app/node-api',image,'-e',"require('./dist/config/security').assertProductionConfiguration();console.log('production configuration valid')"],'candidate-production-configuration')
others=json.loads(subprocess.check_output(['docker','ps','--no-trunc','--format','json'],text=True).strip().replace('\n',',').join(['[',']']))
others={x['Names']:x['ID'] for x in others if x['Names']!='imsop-app-backend-app-1'}
tmp=p/'compose.yaml.release-tmp';tmp.write_bytes(new.read_bytes());tmp.chmod(0o600);os.replace(tmp,p/'compose.yaml')
installed=['docker','compose','--project-directory',str(p),'-f',str(p/'compose.yaml'),'-f',str(p/'compose.runtime.json')]
try:
 run(installed+['up','-d','--no-deps','--wait','--wait-timeout','120','app'],'promote-runtime')
 version=json.loads(run(['curl','-fsS','http://127.0.0.1:11001/version'],'installed-version'))
 ready=json.loads(run(['curl','-fsS','http://127.0.0.1:11001/ready'],'installed-ready'))
 assert version['revision']==revision and 'optional-adapters-v1' in version['capabilities'] and ready['status']=='ready'
 for endpoint in ['/api/operations/shipments?limit=1','/supply-chain/api/v1/orders?offset=0','/api/operations/integrations/sap/metadata','/supply-chain/api/v1/orders/transport']:
  assert run(['curl','-sS','-o','/dev/null','-w','%{http_code}','http://127.0.0.1:11001'+endpoint],'installed-anonymous')=='401'
except Exception:
 tmp=p/'compose.yaml.rollback-tmp';tmp.write_bytes(prior);tmp.chmod(0o600);os.replace(tmp,p/'compose.yaml')
 run(installed+['up','-d','--no-deps','--wait','--wait-timeout','120','app'],'restore-compatible-runtime')
 raise
after=json.loads(subprocess.check_output(['docker','ps','--no-trunc','--format','json'],text=True).strip().replace('\n',',').join(['[',']']))
after={x['Names']:x['ID'] for x in after if x['Names']!='imsop-app-backend-app-1'}
assert others==after,'Sibling container identities changed during release'
receipt={'backendRevision':revision,'arm64Image':image,'revisionLabel':info['Config']['Labels']['org.opencontainers.image.revision'],'architecture':info['Architecture'],'version':version,'ready':ready,'restrictedRuntimeRoles':True,'optionalIntegrations':'disabled','productionAssignments':0,'siblingContainersUnchanged':True,'runtimeConfigurationSha256':hashlib.sha256((p/'compose.runtime.json').read_bytes()).hexdigest(),'rollbackCompose':str(r/'installed-before-compose.yaml'),'installedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
(r/'deployment-receipt.json').write_text(json.dumps(receipt,indent=2));(r/'deployment-receipt.json').chmod(0o600)
print(json.dumps(receipt),flush=True)
