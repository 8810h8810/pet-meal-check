const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const baseline='backup-before-i18n-20261011';
class Element {
  constructor(tag='div') {this.nodeType=1;this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes={};this.hidden=false;this.listeners={};this.style={};this.value='';this.classes=new Set();this.classList={toggle:(cls,on)=>on?this.classes.add(cls):this.classes.delete(cls)};}
  get parentElement(){return this.parentNode || null;}
  get dataset(){const o={};for(const [k,v] of Object.entries(this.attributes))if(k.startsWith('data-'))o[k.slice(5).replace(/-([a-z])/g,(_,a)=>a.toUpperCase())]=v;return this._dataset || o;}
  set dataset(value){this._dataset=value;}
  get id(){return this.attributes.id;} set id(v){this.attributes.id=v;}
  get className(){return this.attributes.class||'';} set className(v){this.attributes.class=v;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  append(...nodes){for(let n of nodes){if(typeof n==='string')n=new Text(n);n.parentNode=this;this.childNodes.push(n);}}
  appendChild(n){this.append(n);return n;}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set textContent(value){this.childNodes=[];this.append(new Text(String(value)));}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  matches(selector){return selector.split(',').some(sel=>{sel=sel.trim();if(sel.startsWith('#'))return this.id===sel.slice(1);if(sel.startsWith('.'))return this.className.split(' ').includes(sel.slice(1));if(sel.startsWith('['))return sel.slice(1,-1) in this.attributes;return this.tagName===sel.toUpperCase();});}
  closest(sel){return this.matches(sel)?this:this.parentElement?.closest(sel);}
  querySelectorAll(sel){return this.children.flatMap(child=>[...(child.matches(sel)?[child]:[]),...child.querySelectorAll(sel)]);}
  querySelector(sel){return this.querySelectorAll(sel)[0]||null;}
  get innerHTML(){return this.childNodes.map(serialize).join('');}
  set innerHTML(value){this.childNodes=[];parse(value,this);}
  showModal(){this.open=true;} close(){this.open=false;}
}
class Text {
  constructor(value){this.nodeType=3;this.nodeValue=value;}
  get textContent(){return this.nodeValue;}
  get parentElement(){return this.parentNode||null;}
}
function serialize(node){if(node.nodeType===3)return node.nodeValue;return `<${node.tagName.toLowerCase()}${Object.entries(node.attributes).map(([k,v])=>` ${k}="${v}"`).join('')}>${node.innerHTML}</${node.tagName.toLowerCase()}>`;}
function parse(html,parent){const stack=[parent];for(const part of html.match(/<[^>]*>|[^<]+/g)||[]){if(part.startsWith('</')){stack.pop();continue;}if(part.startsWith('<')){if(part.startsWith('<!'))continue;const tag=part.match(/^<([\w-]+)/)[1];const el=new Element(tag);for(const match of part.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(match.index<=1)continue;el.setAttribute(match[1],match[2]||'');}stack.at(-1).appendChild(el);if(!['meta','br','input','link','img'].includes(tag))stack.push(el);}else stack.at(-1).appendChild(new Text(part));}}
function environment(file,deviceLanguage='ja',initial={}){
  const html=read(file),body=new Element('body'),head=new Element('head'),docEl=new Element('html');
  docEl.lang=html.match(/<html lang="([^"]+)"/)[1];body.dataset={pet:html.match(/data-pet="([^"]+)"/)[1]};const localKey=html.match(/data-local-key="([^"]+)"/);if(localKey)body.dataset.localKey=localKey[1];
  const sheet=new Element();sheet.id='sheet';const reset=new Element('button');reset.id='reset';reset.textContent=docEl.lang==='en'?'Reset':'リセット';sheet.append(reset);body.append(sheet);
  const controls=new Element('section');controls.id='sharing';for(const [id,value] of [['sync-status','この端末だけに保存'],['start-sharing','家族と共有する'],['invite','家族を招待'],['join-sharing','招待リンクで参加'],['stop-sharing','この端末の共有をやめる']]){const el=new Element(id==='sync-status'?'p':'button');el.id=id;el.textContent=value;controls.append(el);}body.append(controls);
  const store=new Map(Object.entries(initial));const writes=[];let failSave=false;const events={};let confirms=[],alerts=[];
  const document={body,head,documentElement:docEl,hidden:false,cookie:'',title:'ごはんあげた？',currentScript:{src:'https://example.test/pet-meal-check/i18n.js'},getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),addEventListener:()=>{},createElement:tag=>{const el=new Element(tag);if(tag==='template'){el.content=new Element('fragment');Object.defineProperty(el,'innerHTML',{set:html=>parse(html,el.content),get:()=>el.content.innerHTML});}return el;}};
  const window={addEventListener:(name,fn)=>(events[name]??=[]).push(fn),dispatchEvent:event=>(events[event.type]||[]).forEach(fn=>fn(event)),matchMedia:()=>({matches:false})};
  const sandbox={window,document,navigator:{language:deviceLanguage,languages:[deviceLanguage],onLine:false},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(failSave)throw Error('quota');store.set(k,v);writes.push(k);},removeItem:k=>store.delete(k)},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){}},Event:class{constructor(type){this.type=type;}},URL,URLSearchParams,location:{pathname:'/pet-meal-check/',origin:'https://example.test'},crypto:require('node:crypto').webcrypto,structuredClone,setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},alert:v=>alerts.push(v),confirm:v=>{confirms.push(v);return false;},fetch:()=>{throw Error('Unexpected network request');},console};
  vm.createContext(sandbox);for(const f of ['i18n-data.js','i18n-pages.js','i18n.js','check-sync.js'])vm.runInContext(read(f),sandbox,{filename:f});
  return {window,document,store,writes,confirms,alerts,setFail:v=>failSave=v};
}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
for(const route of ['index.html','cat/index.html','en/dog/index.html','en/cat/index.html']){
  test(route+' keeps records through all four languages',()=>{
    const pet=route.includes('cat')?'cat':'dog',key=route.startsWith('en/')?`pet-meal-check-${pet}-en-v2`:`pet-meal-check-${pet}-v1`;
    const app=environment(route,'ja',{[key]:JSON.stringify({'0-0':true,'3-1':true})});
    const buttons=app.document.getElementById('sheet').querySelectorAll('.tap');assert.equal(buttons.length,14);assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
    for(const lang of ['ja','en','es','nl','en','ja']){app.window.petMealI18n.setLanguage(lang);assert.equal(app.document.documentElement.lang,lang);assert.equal(app.store.get(key),JSON.stringify({'0-0':true,'3-1':true}));assert.equal(buttons[0].getAttribute('aria-pressed'),'true');assert.equal(buttons[7].getAttribute('aria-pressed'),'true');assert.ok(buttons[0].getAttribute('aria-label').startsWith(app.window.petMealChartWords[lang].full[0]));}
    buttons[1].onclick();assert.equal(JSON.parse(app.store.get(key))['0-1'],true);assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.ok(app.writes.every(k=>[key,'pet-meal-language-v1'].includes(k)));
    app.setFail(true);buttons[1].onclick();assert.equal(JSON.parse(app.store.get(key))['0-1'],true);assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.ok(app.alerts.length);
  });
}
test('device detection and English fallback',()=>{for(const [raw,expected] of [['ja-JP','ja'],['es-MX','es'],['nl-NL','nl'],['en-US','en'],['fr-FR','en'],['zh-CN','en']])assert.equal(environment('index.html',raw).window.petMealI18n.language,expected);});
test('manual preference wins over device and can return to auto',()=>{const app=environment('index.html','nl-NL',{'pet-meal-language-v1':'es'});assert.equal(app.window.petMealI18n.language,'es');app.window.petMealI18n.setLanguage('auto');assert.equal(app.window.petMealI18n.language,'nl');});
test('dictionary rows have four nonempty languages',()=>{const app=environment('index.html');for(const row of app.window.petMealTranslations){assert.equal(row.length,4);row.forEach(v=>assert.ok(typeof v==='string'&&v.length));}});
test('confirmation and dialog templates translated for each language',()=>{
  const source=read('check-sync.js'),templates=[...source.matchAll(/guide\(t\('([^']*)'\)\)/g)].map(m=>m[1]);assert.equal(templates.length,5);
  for(const lang of ['en','es','nl']){const app=environment('index.html',lang);app.document.getElementById('reset').onclick();assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(app.confirms[0]));for(const html of templates){const translated=app.window.petMealI18n.translate(html);assert.ok(!/[ぁ-んァ-ヶ一-龯]/.test(translated),translated);assert.ok(translated.includes('data-close'));}}
});
test('existing sharing remains queued, local language switch has no sharing writes',()=>{
  const shared={room:'a'.repeat(64),token:'b'.repeat(64),cells:Object.fromEntries(Array.from({length:14},(_,i)=>[`${i>>1}-${i%2}`,{value:i===0,rev:0,op:'initial'}])),queue:[]};
  const original=JSON.stringify(shared);const app=environment('index.html','ja',{'pet-meal-sharing-dog-v1':original});app.window.petMealI18n.setLanguage('es');assert.equal(app.store.get('pet-meal-sharing-dog-v1'),original);app.document.getElementById('sheet').querySelectorAll('.tap')[2].onclick();const after=JSON.parse(app.store.get('pet-meal-sharing-dog-v1'));assert.equal(after.room,shared.room);assert.equal(after.token,shared.token);assert.equal(after.queue.length,1);assert.equal(after.queue[0].cell,'1-0');assert.equal(after.queue[0].value,true);
});
test('original images, manifests, Firebase worker and affiliate URLs unchanged',()=>{
  const files=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n');
  for(const f of files.filter(f=>/\.(jpeg|jpg|JPG|webmanifest)$/.test(f)||f.startsWith('rakuten-worker/')||f.startsWith('functions/')))assert.deepEqual(fs.readFileSync(path.join(root,f)),cp.execFileSync('git',['show',`${baseline}:${f}`],{cwd:root}));
  for(const f of ['index.html','cat/index.html']){const urls=s=>[...s.matchAll(/href="(https:\/\/hb\.afl\.rakuten\.co\.jp[^"]+)"/g)].map(m=>m[1]);assert.deepEqual(urls(read(f)),urls(cp.execFileSync('git',['show',`${baseline}:${f}`],{cwd:root,encoding:'utf8'})));}
});
test('all pages load translations before chart engine',()=>{for(const f of ['index.html','cat/index.html','en/dog/index.html','en/cat/index.html']){const source=read(f);assert.ok(source.indexOf('i18n-data.js')<source.indexOf('i18n-pages.js'));assert.ok(source.indexOf('i18n-pages.js')<source.indexOf('i18n.js'));assert.ok(source.indexOf('i18n.js')<source.indexOf('check-sync.js'));}});
test('offline cache paths exist locally',()=>{const source=read('sw.js');const fragment=source.slice(source.indexOf('const ASSETS'),source.indexOf('].map'));const paths=[...fragment.matchAll(/['"](\.\/[^'"]*)['"]/g)].map(m=>decodeURIComponent(m[1]));for(const f of paths)assert.ok(fs.existsSync(path.join(root,f)),f);assert.ok(paths.includes('./i18n-pages.js'));});
test('all explanatory and privacy page text has translations',()=>{
  const app=environment('index.html'),known=new Set(app.window.petMealTranslations.flat());
  for(const f of ['about/index.html','privacy/index.html','en/privacy/index.html']){
    const html=read(f).replace(/<(script|style)[\s\S]*?<\/\1>/g,'').replace(/<head[\s\S]*?<\/head>/,'');
    for(const m of html.matchAll(/>([^<>]+)</g)){const text=m[1].trim();if(text&&!['● ● ●','● ●','🦴','🐟','🐾','.','·'].includes(text))assert.ok(known.has(text),`${f}: ${text}`);}
  }
});
console.log(`${count} tests passed (DOM test doubles; not a real browser or live Firebase test).`);
