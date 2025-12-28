export default function AcessoServicosPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Acesso pendente</h1>
      <p style={{ marginTop: 12 }}>
        Seu usuário está autenticado, mas ainda não possui um <b>membership ativo</b>.
      </p>
      <p style={{ marginTop: 8 }}>
        Peça ao administrador para vincular sua conta a uma unidade/estabelecimento.
      </p>
    </div>
  );
}
