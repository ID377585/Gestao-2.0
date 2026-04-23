import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  createLegalPageMetadata,
  termsOfUseDocument,
} from "@/lib/legal-content";

export const metadata = createLegalPageMetadata(termsOfUseDocument);

export default function TermsOfUsePage() {
  return <LegalPageLayout document={termsOfUseDocument} />;
}
