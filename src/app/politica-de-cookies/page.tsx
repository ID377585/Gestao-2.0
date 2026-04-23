import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import {
  cookiePolicyDocument,
  createLegalPageMetadata,
} from "@/lib/legal-content";

export const metadata = createLegalPageMetadata(cookiePolicyDocument);

export default function CookiePolicyPage() {
  return <LegalPageLayout document={cookiePolicyDocument} />;
}
