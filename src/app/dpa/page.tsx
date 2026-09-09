import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { createLegalPageMetadata } from "@/lib/legal-content";
import { dpaDocument } from "@/lib/legal-v2-content";

export const metadata = createLegalPageMetadata(dpaDocument);

export default function DpaPage() {
  return <LegalPageLayout document={dpaDocument} />;
}
