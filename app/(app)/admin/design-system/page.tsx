"use client";

import { AdminGate, DesignSystemScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/design-system"><DesignSystemScreen /></AdminGate>;
}
