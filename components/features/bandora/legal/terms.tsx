import { LegalDocument, LegalParagraph } from "@/components/features/bandora/legal/document";

export function TermsPage() {
  return (
    <LegalDocument titleKey="legal.terms.title">
      <LegalParagraph textKey="legal.terms.independence" />
      <LegalParagraph textKey="legal.terms.scores" />
    </LegalDocument>
  );
}
