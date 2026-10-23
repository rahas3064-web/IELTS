import type { Bi } from "@/lib/types";

/** User-facing brand. Paths, the GitHub repo, and the /IELTS/ base stay unchanged. */
export const BRAND = {
  id: "bandora",
  name: { fa: "باندورا", en: "Bandora" } satisfies Bi,
  tagline: {
    fa: "مسیر آیلتس شما، با برنامه‌ریزی دقیق.",
    en: "Your IELTS journey, intelligently planned.",
  } satisfies Bi,
  support: {
    fa: "بسنجید. پیشرفت کنید. برسید.",
    en: "Assess. Improve. Achieve.",
  } satisfies Bi,
  disclaimer: {
    fa: "باندورا وابسته به آیلتس یا مالکان آن نیست و نمره رسمی صادر نمی‌کند.",
    en: "Bandora is not affiliated with, endorsed by, or certified by IELTS or its owners, and it does not issue an official score.",
  } satisfies Bi,
} as const;

export const PRODUCT_NAME = BRAND.name.en;
