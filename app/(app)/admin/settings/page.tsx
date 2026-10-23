"use client";

import { AdminGate, SettingsScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/settings"><SettingsScreen /></AdminGate>;
}
