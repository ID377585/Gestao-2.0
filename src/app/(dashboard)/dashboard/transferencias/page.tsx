"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NovaTransferenciaModal } from "@/components/transferencias/NovaTransferenciaModal";

export default function TransferenciasPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Transferências</h1>
        <p className="text-muted-foreground">
          Transferência de produtos entre unidades ou setores.
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between">
        <div />
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Transferência
        </Button>
      </div>

      {/* Estado vazio (por enquanto) */}
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma transferência registrada ainda.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clique em <strong>Nova Transferência</strong> para iniciar.
        </p>
      </div>

      {/* Modal */}
      <NovaTransferenciaModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
