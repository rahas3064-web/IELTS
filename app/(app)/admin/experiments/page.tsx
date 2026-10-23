"use client";

import { AdminGate, ExperimentsScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/experiments"><ExperimentsScreen /></AdminGate>;
}
