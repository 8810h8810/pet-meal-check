'use strict';

/* Local-only real-browser QA. Every browser HTTP request is either fulfilled
 * from this checkout, fulfilled with an inert tag stub, or aborted. No route
 * calls continue()/fallback(), and external DNS is disabled at launch.
 * This file must never be pointed at a live browser profile.
 *
 * Run: node tests/usage-browser.test.cjs
 * Router-only checks: node tests/usage-browser.test.cjs --check-routing
 * Optional screenshots: QA_SCREENSHOTS=../pet-usage-preview-20261101 node ...
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const base = 'https://8810h8810.github.io/pet-meal-check/';
const preview = 'https://preview.invalid/pet-meal-check/';
const now = Date.parse('2026-11-01T12:00:00+09:00');
const consentKey = 'pet-meal-analytics-consent-v2';
const oldConsentKey = 'pet-meal-analytics-consent-v1';
const internalKey = 'pet-meal-analytics-internal-v1';
const markerKey = pet => `pet-meal-usage-history-v1:${pet}`;
const consent = choice => JSON.stringify({choice, time: now});
const history = lastSavedDay => JSON.stringify({lastSavedDay});
const logs = [];
let passed = 0;

function localFile(requestUrl) {
  let url;
  try { url = new URL(requestUrl); } catch (_) { return null; }
  if (![new URL(base).origin, new URL(preview).origin].includes(url.origin)) return null;
  if (!url.pathname.startsWith('/pet-meal-check/')) return null;
  let relative;
  try { relative = decodeURIComponent(url.pathname.slice('/pet-meal-check/'.length)); } catch (_) { return null; }
  if (relative.split('/').some(part=>part.startsWith('.')) || /^(tests|functions|rakuten-worker)(\/|$)/.test(relative)) return null;
  const result = path.resolve(root, relative || 'index.html');
  if (result !== root && !result.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(result)) return null;
  const file = fs.statSync(result).isDirectory() ? path.join(result, 'index.html') : result;
  const publicAsset = /\.(html|js|css|json|webmanifest|jpeg|jpg|png|svg)$/i.test(file);
  return publicAsset && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}
function mime(file) {
  return ({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json',
    '.jpeg':'image/jpeg','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
function routingChecks() {
  for (const route of ['', 'cat/', 'en/dog/', 'en/cat/', 'privacy/', 'en/privacy/', 'analytics-consent.js']) {
    assert.ok(localFile(base + route), route);
    assert.ok(localFile(preview + route), route);
  }
  for (const url of ['https://www.google-analytics.com/g/collect', 'https://www.googletagmanager.com/gtag/js?id=secret',
    'https://pet-meal-check-default-rtdb.asia-southeast1.firebasedatabase.app/rooms/x.json',
    'https://hb.afl.rakuten.co.jp/secret', base + '%2e%2e%2foutside', base + '.git/config', base + 'tests/usage-browser.test.cjs',
    base + 'does-not-exist']) assert.equal(localFile(url), null, url);
  console.log('PASS local router resolves known assets and refuses external/escaping URLs; no browser was launched.');
}

async function createHarness(browser, {url=base, locale='ja-JP', initial={}, failWriteKey, offline=false}={}) {
  const context = await browser.newContext({viewport:{width:390,height:844}, locale, timezoneId:'Asia/Tokyo',
    serviceWorkers:'block', reducedMotion:'reduce', permissions:[]});
  const ledger = [];
  await context.route('**/*', async route => {
    const request = route.request(), address = request.url();
    const file = request.method() === 'GET' ? localFile(address) : null;
    if (file) {
      ledger.push({kind:'local', method:request.method(), url:address, file:path.relative(root,file)});
      await route.fulfill({status:200, contentType:mime(file), body:fs.readFileSync(file), headers:{'Cache-Control':'no-store'}});
      return;
    }
    if (request.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-WY8E2J84VL$/.test(address)) {
      ledger.push({kind:'inert-tag-stub', method:'GET', url:address});
      await route.fulfill({status:200, contentType:'application/javascript', body:'/* QA inert tag: never contacts Google. */'});
      return;
    }
    ledger.push({kind:'aborted', method:request.method(), url:address});
    await route.abort('blockedbyclient');
  });
  // The marker below belongs only to this disposable test profile. It avoids
  // restoring fixtures after the application intentionally reloads on revoke.
  await context.addInitScript(({initial,failWriteKey,offline}) => {
    if (!localStorage.getItem('__qa_fixture_seeded__')) {
      for (const [key,value] of Object.entries(initial)) localStorage.setItem(key,value);
      localStorage.setItem('__qa_fixture_seeded__','1');
    }
    if (failWriteKey) {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key,value) {
        if (this === localStorage && key === failWriteKey) throw new DOMException('QA simulated storage failure','QuotaExceededError');
        return original.call(this,key,value);
      };
    }
    if (offline) Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
  }, {initial,failWriteKey,offline});
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(now));
  const errors=[], dialogs=[];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('dialog', async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  await page.goto(url,{waitUntil:'load'});
  await page.locator('.analytics-settings').waitFor();
  await page.locator('#sheet .tap').first().waitFor();
  const h = {context,page,ledger,errors,dialogs,
    events:()=>page.evaluate(()=>(window.dataLayer||[]).filter(v=>v[0]==='event').map(v=>({name:v[1],params:v[2]}))),
    commands:()=>page.evaluate(()=>(window.dataLayer||[]).map(v=>Array.from(v))),
    tagCount:()=>ledger.filter(v=>v.kind==='inert-tag-stub').length,
    tap:index=>page.locator('#sheet .tap').nth(index).click(),
    allow:()=>page.locator('.analytics-actions button').nth(0).click(),
    decline:()=>page.locator('.analytics-actions button').nth(1).click(),
    get:key=>page.evaluate(key=>localStorage.getItem(key),key),
    screenshot:async name=>{
      if (!process.env.QA_SCREENSHOTS) return;
      const folder=path.resolve(root,process.env.QA_SCREENSHOTS);fs.mkdirSync(folder,{recursive:true});
      await page.locator('.analytics-settings').scrollIntoViewIfNeeded();
      await page.locator('.analytics-settings').screenshot({path:path.join(folder,name+'.png')});
    },
    close:async()=>{logs.push({url,ledger,errors,dialogs});await context.close();}
  };
  return h;
}
async function test(name,fn) { await fn(); passed++; console.log('PASS '+name); }
function assertPayload(events,pet,names) {
  assert.deepEqual(events.map(e=>e.name),names);
  for (const e of events) assert.deepEqual(e.params,{app_kind:pet});
}
async function withHarness(browser,options,fn) {
  const h=await createHarness(browser,options);
  try { await fn(h);assert.deepEqual(h.errors,[],'unexpected page exception'); }
  finally {await h.close();}
}

async function run() {
  routingChecks();
  if (process.argv.includes('--check-routing')) return;
  // DNS prohibition is defense-in-depth. request interception still owns every
  // application request. Isolated temporary Chromium profile; no CUA/user profile.
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,
    args:['--no-sandbox','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'],
    env:{...process.env,HOME:'/tmp'}});
  try {
    await test('first visit records locally without analytics or history marker',()=>withHarness(browser,{},async h=>{
      assert.equal(h.tagCount(),0);await h.tap(0);assert.deepEqual(await h.events(),[]);
      assert.equal(JSON.parse(await h.get('pet-meal-check-dog-v1'))['0-0'],true);
      assert.equal(await h.get(markerKey('dog')),null);await h.screenshot('consent-ja-unset');
    }));
    await test('v1 grant is not expanded; explicit v2 reconsent sends one qualified record per document',()=>withHarness(browser,
      {initial:{[oldConsentKey]:consent('granted')}},async h=>{
        assert.equal(h.tagCount(),0);await h.tap(0);assert.deepEqual(await h.events(),[]);
        await Promise.all([h.page.waitForResponse(r=>r.url().startsWith('https://www.googletagmanager.com/gtag/js?')),h.allow()]);
        assert.equal(h.tagCount(),1);assert.equal(JSON.parse(await h.get(consentKey)).choice,'granted');
        assert.deepEqual(await h.events(),[],'no backfill when consent is granted');
        await h.tap(0);assert.deepEqual(await h.events(),[],'unchecking is not recording');
        await h.tap(0);assertPayload(await h.events(),'dog',['record_saved']);
        await h.tap(1);await h.page.locator('#reset').click();assertPayload(await h.events(),'dog',['record_saved']);
        await h.screenshot('consent-ja-granted');
      }));
    for (const route of ['cat/','en/dog/','en/cat/']) await test(route+' uses the same minimal event contract',()=>withHarness(browser,
      {url:base+route,locale:route.startsWith('en/')?'en-US':'ja-JP',initial:{[consentKey]:consent('granted')}},async h=>{
        await h.tap(0);assertPayload(await h.events(),route.includes('cat')?'cat':'dog',['record_saved']);
        if(route==='en/dog/')await h.screenshot('consent-en-granted');
      }));
    await test('denied, expired, operator-excluded and preview visits never get tag/event/marker',async()=>{
      const cases=[{initial:{[consentKey]:consent('denied')}},
        {initial:{[consentKey]:JSON.stringify({choice:'granted',time:now-181*86400000})}},
        {initial:{[consentKey]:consent('granted'),[internalKey]:'1'}},
        {url:base+'?wm_internal=1',initial:{[consentKey]:consent('granted')}},
        {url:preview,initial:{[consentKey]:consent('granted')}}];
      for(const options of cases)await withHarness(browser,options,async h=>{
        await h.tap(0);assert.equal(h.tagCount(),0);assert.deepEqual(await h.events(),[]);assert.equal(await h.get(markerKey('dog')),null);
      });
    });
    await test('record storage failure does not emit success or change the visual check',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')},failWriteKey:'pet-meal-check-dog-v1'},async h=>{
        await h.tap(0);assert.deepEqual(await h.events(),[]);assert.equal(await h.get('pet-meal-check-dog-v1'),null);
        assert.equal(await h.page.locator('#sheet .tap').first().getAttribute('aria-pressed'),'false');assert.ok(h.dialogs.length);
      }));
    await test('analytics marker failure does not break successful record saving',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')},failWriteKey:markerKey('dog')},async h=>{
        await h.tap(0);assert.deepEqual(await h.events(),[]);assert.equal(JSON.parse(await h.get('pet-meal-check-dog-v1'))['0-0'],true);
        assert.equal(h.dialogs.length,0);
      }));
    await test('prior-day browser history adds later-day return event without a date payload',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted'),[markerKey('dog')]:history('2026-10-31')}},async h=>{
        await h.tap(0);assertPayload(await h.events(),'dog',['record_saved','record_return_saved']);
        assert.equal(JSON.parse(await h.get(markerKey('dog'))).lastSavedDay,'2026-11-01');
      }));
    await test('same-day history and a midnight-crossing open tab are not later-day returns',async()=>{
      await withHarness(browser,{initial:{[consentKey]:consent('granted'),[markerKey('dog')]:history('2026-11-01')}},async h=>{
        await h.page.clock.setFixedTime(new Date('2026-11-02T12:00:00+09:00'));await h.tap(0);
        assertPayload(await h.events(),'dog',['record_saved']);
      });
    });
    await test('revoke removes analytics history but preserves the actual record',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')}},async h=>{
        await h.tap(0);await Promise.all([h.page.waitForEvent('load'),h.decline()]);
        await h.page.locator('.analytics-settings').waitFor();assert.equal(JSON.parse(await h.get(consentKey)).choice,'denied');
        assert.equal(await h.get(markerKey('dog')),null);assert.equal(JSON.parse(await h.get('pet-meal-check-dog-v1'))['0-0'],true);
        assert.deepEqual(await h.events(),[]);assert.equal(h.tagCount(),1,'reloaded denied page did not load another tag');
      }));
    await test('another tab revoking consent unloads measurement and removes only analytics history',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')}},async h=>{
        await h.tap(0);
        const sibling=await h.context.newPage();await sibling.clock.setFixedTime(new Date(now));
        await sibling.goto(base+'cat/',{waitUntil:'load'});
        await Promise.all([h.page.waitForEvent('load'),sibling.evaluate(({key,time})=>localStorage.setItem(key,JSON.stringify({choice:'denied',time})),{key:consentKey,time:now})]);
        await h.page.locator('.analytics-settings').waitFor();assert.deepEqual(await h.events(),[]);
        assert.equal(await h.get(markerKey('dog')),null);assert.equal(JSON.parse(await h.get('pet-meal-check-dog-v1'))['0-0'],true);
      }));
    await test('opening the untracked privacy page does not erase valid browser revisit history',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')}},async h=>{
        await h.tap(0);const before=await h.get(markerKey('dog'));
        const policy=await h.context.newPage();await policy.clock.setFixedTime(new Date(now));
        await policy.goto(base+'privacy/',{waitUntil:'load'});await policy.locator('.analytics-settings').waitFor();
        assert.equal(await h.get(markerKey('dog')),before);assert.equal(h.tagCount(),1);
      }));
    await test('offline shared queue remains intact and its identifiers never enter events',()=>{
      const room='a'.repeat(64),token='b'.repeat(64),cells=Object.fromEntries(Array.from({length:14},(_,i)=>[`${i>>1}-${i%2}`,{value:false,rev:0,op:'initial'}]));
      return withHarness(browser,{offline:true,initial:{[consentKey]:consent('granted'),'pet-meal-sharing-dog-v1':JSON.stringify({room,token,cells,queue:[]})}},async h=>{
        await h.tap(0);const saved=JSON.parse(await h.get('pet-meal-sharing-dog-v1'));
        assert.equal(saved.room,room);assert.equal(saved.token,token);assert.equal(saved.queue.length,1);
        assertPayload(await h.events(),'dog',['record_saved']);const serialized=JSON.stringify(await h.commands());
        assert.ok(!serialized.includes(room));assert.ok(!serialized.includes(token));
        assert.equal(h.ledger.filter(v=>/firebase|identitytoolkit|securetoken/.test(v.url)).length,0);
      });
    });
    await test('unapproved UTM values are scrubbed and never become campaign fields',()=>withHarness(browser,
      {url:base+'?utm_source=PRIVATE_SECRET&utm_medium=email&utm_campaign=PRIVATE_SECRET',initial:{[consentKey]:consent('granted')}},async h=>{
        await h.tap(0);const serialized=JSON.stringify(await h.commands());assert.ok(!serialized.includes('PRIVATE_SECRET'));
        for(const row of await h.commands()) if(row[0]==='config') {
          assert.equal(row[2].page_location,base);assert.ok(!Object.keys(row[2]).some(k=>k.startsWith('campaign_')));
        }
      }));
    await test('unknown query or fragment stops measurement rather than sending private data',async()=>{
      for(const suffix of ['?token=PRIVATE_SECRET','#private']) await withHarness(browser,
        {url:base+suffix,initial:{[consentKey]:consent('granted')}},async h=>{
          await h.tap(0);assert.equal(h.tagCount(),0);assert.deepEqual(await h.commands(),[]);assert.deepEqual(await h.events(),[]);
        });
    });
    await test('a private URL inserted after startup cannot produce a record event',()=>withHarness(browser,
      {initial:{[consentKey]:consent('granted')}},async h=>{
        await h.page.evaluate(()=>history.pushState(null,'','?token=PRIVATE_SECRET#private'));
        await h.tap(0);assert.deepEqual(await h.events(),[]);
        assert.ok(!JSON.stringify(await h.commands()).includes('PRIVATE_SECRET'));
        assert.equal(JSON.parse(await h.get('pet-meal-check-dog-v1'))['0-0'],true,'measurement exclusion preserves recording');
      }));
    console.log(`${passed} real Chromium tests passed. External requests were intercepted; Google tag was inert; no live GA/Firebase traffic.`);
  } finally {
    await browser.close();
    if(process.env.QA_SCREENSHOTS){const folder=path.resolve(root,process.env.QA_SCREENSHOTS);fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'browser-network-ledger.json'),JSON.stringify(logs,null,2));}
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
