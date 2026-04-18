"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/usePaginatedSort";

type SortableHeaderProps = {
  label: string;
  columnKey: string;
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (columnKey: string) => void;
  className?: string;
  align?: "left" | "center" | "right";
};

function getIcon(params: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!params.active) {
    return <ArrowUpDown className="h-4 w-4 opacity-60" />;
  }

  if (params.direction === "asc") {
    return <ArrowUp className="h-4 w-4" />;
  }

  return <ArrowDown className="h-4 w-4" />;
}

export function SortableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  className,
  align = "left",
}: SortableHeaderProps) {
  const isActive = sortKey === columnKey;

  return (
    <TableHead
      className={cn(
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 gap-2 px-1 font-medium hover:bg-transparent",
          align === "left" && "justify-start",
          align === "center" && "justify-center",
          align === "right" && "ml-auto justify-end"
        )}
        onClick={() => onSort(columnKey)}
      >
        <span>{label}</span>
        {getIcon({ active: isActive, direction: sortDirection })}
      </Button>
    </TableHead>
  );
}