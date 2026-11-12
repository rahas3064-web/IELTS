import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useT } from "@/src/i18n";
import { BottomNav } from "@/components/features/bandora/panel/shell/bottom-nav";
import { EmailCard } from "@/components/features/bandora/panel/shell/email-card";
import { FrameProvider } from "@/components/features/bandora/panel/shell/frame-context";
import { Header } from "@/components/features/bandora/panel/shell/header";
import { MoreSheet } from "@/components/features/bandora/panel/shell/more-sheet";
import { pageTitleKey } from "@/components/features/bandora/panel/shell/nav-items";
import { Sidebar } from "@/components/features/bandora/panel/shell/sidebar";

function Frame() {
  const { t } = useT();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const title = t(pageTitleKey(pathname));

  useEffect(() => {
    const previous = document.title;
    document.title = `${t("app.name")} | ${title}`;
    return () => {
      document.title = previous;
    };
  }, [t, title]);

  // The More sheet belongs to the page it was opened on.
  useEffect(() => setMore(false), [pathname]);

  return (
    <div className="bd-shell">
      <a className="bd-skip" href="#content">{t("nav.skip")}</a>
      <Header />
      <div className="bd-shell__body">
        <Sidebar />
        <main id="content" className="bd-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <EmailCard />
      <BottomNav moreOpen={more} onMore={() => setMore(true)} />
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </div>
  );
}

/** The signed-in panel frame (sidebar, header, bottom bar). Pages render in the Outlet. */
export function AppShell() {
  return (
    <FrameProvider>
      <Frame />
    </FrameProvider>
  );
}
