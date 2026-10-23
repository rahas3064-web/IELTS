"use client";

import { Outlet } from "react-router-dom";
import Link from "@/components/link";
import { usePathname, useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Archive,
  Bell,
  Bot,
  CalendarDays,
  CircleHelp,
  FileDown,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Map,
  Menu,
  MessageSquareWarning,
  Moon,
  Shield,
  Sun,
  UserRound,
  WifiOff,
} from "lucide-react";
import { BrandLockup } from "@/components/product/bits";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { buildNotices } from "@/lib/signals";
import { useApp } from "@/lib/store";
import { cn } from "cn";

const PRIMARY = [
  { href: "/dashboard", fa: "داشبورد", en: "Dashboard", icon: LayoutDashboard },
  { href: "/roadmap", fa: "نقشه راه", en: "Roadmap", icon: Map },
  { href: "/plan", fa: "برنامه", en: "Plan", icon: CalendarDays },
  { href: "/practice", fa: "تمرین", en: "Practice", icon: LineChart },
  { href: "/progress", fa: "پیشرفت", en: "Progress", icon: LineChart },
  { href: "/mocks", fa: "آزمونک", en: "Mocks", icon: FileDown },
];

const MORE = [
  { href: "/reports", fa: "گزارش‌ها", en: "Reports", icon: FileDown },
  { href: "/assistant", fa: "دستیار", en: "Assistant", icon: Bot },
  { href: "/notifications", fa: "اعلان‌ها", en: "Notices", icon: Bell },
  { href: "/archive", fa: "آرشیو", en: "Archive", icon: Archive },
  { href: "/lab", fa: "آزمایشگاه", en: "Lab", icon: FlaskConical },
  { href: "/feedback", fa: "بازخورد", en: "Feedback", icon: MessageSquareWarning },
  { href: "/help", fa: "راهنما", en: "Help", icon: CircleHelp },
  { href: "/profile", fa: "پروفایل", en: "Profile", icon: UserRound },
  { href: "/plans", fa: "پلن‌ها", en: "Plans", icon: Shield },
  { href: "/admin", fa: "مدیریت", en: "Admin", icon: Shield },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { bi, view, state } = useApp();
  const unread = buildNotices(view, state.notificationPrefs).filter((item) => !state.notificationReads.includes(item.id)).length;
  const items = [...PRIMARY, ...MORE];
  return (
    <nav className="grid gap-1" aria-label={bi("اصلی", "Primary")}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              active ? "bg-primary/12 font-medium text-primary" : "text-foreground/80 hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span>{bi(item.fa, item.en)}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className="ms-auto rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{unread}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, state, view, bi, setLocale, setConnection, signOut } = useApp();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!state.account) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!state.onboardingDone && pathname !== "/onboarding") router.replace("/onboarding");
  }, [ready, state.account, state.onboardingDone, pathname, router]);

  if (!ready || !state.account || (!state.onboardingDone && pathname !== "/onboarding")) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-muted-foreground">{bi("در حال آماده‌سازی فضای شما", "Preparing your space")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        {bi("پرش به محتوا", "Skip to content")}
      </a>
      <div className="lg:grid lg:grid-cols-[17rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-e bg-sidebar p-4 lg:flex">
          <Link href="/dashboard" className="mb-6"><BrandLockup /></Link>
          <div className="min-h-0 flex-1 overflow-y-auto pe-1">
            <NavLinks />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            {bi("محاسبه‌ها در همین مرورگر انجام می‌شوند. صوت رسمی، پرداخت و هوش مصنوعی وصل نیستند.", "Calculations run in this browser. Official audio, payments, and AI are not connected.")}
          </p>
        </aside>
        <div className="min-w-0">
          <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b bg-background/90 px-4 py-3 backdrop-blur">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" aria-label={bi("منو", "Menu")} />}>
                <Menu />
              </SheetTrigger>
              <SheetContent side={state.locale === "fa" ? "right" : "left"} className="w-72">
                <SheetHeader>
                  <SheetTitle>{bi("منو", "Menu")}</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">
                  <NavLinks onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden"><BrandLockup /></div>
            <div className="ms-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setLocale(state.locale === "fa" ? "en" : "fa")}>
                {state.locale === "fa" ? "EN" : "فا"}
              </Button>
              <Button variant="ghost" size="icon" aria-label={bi("تم", "Theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun /> : <Moon />}
              </Button>
              <Button
                variant={state.connection === "online" ? "ghost" : "outline"}
                size="sm"
                onClick={() => setConnection(state.connection === "online" ? "offline" : state.connection === "offline" ? "slow" : "online")}
              >
                <WifiOff className="size-4" aria-hidden />
                <span className="hidden sm:inline">{state.connection === "online" ? bi("آنلاین", "Online") : state.connection === "slow" ? bi("کند", "Slow") : bi("قطع", "Offline")}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => { signOut(); router.push("/"); }}>
                {bi("خروج", "Log out")}
              </Button>
            </div>
          </header>
          {state.connection !== "online" ? (
            <div className="border-b bg-warning/15 px-4 py-2 text-sm" role="status">
              {state.connection === "offline"
                ? bi("اتصال قطع است. زمان آزمون متوقف نمی‌شود و پاسخ‌ها در همین مرورگر می‌مانند. ارسال تا اتصال دوباره انجام نمی‌شود.", "You are offline. A test clock does not pause, and answers stay in this browser. Submission waits for the connection.")
                : bi("اتصال کند شبیه‌سازی شده است. ارسال‌ها کمی دیرتر تمام می‌شوند.", "A slow connection is simulated. Submits finish a little later.")}
            </div>
          ) : null}
          {view?.source.fictional ? (
            <div className="border-b bg-primary/8 px-4 py-2 text-sm">
              {bi(
                `در حال دیدن سناریوی نمونه ${view.source.person.fa}. این داده یک کاربر واقعی نیست.`,
                `Viewing the sample scenario for ${view.source.person.en}. This is not a real learner.`,
              )}
              <Link href="/lab" className="ms-2 font-medium text-primary underline-offset-4 hover:underline">{bi("تغییر سناریو", "Change scenario")}</Link>
            </div>
          ) : null}
          <main id="content" className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 lg:pb-10">
            <Outlet />
          </main>
        </div>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-1 py-1 backdrop-blur lg:hidden" aria-label={bi("میانبر", "Shortcuts")}>
        {PRIMARY.slice(0, 4).concat([{ href: "/notifications", fa: "بیشتر", en: "More", icon: Menu }]).map((item, index) => {
          const href = index === 4 ? "/notifications" : item.href;
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link key={href} href={href} className={cn("grid place-items-center gap-0.5 rounded-lg py-1 text-[11px]", active && "text-primary")} aria-current={active ? "page" : undefined}>
              <Icon className="size-4" aria-hidden />
              {bi(index === 4 ? "اعلان" : item.fa, index === 4 ? "Alerts" : item.en)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
