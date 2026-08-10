import { redirect } from "next/navigation";

export default function LegacyEntradasPage() {
  redirect("/dashboard/entradas");
}
