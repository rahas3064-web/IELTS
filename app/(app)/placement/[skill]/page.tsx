"use client";

import { useParams } from "next/navigation";
import { SkillRunner } from "@/components/features/placement";

export default function Page() {
  const params = useParams<{ skill: string }>();
  return <SkillRunner skill={params.skill} />;
}
