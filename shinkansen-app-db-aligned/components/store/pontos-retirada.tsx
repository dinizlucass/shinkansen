"use client"

import * as React from "react"
import { Instagram, Mail, MapPin, MessageCircle } from "lucide-react"

import { PARADAS, SUPORTE } from "@/lib/store/paradas"

// Versão leve para o checkout: mostra ícones + informações dos pontos e canais,
// SEM links — para o cliente não sair do fluxo de compra por curiosidade.
// Os links (mapa, WhatsApp, Instagram) ficam na página /proxima-parada, exibida
// só depois que a compra é concluída.
const itemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "monospace",
  fontSize: 10,
  color: "var(--foreground)",
}

export function PontosRetirada() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: 2,
          color: "var(--muted-foreground)",
        }}
      >
        PONTOS DE RETIRADA
      </div>

      {PARADAS.map((p) => (
        <div key={p.id} style={itemStyle}>
          <MapPin size={14} style={{ color: "#e5271a", flexShrink: 0 }} />
          <span>
            <strong>{p.nome}</strong>
            <span style={{ color: "var(--muted-foreground)" }}> — {p.bairro}</span>
          </span>
        </div>
      ))}

      <div style={{ height: 1, background: "var(--border)" }} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <span style={itemStyle}>
          <MessageCircle size={14} style={{ color: "#25D366" }} /> {SUPORTE.whatsappExibicao}
        </span>
        <span style={itemStyle}>
          <Instagram size={14} style={{ color: "#E1306C" }} /> {SUPORTE.handle}
        </span>
        <span style={itemStyle}>
          <Mail size={14} style={{ color: "#e5271a" }} /> {SUPORTE.email}
        </span>
      </div>

      <p
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "var(--muted-foreground)",
          margin: 0,
        }}
      >
        Os endereços completos e contatos aparecem ao concluir o pedido.
      </p>
    </div>
  )
}
