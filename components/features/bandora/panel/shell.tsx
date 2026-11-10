import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  MessageSquare,
  PenLine,
  Play,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "@/components/link";
import { PanelLocaleProvider, usePanelLocale } from "@/components/features/bandora/panel/locale";
import { SessionProvider, useSession } from "@/components/features/bandora/panel/session";
import {
  BOTTOM_NAV,
  PANEL_NAV,
  isNavActive,
  pageMeta,
  readAccount,
  todayLabel,
} from "@/components/features/bandora/panel/model";
import "@/components/features/bandora/panel/panel.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Vazirmatn:wght@400;500;600;700&display=swap";
const ESTEDAD = "https://cdn.jsdelivr.net/npm/@fontsource/estedad@5/index.css";

const ICONS: Record<(typeof PANEL_NAV)[number]["id"], LucideIcon> = {
  dashboard: LayoutDashboard,
  placement: ClipboardCheck,
  plan: CalendarDays,
  practice: PenLine,
  feedback: MessageSquare,
  progress: LineChart,
  mock: FileText,
  profile: UserRound,
  subscription: CreditCard,
};

function PanelLogo() {
  return (
    <Link href="/app" className="bd-logo" dir="ltr">
      bandora<span>.</span>
    </Link>
  );
}

function NavLinks({ onNavigate, labelledBy }: { onNavigate?: () => void; labelledBy?: string }) {
  const { pathname } = useLocation();
  const { locale, copy } = usePanelLocale();
  return (
    <nav aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : copy.nav}>
      {PANEL_NAV.map((item) => {
        const Icon = ICONS[item.id];
        const active = isNavActive(pathname, item.href);
        const title = locale === "fa" ? item.fa : item.en;
        return (
            <Link
            key={item.href}
            href={item.href}
            className="bd-navlink"
            viewTransition
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          >
            <Icon size={18} strokeWidth={1.6} aria-hidden />
            <span>{title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LangToggle() {
  const { locale, setLocale, copy } = usePanelLocale();
  return (
    <div className="bd-lang" role="group" aria-label={copy.lang}>
      <button type="button" aria-pressed={locale === "fa"} onClick={() => setLocale("fa")}>FA</button>
      <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    </div>
  );
}

function SheetClose({ onClose }: { onClose: () => void }) {
  const { copy } = usePanelLocale();
  return (
    <button type="button" className="bd-sheet-close" aria-label={copy.close} onClick={onClose}>
      <X size={18} strokeWidth={1.6} aria-hidden />
    </button>
  );
}

function Notices() {
  const { copy } = usePanelLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="bd-pop-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bd-iconbtn"
        aria-label={copy.notices}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} strokeWidth={1.6} aria-hidden />
      </button>
      {open ? (
        <div className="bd-pop" id={panelId} role="region" aria-label={copy.notices}>
          <SheetClose onClose={() => setOpen(false)} />
          <p className="bd-muted">{copy.empty}</p>
        </div>
      ) : null}
    </div>
  );
}

function AccountMenu() {
  const { copy } = usePanelLocale();
  const { me, signOut } = useSession();
  const account = readAccount(me);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="bd-pop-wrap" ref={wrapRef}>
      <button
        type="button"
        className="bd-avatar-btn"
        aria-label={copy.account}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {account ? account.name.slice(0, 1) : "؟"}
      </button>
      {open ? (
        <div className="bd-pop" id={panelId} role="region" aria-label={copy.account}>
          <SheetClose onClose={() => setOpen(false)} />
          <p>{account?.name || copy.account}</p>
          {account ? (
            <button type="button" className="bd-account-link bd-item" onClick={() => { setOpen(false); void signOut(); }}>
              {copy.logout}
            </button>
          ) : (
            <Link className="bd-account-link bd-item" href="/login?next=/app" onClick={() => setOpen(false)}>
              {copy.signIn}
            </Link>
          )}
          <Link className="bd-account-link bd-item" href="/" viewTransition onClick={() => setOpen(false)}>
            {copy.signOut}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { copy } = usePanelLocale();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    const closeButton = root?.querySelector<HTMLButtonElement>("button");
    closeButton?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>("a, button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button type="button" className="bd-backdrop" aria-label={copy.close} onClick={onClose} />
      <div ref={ref} className="bd-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="bd-drawer-head">
          <PanelLogo />
          <button type="button" className="bd-iconbtn" aria-label={copy.close} onClick={onClose}>
            <X size={18} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
        <p id={titleId} className="bd-sr">{copy.menu}</p>
        <NavLinks onNavigate={onClose} labelledBy={titleId} />
      </div>
    </>
  );
}

function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { pathname } = useLocation();
  const { locale, copy } = usePanelLocale();
  const items = PANEL_NAV.filter((item) => (BOTTOM_NAV as readonly string[]).includes(item.id));
  return (
    <nav className="bd-bottom" aria-label={copy.shortcuts}>
      {items.map((item) => {
        const Icon = ICONS[item.id];
        const active = isNavActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} viewTransition aria-current={active ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.6} aria-hidden />
            {locale === "fa" ? item.fa : item.en}
          </Link>
        );
      })}
      <button type="button" aria-expanded={moreOpen} onClick={onMore}>
        <Menu size={18} strokeWidth={1.6} aria-hidden />
        {copy.more}
      </button>
    </nav>
  );
}

function StartFab() {
  const { me, ready } = useSession();
  const { copy } = usePanelLocale();
  const account = readAccount(me);
  if (!ready || account?.bands) return null;
  const href = !account ? "/login?next=/app" : account.facts.some((fact) => fact.id === "target") ? "/app/placement" : "/app/profile";
  const label = !account ? copy.signIn : account.facts.some((fact) => fact.id === "target") ? copy.placement : copy.goal;
  return (
    <Link className="bd-fab" href={href} aria-label={label}>
      <Play size={18} strokeWidth={1.6} aria-hidden />
      <span className="bd-tip">{label}</span>
    </Link>
  );
}

function PanelFrame() {
  const { pathname } = useLocation();
  const { locale, copy } = usePanelLocale();
  const meta = pageMeta(pathname, locale);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navTitle = useId();
  const closeDrawer = useCallback(() => {
    setDrawer(false);
    menuRef.current?.focus();
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = locale === "fa" ? `باندورا | ${meta.title}` : `Bandora | ${meta.title}`;
    return () => {
      document.title = previous;
    };
  }, [locale, meta.title]);

  return (
    <div className="bandora-panel" dir={locale === "fa" ? "rtl" : "ltr"} lang={locale === "fa" ? "fa" : "en"}>
      <link rel="stylesheet" href={FONTS} />
      <link rel="stylesheet" href={ESTEDAD} />
      <a className="bd-skip" href="#content">{copy.skip}</a>
      <header className="bd-top">
        <button
          ref={menuRef}
          type="button"
          className="bd-iconbtn bd-menu"
          aria-label={copy.menu}
          aria-expanded={drawer}
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} strokeWidth={1.6} aria-hidden />
        </button>
        <PanelLogo />
        <div className="bd-title-row">
          <h1 className="page-title">{meta.title}</h1>
          <time className="bd-page-date" dateTime={new Date().toISOString()}>{todayLabel(locale, new Date())}</time>
        </div>
        <div className="bd-tools">
          <LangToggle />
          <Notices />
          <AccountMenu />
        </div>
      </header>
      <div className="bd-shell">
        <aside className="bd-side">
          <p id={navTitle} className="bd-sr">{copy.nav}</p>
          <NavLinks labelledBy={navTitle} />
        </aside>
        <div className="bd-column">
          <main id="content" className="bd-main" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav moreOpen={drawer} onMore={() => setDrawer(true)} />
      <StartFab />
      <Drawer open={drawer} onClose={closeDrawer} />
    </div>
  );
}

export function BandoraPanelShell() {
  return (
    <PanelLocaleProvider>
      <SessionProvider>
        <PanelFrame />
      </SessionProvider>
    </PanelLocaleProvider>
  );
}

export function PanelPlaceholder() {
  const { copy } = usePanelLocale();
  return (
    <section className="bd-card bd-soon" aria-labelledby="soon-title">
      <div className="bd-head">
        <h2 id="soon-title">{copy.soon}</h2>
      </div>
      <p className="bd-lead">{copy.soonBody}</p>
      <div className="bd-actions">
        <Link className="bd-btn bd-btn-solid" href="/app" viewTransition>{copy.back}</Link>
      </div>
    </section>
  );
}
