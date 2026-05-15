import type { ReactNode } from "react";

import { InlineStockQuantityEditor } from "./InlineStockQuantityEditor";

export default function EstoqueLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <InlineStockQuantityEditor />
    </>
  );
}
