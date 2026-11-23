// Home path. Chapter names come from the seeded catalogue. A saved study plan
// replaces the first open chapter. Per-user rows, when present, win over the seed.

const ORDER = ["lesson", "practice", "challenge", "review", "checkpoint"];

function openStates(nodes) {
  return nodes.map((node, index) => ({
    ...node,
    state: index === 0 ? "current" : "locked",
  }));
}

/**
 * @param {{ placementCompleted: boolean, plan: {chapterFrom: number, chapterTo: number}|null, chapters: Array<{key: string, titleFa: string, from: number, to: number, nodes: Array<{id: string, kind: string, premium: boolean, state: string}>}>, progress?: Record<string, string> }} input
 */
export function buildPath({ placementCompleted, plan, chapters, progress = {} }) {
  const byKey = new Map(chapters.map((chapter) => [chapter.key, chapter]));
  const apply = (chapter, states) => ({
    key: chapter.key,
    titleFa: chapter.titleFa,
    from: chapter.from,
    to: chapter.to,
    locked: false,
    nodes: states.map((node) => ({
      ...node,
      state: progress[node.id] ?? node.state,
    })),
  });
  if (plan && plan.chapterFrom != null && plan.chapterTo != null) {
    const start = byKey.get("c1") ?? chapters[0];
    const follow = byKey.get("c3") ?? chapters[chapters.length - 1];
    return {
      mode: "plan",
      chapters: [
        { ...apply(start, openStates(start.nodes)), from: Number(plan.chapterFrom), to: Number(plan.chapterTo), titleFa: null },
        { ...apply(follow, follow.nodes.map((node) => ({ ...node, state: "locked" }))), locked: true },
      ],
    };
  }
  if (!placementCompleted) {
    const start = byKey.get("c1") ?? chapters[0];
    return { mode: "start", chapters: [apply(start, openStates(start.nodes))] };
  }
  const current = byKey.get("c2") ?? chapters[0];
  const locked = byKey.get("c3");
  return {
    mode: "mid",
    chapters: [
      apply(current, current.nodes),
      ...(locked ? [{ ...apply(locked, locked.nodes.map((node) => ({ ...node, state: "locked" }))), locked: true }] : []),
    ],
  };
}

const SKILL = { lesson: "listening", practice: "reading", challenge: "writing", review: "speaking", checkpoint: "writing" };

/** Whether this learner may open the node. Checkpoint waits until the other chapter nodes are done. */
export function startDecision({ node, chapter, premium }) {
  if (!node || !chapter) return { ok: false, reason: "missing" };
  if (chapter.locked) return { ok: false, reason: "chapter" };
  const ready = chapter.nodes.filter((item) => item.kind !== "checkpoint").every((item) => item.state === "done");
  if (node.kind === "checkpoint" && !ready) return { ok: false, reason: "checkpoint" };
  if (node.state === "locked") return { ok: false, reason: "previous" };
  if (node.premium && !premium) return { ok: false, reason: "premium" };
  if (node.state !== "current" && node.state !== "done") return { ok: false, reason: "locked" };
  return { ok: true, lessonUrl: `/app/lessons/${node.id}`, skill: SKILL[node.kind] ?? "writing" };
}

/** Mark this node done and unlock the next node only when step 06 would let it start. */
export function completionStep(chapter, nodeId, premium) {
  const index = chapter.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return null;
  const nodes = chapter.nodes.map((node, place) => (place === index ? { ...node, state: "done" } : { ...node }));
  const following = nodes[index + 1];
  if (!following || chapter.locked) return { nodes, next: null };
  const ready = nodes.filter((node) => node.kind !== "checkpoint").every((node) => node.state === "done");
  const blocked = (following.kind === "checkpoint" && !ready) || (following.premium && !premium) || following.state === "done";
  if (!blocked) nodes[index + 1] = { ...following, state: "current" };
  const next = blocked ? following : nodes[index + 1];
  return {
    nodes,
    next: {
      id: next.id,
      kind: next.kind,
      skill: SKILL[next.kind] ?? "writing",
      titleFa: next.titleFa ?? "",
      premium: Boolean(next.premium),
      startable: !blocked,
    },
  };
}

export function groupNodes(rows) {
  const chapters = [];
  for (const row of rows) {
    let chapter = chapters.find((item) => item.key === row.chapter_key);
    if (!chapter) {
      chapter = {
        key: row.chapter_key,
        titleFa: row.title_fa,
        from: Number(row.band_from),
        to: Number(row.band_to),
        nodes: [],
      };
      chapters.push(chapter);
    }
    chapter.nodes.push({
      id: row.id,
      kind: row.kind,
      titleFa: row.node_title_fa,
      premium: row.premium,
      state: row.demo_state,
    });
  }
  for (const chapter of chapters) chapter.nodes.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return chapters;
}
