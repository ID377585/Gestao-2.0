import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { termsOfUseDocumentV21 } from "@/lib/legal-terms-v2.1";

export const metadata = createLegalPageMetadata(termsOfUseDocumentV21);

export default function TermsOfUsePage() {
  return <LegalPageLayout document={termsOfUseDocumentV21} />;
}
