// Minimal shared types still needed by lib/questions.ts (read as text by server/bank.js
// until the server task removes it). The old learner-app state types were removed in Phase 0.

export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

export type ExamType = "academic" | "general";
export type Difficulty = "foundation" | "core" | "stretch";
export type PublishStatus = "draft" | "in_review" | "published" | "retired";

export type Bi = { fa: string; en: string };
