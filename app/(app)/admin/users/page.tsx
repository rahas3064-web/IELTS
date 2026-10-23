"use client";

import { AdminGate, UsersScreen } from "@/components/features/admin";

export default function Page() {
  return <AdminGate path="/admin/users"><UsersScreen /></AdminGate>;
}
