"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

type Props = {
  /**
   * ID do input onde o QR lido deve ser preenchido.
   * O componente vai:
   *  - preencher o value do input
   *  - dar submit no form, se existir (form?.requestSubmit())
   */
  inputId: string;
};

export function QrScannerButton({ inputId }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Inicia / para a câmera quando abre / fecha
  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Seu navegador não permite acesso à câmera.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Usa BarcodeDetector nativo, se existir
        const w = window as any;
        if (!w.BarcodeDetector) {
          setError(
            "Leitura de QR Code pela câmera não é suportada neste navegador."
          );
          return;
        }

        const detector = new w.BarcodeDetector({ formats: ["qr_code"] });

        const scan = async () => {
          if (!open || !videoRef.current) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const rawValue =
                barcodes[0].rawValue || barcodes[0].rawValue || "";
              if (rawValue) {
                // Preenche o input alvo e submete o form
                const input = document.getElementById(
                  inputId
                ) as HTMLInputElement | null;

                if (input) {
                  input.value = String(rawValue);
                  // Se tiver um form associado, submete
                  if (input.form) {
                    input.form.requestSubmit();
                  }
                }

                setOpen(false);
                return;
              }
            }
          } catch (err) {
            console.error("Erro ao detectar QR:", err);
          }

          if (open) {
            requestAnimationFrame(scan);
          }
        };

        requestAnimationFrame(scan);
      } catch (err) {
        console.error("Erro ao iniciar câmera:", err);
        setError("Não foi possível acessar a câmera.");
      }
    }

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="whitespace-nowrap"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Camera className="mr-2 h-4 w-4" />
        Ler QR (câmera)
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-black/90 p-4 text-white shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                Aponte a câmera para o QR Code
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Fechar
              </Button>
            </div>

            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="mt-2 w-full rounded-md bg-black"
              />
            )}

            <p className="mt-2 text-[11px] text-gray-300">
              Assim que o código for reconhecido, o campo será preenchido e o
              formulário enviado automaticamente.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
