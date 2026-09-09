"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PageHeader } from "@/components/layout/PageHeader";
import { NavigationProgress } from "@/components/layout/NavigationProgress";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <NavigationProgress />
      <div className="grid min-h-screen md:grid-cols-[var(--sidebar-w,18rem)_1fr]">
        <aside className="hidden border-r border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:block">
          <Sidebar className="sticky top-0" />
        </aside>

        <div className="flex min-w-0 flex-col">
          <Topbar className="sticky top-0 z-40" />

          <main className="flex-1 bg-gray-50 px-4 py-6 dark:bg-slate-950 md:px-6">
            <PageHeader />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
