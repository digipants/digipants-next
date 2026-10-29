const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage(); const failures=[]; page.on('pageerror',e=>failures.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:4317');
 for(const width of [320,375,768,1440]) for(const dark of [false,true]){
  await page.setViewportSize({width,height:1000});await page.locator('#dark').setChecked(dark);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  await page.screenshot({path:`docs/client-workspace-evidence/${width}-${dark?'dark':'light'}.png`,fullPage:true});
 }
 await page.setViewportSize({width:375,height:900});await page.locator('#dark').uncheck();
 await page.getByRole('button',{name:'Request changes',exact:true}).click();
 assert.equal(await page.locator(':focus').getAttribute('id'),'cancel');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'confirm');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'reason');
 await page.getByRole('button',{name:'Confirm simulation'}).click();
 assert.equal(await page.locator(':focus').getAttribute('id'),'reason');
 assert.equal(await page.locator('#reason').getAttribute('aria-invalid'),'true');
 await page.screenshot({path:'docs/client-workspace-evidence/375-validation.png',fullPage:true});
 await page.keyboard.press('Escape');assert(await page.getByRole('button',{name:'Request changes',exact:true}).evaluate(e=>e===document.activeElement));
 await page.getByRole('button',{name:'Request changes',exact:true}).click();await page.locator('#reason').fill('<script>example</script> Revise scope');await page.locator('#confirm').click();
 await page.waitForTimeout(750);assert.match(await page.locator('#feedback').textContent(),/Awaiting revised/);assert.match(await page.locator('#history').textContent(),/<script>example/);
 await page.locator('#reset').click();await page.getByRole('button',{name:'Decline proposal',exact:true}).click();await page.locator('#confirm').click();await page.waitForTimeout(750);assert.match(await page.locator('#feedback').textContent(),/Proposal declined/);
 await page.locator('#reset').click();await page.locator('#fail').check();await page.getByRole('button',{name:'Accept proposal',exact:true}).click();await page.locator('#confirm').click();await page.waitForTimeout(750);assert.match(await page.locator('#errors').textContent(),/No decision/);
 await page.screenshot({path:'docs/client-workspace-evidence/375-error.png',fullPage:true});
 await page.getByRole('button',{name:'Accept proposal',exact:true}).click();
 await page.locator('#confirm').evaluate(e=>{e.click();e.click()});
 assert(await page.getByRole('button',{name:'Accept proposal',exact:true}).isDisabled());
 await page.waitForTimeout(750);assert.match(await page.locator('#feedback').textContent(),/Awaiting kickoff checks/);assert.equal(await page.locator('#history li').count(),2);
 await page.screenshot({path:'docs/client-workspace-evidence/375-accepted.png',fullPage:true});
 await page.locator('#reset').click();await page.locator('#stale').check();await page.getByRole('button',{name:'Accept proposal',exact:true}).click();await page.locator('#confirm').click();await page.waitForTimeout(750);assert.match(await page.locator('#errors').textContent(),/Superseded/);assert.equal(await page.locator('#history li').count(),1);
 for(const kind of ['expired','superseded']){await page.locator('#scenario').selectOption(kind);for(const label of ['Accept proposal','Request changes','Decline proposal'])assert(await page.getByRole('button',{name:label,exact:true}).isDisabled());await page.screenshot({path:`docs/client-workspace-evidence/375-${kind}.png`,fullPage:true});}
 for(const kind of ['loading','empty','invalid','access-denied']){await page.locator('#scenario').selectOption(kind);assert.equal(await page.locator('[data-decision]').count(),0);assert(await page.locator('h1').isVisible());await page.screenshot({path:`docs/client-workspace-evidence/375-${kind}.png`,fullPage:true});}
 assert.deepEqual(failures,[]);assert(requests.every(u=>u.startsWith('http://127.0.0.1:4317/')));
 console.log('PASS: 8 responsive/theme screenshots, 9 decision/error/illustration screenshots; all browser scenarios, focus trapping/escape, validation, retry, double-click, stale version, no external requests or JS errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
