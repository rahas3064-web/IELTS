import Link from "@/components/link";
import { ClipboardCheck } from "lucide-react";
import { useT } from "@/src/i18n";
import { Logo } from "@/components/features/bandora/panel/ui/logo";

/** `/app/placement/intro`: what the placement test is, with a way to skip it for now. */
export function PlacementIntro() {
  const { t } = useT();
  return (
    <main className="bd-auth bd-auth--wide">
      <Logo href="/" />
      <section className="bd-card bd-auth__card" aria-labelledby="intro-title">
        <ClipboardCheck size={28} strokeWidth={1.6} aria-hidden className="bd-auth__icon" />
        <p className="bd-kicker">{t("placementIntro.kicker")}</p>
        <h1 id="intro-title" className="bd-title">{t("placementIntro.title")}</h1>
        <p className="bd-sub">{t("placementIntro.body")}</p>
        <ul className="bd-list">
          <li>{t("placementIntro.point1")}</li>
          <li>{t("placementIntro.point2")}</li>
          <li>{t("placementIntro.point3")}</li>
        </ul>
        <div className="bd-auth__actions bd-auth__actions--stack">
          <Link href="/app/placement" className="bd-btn bd-btn--solid">{t("placementIntro.start")}</Link>
          <Link href="/app" className="bd-btn bd-btn--outline">{t("placementIntro.skip")}</Link>
        </div>
      </section>
    </main>
  );
}
