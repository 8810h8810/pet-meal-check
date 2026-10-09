/** Cloudflare Worker: Rakuten API proxy for the existing static Pet Meal Check app.
 * Secrets: RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY, RAKUTEN_AFFILIATE_ID.
 * Optional env: ALLOWED_ORIGIN (exact public site origin).
 * Configure as a separate Worker. Do not embed secrets in GitHub Pages.
 */
const categories = new Set(["ドッグフード","キャットフード","ペットのおやつ","ペット用食器","ペットベッド","リード","ペット用おもちゃ","ペットシーツ","うんち袋","消臭スプレー","ペットブラシ"]);
const endpoint = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";
function json(data,status,origin) {
  const headers = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=600","Vary":"Origin","X-Content-Type-Options":"nosniff"};
  if(origin) headers["Access-Control-Allow-Origin"]=origin;
  return new Response(JSON.stringify(data),{status,headers});
}
export default {
 async fetch(request,env) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGIN;
  if(!allowed || !/^https:\/\//.test(allowed)) return json({products:[],status:"not_configured"},503);
  if(origin && origin !== allowed) return json({products:[],status:"forbidden"},403);
  if(request.method === "OPTIONS") return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400","Vary":"Origin"}});
  if(request.method !== "GET" || url.pathname !== "/products") return json({products:[],status:"not_found"},404,allowed);
  const keyword=url.searchParams.get("keyword");
  if(!categories.has(keyword)) return json({products:[],status:"invalid_category"},400,allowed);
  const {RAKUTEN_APPLICATION_ID:app,RAKUTEN_ACCESS_KEY:key,RAKUTEN_AFFILIATE_ID:affiliate}=env;
  if(!app||!key||!affiliate) return json({products:[],status:"not_configured"},503,allowed);
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
    return json({products:[],status:"api_error",upstreamStatus:response.status,errorCode},502,allowed);
   }
   const data=await response.json();
   const entries=Array.isArray(data.items)?data.items:Array.isArray(data.Items)?data.Items:[];
   const products=entries.map(x=>x?.Item??x).filter(x=>typeof x?.itemName==="string"&&typeof x?.itemPrice==="number"&&typeof x?.affiliateUrl==="string").filter(x=>{
    try {const u=new URL(x.affiliateUrl);return u.protocol==="https:"&&(u.hostname==="a.r10.to"||u.hostname==="hb.afl.rakuten.co.jp"||u.hostname==="rakuten.co.jp"||u.hostname.endsWith(".rakuten.co.jp"));}catch{return false;}
   }).filter(x=>!/ふるさと納税|返礼品|寄附金|寄付金/.test(x.itemName)).slice(0,5).map(x=>{const raw=x.mediumImageUrls?.[0]??x.smallImageUrls?.[0]??x.mediumImageUrl??x.smallImageUrl;const candidate=typeof raw==="string"?raw:typeof raw?.imageUrl==="string"?raw.imageUrl:"";let imageUrl="";try{const u=new URL(candidate);if(u.protocol==="https:"&&(u.hostname==="thumbnail.image.rakuten.co.jp"||u.hostname==="image.rakuten.co.jp"))imageUrl=u.href;}catch{}return {name:x.itemName,price:x.itemPrice,affiliateUrl:x.affiliateUrl,imageUrl};});
   return json({products,status:products.length?"ok":"no_products"},200,allowed);
  } catch {return json({products:[],status:"network_error"},502,allowed);}
 }
};
