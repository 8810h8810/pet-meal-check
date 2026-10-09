/** Cloudflare Worker: Rakuten API proxy for the existing static Pet Meal Check app.
 * Secrets: RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY, RAKUTEN_AFFILIATE_ID.
 * Optional env: ALLOWED_ORIGIN (exact public site origin).
 * Configure as a separate Worker. Do not embed secrets in GitHub Pages.
 */
const categories = new Set(["ドッグフード","キャットフード","ペットのおやつ","ペット用食器","ペットベッド","リード","ペット用おもちゃ","ペットシーツ","うんち袋","消臭スプレー","ペットブラシ","ペット用 掃除用品","犬 トイレ用品"]);
const endpoint = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";
function json(data,status,origin) {
  const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin","X-Content-Type-Options":"nosniff"};
  if(origin) headers["Access-Control-Allow-Origin"]=origin;
  return new Response(JSON.stringify(data),{status,headers});
}
export default {
 async fetch(request,env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  const preview = env.PREVIEW_ORIGIN;
  if(!allowed || !/^https:\/\//.test(allowed)) return json({products:[],status:"not_configured"},503);
  const origins = new Set([allowed]);
  // Separate browser origins from the registered Rakuten upstream origin.
  for (const value of (env.ADDITIONAL_ORIGINS || "").split(",")) {
    const candidate = value.trim();
    try { const parsed = new URL(candidate); if (parsed.protocol === "https:" && parsed.origin === candidate) origins.add(candidate); } catch {}
  }
  if (preview && /^https:\/\/[^/]+\.pages\.dev$/.test(preview)) origins.add(preview);
  if(origin && !origins.has(origin)) return json({products:[],status:"forbidden"},403);
  const responseOrigin = origin && origins.has(origin) ? origin : allowed;
  if(request.method === "OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":responseOrigin,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}});
  if(request.method !== "GET" || url.pathname !== "/products") return json({products:[],status:"not_found"},404,responseOrigin);
  const keyword=url.searchParams.get("keyword");
  if(!categories.has(keyword)) return json({products:[],status:"invalid_category"},400,responseOrigin);
  if(!env.RAKUTEN_APPLICATION_ID||!env.RAKUTEN_ACCESS_KEY||!env.RAKUTEN_AFFILIATE_ID||!env.SEARCH_COORDINATOR) return json({products:[],status:"not_configured"},503,responseOrigin);
  try {
   const id = env.SEARCH_COORDINATOR.idFromName("shared-rakuten-search-v1");
   const target = new URL("https://internal/search"); target.searchParams.set("keyword",keyword);
   const result = await env.SEARCH_COORDINATOR.get(id).fetch(target);
   const headers = new Headers(result.headers); headers.set("Access-Control-Allow-Origin",responseOrigin); headers.set("Vary","Origin");
   return new Response(result.body,{status:result.status,headers});
  } catch {return json({products:[],status:"search_unavailable"},503,responseOrigin);}
 }
};

async function queryRakuten(keyword,env) {
  const allowed = env.ALLOWED_ORIGIN;
  const responseOrigin = null;
  const {RAKUTEN_APPLICATION_ID:app,RAKUTEN_ACCESS_KEY:key,RAKUTEN_AFFILIATE_ID:affiliate}=env;
  if(!app||!key||!affiliate) return json({products:[],status:"not_configured"},503,responseOrigin);
  const params=new URLSearchParams({applicationId:app,accessKey:key,affiliateId:affiliate,keyword,format:"json",formatVersion:"2",hits:"20"});
  try {
   const response=await fetch(endpoint+"?"+params,{headers:{Origin:allowed,Referer:allowed+"/"},signal:AbortSignal.timeout(8000)});
   if(!response.ok) {
    // Diagnostic codes only: never expose credentials, upstream URLs, or response text.
    let errorCode = "unknown";
    try {
      const problem = await response.json();
      const candidate = typeof problem?.error === "string" ? problem.error : "";
      const known = new Set(["wrong_parameter","not_found","too_many_requests","system_error","service_unavailable","invalid_access_key","invalid_application_id","forbidden","unauthorized"]);
      if (known.has(candidate)) errorCode = candidate;
    } catch {}
    return json({products:[],status:"api_error",upstreamStatus:response.status,errorCode},502,responseOrigin);
   }
   const data=await response.json();
   const entries=Array.isArray(data.items)?data.items:Array.isArray(data.Items)?data.Items:[];
   const products=entries.map(x=>x?.Item??x).filter(x=>typeof x?.itemName==="string"&&typeof x?.itemPrice==="number"&&typeof x?.affiliateUrl==="string").filter(x=>{
    try {const u=new URL(x.affiliateUrl);return u.protocol==="https:"&&(u.hostname==="a.r10.to"||u.hostname==="hb.afl.rakuten.co.jp"||u.hostname==="rakuten.co.jp"||u.hostname.endsWith(".rakuten.co.jp"));}catch{return false;}
   }).filter(x=>!/ふるさと納税|返礼品|寄附金|寄付金/.test(x.itemName)).slice(0,5).map(x=>{const raw=x.mediumImageUrls?.[0]??x.smallImageUrls?.[0]??x.mediumImageUrl??x.smallImageUrl;const candidate=typeof raw==="string"?raw:typeof raw?.imageUrl==="string"?raw.imageUrl:"";let imageUrl="";try{const u=new URL(candidate);if(u.protocol==="https:"&&(u.hostname==="thumbnail.image.rakuten.co.jp"||u.hostname==="image.rakuten.co.jp"))imageUrl=u.href;}catch{}return {name:x.itemName,price:x.itemPrice,affiliateUrl:x.affiliateUrl,imageUrl};});
   return json({products,status:products.length?"ok":"no_products",fetchedAt:Date.now()},200,responseOrigin);
  } catch {return json({products:[],status:"network_error"},502,responseOrigin);}
}

// One named SQLite Durable Object coordinates all callers of this Worker.
// No user records, photographs, IP addresses or browser identifiers are stored.
export class SearchCoordinator {
 constructor(ctx,env) {
  this.env=env; this.sql=ctx.storage.sql; this.pending=new Map();
  this.sql.exec('CREATE TABLE IF NOT EXISTS gate (id INTEGER PRIMARY KEY, next_at INTEGER NOT NULL)');
  this.sql.exec('INSERT OR IGNORE INTO gate(id,next_at) VALUES(1,0)');
  this.sql.exec('CREATE TABLE IF NOT EXISTS products_cache (keyword TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, body TEXT NOT NULL)');
 }
 async fetch(request) {
  const url=new URL(request.url);
  const keyword=url.searchParams.get('keyword');
  if(request.method!=='GET'||url.pathname!=='/search'||!categories.has(keyword)) return json({products:[],status:'invalid_category'},400);
  if(!this.env.RAKUTEN_APPLICATION_ID||!this.env.RAKUTEN_ACCESS_KEY||!this.env.RAKUTEN_AFFILIATE_ID) return json({products:[],status:'not_configured'},503);
  const now=Date.now();
  const cached=this.sql.exec('SELECT body FROM products_cache WHERE keyword=? AND expires_at>?',keyword,now).toArray()[0];
  if(cached) return new Response(cached.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  if(this.pending.has(keyword)) return (await this.pending.get(keyword)).clone();
  // No await between reading and reserving: SQLite operations are synchronous.
  const next=this.sql.exec('SELECT next_at FROM gate WHERE id=1').toArray()[0].next_at;
  if(now<next) {
   const r=json({products:[],status:'rate_limited'},429);
   r.headers.set('Retry-After',String(Math.max(1,Math.ceil((next-now)/1000)))); return r;
  }
  this.sql.exec('UPDATE gate SET next_at=? WHERE id=1',now+1100);
  const task=this.load(keyword);
  this.pending.set(keyword,task);
  try {return (await task).clone();} finally {this.pending.delete(keyword);}
 }
 async load(keyword) {
  const response=await queryRakuten(keyword,this.env);
  if(response.ok) {
   const body=await response.clone().text();
   this.sql.exec('INSERT OR REPLACE INTO products_cache(keyword,expires_at,body) VALUES(?,?,?)',keyword,Date.now()+600000,body);
  } else {
   // A failed API call cannot trigger a retry storm across applications.
   this.sql.exec('UPDATE gate SET next_at=MAX(next_at,?) WHERE id=1',Date.now()+60000);
  }
  return response;
 }
}
