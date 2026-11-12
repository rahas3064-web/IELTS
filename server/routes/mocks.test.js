import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "../test-support/http-app.js";
import { overallBand, writingBand } from "./mocks.js";

let t;
const scored = [];
beforeAll(async () => {
  t = await createTestApp({
    mocks: {
      score: async ({ skill, answer }) => {
        scored.push(skill);
        if (!String(answer).trim()) return null;
        return { band: skill === "writing" ? 6 : 7, criteria: {}, label: "AI estimate, not official" };
      },
    },
  });
});
afterAll(() => t.close());

async function learner({ premium = false } = {}) {
  const device = t.client();
  const signed = await t.signUp(device, freshPhone());
  const userId = signed.json.user.id;
  if (premium) {
    await t.db.query(
      `insert into subscriptions (user_id, plan_key, status, source, reason, started_at, ends_at)
       values ($1, 'premium_monthly', 'active', 'manual', 'test', now(), now() + interval '30 days')`,
      [userId],
    );
  }
  return { device, userId };
}

async function publishedMock(createdBy) {
  const qts = [["mock_l", "listening"], ["mock_r", "reading"], ["mock_w", "writing"], ["mock_s", "speaking"]];
  for (const [key, skill] of qts) {
    await t.db.query(
      `insert into question_types (key, skill, name_fa, name_en, official_description) values ($1, $2, 'x', 'x', 'x')
       on conflict (key) do nothing`,
      [key, skill],
    );
  }
  const mock = (await t.db.query(
    `insert into mocks (exam_type, title_fa, title_en, status, reviewed_at) values ('academic', 'ماک ۱', 'Mock 1', 'published', now()) returning id`,
  )).rows[0];
  const items = {};
  for (const [sort, [key, skill]] of qts.entries()) {
    const section = (await t.db.query(
      "insert into mock_sections (mock_id, skill, time_limit_sec, sort) values ($1, $2, 1800, $3) returning id",
      [mock.id, skill, sort],
    )).rows[0];
    items[skill] = [];
    const count = skill === "writing" ? 2 : skill === "speaking" ? 1 : 2;
    for (let i = 1; i <= count; i += 1) {
      const item = (await t.db.query(
        `insert into content_items (skill, exam_type, question_type, stem, answer_key, status, reviewed_at, created_by)
         values ($1, 'academic', $2, $3::jsonb, $4::jsonb, 'published', now(), $5) returning id`,
        [skill, key, JSON.stringify({ prompt: `${skill} ${i}` }), skill === "listening" || skill === "reading" ? JSON.stringify({ correct: "a" }) : null, createdBy],
      )).rows[0];
      await t.db.query("insert into mock_section_items (section_id, item_id, part_no, sort) values ($1, $2, $3, $4)", [section.id, item.id, i, i]);
      items[skill].push(item.id);
    }
  }
  return { mockId: mock.id, items };
}

describe("mock band rules", () => {
  it("weights Task 2 double and rounds the overall band like IELTS", () => {
    expect(writingBand([{ partNo: 1, band: 6 }, { partNo: 2, band: 7 }])).toBe(6.5);
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5);
    expect(overallBand([6, 6, 6, 6.5])).toBe(6);
    expect(overallBand([6, 6.5, 6.5, 6.5])).toBe(6.5);
    expect(overallBand([6, null, 6, 6])).toBeNull();
  });
});

describe("mock API", () => {
  it("lists mocks as locked for free learners and refuses to start one", async () => {
    const { device, userId } = await learner();
    const { mockId } = await publishedMock(userId);
    const list = await device.request("GET", "/api/mocks");
    expect(list.status).toBe(200);
    expect(list.json.enabled).toBe(false);
    expect(list.json.mocks.find((m) => m.id === mockId).locked).toBe(true);
    const refused = await device.request("POST", `/api/mocks/${mockId}/attempts`);
    expect(refused.status).toBe(403);
    expect(refused.json.error.details).toMatchObject({ upgrade: "/app/subscription", reason: "premium_mock" });
  });

  it("runs a full mock for premium: marks L/R, AI-scores W/S, gives an overall band and uses one mock", async () => {
    const { device, userId } = await learner({ premium: true });
    const { mockId, items } = await publishedMock(userId);
    const started = await device.request("POST", `/api/mocks/${mockId}/attempts`);
    expect(started.status).toBe(201);
    const id = started.json.attemptId;
    const quota = await device.request("GET", "/api/mocks");
    expect(quota.json.quota).toMatchObject({ quotaKey: "full_mock", limit: 4, used: 1 });

    for (const skill of ["listening", "reading", "writing", "speaking"]) {
      expect((await device.request("POST", `/api/mock-attempts/${id}/sections/${skill}/start`)).status).toBe(200);
      const paper = await device.request("GET", `/api/mock-attempts/${id}/sections/${skill}`);
      expect(paper.json.items[0].answerKey).toBeUndefined();
      for (const itemId of items[skill]) {
        const value = skill === "listening" || skill === "reading" ? (itemId === items[skill][0] ? "A" : "b") : "My answer to the task.";
        expect((await device.request("PUT", `/api/mock-attempts/${id}/sections/${skill}/answers`, { body: { itemId, value } })).status).toBe(200);
      }
      const done = await device.request("POST", `/api/mock-attempts/${id}/sections/${skill}/complete`);
      expect(done.status).toBe(200);
      if (skill === "listening") expect(done.json).toMatchObject({ raw: 1, max: 2 });
      if (skill === "writing") expect(done.json.band).toBe(6);
    }
    const result = await device.request("GET", `/api/mock-attempts/${id}`);
    expect(result.json.status).toBe("completed");
    expect(result.json.sections.every((s) => s.status === "completed")).toBe(true);
    expect(result.json.overallBand).not.toBeNull();

    const again = await device.request("POST", `/api/mocks/${mockId}/attempts`);
    expect(again.json).toMatchObject({ attemptId: id, resumed: true });
  });

  it("does not show another learner's attempt", async () => {
    const owner = await learner({ premium: true });
    const { mockId } = await publishedMock(owner.userId);
    const started = await owner.device.request("POST", `/api/mocks/${mockId}/attempts`);
    const other = await learner({ premium: true });
    expect((await other.device.request("GET", `/api/mock-attempts/${started.json.attemptId}`)).status).toBe(404);
  });
});
