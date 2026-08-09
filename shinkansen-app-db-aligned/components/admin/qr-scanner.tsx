"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Lê o QR da etiqueta do filme (que contém o código base-36 do id_humano) e
// devolve o texto lido via onResult. A busca da página faz o resto.
export function QrScanner({
  open,
  onClose,
  onResult,
}: {
  open: boolean
  onClose: () => void
  onResult: (text: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setErro(null)
    let controls: IScannerControls | undefined
    let lido = false
    const reader = new BrowserQRCodeReader()

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, _err, ctrl) => {
          controls = ctrl
          if (result && !lido) {
            lido = true
            ctrl.stop()
            onResultRef.current(result.getText())
          }
        },
      )
      .then((c) => {
        controls = c
      })
      .catch((e: unknown) => {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível acessar a câmera. Verifique a permissão do navegador.",
        )
      })

    return () => {
      controls?.stop()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Escanear QR da etiqueta</DialogTitle>
        </DialogHeader>
        {erro ? (
          <p className="text-sm text-red-500">{erro}</p>
        ) : (
          <video
            ref={videoRef}
            className="aspect-square w-full rounded-md bg-black object-cover"
            muted
            playsInline
          />
        )}
        <p className="text-xs text-muted-foreground">
          Aponte a câmera para o QR do filme — ele preenche a busca automaticamente.
        </p>
      </DialogContent>
    </Dialog>
  )
}
