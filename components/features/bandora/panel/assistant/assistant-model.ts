// Pure helpers for the assistant page: word counting (same rule as the server), task limits,
// and a small Markdown block parser for model replies (rendered as React elements, never HTML).

export type AssistantMode = "chat" | "writing_review";
export type TaskType = "task1_academic" | "task1_general" | "task2";

export const TASK_TYPES: readonly TaskType[] = ["task1_academic", "task1_general", "task2"];
/** IELTS minimum lengths per task. */
export const TASK_MIN_WORDS: Record<TaskType, number> = { task1_academic: 150, task1_general: 150, task2: 250 };
/** The server refuses a review below this many words. */
export const MIN_REVIEW_WORDS = 30;

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  kind: AssistantMode;
  review: { taskType: TaskType; taskPrompt: string | null; wordCount: number } | null;
};

export type AssistantConversation = { id: string; title: string; updatedAt: string };

export type AssistantUsage = { limit: number; used: number; remaining: number; resetsAt: string; period: string };

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export type Inline = { type: "text" | "strong" | "em" | "code"; text: string };
export type Block =
  | { type: "heading"; level: number; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { type: "code"; text: string }
  | { type: "rule" };

/** `**bold**`, `*em*` / `_em_`, and `code` spans; everything else is plain text. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ type: "text", text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith("**")) out.push({ type: "strong", text: token.slice(2, -2) });
    else if (token.startsWith("`")) out.push({ type: "code", text: token.slice(1, -1) });
    else out.push({ type: "em", text: token.slice(1, -1) });
    last = index + token.length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

/** Headings, bullet/numbered lists, fenced code, rules and paragraphs. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; start: number; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, start: list.start, items: list.items.map(parseInline) });
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1].length, inlines: parseInline(heading[2].replace(/\s*#+$/, "")) });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ type: "rule" });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, start: numbered ? Number(numbered[1]) : 1, items: [] };
      }
      list.items.push(numbered ? numbered[2] : bullet![1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return blocks;
}
