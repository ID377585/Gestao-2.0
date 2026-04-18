import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type {
  CreateFinancialCategoryInput,
  FinancialCategory,
} from "@/types/compras";

const COLLECTION_NAME = "financialCategories";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeCategory(
  id: string,
  data: Record<string, any>
): FinancialCategory {
  return {
    id,
    codigo: data.codigo ?? "",
    grupo: data.grupo ?? "",
    categoria: data.categoria ?? "",
    subcategoria: data.subcategoria ?? "",
    tipo: data.tipo ?? "despesa",
    ativo: Boolean(data.ativo ?? true),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function listFinancialCategories(): Promise<FinancialCategory[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("grupo", "asc"),
    orderBy("categoria", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeCategory(item.id, item.data())
  );
}

export async function getFinancialCategoryById(
  id: string
): Promise<FinancialCategory | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeCategory(snapshot.id, snapshot.data());
}

export async function createFinancialCategory(
  input: CreateFinancialCategoryInput
) {
  const ref = doc(collection(db, COLLECTION_NAME));

  await setDoc(ref, {
    codigo: input.codigo,
    grupo: input.grupo,
    categoria: input.categoria,
    subcategoria: input.subcategoria ?? "",
    tipo: input.tipo,
    ativo: input.ativo ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateFinancialCategory(params: {
  id: string;
  codigo: string;
  grupo: string;
  categoria: string;
  subcategoria?: string;
  tipo: "receita" | "despesa" | "custo";
  ativo: boolean;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    codigo: params.codigo,
    grupo: params.grupo,
    categoria: params.categoria,
    subcategoria: params.subcategoria ?? "",
    tipo: params.tipo,
    ativo: params.ativo,
    updatedAt: serverTimestamp(),
  });
}