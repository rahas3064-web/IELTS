"use client";

import { AdminGate, AdminHome } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin"><AdminHome /></AdminGate>;
}
