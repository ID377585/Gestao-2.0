import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  accessibilityPolicyDocument,
  createLegalPageMetadata,
} from "@/lib/legal-content";

export const metadata = createLegalPageMetadata(accessibilityPolicyDocument);

export default function AccessibilityPolicyPage() {
  return <LegalPageLayout document={accessibilityPolicyDocument} />;
}
