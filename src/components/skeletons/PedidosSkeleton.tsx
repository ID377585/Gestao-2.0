import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function PedidosSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Action button */}
      <Skeleton className="h-10 w-40" />

      {/* Board / List */}
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>

        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
