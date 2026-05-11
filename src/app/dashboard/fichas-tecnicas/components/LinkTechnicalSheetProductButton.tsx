"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { linkTechnicalSheetToProductAction } from "@/app/(dashboard)/dashboard/fichas-tecnicas/link-actions";

type LinkTechnicalSheetProductButtonProps = {
  technicalSheetId: string;
  isLinkedToProduct?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  onLinked?: () => Promise<void> | void;
};

export default function LinkTechnicalSheetProductButton({
  technicalSheetId,
  isLinkedToProduct = false,
  className,
  size = "sm",
  variant = "outline",
  onLinked,
}: LinkTechnicalSheetProductButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!technicalSheetId || isPending) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("technical_sheet_id", technicalSheetId);

      await linkTechnicalSheetToProductAction(formData);
      await onLinked?.();
    });
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      disabled={isPending || !technicalSheetId}
      onClick={handleClick}
      title="Cria ou atualiza o produto correspondente e garante o item no estoque."
    >
      {isPending
        ? "Atrelando..."
        : isLinkedToProduct
          ? "Atualizar vínculo"
          : "Atrelar ficha técnica"}
    </Button>
  );
}
