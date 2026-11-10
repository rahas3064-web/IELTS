"use client";

import { Suspense, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <p className="text-sm text-muted-foreground">بندورا</p>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="theme">
      <TooltipProvider>
        <Suspense fallback={<BootScreen />}>{children}</Suspense>
        <Toaster position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
