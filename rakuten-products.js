/* Optional Rakuten auto-discovery, isolated from the feeding tracker and family sync. */
(() => {
  const dialog = document.getElementById("goods-dialog");
  if (!dialog || dialog.querySelector("#rakuten-auto")) return;
  const labels = ["ドッグフード","キャットフード","ペットのおやつ","ペット用食器","ペットベッド","リード","ペット用おもちゃ","ペットシーツ","うんち袋","消臭スプレー","ペットブラシ"];
  const section = document.createElement("section");
  section.id = "rakuten-auto";
  section.className = "rakuten-auto";
  const heading = document.createElement("h3");
  heading.textContent = "ほかのペット用品を探す";
  const note = document.createElement("p");
  note.className = "goods-note";
  note.textContent = "PR｜楽天市場の商品を検索します。価格・在庫・送料はリンク先で確認してください。";
  const categories = document.createElement("div");
  categories.className = "rakuten-categories";
  const status = document.createElement("p");
  status.className = "goods-note";
  status.setAttribute("role","status");
  const results = document.createElement("ul");
  results.className = "rakuten-results";
  section.append(heading,note,categories,status,results);
  const style = document.createElement("style");
  style.textContent = `#rakuten-auto .rakuten-results{list-style:none;padding:0;margin:12px 0 0}#rakuten-auto .rakuten-results li{list-style:none;margin:0;padding:12px 0;border-bottom:1px solid #ddd0c3}#rakuten-auto .rakuten-results li::marker{content:""}#rakuten-auto .rakuten-product-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;min-width:0}#rakuten-auto .rakuten-product-link img{width:96px;height:96px;object-fit:contain;flex-shrink:0}#rakuten-auto .rakuten-product-info{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}#rakuten-auto .rakuten-product-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;line-height:1.45;font-weight:600}#rakuten-auto .rakuten-product-price{font-weight:700;white-space:nowrap}`;
  section.append(style);
  dialog.append(section);
  const endpoint = () => location.hostname.endsWith(".pages.dev") ? location.origin + "/api" : (document.querySelector('meta[name="rakuten-api-base"]')?.content?.trim() || "");
  let controller = null;
  let sequence = 0;
  function setBusy(busy) {
    for (const button of categories.querySelectorAll("button")) button.disabled = busy;
  }
  async function search(keyword) {
    const api = endpoint();
    if (!api) { status.textContent = "自動検索は準備中です。上のおすすめ商品は引き続きご覧いただけます。"; return; }
    let url;
    try {
      url = new URL(api);
      if (url.protocol !== "https:") throw new Error("HTTPS required");
      url.pathname = url.pathname.replace(/\/$/,"") + "/products";
      url.searchParams.set("keyword",keyword);
    } catch { status.textContent = "検索先の設定を確認してください。"; return; }
    controller?.abort();
    controller = new AbortController();
    const current = ++sequence;
    setBusy(true);
    results.replaceChildren();
    status.textContent = "検索中…";
    try {
      const response = await fetch(url.toString(), {signal:controller.signal});
      if (!response.ok) {
        let detail = "";
        try { const body = await response.json(); detail = typeof body?.status === "string" ? body.status : ""; } catch {}
        throw new Error("HTTP " + response.status + (detail ? " / " + detail : ""));
      }
      const data = await response.json();
      if (current !== sequence) return;
      const products = Array.isArray(data.products) ? data.products : [];
      for (const product of products.slice(0,5)) {
        if (typeof product.name !== "string" || !Number.isFinite(product.price) || typeof product.affiliateUrl !== "string") continue;
        let linkUrl;
        try {
          linkUrl = new URL(product.affiliateUrl);
          if (linkUrl.protocol !== "https:" || !["a.r10.to","hb.afl.rakuten.co.jp","rakuten.co.jp"].includes(linkUrl.hostname) && !linkUrl.hostname.endsWith(".rakuten.co.jp")) continue;
        } catch { continue; }
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = linkUrl.href;
        a.className = "rakuten-product-link";
        a.target = "_blank";
        a.rel = "nofollow sponsored noopener noreferrer";
        if (typeof product.imageUrl === "string" && product.imageUrl) {
          try {
            const imageUrl = new URL(product.imageUrl);
            if (imageUrl.protocol === "https:" && ["thumbnail.image.rakuten.co.jp","image.rakuten.co.jp"].includes(imageUrl.hostname)) {
              const img = document.createElement("img");
              img.src = imageUrl.href;
              img.alt = "";
              img.loading = "lazy";
              img.width = 96;
              img.height = 96;

              img.addEventListener("error", () => img.remove());
              a.append(img);

            }
          } catch {}
        }
        const info = document.createElement("span");
        info.className = "rakuten-product-info";
        const title = document.createElement("span");
        title.className = "rakuten-product-name";
        title.textContent = product.name;
        const price = document.createElement("span");
        price.className = "rakuten-product-price";
        price.textContent = product.price.toLocaleString("ja-JP") + "円 ↗";
        info.append(title,price);
        a.append(info);
        li.append(a);
        results.append(li);
      }
      status.textContent = results.children.length ? "楽天市場の商品（PR）" : "該当する商品が見つかりませんでした。";
    } catch (error) {
      if (error.name !== "AbortError") {
        const detail = /^HTTP \d{3}(?: \/ [a-z_]+)?$/.test(error.message) ? error.message : "通信エラー（CORS・ネットワーク等）";
        status.textContent = "現在、商品を取得できません（" + detail + "）。上のおすすめ商品はご覧いただけます。";
      }
    } finally { if (current === sequence) setBusy(false); }
  }
  for (const keyword of labels) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = keyword;
    button.addEventListener("click", () => search(keyword));
    categories.append(button);
  }
  dialog.addEventListener("close", () => {controller?.abort(); sequence++; setBusy(false);});
})();
