import { describe, expect, it } from "vitest";
import { parseBand, scoreResponse } from "./avalai.js";

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
