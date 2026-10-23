"use client";

import { useParams } from "next/navigation";
import { ExerciseScreen } from "@/components/features/study";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <ExerciseScreen id={params.id} />;
}
