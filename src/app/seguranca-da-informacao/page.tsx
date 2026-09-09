import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { securityPolicyDocument } from "@/lib/legal-v2-content";

export const metadata = createLegalPageMetadata(securityPolicyDocument);

export default function SecurityPolicyPage() {
  return <LegalPageLayout document={securityPolicyDocument} />;
}
