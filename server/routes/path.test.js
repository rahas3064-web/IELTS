import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, freshPhone } from "../test-support/http-app.js";

let t;
beforeAll(async () => { t = await createTestApp(); });
afterAll(() => t.close());

async function learner() {
  const device = t.client();
  const signed = await t.signUp(device, freshPhone());
  return { device, userId: signed.json.user.id };
}

describe("POST /api/path/nodes/:id/start", () => {
  it("starts the current free node and refuses locked, unpaid premium, and an early checkpoint", async () => {
    const { device, userId } = await learner();
    const frame = await device.request("GET", "/api/frame");
    const chapter = frame.json.path.chapters[0];
    const [current, locked, premiumNode, , checkpoint] = chapter.nodes;
    const started = await device.request("POST", `/api/path/nodes/${current.id}/start`);
    expect(started.status).toBe(200);
    expect(started.json.lessonUrl).toBe(`/app/lessons/${current.id}`);
    const blocked = await device.request("POST", `/api/path/nodes/${locked.id}/start`);
    expect(blocked.status).toBe(403);
    expect(blocked.json.error.details.reason).toBe("previous");

    await t.db.query("insert into path_node_progress (user_id, node_id, state) values ($1, $2, 'current')", [userId, premiumNode.id]);
    const unpaid = await device.request("POST", `/api/path/nodes/${premiumNode.id}/start`);
    expect(unpaid.status).toBe(403);
    expect(unpaid.json.error.details.reason).toBe("premium");

    await t.db.query("insert into path_node_progress (user_id, node_id, state) values ($1, $2, 'current')", [userId, checkpoint.id]);
    const early = await device.request("POST", `/api/path/nodes/${checkpoint.id}/start`);
    expect(early.status).toBe(403);
    expect(early.json.error.details.reason).toBe("checkpoint");

    await t.db.query(
      `insert into path_node_progress (user_id, node_id, state)
       select $1, id, case when id = $2 then 'current' else 'done' end from path_nodes where chapter_key = 'c1'
       on conflict (user_id, node_id) do update set state = excluded.state`,
      [userId, checkpoint.id],
    );
    const opened = await device.request("POST", `/api/path/nodes/${checkpoint.id}/start`);
    expect(opened.status).toBe(200);
  });
});
