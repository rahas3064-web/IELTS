"use client";

import { useParams } from "next/navigation";
import { MockRunner } from "@/components/features/study";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <MockRunner id={params.id} />;
}
