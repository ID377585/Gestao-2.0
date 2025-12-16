import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardShellSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar skeleton */}
        <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-white p-4 space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-36" />
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col">
          {/* Topbar skeleton */}
          <div className="h-16 border-b bg-white flex items-center justify-between px-6">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>

          {/* Page skeleton */}
          <main className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    </div>
  );
}
