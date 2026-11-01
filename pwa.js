/* QA ONLY: same-origin service worker; production hosts are refused. */
(() => {
  const script=new URL(document.currentScript.src);
  if (location.hostname === '8810h8810.github.io') return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load',async()=>{
    try {
      const registration=await navigator.serviceWorker.register(new URL('sw.js',script),{scope:new URL('./',script).pathname,updateViaCache:'none'});
      window.dispatchEvent(new Event('qa-status-change'));
      registration.addEventListener('updatefound',()=>{
        window.dispatchEvent(new Event('qa-status-change'));
        registration.installing?.addEventListener('statechange',()=>window.dispatchEvent(new Event('qa-status-change')));
      });
    } catch(error) {window.petMealQARegistrationError=String(error);window.dispatchEvent(new Event('qa-status-change'));}
  });
})();
