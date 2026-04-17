"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type DashboardStatItem = {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
};

type DashboardStatGridProps = {
  items: DashboardStatItem[];
  className?: string;
  columnsClassName?: string;
};

export function DashboardStatGrid({
  items,
  className,
  columnsClassName,
}: DashboardStatGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        columnsClassName,
        className
      )}
    >
      {items.map((item, index) => (
        <Card key={`${item.title}-${index}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            {item.icon ? (
              <div className="text-muted-foreground">{item.icon}</div>
            ) : null}
          </CardHeader>

          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100",
                item.valueClassName
              )}
            >
              {item.value}
            </div>

            {item.description ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}