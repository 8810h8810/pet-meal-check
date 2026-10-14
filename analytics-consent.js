/* Optional analytics: no Google tag or consent ping before explicit permission. */
(() => {
  'use strict';
  const id = 'G-WY8E2J84VL';
  const key = 'pet-meal-analytics-consent-v1';
  const ttl = 180 * 24 * 60 * 60 * 1000;
  const root = new URL('./', document.currentScript.src);
  const copy = {
    ja: ['アクセス解析', '利用状況の改善にGoogle Analyticsを使ってもよいですか？ Cookieと接続・利用情報がGoogleに送られます。拒否しても記録・家族共有は使えます。選択はこのブラウザに180日間保存し、ここで変更できます。', '許可する', '許可しない', '未選択：解析は停止中', '解析を許可しています', '解析は停止中', 'プライバシーポリシー', '設定を保存できませんでした。解析は停止しています。'],
    en: ['Analytics', 'May we use Google Analytics to improve the app? Cookies and connection or usage information are sent to Google. Recording and family sharing work if you decline. Your choice is saved in this browser for 180 days and can be changed here.', 'Allow', 'Decline', 'No choice yet: analytics is off', 'Analytics is allowed', 'Analytics is off', 'Privacy Policy', 'Your choice could not be saved. Analytics is off.'],
    es: ['Analítica', '¿Podemos usar Google Analytics para mejorar la app? Se envían a Google cookies e información de conexión o uso. El registro y el uso compartido funcionan si rechazas. Tu elección se guarda en este navegador durante 180 días y puedes cambiarla aquí.', 'Permitir', 'Rechazar', 'Sin elección: analítica desactivada', 'Analítica permitida', 'Analítica desactivada', 'Política de privacidad', 'No se pudo guardar tu elección. La analítica está desactivada.'],
    nl: ['Statistieken', 'Mogen we Google Analytics gebruiken om de app te verbeteren? Cookies en verbindings- of gebruiksinformatie worden naar Google gestuurd. Registreren en delen met het gezin werken ook als je weigert. Je keuze wordt 180 dagen in deze browser bewaard en kan hier worden gewijzigd.', 'Toestaan', 'Weigeren', 'Nog geen keuze: statistieken staan uit', 'Statistieken zijn toegestaan', 'Statistieken staan uit', 'Privacybeleid', 'Je keuze kon niet worden opgeslagen. Statistieken staan uit.']
  };
  let loaded = false, failed = false;
  window['ga-disable-' + id] = true;
  function read() {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      if (v && ['granted', 'denied'].includes(v.choice) && Number.isFinite(v.time) && v.time <= Date.now() && Date.now() - v.time < ttl) return v.choice;
    } catch (_) {}
    return 'unset';
  }
  let choice = read();
  function language() {
    let value = window.petMealI18n?.language;
    if (!value) {
      try { value = localStorage.getItem('pet-meal-language-v1'); } catch (_) {}
      if (!value || value === 'auto') value = navigator.languages?.[0] || navigator.language;
    }
    return copy[String(value).split(/[-_]/)[0]] || copy.en;
  }
  function cleanURL(value) {
    try { const u = new URL(value); return u.origin + u.pathname; } catch (_) { return ''; }
  }
  function start() {
    if (choice !== 'granted' || !document.body.dataset.pet) return;
    window['ga-disable-' + id] = false;
    if (loaded) return;
    loaded = true;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    const denied = {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'};
    window.gtag('consent', 'default', denied);
    window.gtag('consent', 'update', {...denied, analytics_storage:'granted'});
    window.gtag('js', new Date());
    window.gtag('config', id, {
      page_location:cleanURL(location.href), page_referrer:cleanURL(document.referrer),
      page_title:'Pet meal check', allow_google_signals:false, allow_ad_personalization_signals:false,
      cookie_path:root.pathname, cookie_expires:180 * 24 * 60 * 60
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
  }
  function clearAnalyticsCookies() {
    const names = document.cookie.split(';').map(v => v.split('=')[0].trim()).filter(v => v === '_ga' || v === '_ga_WY8E2J84VL');
    const parts = location.hostname.split('.');
    const domains = ['', ...parts.map((_, i) => parts.slice(i).join('.'))];
    const paths = new Set(['/', root.pathname]);
    const segments = location.pathname.split('/');
    for (let i = 1; i < segments.length; i++) { const p = segments.slice(0, i).join('/') || '/'; paths.add(p); paths.add(p.endsWith('/') ? p : p + '/'); }
    for (const name of names) for (const path of paths) for (const domain of domains) {
      document.cookie = name + '=; Max-Age=0; path=' + path + (domain ? '; domain=' + domain : '');
    }
  }
  const panel = document.createElement('section');
  panel.className = 'analytics-settings'; panel.setAttribute('data-no-translate', '');
  const title = document.createElement('h2'), message = document.createElement('p'), status = document.createElement('p');
  status.setAttribute('role', 'status');
  const actions = document.createElement('div'); actions.className = 'analytics-actions';
  const allow = document.createElement('button'), decline = document.createElement('button'), policy = document.createElement('a');
  allow.type = decline.type = 'button'; policy.href = new URL('privacy/', root).href;
  actions.append(allow, decline); panel.append(title, message, actions, status, policy); document.body.appendChild(panel);
  function render() {
    const words = language(); title.textContent=words[0]; message.textContent=words[1];
    allow.textContent=words[2]; decline.textContent=words[3]; policy.textContent=words[7];
    status.textContent=words[failed ? 8 : choice === 'granted' ? 5 : choice === 'denied' ? 6 : 4];
    allow.setAttribute('aria-pressed', String(choice === 'granted'));
    decline.setAttribute('aria-pressed', String(choice === 'denied'));
  }
  function set(value) {
    failed = false;
    try { localStorage.setItem(key, JSON.stringify({choice:value, time:Date.now()})); choice=value; }
    catch (_) { failed=true; choice='denied'; }
    if (choice !== 'granted') {
      window['ga-disable-' + id] = true;
      clearAnalyticsCookies();
      render();
      // Unload already-loaded third-party listeners; saved records are unaffected.
      if (loaded && !failed) location.reload();
    } else { start(); render(); }
  }
  allow.addEventListener('click', () => set('granted'));
  decline.addEventListener('click', () => set('denied'));
  window.addEventListener('pet-meal-languagechange', render);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice=read();
    if (choice !== 'granted') { window['ga-disable-' + id]=true; clearAnalyticsCookies(); if (loaded) location.reload(); }
    else start();
    render();
  });
  render();
  if (choice === 'granted') start(); else clearAnalyticsCookies();
})();
