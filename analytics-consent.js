/* Optional analytics: no Google tag or consent ping before explicit permission. */
(() => {
  'use strict';
  const id = 'G-WY8E2J84VL';
  const key = 'pet-meal-analytics-consent-v2';
  const legacyKey = 'pet-meal-analytics-consent-v1';
  const internalKey = 'pet-meal-analytics-internal-v1';
  const usageKeys = ['pet-meal-usage-history-v1:dog', 'pet-meal-usage-history-v1:cat'];
  const page = new URL(location.href);
  const productionPaths = new Set([
    '/pet-meal-check/', '/pet-meal-check/index.html',
    '/pet-meal-check/cat/', '/pet-meal-check/cat/index.html',
    '/pet-meal-check/en/dog/', '/pet-meal-check/en/dog/index.html',
    '/pet-meal-check/en/cat/', '/pet-meal-check/en/cat/index.html'
  ]);
  const production = page.origin === 'https://8810h8810.github.io' && productionPaths.has(page.pathname);
  const appKind = page.pathname.includes('/cat/') ? 'cat' : 'dog';
  const appPage = production && document.body.dataset.pet === appKind;
  // Register PUBLIC, non-personal {app, source, medium, campaign} tuples only
  // after approval. Empty intentionally: this draft enables no campaign labels.
  const approvedCampaigns = Object.freeze([]);
  // Separate from consent: opting back in to measurement never grants consent.
  let internal = true;
  function readInternal() {
    try { return localStorage.getItem(internalKey) === '1'; }
    catch (_) { return true; } // Storage uncertainty must not enable analytics.
  }
  try {
    const option = page.searchParams.get('wm_internal');
    if (option === '1') localStorage.setItem(internalKey, '1');
    else if (option === '0') localStorage.removeItem(internalKey);
    internal = readInternal();
  } catch (_) { internal = true; }
  const ttl = 180 * 24 * 60 * 60 * 1000;
  const root = new URL('./', document.currentScript.src);
  const copy = {
    ja: ['アクセス解析', '利用改善のため、チェックの端末保存が成功したこと、別の日に戻って保存したこと、犬版・猫版と公開キャンペーンの分類（登録後のみ）をGoogle Analyticsで集計してもよいですか？ チェック内容・曜日や朝夜・ペット名・招待リンク・共有IDは送りません。再訪判定用の保存日だけをこのブラウザで最大180日使い、期限切れは次回の確認時に削除します。GAはCookieの仮名IDや接続情報を扱うため、完全匿名ではありません。拒否しても記録・家族共有は使えます。選択は180日保存し、ここで変更できます。停止すると解析用Cookieと再訪判定用の保存日を削除します。', '許可する', '許可しない', '未選択：解析は停止中', '解析を許可しています', '解析は停止中', 'プライバシーポリシー', '設定を保存できませんでした。この画面の解析は停止中です。次回も停止を保てない場合があるため、再読込前にブラウザの保存設定を確認してください。', '説明が更新されたため、以前の許可は引き継いでいません。'],
    en: ['Analytics', 'May Google Analytics measure successful saves, saving again on a later-day visit, dog/cat app use and public campaign categories (only after registration) to improve the app? We do not send check contents, weekdays or morning/night, pet names, invitation links or sharing IDs. Only a save date is kept in this browser for later-day detection, used for up to 180 days and deleted when next checked after expiry. GA uses pseudonymous cookie IDs and connection information; it is not fully anonymous. Recording and family sharing work if you decline. Your choice lasts 180 days and can be changed here. Turning analytics off deletes analytics cookies and the revisit date.', 'Allow', 'Decline', 'No choice yet: analytics is off', 'Analytics is allowed', 'Analytics is off', 'Privacy Policy', 'Your choice could not be saved. Analytics is off on this page, but this may not persist after reopening. Check browser storage settings before reopening.', 'The explanation has changed; your previous permission has not been carried over.'],
    es: ['Analítica', '¿Permites que Google Analytics mida los guardados correctos, volver a guardar en una visita de otro día, el uso de la app de perro o gato y categorías de campañas públicas (solo tras registrarlas) para mejorar la app? No enviamos el contenido de las marcas, días de la semana o mañana/noche, nombres de mascotas, enlaces de invitación ni identificadores de uso compartido. Solo guardamos una fecha en este navegador para detectar visitas de otro día; se usa hasta 180 días y se elimina en la siguiente comprobación tras caducar. GA usa identificadores seudónimos de cookies e información de conexión; no es totalmente anónimo. El registro y el uso compartido funcionan si rechazas. Tu elección dura 180 días y puedes cambiarla aquí. Al desactivar la analítica se eliminan sus cookies y la fecha de revisita.', 'Permitir', 'Rechazar', 'Sin elección: analítica desactivada', 'Analítica permitida', 'Analítica desactivada', 'Política de privacidad', 'No se pudo guardar tu elección. La analítica está desactivada en esta página, pero puede no mantenerse al volver a abrirla. Revisa la configuración de almacenamiento antes de reabrirla.', 'La explicación ha cambiado; no hemos transferido tu permiso anterior.'],
    nl: ['Statistieken', 'Mag Google Analytics geslaagde opslag, opnieuw opslaan tijdens een bezoek op een latere dag, gebruik van de honden- of kattenapp en openbare campagnecategorieën (pas na registratie) meten om de app te verbeteren? We versturen geen inhoud van vinkjes, weekdagen of ochtend/avond, dierennamen, uitnodigingslinks of deel-ID’s. Alleen een opslagdatum wordt in deze browser maximaal 180 dagen gebruikt om latere bezoeken te herkennen; verlopen datums worden bij de volgende controle verwijderd. GA gebruikt pseudonieme cookie-ID’s en verbindingsinformatie; het is niet volledig anoniem. Registreren en delen werken ook als je weigert. Je keuze geldt 180 dagen en is hier aanpasbaar. Uitschakelen verwijdert analysecookies en de datum voor terugkeerherkenning.', 'Toestaan', 'Weigeren', 'Nog geen keuze: statistieken staan uit', 'Statistieken zijn toegestaan', 'Statistieken staan uit', 'Privacybeleid', 'Je keuze kon niet worden opgeslagen. Statistieken staan op deze pagina uit, maar dit blijft mogelijk niet zo na heropenen. Controleer eerst de opslaginstellingen van je browser.', 'De uitleg is gewijzigd; je eerdere toestemming is niet overgenomen.']
  };
  let loaded = false, failed = false;
  window['ga-disable-' + id] = true;
  function readEntry(storageKey) {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey));
      if (v && ['granted', 'denied'].includes(v.choice) && Number.isFinite(v.time) && v.time <= Date.now() && Date.now() - v.time < ttl) return v;
    } catch (_) {}
    return null;
  }
  // Preserve a still-valid old refusal, but NEVER import an old permission.
  function read() { return readEntry(key)?.choice || (readEntry(legacyKey)?.choice === 'denied' ? 'denied' : 'unset'); }
  let legacyPermission = readEntry(legacyKey)?.choice === 'granted';
  function retireLegacyGrant() {
    let raw, old;
    try { raw = localStorage.getItem(legacyKey); }
    catch (_) { failed = true; return; }
    try { old = JSON.parse(raw); } catch (_) { return; }
    if (old?.choice !== 'granted') return;
    legacyPermission = true;
    try { localStorage.removeItem(legacyKey); }
    catch (_) { failed = true; }
  }
  // Old cached tabs only watch the v1 key. Removing its grant stops them too;
  // a new v2 grant must never reactivate a still-cached v1 implementation.
  retireLegacyGrant();
  let choice = read();
  const excludedCopy = {
    ja: 'このブラウザまたはURLは計測対象外です。解析は停止中です。',
    en: 'This browser or URL is excluded from measurement. Analytics is off.',
    es: 'Este navegador o URL está excluido de la medición. La analítica está desactivada.',
    nl: 'Deze browser of URL is uitgesloten van metingen. Statistieken staan uit.'
  };
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
  function cleanReferrer() {
    try { const u = new URL(document.referrer); return u.origin + '/'; } catch (_) { return ''; }
  }
  const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  function ordinal(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const value = Date.parse(day + 'T00:00:00Z');
    return Number.isFinite(value) && new Date(value).toISOString().slice(0,10) === day ? value / 86400000 : null;
  }
  const openedDay = ordinal(localDay());
  let priorDay = null, emitted = false, blockedURL = false, usageStorageOK = true, expiryTimer;
  function clearUsage() {
    priorDay = null;
    for (const storageKey of usageKeys) { try { localStorage.removeItem(storageKey); } catch (_) {} }
  }
  function canMeasure() {
    return !failed && !internal && appPage && !blockedURL && read() === 'granted' && !readInternal() && cleanURL(location.href) === page.origin + page.pathname;
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    const consent = readEntry(key);
    if (consent?.choice !== 'granted') return;
    expiryTimer = setTimeout(() => {
      choice = read(); internal = readInternal();
      if (!canMeasure()) {
        window['ga-disable-' + id] = true; clearUsage(); clearAnalyticsCookies(); render();
        if (loaded) location.reload();
      } else scheduleExpiry();
    }, Math.min(2147483647, Math.max(0, consent.time + ttl - Date.now()) + 1));
  }
  function campaignFields() {
    const keys = ['utm_source', 'utm_medium', 'utm_campaign'];
    if ([...page.searchParams.keys()].some(k => /^utm_/i.test(k) && !keys.includes(k)) || keys.some(k => page.searchParams.getAll(k).length !== 1)) return {};
    const tuple = approvedCampaigns.find(c => c.app === appKind && [c.source,c.medium,c.campaign].every((v,i) => typeof v === 'string' && page.searchParams.get(keys[i]) === v));
    return tuple ? {campaign_source:tuple.source, campaign_medium:tuple.medium, campaign_name:tuple.campaign} : {};
  }
  function sanitizeBrowserURL() {
    const current = new URL(location.href);
    // Do not break an unknown app parameter or anchor: fail closed instead.
    const known = new Set(['wm_internal','gclid','fbclid']);
    if (current.hash || [...current.searchParams.keys()].some(k => !known.has(k) && !/^utm_/i.test(k))) return false;
    if (current.search) {
      try { history.replaceState(history.state, '', current.origin + current.pathname); }
      catch (_) { return false; }
    }
    return location.href === current.origin + current.pathname;
  }
  window.petMealUsage = Object.freeze({recordStored() {
    // This no-argument hook must only follow a successful user false->true save.
    // It never reads feeding records, sharing state, Firebase IDs, or invite data.
    if (!loaded || emitted || !usageStorageOK) return;
    if (!canMeasure() || location.href !== page.origin + page.pathname) { window['ga-disable-' + id] = true; clearUsage(); clearAnalyticsCookies(); return; }
    const day = localDay(), now = ordinal(day);
    if (now === null || openedDay === null || now < openedDay) return;
    try { localStorage.setItem(usageKeys[appKind === 'cat' ? 1 : 0], JSON.stringify({lastSavedDay:day})); }
    catch (_) { return; }
    emitted = true;
    try {
      window.gtag('event', 'record_saved', {app_kind:appKind});
      if (priorDay !== null && priorDay < openedDay && now - priorDay <= 180) window.gtag('event', 'record_return_saved', {app_kind:appKind});
    } catch (_) {} // Measurement must never interrupt a successful record save.
  }});
  function start() {
    if (!canMeasure()) return;
    if (!sanitizeBrowserURL()) { blockedURL = true; window['ga-disable-' + id] = true; clearUsage(); clearAnalyticsCookies(); return; }
    // A read-only/broken storage area must not reactivate a stale permission.
    // Writing the exact existing bytes does not grant or renew consent.
    try {
      const existing = localStorage.getItem(key);
      localStorage.setItem(key, existing);
      if (localStorage.getItem(key) !== existing) throw new Error('consent-storage');
    } catch (_) { failed = true; choice = 'denied'; window['ga-disable-' + id] = true; clearUsage(); clearAnalyticsCookies(); return; }
    window['ga-disable-' + id] = false;
    scheduleExpiry();
    if (loaded) return;
    try {
      const usageKey = usageKeys[appKind === 'cat' ? 1 : 0], raw = localStorage.getItem(usageKey);
      try { priorDay = ordinal(JSON.parse(raw)?.lastSavedDay); } catch (_) { priorDay = null; }
      if (priorDay !== null && (priorDay > openedDay || openedDay - priorDay > 180)) priorDay = null;
      if (raw !== null && priorDay === null) localStorage.removeItem(usageKey);
    } catch (_) { priorDay = null; usageStorageOK = false; }
    loaded = true;
    window['ga-disable-' + id] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    const denied = {analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'};
    window.gtag('consent', 'default', denied);
    window.gtag('consent', 'update', {...denied, analytics_storage:'granted'});
    window.gtag('js', new Date());
    window.gtag('config', id, {
      page_location:cleanURL(location.href), page_referrer:cleanReferrer(),
      page_title:'Pet meal check', allow_google_signals:false, allow_ad_personalization_signals:false,
      cookie_path:root.pathname, cookie_expires:180 * 24 * 60 * 60,
      ...campaignFields()
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
    if (choice === 'unset' && legacyPermission) status.textContent += ' ' + words[9];
    if (internal || blockedURL || (!appPage && document.body.dataset.pet)) {
      const lang = Object.keys(copy).find(key => copy[key] === words) || 'en';
      status.textContent += ' ' + excludedCopy[lang];
    }
    allow.setAttribute('aria-pressed', String(choice === 'granted'));
    decline.setAttribute('aria-pressed', String(choice === 'denied'));
  }
  function set(value) {
    failed = false;
    try {
      if (value === 'denied') localStorage.setItem(legacyKey, JSON.stringify({choice:'denied', time:Date.now()}));
      else { retireLegacyGrant(); if (failed) throw new Error('legacy-consent'); }
      localStorage.setItem(key, JSON.stringify({choice:value, time:Date.now()})); choice=value;
    }
    catch (_) {
      failed=true; choice='denied';
      // Quota failures can still permit deletion. Never leave a stored grant
      // merely because writing the refusal failed; never clear app records.
      for (const storageKey of [key, legacyKey]) { try { localStorage.removeItem(storageKey); } catch (_) {} }
    }
    if (choice !== 'granted') {
      clearTimeout(expiryTimer);
      window['ga-disable-' + id] = true;
      clearUsage();
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
    if (event.key !== key && event.key !== legacyKey && event.key !== internalKey && event.key !== null) return;
    retireLegacyGrant();
    choice=read();
    internal=readInternal();
    if (!canMeasure()) { clearTimeout(expiryTimer); window['ga-disable-' + id]=true; if (choice !== 'granted' || internal) { clearUsage(); clearAnalyticsCookies(); } if (loaded) location.reload(); }
    else start();
    render();
  });
  render();
  if (canMeasure()) { start(); render(); } else if (choice !== 'granted' || internal || failed) { clearUsage(); clearAnalyticsCookies(); }
})();
