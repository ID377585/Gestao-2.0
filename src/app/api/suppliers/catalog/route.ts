import { NextResponse } from "next/server";
import { listSuppliers } from "@/lib/compras/suppliers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const suppliers = await listSuppliers();

    const normalized = (suppliers ?? []).map((supplier: any) => ({
      id: String(supplier.id),
      name: String(
        supplier.razaoSocial ??
          supplier.razao_social ??
          supplier.name ??
          ""
      ),
      document: supplier.cnpj
        ? String(supplier.cnpj)
        : supplier.documento
        ? String(supplier.documento)
        : supplier.document
        ? String(supplier.document)
        : null,
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("[GET /api/suppliers/catalog] erro ao carregar fornecedores:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os fornecedores." },
      { status: 500 }
    );
  }
}