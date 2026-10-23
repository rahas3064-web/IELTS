"use client";

import Link from "@/components/link";
import { useMemo } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";
import { Callout, ReadinessFigure, SkillBoard, TrendChart } from "@/components/product/bits";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { todayIso } from "@/lib/format";
import { buildView, sourceFromScenario } from "@/lib/model";
import { SCENARIOS } from "@/lib/scenarios";
import { FAQ } from "@/lib/signals";
import { useApp } from "@/lib/store";
import { cn } from "cn";

const STEPS = [
  { fa: "هدف و زمان را کوتاه ثبت می‌کنید.", en: "You record the target and the time you actually have." },
  { fa: "یک تعیین سطح چهارمهارتی، سطح را از خوداظهاری جدا می‌کند.", en: "A four-skill placement separates level from self-report." },
  { fa: "گزارش، فاصله و میزان اطمینان را با هم نشان می‌دهد.", en: "The report shows the gap and the confidence together." },
  { fa: "برنامه را می‌توانید عوض کنید و اثرش را ببینید.", en: "You can change the plan and see the effect." },
];

export function LandingPage() {
  const { bi, state } = useApp();
  const preview = useMemo(
    () => buildView(sourceFromScenario(SCENARIOS.B, null, todayIso()), { path: "auto", edits: {}, today: todayIso() }),
    [],
  );
  const Arrow = state.locale === "fa" ? ArrowLeft : ArrowRight;
  return (
    <div className="landing-wash min-h-dvh">
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="text-sm font-medium text-primary">{bi("برای فارسی‌زبانانی که بدون معلم خصوصی آماده می‌شوند", "For Persian speakers preparing without a private tutor")}</p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.25] tracking-tight sm:text-5xl">
              {bi("فاصله تا نمره هدف را با شواهد ببینید، نه با حدس.", "See the distance to your target with evidence, not with a guess.")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
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
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-4")}>
                {bi("ورود با داده نمونه", "Open the sample learner")}
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{bi("رمز واقعی نمی‌خواهیم. پرداختی در کار نیست.", "We do not ask for a real password. There is no payment.")}</p>
          </div>
          <div id="sample" className="rounded-2xl border bg-card/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{bi("پیش‌نمایش سناریوی نمونه", "Sample scenario preview")}</p>
                <p className="font-medium">{state.locale === "fa" ? preview.source.person.fa : preview.source.person.en}</p>
              </div>
              <p className="text-end">
                <span className="block text-xs text-muted-foreground">{bi("کلی", "Overall")}</span>
                <span className="text-2xl font-semibold tabular-nums">{preview.overall.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground"> → {preview.source.targetOverall.toFixed(1)}</span>
              </p>
            </div>
            <ReadinessFigure view={preview} />
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {state.locale === "fa" ? preview.source.summary.fa : preview.source.summary.en}
            </p>
          </div>
        </section>

        <section id="method" className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="text-2xl font-semibold">{bi("روش کار", "How it works")}</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.en} className="rounded-xl border bg-card p-4">
                <span className="text-sm font-medium text-primary">{bi(`گام ${index + 1}`, `Step ${index + 1}`)}</span>
                <p className="mt-2 text-sm leading-6">{bi(step.fa, step.en)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">{bi("چهار مهارت، یک گزارش", "Four skills, one report")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {bi(
                "شنیدن، خواندن، نوشتن و صحبت کردن رابط جدا دارند. نمره کلی فقط بعد از هر چهار مهارت ساخته می‌شود.",
                "Listening, reading, writing, and speaking each have their own screen. The overall appears only after all four.",
              )}
            </p>
            <div className="mt-4"><SkillBoard view={preview} /></div>
          </div>
          <div className="grid gap-4">
            <TrendChart points={preview.source.history} />
            <Callout tone="warning" title={bi("آنچه این محصول قول نمی‌دهد", "What this product does not promise")}>
              {bi(
                "آزمون کوتاه معادل آیلتس رسمی نیست. بازخورد نوشتن قاعده‌محور است. صوت شنیدن مصنوعی است. شاخص آمادگی احتمال موفقیت نیست.",
                "A short test is not the official IELTS. Writing feedback is rule-based. Listening audio is synthetic. The readiness index is not a chance of success.",
              )}
            </Callout>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-2xl font-semibold">{bi("پرسش‌های متداول", "Common questions")}</h2>
          <Accordion className="mt-4">
            {FAQ.map((item) => (
              <AccordionItem key={item.q.en} value={item.q.en}>
                <AccordionTrigger>{bi(item.q.fa, item.q.en)}</AccordionTrigger>
                <AccordionContent>{bi(item.a.fa, item.a.en)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
