"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Check,
  Copy,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Train,
} from "lucide-react"

import { PARADAS, SUPORTE, ULTIMO_PEDIDO_KEY, type Parada } from "@/lib/store/paradas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProximaParadaPage() {
  const [copiado, setCopiado] = useState<string | null>(null)
  const [pedido, setPedido] = useState<{ id: string; itens: string[] } | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ULTIMO_PEDIDO_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setPedido({
        id: String(parsed?.id ?? ""),
        itens: Array.isArray(parsed?.itens) ? parsed.itens.map(String) : [],
      })
    } catch {
      /* ignora */
    }
  }, [])

  function whatsappHref(p: Parada) {
    const idCurto = pedido?.id ? ` #${pedido.id.slice(0, 8).toUpperCase()}` : ""
    const itens = pedido?.itens?.length ? ` Itens: ${pedido.itens.join(", ")}.` : ""
    const msg = `Olá! Sobre meu pedido${idCurto}.${itens} Parada escolhida: ${p.nome} — ${p.bairro}.`
    return `https://wa.me/${SUPORTE.whatsappNumero}?text=${encodeURIComponent(msg)}`
  }

  async function copiar(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement("textarea")
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
    setCopiado(id)
    window.setTimeout(() => setCopiado((c) => (c === id ? null : c)), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Próxima parada
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Paradas Shinkansen</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Estes são os pontos onde você pode <strong>deixar seus filmes para revelação</strong> ou{" "}
          <strong>retirar seu pedido</strong>. Escolha o mais perto de você.
        </p>
      </header>

      <div className="space-y-6">
        {PARADAS.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                {p.nome}
                <Badge variant="secondary">{p.bairro}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {p.descricao && <p className="text-sm">{p.descricao}</p>}
              {p.detalhe && (
                <p className="text-sm text-muted-foreground">{p.detalhe}</p>
              )}
              {p.metro && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Train className="h-4 w-4" /> {p.metro}
                </p>
              )}

              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src={p.mapsEmbed}
                  title={`Mapa — ${p.nome}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-56 w-full border-0"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={whatsappHref(p)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1 h-4 w-4" /> Quero retirar meu pedido aqui
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={p.maps} target="_blank" rel="noopener noreferrer">
                    <MapPin className="mr-1 h-4 w-4" /> Abrir no Maps
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copiar(p.id, p.maps)}
                >
                  {copiado === p.id ? (
                    <Check className="mr-1 h-4 w-4" />
                  ) : (
                    <Copy className="mr-1 h-4 w-4" />
                  )}
                  {copiado === p.id ? "Link copiado" : "Copiar link"}
                </Button>
                {p.instagram && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={p.instagram} target="_blank" rel="noopener noreferrer">
                      <Instagram className="mr-1 h-4 w-4" /> Instagram
                    </a>
                  </Button>
                )}
                {p.contato && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={p.contato} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-1 h-4 w-4" /> Contato
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suporte */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Fale com a Shinkansen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <a
            href={SUPORTE.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" /> WhatsApp
          </a>
          <a
            href={SUPORTE.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 hover:underline"
          >
            <Instagram className="h-4 w-4 text-[#E1306C]" /> Instagram
          </a>
          <a
            href={`mailto:${SUPORTE.email}`}
            className="inline-flex items-center gap-2 hover:underline"
          >
            <Mail className="h-4 w-4 text-primary" /> {SUPORTE.email}
          </a>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <Button asChild>
          <Link href="/store">Voltar para a loja</Link>
        </Button>
      </div>
    </div>
  )
}
