import { useState } from "react";
import { searchPetProducts, type RakutenProduct } from "@/lib/rakuten-pet.functions";

const categories = ["ドッグフード", "キャットフード", "ペットのおやつ", "ペット用食器"] as const;
type Category = typeof categories[number];

export function PetRakutenRecommendations() {
  const [selected, setSelected] = useState<Category | null>(null);
  const [products, setProducts] = useState<RakutenProduct[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const find = async (keyword: Category) => {
    if (loading) return;
    setSelected(keyword);
    setLoading(true);
    setProducts([]);
    setStatus("");
    try {
      const result = await searchPetProducts({ data: { keyword } });
      setProducts(result.products);
      setStatus(result.status);
    } catch { setStatus("network_error"); }
    finally { setLoading(false); }
  };
  return (
    <details className="mt-2 shrink-0 rounded-xl border border-foreground/30 bg-card/80 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-bold">🐾 楽天でペット用品を探す <span className="text-xs font-normal">(PR)</span></summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button key={category} type="button" disabled={loading} onClick={() => find(category)}
            className="rounded-full border border-foreground/40 bg-card px-3 py-1.5 text-xs disabled:opacity-50">
            {category}
          </button>
        ))}
      </div>
      {loading && <p className="mt-2 text-xs">検索中…</p>}
      {selected && !loading && products.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          {products.map((product) => (
            <li key={product.affiliateUrl}>
              <a className="flex min-w-0 items-center gap-2 rounded-lg border border-foreground/20 p-2 text-xs"
                href={product.affiliateUrl} target="_blank" rel="sponsored noopener noreferrer">
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="shrink-0">{product.price.toLocaleString("ja-JP")}円</span>
                <span className="shrink-0 font-bold">PR ↗</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {selected && !loading && products.length === 0 && status && (
        <p className="mt-2 text-xs text-muted-foreground">
          {status === "not_configured" ? "楽天連携は準備中です。" : "紹介商品を取得できませんでした。"}
        </p>
      )}
    </details>
  );
}
