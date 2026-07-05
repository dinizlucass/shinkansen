import Link from "next/link"
import { ArrowLeft, AtSign, Instagram, Mail, Phone } from "lucide-react"

import { SUPORTE } from "@/lib/store/paradas"
import { PlantaSSO } from "@/components/contato/planta-sso"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Contato | Shinkansen Films",
  description: "Fale com a Shinkansen Films: e-mail, telefone, Instagram, TikTok e X.",
}

const CANAIS = [
  {
    label: "E-mail",
    valor: SUPORTE.emailContato,
    href: `mailto:${SUPORTE.emailContato}`,
    icon: Mail,
    externo: false,
  },
  {
    label: "Telefone / WhatsApp",
    valor: SUPORTE.whatsappExibicao,
    href: SUPORTE.whatsapp,
    icon: Phone,
    externo: true,
  },
  {
    label: "Instagram",
    valor: SUPORTE.handle,
    href: SUPORTE.instagram,
    icon: Instagram,
    externo: true,
  },
  {
    label: "TikTok",
    valor: SUPORTE.handle,
    href: SUPORTE.tiktok,
    icon: AtSign,
    externo: true,
  },
  {
    label: "X",
    valor: SUPORTE.handle,
    href: SUPORTE.x,
    icon: AtSign,
    externo: true,
  },
]

export default function ContatoPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Início
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Contato</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fale com a Shinkansen Films pelos canais abaixo.
        </p>
      </header>

      <div className="mb-8">
        <PlantaSSO />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canais</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {CANAIS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target={c.externo ? "_blank" : undefined}
              rel={c.externo ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/50"
            >
              <c.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-sm text-muted-foreground">{c.valor}</div>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
