"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav className="text-sm text-gray-500">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/dashboard/pedidos" className="hover:text-gray-700">
            Dashboard
          </Link>
        </li>

        {parts.slice(1).map((part, index) => {
          const href = "/" + parts.slice(0, index + 2).join("/");
          return (
            <li key={href} className="flex items-center gap-2">
              <span>/</span>
              <Link
                href={href}
                className="hover:text-gray-700 capitalize"
              >
                {part.replace("-", " ")}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
