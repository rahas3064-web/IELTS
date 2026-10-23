"use client";

import Link from "@/components/link";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { BrandLockup } from "@/components/product/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { cn } from "cn";

export function PublicHeader() {
  const { bi, state, setLocale } = useApp();
  const { theme, setTheme } = useTheme();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
      <Link href="/"><BrandLockup /></Link>
      <nav className="ms-4 hidden items-center gap-4 text-sm text-muted-foreground md:flex" aria-label={bi("عمومی", "Public")}>
        <a href="/#method" className="hover:text-foreground">{bi("روش کار", "How it works")}</a>
        <a href="/#sample" className="hover:text-foreground">{bi("نمونه گزارش", "Sample report")}</a>
        <Link href="/plans" className="hover:text-foreground">{bi("پلن‌ها", "Plans")}</Link>
        <a href="/#faq" className="hover:text-foreground">{bi("پرسش‌ها", "FAQ")}</a>
      </nav>
      <div className="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setLocale(state.locale === "fa" ? "en" : "fa")}>
          {state.locale === "fa" ? "EN" : "فا"}
        </Button>
        <Button variant="ghost" size="icon" aria-label={bi("تم", "Theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "hidden h-9 sm:inline-flex")}>{bi("ورود", "Log in")}</Link>
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-9")}>{bi("شروع", "Start")}</Link>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { bi } = useApp();
  return (
    <footer className="border-t px-4 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>{bi("آمادگی آیلتس یک نام موقت است. هیچ نمره‌ای تضمین نمی‌شود.", "IELTS Readiness is a temporary name. No score is guaranteed.")}</p>
        <div className="flex gap-4">
          <Link href="/help" className="hover:text-foreground">{bi("راهنما", "Help")}</Link>
          <Link href="/plans" className="hover:text-foreground">{bi("پلن‌ها", "Plans")}</Link>
        </div>
      </div>
    </footer>
  );
}
