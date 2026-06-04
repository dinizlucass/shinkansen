"use client"

/**
 * components/store/store-mobile.tsx
 *
 * Layout mobile da loja.
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ShoppingBag, Loader2, Check, Tag } from "lucide-react"
import type { User } from "@supabase/supabase-js"

import type { Product, DeliveryType } from "@/lib/store/types"
import type { OpcaoFrete } from "@/lib/store/melhor-envio"
import { useCart } from "@/lib/store/use-cart"
import { AnimatedTotal } from "@/components/store/animated-total"
import { DiagonalBg } from "@/components/store/diagonal-bg"
import AnimatedLogo from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"

// ── Helpers ──────────────────────────────────────────────────────────
interface PerfilLoja { adress: string | null; cpf: string | null }
interface StoreMobileProps {
  user:               User | null
  products:           Product[]
  perfil:             PerfilLoja | null
  negativosPendentes: number
}

const CATEGORIA_LABEL: Record<string, string> = {
  filme_35mm: "35MM", filme_120: "120", camera: "CÂMERA",
  camera_recarregavel: "CÂMERA", acessorio: "ACESSÓRIO", outro: "OUTRO",
}
const ENTREGA_LABEL: Record<DeliveryType, string> = {
  envio: "Envio pelos Correios", retirada: "Retirada no Lab",
}
function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function CopyButton({ text }: { text: string }) {
  const [copiado, setCopiado] = React.useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* fallback */ }
  }
  return (
    <button onClick={copiar} style={{
      padding: "8px 12px", borderRadius: 4, cursor: "pointer",
      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
      border: copiado ? "1px solid #22c55e" : "1px solid var(--border)",
      background: copiado ? "rgba(34,197,94,0.15)" : "var(--muted)",
      color: copiado ? "#22c55e" : "var(--foreground)",
      transition: "all 0.2s",
    }}>
      {copiado ? "COPIADO ✓" : "COPIAR"}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL MOBILE
// ═══════════════════════════════════════════════════════════════════════

export function StoreMobile({ user, products, perfil, negativosPendentes }: StoreMobileProps) {
  const cart = useCart()

  const [selecionado, setSelecionado]     = React.useState<Product | null>(null)
  const [selecionadoId, setSelId]         = React.useState<string | null>(null)
  const [sheetAberta, setSheetAberta]     = React.useState(false)
  const [headerAberto, setHeaderAberto]   = React.useState(false)
  const [checkoutAberto, setCheckout]     = React.useState(false)

  // Flash de adição
  const [flashAtivo, setFlashAtivo]       = React.useState(false)
  const [adicionadoVis, setAdicionadoVis] = React.useState(false)

  // Peek (long press)
  const [peekProduct, setPeekProduct]     = React.useState<Product | null>(null)
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const didPeekRef   = React.useRef(false)

  function dispararFlash() {
    setFlashAtivo(true)
    setAdicionadoVis(true)
    setTimeout(() => setFlashAtivo(false), 400)
    setTimeout(() => setAdicionadoVis(false), 900)
  }

  function clicarThumb(p: Product) {
    if (p.stock_quantity <= 0) return
    if (selecionadoId === p.id) {
      if (!cart.podeAdicionar(p)) return
      cart.adicionar(p, 1)
      dispararFlash()
    } else {
      setSelecionado(p)
      setSelId(p.id)
      setSheetAberta(true)
    }
  }

  function fecharSheet() {
    setSheetAberta(false)
    setSelId(null)
  }

  const THUMBS_PER_ROW = 3
  const rows: Product[][] = []
  for (let i = 0; i < products.length; i += THUMBS_PER_ROW) {
    rows.push(products.slice(i, i + THUMBS_PER_ROW))
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--background)", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <header style={{ height: 48, background: "var(--card)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 12px", gap: 10, flexShrink: 0, zIndex: 20 }}>
        <AnimatedLogo className="w-8 h-auto" />
        <button onClick={() => setHeaderAberto(true)}
          style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e5271a", letterSpacing: "0.1em" }}>
          SELECT YOUR FILMS ▾
        </button>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>
          {cart.items.length > 0 && (
            <span style={{ background: "#e5271a", color: "#fff", borderRadius: 9, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>
              {cart.items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>
      </header>

      {/* ── CORPO: grade (80%) + faixa carrinho (20%) ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Grade de thumbs */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8, position: "relative" }}>
          <DiagonalBg />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", position: "relative", zIndex: 1 }}>
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: "flex", gap: 8 }}>
                {row.map(p => {
                  const noCarrinho    = cart.items.find(it => it.product.id === p.id)
                  const isSelecionado = selecionadoId === p.id
                  const semEstoque    = p.stock_quantity <= 0
                  let borderColor = "var(--border)"
                  let bgColor     = "var(--card)"
                  if (isSelecionado)  { borderColor = "#e5271a"; bgColor = "#1a0a00" }
                  else if (noCarrinho){ borderColor = "#22c55e"; bgColor = "#0a1a0a" }
                  return (
                    <div key={p.id}
                      onClick={() => { if (!didPeekRef.current) clicarThumb(p) }}
                      onTouchStart={() => {
                        didPeekRef.current = false
                        longPressRef.current = setTimeout(() => {
                          didPeekRef.current = true
                          setPeekProduct(p)
                        }, 400)
                      }}
                      onTouchEnd={() => {
                        if (longPressRef.current) clearTimeout(longPressRef.current)
                        if (didPeekRef.current) setPeekProduct(null)
                      }}
                      onTouchMove={() => {
                        if (longPressRef.current) clearTimeout(longPressRef.current)
                      }}
                      style={{ width: 100, height: 100, flexShrink: 0, border: `2px solid ${borderColor}`, borderRadius: 4, background: bgColor, position: "relative", cursor: semEstoque ? "not-allowed" : "pointer", overflow: "hidden", filter: semEstoque ? "grayscale(1)" : "none", opacity: semEstoque ? 0.45 : 1, WebkitTouchCallout: "none", userSelect: "none" }}>
                      <img src={p.images.thumb} alt={p.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {isSelecionado && <div style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: "12px solid #e5271a", borderLeft: "12px solid transparent" }} />}
                      {noCarrinho && (
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
                          style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: 8, background: "#e5271a", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {noCarrinho.quantity}
                        </motion.div>
                      )}
                      {semEstoque && (
                        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: "50%", top: "50%", width: "160%", background: "#e5271a", padding: "2px 0", transform: "translate(-50%,-50%) rotate(-32deg)", textAlign: "center" }}>
                            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#fff" }}>ESGOTADO</span>
                          </div>
                        </div>
                      )}
                      <div style={{ position: "absolute", bottom: 0, insetInline: 0, background: "rgba(0,0,0,0.65)", padding: "2px 3px", fontFamily: "monospace", fontSize: 7, color: isSelecionado ? "#e5271a" : noCarrinho ? "#22c55e" : "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.name.split(" ").slice(0, 2).join(" ")}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Faixa lateral 20% — carrinho resumido */}
        <div style={{ width: "20%", minWidth: 64, borderLeft: "1px solid var(--border)", background: "var(--card)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 4px", display: "flex", flexDirection: "column", gap: 6, flex: 1, overflowY: "auto" }}>
            {cart.items.length === 0 ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShoppingBag size={20} style={{ color: "var(--border)" }} />
              </div>
            ) : (
              cart.items.map(item => (
                <div key={item.product.id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 2px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "100%", aspectRatio: "1", overflow: "hidden", borderRadius: 3 }}>
                    <img src={item.product.images.thumb} alt={item.product.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 7, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
                    ×{item.quantity}
                  </div>
                  <button onClick={() => cart.remover(item.product.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 10, padding: 0, textAlign: "center" }}>✕</button>
                </div>
              ))
            )}
          </div>
          {cart.items.length > 0 && (
            <div style={{ padding: "6px 4px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ fontFamily: "monospace", fontSize: 7, color: "#e5271a", textAlign: "center", marginBottom: 4 }}>
                <AnimatedTotal value={cart.subtotal} />
              </div>
              <button onClick={() => setCheckout(true)} style={{ width: "100%", padding: "6px 2px", background: "#e5271a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontFamily: "monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.05em" }}>
                CHECKOUT
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── FLASH DIAGONAL DE ADIÇÃO ── */}
      <AnimatePresence>
        {flashAtivo && (
          <motion.div
            initial={{ opacity: 0.7, x: "-100%", y: "100%", skewX: -15 }}
            animate={{ opacity: 0, x: "100%", y: "-100%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            style={{ position: "fixed", inset: 0, zIndex: 90, background: "linear-gradient(135deg, transparent 30%, rgba(229,39,26,0.6) 50%, transparent 70%)", pointerEvents: "none" }}
          />
        )}
      </AnimatePresence>

      {/* ── TEXTO "ADICIONADO" PISCANTE ── */}
      <AnimatePresence>
        {adicionadoVis && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1.1, 1, 0.9] }}
            transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
            style={{ position: "fixed", inset: 0, zIndex: 91, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ background: "#e5271a", color: "#fff", fontFamily: "'Press Start 2P', monospace", fontSize: 14, padding: "10px 20px", borderRadius: 4, letterSpacing: "0.1em" }}>
              ADICIONADO
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PEEK OVERLAY (long press preview) ── */}
      <AnimatePresence>
        {peekProduct && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", pointerEvents: "none" }}
          >
            <div style={{ width: "75vw", maxWidth: 320, background: "var(--card)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
              <div style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                <img src={peekProduct.images.package || peekProduct.images.thumb} alt={peekProduct.name} draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div style={{ padding: "10px 12px" }}>
                {peekProduct.brand && (
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#e5271a", textTransform: "uppercase" }}>{peekProduct.brand}</div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase", marginBottom: 4 }}>{peekProduct.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#e5271a" }}>{brl(peekProduct.price)}</span>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                    {CATEGORIA_LABEL[peekProduct.category] ?? peekProduct.category}
                    {peekProduct.iso ? ` · ISO ${peekProduct.iso}` : ""}
                    {peekProduct.exposures ? ` · ${peekProduct.exposures}exp` : ""}
                  </span>
                </div>
                {peekProduct.stock_quantity <= 0 && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "#e5271a", fontWeight: 700 }}>ESGOTADO</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SHEET DO PRODUTO (80%) ── */}
      <AnimatePresence>
        {sheetAberta && selecionado && (
          <SheetProduto
            product={selecionado}
            cart={cart}
            onClose={fecharSheet}
            onAdd={() => { dispararFlash(); fecharSheet() }}
          />
        )}
      </AnimatePresence>

      {/* ── MODAL CABEÇALHO (menu de navegação) ── */}
      <AnimatePresence>
        {headerAberto && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setHeaderAberto(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60 }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.18 }}
              style={{ position: "fixed", top: 56, left: 12, right: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, zIndex: 70, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#e5271a", letterSpacing: "0.15em", textAlign: "center" }}>SELECT YOUR FILMS</div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <GameMenuNav user={user} variant="vertical" />
              <button onClick={() => setHeaderAberto(false)} style={{ padding: "8px 0", background: "var(--lift)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>
                FECHAR
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CHECKOUT MODAL ── */}
      <AnimatePresence>
        {checkoutAberto && (
          <MobileCheckout
            cart={cart} user={user} perfil={perfil}
            negativosPendentes={negativosPendentes}
            onClose={() => setCheckout(false)}
            onSuccess={() => { cart.limpar(); setCheckout(false) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// SHEET DO PRODUTO — com swipe gestures
// ─────────────────────────────────────────────────────────────────────

const IMAGES_ORDER = ["package", "sample", "thumb"] as const
type ImageKey = typeof IMAGES_ORDER[number]

function SheetProduto({ product, cart, onClose, onAdd }: {
  product: Product
  cart: ReturnType<typeof useCart>
  onClose: () => void
  onAdd: () => void
}) {
  const [imgIdx, setImgIdx] = React.useState(0)
  const [zoomed, setZoomed] = React.useState(false)
  const [zoomPos, setZoomPos] = React.useState({ x: 50, y: 50 })  // % do centro do zoom

  // Double-tap detection
  const lastTapRef = React.useRef(0)
  function onImageTap(e: React.TouchEvent | React.MouseEvent) {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Double tap
      if (zoomed) {
        setZoomed(false)
      } else {
        // Centraliza zoom no ponto do toque
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const clientX = "touches" in e ? e.changedTouches[0].clientX : e.clientX
        const clientY = "touches" in e ? e.changedTouches[0].clientY : e.clientY
        setZoomPos({
          x: ((clientX - rect.left) / rect.width) * 100,
          y: ((clientY - rect.top) / rect.height) * 100,
        })
        setZoomed(true)
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  // Lista de imagens disponíveis
  const imgs = React.useMemo(() => {
    const list: { key: ImageKey; src: string }[] = []
    for (const k of IMAGES_ORDER) {
      const src = product.images?.[k]
      if (src) list.push({ key: k, src })
    }
    return list.length > 0 ? list : [{ key: "thumb" as ImageKey, src: product.images?.thumb || "" }]
  }, [product])

  // Swipe horizontal (muda imagem) + vertical (fechar / adicionar)
  const touchRef = React.useRef<{ x: number; y: number; t: number } | null>(null)

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current) return
    const t  = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    const dt = Date.now() - touchRef.current.t
    touchRef.current = null

    const MIN_DIST = 50
    const MAX_TIME = 400

    if (dt > MAX_TIME) return

    // Bloqueado durante zoom
    if (zoomed) return

    // Horizontal dominante → muda imagem
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > MIN_DIST) {
      if (dx < 0 && imgIdx < imgs.length - 1) setImgIdx(i => i + 1)
      if (dx > 0 && imgIdx > 0) setImgIdx(i => i - 1)
      return
    }

    // Vertical dominante
    if (Math.abs(dy) > MIN_DIST) {
      if (dy > 0) {
        // Swipe para baixo → fecha
        onClose()
      } else {
        // Swipe para cima → adiciona ao carrinho
        if (cart.podeAdicionar(product) && product.stock_quantity > 0) {
          cart.adicionar(product, 1)
          onAdd()
        }
      }
    }
  }

  const LABEL: Record<string, string> = { package: "EMBAL.", sample: "EXEMPLO", thumb: "THUMB" }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{ position: "fixed", bottom: 0, left: 0, width: "80%", height: "85vh", background: "var(--card)", borderTopRightRadius: 16, zIndex: 50, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* X fixo */}
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, zIndex: 10, width: 32, height: 32, background: "red", border: "none", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#000" }}>
          <X size={16} />
        </button>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>

          {/* Imagem com swipe + double-tap zoom + indicadores */}
          <div
            onTouchStart={onTouchStart}
            onTouchEnd={(e) => { onTouchEnd(e); onImageTap(e) }}
            onClick={onImageTap}
            style={{ aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", background: "#0d0d0d", marginBottom: 12, position: "relative", touchAction: zoomed ? "none" : "pan-y" }}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={imgs[imgIdx].src}
                src={imgs[imgIdx].src}
                alt={product.name}
                draggable={false}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                style={{
                  width: "100%", height: "100%", objectFit: "cover", display: "block",
                  transform: zoomed ? `scale(2.5)` : "scale(1)",
                  transformOrigin: zoomed ? `${zoomPos.x}% ${zoomPos.y}%` : "center center",
                  transition: "transform 0.25s ease-out, transform-origin 0.25s ease-out",
                }}
              />
            </AnimatePresence>

            {/* Dots indicadores (escondem quando zoom ativo) */}
            {!zoomed && (
              <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {imgs.map((im, i) => (
                  <button key={im.key} onClick={(e) => { e.stopPropagation(); setImgIdx(i) }} style={{
                    width: imgIdx === i ? 20 : 6, height: 6, borderRadius: 3, border: "none", cursor: "pointer",
                    background: imgIdx === i ? "#e5271a" : "rgba(255,255,255,0.4)",
                    transition: "width 0.2s, background 0.2s",
                  }} />
                ))}
              </div>
            )}

            {/* Label da imagem atual */}
            {!zoomed && (
              <div style={{ position: "absolute", top: 8, left: 8, fontFamily: "monospace", fontSize: 9, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 6px", borderRadius: 3 }}>
                {LABEL[imgs[imgIdx].key] || imgs[imgIdx].key.toUpperCase()}
              </div>
            )}

            {/* Hint de swipe */}
            {!zoomed && imgs.length > 1 && (
              <div style={{ position: "absolute", bottom: 20, right: 8, fontFamily: "monospace", fontSize: 8, color: "rgba(255,255,255,0.4)" }}>
                ← swipe →
              </div>
            )}

            {/* Zoom indicator */}
            {zoomed && (
              <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "monospace", fontSize: 9, background: "rgba(229,39,26,0.9)", color: "#fff", padding: "2px 8px", borderRadius: 3 }}>
                2.5× · tap 2x para sair
              </div>
            )}
          </div>

          {/* Marca + nome */}
          <div style={{ marginBottom: 8 }}>
            {product.brand && (
              <div style={{ fontSize: 20, letterSpacing: "0.15em", color: "#e5271a", textTransform: "uppercase" }}>{product.brand}</div>
            )}
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase" }}>{product.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
              {CATEGORIA_LABEL[product.category] ?? product.category}
              {product.stock_quantity > 0 ? ` · ${product.stock_quantity} em estoque` : " · ESGOTADO"}
            </div>
          </div>

          {/* Barras de stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {[
              { label: "ISO", val: product.iso ? Math.min(product.iso / 800, 1) : null, txt: product.iso ? String(product.iso) : "—", color: "#e5271a" },
              { label: "POSES", val: product.exposures ? Math.min(product.exposures / 36, 1) : null, txt: product.exposures ? String(product.exposures) : "—", color: "#f5c400" },
              { label: "FORMATO", val: product.film_format === "120" ? 0.6 : product.film_format === "35mm" ? 1 : null, txt: product.film_format?.toUpperCase() ?? "—", color: "#3b82f6" },
              { label: "PROCESSO", val: product.process ? 0.7 : null, txt: product.process ?? "—", color: "#22c55e" },
            ].map(({ label, val, txt, color }) => val === null ? null : (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 60, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: "var(--muted)", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${val * 100}%` }} transition={{ duration: 0.5, ease: "easeOut" }} style={{ height: "100%", background: color, borderRadius: 2, opacity: 0.85 }} />
                </div>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)", width: 32, textAlign: "right", flexShrink: 0 }}>{txt}</span>
              </div>
            ))}
          </div>

          {/* Descrição */}
          {product.description && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.7, marginBottom: 12 }}>
              {product.description}
            </div>
          )}
        </div>

        {/* Rodapé fixo */}
        <div style={{ padding: 16, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#e5271a", marginBottom: 10 }}>{brl(product.price)}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", background: "var(--lift)", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", fontFamily: "monospace", fontSize: 11 }}>
              VOLTAR
            </button>
            <button
              onClick={() => {
                if (!cart.podeAdicionar(product) || product.stock_quantity <= 0) return
                cart.adicionar(product, 1)
                onAdd()
              }}
              disabled={product.stock_quantity <= 0 || !cart.podeAdicionar(product)}
              style={{ flex: 2, padding: "10px 0", background: "#e5271a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 8, letterSpacing: "0.08em", opacity: product.stock_quantity <= 0 ? 0.3 : 1 }}
            >
              + ADICIONAR
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 9, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.5 }}>
            ↑ swipe pra cima = adicionar &nbsp;·&nbsp; ↓ swipe pra baixo = fechar
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────
// CHECKOUT MOBILE
// ─────────────────────────────────────────────────────────────────────

function MobileCheckout({ cart, user, perfil, negativosPendentes, onClose, onSuccess }: {
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
  const [opcoesFrete, setOpcoes]      = React.useState<OpcaoFrete[]>([])
  const [freteSelecionado, setFrete]  = React.useState<OpcaoFrete | null>(null)
  const [calculandoFrete, setCalc]    = React.useState(false)
  const [freteErro, setFreteErro]     = React.useState("")
  const [cupomAplicado, setCupom]     = React.useState<{ code: string; discount: number } | null>(null)
  const [codigoCupom, setCodigo]      = React.useState("")
  const [cupomErro, setCupomErro]     = React.useState("")
  const [loadingCupom, setLoadCupom]  = React.useState(false)
  const [enviando, setEnviando]       = React.useState(false)
  const [erro, setErro]               = React.useState("")
  const [pixGerado, setPixGerado]     = React.useState<{ copia_cola: string; qr_base64: string; valor: number } | null>(null)
  const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null)

  async function retryPix() {
    if (!pendingOrderId) return
    setErro(""); setEnviando(true)
    try {
      const r = await fetch("/api/store/payment/create-pix", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ order_id: pendingOrderId }) })
      const d = await r.json()
      if (d.ok) { setPendingOrderId(null); setPixGerado(d.pix) }
      else setErro(d.error ?? "Falha ao gerar Pix.")
    } catch { setErro("Erro de conexao.") } finally { setEnviando(false) }
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

  async function aplicarCupom() {
    if (!codigoCupom.trim()) return
    setLoadCupom(true); setCupomErro("")
    try {
      const res  = await fetch("/api/store/validate-coupon", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ code: codigoCupom.trim(), subtotal: cart.subtotal }) })
      const data = await res.json()
      if (!data.ok) { setCupomErro(data.error ?? "Cupom inválido"); return }
      setCupom({ code: data.coupon.code, discount: data.coupon.discount })
    } catch { setCupomErro("Erro ao validar") } finally { setLoadCupom(false) }
  }

  async function finalizar() {
    if (!user) { setErro("Faça login para finalizar."); return }
    if (precisaEnvio && !endereco.trim()) { setErro("Informe o endereço."); return }
    if (precisaEnvio && cpf.replace(/\D/g,"").length !== 11) { setErro("CPF inválido."); return }
    if (precisaEnvio && !freteSelecionado) { setErro("Calcule o frete."); return }
    setEnviando(true); setErro("")
    try {
      const res  = await fetch("/api/store/create-order", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ items: cart.items.map(i => ({ product_id: i.product.id, quantity: i.quantity, unit_price: i.product.price })), delivery_type: entrega, shipping_address: precisaEnvio ? endereco.trim() : null, cpf: precisaEnvio ? cpf.replace(/\D/g,"") : null, cep: precisaEnvio ? cep.replace(/\D/g,"") : null, shipping_option: freteSelecionado, coupon_code: cupomAplicado?.code ?? null, salvar_perfil: precisaEnvio && salvarPerfil, incluir_negativos: precisaEnvio && incluirNegativos }) })
      const data = await res.json()
      if (!data.ok) { setErro(data.error ?? "Erro ao criar pedido"); return }
      const pixRes  = await fetch("/api/store/payment/create-pix", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ order_id: data.order.id }) })
      const pixData = await pixRes.json()
      if (pixData.ok) setPixGerado(pixData.pix)
      else {
        const msg = pixData.error ?? "Falha ao gerar Pix."
        setErro(`Pedido criado! ${msg}`)
        if (pixData.retryable && data.order?.id) setPendingOrderId(data.order.id)
        else onSuccess()
      }
    } catch { setErro("Erro ao processar.") } finally { setEnviando(false) }
  }

  const inputStyle: React.CSSProperties = { background: "var(--background)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: "var(--foreground)", outline: "none", width: "100%" }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:80 }} />
      <motion.div
        initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
        transition={{ type:"spring", stiffness:300, damping:32 }}
        style={{ position:"fixed", bottom:0, left:0, right:0, height:"92vh", background:"var(--card)", borderTopLeftRadius:16, borderTopRightRadius:16, zIndex:90, display:"flex", flexDirection:"column", overflow:"hidden" }}
      >
        <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <span style={{ fontFamily:"'Press Start 2P', monospace", fontSize:10, color:"#e5271a" }}>CHECKOUT</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)" }}><X size={18} /></button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:16, display:"flex", flexDirection:"column", gap:14 }}>
          {pixGerado ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, textAlign:"center" }}>
              <p style={{ fontFamily:"monospace", fontSize:12 }}>Pedido criado! Pague com Pix.</p>
              <div style={{ background:"#fff", padding:10, borderRadius:8 }}>
                <img src={pixGerado.qr_base64} alt="QR Pix" style={{ width:200, height:200 }} />
              </div>
              <p style={{ fontFamily:"monospace", fontSize:18, fontWeight:700, color:"#e5271a" }}>{brl(pixGerado.valor)}</p>
              <div style={{ width:"100%", display:"flex", gap:8 }}>
                <input readOnly value={pixGerado.copia_cola} style={{ ...inputStyle, fontSize:10 }} onFocus={e => e.target.select()} />
                <CopyButton text={pixGerado.copia_cola} />
              </div>
              <button onClick={onSuccess} style={{ width:"100%", padding:14, background:"#e5271a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontFamily:"'Press Start 2P', monospace", fontSize:10 }}>CONCLUIR</button>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {cart.items.map(i => (
                  <div key={i.product.id} style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:12 }}>
                    <span style={{ color:"var(--muted-foreground)" }}>{i.quantity}× {i.product.name}</span>
                    <span>{brl(i.product.price * i.quantity)}</span>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontFamily:"monospace", fontSize:10, color:"var(--muted-foreground)", letterSpacing:2, marginBottom:8 }}>ENTREGA</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {(Object.keys(ENTREGA_LABEL) as DeliveryType[]).map(tipo => (
                    <button key={tipo} onClick={() => setEntrega(tipo)} style={{ padding:"12px 6px", border:`2px solid ${entrega === tipo ? "#e5271a" : "var(--border)"}`, borderRadius:4, background: entrega === tipo ? "rgba(229,39,26,0.08)" : "transparent", cursor:"pointer", fontFamily:"monospace", fontSize:11, color: entrega === tipo ? "#e5271a" : "var(--muted-foreground)", textAlign:"center", lineHeight:1.4 }}>
                      {ENTREGA_LABEL[tipo]}
                    </button>
                  ))}
                </div>
              </div>

              {precisaEnvio && (
                <>
                  <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo" style={inputStyle} />
                  <input value={cpf} onChange={e => setCpf(formatarCpf(e.target.value))} placeholder="CPF" inputMode="numeric" style={inputStyle} />
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={cep} onChange={e => setCep(formatarCep(e.target.value))} placeholder="CEP" inputMode="numeric" style={{ ...inputStyle, flex:1 }} />
                    <button onClick={calcularFrete} disabled={calculandoFrete || cep.replace(/\D/g,"").length !== 8} style={{ padding:"8px 12px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:10, opacity: calculandoFrete || cep.replace(/\D/g,"").length !== 8 ? 0.4 : 1 }}>
                      {calculandoFrete ? <Loader2 size={14} className="animate-spin" /> : "CALC"}
                    </button>
                  </div>
                  {freteErro && <div style={{ fontFamily:"monospace", fontSize:10, color:"#e5271a" }}>{freteErro}</div>}
                  {opcoesFrete.map(op => (
                    <button key={op.id} onClick={() => setFrete(op)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", border:`1px solid ${freteSelecionado?.id === op.id ? "#e5271a" : "var(--border)"}`, borderRadius:4, background: freteSelecionado?.id === op.id ? "rgba(229,39,26,0.08)" : "transparent", cursor:"pointer", fontFamily:"monospace", fontSize:11, color: freteSelecionado?.id === op.id ? "#e5271a" : "var(--foreground)" }}>
                      <span>{op.empresa} {op.nome}</span>
                      <span style={{ fontWeight:700 }}>{brl(op.preco)} · {op.prazo}d</span>
                    </button>
                  ))}
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={salvarPerfil} onChange={e => setSalvar(e.target.checked)} style={{ accentColor:"#e5271a" }} />
                    <span style={{ fontFamily:"monospace", fontSize:11, color:"var(--muted-foreground)" }}>Salvar endereço e CPF</span>
                  </label>
                  {negativosPendentes > 0 && (
                    <button onClick={() => setIncluir(v => !v)} style={{ display:"flex", alignItems:"center", gap:10, padding:10, border:`1px solid ${incluirNegativos ? "#e5271a" : "var(--border)"}`, borderRadius:6, background: incluirNegativos ? "rgba(229,39,26,0.08)" : "transparent", cursor:"pointer", textAlign:"left", width:"100%" }}>
                      <span style={{ width:18, height:18, borderRadius:3, border:`1px solid ${incluirNegativos ? "#e5271a" : "var(--muted-foreground)"}`, background: incluirNegativos ? "#e5271a" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {incluirNegativos && <Check size={12} color="#fff" />}
                      </span>
                      <span style={{ fontFamily:"monospace", fontSize:11 }}>
                        Enviar {negativosPendentes} negativo{negativosPendentes !== 1 ? "s" : ""} junto?
                      </span>
                    </button>
                  )}
                </>
              )}

              {cupomAplicado ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", border:"1px solid #22c55e", borderRadius:4, background:"rgba(34,197,94,0.05)" }}>
                  <span style={{ fontFamily:"monospace", fontSize:11, color:"#22c55e" }}>
                    <Tag size={12} style={{ marginRight:4, verticalAlign:"middle" }} />
                    {cupomAplicado.code} − {brl(cupomAplicado.discount)}
                  </span>
                  <button onClick={() => { setCupom(null); setCodigo("") }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted-foreground)", fontSize:12 }}>✕</button>
                </div>
              ) : (
                <div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={codigoCupom} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="CUPOM" style={{ ...inputStyle, flex:1, textTransform:"uppercase" }} onKeyDown={e => e.key === "Enter" && aplicarCupom()} />
                    <button onClick={aplicarCupom} disabled={loadingCupom || !codigoCupom.trim()} style={{ padding:"8px 12px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:10, opacity: loadingCupom || !codigoCupom.trim() ? 0.4 : 1 }}>
                      {loadingCupom ? "..." : "OK"}
                    </button>
                  </div>
                  {cupomErro && <div style={{ fontFamily:"monospace", fontSize:10, color:"#e5271a", marginTop:4 }}>{cupomErro}</div>}
                </div>
              )}

              <div style={{ borderTop:"1px solid var(--border)", paddingTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:12, color:"var(--muted-foreground)" }}>
                  <span>Subtotal</span><span>{brl(cart.subtotal)}</span>
                </div>
                {desconto > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:12, color:"#22c55e" }}>
                    <span>Desconto</span><span>− {brl(desconto)}</span>
                  </div>
                )}
                {valorFrete > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:12, color:"var(--muted-foreground)" }}>
                    <span>Frete</span><span>{brl(valorFrete)}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:16, fontWeight:700 }}>
                  <span>Total</span><span style={{ color:"#e5271a" }}>{brl(total)}</span>
                </div>
              </div>

              {!user && <p style={{ fontFamily:"monospace", fontSize:11, color:"#e5271a", textAlign:"center" }}>Faça login para finalizar.</p>}
              {erro && (
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontFamily:"monospace", fontSize:11, color:"#e5271a", marginBottom: pendingOrderId ? 8 : 0 }}>{erro}</p>
                  {pendingOrderId && (
                    <button onClick={retryPix} disabled={enviando}
                      style={{ padding:"8px 16px", background:"var(--muted)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", fontFamily:"monospace", fontSize:10, opacity: enviando ? 0.4 : 1 }}>
                      {enviando ? "Tentando..." : "↺ Tentar gerar Pix novamente"}
                    </button>
                  )}
                </div>
              )}

              <button onClick={finalizar} disabled={enviando || !user} style={{ padding:14, background:"#e5271a", color:"#fff", border:"none", borderRadius:6, cursor:"pointer", fontFamily:"'Press Start 2P', monospace", fontSize:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: enviando || !user ? 0.4 : 1 }}>
                {enviando ? <><Loader2 size={14} className="animate-spin" /> PROCESSANDO...</> : "CONFIRMAR"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}