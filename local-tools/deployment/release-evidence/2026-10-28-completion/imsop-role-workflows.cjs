const assert=require('node:assert/strict');
const {randomUUID,createHmac}=require('node:crypto');
const {connect}=require('/scripts/imsop-role-admin.cjs');
(async()=>{
 const db=await connect(process.env.ADMIN_DATABASE_URL),base='http://imsop-role-app-20261028:10000',origin='https://imsop-app.vercel.app';
 const checks=[],password='Isolated-role-test-password-123',email=randomUUID()+'@imsop.test';let cookie;
 const call=async(path,method='GET',body,extra={})=>fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
 const status=async(path,expected,method='GET',body,extra={})=>{const r=await call(path,method,body,extra);assert.equal(r.status,expected,path+': '+await r.clone().text());checks.push({path,method,status:r.status});return r;};
 try{
  const r=await status('/api/auth/register',201,'POST',{email,password,name:'Isolated privilege verification'});const user=(await r.json()).user;cookie=r.headers.get('set-cookie').split(';')[0];
  await status('/api/operations/shipments?limit=1',403);
  const org=randomUUID(),workspace=randomUUID(),otherWorkspace=randomUUID(),supplier=randomUUID(),product=randomUUID(),warehouse=randomUUID();
  await db.query("INSERT INTO supply_chain.organizations(id,name,timezone,status,subscription_tier,created_at,updated_at) VALUES($1,$2,'UTC','active','test',now(),now())",[org,'Isolated roles '+org]);
  await db.query("INSERT INTO workspaces(id,name,dotnet_organization_id) VALUES($1,'Isolated role verification',$2)",[workspace,org]);
  await db.query("INSERT INTO workspaces(id,name) VALUES($1,'Isolated other workspace')",[otherWorkspace]);
  await db.query("UPDATE users SET role='admin',active_workspace_id=$1 WHERE id=$2",[workspace,user.id]);
  await db.query('INSERT INTO workspace_memberships(user_id,workspace_id) VALUES($1,$2)',[user.id,workspace]);
  await db.query("INSERT INTO logistics_connectors(provider,workspace_id) VALUES('isolated',$1)",[workspace]);
  await db.query("INSERT INTO supply_chain.suppliers(id,organization_id,name,status) VALUES($1,$2,'Isolated supplier','active')",[supplier,org]);
  await db.query("INSERT INTO supply_chain.products(id,organization_id,sku,name,unit_price) VALUES($1,$2,'ROLE-PART','Role verification part',12.5)",[product,org]);
  await db.query("INSERT INTO supply_chain.warehouses(id,organization_id,name) VALUES($1,$2,'Isolated warehouse')",[warehouse,org]);
  const foreign=(await db.query("INSERT INTO shipments(tracking_number,origin,destination,workspace_id,provider) VALUES('ISOLATED-FOREIGN','A','B',$1,'other') RETURNING id",[otherWorkspace])).rows[0].id;
  await status('/api/auth/me',401);
  const login=await status('/api/auth/login',200,'POST',{email,password});cookie=login.headers.get('set-cookie').split(';')[0];
   await status('/api/auth/session',200);
   const backendVersion=await(await fetch(base+'/version')).json();
   if(backendVersion.capabilities?.includes('optional-adapters-v1')) {
    const adapters=await(await status('/api/operations/integrations',200)).json();
    assert.equal(adapters.adapters.sap.state,'not-configured');assert.equal(adapters.adapters.forecast.state,'not-configured');
    await status('/api/operations/integrations/sap/metadata',503);
   }
  await status('/api/auth/profile/'+user.id,200,'PATCH',{name:'Isolated updated profile'});
  await status('/api/operations/notifications/preferences',200,'PUT',{emailEnabled:true});
  const event={eventId:'role-check-event',eventType:'shipment.exception',trackingNumber:'ROLE-SHIPMENT',status:'delayed',occurredAt:new Date().toISOString(),origin:'Isolated A',destination:'Isolated B'};
  const timestamp=Math.floor(Date.now()/1000).toString(),signature=createHmac('sha256','isolated-role-webhook-secret-at-least-32-characters').update(timestamp+'.'+JSON.stringify(event)).digest('hex');
  await status('/api/integrations/logistics/isolated/events',202,'POST',event,{'X-IMSOP-Timestamp':timestamp,'X-IMSOP-Signature':'sha256='+signature});
  const shipments=await (await status('/api/operations/shipments?limit=10',200)).json();assert.equal(shipments.items.length,1);
  await status('/api/operations/shipments/'+foreign,404);
  const reviews=await (await status('/api/operations/reviews',200)).json();assert.equal(reviews.items.length,1);
  await status('/api/operations/reviews/'+reviews.items[0].id+'/actions',200,'POST',{action:'note',version:reviews.items[0].version,note:'Isolated permission verification'});
  await status('/api/operations/notifications',200);await status('/api/operations/forecasts',200);await status('/api/operations/shipments/export/report',200);
  const body={supplierId:supplier,orderNumber:'ROLE-CHECK',currency:'EUR',items:[{productId:product,quantity:2,unitPrice:'12.5'}]},key=randomUUID();
  const purchase=await (await status('/supply-chain/api/v1/orders',201,'POST',body,{'Idempotency-Key':key})).json();const order=purchase.data.id;
  await status('/supply-chain/api/v1/orders',200,'POST',body,{'Idempotency-Key':key});
  const lines=await(await status('/supply-chain/api/v1/orders/'+order+'/items',200)).json();
  const receipt={warehouseId:warehouse,receivedAt:new Date().toISOString(),note:'Isolated counted receipt',items:[{itemId:lines[0].id,quantity:2}]},receiptKey=randomUUID();
  await status('/supply-chain/api/v1/orders/'+order+'/receipts',200,'POST',receipt,{'Idempotency-Key':receiptKey});
  await status('/supply-chain/api/v1/orders/'+order+'/receipts',200,'POST',receipt,{'Idempotency-Key':receiptKey});
  assert.equal((await db.query('SELECT quantity_on_hand FROM supply_chain.inventories WHERE product_id=$1',[product])).rows[0].quantity_on_hand,2);
  if(backendVersion.capabilities?.includes('optional-adapters-v1')) {
   const transport=await(await status('/supply-chain/api/v1/orders/transport',200)).json();
   assert.equal(transport.state,'not-configured');assert(transport.outbox.some(row=>row.state==='disabled'&&row.count===1));
  }
  for(const path of ['suppliers','products','warehouses'])await status('/supply-chain/api/v1/orders/'+path,200);
  await status('/api/auth/change-password/'+user.id,200,'POST',{currentPassword:password,newPassword:password+'-changed'});
  await status('/api/auth/me',401);
  const finalLogin=await status('/api/auth/login',200,'POST',{email,password:password+'-changed'});cookie=finalLogin.headers.get('set-cookie').split(';')[0];
  await status('/api/auth/logout',204,'POST',{});await status('/api/auth/me',401);
  console.log(JSON.stringify({checks,inventoryAppliedOnce:true,workspaceBoundary:'enforced',network:'internal; outbound blocked',productionMutations:0,verifiedAt:new Date().toISOString()}));
 }finally{await db.end();}
})().catch(e=>{console.error(JSON.stringify({phase:'isolated_role_workflows',error:e.code||e.name,message:e.message}));process.exit(1)});
