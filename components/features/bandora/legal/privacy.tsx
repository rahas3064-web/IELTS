import { LegalDocument, LegalParagraph } from "@/components/features/bandora/legal/document";

export function PrivacyPage() {
  return (
    <LegalDocument titleKey="legal.privacy.title">
      <LegalParagraph textKey="legal.privacy.collected" />
      <LegalParagraph textKey="legal.privacy.storage" />
      <LegalParagraph textKey="legal.privacy.audio" />
      <LegalParagraph textKey="legal.privacy.deletion" />
    </LegalDocument>
  );
}
