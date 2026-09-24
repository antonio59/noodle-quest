// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, approvedPlayer as signedUp } from "./setup";

function giphyItem(id: string, host = "media0.giphy.com") {
  return {
    id,
    title: `gif ${id}`,
    images: {
      fixed_width: { url: `https://${host}/media/${id}/200w.gif`, width: "200", height: "150" },
      fixed_width_small: { url: `https://${host}/media/${id}/100w.gif` },
    },
  };
}

function stubGiphy(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestedUrl(fetchMock: ReturnType<typeof stubGiphy>): URL {
  return new URL(String(fetchMock.mock.calls[0][0]));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("gifs.search", () => {
  test("rejects an invalid session without calling Giphy", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    const fetchMock = stubGiphy({ data: [] });
    const t = setup();
    const res = await t.action(api.gifs.search, { sessionToken: "bogus" });
    expect(res).toEqual({ status: "denied", items: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("denies kid-mode players", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    const fetchMock = stubGiphy({ data: [] });
    const t = setup();
    const kid = await signedUp(t, "Kid");
    await t.run(async ctx => ctx.db.patch(kid.playerId, { kidMode: true }));
    const res = await t.action(api.gifs.search, { sessionToken: kid.sessionToken });
    expect(res.status).toBe("denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("reports unconfigured when GIPHY_API_KEY is missing", async () => {
    vi.stubEnv("GIPHY_API_KEY", "");
    const fetchMock = stubGiphy({ data: [] });
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const res = await t.action(api.gifs.search, { sessionToken: alice.sessionToken });
    expect(res).toEqual({ status: "unconfigured", items: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("loads G-rated trending GIFs when the query is blank", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    const fetchMock = stubGiphy({ data: [giphyItem("a"), giphyItem("b")] });
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const res = await t.action(api.gifs.search, { sessionToken: alice.sessionToken, query: "   " });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/v1/gifs/trending");
    expect(url.searchParams.get("rating")).toBe("g");
    expect(url.searchParams.has("q")).toBe(false);
    expect(res.status).toBe("ok");
    expect(res.items.map(i => i.id)).toEqual(["a", "b"]);
    expect(res.items[0]).toEqual({
      id: "a",
      title: "gif a",
      preview: "https://media0.giphy.com/media/a/100w.gif",
      url: "https://media0.giphy.com/media/a/200w.gif",
      width: 200,
      height: 150,
    });
  });

  test("searches with a trimmed, length-capped query", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    const fetchMock = stubGiphy({ data: [giphyItem("c")] });
    const t = setup();
    const alice = await signedUp(t, "Alice");
    await t.action(api.gifs.search, { sessionToken: alice.sessionToken, query: `  high five${"!".repeat(100)}` });

    const url = requestedUrl(fetchMock);
    expect(url.pathname).toBe("/v1/gifs/search");
    expect(url.searchParams.get("q")?.startsWith("high five")).toBe(true);
    expect(url.searchParams.get("q")!.length).toBeLessThanOrEqual(50);
    expect(url.searchParams.get("rating")).toBe("g");
  });

  test("drops results that createPost would reject", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    stubGiphy({ data: [giphyItem("ok"), giphyItem("evil", "evil.example.com"), { id: "broken" }] });
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const res = await t.action(api.gifs.search, { sessionToken: alice.sessionToken, query: "cats" });
    expect(res.items.map(i => i.id)).toEqual(["ok"]);
  });

  test("reports unavailable when Giphy errors", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubGiphy({ message: "Rate limit exceeded" }, 429);
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const res = await t.action(api.gifs.search, { sessionToken: alice.sessionToken, query: "cats" });
    expect(res).toEqual({ status: "unavailable", items: [] });
  });

  test("picked GIFs can be posted to chat", async () => {
    vi.stubEnv("GIPHY_API_KEY", "test-key");
    stubGiphy({ data: [giphyItem("post-me")] });
    const t = setup();
    const alice = await signedUp(t, "Alice");
    const { items } = await t.action(api.gifs.search, { sessionToken: alice.sessionToken, query: "yay" });
    const post = await t.mutation(api.feed.createPost, {
      sessionToken: alice.sessionToken, type: "gif_url", content: items[0].url,
    });
    expect(post.postId).toBeDefined();
  });
});
