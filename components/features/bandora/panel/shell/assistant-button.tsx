import Link from "@/components/link";
import { Sparkles } from "lucide-react";
import { useT } from "@/src/i18n";

export function AssistantButton() {
  const { t } = useT();
  return (
    <Link href="/app/assistant" className="bd-iconbtn bd-assistant" aria-label={t("nav.assistant")}>
      <Sparkles size={18} strokeWidth={1.6} aria-hidden />
    </Link>
  );
}
