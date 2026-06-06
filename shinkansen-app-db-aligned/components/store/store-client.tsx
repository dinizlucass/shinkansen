"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Volume2, VolumeX, X, Loader2, Tag, Check } from "lucide-react"
import type { User } from "@supabase/supabase-js"

import type { Product, DeliveryType } from "@/lib/store/types"
import type { OpcaoFrete } from "@/lib/store/melhor-envio"
import { useCart } from "@/lib/store/use-cart"
import { AnimatedTotal } from "@/components/store/animated-total"
import { DiagonalBg } from "@/components/store/diagonal-bg"
import AnimatedLogo from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { StoreMobile } from "@/components/store/store-mobile"

interface PerfilLoja { adress: string | null; cpf: string | null }
interface StoreClientProps {
  user:               User | null
  products:           Product[]
  perfil:             PerfilLoja | null
  negativosPendentes: number
}

// Botão de copiar com feedback visual
function CopyButton({ text }: { text: string }) {
  const [copiado, setCopiado] = React.useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* fallback: o input já tem onFocus select */ }
  }
  return (
    <button onClick={copiar} style={{
      padding: "4px 10px", borderRadius: 3, cursor: "pointer",
      fontFamily: "monospace", fontSize: 9, fontWeight: 700,
      border: copiado ? "1px solid #22c55e" : "1px solid var(--border)",
      background: copiado ? "rgba(34,197,94,0.15)" : "var(--muted)",
      color: copiado ? "#22c55e" : "var(--foreground)",
      transition: "all 0.2s",
    }}>
      {copiado ? "COPIADO ✓" : "COPIAR"}
    </button>
  )
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])
  return isMobile
}

const CATEGORIA_LABEL: Record<string, string> = {
  filme_35mm: "35MM", filme_120: "120", camera: "CÂMERA",
  camera_recarregavel: "CÂMERA", acessorio: "ACESSÓRIO", outro: "OUTRO",
}

// Duas opções apenas
const ENTREGA_LABEL: Record<DeliveryType, string> = {
  envio:    "Envio pelos Correios",
  retirada: "Retirada no Lab",
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// ─────────────────────────────────────────────────────────────────────
// BARRAS DE STATS — AJUSTE FINO
// ─────────────────────────────────────────────────────────────────────
// getValue: retorna 0.0–1.0 (quanto a barra enche)
// height da barra: "height: 6" no motion.div — aumente para barras mais grossas
// color: campo color de cada entrada
// ── Badge de processo ────────────────────────────────────────────────

const PROCESS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  c41:  { bg: "#f97316", color: "#fff",  label: "C41" },
  ecn2: { bg: "#38bdf8", color: "#000",  label: "ECN2" },
  e6:   { bg: "#38bdf8", color: "#000",  label: "E6" },
  d76:  { bg: "#e8e8e8", color: "#111",  label: "D76" },
  "p&b":{ bg: "#e8e8e8", color: "#111",  label: "P&B" },
}

function ProcessBadge({ process }: { process: string }) {
  const p = PROCESS_BADGE[process.toLowerCase()]
  if (!p) return null
  return (
    <span style={{
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 12,
      fontWeight: 700,
      padding: "10px 8px",
      borderRadius: 3,
      background: p.bg,
      color: p.color,
      letterSpacing: "0.05em",
      flexShrink: 0,
      lineHeight: 1,
    }}>
      {p.label}
    </span>
  )
}

// ── Algoritmo de dificuldade ─────────────────────────────────────────

function calcDificuldade(iso: number, isPB: boolean): { nivel: number; pct: number; estrelas: string } {
  let diff: number
  if (iso <= 12) {
    diff = 4 + (12 - iso) / 12
  } else if (iso <= 200) {
    diff = 4 - (iso - 12) / (200 - 12)
  } else if (iso <= 400) {
    diff = 3 - (iso - 200) / (400 - 200)
  } else {
    diff = 2 - (iso - 400) / 400
  }
  if (isPB) diff -= 1
  diff = Math.max(0.2, Math.min(5, diff))
  const nivel = Math.max(1, Math.min(5, Math.round(diff)))
  const pct   = Math.max(0.04, diff / 5)
  const estrelas = ["★☆☆☆☆","★★☆☆☆","★★★☆☆","★★★★☆","★★★★★"][nivel - 1]
  return { nivel, pct, estrelas }
}

// ── Barras de stats ──────────────────────────────────────────────────

const STAT_BARS: Array<{
  label: string
  getValue: (p: Product) => number | null
  getLabel: (p: Product) => string
  color: string
}> = [
  {
    label: "ISO",
    getValue: p => p.iso ? Math.min(p.iso / 800, 1) : null,
    getLabel: p => p.iso ? String(p.iso) : "—",
    color: "#e5271a",
  },
  {
    label: "POSES",
    getValue: p => p.exposures ? Math.min(p.exposures / 36, 1) : null,
    getLabel: p => p.exposures ? String(p.exposures) : "—",
    color: "#f5c400",
  },
  {
    label: "DIFICULDADE",
    getValue: p => {
      if (p.category === "camera_recarregavel") return 0.2
      if (!["filme_35mm", "filme_120", "camera"].includes(p.category)) return null
      if (!p.iso) return null
      const proc = (p.process ?? "").toUpperCase()
      const isPB = proc === "P&B" || proc.includes("D76")
      return calcDificuldade(p.iso, isPB).pct
    },
    getLabel: p => {
      if (p.category === "camera_recarregavel") return "★☆☆☆☆"
      if (!["filme_35mm", "filme_120", "camera"].includes(p.category)) return "—"
      if (!p.iso) return "—"
      const proc = (p.process ?? "").toUpperCase()
      const isPB = proc === "P&B" || proc.includes("D76")
      return calcDificuldade(p.iso, isPB).estrelas
    },
    color: "#8a1176",
  },
]

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

export function StoreClient({ user, products, perfil, negativosPendentes }: StoreClientProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <StoreMobile user={user} products={products} perfil={perfil} negativosPendentes={negativosPendentes} />
  }

  return <StoreDesktop user={user} products={products} perfil={perfil} negativosPendentes={negativosPendentes} />
}

// ═══════════════════════════════════════════════════════════════════════
// LAYOUT DESKTOP — componente separado para não violar regra dos hooks
// ═══════════════════════════════════════════════════════════════════════

function StoreDesktop({ user, products, perfil, negativosPendentes }: StoreClientProps) {
  const cart = useCart()
  const [selecionado, setSelecionado] = React.useState<Product | null>(products[0] ?? null)
  const [selecionadoId, setSelId]     = React.useState<string | null>(null)
  const [muted, setMuted]             = React.useState(true)
  const [checkoutAberto, setCheckout] = React.useState(false)
  const [flashId, setFlashId]         = React.useState<string | null>(null)
  const [logoFrame, setLogoFrame]     = React.useState(0)

  React.useEffect(() => {
    const id = setInterval(() => setLogoFrame(f => (f + 1) % 3), 2400)
    return () => clearInterval(id)
  }, [])

  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  React.useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.muted  = muted
    audioRef.current.volume = 0.3
    if (!muted) audioRef.current.play().catch(() => {})
  }, [muted])

  function clicarThumb(p: Product) {
    if (p.stock_quantity <= 0) return
    if (selecionadoId === p.id) {
      if (!cart.podeAdicionar(p)) return
      cart.adicionar(p, 1)
      setFlashId(p.id)
      setTimeout(() => setFlashId(null), 350)
      setSelId(null)
    } else {
      setSelecionado(p)
      setSelId(p.id)
    }
  }

  const THUMBS_PER_ROW = 4
  const rows: Product[][] = []
  for (let i = 0; i < products.length; i += THUMBS_PER_ROW) {
    rows.push(products.slice(i, i + THUMBS_PER_ROW))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <audio ref={audioRef} loop src="/store-bgm.mp3" />

      {/* HEADER */}
      <header style={{
        background: "var(--card)", borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: 52, display: "flex", alignItems: "center",
        gap: 16, flexShrink: 0, position: "sticky", top: 0, zIndex: 30,
      }}>
        <Link href="/"><AnimatedLogo className="w-10 h-auto" /></Link>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "var(--muted-foreground)", letterSpacing: "0.3em" }}>MONTE SEU TIME</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 15, color: "#e5271a", letterSpacing: "0.15em", marginTop: 2 }}>SELECT YOUR FILMS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GameMenuNav user={user} variant="horizontal" />
          <GlitchSKS />
          <button onClick={() => setMuted(m => !m)} style={{ width: 34, height: 34, border: "1px solid var(--border)", borderRadius: 6, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} color="#e5271a" />}
          </button>
        </div>
      </header>

      {/* CORPO 3 COLUNAS */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px 1fr 260px", overflow: "hidden", minHeight: 0 }}>

        {/* COL ESQUERDA: FICHA */}
        <aside style={{ borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)" }}>
          <AnimatePresence mode="wait">
            {selecionado && (
              <motion.div key={selecionado.id}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22 }}
                style={{ display: "flex", flexDirection: "column", height: "100%", padding: 12, gap: 10, overflow: "hidden" }}
              >
                <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: 4, overflow: "hidden", background: "#0d0d0d", flexShrink: 0 }}>
                  <FichaImagem product={selecionado} />
                </div>
                <div style={{ flexShrink: 0 }}>
                  {selecionado.brand && (
                    <div style={{ fontSize: 15, letterSpacing: "0.15em", color: "#e5271a", textTransform: "uppercase" }}>{selecionado.brand}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase", flex: 1 }}>{selecionado.name}</div>
                    {selecionado.process && <ProcessBadge process={selecionado.process} />}
                  </div>
                  <div style={{ fontSize: 18, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {CATEGORIA_LABEL[selecionado.category] ?? selecionado.category}
                    {selecionado.stock_quantity > 0 ? ` · ${selecionado.stock_quantity} em estoque` : " · ESGOTADO"}
                  </div>
                </div>

                {/* Barras de stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {STAT_BARS.map(({ label, getValue, getLabel, color }) => {
                    const val = getValue(selecionado)
                    if (val === null) return null
                    const isDificuldade = label === "DIFICULDADE"
                    return (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: isDificuldade ? 4 : 0 }}>
                        {isDificuldade && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 15, color, letterSpacing: "0.1em", fontWeight: 700 }}>{label}</span>
                            <span style={{ fontSize: 13, color }}>{getLabel(selecionado)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {!isDificuldade && (
                            <span style={{ fontSize: 15, color: "var(--muted-foreground)", width: 92, flexShrink: 0 }}>{label}</span>
                          )}
                          <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 2, overflow: "hidden" }}>
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${val * 100}%` }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              style={{ height: "100%", background: color, borderRadius: 2, opacity: 0.85 }}
                            />
                          </div>
                          {!isDificuldade && (
                            <span style={{ fontSize: 15, color: "var(--muted-foreground)", width: 38, textAlign: "right", flexShrink: 0 }}>{getLabel(selecionado)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ height: 1, background: "var(--border)", flexShrink: 0 }} />
                {selecionado.description && (
                  <div style={{ fontSize: 15, color: "var(--muted-foreground)", lineHeight: 1.7, flex: 1, overflow: "hidden" }}>
                    {selecionado.description}
                  </div>
                )}
                <div style={{ flexShrink: 0, marginTop: "auto" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#e5271a", marginBottom: 6 }}>{brl(selecionado.price)}</div>
                  <button
                    onClick={() => {
                      if (!cart.podeAdicionar(selecionado)) return
                      cart.adicionar(selecionado, 1)
                      setFlashId(selecionado.id)
                      setTimeout(() => setFlashId(null), 350)
                    }}
                    disabled={selecionado.stock_quantity <= 0 || !cart.podeAdicionar(selecionado)}
                    style={{ width: "100%", padding: "10px 0", background: "#e5271a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 9, letterSpacing: "0.1em", opacity: selecionado.stock_quantity <= 0 ? 0.3 : 1 }}
                  >
                    + ADICIONAR O FILME
                  </button>
                  {selecionadoId === selecionado.id && (
                    <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                      2° clique na thumb também adiciona
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* COL CENTRAL: GRADE */}
        <main style={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          <DiagonalBg />
          {selecionado && (
            <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center", pointerEvents: "none", userSelect: "none", zIndex: 0 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 72, fontWeight: 700, color: "#e5271a", opacity: 0.04, letterSpacing: 14, whiteSpace: "nowrap", transform: "translateX(6px) translateY(3px)" }}>{selecionado.name.toUpperCase()}</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 72, fontWeight: 700, color: "#7fced5", opacity: 0.05, letterSpacing: 14, whiteSpace: "nowrap", transform: "translateX(-4px)", marginTop: -80 }}>{selecionado.name.toUpperCase()}</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 72, fontWeight: 700, color: "#e5271a", opacity: 0.18, letterSpacing: 14, whiteSpace: "nowrap", marginTop: -80 }}>{selecionado.name.toUpperCase()}</div>
            </div>
          )}

          <div style={{ padding: "20px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, zIndex: 1 }}>
            <motion.div key={logoFrame} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
              <AnimatedLogo className="w-48 h-auto" />
            </motion.div>
            <InfinityTimer />
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 24px", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {rows.map((row, rowIdx) => {
                const offset = (rowIdx % 2) * 38 + (rowIdx % 3) * 12
                return (
                  <div key={rowIdx} style={{ display: "flex", gap: 8, marginLeft: offset }}>
                    {row.map((p, i) => {
                      const noCarrinho    = cart.items.find(it => it.product.id === p.id)
                      const isSelecionado = selecionadoId === p.id
                      const semEstoque    = p.stock_quantity <= 0
                      const isFlash       = flashId === p.id
                      let borderColor = "var(--border)"
                      let bgColor     = "var(--card)"
                      if (isSelecionado)  { borderColor = "#e5271a"; bgColor = "#1a0a00" }
                      else if (noCarrinho){ borderColor = "#22c55e"; bgColor = "#0a1a0a" }
                      return (
                        <motion.div key={p.id}
                          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (rowIdx * THUMBS_PER_ROW + i) * 0.04 }}
                          onClick={() => clicarThumb(p)}
                          style={{ width: 160, height: 160, flexShrink: 0, border: `2px solid ${borderColor}`, borderRadius: 4, background: bgColor, position: "relative", cursor: semEstoque ? "not-allowed" : "pointer", overflow: "hidden", filter: semEstoque ? "grayscale(1)" : "none", opacity: semEstoque ? 0.45 : 1, transition: "border-color 0.15s, background 0.15s" }}
                        >
                          <img src={p.images.thumb} alt={p.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <AnimatePresence>
                            {isFlash && (
                              <motion.div initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }}
                                style={{ position: "absolute", inset: 0, background: "#e5271a", pointerEvents: "none" }} />
                            )}
                          </AnimatePresence>
                          {isSelecionado && (
                            <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: "14px solid #e5271a", borderLeft: "14px solid transparent" }} />
                          )}
                          {noCarrinho && (
                            <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
                              style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, background: "#e5271a", color: "#fff", fontFamily: "monospace", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {noCarrinho.quantity}
                            </motion.div>
                          )}
                          {noCarrinho && (
                            <motion.div animate={{ opacity: [0, 0.35, 0] }} transition={{ duration: 2, repeat: Infinity }}
                              style={{ position: "absolute", inset: 0, border: "2px solid #22c55e", borderRadius: 4, pointerEvents: "none" }} />
                          )}
                          {semEstoque && (
                            <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                              <div style={{ position: "absolute", left: "50%", top: "50%", width: "160%", background: "#e5271a", padding: "3px 0", transform: "translate(-50%,-50%) rotate(-32deg)", textAlign: "center" }}>
                                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#fff", letterSpacing: 1 }}>ESGOTADO</span>
                              </div>
                            </div>
                          )}
                          <div style={{ position: "absolute", bottom: 0, insetInline: 0, background: "rgba(0,0,0,0.6)", padding: "2px 4px", fontFamily: "monospace", fontSize: 8, color: isSelecionado ? "#e5271a" : noCarrinho ? "#22c55e" : "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name.split(" ").slice(0, 2).join(" ")}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 20, fontFamily: "monospace", fontSize: 8, color: "var(--border)", letterSpacing: 3 }}>
              1° CLIQUE SELECIONA · 2° ADICIONA
            </div>
          </div>
        </main>

        {/* COL DIREITA: CARRINHO */}
        <aside style={{ borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)" }}>
          <div style={{ padding: "12px 12px 6px", flexShrink: 0 }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "var(--muted-foreground)", letterSpacing: 3, textTransform: "uppercase" }}>Time selecionado</div>
          </div>
          <div style={{ height: 1, background: "var(--border)", flexShrink: 0 }} />
          <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence mode="popLayout">
              {cart.items.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ height: 56, borderRadius: 4, border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 8, color: "var(--border)" }}>
                      SLOT VAZIO
                    </div>
                  ))}
                </motion.div>
              )}
              {cart.items.map(item => (
                <motion.div key={item.product.id} layout
                  initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ display: "flex", gap: 8, padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--background)", alignItems: "flex-start" }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 3, overflow: "hidden", flexShrink: 0, background: "#0d0d0d" }}>
                    <img src={item.product.images.thumb} alt={item.product.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.product.name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>
                      {CATEGORIA_LABEL[item.product.category]}
                      {item.product.iso ? ` · ISO${item.product.iso}` : ""}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 18, color: "#e5271a", marginTop: 2 }}>
                      {brl(item.product.price)}{item.quantity > 1 && ` × ${item.quantity}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => cart.remover(item.product.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => cart.alterarQuantidade(item.product.id, item.quantity - 1)} style={{ width: 18, height: 18, border: "1px solid var(--border)", borderRadius: 2, background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      <span style={{ fontFamily: "monospace", fontSize: 10, minWidth: 14, textAlign: "center" }}>{item.quantity}</span>
                      <button onClick={() => cart.alterarQuantidade(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock_quantity} style={{ width: 18, height: 18, border: "1px solid var(--border)", borderRadius: 2, background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: item.quantity >= item.product.stock_quantity ? 0.3 : 1 }}>+</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 9, color: "var(--muted-foreground)" }}>
              <span>SUBTOTAL</span>
              <span><AnimatedTotal value={cart.subtotal} /></span>
            </div>
            <CupomField subtotal={cart.subtotal} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "monospace" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)" }}>TOTAL</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#e5271a" }}><AnimatedTotal value={cart.subtotal} /></span>
            </div>
            <button onClick={() => setCheckout(true)} disabled={cart.items.length === 0}
              style={{ padding: "11px 0", background: "#e5271a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 10, letterSpacing: "0.1em", opacity: cart.items.length === 0 ? 0.3 : 1, transition: "opacity 0.2s" }}>
              CHECKOUT
            </button>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {checkoutAberto && (
          <CheckoutModal cart={cart} user={user} perfil={perfil} negativosPendentes={negativosPendentes}
            onClose={() => setCheckout(false)} onSuccess={() => { cart.limpar(); setCheckout(false) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────

function FichaImagem({ product }: { product: Product }) {
  const [aba, setAba] = React.useState<"package" | "sample">("package")
  return (
    <>
      <img src={aba === "package" ? product.images.package : product.images.sample} alt={product.name} draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", bottom: 6, left: 6, display: "flex", gap: 4 }}>
        {(["package", "sample"] as const).map(v => (
          <button key={v} onClick={() => setAba(v)} style={{ fontFamily: "monospace", fontSize: 7, padding: "2px 6px", borderRadius: 2, background: aba === v ? "#e5271a" : "rgba(0,0,0,0.7)", color: aba === v ? "#fff" : "#888", border: "none", cursor: "pointer", textTransform: "uppercase" }}>
            {v === "package" ? "EMBAL." : "EXEMPLO"}
          </button>
        ))}
      </div>
    </>
  )
}

function InfinityTimer() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 24 }}>
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="inf-grad" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e5271a" stopOpacity="0.2" />
            <stop offset="40%" stopColor="#e5271a" stopOpacity="1" />
            <stop offset="60%" stopColor="#e5271a" stopOpacity="1" />
            <stop offset="100%" stopColor="#e5271a" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M 12 12 C 12 6, 4 6, 4 12 C 4 18, 12 18, 24 12 C 36 6, 44 6, 44 12 C 44 18, 36 18, 24 12 C 12 6, 12 6, 12 12 Z" stroke="url(#inf-grad)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle r="3" fill="#e5271a"><animateMotion dur="2.4s" repeatCount="indefinite" path="M 12 12 C 12 6, 4 6, 4 12 C 4 18, 12 18, 24 12 C 36 6, 44 6, 44 12 C 44 18, 36 18, 24 12 C 12 6, 12 6, 12 12 Z" /></circle>
        <circle r="1.5" fill="#e5271a" opacity="0.4"><animateMotion dur="2.4s" begin="0.12s" repeatCount="indefinite" path="M 12 12 C 12 6, 4 6, 4 12 C 4 18, 12 18, 24 12 C 36 6, 44 6, 44 12 C 44 18, 36 18, 24 12 C 12 6, 12 6, 12 12 Z" /></circle>
      </svg>
    </div>
  )
}

function GlitchSKS() {
  return (
    <div style={{ position: "relative", fontFamily: "'Press Start 2P', monospace", fontSize: 14, userSelect: "none" }}>
      <span style={{ position: "relative", zIndex: 1, color: "#e5271a" }}>SKS</span>
      <motion.span aria-hidden style={{ position: "absolute", inset: 0, color: "#7fced5" }}
        animate={{ x: [0,-2,2,-1,0,0,0], opacity: [0,0.8,0.6,0.9,0,0,0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times:[0,0.05,0.1,0.15,0.2,0.6,1] }}>SKS</motion.span>
      <motion.span aria-hidden style={{ position: "absolute", inset: 0, color: "#ff0601" }}
        animate={{ x: [0,2,-2,1,0,0,0], opacity: [0,0.7,0.5,0.8,0,0,0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times:[0,0.05,0.1,0.15,0.2,0.6,1] }}>SKS</motion.span>
    </div>
  )
}

function CupomField({ subtotal }: { subtotal: number }) {
  const [code, setCode]         = React.useState("")
  const [aplicado, setAplicado] = React.useState<{ code: string; discount: number } | null>(null)
  const [erro, setErro]         = React.useState("")
  const [loading, setLoading]   = React.useState(false)

  async function aplicar() {
    if (!code.trim()) return
    setLoading(true); setErro("")
    try {
      const res  = await fetch("/api/store/validate-coupon", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ code: code.trim(), subtotal }) })
      const data = await res.json()
      if (!data.ok) { setErro(data.error ?? "Cupom inválido"); return }
      setAplicado({ code: data.coupon.code, discount: data.coupon.discount })
    } catch { setErro("Erro ao validar") } finally { setLoading(false) }
  }

  if (aplicado) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"4px 8px", border:"1px solid #22c55e", borderRadius:3, background:"rgba(34,197,94,0.05)" }}>
      <span style={{ fontFamily:"monospace", fontSize:9, color:"#22c55e" }}>
        <Tag size={10} style={{ marginRight:4, verticalAlign:"middle" }} />
        {aplicado.code} − {brl(aplicado.discount)}
      </span>
      <button onClick={() => { setAplicado(null); setCode("") }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)", fontSize:10 }}>✕</button>
    </div>
  )

  return (
    <div>
      <div style={{ display:"flex", gap:4 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CUPOM" onKeyDown={e => e.key === "Enter" && aplicar()}
          style={{ flex:1, background:"var(--background)", border:"1px solid var(--border)", borderRadius:3, padding:"4px 8px", fontFamily:"monospace", fontSize:9, color:"var(--foreground)", outline:"none", textTransform:"uppercase" }} />
        <button onClick={aplicar} disabled={loading || !code.trim()} style={{ padding:"4px 10px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:3, cursor:"pointer", fontFamily:"monospace", fontSize:8, color:"var(--foreground)", opacity: loading || !code.trim() ? 0.4 : 1 }}>
          {loading ? "..." : "OK"}
        </button>
      </div>
      {erro && <div style={{ fontFamily:"monospace", fontSize:8, color:"#e5271a", marginTop:2 }}>{erro}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CHECKOUT MODAL
// ═══════════════════════════════════════════════════════════════════════

function CheckoutModal({ cart, user, perfil, negativosPendentes, onClose, onSuccess }: {
  cart: ReturnType<typeof useCart>
  user: User | null
  perfil: PerfilLoja | null
  negativosPendentes: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [entrega, setEntrega]         = React.useState<DeliveryType>("retirada")
  const [endereco, setEndereco]       = React.useState(perfil?.adress ?? "")
  const [cpf, setCpf]                 = React.useState(perfil?.cpf ?? "")
  const [cep, setCep]                 = React.useState("")
  const [salvarPerfil, setSalvar]     = React.useState(false)
  const [incluirNegativos, setIncluir]= React.useState(false)
  const [cupomAplicado, setCupom]     = React.useState<{ code: string; discount: number } | null>(null)
  const [opcoesFrete, setOpcoes]      = React.useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFrete]  = React.useState<OpcaoFrete | null>(null)
  const [calculandoFrete, setCalc]    = React.useState(false)
  const [freteErro, setFreteErro]     = React.useState("")
  const [enviando, setEnviando]       = React.useState(false)
  const [erro, setErro]               = React.useState("")
  const [pixGerado, setPixGerado]     = React.useState<{ copia_cola: string; qr_base64: string; valor: number } | null>(null)
  const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null)

  async function retryPix() {
    if (!pendingOrderId) return
    setErro(""); setEnviando(true)
    try {
      const pixRes  = await fetch("/api/store/payment/create-pix", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ order_id: pendingOrderId }) })
      const pixData = await pixRes.json()
      if (pixData.ok) { setPendingOrderId(null); setPixGerado(pixData.pix) }
      else setErro(pixData.error ?? "Falha ao gerar Pix.")
    } catch { setErro("Erro de conexão.") } finally { setEnviando(false) }
  }

  const precisaEnvio = entrega === "envio"
  const desconto     = cupomAplicado?.discount ?? 0
  const valorFrete   = precisaEnvio ? (freteSelecionado?.preco ?? 0) : 0
  const total        = Math.max(0, cart.subtotal - desconto) + valorFrete

  function formatarCpf(v: string) {
    const d = v.replace(/\D/g,"").slice(0,11)
    return d.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2")
  }
  function formatarCep(v: string) {
    return v.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d)/,"$1-$2")
  }
  function cpfValido(v: string) { return v.replace(/\D/g,"").length === 11 }

  async function calcularFrete() {
    const cepLimpo = cep.replace(/\D/g,"")
    if (cepLimpo.length !== 8) { setFreteErro("CEP inválido."); return }
    setCalc(true); setFreteErro(""); setOpcoes([]); setFrete(null)
    try {
      const res  = await fetch("/api/store/calculate-shipping", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ cep: cepLimpo, items: cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity })) }) })
      const data = await res.json()
      if (!data.ok) { setFreteErro(data.error ?? "Erro ao calcular frete."); return }
      setOpcoes(data.opcoes)
      if (data.opcoes.length) setFrete(data.opcoes[0])
    } catch { setFreteErro("Erro ao calcular frete.") } finally { setCalc(false) }
  }

  async function finalizar() {
    if (!user) { setErro("Faça login para finalizar."); return }
    if (precisaEnvio && !endereco.trim()) { setErro("Informe o endereço."); return }
    if (precisaEnvio && !cpfValido(cpf))  { setErro("CPF inválido."); return }
    if (precisaEnvio && !freteSelecionado){ setErro("Calcule o frete."); return }
    setEnviando(true); setErro("")
    try {
      const res  = await fetch("/api/store/create-order", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          items: cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity, unit_price: i.product.price })),
          delivery_type:    entrega,
          shipping_address: precisaEnvio ? endereco.trim() : null,
          cpf:              precisaEnvio ? cpf.replace(/\D/g,"") : null,
          cep:              precisaEnvio ? cep.replace(/\D/g,"") : null,
          shipping_option:  freteSelecionado,
          coupon_code:      cupomAplicado?.code ?? null,
          salvar_perfil:    precisaEnvio && salvarPerfil,
          incluir_negativos: precisaEnvio && incluirNegativos,
        }),
      })
      const data = await res.json()
      if (!data.ok) { setErro(data.error ?? "Erro ao criar pedido"); return }
      const pixRes  = await fetch("/api/store/payment/create-pix", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ order_id: data.order.id }) })
      const pixData = await pixRes.json()
      if (pixData.ok) setPixGerado(pixData.pix)
      else {
        // Pedido foi criado mas Pix falhou — mostra erro com opção de tentar de novo
        const msg = pixData.error ?? "Falha ao gerar Pix."
        setErro(`Pedido criado! ${msg}`)
        // Se retryable, guarda o order_id para tentar gerar o Pix de novo
        if (pixData.retryable && data.order?.id) {
          setPendingOrderId(data.order.id)
        } else {
          onSuccess()
        }
      }
    } catch { setErro("Erro ao processar o pedido.") } finally { setEnviando(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:50 }} />
      <motion.div initial={{ opacity:0, scale:0.95, y:20 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.95 }}
        style={{ position:"fixed", inset:0, zIndex:60, display:"flex", alignItems:"center", justifyContent:"center", padding:16, pointerEvents:"none" }}>
        <div style={{ background:"var(--card)", border:"2px solid #e5271a", borderRadius:8, width:"100%", maxWidth:460, maxHeight:"90vh", overflowY:"auto", pointerEvents:"auto" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--card)", zIndex:1 }}>
            <span style={{ fontFamily:"'Press Start 2P', monospace", fontSize:11, color:"#e5271a" }}>CHECKOUT</span>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)" }}><X size={16} /></button>
          </div>

          <div style={{ padding:16, display:"flex", flexDirection:"column", gap:14 }}>
            {pixGerado ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center" }}>
                <p style={{ fontFamily:"monospace", fontSize:11 }}>Pedido criado! Pague com Pix.</p>
                <div style={{ background:"#fff", padding:8, borderRadius:6 }}>
                  <img src={pixGerado.qr_base64} alt="QR Code Pix" style={{ width:180, height:180 }} />
                </div>
                <p style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#e5271a" }}>{brl(pixGerado.valor)}</p>
                <div style={{ width:"100%", display:"flex", gap:6 }}>
                  <input readOnly value={pixGerado.copia_cola} style={{ flex:1, background:"var(--background)", border:"1px solid var(--border)", borderRadius:3, padding:"4px 8px", fontFamily:"monospace", fontSize:9, color:"var(--foreground)" }} onFocus={e => e.target.select()} />
                  <CopyButton text={pixGerado.copia_cola} />
                </div>
                <button onClick={onSuccess} style={{ width:"100%", padding:12, background:"#e5271a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontFamily:"'Press Start 2P', monospace", fontSize:10 }}>CONCLUIR</button>
              </div>
            ) : (
              <>
                {/* Resumo */}
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {cart.items.map(i => (
                    <div key={i.product.id} style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:10 }}>
                      <span style={{ color:"var(--muted-foreground)" }}>{i.quantity}× {i.product.name}</span>
                      <span>{brl(i.product.price * i.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Entrega — duas opções */}
                <div>
                  <div style={{ fontFamily:"monospace", fontSize:9, color:"var(--muted-foreground)", letterSpacing:2, marginBottom:6 }}>ENTREGA</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {(Object.keys(ENTREGA_LABEL) as DeliveryType[]).map(tipo => (
                      <button key={tipo} onClick={() => setEntrega(tipo)} style={{
                        padding:"12px 8px", border:`2px solid ${entrega === tipo ? "#e5271a" : "var(--border)"}`,
                        borderRadius:4, background: entrega === tipo ? "rgba(229,39,26,0.08)" : "transparent",
                        cursor:"pointer", fontFamily:"monospace", fontSize:10,
                        color: entrega === tipo ? "#e5271a" : "var(--muted-foreground)",
                        textAlign:"center", lineHeight:1.4,
                      }}>
                        {ENTREGA_LABEL[tipo]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos de envio */}
                {precisaEnvio && (
                  <>
                    <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo"
                      style={{ background:"var(--background)", border:"1px solid var(--border)", borderRadius:3, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"var(--foreground)", outline:"none" }} />
                    <input value={cpf} onChange={e => setCpf(formatarCpf(e.target.value))} placeholder="CPF (necessário para envio)" inputMode="numeric"
                      style={{ background:"var(--background)", border:"1px solid var(--border)", borderRadius:3, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"var(--foreground)", outline:"none" }} />

                    {/* Frete */}
                    <div>
                      <div style={{ display:"flex", gap:6 }}>
                        <input value={cep} onChange={e => setCep(formatarCep(e.target.value))} placeholder="CEP" inputMode="numeric"
                          style={{ flex:1, background:"var(--background)", border:"1px solid var(--border)", borderRadius:3, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"var(--foreground)", outline:"none" }} />
                        <button onClick={calcularFrete} disabled={calculandoFrete || cep.replace(/\D/g,"").length !== 8}
                          style={{ padding:"6px 12px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:3, cursor:"pointer", fontFamily:"monospace", fontSize:9, opacity: calculandoFrete || cep.replace(/\D/g,"").length !== 8 ? 0.4 : 1 }}>
                          {calculandoFrete ? <Loader2 size={12} className="animate-spin" /> : "CALCULAR"}
                        </button>
                      </div>
                      {freteErro && <div style={{ fontFamily:"monospace", fontSize:8, color:"#e5271a", marginTop:4 }}>{freteErro}</div>}
                      {opcoesFrete.map(op => (
                        <button key={op.id} onClick={() => setFrete(op)} style={{
                          width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"8px 10px", marginTop:4,
                          border:`1px solid ${freteSelecionado?.id === op.id ? "#e5271a" : "var(--border)"}`,
                          borderRadius:3, background: freteSelecionado?.id === op.id ? "rgba(229,39,26,0.08)" : "transparent",
                          cursor:"pointer", fontFamily:"monospace", fontSize:9,
                          color: freteSelecionado?.id === op.id ? "#e5271a" : "var(--foreground)",
                        }}>
                          <span>{op.empresa} {op.nome}</span>
                          <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700 }}>
                            {brl(op.preco)} · {op.prazo}d
                          </span>
                        </button>
                      ))}
                    </div>

                    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                      <input type="checkbox" checked={salvarPerfil} onChange={e => setSalvar(e.target.checked)} style={{ accentColor:"#e5271a" }} />
                      <span style={{ fontFamily:"monospace", fontSize:9, color:"var(--muted-foreground)" }}>Salvar endereço e CPF no perfil</span>
                    </label>

                    {negativosPendentes > 0 && (
                      <button onClick={() => setIncluir(v => !v)} style={{ display:"flex", alignItems:"center", gap:10, padding:10, border:`1px solid ${incluirNegativos ? "#e5271a" : "var(--border)"}`, borderRadius:6, background: incluirNegativos ? "rgba(229,39,26,0.08)" : "transparent", cursor:"pointer", textAlign:"left", width:"100%" }}>
                        <span style={{ width:18, height:18, borderRadius:3, border:`1px solid ${incluirNegativos ? "#e5271a" : "var(--muted-foreground)"}`, background: incluirNegativos ? "#e5271a" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {incluirNegativos && <Check size={12} color="#fff" />}
                        </span>
                        <span>
                          <span style={{ display:"block", fontFamily:"monospace", fontSize:10 }}>Enviar negativos junto?</span>
                          <span style={{ display:"block", fontFamily:"monospace", fontSize:8, color:"var(--muted-foreground)", marginTop:2 }}>
                            {negativosPendentes} negativo{negativosPendentes !== 1 ? "s" : ""} pronto{negativosPendentes !== 1 ? "s" : ""}. Sem custo extra.
                          </span>
                        </span>
                      </button>
                    )}
                  </>
                )}

                {/* Totais */}
                <div style={{ borderTop:"1px solid var(--border)", paddingTop:10, display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:10, color:"var(--muted-foreground)" }}>
                    <span>Subtotal</span><span>{brl(cart.subtotal)}</span>
                  </div>
                  {desconto > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:10, color:"#22c55e" }}>
                      <span>Desconto</span><span>− {brl(desconto)}</span>
                    </div>
                  )}
                  {valorFrete > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:10, color:"var(--muted-foreground)" }}>
                      <span>Frete</span><span>{brl(valorFrete)}</span>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:14, fontWeight:700, marginTop:4 }}>
                    <span>Total</span><span style={{ color:"#e5271a" }}>{brl(total)}</span>
                  </div>
                </div>

                {!user && <p style={{ fontFamily:"monospace", fontSize:9, color:"#e5271a", textAlign:"center" }}>Faça login para finalizar.</p>}
                {erro    && (
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontFamily:"monospace", fontSize:9, color:"#e5271a", marginBottom: pendingOrderId ? 8 : 0 }}>{erro}</p>
                    {pendingOrderId && (
                      <button onClick={retryPix} disabled={enviando}
                        style={{ padding:"8px 16px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:9, color:"var(--foreground)", opacity: enviando ? 0.4 : 1 }}>
                        {enviando ? "Tentando..." : "↺ Tentar gerar Pix novamente"}
                      </button>
                    )}
                  </div>
                )}

                <button onClick={finalizar} disabled={enviando || !user}
                  style={{ padding:12, background:"#e5271a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontFamily:"'Press Start 2P', monospace", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: enviando || !user ? 0.4 : 1 }}>
                  {enviando ? <><Loader2 size={14} className="animate-spin" /> PROCESSANDO...</> : "CONFIRMAR"}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}