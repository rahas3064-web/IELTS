import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_APPLY } from "../services/lesson.js";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let t;
beforeAll(async () => { t = await createTestApp(); });
afterAll(() => t.close());

describe("lesson stage progress", () => {
  it("saves feedback and the apply count, then resumes the same stage", async () => {
    const device = t.client();
    await t.signUp(device, freshPhone());
    const frame = await device.request("GET", "/api/frame");
    const [current, locked] = frame.json.path.chapters[0].nodes;
    const closed = await device.request("GET", `/api/lessons/${locked.id}`);
    expect(closed.status).toBe(403);

    const opened = await device.request("GET", `/api/lessons/${current.id}`);
    expect(opened.status).toBe(200);
    expect(opened.json.stage).toBe("learn");

    const wrong = await device.request("PUT", `/api/lessons/${current.id}`, { body: { stage: "practice", practice: "example", applyText: "" } });
    expect(wrong.json.result).toBe("almost");
    expect(wrong.json.answer).toBe("topic");
    const right = await device.request("PUT", `/api/lessons/${current.id}`, { body: { stage: "practice", practice: "topic", applyText: "" } });
    expect(right.json.result).toBe("correct");

    const applied = await device.request("PUT", `/api/lessons/${current.id}`, { body: { stage: "apply", practice: "topic", applyText: SAMPLE_APPLY } });
    expect(applied.json.words).toBe(51);
    expect(applied.json.estimate).toBe("in_range");
    const review = await device.request("PUT", `/api/lessons/${current.id}`, { body: { stage: "review", practice: "topic", applyText: SAMPLE_APPLY } });
    expect(review.status).toBe(200);

    const again = await device.request("GET", `/api/lessons/${current.id}`);
    expect(again.json.stage).toBe("review");
    expect(again.json.words).toBe(51);
    expect(again.json.applyText).toBe(SAMPLE_APPLY);
  });

  it("completes a node once: streak, goal, and the header stay in step, and a repeat does not count again", async () => {
    const device = t.client();
    await t.signUp(device, freshPhone());
    const frame = await device.request("GET", "/api/frame");
    const [lesson, practice, challenge] = frame.json.path.chapters[0].nodes;
    await reachReview(device, lesson.id);
    const done = await device.request("POST", `/api/lessons/${lesson.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.json.streak.current).toBe(1);
    expect(done.json.continued).toBe(true);
    expect(done.json.goal).toEqual({ done: 1, total: 3 });
    expect(done.json.next).toMatchObject({ id: practice.id, startable: true });
    const home = await device.request("GET", "/api/frame");
    expect(home.json.streak.current).toBe(done.json.streak.current);
    expect(home.json.dailyGoal).toEqual(done.json.goal);
    expect(home.json.path.chapters[0].nodes[0].state).toBe("done");
    expect(home.json.path.chapters[0].nodes[1].state).toBe("current");

    const again = await device.request("POST", `/api/lessons/${lesson.id}/complete`);
    expect(again.json.continued).toBe(false);
    expect(again.json.goal).toEqual({ done: 1, total: 3 });
    expect((await device.request("GET", "/api/frame")).json.streak.current).toBe(1);

    await reachReview(device, practice.id);
    const second = await device.request("POST", `/api/lessons/${practice.id}/complete`);
    expect(second.json.goal).toEqual({ done: 2, total: 3 });
    expect(second.json.continued).toBe(false);
    expect(second.json.streak.current).toBe(1);
    expect(second.json.next).toMatchObject({ id: challenge.id, startable: false });
    const after = await device.request("GET", "/api/frame");
    expect(after.json.dailyGoal).toEqual(second.json.goal);
    expect(after.json.path.chapters[0].nodes[2].state).toBe("locked");

    t.clock.advance(24 * 3600);
    const later = await device.request("POST", `/api/lessons/${lesson.id}/complete`);
    expect(later.json.goal).toEqual({ done: 0, total: 3 });
    expect(later.json.streak.current).toBe(1);
    expect(later.json.continued).toBe(false);
    expect((await device.request("GET", "/api/frame")).json.dailyGoal).toEqual({ done: 0, total: 3 });
  });
});

async function reachReview(device, id) {
  await device.request("PUT", `/api/lessons/${id}`, { body: { stage: "practice", practice: "topic", applyText: "" } });
  await device.request("PUT", `/api/lessons/${id}`, { body: { stage: "apply", practice: "topic", applyText: "one" } });
  const review = await device.request("PUT", `/api/lessons/${id}`, { body: { stage: "review", practice: "topic", applyText: "one" } });
  expect(review.status).toBe(200);
}