"use client";

import { PlansScreen } from "@/components/features/account";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";

export default function Page() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <PlansScreen />
      </main>
      <PublicFooter />
    </div>
  );
}
