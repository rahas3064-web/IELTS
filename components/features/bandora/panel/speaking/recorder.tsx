import { useT } from "@/src/i18n";
import { useRecorder } from "./use-recorder";
import type { SpeakingPart } from "./recorder-rules";

export function SpeakingRecorder({ part }: { part: SpeakingPart }) {
  const { t, n } = useT();
  const recorder = useRecorder(part);

  return (
    <section className="bd-stack" aria-label={t("speaking.record.title")}>
      {recorder.phase === "recording" ? (
        <p role="timer">{t("speaking.record.remaining", { seconds: n(recorder.remaining) })}</p>
      ) : null}
      {recorder.phase === "denied" ? <p role="alert">{t("speaking.record.denied")}</p> : null}
      {recorder.phase === "unsupported" ? <p role="alert">{t("speaking.record.unsupported")}</p> : null}
      {recorder.phase === "error" ? <p role="alert">{t("speaking.record.error")}</p> : null}
      {recorder.phase === "ready" && recorder.audioUrl ? (
        <audio controls src={recorder.audioUrl} aria-label={t("speaking.record.replay")} />
      ) : null}
      {recorder.phase === "recording" ? (
        <button type="button" className="bd-btn bd-btn--solid" onClick={recorder.stop}>
          {t("speaking.record.stop")}
        </button>
      ) : (
        <button type="button" className="bd-btn bd-btn--solid" onClick={() => void recorder.start()}>
          {recorder.phase === "ready" ? t("speaking.record.again") : t("speaking.record.start")}
        </button>
      )}
    </section>
  );
}
