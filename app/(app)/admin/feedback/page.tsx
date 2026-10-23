"use client";

import { AdminFeedbackScreen, AdminGate } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/feedback"><AdminFeedbackScreen /></AdminGate>;
}
