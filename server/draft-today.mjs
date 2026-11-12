// Drafts only. Does not publish. Safe to run again.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadDotEnv } from "./env-file.js";
import { openDb } from "./db.js";
import { ensureBandTables } from "./services/band-tables.js";

const MARK = "bandora-draft-2026-11-12";
const SCRIPT = "The Northside Tool Library is open on Tuesdays and Thursdays from four until seven. Members may borrow a drill for three days. The library does not lend ladders. New members register at the front desk with a photo card.";

loadDotEnv();
const db = await openDb({ databaseUrl: process.env.DATABASE_URL, env: process.env });
const already = await db.query("select 1 from content_items where explanation_en = $1 limit 1", [MARK]);
if (already.rows.length) {
  console.log(JSON.stringify({ drafted: false, reason: "already-present" }));
  await db.close();
  process.exit(0);
}

await ensureBandTables(db);
const types = [
  ["listening_form", "listening", "تکمیل فرم", "Form completion", "Complete the notes from the recording."],
  ["reading_tfng", "reading", "درست، نادرست، ذکر نشده", "True False Not Given", "Decide if the statement matches the passage."],
  ["writing_task2", "writing", "تسک ۲", "Task 2", "Write an essay in response to a point of view."],
  ["speaking_part2", "speaking", "بخش ۲", "Part 2", "Speak for up to two minutes after one minute of preparation."],
];
for (const row of types) {
  await db.query(
    `insert into question_types (key, skill, name_fa, name_en, official_description)
     values ($1, $2, $3, $4, $5) on conflict (key) do nothing`,
    row,
  );
}

const passage = await db.query(
  `insert into content_passages (skill, exam_type, title, body, word_count, status)
   values ('listening', 'academic', 'Northside Tool Library', $1, $2, 'in_review') returning id`,
  [SCRIPT, SCRIPT.split(/\s+/).length],
);

const mediaDir = path.resolve("data/content-media");
fs.mkdirSync(mediaDir, { recursive: true });
const wav = path.join(mediaDir, "northside-tool-library.wav");
const speech = spawnSync("powershell", [
  "-NoProfile",
  "-Command",
  `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${wav.replace(/'/g, "''")}'); $s.Speak('${SCRIPT.replace(/'/g, "''")}'); $s.Dispose()`,
], { encoding: "utf8" });
let audioId = null;
if (speech.status === 0 && fs.existsSync(wav) && fs.statSync(wav).size > 1000) {
  const bytes = fs.statSync(wav).size;
  const media = await db.query(
    `insert into media_assets (kind, storage_key, mime, duration_sec, bytes, transcript)
     values ('audio', $1, 'audio/wav', 40, $2, $3) returning id`,
    ["audio/northside-tool-library.wav", bytes, SCRIPT],
  );
  audioId = media.rows[0].id;
}

async function item(skill, questionType, prompt, correct, extra = {}) {
  const inserted = await db.query(
    `insert into content_items
       (skill, exam_type, question_type, stem, answer_key, explanation_en, status, is_free, source, passage_id, audio_id)
     values ($1, 'academic', $2, $3::jsonb, $4::jsonb, $5, 'in_review', true, 'human', $6, $7)
     returning id`,
    [
      skill,
      questionType,
      JSON.stringify({ prompt, ...extra }),
      correct ? JSON.stringify({ correct }) : null,
      MARK,
      skill === "listening" ? passage.rows[0].id : null,
      skill === "listening" ? audioId : null,
    ],
  );
  return inserted.rows[0].id;
}

const listening = [];
listening.push(await item("listening", "listening_form", "The library opens on which days?", "Tuesdays and Thursdays"));
listening.push(await item("listening", "listening_form", "What time does it close?", "seven"));
listening.push(await item("listening", "listening_form", "How long may a member keep a drill?", "three days"));
listening.push(await item("listening", "listening_form", "Where do new members register?", "the front desk"));

const readingPrompt = `${SCRIPT}\n\nStatement: `;
const reading = [];
reading.push(await item("reading", "reading_tfng", `${readingPrompt}The library is open every weekday.`, "False", { options: ["True", "False", "Not Given"] }));
reading.push(await item("reading", "reading_tfng", `${readingPrompt}Members can borrow a drill.`, "True", { options: ["True", "False", "Not Given"] }));
reading.push(await item("reading", "reading_tfng", `${readingPrompt}Ladders are available to borrow.`, "False", { options: ["True", "False", "Not Given"] }));
reading.push(await item("reading", "reading_tfng", `${readingPrompt}The library charges a fee for the photo card.`, "Not Given", { options: ["True", "False", "Not Given"] }));

const writing = await item(
  "writing",
  "writing_task2",
  "Some people think every neighbourhood should have a place where residents can borrow tools instead of buying them. To what extent do you agree or disagree? Write at least 250 words.",
  null,
);
const speaking = await item(
  "speaking",
  "speaking_part2",
  "Describe a useful object you borrowed from someone. You should say what it was, who you borrowed it from, what you used it for, and explain why it was useful. You have one minute to prepare, then speak for up to two minutes.",
  null,
);

const version = await db.query(
  `insert into placement_versions (exam_type, version_no, status) values ('academic', 1, 'in_review') returning id`,
);
const limits = { listening: 600, reading: 1080, writing: 720, speaking: 300 };
let sort = 0;
for (const [skill, ids] of [["listening", listening], ["reading", reading], ["writing", [writing]], ["speaking", [speaking]]]) {
  const section = await db.query(
    `insert into placement_sections (version_id, skill, time_limit_sec, sort) values ($1, $2, $3, $4) returning id`,
    [version.rows[0].id, skill, limits[skill], sort],
  );
  sort += 1;
  let itemSort = 0;
  for (const id of ids) {
    await db.query(
      "insert into placement_section_items (section_id, item_id, sort) values ($1, $2, $3)",
      [section.rows[0].id, id, itemSort],
    );
    itemSort += 1;
  }
}

async function practiceSet(skill, questionType, title, itemId) {
  const set = await db.query(
    `insert into practice_sets (kind, skill, exam_type, question_type, title_fa, title_en, est_minutes, is_free, status)
     values ('skill_set', $1, 'academic', $2, $3, $3, 15, true, 'in_review') returning id`,
    [skill, questionType, title],
  );
  await db.query("insert into practice_set_items (set_id, item_id) values ($1, $2)", [set.rows[0].id, itemId]);
}
await practiceSet("listening", "listening_form", "تمرین شنیداری: کتابخانه ابزار", listening[0]);
await practiceSet("reading", "reading_tfng", "تمرین خواندن: کتابخانه ابزار", reading[0]);
await practiceSet("writing", "writing_task2", "تمرین نوشتن: قرض گرفتن ابزار", writing);
await practiceSet("speaking", "speaking_part2", "تمرین صحبت: وسیله قرضی", speaking);

console.log(JSON.stringify({
  drafted: true,
  status: "in_review",
  published: false,
  audio: audioId ? "windows-speech-wav" : "missing",
  placementVersion: version.rows[0].id,
}));
await db.close();
