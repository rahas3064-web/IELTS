import { useEffect, useState } from "react";
import { streakStep, usePrefersReducedMotion } from "@/components/features/bandora/use-bandora-motion";
import { useParams } from "react-router-dom";
import Link from "@/components/link";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";
import { CardSkeleton } from "@/components/features/bandora/panel/ui/states";

type Done = {
  titleFa: string;
  minuteMin: number;
  minuteMax: number;
  streak: { current: number };
  continued: boolean;
  goal: { done: number; total: number };
  next: { id: string; kind: string; skill: string; titleFa: string; startable: boolean } | null;
};

/** Finished lesson. The numbers match the header, because both read the same completion. */
export function LessonDonePage() {
  const { nodeId = "" } = useParams();
  const { refetch } = useFrame();
  const i18n = useT();
  const { t, digits } = i18n;
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduce = usePrefersReducedMotion();
  const step = streakStep(done?.streak.current ?? 0, done?.continued ?? false, reduce);
  const [count, setCount] = useState(step.from);
  const goalPct = done ? (done.goal.done / done.goal.total) * 100 : 0;
  const [bar, setBar] = useState(0);

  useEffect(() => {
    let live = true;
    api.post<Done>(`/api/lessons/${nodeId}/complete`).then(async (body) => {
      await refetch();
      if (live) setDone(body);
    }).catch((caught) => { if (live) setError(errorText(caught, i18n)); });
    return () => { live = false; };
  }, [nodeId, refetch]);

  useEffect(() => {
    setCount(step.from);
    if (step.from === step.to) return;
    const timer = window.setTimeout(() => setCount(step.to), 280);
    return () => window.clearTimeout(timer);
  }, [step.from, step.to]);

  useEffect(() => {
    if (!done) return;
    if (reduce) {
      setBar(goalPct);
      return;
    }
    setBar(0);
    const frame = window.requestAnimationFrame(() => setBar(goalPct));
    return () => window.cancelAnimationFrame(frame);
  }, [done, goalPct, reduce]);

  if (error) {
    return (
      <section className="bd-card bd-stack">
        <p className="bd-error" role="alert">{error}</p>
        <Link href="/app" className="bd-btn bd-btn--outline">{t("done.back")}</Link>
      </section>
    );
  }
  if (!done) return <CardSkeleton />;
  const full = done.goal.done >= done.goal.total;
  return (
    <article className="bd-done">
      <header>
        <h1>{done.titleFa}</h1>
        <p>{t("sheet.duration", { min: digits(done.minuteMin), max: digits(done.minuteMax) })}</p>
      </header>
      <section className="bd-done__card">
        <BdIcon name="streak-flame" size={28} />
        <p className="bd-done__kicker">{t("done.streak")}</p>
        <p className="bd-done__count">{digits(count)} {t("home.days")}</p>
        {done.continued ? <p className="bd-done__plus">{t("done.plus")}</p> : null}
      </section>
      <section className="bd-done__card">
        <BdIcon name="daily-goal" size={28} />
        <p className="bd-done__kicker">{t("done.goal")}</p>
        <p className="bd-done__count">{digits(done.goal.done)} {t("home.goalOf")} {digits(done.goal.total)}</p>
        <span className="bd-done__track" aria-hidden>
          <span className="bd-done__fill" data-full={full ? "true" : "false"} style={{ width: `${bar}%` }} />
        </span>
      </section>
      {done.next ? (
        <section className="bd-done__card">
          <p className="bd-done__next">{t(`placement.skill.${done.next.skill}`)} · {done.next.titleFa}</p>
          <p className="bd-sub">{t(`path.kind.${done.next.kind}`)} · {t("sheet.duration", { min: digits(done.minuteMin), max: digits(done.minuteMax) })}</p>
          {done.next.startable ? null : <p className="bd-hint">{t("path.locked")}</p>}
        </section>
      ) : null}
      <div className="bd-lesson__foot">
        <Link href="/app" className="bd-btn bd-btn--solid bd-btn--block">{t("done.continue")}</Link>
        {done.next && !done.next.startable ? <Link href="/app" className="bd-btn bd-btn--outline bd-btn--block">{t("done.back")}</Link> : null}
      </div>
    </article>
  );
}
