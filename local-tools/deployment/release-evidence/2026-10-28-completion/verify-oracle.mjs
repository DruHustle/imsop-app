import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const revision=process.argv[2],origin='https://imsop-api.152-70-22-84.sslip.io',checks=[];
assert.match(revision,/^[a-f0-9]{40}$/);
async function request(path,options={}){const r=await fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(10000),...options});return r;}
for(const path of ['/version','/ready','/health']){
 const r=await request(path);assert.equal(r.status,200);const body=await r.json();
 checks.push({path,status:r.status,body});
 if(path==='/version'){
  assert.equal(body.revision,revision);assert.equal(body.apiContract,2);
  assert.equal(body.nodeSchema,'005_provisioning_audit.sql');assert.equal(body.supplyChainSchema,'202610270002_PurchaseReceiving');
  for(const cap of ['optional-adapters-v1','purchase-pagination-v1','scoped-reviews-v1','customer-order-search-v1'])assert(body.capabilities.includes(cap));
 }
 if(path==='/ready'){assert.equal(body.status,'ready');assert.equal(body.dependencies.length,3);assert(body.dependencies.every(x=>x.healthy));}
}
for(const path of ['/api/auth/me','/api/auth/session','/api/operations/shipments?limit=1','/api/operations/orders?limit=1','/api/operations/reviews','/api/operations/notifications','/api/operations/forecasts','/api/operations/integrations','/api/operations/integrations/sap/metadata','/api/operations/reports/access','/api/operations/shipments/export/report','/api/operations/orders/export/report','/supply-chain/api/v1/orders?offset=0','/supply-chain/api/v1/orders/products','/supply-chain/api/v1/orders/suppliers','/supply-chain/api/v1/orders/warehouses','/supply-chain/api/v1/orders/transport']){
 const r=await request(path);await r.arrayBuffer();assert.equal(r.status,401,path);checks.push({path,status:r.status,cacheControl:r.headers.get('cache-control')});
}
for(const from of ['https://imsop-app.vercel.app','https://druhustle.github.io','https://untrusted.example.invalid'])for(const path of ['/api/operations/shipments','/supply-chain/api/v1/orders']){
 const r=await request(path,{method:'OPTIONS',headers:{Origin:from,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'content-type'}});await r.arrayBuffer();const allowed=r.headers.get('access-control-allow-origin');assert.equal(allowed,from==='https://imsop-app.vercel.app'?from:null);checks.push({path,method:'OPTIONS',origin:from,status:r.status,allowedOrigin:allowed});
}
const retired=await fetch('https://druhustle.github.io/imsop-app-frontend/',{cache:'no-store',signal:AbortSignal.timeout(10000)});await retired.arrayBuffer();assert.equal(retired.status,404);
const receipt={origin,checkedAt:new Date().toISOString(),retiredPagesStatus:retired.status,checks};
await writeFile(new URL('./oracle-live-verification.json', import.meta.url),JSON.stringify(receipt,null,2));console.log(JSON.stringify({backendRevision:revision,ready:true,anonymousChecks:17,originChecks:6,retiredPagesStatus:retired.status}));
