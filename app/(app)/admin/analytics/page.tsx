"use client";

import { AdminGate, AnalyticsScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/analytics"><AnalyticsScreen /></AdminGate>;
}
