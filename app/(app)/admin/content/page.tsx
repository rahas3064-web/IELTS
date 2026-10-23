"use client";

import { AdminGate, ContentScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/content"><ContentScreen /></AdminGate>;
}
