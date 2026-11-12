import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "../test-support/http-app.js";
import { tehranMonthKey } from "../core/tehran-time.js";

const ESSAY = `Nowadays many people thinks that university education should be free for everyone. In my opinion,
this idea have both advantages and disadvantages, but I mostly agree with it because education is a right and
not a privilege. Firstly, free university help poor students to improve their life and get better jobs.`;

/** Records what the route sent and answers like the model would. */
const calls = [];
let fail = false;
async function fakeReply(input) {
  calls.push(input);
  if (fail) {
    const error = new Error("ai_failed");
    error.code = "ai_failed";
    throw error;
  }
  return { text: input.mode === "writing_review" ? "### Estimated band\nreview text" : "Direct answer.", tokensIn: 40, tokensOut: 12, model: "test-model" };
}

let t;
let noKey;
beforeAll(async () => {
  t = await createTestApp({ assistant: { reply: fakeReply, env: { AVALAI_API_KEY: "test-key" } } });
  noKey = await createTestApp({ assistant: { reply: fakeReply, env: {} } });
});
afterAll(async () => {
  await t.close();
  await noKey.close();
});

async function learner(app = t) {
  const device = app.client();
  const signed = await app.signUp(device, freshPhone());
  return { device, userId: signed.json.user.id };
}

const usedOf = async (app, userId) => Number((await app.db.query(
  "select used from ai_usage_counters where user_id = $1 and quota_key = 'assistant_messages'",
  [userId],
)).rows[0]?.used ?? 0);

describe("assistant API", () => {
  it("needs a session", async () => {
    const res = await t.client().request("GET", "/api/assistant/usage");
    expect(res.status).toBe(401);
  });

  it("reports the free monthly allowance", async () => {
    const { device } = await learner();
    const res = await device.request("GET", "/api/assistant/usage");
    expect(res.status).toBe(200);
    expect(res.json.tier).toBe("free");
    expect(res.json.aiReady).toBe(true);
    expect(res.json.usage).toMatchObject({ quotaKey: "assistant_messages", limit: 10, used: 0, remaining: 10 });
  });

  it("answers a question, stores the conversation and counts one use", async () => {
    calls.length = 0;
    const { device, userId } = await learner();
    const res = await device.request("POST", "/api/assistant/messages", { body: { content: "What is the difference between affect and effect?" } });
    expect(res.status).toBe(201);
    expect(res.json.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(res.json.messages[1].content).toBe("Direct answer.");
    expect(res.json.usage).toMatchObject({ limit: 10, used: 1, remaining: 9 });
    expect(calls[0].mode).toBe("chat");
    expect(calls[0].messages.at(-1)).toEqual({ role: "user", content: "What is the difference between affect and effect?" });
    expect(await usedOf(t, userId)).toBe(1);

    t.clock.advance(5);
    const follow = await device.request("POST", "/api/assistant/messages", {
      body: { conversationId: res.json.conversation.id, content: "Give me two examples." },
    });
    expect(follow.status).toBe(201);
    expect(calls[1].messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);

    const list = await device.request("GET", "/api/assistant/conversations");
    expect(list.json.conversations).toHaveLength(1);
    const thread = await device.request("GET", `/api/assistant/conversations/${res.json.conversation.id}`);
    expect(thread.json.messages).toHaveLength(4);
    const events = await t.db.query("select status, model, tokens_out from ai_usage_events where user_id = $1", [userId]);
    expect(events.rows.every((e) => e.status === "committed" && e.model === "test-model")).toBe(true);
  });

  it("reviews a writing submission with the review instructions and keeps the task", async () => {
    calls.length = 0;
    const { device } = await learner();
    const res = await device.request("POST", "/api/assistant/messages", {
      body: { kind: "writing_review", taskType: "task2", taskPrompt: "Should university be free?", content: ESSAY },
    });
    expect(res.status).toBe(201);
    expect(calls[0].mode).toBe("writing_review");
    const prompt = calls[0].messages.at(-1).content;
    expect(prompt).toContain("Mistakes and corrections");
    expect(prompt).toContain("Corrected version");
    expect(prompt).toContain("Should university be free?");
    expect(prompt).toContain("many people thinks");
    expect(res.json.messages[0]).toMatchObject({ kind: "writing_review", review: { taskType: "task2" } });
    expect(res.json.messages[0].review.wordCount).toBeGreaterThan(30);

    const thread = await device.request("GET", `/api/assistant/conversations/${res.json.conversation.id}`);
    expect(thread.json.messages[0].review.taskPrompt).toBe("Should university be free?");
  });

  it("rejects a review without a task type or with too little text", async () => {
    const { device } = await learner();
    const noTask = await device.request("POST", "/api/assistant/messages", { body: { kind: "writing_review", content: ESSAY } });
    expect(noTask.status).toBe(400);
    expect(noTask.json.error.details.field).toBe("taskType");
    const short = await device.request("POST", "/api/assistant/messages", {
      body: { kind: "writing_review", taskType: "task2", content: "Too short to review." },
    });
    expect(short.status).toBe(400);
    expect(short.json.error.details.field).toBe("content");
    const empty = await device.request("POST", "/api/assistant/messages", { body: { content: "   " } });
    expect(empty.status).toBe(400);
  });

  it("gives the unit back when the AI call fails", async () => {
    const { device, userId } = await learner();
    fail = true;
    try {
      const res = await device.request("POST", "/api/assistant/messages", { body: { content: "Hello?" } });
      expect(res.status).toBe(503);
      expect(res.json.error.code).toBe("assistant_unavailable");
    } finally {
      fail = false;
    }
    expect(await usedOf(t, userId)).toBe(0);
    expect((await device.request("GET", "/api/assistant/conversations")).json.conversations).toHaveLength(0);
  });

  it("stops at the monthly limit with quota_exhausted", async () => {
    const { device, userId } = await learner();
    await t.db.query(
      "insert into ai_usage_counters (user_id, quota_key, period, used) values ($1, 'assistant_messages', $2, 10)",
      [userId, tehranMonthKey(t.clock.now())],
    );
    const res = await device.request("POST", "/api/assistant/messages", { body: { content: "One more?" } });
    expect(res.status).toBe(402);
    expect(res.json.error.code).toBe("quota_exhausted");
    expect(res.json.error.details).toMatchObject({ limit: 10, remaining: 0, upgrade: "/app/subscription" });
  });

  it("does not let one learner read another learner's conversation", async () => {
    const owner = await learner();
    const created = await owner.device.request("POST", "/api/assistant/messages", { body: { content: "Mine" } });
    const other = await learner();
    const res = await other.device.request("GET", `/api/assistant/conversations/${created.json.conversation.id}`);
    expect(res.status).toBe(404);
    const del = await other.device.request("DELETE", `/api/assistant/conversations/${created.json.conversation.id}`);
    expect(del.status).toBe(404);
    expect((await owner.device.request("DELETE", `/api/assistant/conversations/${created.json.conversation.id}`)).status).toBe(200);
  });

  it("fails clearly, without using quota, when no AI key is configured", async () => {
    const { device, userId } = await learner(noKey);
    expect((await device.request("GET", "/api/assistant/usage")).json.aiReady).toBe(false);
    const res = await device.request("POST", "/api/assistant/messages", { body: { content: "Hi" } });
    expect(res.status).toBe(503);
    expect(res.json.error.code).toBe("assistant_unavailable");
    expect(res.json.error.details.reason).toBe("not_configured");
    expect(await usedOf(noKey, userId)).toBe(0);
  });
});
