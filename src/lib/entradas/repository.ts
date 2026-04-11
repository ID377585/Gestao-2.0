import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  EntradaDocumento,
  HistoricoCustoProduto,
  MovimentoEstoque,
  Produto,
} from './types';

export async function listarProdutos(): Promise<Produto[]> {
  const snap = await getDocs(collection(db, 'produtos'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Produto) }));
}

export async function criarProduto(produto: Produto): Promise<string> {
  const ref = await addDoc(collection(db, 'produtos'), produto);
  return ref.id;
}

export async function salvarEntrada(entrada: EntradaDocumento): Promise<string> {
  const ref = await addDoc(collection(db, 'entradas'), entrada);
  return ref.id;
}

export async function atualizarEntrada(
  entradaId: string,
  payload: Partial<EntradaDocumento>,
): Promise<void> {
  await updateDoc(doc(db, 'entradas', entradaId), payload);
}

export async function registrarMovimentoEstoque(
  movimento: MovimentoEstoque,
): Promise<string> {
  const ref = await addDoc(collection(db, 'movimentos_estoque'), movimento);
  return ref.id;
}

export async function registrarHistoricoCusto(
  historico: HistoricoCustoProduto,
): Promise<string> {
  const ref = await addDoc(collection(db, 'historico_custo_produto'), historico);
  return ref.id;
}

export async function atualizarProduto(
  produtoId: string,
  payload: Partial<Produto>,
): Promise<void> {
  await updateDoc(doc(db, 'produtos', produtoId), payload);
}

export async function listarHistoricoCustoPorProduto(
  produtoId: string,
): Promise<HistoricoCustoProduto[]> {
  const q = query(
    collection(db, 'historico_custo_produto'),
    where('produtoId', '==', produtoId),
    orderBy('data', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as HistoricoCustoProduto) }));
}

export async function listarEntradas(): Promise<EntradaDocumento[]> {
  const snap = await getDocs(collection(db, 'entradas'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as EntradaDocumento) }));
}