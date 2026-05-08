export default function FiscalNfeInboxPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Notas disponíveis</h1>
        <p className="text-sm text-muted-foreground">
          Visualize as NF-e recebidas via integração SEFAZ.
        </p>
      </div>

      <div className="border rounded-xl p-4 bg-card">
        <p className="text-sm">
          Em breve será possível sincronizar automaticamente as notas fiscais do estabelecimento.
        </p>
      </div>
    </div>
  );
}
