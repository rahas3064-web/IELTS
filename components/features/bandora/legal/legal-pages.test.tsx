/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/auth/auth-provider", () => ({
  useAuth: () => ({ refresh: async () => null }),
}));
import { I18nProvider, type Locale } from "@/src/i18n";
import { LoginPage } from "@/components/features/bandora/panel/auth/login-page";
import { PrivacyPage } from "@/components/features/bandora/legal/privacy";
import { RefundPage } from "@/components/features/bandora/legal/refund";
import { TermsPage } from "@/components/features/bandora/legal/terms";

function draw(node: ReactNode, locale: Locale) {
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>,
  );
}

afterEach(() => cleanup());

describe("legal pages", () => {
  it("renders the Persian terms, privacy and refund texts right to left", () => {
    const { unmount } = draw(<TermsPage />, "fa");
    const terms = screen.getByRole("article");
    expect(terms).toHaveAttribute("dir", "rtl");
    expect(terms).toHaveAttribute("lang", "fa");
    expect(terms).toHaveTextContent("legal-2026-11-18");
    expect(terms).toHaveTextContent("۲۷ آبان ۱۴۰۵");
    expect(terms).toHaveTextContent("رها شایسته");
    expect(terms).toHaveTextContent("British Council");
    expect(terms).toHaveTextContent("تخمینی");
    unmount();

    const privacyView = draw(<PrivacyPage />, "fa");
    const privacy = screen.getByRole("article");
    expect(privacy).toHaveAttribute("dir", "rtl");
    expect(privacy).toHaveTextContent("Railway");
    expect(privacy).toHaveTextContent("Supabase");
    expect(privacy).toHaveTextContent("AvalAI");
    expect(privacy).toHaveTextContent("شرکت‌های دیگر");
    expect(privacy).toHaveTextContent("۹۰");
    expect(privacy).toHaveTextContent("حذف");
    expect(privacy).toHaveTextContent("rahas3064@gmail.com");
    privacyView.unmount();

    draw(<RefundPage />, "fa");
    const refund = screen.getByRole("article");
    expect(refund).toHaveTextContent("۷ روز");
    expect(refund).toHaveTextContent("نمره‌دهی هوش مصنوعی");
    expect(refund).toHaveTextContent("آزمون آزمایشی");
    expect(refund).not.toHaveTextContent("پشتیبانی");
    expect(refund).toHaveTextContent("rahas3064@gmail.com");
  });

  it("renders the short English text left to right", () => {
    draw(<TermsPage />, "en");
    const terms = screen.getByRole("article");
    expect(terms).toHaveAttribute("dir", "ltr");
    expect(terms).toHaveAttribute("lang", "en");
    expect(terms).toHaveTextContent("not an official IELTS score");
    expect(terms).toHaveTextContent("Raha Shayesteh");
  });

  it("links the three pages from login", () => {
    draw(<LoginPage />, "fa");
    expect(screen.getByRole("link", { name: "قوانین استفاده" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "حریم خصوصی" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "بازگشت وجه" })).toHaveAttribute("href", "/refund");
  });
});
