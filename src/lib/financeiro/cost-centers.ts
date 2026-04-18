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
  CostCenter,
  CreateCostCenterInput,
} from "@/types/compras";

const COLLECTION_NAME = "costCenters";

function toIsoDate(value: any): string {
  return value?.toDate?.()?.toISOString?.() ?? "";
}

function normalizeCostCenter(
  id: string,
  data: Record<string, any>
): CostCenter {
  return {
    id,
    codigo: data.codigo ?? "",
    nome: data.nome ?? "",
    descricao: data.descricao ?? "",
    ativo: Boolean(data.ativo ?? true),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  };
}

export async function listCostCenters(): Promise<CostCenter[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("nome", "asc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    normalizeCostCenter(item.id, item.data())
  );
}

export async function getCostCenterById(
  id: string
): Promise<CostCenter | null> {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return normalizeCostCenter(snapshot.id, snapshot.data());
}

export async function createCostCenter(input: CreateCostCenterInput) {
  const ref = doc(collection(db, COLLECTION_NAME));

  await setDoc(ref, {
    codigo: input.codigo,
    nome: input.nome,
    descricao: input.descricao ?? "",
    ativo: input.ativo ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function updateCostCenter(params: {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}) {
  const ref = doc(db, COLLECTION_NAME, params.id);

  await updateDoc(ref, {
    codigo: params.codigo,
    nome: params.nome,
    descricao: params.descricao ?? "",
    ativo: params.ativo,
    updatedAt: serverTimestamp(),
  });
}