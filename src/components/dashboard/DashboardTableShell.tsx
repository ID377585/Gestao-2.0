"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardTableShellProps = {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  empty?: boolean;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tableWrapperClassName?: string;
};

export function DashboardTableShell({
  title,
  description,
  toolbar,
  footer,
  empty = false,
  emptyState,
  children,
  className,
  contentClassName,
  tableWrapperClassName,
}: DashboardTableShellProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>

          {toolbar ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {toolbar}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={cn("space-y-4", contentClassName)}>
        {empty ? (
          emptyState ?? (
            <p className="text-sm text-muted-foreground">
              Nenhum registro encontrado.
            </p>
          )
        ) : (
          <div
            className={cn(
              "overflow-x-auto rounded-md border",
              tableWrapperClassName
            )}
          >
            {children}
          </div>
        )}

        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}