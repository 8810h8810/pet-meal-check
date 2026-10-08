import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ keyword: z.enum(["ドッグフード", "キャットフード", "ペットのおやつ", "ペット用食器", "ペットベッド", "リード", "ペット用おもちゃ", "ペットシーツ", "うんち袋", "消臭スプレー", "ペットブラシ"]) });
const endpoint = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701";
export type RakutenProduct = { name: string; price: number; affiliateUrl: string };
type Item = { itemName?: string; itemPrice?: number; affiliateUrl?: string };

export const searchPetProducts = createServerFn({ method: "GET" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const { RAKUTEN_APPLICATION_ID: applicationId, RAKUTEN_ACCESS_KEY: accessKey, RAKUTEN_AFFILIATE_ID: affiliateId, RAKUTEN_SITE_URL: siteUrl } = process.env;
    if (!applicationId || !accessKey || !affiliateId || !siteUrl) return { products: [] as RakutenProduct[], status: "not_configured" };
    try {
      const site = new URL(siteUrl);
      if (site.protocol !== "https:") return { products: [] as RakutenProduct[], status: "not_configured" };
      const params = new URLSearchParams({ applicationId, affiliateId, keyword: data.keyword, format: "json", formatVersion: "2", hits: "20" });
      const response = await fetch(`${endpoint}?${params}`, {
        headers: { accessKey, Origin: site.origin, Referer: site.origin + "/" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return { products: [] as RakutenProduct[], status: "api_error" };
      const payload: unknown = await response.json();
      const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const entries = Array.isArray(root.items) ? root.items : Array.isArray(root.Items) ? root.Items : [];
      const products = entries.map((entry: unknown) => {
        if (!entry || typeof entry !== "object") return null;
        const raw = entry as Record<string, unknown>;
        return (raw.Item && typeof raw.Item === "object" ? raw.Item : raw) as Item;
      }).filter((item): item is Item => !!item)
        .filter((item) => typeof item.itemName === "string" && typeof item.itemPrice === "number" && typeof item.affiliateUrl === "string")
        .filter((item) => {
          try {
            const u = new URL(item.affiliateUrl!);
            return u.protocol === "https:" && (u.hostname === "a.r10.to" || u.hostname === "hb.afl.rakuten.co.jp" || u.hostname === "rakuten.co.jp" || u.hostname.endsWith(".rakuten.co.jp"));
          } catch { return false; }
        })
        .map((item) => ({ name: item.itemName!, price: item.itemPrice!, affiliateUrl: item.affiliateUrl! }))
        .filter((item) => !/ふるさと納税|返礼品|寄附金|寄付金/.test(item.name))
        .sort((a, b) => a.price - b.price)
        .slice(0, 5);
      return { products, status: products.length ? "ok" : "no_products" };
    } catch {
      return { products: [] as RakutenProduct[], status: "network_error" };
    }
  });
