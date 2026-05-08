export type FiscalCertificateStatus = "active" | "expired" | "revoked" | "inactive";

export type FiscalNfeManifestationStatus =
  | "pendente"
  | "ciencia_operacao"
  | "confirmada"
  | "desconhecida"
  | "nao_realizada";

export interface FiscalCertificate {
  id: string;
  establishment_id: string | number;
  cnpj: string;
  certificate_path: string;
  encrypted_password: string;
  expires_at: string | null;
  status: FiscalCertificateStatus;
  created_at: string;
  updated_at?: string;
}

export interface FiscalNfeInboxItem {
  id: string;
  establishment_id: string | number;
  nsu: string | null;
  chave_acesso: string;
  numero: string | null;
  serie: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  valor_total: number | null;
  data_emissao: string | null;
  status_manifestacao: FiscalNfeManifestationStatus;
  xml_path: string | null;
  imported_entry_id: string | null;
  created_at: string;
  updated_at?: string;
}
