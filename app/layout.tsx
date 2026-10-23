import type { Metadata } from "next";
import { Literata, Vazirmatn } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazir",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "آمادگی آیلتس",
    template: "%s · آمادگی آیلتس",
  },
  description:
    "پروتوتایپ آمادگی مستقل آیلتس برای فارسی‌زبانان. تخمین‌ها غیررسمی‌اند و هیچ نمره یا زمان پیشرفتی تضمین نمی‌شود.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazir.variable} ${literata.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
