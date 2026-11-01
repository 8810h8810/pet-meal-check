/* QA ONLY: fixed response, no request processing, credentials, or upstream. */
export function onRequest() { return new Response(JSON.stringify({products:[],status:'qa_disabled'}),{status:410,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}}); }
