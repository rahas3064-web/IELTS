import { describe, expect, it } from "vitest";
import { assistantReply, countWords, parseBand, reviewInstruction, scoreResponse } from "./avalai.js";

describe("AvalAI scoring", () => {
  it("reads a half-band from a JSON reply", () => {
    expect(parseBand("```json\n{\"band\": 6.4}\n```")).toBe(6.5);
    expect(parseBand("no json")).toBeNull();
  });

  it("does not call the network when the response is empty", async () => {
    let called = false;
    const band = await scoreResponse({
      skill: "writing",
      tasks: [{ prompt: "Write", answer: "  " }],
      fetchImpl: async () => {
        called = true;
        return { ok: true };
      },
      env: { AVALAI_API_KEY: "test-key" },
    });
    expect(band).toBe(1);
    expect(called).toBe(false);
  });

  it("sends the response text and returns the model band", async () => {
    let body = "";
    const band = await scoreResponse({
      skill: "speaking",
      tasks: [{ prompt: "Why?", answer: "Because I practise every day." }],
      env: { AVALAI_API_KEY: "test-key", AVALAI_MODEL: "test-model" },
      fetchImpl: async (_url, init) => {
        body = String(init.body);
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: "{\"band\":7}" } }] }),
        };
      },
    });
    expect(band).toBe(7);
    expect(body).toContain("Because I practise every day.");
    expect(body).toContain("test-model");
    expect(body).not.toContain("test-key");
  });
});

describe("AvalAI assistant", () => {
  it("refuses to answer without a key instead of inventing a reply", async () => {
    await expect(assistantReply({ messages: [{ role: "user", content: "Hi" }], env: {} })).rejects.toMatchObject({ code: "missing_ai" });
  });

  it("sends the system prompt and history, and returns the model text with token counts", async () => {
    let sent;
    const result = await assistantReply({
      messages: [{ role: "user", content: "What is a collocation?" }],
      env: { AVALAI_API_KEY: "test-key", AVALAI_MODEL: "test-model" },
      fetchImpl: async (url, init) => {
        sent = { url, body: JSON.parse(String(init.body)) };
        return { ok: true, json: async () => ({ model: "test-model", usage: { prompt_tokens: 30, completion_tokens: 9 }, choices: [{ message: { content: " Words that go together. " } }] }) };
      },
    });
    expect(sent.url).toBe("https://api.avalai.ir/v1/chat/completions");
    expect(sent.body.model).toBe("test-model");
    expect(sent.body.messages[0].role).toBe("system");
    expect(sent.body.messages[1].content).toBe("What is a collocation?");
    expect(result).toEqual({ text: "Words that go together.", tokensIn: 30, tokensOut: 9, model: "test-model" });
  });

  it("treats an HTTP error or an empty reply as ai_failed", async () => {
    const env = { AVALAI_API_KEY: "test-key" };
    await expect(assistantReply({ messages: [], env, fetchImpl: async () => ({ ok: false }) })).rejects.toMatchObject({ code: "ai_failed" });
    await expect(assistantReply({ messages: [], env, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }) })).rejects.toMatchObject({ code: "ai_failed" });
  });

  it("builds a review prompt with word count, task and the learner's text", () => {
    const prompt = reviewInstruction({ taskType: "task1_general", text: "Dear Sir, I am writing to complain.", locale: "fa" });
    expect(prompt).toContain("General Training Writing Task 1");
    expect(prompt).toContain("Write all explanations in Persian");
    expect(prompt).toContain("Word count: 7 (minimum 150");
    expect(prompt).toContain("Dear Sir, I am writing to complain.");
    expect(countWords("  one two\nthree — ")).toBe(3);
  });
});
