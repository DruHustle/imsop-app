import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac,randomUUID} from 'node:crypto';
import {connection} from './config/db';
import app from './app';
import {imsopEdgeEvent,verifyEdgeHmac} from './routes/edgeRoutes';

const gateway='truck-gateway-1';
const workspace='11111111-1111-4111-8111-111111111111';
const secret='test-truck-gateway-hmac-secret-32-plus-characters';
const gps={
  schemaVersion:1,eventId:randomUUID(),sourceId:'truck-42',
  kind:'truck_gps' as const,observedAt:'2026-11-03T11:00:00Z',
  data:{vehicleId:'truck-42',latitude:-17.8252,longitude:31.0335,
    speedKph:34.2,accuracyM:15}
};
function signed(body:string,timestamp=String(Math.floor(Date.now()/1000))){
 return {
  'Content-Type':'application/json',
  'X-Edge-Timestamp':timestamp,
  'X-Edge-Signature':'sha256='+createHmac('sha256',secret)
    .update(timestamp).update('.').update(body).digest('hex')
 };
}
test('GPS validation and signed replay protection',()=>{
 const payload=Buffer.from(JSON.stringify(gps));
 const now=Date.now(),ts=String(Math.floor(now/1000));
 assert.equal(verifyEdgeHmac(payload,ts,signed(payload.toString(),ts)['X-Edge-Signature'],secret,now),true);
 assert.equal(verifyEdgeHmac(Buffer.from('tamper'),ts,signed(payload.toString(),ts)['X-Edge-Signature'],secret,now),false);
 assert.equal(verifyEdgeHmac(payload,String(Math.floor(now/1000)-310),signed(payload.toString(),ts)['X-Edge-Signature'],secret,now),false);
 assert.equal(imsopEdgeEvent.safeParse({...gps,data:{...gps.data,latitude:91}}).success,false);
 assert.equal(imsopEdgeEvent.safeParse({...gps,data:{...gps.data,command:'stop'}}).success,false);
 assert.equal(imsopEdgeEvent.safeParse({
   ...gps,eventId:randomUUID(),kind:'warehouse_sensor',
   data:{warehouseId:'WH-01',assetId:'cold-room',metric:'temperature',value:4.5,unit:'degC'}
 }).success,true);
});
test('edge ingest rejects missing signature, uncommissioned source, changed retries',async t=>{
 const old=process.env.IMSOP_EDGE_GATEWAYS;
 process.env.IMSOP_EDGE_GATEWAYS=JSON.stringify({[gateway]:{
   workspaceId:workspace,secret,sources:['truck-42','warehouse-1']
 }});
 const seen=new Map<string,string>();
 const stub=t.mock.method(connection,'query',async (sql:any,params:any[])=>{
   if(String(sql).startsWith('INSERT INTO edge_observations')){
     const existing=seen.has(params[2]);
     if(!existing)seen.set(params[2],params[7]);
     return {rowCount:existing?0:1,rows:existing?[]:[{event_id:params[2]}]};
   }
   if(String(sql).startsWith('SELECT payload_hash FROM edge_observations')){
     return {rowCount:1,rows:[{payload_hash:seen.get(params[2])}]};
   }
   throw new Error('Unexpected query');
 } as any);
 const server=app.listen(0);
 try{
  const address=server.address();assert(address&&typeof address==='object');
  const url='http://127.0.0.1:'+address.port+'/api/edge/'+gateway+'/events';
  const post=(data:string,headers=signed(data))=>fetch(url,{method:'POST',headers,body:data});
  const body=JSON.stringify(gps);
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,401);
  assert.equal((await post(body)).status,202);
  const duplicate=await post(body);assert.equal(duplicate.status,202);
  assert.equal((await duplicate.json()).duplicate,true);
  assert.equal((await post(JSON.stringify({...gps,data:{...gps.data,longitude:30.1}}))).status,409);
  assert.equal((await post(JSON.stringify({...gps,eventId:randomUUID(),sourceId:'unknown-truck'}))).status,403);
  assert.equal((await fetch(url.replace('/'+gateway+'/','/unknown/'),{method:'POST',headers:signed(body),body})).status,401);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  stub.mock.restore();
  if(old===undefined)delete process.env.IMSOP_EDGE_GATEWAYS;
  else process.env.IMSOP_EDGE_GATEWAYS=old;
 }
});
