"use client";

import type { ReactNode } from "react";
import { BookOpen, Headphones, Mic, PenLine, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBand, formatNumber } from "@/lib/format";
import type { HistoryPoint, LearnerView } from "@/lib/model";
import { SKILL_WORD } from "@/lib/signals";
import { useApp } from "@/lib/store";
import type { Locale, Skill } from "@/lib/types";
import { SKILLS } from "@/lib/types";
import { cn } from "cn";

export const PRODUCT_NAME = "IELTS Readiness";

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-4">
        <path d="M4 16h3V8H4v8Zm5 0h3V5H9v11Zm5 0h3v-6h-3v6Zm5 0h2V4h-2v12Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandLockup() {
  const { bi } = useApp();
  return (
    <span className="flex items-center gap-2">
      <Mark />
      <span className="leading-tight">
        <span className="block text-sm font-semibold">{bi("آمادگی آیلتس", "IELTS Readiness")}</span>
        <span className="block text-[11px] text-muted-foreground">{bi("نام موقت", "Temporary name")}</span>
      </span>
    </span>
  );
}

const ICONS: Record<Skill, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpen,
  writing: PenLine,
  speaking: Mic,
};

export function SkillIcon({ skill, className }: { skill: Skill; className?: string }) {
  const Icon = ICONS[skill];
  return <Icon className={className} aria-hidden />;
}

export function skillLabel(skill: Skill, locale: Locale) {
  return SKILL_WORD[skill][locale];
}

export function PageIntro({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-1 text-xs font-medium text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {lede ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function StateBadge({ state }: { state: "live" | "simulated" | "planned" }) {
  const { bi } = useApp();
  const label = state === "live" ? bi("در پروتوتایپ محاسبه می‌شود", "Calculated in the prototype") : state === "simulated" ? bi("نمایشی", "Simulated") : bi("برنامه‌ریزی‌شده", "Planned");
  const variant = state === "live" ? "secondary" : state === "simulated" ? "outline" : "ghost";
  return <Badge variant={variant}>{label}</Badge>;
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success";
  title: string;
  children: ReactNode;
}) {
  const toneClass = tone === "warning" ? "border-warning/40 bg-warning/10" : tone === "success" ? "border-success/40 bg-success/10" : "border-info/30 bg-info/10";
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", toneClass)} role={tone === "warning" ? "status" : undefined}>
      <p className="flex items-center gap-2 font-medium">
        {tone === "warning" ? <TriangleAlert className="size-4" aria-hidden /> : null}
        {title}
      </p>
      <div className="mt-1 leading-6 text-foreground/80">{children}</div>
    </div>
  );
}

export function EmptyBlock({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-5 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Meter({ label, value, max = 9, hint }: { label: string; value: number; max?: number; hint?: string }) {
  const width = Math.max(4, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="tabular-nums font-medium">{hint ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function SkillBoard({ view }: { view: LearnerView }) {
  const { state } = useApp();
  const locale = state.locale;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SKILLS.map((skill) => {
        const gap = Math.max(0, view.source.targetSkills[skill] - view.source.bands[skill]);
        return (
          <div key={skill} className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <SkillIcon skill={skill} className="size-4 text-primary" />
              <h3 className="font-medium">{skillLabel(skill, locale)}</h3>
              <span className="ms-auto text-xs text-muted-foreground">
                {locale === "fa" ? "اطمینان" : "Confidence"} {formatNumber(view.source.confidenceBySkill[skill], locale)}
              </span>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatBand(view.source.bands[skill], locale)}
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                → {formatBand(view.source.targetSkills[skill], locale)}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {gap === 0
                ? locale === "fa" ? "به حداقل این مهارت رسیده است." : "At this skill's minimum."
                : locale === "fa"
                  ? `${formatBand(gap, locale)} نمره تا حداقل همین مهارت`
                  : `${formatBand(gap, locale)} below this skill's minimum`}
            </p>
            <div className="mt-3">
              <Meter label={skillLabel(skill, locale)} value={view.source.bands[skill]} hint={formatBand(view.source.bands[skill], locale)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ReadinessFigure({ view }: { view: LearnerView }) {
  const { bi, state } = useApp();
  const locale = state.locale;
  const score = view.readiness.score;
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  const labels: Record<string, string> = {
    skills: bi("فاصله مهارت‌ها", "Skill gaps"),
    stability: bi("ثبات آزمون‌ها", "Result stability"),
    trend: bi("روند", "Trend"),
    adherence: bi("پایبندی", "Adherence"),
    confidence: bi("اطمینان داده", "Data confidence"),
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="size-24 shrink-0" role="img" aria-label={bi(`شاخص آمادگی ${score} از ۱۰۰`, `Readiness ${score} of 100`)}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="66" textAnchor="middle" fill="currentColor" fontSize="22" fontWeight="600">
            {formatNumber(score, locale)}
          </text>
        </svg>
        <div>
          <h2 className="font-semibold">{bi("شاخص آمادگی از ۱۰۰", "Readiness out of 100")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {bi("این شاخص احتمال قبولی در آزمون رسمی نیست.", "This index is not a probability of passing the official test.")}
          </p>
        </div>
      </div>
      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">{bi("اجزای شاخص آمادگی", "Readiness components")}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 text-start font-medium">{bi("جزء", "Part")}</th>
            <th className="py-1 text-end font-medium">{bi("وزن", "Weight")}</th>
            <th className="py-1 text-end font-medium">{bi("نمره جزء", "Part score")}</th>
          </tr>
        </thead>
        <tbody>
          {view.readiness.parts.map((part) => (
            <tr key={part.id} className="border-t">
              <td className="py-1.5">{labels[part.id]}</td>
              <td className="py-1.5 text-end tabular-nums">{formatNumber(part.weight * 100, locale)}{locale === "fa" ? "٪" : "%"}</td>
              <td className="py-1.5 text-end tabular-nums">{formatNumber(Math.round(part.score), locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrendChart({ points }: { points: HistoryPoint[] }) {
  const { bi, state } = useApp();
  const locale = state.locale;
  const width = 360;
  const height = 140;
  const pad = 18;
  const values = points.map((point) => point.overall);
  const min = Math.min(4, ...values);
  const max = Math.max(8, ...values);
  const coords = points.map((point, index) => {
    const x = pad + (points.length === 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
    const y = height - pad - ((point.overall - min) / (max - min)) * (height - pad * 2);
    return { x, y, point };
  });
  const line = coords.map((item) => `${item.x},${item.y}`).join(" ");
  return (
    <figure className="rounded-xl border bg-card p-4">
      <figcaption className="mb-2 text-sm font-medium">{bi("روند نمره کلی", "Overall trend")}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-primary" role="img" aria-label={bi("نمودار روند نمره کلی", "Overall band trend chart")}>
        <polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={line} />
        {coords.map((item) => (
          <circle key={item.point.date} cx={item.x} cy={item.y} r="3.5" fill="currentColor" />
        ))}
      </svg>
      <table className="sr-only">
        <caption>{bi("جدول روند", "Trend table")}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              <td>{formatBand(point.overall, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function inputClass(invalid = false) {
  return cn(
    "h-11 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
    invalid ? "border-destructive" : "border-input",
  );
}
