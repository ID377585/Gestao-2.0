import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  createLegalPageMetadata,
  privacyPolicyDocument,
} from "@/lib/legal-content";

export const metadata = createLegalPageMetadata(privacyPolicyDocument);

export default function PrivacyPolicyPage() {
  return <LegalPageLayout document={privacyPolicyDocument} />;
}
