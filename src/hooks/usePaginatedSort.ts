"use client";

import { useEffect, useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

type SortAccessor<T> = (row: T) => unknown;
type SortAccessorMap<T> = Record<string, SortAccessor<T>>;

type UsePaginatedSortParams<T> = {
  rows: T[];
  accessors: SortAccessorMap<T>;
  initialSortKey: string;
  initialSortDirection?: SortDirection;
  initialPageSize?: number;
};

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;

  if (value instanceof Date) return value.getTime();

  const stringValue = String(value).trim();

  const dateValue = Date.parse(stringValue);
  if (!Number.isNaN(dateValue) && /^\d{4}-\d{2}-\d{2}|T/.test(stringValue)) {
    return dateValue;
  }

  const numericValue = Number(stringValue.replace(",", "."));
  if (!Number.isNaN(numericValue) && stringValue !== "") {
    return numericValue;
  }

  return stringValue.toLocaleLowerCase("pt-BR");
}

function compareValues(
  left: unknown,
  right: unknown,
  direction: SortDirection
) {
  const a = normalizeValue(left);
  const b = normalizeValue(right);

  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  let result = 0;

  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    result = String(a).localeCompare(String(b), "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : result * -1;
}

export function usePaginatedSort<T>({
  rows,
  accessors,
  initialSortKey,
  initialSortDirection = "asc",
  initialPageSize = 10,
}: UsePaginatedSortParams<T>) {
  const [sortKey, setSortKey] = useState<string>(initialSortKey);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sortedRows = useMemo(() => {
    const accessor = accessors[sortKey];
    if (!accessor) return rows;

    return [...rows].sort((left, right) =>
      compareValues(accessor(left), accessor(right), sortDirection)
    );
  }, [rows, accessors, sortKey, sortDirection]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedRows.slice(start, end);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (columnKey: string) => {
    if (columnKey === sortKey) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(columnKey);
      setSortDirection("asc");
    }

    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clampedPage);
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    const safePageSize = Math.max(1, nextPageSize);
    setPageSize(safePageSize);
    setCurrentPage(1);
  };

  return {
    sortKey,
    sortDirection,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    sortedRows,
    paginatedRows,
    handleSort,
    handlePageChange,
    handlePageSizeChange,
    setCurrentPage,
    setPageSize,
    setSortKey,
    setSortDirection,
  };
}