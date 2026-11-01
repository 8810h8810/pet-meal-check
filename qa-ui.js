/* QA ONLY: visible controls and read-only offline/cache diagnostics. No fetch. */
(() => {
  'use strict';
  const config=window.PET_MEAL_QA;
  const root=new URL('./',document.currentScript.src);
  let observedCspViolations=0;
  document.addEventListener('securitypolicyviolation',()=>{observedCspViolations++;});
  const panel=document.createElement('section');panel.className='qa-diagnostics';panel.setAttribute('data-no-translate','');
  const title=document.createElement('h2');title.textContent='QA 更新・オフライン診断';
  const note=document.createElement('p');note.textContent='ダミー専用。新バージョンの確認は同一サイトのSWだけを取得します。キャッシュ診断は保存済みデータを読むだけです。';
  const status=document.createElement('p');status.setAttribute('role','status');
  const controls=document.createElement('div'),output=document.createElement('pre');output.id='qa-diagnostics-output';
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;controls.appendChild(b);return b;}
  const refresh=button('診断を更新',()=>void inspect());
  const update=button('新しいQA版を確認',async()=>{try{const r=await registration();if(!r)throw Error('SW未登録');await r.update();status.textContent='同一サイトのQA更新を確認しました。';}catch(e){status.textContent='更新確認不可：'+String(e);}await inspect();});
  const activate=button('待機中のQA版へ更新',async()=>{const r=await registration();if(!r?.waiting){status.textContent='待機中のQA版はありません。';return;}r.waiting.postMessage({type:'QA_ACTIVATE_UPDATE'});status.textContent='QA更新を適用中。切替後に「再読み込み」を押してください。';});
  button('再読み込み',()=>location.reload());
  panel.append(title,note,controls,status,output);document.body.appendChild(panel);
  async function registration(){return 'serviceWorker'in navigator?await navigator.serviceWorker.getRegistration(root.href):null;}
  async function workerInfo(worker){
    if(!worker)return null;
    return await new Promise(resolve=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>resolve({state:worker.state,reply:'timeout'}),2000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
      worker.postMessage({type:'QA_STATUS'},[channel.port2]);
    });
  }
  async function inspect(){
    refresh.disabled=true;
    try{
      const r=await registration();
      const names='caches'in window?(await caches.keys()).filter(name=>name.startsWith('pet-meal-pwa-qa-')):[];
      const entries=[];
      for(const name of names){const cache=await caches.open(name),keys=await cache.keys();entries.push({name,count:keys.length});}
      const expectedCache=`pet-meal-pwa-qa-${config.release}`;
      const missing=[];
      if(names.includes(expectedCache)){const cache=await caches.open(expectedCache);for(const p of config.assets)if(!await cache.match(new URL(p,root).href))missing.push(p);}
      else missing.push('(current release cache not installed)');
      const resourceEntries=performance.getEntriesByType('resource');
      const observedExternal=resourceEntries.filter(entry=>{try{return new URL(entry.name).origin!==location.origin;}catch(_){return false;}}).length;
      const report={qa:true,pageRelease:config.release,isProductionHostname:location.hostname==='8810h8810.github.io',productionGuard:'QA PWA registration and worker installation refuse the production hostname',online:navigator.onLine,
        controller:navigator.serviceWorker?.controller?.scriptURL||null,active:await workerInfo(r?.active),waiting:await workerInfo(r?.waiting),
        installing:r?.installing?.state||null,cacheNames:names,cacheEntries:entries,expectedAssetCount:config.assets.length,
        offlineAssetsComplete:missing.length===0,missingAssets:missing,registrationError:window.petMealQARegistrationError||null,
        resourceTimingObservation:{sameOriginEntries:resourceEntries.length-observedExternal,externalEntries:observedExternal,scope:'Browser ResourceTiming entries only, not a complete network capture or proof of zero traffic'},
        cspViolationObservation:{count:observedCspViolations,scope:'Events observed after this QA script started; not a complete capture'}};
      output.textContent=JSON.stringify(report,null,2);activate.disabled=!r?.waiting;update.disabled=!r;
    }catch(error){output.textContent='QA診断失敗：'+String(error);}finally{refresh.disabled=false;}
  }
  window.addEventListener('qa-status-change',()=>void inspect());
  navigator.serviceWorker?.addEventListener('controllerchange',()=>void inspect());
  window.addEventListener('online',()=>void inspect());window.addEventListener('offline',()=>void inspect());
  void inspect();
})();
