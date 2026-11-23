import { useState } from "react";
import Link from "@/components/link";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { BdIcon, type BdIconName } from "@/components/features/bandora/panel/icons/bd-icon";
import { NodeSheet, type PathChapter, type PathNode } from "@/components/features/bandora/panel/home/node-sheet";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { CardSkeleton } from "@/components/features/bandora/panel/ui/states";

const KIND_ICON: Record<string, BdIconName> = {
  lesson: "node-lesson",
  practice: "node-practice",
  challenge: "node-challenge",
  review: "node-review",
  checkpoint: "node-checkpoint",
};

function bandLabel(value: number, digits: (value: string | number) => string) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return digits(text);
}

/** `/app`: zigzag path. Tapping a node opens its sheet; the API still refuses a locked start. */
export function HomePage() {
  const { t, digits } = useT();
  const { me } = useAuth();
  const { data, loading } = useFrame();
  const [open, setOpen] = useState<{ node: PathNode; chapter: PathChapter } | null>(null);
  const [listed, setListed] = useState<string | null>(null);
  if (!me || (loading && !data)) return <CardSkeleton />;
  const needsPlacement = me.placementCompleted !== true;
  const chapters = (data?.path.chapters ?? []) as PathChapter[];
  const premium = me.subscription.plan.startsWith("premium");

  return (
    <div className="bd-home">
      {needsPlacement ? (
        <article className="bd-place-banner">
          <BdIcon name="node-checkpoint" size={36} />
          <div>
            <h3>{t("home.placementBanner.title")}</h3>
            <p>{t("home.placementBanner.body")}</p>
          </div>
          <Link href="/app/placement/intro" className="bd-btn bd-btn--solid bd-place-banner__cta">{t("home.placement")}</Link>
        </article>
      ) : null}
      {chapters.map((chapter) => (
        <section key={chapter.key} className="bd-unit" data-locked={chapter.locked ? "true" : "false"}>
          <div className="bd-unit__banner">
            <div>
              <h2>{chapter.titleFa ?? t("path.chapter", { n: digits(1), from: bandLabel(chapter.from, digits), to: bandLabel(chapter.to, digits) })}</h2>
              <p>{chapter.locked ? t("path.locked") : t("path.open")}</p>
            </div>
            {chapter.locked ? <BdIcon name="lock" size={18} /> : (
              <button type="button" className="bd-unit__list" aria-expanded={listed === chapter.key} aria-label={t("path.list")} onClick={() => setListed(listed === chapter.key ? null : chapter.key)}>≡</button>
            )}
          </div>
          {listed === chapter.key ? (
            <ul className="bd-hint">
              {chapter.nodes.map((node) => <li key={node.id}>{t(`path.kind.${node.kind}`)}</li>)}
            </ul>
          ) : null}
          {chapter.locked ? (
            chapter.nodes[0] ? <button type="button" className="bd-btn bd-btn--outline" onClick={() => setOpen({ node: chapter.nodes[0], chapter })}>{t("path.locked")}</button> : null
          ) : (
            <ol className="bd-path">
              {chapter.nodes.map((node) => {
                const face = node.premium && node.state === "locked" ? "premium-crown" : node.state === "done" ? "check" : (KIND_ICON[node.kind] ?? "node-lesson");
                const body = (
                  <>
                    <span className={`bd-node${node.kind === "checkpoint" ? " bd-node--check" : ""}${node.state === "current" ? " bd-node--current" : ""}`} data-state={node.state}>
                      <BdIcon name={face} size={node.kind === "checkpoint" ? 28 : 24} />
                    </span>
                    {node.state === "current" ? <span className="bd-path__go">{t("path.start")}</span> : null}
                    <span className="bd-path__label">{t(`path.kind.${node.kind}`)}</span>
                  </>
                );
                return (
                  <li key={node.id} className="bd-path__item" data-state={node.state}>
                    {node.state === "done" ? (
                      <svg className="bd-path__seg" viewBox="0 0 2 100" preserveAspectRatio="none" aria-hidden>
                        <line pathLength="100" x1="1" y1="0" x2="1" y2="100" />
                      </svg>
                    ) : null}
                    <button type="button" className="bd-path__hit" onClick={() => setOpen({ node, chapter })}>{body}</button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ))}
      {open ? <NodeSheet node={open.node} chapter={open.chapter} premium={premium} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
