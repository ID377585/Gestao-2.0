import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { cookiePolicyDocumentV21 } from "@/lib/legal-privacy-cookies-v2.1";

export const metadata = createLegalPageMetadata(cookiePolicyDocumentV21);

export default function CookiePolicyPage() {
  return <LegalPageLayout document={cookiePolicyDocumentV21} />;
}
