import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { dataGovernancePolicyDocument } from "@/lib/data-governance-content";

export const metadata = createLegalPageMetadata(dataGovernancePolicyDocument);

export default function DataGovernancePolicyPage() {
  return <LegalPageLayout document={dataGovernancePolicyDocument} />;
}
