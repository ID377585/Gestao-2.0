import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { privacyPolicyDocumentV21 } from "@/lib/legal-privacy-cookies-v2.1";

export const metadata = createLegalPageMetadata(privacyPolicyDocumentV21);

export default function PrivacyPolicyPage() {
  return <LegalPageLayout document={privacyPolicyDocumentV21} />;
}
