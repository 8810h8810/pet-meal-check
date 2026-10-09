// Same-origin proxy for Cloudflare Pages preview; no credentials are stored here.
const WORKER = "https://pet-meal-rakuten-api.8810h8810.workers.dev";
export async function onRequestGet({ request }) {
  const incoming = new URL(request.url);
  const target = new URL("/products", WORKER);
  target.searchParams.set("keyword", incoming.searchParams.get("keyword") || "");
  try {
    const upstream = await fetch(target.toString(), { headers: { Accept: "application/json" } });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  } catch {
    return Response.json({ products: [], status: "proxy_network_error" }, { status: 502 });
  }
}
