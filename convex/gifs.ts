import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";
import { isAllowedGiphyUrl } from "./model/giphy";

/**
 * GIF search for chat, proxied through Convex so the Giphy key never ships
 * in the browser bundle and a hosting move can't silently drop it.
 *
 * Required env var on the Convex deployment (dashboard → Settings →
 * Environment Variables, NOT Cloudflare Pages):
 *   GIPHY_API_KEY — from developers.giphy.com (an "API" app, not "SDK")
 *
 * If it's missing the picker says GIFs aren't set up; chat still works.
 */

const GIPHY_API = "https://api.giphy.com/v1/gifs";
const RESULT_LIMIT = 24;
const MAX_QUERY_LENGTH = 50;
// Family site: all-ages results only.
const RATING = "g";

export interface GifItem {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
}

export type GifSearchStatus = "ok" | "unconfigured" | "unavailable" | "denied";

export interface GifSearchResult {
  status: GifSearchStatus;
  items: GifItem[];
}

interface GiphyImage { url?: unknown; width?: unknown; height?: unknown }
interface GiphyGif {
  id?: unknown;
  title?: unknown;
  images?: { fixed_width?: GiphyImage; fixed_width_small?: GiphyImage; downsized_medium?: GiphyImage };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toGifItem(raw: GiphyGif): GifItem | null {
  const images = raw.images ?? {};
  const url = asString(images.fixed_width?.url) || asString(images.downsized_medium?.url);
  const preview = asString(images.fixed_width_small?.url) || url;
  const id = asString(raw.id);
  // Only offer GIFs that createPost will accept, so a pick never bounces.
  if (!id || !isAllowedGiphyUrl(url) || !isAllowedGiphyUrl(preview)) return null;
  return {
    id,
    title: asString(raw.title),
    preview,
    url,
    width: Number(images.fixed_width?.width) || 200,
    height: Number(images.fixed_width?.height) || 200,
  };
}

function parseGiphyResponse(body: unknown): GifItem[] {
  const data = (body as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map(g => toGifItem((g ?? {}) as GiphyGif))
    .filter((g): g is GifItem => g !== null);
}

export const canSearchGifs = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const player = await playerFromSession(ctx, args.sessionToken);
    // Kid mode keeps chat activity-only, so no GIF search either.
    return !!player && !player.kidMode;
  },
});

export const search = action({
  args: { sessionToken: v.string(), query: v.optional(v.string()) },
  handler: async (ctx, args): Promise<GifSearchResult> => {
    const allowed = await ctx.runQuery(internal.gifs.canSearchGifs, { sessionToken: args.sessionToken });
    if (!allowed) return { status: "denied", items: [] };

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) return { status: "unconfigured", items: [] };

    const query = (args.query ?? "").trim().slice(0, MAX_QUERY_LENGTH);
    const params = new URLSearchParams({ api_key: apiKey, limit: String(RESULT_LIMIT), rating: RATING });
    if (query) params.set("q", query);
    const endpoint = `${GIPHY_API}/${query ? "search" : "trending"}?${params}`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        console.error(`gifs.search: Giphy responded ${res.status}`);
        return { status: "unavailable", items: [] };
      }
      return { status: "ok", items: parseGiphyResponse(await res.json()) };
    } catch (err) {
      console.error("gifs.search: request to Giphy failed", err);
      return { status: "unavailable", items: [] };
    }
  },
});
