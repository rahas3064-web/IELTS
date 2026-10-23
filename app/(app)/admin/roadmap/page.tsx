"use client";

import { AdminGate, RoadmapAdminScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/roadmap"><RoadmapAdminScreen /></AdminGate>;
}
