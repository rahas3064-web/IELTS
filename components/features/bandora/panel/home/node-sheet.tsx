import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Link from "@/components/link";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";
import { BdIcon, type BdIconName } from "@/components/features/bandora/panel/icons/bd-icon";

export type PathNode = { id: string; kind: string; premium: boolean; state: string };
export type PathChapter = { key: string; titleFa: string | null; from: number; to: number; locked: boolean; nodes: PathNode[] };

const SKILL = { lesson: "listening", practice: "reading", challenge: "writing", review: "speaking", checkpoint: "writing" } as const;

export function sheetKind(node: PathNode, chapter: PathChapter, premium: boolean) {
  if (chapter.locked) return "chapter" as const;
  const ready = chapter.nodes.filter((item) => item.kind !== "checkpoint").every((item) => item.state === "done");
  if (node.kind === "checkpoint" && !ready) return "checkpoint" as const;
  if (node.state === "locked") return "locked" as const;
  if (node.premium && !premium) return "premium" as const;
  return "current" as const;
}

/** Bottom sheet for one path node. Starting a locked node is refused by the API as well. */
export function NodeSheet({
  node, chapter, premium, onClose,
}: {
  node: PathNode;
  chapter: PathChapter;
  premium: boolean;
  onClose: () => void;
}) {
  const i18n = useT();
  const { t, digits } = i18n;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = sheetKind(node, chapter, premium);
  const skill = SKILL[node.kind as keyof typeof SKILL] ?? "writing";
  const icon: BdIconName = kind === "premium" ? "premium-crown" : kind === "current" ? "check" : "lock";

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const body = await api.post<{ lessonUrl: string }>(`/api/path/nodes/${node.id}/start`);
      navigate(body.lessonUrl);
    } catch (caught) {
      setError(errorText(caught, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bd-scrim" onClick={onClose}>
      <section className="bd-nodesheet" role="dialog" aria-modal="true" aria-labelledby="node-sheet-title" onClick={(event) => event.stopPropagation()}>
        <span className="bd-nodesheet__handle" aria-hidden />
        <p className="bd-nodesheet__kicker"><BdIcon name={icon} size={18} /> {t(`sheet.kicker.${kind}`)}</p>
        <h2 id="node-sheet-title">{t(`path.kind.${node.kind}`)}</h2>
        <p className="bd-nodesheet__sub">{t(`placement.skill.${skill}`)} · {t(`sheet.body.${kind}`)}</p>
        {kind === "current" ? <p className="bd-nodesheet__meta">{t("sheet.duration", { min: digits(5), max: digits(10) })}</p> : null}
        {error ? <p className="bd-error" role="alert">{error}</p> : null}
        {kind === "current" ? (
          <button type="button" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy} onClick={() => void start()}>{t("path.start")}</button>
        ) : null}
        {kind === "premium" ? <Link href="/app/subscription" className="bd-btn bd-btn--solid bd-btn--block">{t("sheet.premiumCta")}</Link> : null}
        <button type="button" className="bd-btn bd-btn--outline bd-btn--block" onClick={onClose}>{t("sheet.back")}</button>
      </section>
    </div>
  );
}
