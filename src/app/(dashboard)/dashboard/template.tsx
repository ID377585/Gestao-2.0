import { Suspense } from "react";
import PedidosSkeleton from "@/components/skeletons/PedidosSkeleton";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<PedidosSkeleton />}>{children}</Suspense>;
}
