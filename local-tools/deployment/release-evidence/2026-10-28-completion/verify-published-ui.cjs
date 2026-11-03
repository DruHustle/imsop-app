const {chromium,expect}=require('/Users/andrewgotora/Software Development/GitHub/imsop-app/imsop-app-frontend/node_modules/@playwright/test');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const origin='https://imsop-app.vercel.app';
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
  for(const [profile,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   const context=await browser.newContext({viewport,acceptDownloads:true});
   const blockedWrites=[],errors=[];
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin)return route.abort();
    if(!['GET','HEAD','OPTIONS'].includes(req.method())){
     if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/supply-chain/api/'))blockedWrites.push({path:url.pathname,method:req.method()});
     return route.abort();
    }
    return route.continue();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const passed=[];
   await page.goto(origin+'/#/login');
   await expect(page.getByRole('heading',{name:'Welcome to IMSOP',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Forgot password?',exact:true}).click();
   await expect(page).toHaveURL(/#\/forgot-password/);passed.push('login and recovery navigation');
   await page.goto(origin+'/?token=synthetic.reset.token#/reset-password');
   await expect(page.getByLabel('New Password',{exact:true})).toBeVisible();passed.push('reset route');
   await page.goto(origin+'/#/register');await expect(page.getByText('Create an Account',{exact:true})).toBeVisible();passed.push('registration form');
   await page.goto(origin+'/#/login');
   await page.getByRole('button',{name:/^admin$/i}).click();
   await page.getByRole('button',{name:/^sign in$/i}).click();
   await expect(page.getByRole('heading',{name:'Operational overview',exact:true})).toBeVisible();passed.push('explicit demo login');
   const navigate=async(label)=>{
    if(profile==='mobile'){
     await page.getByRole('button',{name:'Open navigation menu',exact:true}).click();
     await page.getByRole('dialog').getByRole('link',{name:label,exact:true}).click();
     await expect(page.getByRole('dialog')).toBeHidden();
    }else await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:label,exact:true}).click();
   };
   await expect(page.getByRole('figure',{name:/Shipment activity by UTC day. 12 created/})).toBeVisible();
   passed.push('descriptive operational chart');
   if(profile==='mobile')await page.getByRole('button',{name:'Explore map',exact:true}).click();
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.getByRole('button',{name:'3D globe',exact:true}).click();
   const globe=page.locator('.shipment-globe');
   await expect(globe).toBeVisible();
   await expect(page.getByRole('button',{name:'Rotate view',exact:true})).toBeDisabled();
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.getByRole('button',{name:'Rotate view',exact:true}).click();
   await expect(page.getByRole('button',{name:'Pause view rotation',exact:true})).toHaveAttribute('aria-pressed','true');
   await page.getByRole('button',{name:'Pause view rotation',exact:true}).click();
   await globe.focus();await page.keyboard.press('ArrowRight');
   await page.getByRole('button',{name:'Zoom globe in',exact:true}).click();
   assert.equal(await globe.evaluate(element=>element.getContext('webgl').getError()),0);
   await page.locator('.overview-map-panel').screenshot({path:out+'/'+profile+'-live-globe.png',animations:'disabled'});
   passed.push('actual WebGL orbit, zoom, opt-in rotation and reduced motion');
   await navigate('Shipments');await expect(page.getByText('12 matching · 2 need attention',{exact:true})).toBeVisible();
   await page.getByLabel('Search shipments',{exact:true}).fill('SHP-9921');
   await page.getByRole('link',{name:'Open SHP-9921',exact:true}).filter({visible:true}).click();
   await expect(page.getByRole('heading',{name:'SHP-9921',exact:true})).toBeVisible();
   await page.getByRole('link',{name:'Tracking / events',exact:true}).click();
   await expect(page.getByText('Occurred: Oct 24, 2026, 6:00 AM UTC',{exact:true})).toBeVisible();passed.push('shipment filters, details and tracking');
   await navigate('Orders');await expect(page.getByRole('heading',{name:'Orders',exact:true})).toBeVisible();
   await page.getByLabel('Search orders',{exact:true}).fill('ORD-2026-1041');
   await expect(page.getByText('1 matching operational orders',{exact:true})).toBeVisible();passed.push('operational order search');
   await navigate('Analytics');await expect(page.getByRole('heading',{name:'Analytics',exact:true})).toBeVisible();
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('button',{name:'CSV · filtered',exact:true}).click();
   const download=await downloadPromise;const data=await fs.readFile(await download.path(),'utf8');assert(data.includes('DEMONSTRATION'));passed.push('analytics and demo export');
   await navigate('Recommendations');await expect(page.getByRole('heading',{name:'Recommendations',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Review case',exact:true}).first().click();
   await expect(page.getByLabel('Review note',{exact:true})).toBeVisible();passed.push('review evidence');
   await navigate('Assistant');await page.getByLabel('Your question').fill('Compare SHP-8829 and SHP-9921');
   await page.getByRole('button',{name:'Send',exact:true}).click();
   await expect(page.getByRole('log').getByRole('table').locator('tbody tr')).toHaveCount(2);passed.push('grounded demo Assistant');
   await page.getByRole('button',{name:/^Notifications/}).click();
   await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
   await page.keyboard.press('Escape');passed.push('notification center');
   await navigate('Service health');await expect(page.getByText('Checks observed',{exact:true})).toBeVisible();passed.push('service health UI');
   await navigate('Integrations');await page.getByText('View requirements',{exact:true}).first().click();
   await expect(page.getByText(/Live intake requires a signed event contract/)).toBeVisible();passed.push('integration requirements');
   for(const theme of ['Light','Dark','Auto']){
    const radio=page.getByRole('radiogroup',{name:'Theme',exact:true}).getByRole('radio',{name:theme+' theme',exact:true});
    await radio.click();await expect(radio).toBeChecked();
   }passed.push('Light, Dark and Auto themes');
   await page.screenshot({path:out+'/'+profile+'-live.png',fullPage:true});
   await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByText('Sign out',{exact:true}).click();
   await expect(page.getByRole('heading',{name:'Welcome to IMSOP',exact:true})).toBeVisible();passed.push('demo sign out');
   assert.deepEqual(blockedWrites,[],'Unexpected production API write attempt');assert.deepEqual(errors,[],'Browser page errors');
   results.push({profile,passed,apiWriteRequests:blockedWrites.length,browserErrors:errors});await context.close();
  }
 }finally{await browser.close();}
 const receipt={origin,frontendRevision:'85aa203f182ece15854430cac13656710f6692c5',mode:'explicit browser-local demonstration; production API writes blocked',checkedAt:new Date().toISOString(),results};
 await fs.writeFile(out+'/live-browser-smoke.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
})().catch(e=>{console.error(e);process.exit(1)});
