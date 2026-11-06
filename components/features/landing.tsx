"use client";

import Link from "@/components/link";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowRight, Moon, Sun } from "lucide-react";
import {
  BrandLockup,
  Callout,
  ReadinessFigure,
  SkillBoard,
  SkillIcon,
  StateBadge,
  TrendChart,
} from "@/components/product/bits";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button, buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { formatBand, formatNumber, todayIso } from "@/lib/format";
import { buildView, sourceFromScenario, type LearnerView } from "@/lib/model";
import { TASK_TEMPLATES } from "@/lib/plan-templates";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import { FAQ, REASONS, SKILL_WORD } from "@/lib/signals";
import { useApp } from "@/lib/store";
import { SKILLS, type Skill } from "@/lib/types";
import { cn } from "cn";

const STEPS = [
  { fa: "هدف و زمان را کوتاه ثبت می‌کنید.", en: "You record the target and the time you actually have." },
  { fa: "یک تعیین سطح چهارمهارتی، سطح را از خوداظهاری جدا می‌کند.", en: "A four-skill placement separates level from self-report." },
  { fa: "گزارش، فاصله و میزان اطمینان را با هم نشان می‌دهد.", en: "The report shows the gap and the confidence together." },
  { fa: "برنامه را می‌توانید عوض کنید و اثرش را ببینید.", en: "You can change the plan and see the effect." },
];

const CAPABILITIES = [
  {
    title: { fa: "تعیین سطح کوتاه", en: "Short placement" },
    body: STEPS[1],
  },
  {
    title: { fa: "برنامه قابل‌ویرایش", en: "Editable plan" },
    body: STEPS[3],
  },
  {
    title: { fa: "آزمونک نامحدود نمایشی", en: "Unlimited demo mocks" },
    body: {
      fa: "آزمون کوتاه معادل آیلتس رسمی نیست.",
      en: "A short test is not the official IELTS.",
    },
  },
];

const COURSE_GROUPS = SKILLS.map((skill) => ({
  skill,
  tasks: TASK_TEMPLATES.filter((task) => task.skill === skill).slice(0, 2),
}));

const SAMPLE_IDS = ["A", "B", "C"] as const;

function sectionHref(id: string) {
  return `${import.meta.env.BASE_URL}#${id}`;
}

export function LandingPage() {
  const preview = useMemo(
    () => buildView(sourceFromScenario(SCENARIOS.B, null, todayIso()), { path: "auto", edits: {}, today: todayIso() }),
    [],
  );
  return (
    <div className="landing min-h-dvh">
      <LandingHeader />
      <main>
        <Hero preview={preview} />
        <CapabilityStrip />
        <HowItWorks />
        <Skills preview={preview} />
        <Courses />
        <Samples />
        <PlansBand />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}

function LandingHeader() {
  const { bi, state, setLocale } = useApp();
  const { theme, setTheme } = useTheme();
  return (
    <header className="landing-header">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/"><BrandLockup /></Link>
        <nav className="ms-4 hidden items-center gap-4 text-sm text-muted-foreground md:flex" aria-label={bi("عمومی", "Public")}>
          <a href={sectionHref("method")} className="hover:text-foreground">{bi("روش کار", "How it works")}</a>
          <a href={sectionHref("sample")} className="hover:text-foreground">{bi("نمونه گزارش", "Sample report")}</a>
          <Link href="/plans" className="hover:text-foreground">{bi("پلن‌ها", "Plans")}</Link>
          <a href={sectionHref("faq")} className="hover:text-foreground">{bi("پرسش‌ها", "FAQ")}</a>
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setLocale(state.locale === "fa" ? "en" : "fa")}>
            {state.locale === "fa" ? "EN" : "فا"}
          </Button>
          <Button variant="ghost" size="icon" aria-label={bi("تم", "Theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "hidden h-9 sm:inline-flex")}>{bi("ورود", "Log in")}</Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-9")}>{bi("شروع", "Start")}</Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ preview }: { preview: LearnerView }) {
  const { bi, state } = useApp();
  const Arrow = state.locale === "fa" ? ArrowLeft : ArrowRight;
  const person = state.locale === "fa" ? preview.source.person.fa : preview.source.person.en;
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 lg:min-h-[calc(100dvh-4.75rem)] lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
      <div className="landing-rise">
        <p className="text-sm font-medium text-primary">{bi(BRAND.tagline.fa, BRAND.tagline.en)}</p>
        <h1 className="mt-3 max-w-xl text-[2.15rem] font-semibold leading-[1.45] text-balance sm:text-5xl sm:leading-[1.4]">
          {bi("فاصله تا نمره هدف را با شواهد ببینید، نه با حدس.", "See the distance to your target with evidence, not with a guess.")}
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-base leading-8 text-muted-foreground">
          {bi(
            "سطح فعلی، شکاف هر مهارت و برنامه هفته در یک مسیر به هم وصل‌اند. تخمین‌ها غیررسمی‌اند. هیچ نمره یا زمان پیشرفتی تضمین نمی‌شود.",
            "Current level, the gap in each skill, and the week’s plan sit on one path. Estimates are unofficial. No score and no timeline is guaranteed.",
          )}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}>
            {bi("ساخت حساب نمایشی", "Create a demo account")}
            <Arrow className="size-4" aria-hidden />
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 bg-card px-4")}>
            {bi("ورود با داده نمونه", "Open the sample learner")}
          </Link>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{bi("رمز واقعی نمی‌خواهیم. پرداختی در کار نیست.", "We do not ask for a real password. There is no payment.")}</p>
      </div>
      <SampleSheet preview={preview} person={person} />
    </section>
  );
}

function SampleSheet({ preview, person }: { preview: LearnerView; person: string }) {
  const { bi, state } = useApp();
  return (
    <div id="sample" className="landing-hero-visual landing-rise" style={{ animationDelay: "90ms" }}>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs text-muted-foreground">{bi("پیش‌نمایش سناریوی نمونه", "Sample scenario preview")}</p>
          <p className="mt-1 text-lg font-semibold">{person}</p>
        </div>
        <p className="text-end">
          <span className="block text-xs text-muted-foreground">{bi("کلی", "Overall")}</span>
          <span className="exam-serif text-4xl font-semibold tabular-nums">{formatBand(preview.overall, state.locale)}</span>
          <span className="text-sm text-muted-foreground"> → {formatBand(preview.source.targetOverall, state.locale)}</span>
        </p>
      </div>
      <ReadinessFigure view={preview} />
      <p className="mt-3 px-1 text-sm leading-7 text-muted-foreground">
        {state.locale === "fa" ? preview.source.summary.fa : preview.source.summary.en}
      </p>
    </div>
  );
}

function CapabilityStrip() {
  const { bi } = useApp();
  return (
    <section className="border-y border-border/80">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="sr-only">{bi("قابلیت", "Capability")}</h2>
      <ul className="grid gap-0 md:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <li key={item.title.en} className="border-border py-6 md:px-5 md:first:ps-0 md:last:pe-0 md:[&:not(:first-child)]:border-s [&:not(:first-child)]:border-t md:[&:not(:first-child)]:border-t-0">
            <h3 className="text-base font-semibold">{bi(item.title.fa, item.title.en)}</h3>
            <p className="mt-2 text-pretty text-sm leading-7 text-muted-foreground">{bi(item.body.fa, item.body.en)}</p>
          </li>
        ))}
      </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { bi } = useApp();
  return (
    <section id="method" className="mx-auto max-w-6xl px-4 py-16">
      <SectionIntro title={bi("روش کار", "How it works")} />
      <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.en} className="landing-rise" style={{ animationDelay: `${index * 70}ms` }}>
            <span className="landing-step-index">{bi(String(index + 1), String(index + 1))}</span>
            <p className="mt-3 text-sm font-medium text-primary">{bi(`گام ${index + 1}`, `Step ${index + 1}`)}</p>
            <p className="mt-2 text-pretty text-sm leading-7">{bi(step.fa, step.en)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Skills({ preview }: { preview: LearnerView }) {
  const { bi } = useApp();
  return (
    <section className="border-y border-border/80 bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2">
        <div>
          <SectionIntro
            title={bi("چهار مهارت، یک گزارش", "Four skills, one report")}
            lede={bi(
              "شنیدن، خواندن، نوشتن و صحبت کردن رابط جدا دارند. نمره کلی فقط بعد از هر چهار مهارت ساخته می‌شود.",
              "Listening, reading, writing, and speaking each have their own screen. The overall appears only after all four.",
            )}
          />
          <div className="mt-6"><SkillBoard view={preview} /></div>
        </div>
        <div className="grid content-start gap-4">
          <TrendChart points={preview.source.history} />
          <Callout tone="warning" title={bi("آنچه این محصول قول نمی‌دهد", "What this product does not promise")}>
            {bi(
              "آزمون کوتاه معادل آیلتس رسمی نیست. بازخورد نوشتن قاعده‌محور است. صوت شنیدن مصنوعی است. شاخص آمادگی احتمال موفقیت نیست.",
              "A short test is not the official IELTS. Writing feedback is rule-based. Listening audio is synthetic. The readiness index is not a chance of success.",
            )}
          </Callout>
        </div>
      </div>
    </section>
  );
}

function Courses() {
  const { bi } = useApp();
  return (
    <section id="courses" className="mx-auto max-w-6xl px-4 py-16">
      <SectionIntro
        title={bi("مرکز تمرین", "Practice")}
        lede={bi("یک مسیر پیشنهادی و یک کتابخانه آزاد. سؤال‌ها آموزشی و غیررسمی‌اند.", "A suggested path and an open library. Items are educational and unofficial.")}
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {COURSE_GROUPS.map((group) => (
          <CourseCard key={group.skill} skill={group.skill} tasks={group.tasks} />
        ))}
      </div>
      <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-11 px-4")}>
        {bi("شروع", "Start")}
      </Link>
    </section>
  );
}

function CourseCard({
  skill,
  tasks,
}: {
  skill: Skill;
  tasks: typeof TASK_TEMPLATES;
}) {
  const { bi, state } = useApp();
  return (
    <article className="landing-course p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <SkillIcon skill={skill} className="size-4 text-primary" />
        {bi(SKILL_WORD[skill].fa, SKILL_WORD[skill].en)}
      </h3>
      <ul className="mt-4 grid gap-4">
        {tasks.map((task) => (
          <li key={task.id} className="border-t border-border pt-3">
            <p className="text-sm font-medium">{bi(task.title.fa, task.title.en)}</p>
            <p className="mt-1 text-pretty text-sm leading-7 text-muted-foreground">{bi(task.objective.fa, task.objective.en)}</p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {formatNumber(task.minutes, state.locale)} {bi("دقیقه", "min")}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Samples() {
  const { bi } = useApp();
  return (
    <section id="stories" className="border-y border-border/80 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <StateBadge state="simulated" />
        <div className="mt-3">
          <SectionIntro
            title={bi("سناریوهای نمونه", "Sample scenarios")}
            lede={bi("این داده یک کاربر واقعی نیست.", "This is not a real learner.")}
          />
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SAMPLE_IDS.map((id) => <ScenarioCard key={id} scenario={SCENARIOS[id]} />)}
        </div>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-6 h-11 bg-card px-4")}>
          {bi("ورود با داده نمونه", "Open the sample learner")}
        </Link>
      </div>
    </section>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const { bi, state } = useApp();
  return (
    <article className="landing-story flex h-full flex-col p-5">
      <p className="text-xs font-medium text-primary">
        {bi(scenario.city.fa, scenario.city.en)} · {bi(REASONS[scenario.reason].fa, REASONS[scenario.reason].en)}
      </p>
      <h3 className="mt-2 text-lg font-semibold">{bi(scenario.person.fa, scenario.person.en)}</h3>
      <p className="mt-2 text-pretty text-sm leading-7">{bi(scenario.summary.fa, scenario.summary.en)}</p>
      <p className="mt-4 text-xs text-muted-foreground">{bi("هدف کلی", "Overall target")}</p>
      <p className="exam-serif text-2xl font-semibold tabular-nums">{formatBand(scenario.targetOverall, state.locale)}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        {SKILLS.map((skill) => (
          <div key={skill} className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt>{bi(SKILL_WORD[skill].fa, SKILL_WORD[skill].en)}</dt>
            <dd className="tabular-nums">{formatBand(scenario.bands[skill], state.locale)}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function PlansBand() {
  const { bi } = useApp();
  return (
    <section className="landing-band">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold text-balance">{bi("پلن‌ها", "Plans")}</h2>
          <p className="mt-3 text-pretty text-base leading-8 opacity-90">
            {bi("نسخه اولیه رایگان است. این مقایسه فقط برای دیدن تجربه آینده است. دکمه خرید وجود ندارد.", "The first version is free. This comparison only previews a future offer. There is no buy button.")}
          </p>
          <p className="mt-2 text-sm leading-7 opacity-75">
            {bi("Pro یک برچسب محصول آینده است، نه چیزی که بتوان فعال کرد.", "Pro is a label for a future product, not something you can turn on.")}
          </p>
        </div>
        <Link href="/plans" className="landing-band-link">{bi("پلن‌ها", "Plans")}</Link>
      </div>
    </section>
  );
}

function Faq() {
  const { bi } = useApp();
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
      <SectionIntro title={bi("پرسش‌های متداول", "Common questions")} />
      <Accordion className="mt-6">
        {FAQ.map((item) => (
          <AccordionItem key={item.q.en} value={item.q.en}>
            <AccordionTrigger className="py-4 text-base hover:no-underline">{bi(item.q.fa, item.q.en)}</AccordionTrigger>
            <AccordionContent className="text-sm leading-7 text-muted-foreground">{bi(item.a.fa, item.a.en)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function SectionIntro({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-semibold leading-snug text-balance">{title}</h2>
      {lede ? <p className="mt-3 text-pretty text-base leading-8 text-muted-foreground">{lede}</p> : null}
    </div>
  );
}

function LandingFooter() {
  const { bi } = useApp();
  const pageLinks = [
    ["method", bi("روش کار", "How it works")],
    ["sample", bi("نمونه گزارش", "Sample report")],
    ["courses", bi("مرکز تمرین", "Practice")],
    ["stories", bi("سناریوهای نمونه", "Sample scenarios")],
    ["faq", bi("پرسش‌ها", "FAQ")],
  ] as const;
  return (
    <footer className="border-t border-border px-4 py-12">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <BrandLockup />
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{bi(BRAND.disclaimer.fa, BRAND.disclaimer.en)}</p>
        </div>
        <nav className="grid content-start gap-2 text-sm" aria-label={bi("عمومی", "Public")}>
          {pageLinks.map(([id, label]) => (
            <a key={id} href={sectionHref(id)} className="w-fit text-muted-foreground hover:text-foreground">{label}</a>
          ))}
          <Link href="/help" className="w-fit text-muted-foreground hover:text-foreground">{bi("راهنما", "Help")}</Link>
          <Link href="/plans" className="w-fit text-muted-foreground hover:text-foreground">{bi("پلن‌ها", "Plans")}</Link>
          <Link href="/login" className="w-fit text-muted-foreground hover:text-foreground">{bi("ورود", "Log in")}</Link>
        </nav>
      </div>
    </footer>
  );
}
