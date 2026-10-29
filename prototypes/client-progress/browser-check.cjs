// Optional local evidence harness. Uses externally supplied Playwright/Chromium.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];const requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  const origin='http://127.0.0.1:4320';
  const payload=async()=>JSON.parse(await page.locator('#client-data').textContent());
  await page.goto(origin);
  assert(await page.getByRole('combobox',{name:'Preview scenario'}).isVisible());
  assert(await page.getByRole('checkbox',{name:'Dark appearance'}).isVisible());
  for(const width of [320,375,768,1440])for(const dark of [false,true]){
    await page.setViewportSize({width,height:1000});await page.locator('#dark').setChecked(dark);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
    await page.screenshot({path:`docs/client-progress-evidence/${width}-${dark?'dark':'light'}.png`,fullPage:true});
  }
  await page.setViewportSize({width:375,height:900});await page.locator('#dark').uncheck();
  await page.reload();await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to project progress');
  await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main');
  const artifact=page.getByRole('button',{name:'View approved mock artifact'});
  await artifact.focus();await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'close-artifact');
  await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'close-artifact');
  await page.keyboard.press('Shift+Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'close-artifact');
  await page.screenshot({path:'docs/client-progress-evidence/375-artifact.png',fullPage:true});
  await page.keyboard.press('Escape');assert(await artifact.evaluate(e=>e===document.activeElement));
  await artifact.click();await page.getByRole('button',{name:'Close preview'}).click();
  assert.match(await page.getByRole('status').textContent(),/No review decision/);
  const scenarios=['active','in-review','qa','changes-requested','awaiting-client','blocked-delayed','paused','no-activity','unpublished','mismatched','disconnected','stale','accepted','loading','error','access-denied'];
  const screenshots=new Set(['awaiting-client','blocked-delayed','paused','no-activity','stale','accepted','error','access-denied']);
  for(const scenario of scenarios){
    await page.locator('#scenario').selectOption(scenario);await page.waitForURL(`**/?scenario=${scenario}`);
    const data=await payload();const html=await page.content();
    assert.doesNotMatch(html,/INTERNAL_ONLY|repository|\bcommit\b|pullRequest|raw CI|private branch|evidence\.project/);
    assert.equal(await page.locator('a[href*="github"]').count(),0);
    assert.equal(await page.locator('h1').count(),1);
    for(const width of [320,375,768,1440]) { await page.setViewportSize({width,height:900}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${scenario} overflow at ${width}`); }
    await page.setViewportSize({width:375,height:900});
    if(['loading','error','access-denied'].includes(scenario)){
      assert.deepEqual(data,{kind:scenario});assert.equal(await page.locator('.milestones').count(),0);
    }else{
      assert.equal(data.kind,'project');
      if(['unpublished','mismatched','no-activity'].includes(scenario))assert.equal(data.project.updates.length,0);
      if(scenario==='blocked-delayed'){assert.match(html,/22 Jan 2030/);assert.match(html,/revised date awaits human approval/);}
      if(scenario==='stale')assert.match(html,/last staff-published record/);
    }
    if(screenshots.has(scenario))await page.screenshot({path:`docs/client-progress-evidence/375-${scenario}.png`,fullPage:true});
    const response=await page.request.get(`${origin}/?scenario=${scenario}`);
    assert.doesNotMatch(await response.text(),/INTERNAL_ONLY/);
  }
  await page.goto(`${origin}/?scenario=error`);await page.getByRole('link',{name:'Retry project preview'}).click();assert.equal((await payload()).kind,'project');
  for(const path of ['/model.ts','/fixtures.ts','/preview.mjs','/toString'])assert.equal((await page.request.get(origin+path)).status(),404);
  assert.equal((await page.request.get(origin+'/',{headers:{Host:'public.example.test'}})).status(),403);
  assert.doesNotMatch(await (await page.request.get(origin+'/client.js')).text(),/INTERNAL_ONLY/);
  assert.deepEqual(errors,[]);assert(requests.every(url=>url.startsWith(origin+'/')));
  console.log('PASS: 16 scenarios; 17 screenshots; all widths/themes, keyboard/labels/status, client payload separation, source denial, error retry. No JS errors or external browser requests.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
