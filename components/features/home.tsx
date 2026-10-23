"use client";

import Link from "next/link";
import { Callout, EmptyBlock, PageIntro, ReadinessFigure, SkillBoard, TrendChart, skillLabel } from "@/components/product/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { coverageBySkill, buildPlan } from "@/lib/model";
import { DAY_WORD, PATH_WORD, SKILL_WORD } from "@/lib/signals";
import { useApp } from "@/lib/store";
import type { Priority, TaskStatus } from "@/lib/types";
import { SKILLS } from "@/lib/types";
import { formatBand, formatNumber } from "@/lib/format";
import { cn } from "cn";

export function DashboardScreen() {
  const { bi, state, view } = useApp();
  if (!view) {
    return (
      <EmptyBlock
        title={bi("هنوز برآوردی نیست", "There is no estimate yet")}
        body={bi("هدف ذخیره شده است. گزارش و شاخص بعد از هر چهار مهارت ساخته می‌شوند.", "The goal is saved. The report and the index appear after all four skills.")}
        action={<Link href="/placement" className={cn(buttonVariants({ size: "lg" }), "h-11")}>{bi("شروع تعیین سطح", "Start the placement")}</Link>}
      />
    );
  }
  const locale = state.locale;
  const next = view.plan.tasks.find((task) => task.status !== "done" && task.status !== "skipped") ?? view.plan.tasks[0];
  const today = new Date().getDay();
  const todayTasks = view.plan.tasks.filter((task) => task.day === today);
  return (
    <div className="grid gap-5">
      <PageIntro
        eyebrow={view.source.fictional ? bi("سناریوی نمونه", "Sample scenario") : bi("برآورد همین مرورگر", "Estimate from this browser")}
        title={locale === "fa" ? view.source.person.fa : view.source.person.en}
        lede={locale === "fa" ? view.source.summary.fa : view.source.summary.en}
      />
      {view.bottleneck ? (
        <Callout tone="warning" title={bi("مهم‌ترین شکاف همین حالا", "The main gap right now")}>
          {bi(view.bottleneck.title.fa, view.bottleneck.title.en)} — {formatBand(view.bottleneck.gap, locale)} {bi("نمره تا حداقل این مهارت.", "below this skill's minimum.")}
          {view.readiness.score >= 70 ? bi(" شاخص می‌تواند بالا به نظر برسد در حالی که یک مهارت هنوز هدف را سد کرده است.", " The index can look high while one skill still blocks the target.") : ""}
        </Callout>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{bi("کلی فعلی به هدف", "Current overall toward the target")}</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums">{formatBand(view.overall, locale)} <span className="text-xl font-normal text-muted-foreground">→ {formatBand(view.source.targetOverall, locale)}</span></p>
          <p className="mt-2 text-sm">{bi("بازه", "Range")} {formatBand(view.range.low, locale)}–{formatBand(view.range.high, locale)} · {bi("اطمینان", "Confidence")} {formatNumber(view.source.confidence, locale)}</p>
          <p className="mt-1 text-sm">{view.daysLeft == null ? bi("تاریخ آزمون معلوم نیست.", "The exam date is unknown.") : bi(`${formatNumber(view.daysLeft, locale)} روز تا آزمون`, `${formatNumber(view.daysLeft, locale)} days to the exam`)}</p>
          {next ? (
            <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">{bi("پیشنهاد بعدی", "Next suggestion")}</p>
              <p className="mt-1">{bi(next.title.fa, next.title.en)} · {formatNumber(next.minutes, locale)} {bi("دقیقه", "min")}</p>
              <p className="text-muted-foreground">{bi(next.objective.fa, next.objective.en)}</p>
              <Link href="/plan" className="mt-2 inline-block text-primary underline-offset-4 hover:underline">{bi("جزئیات برنامه", "Plan details")}</Link>
            </div>
          ) : null}
        </div>
        <ReadinessFigure view={view} />
      </section>
      <SkillBoard view={view} />
      <section className="grid gap-4 lg:grid-cols-2">
        <TrendChart points={view.source.history} />
        <article className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{bi("امروز", "Today")}</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {todayTasks.length ? todayTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 border-b py-2">
                <span>{bi(task.title.fa, task.title.en)}</span>
                <span className="text-muted-foreground">{task.status}</span>
              </li>
            )) : <li>{bi("برای امروز فعالیتی چیده نشده. روزها را در برنامه می‌توانید عوض کنید.", "Nothing is scheduled today. You can move days in the plan.")}</li>}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">{bi("پایبندی", "Adherence")}: {formatNumber(view.source.adherence, locale)}%</p>
        </article>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{bi("امتیاز فعالیت", "Activity points")}</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatNumber(view.points, locale)}</p>
          <p className="mt-1 text-muted-foreground">{bi("فقط برای کار انجام‌شده: تعیین سطح، تمرین، فعالیت و آزمونک. رقابت با دیگران نیست.", "Only for finished work: placement, practice, tasks, and mocks. There is no comparison with other people.")}</p>
        </article>
        <article className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{bi("نشان‌ها", "Badges")}</h2>
          <ul className="mt-2 grid gap-1">
            {view.badges.map((badge) => <li key={badge.id}>{badge.earned ? "●" : "○"} {bi(badge.title.fa, badge.title.en)}</li>)}
          </ul>
        </article>
        <article className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{bi("زنجیره", "Streak")}</h2>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatNumber(view.source.streakDays, locale)}</p>
          <p className="text-muted-foreground">{bi("روز با فعالیت ثبت‌شده. اعلان انگیزشی را می‌توانید خاموش کنید.", "Days with logged activity. You can turn motivational notices off.")}</p>
        </article>
      </section>
    </div>
  );
}

export function RoadmapScreen() {
  const { bi, view } = useApp();
  if (!view) return <EmptyBlock title={bi("نقشه راه بعد از برآورد", "The roadmap waits for an estimate")} body={bi("اول تعیین سطح را تمام کنید.", "Finish the placement first.")} action={<Link href="/placement" className={buttonVariants()}>{bi("تعیین سطح", "Placement")}</Link>} />;
  return (
    <div>
      <PageIntro title={bi("نقشه راه", "Roadmap")} lede={bi("مرحله‌ها از نمره و تاریخ آزمون می‌آیند. اجرای روزانه در صفحه برنامه است.", "Stages come from the band and the exam date. Daily work lives on the plan page.")} />
      <ol className="grid gap-3">
        {view.plan.phases.map((phase) => {
          const tasks = view.plan.tasks.filter((task) => task.phase === phase.id);
          const current = tasks.length > 0 && (view.daysLeft != null && view.daysLeft <= 21 ? phase.id === 4 : phase.id === (view.source.bands.writing < 5.5 || view.overall < 5.5 ? 1 : 2));
          return (
            <li key={phase.id} className={cn("rounded-xl border bg-card p-4", current && "border-primary")}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{bi(phase.title.fa, phase.title.en)}</h2>
                {current ? <span className="text-xs text-primary">{bi("مرحله فعال", "Active stage")}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{bi(phase.detail.fa, phase.detail.en)}</p>
              <ul className="mt-3 grid gap-1 text-sm">
                {tasks.map((task) => <li key={task.id}>{skillLabel(task.skill, "fa")} · {bi(task.title.fa, task.title.en)}</li>)}
                {!tasks.length ? <li className="text-muted-foreground">{bi("در این مسیر فعالیتی برای این مرحله نمانده است.", "This path has no task left in this stage.")}</li> : null}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PlanScreen() {
  const { bi, state, view, setPlanPath, editTask, applyRebalance } = useApp();
  if (!view) return <EmptyBlock title={bi("برنامه هنوز نیست", "There is no plan yet")} body={bi("بعد از برآورد، فعالیت‌ها از شکاف مهارت‌ها ساخته می‌شوند.", "After an estimate, tasks are built from the skill gaps.")} />;
  const locale = state.locale;
  const baseline = buildPlan({
    bands: view.source.bands,
    targets: view.source.targetSkills,
    overall: view.overall,
    dailyMinutes: view.source.dailyMinutes,
    daysPerWeek: view.source.daysPerWeek,
    daysLeft: view.daysLeft,
    path: view.plan.path,
    edits: {},
    scope: view.source.id,
  });
  const before = coverageBySkill(baseline.tasks);
  const after = coverageBySkill(view.plan.tasks);
  const activeMinutes = view.plan.tasks.filter((task) => task.status !== "skipped").reduce((sum, task) => sum + task.minutes, 0);
  return (
    <div className="grid gap-5">
      <PageIntro
        title={bi("برنامه هفته", "This week")}
        lede={bi("هر تغییر، پوشش مهارت را همین‌جا عوض می‌کند. سیستم تطبیقی واقعی هنوز ساخته نشده و این قواعد نمونه است.", "Each change updates skill coverage here. A real adaptive system is not built yet. These are sample rules.")}
        actions={(["auto", "balanced", "bottleneck", "sprint"] as const).map((path) => (
          <Button key={path} size="sm" variant={state.planPath === path ? "default" : "outline"} onClick={() => setPlanPath(path)}>
            {bi(PATH_WORD[path].fa, PATH_WORD[path].en)}
          </Button>
        ))}
      />
      {view.source.adherence < 75 ? (
        <Callout tone="warning" title={bi("حجم برنامه از انجام‌شدن جلوتر است", "The plan is ahead of what got done")}>
          <p>{bi(`واقعیت موجود: پایبندی حدود ${view.source.adherence} درصد است. علت را از همین عدد نمی‌توان ثابت کرد.`, `Known fact: adherence is about ${view.source.adherence} percent. That number does not prove a cause.`)}</p>
          <p className="mt-1">{bi("فرض، نه واقعیت: شاید زمان روزانه خوش‌بینانه بوده باشد.", "Assumption, not a fact: the daily time may have been optimistic.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => applyRebalance("shrink")}>{bi("کوتاه کردن فعالیت‌های غیرفوری", "Shorten non-urgent tasks")}</Button>
            <Button size="sm" variant="outline" onClick={() => applyRebalance("drop-low")}>{bi("حذف اولویت پایین", "Drop low priority")}</Button>
          </div>
        </Callout>
      ) : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              {[bi("فعالیت", "Task"), bi("مهارت", "Skill"), bi("روز", "Day"), bi("دقیقه", "Min"), bi("اولویت", "Priority"), bi("وضعیت", "Status")].map((head) => <th key={head} className="px-3 py-2 text-start font-medium">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {view.plan.tasks.map((task) => (
              <tr key={task.id} className="border-t align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{bi(task.title.fa, task.title.en)}</p>
                  <p className="text-muted-foreground">{bi(task.objective.fa, task.objective.en)}</p>
                  <p className="mt-1 text-xs">{bi("موفقیت", "Success")}: {bi(task.success.fa, task.success.en)}</p>
                </td>
                <td className="px-3 py-3">{bi(SKILL_WORD[task.skill].fa, SKILL_WORD[task.skill].en)}</td>
                <td className="px-3 py-3">
                  <select className="h-9 rounded-md border bg-card px-2" value={task.day} aria-label={bi("روز", "Day")} onChange={(event) => editTask(task.id, { day: Number(event.target.value) })}>
                    {DAY_WORD[locale].map((name, day) => <option key={name} value={day}>{name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <Button size="icon-sm" variant="outline" aria-label={bi("کم کردن زمان", "Decrease time")} onClick={() => editTask(task.id, { minutes: Math.max(10, task.minutes - 5) })}>-</Button>
                    <span className="w-8 text-center tabular-nums">{task.minutes}</span>
                    <Button size="icon-sm" variant="outline" aria-label={bi("زیاد کردن زمان", "Increase time")} onClick={() => editTask(task.id, { minutes: Math.min(90, task.minutes + 5) })}>+</Button>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select className="h-9 rounded-md border bg-card px-2" value={task.priority} aria-label={bi("اولویت", "Priority")} onChange={(event) => editTask(task.id, { priority: event.target.value as Priority })}>
                    <option value="high">{bi("بالا", "High")}</option>
                    <option value="medium">{bi("متوسط", "Medium")}</option>
                    <option value="low">{bi("پایین", "Low")}</option>
                  </select>
                </td>
                <td className="px-3 py-3">
                  <select className="h-9 rounded-md border bg-card px-2" value={task.status} aria-label={bi("وضعیت", "Status")} onChange={(event) => editTask(task.id, { status: event.target.value as TaskStatus })}>
                    <option value="todo">{bi("انجام‌نشده", "To do")}</option>
                    <option value="doing">{bi("در حال انجام", "Doing")}</option>
                    <option value="done">{bi("انجام شد", "Done")}</option>
                    <option value="skipped">{bi("حذف از این هفته", "Skip this week")}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="rounded-xl border bg-card p-4 text-sm leading-6">
        <h2 className="font-semibold">{bi("اثر این ویرایش", "Effect of this edit")}</h2>
        <p className="mt-2">{bi(`حجم فعال این هفته ${formatNumber(activeMinutes, locale)} دقیقه است.`, `Active volume this week is ${formatNumber(activeMinutes, locale)} minutes.`)}</p>
        <ul className="mt-2 grid gap-1">
          {SKILLS.map((skill) => (
            <li key={skill}>
              {bi(SKILL_WORD[skill].fa, SKILL_WORD[skill].en)}: {formatNumber(before[skill], locale)} → {formatNumber(after[skill], locale)} {bi("دقیقه", "min")}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">
          {view.timePressure === "short"
            ? bi("حتی با این تغییر، ساعت تا آزمون از کف برآورد کمتر است. فایده حذف کار کم‌اولویت: برنامه قابل‌اجرا می‌ماند. هزینه: پوشش مهارت قوی‌تر کمتر می‌شود.", "Even after this change, hours before the exam stay under the low estimate. Dropping low-priority work keeps the plan doable. The cost is less cover for a stronger skill.")
            : bi("اگر مهارتی که عقب است دقیقه از دست بدهد، فاصله هدف دیرتر بسته می‌شود. این یک هشدار محاسباتی است، نه پیش‌بینی قطعی.", "If the trailing skill loses minutes, the target gap closes later. This is a calculation warning, not a certain forecast.")}
        </p>
      </section>
    </div>
  );
}
