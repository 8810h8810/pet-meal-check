/* Four-language interface, independent of chart and Firebase persistence. */
(() => {
  'use strict';
  const languages = ['ja', 'en', 'es', 'nl'];
  const key = 'pet-meal-language-v1';
  const originalLanguage = document.documentElement.lang;
  const index = new Map();
  for (const row of window.petMealTranslations) {
    row.forEach(value => index.set(value, row));
  }
  // Old English page variants retain their original URLs and local keys.
  index.set('Reset this week', index.get('リセット'));
  const normalize = value => {
    const base = String(value || '').toLowerCase().split(/[-_]/)[0];
    return languages.includes(base) ? base : 'en';
  };
  let preference = 'auto';
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'auto' || languages.includes(saved)) preference = saved;
  } catch (_) {}
  let language = preference === 'auto' ? normalize(navigator.languages?.[0] || navigator.language) : preference;
  const textSources = new WeakMap();
  const attrSources = new WeakMap();
  const attrs = ['aria-label', 'placeholder', 'alt', 'title'];
  function translateText(value) {
    const trimmed = value.trim();
    const row = index.get(trimmed);
    if (!row) return value;
    return value.replace(trimmed, row[languages.indexOf(language)] || row[1]);
  }
  function translateNode(node) {
    if (node.nodeType === 3) {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,textarea,[data-no-translate],.rakuten-product-name')) return;
      let state = textSources.get(node);
      if (!state || node.nodeValue !== state.output) state = {source:node.nodeValue};
      state.output = translateText(state.source);
      textSources.set(node, state);
      if (node.nodeValue !== state.output) node.nodeValue = state.output;
      return;
    }
    if (node.nodeType !== 1 || node.matches('script,style,[data-no-translate]')) return;
    let sources = attrSources.get(node);
    if (!sources) { sources = {}; attrSources.set(node, sources); }
    for (const attr of attrs) {
      const value = node.getAttribute(attr);
      if (value === null) continue;
      let state = sources[attr];
      if (!state || value !== state.output) state = {source:value};
      state.output = translateText(state.source);
      sources[attr] = state;
      if (value !== state.output) node.setAttribute(attr,state.output);
    }
    if (!node.matches('textarea')) for (const child of [...node.childNodes]) translateNode(child);
  }
  function translate(value) {
    // All callers supply source literals, never user-provided URLs or text.
    if (!value.startsWith('<')) return translateText(value);
    const template = document.createElement('template');
    template.innerHTML = value;
    for (const child of template.content.childNodes) translateNode(child);
    return template.innerHTML;
  }
  function cellLabel(i) {
    const words = window.petMealChartWords[language];
    const day = words.full[Math.floor(i / 2)], time = i % 2 ? words.night : words.morning;
    return language === 'ja' ? `${day}の${time}` : `${day} · ${time}`;
  }
  let overlay;
  function renderChart() {
    const sheet = document.getElementById('sheet');
    if (!sheet) return;
    const words = window.petMealChartWords[language];
    for (const [i, button] of [...sheet.querySelectorAll('.tap')].entries()) {
      button.setAttribute('aria-label',cellLabel(i));
    }
    document.getElementById('reset').setAttribute('aria-label',translateText('リセット'));
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-translation'; overlay.setAttribute('aria-hidden','true');
      overlay.setAttribute('data-no-translate','');
      for (const cls of ['chart-title','chart-day','chart-morning','chart-night','chart-reset',...words.days.map((_,i)=>`chart-weekday chart-weekday-${i}`)]) {
        const label = document.createElement('span'); label.className=cls; overlay.appendChild(label);
      }
      sheet.appendChild(overlay);
    }
    overlay.hidden = language === originalLanguage;
    overlay.querySelector('.chart-title').textContent = words.title;
    overlay.querySelector('.chart-day').textContent = words.day;
    overlay.querySelector('.chart-morning').textContent = words.morning;
    overlay.querySelector('.chart-night').textContent = words.night;
    overlay.querySelector('.chart-reset').textContent = translateText('リセット');
    overlay.querySelectorAll('.chart-weekday').forEach((label,i)=>label.textContent=words.days[i]);
  }
  function refresh() {
    document.documentElement.lang = language;
    translateNode(document.body);
    renderChart();
    const pet = document.body.dataset.pet;
    if (pet) document.title = `${translateText('ごはんあげた？')} | ${translateText(pet === 'cat' ? '猫' : '犬')}`;
    else document.title = translateText(document.title);
  }
  window.petMealI18n = {
    translate, cellLabel, normalize,
    get language() { return language; },
    setLanguage(value) {
      preference = value === 'auto' || languages.includes(value) ? value : 'auto';
      language = preference === 'auto' ? normalize(navigator.languages?.[0] || navigator.language) : preference;
      let saved = true;
      try { localStorage.setItem(key,preference); } catch (_) { saved=false; }
      refresh();
      window.dispatchEvent(new Event('pet-meal-languagechange'));
      if (!saved) alert(translateText('言語設定を保存できませんでした。この画面では切り替えました。'));
    }
  };
  const settings = document.createElement('section'); settings.className='language-settings';
  const label = document.createElement('label'); label.htmlFor='app-language'; label.textContent='言語';
  const select = document.createElement('select'); select.id='app-language';
  for (const [value,name] of [['auto','端末の言語に合わせる'],['ja','日本語'],['en','English'],['es','Español'],['nl','Nederlands']]) {
    const option=document.createElement('option'); option.value=value; option.textContent=name; select.appendChild(option);
  }
  select.value=preference;
  select.addEventListener('change',()=>window.petMealI18n.setLanguage(select.value));
  settings.append(label,select);
  document.body.appendChild(settings);
  const goods=document.getElementById('goods-dialog');
  if (goods) {
    const note=document.createElement('p'); note.className='goods-note';
    note.textContent='楽天市場の商品名は原文（日本語）で表示しています。配送先・送料は販売店で確認してください。';
    goods.appendChild(note);
  }
  const scriptURL=new URL(document.currentScript.src);
  if (document.body.dataset.pet && !document.querySelector('a[data-policy-link]')) {
    const footer=document.createElement('p'); footer.className='language-settings';
    const link=document.createElement('a'); link.dataset.policyLink=''; link.href=new URL('privacy/',scriptURL).href; link.textContent='プライバシーポリシー';
    footer.appendChild(link); document.body.appendChild(footer);
  }
  refresh();
  const observer=new MutationObserver(mutations=>{
    // Process the changed fragments only. Chart relabeling is event-driven.
    for (const change of mutations) {
      if (change.type === 'childList') change.addedNodes.forEach(translateNode);
      else translateNode(change.target);
    }
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attrs});
})();
