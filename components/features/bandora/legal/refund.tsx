import { LegalDocument, LegalParagraph } from "@/components/features/bandora/legal/document";

export function RefundPage() {
  return (
    <LegalDocument titleKey="legal.refund.title">
      <LegalParagraph textKey="legal.refund.window" />
      <LegalParagraph textKey="legal.refund.request" />
      <LegalParagraph textKey="legal.refund.used" />
    </LegalDocument>
  );
}
