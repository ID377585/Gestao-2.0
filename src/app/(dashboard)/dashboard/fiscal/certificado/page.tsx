export default function FiscalCertificatePage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Certificado Digital A1</h1>
        <p className="text-sm text-muted-foreground">
          Configure o certificado digital para consulta automática de NF-e.
        </p>
      </div>

      <div className="border rounded-xl p-4 bg-card">
        <p className="text-sm">
          Em breve será possível enviar o arquivo .PFX/.P12 e conectar com a SEFAZ.
        </p>
      </div>
    </div>
  );
}
