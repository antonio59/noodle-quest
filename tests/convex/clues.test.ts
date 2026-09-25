// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { buildCluePrompt, cleanWordList, sanitiseClues } from "../../convex/model/clues";
import { setup, approvedPlayer as signedUp } from "./setup";

function claudeReply(payload: unknown, stopReason = "end_turn") {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "text", text: JSON.stringify(payload) }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function stubClaude(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("clue helpers", () => {
  test("cleanWordList normalises, dedupes and drops bad words", () => {
    expect(cleanWordList(["Beach", "beach!", "ab", "Grand-ma", "x".repeat(20)])).toEqual(["BEACH", "GRANDMA"]);
  });

  test("buildCluePrompt includes the theme and every word", () => {
    const prompt = buildCluePrompt(["BEACH", "PASTY"], "  Our Cornwall holiday ");
    expect(prompt).toContain("Theme: Our Cornwall holiday");
    expect(prompt).toContain("- BEACH\n- PASTY");
  });

  test("sanitiseClues keeps order and blanks leaky, long or missing clues", () => {
    const out = sanitiseClues(["BEACH", "PASTY", "SURF", "GRANDMA"], {
      clues: [
        { answer: "pasty", clue: "Cornish pastry" },
        { answer: "BEACH", clue: "Build a sandcastle on the b-e-a-c-h" },
        { answer: "SURF", clue: "x".repeat(200) },
      ],
    });
    expect(out).toEqual([
      { answer: "BEACH", clue: "" },
      { answer: "PASTY", clue: "Cornish pastry" },
      { answer: "SURF", clue: "" },
      { answer: "GRANDMA", clue: "" },
    ]);
  });
});

describe("clues.suggestClues", () => {
  test("reports unconfigured without an API key and doesn't call out", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = stubClaude({});
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const res = await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: ["beach"] });
    expect(res).toEqual({ status: "unconfigured", clues: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("denies bad sessions", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = stubClaude({});
    const t = setup();
    const res = await t.action(api.clues.suggestClues, { sessionToken: "bogus", words: ["beach"] });
    expect(res.status).toBe("denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("asks Claude for structured clues with a fallback and returns them in order", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = stubClaude(claudeReply({
      clues: [{ answer: "BEACH", clue: "Sandy spot for sandcastles" }, { answer: "PASTY", clue: "Cornish lunch in pastry" }],
    }));
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const res = await t.action(api.clues.suggestClues, {
      sessionToken: mum.sessionToken, words: ["beach", "Pasty"], theme: "Cornwall holiday",
    });
    expect(res).toEqual({
      status: "ok",
      clues: [{ answer: "BEACH", clue: "Sandy spot for sandcastles" }, { answer: "PASTY", clue: "Cornish lunch in pastry" }],
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain("/v1/messages");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("claude-opus-5");
    expect(body.fallbacks).toBe("default");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.messages[0].content).toContain("Theme: Cornwall holiday");
    expect(new Headers(init.headers).get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });

  test("a refusal or API error comes back as unavailable", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = setup();
    const mum = await signedUp(t, "Mum");

    stubClaude(claudeReply({ clues: [] }, "refusal"));
    expect((await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: ["beach"] })).status)
      .toBe("unavailable");

    stubClaude({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, 400);
    expect((await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: ["beach"] })).status)
      .toBe("unavailable");
  });

  test("only looks at a puzzle's worth of words, however many are sent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = stubClaude(claudeReply({ clues: [] }));
    const t = setup();
    const mum = await signedUp(t, "Mum");
    const flood = Array.from({ length: 10_000 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) % 26 | 0))}`);
    await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: flood });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const prompt: string = JSON.parse(String(init.body)).messages[0].content;
    expect(prompt.split("\n").filter(l => l.startsWith("- ")).length).toBeLessThanOrEqual(15);
  });

  test("rate-limits each player to 20 requests an hour", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    stubClaude(claudeReply({ clues: [] }));
    const t = setup();
    const mum = await signedUp(t, "Mum");
    for (let i = 0; i < 20; i++) {
      await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: ["beach"] });
    }
    const res = await t.action(api.clues.suggestClues, { sessionToken: mum.sessionToken, words: ["beach"] });
    expect(res.status).toBe("limited");
  });
});
