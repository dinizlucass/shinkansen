"use client"

import { useState } from "react"

type Feedback = { ok: boolean; text: string } | null

const inputCls =
  "w-full rounded border border-border bg-input px-2 py-1 font-mono text-sm"
const btnCls =
  "rounded border border-border bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground disabled:opacity-50"
const btnGhost =
  "rounded border border-border bg-transparent px-2 py-1 font-mono text-xs"

type ProdutoOpt = { id: string; name: string; price: number }

export function EmailsDebugClient({ products = [] }: { products?: ProdutoOpt[] }) {
  const [to, setTo] = useState("")
  const [customerName, setCustomerName] = useState("Nicolas Teste")
  const [orderId, setOrderId] = useState("")
  const [enviando, setEnviando] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  // ── Pedido de serviço ──
  const [total, setTotal] = useState("370")
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("")
  const [pixCopyPaste, setPixCopyPaste] = useState("")
  const [photoLink, setPhotoLink] = useState("")
  const [films, setFilms] = useState<{ name: string; services: string }[]>([
    { name: "Viagem SP 2024", services: "Revelação C41, Digitalização Trilhas, Expresso" },
    { name: "Aniversário", services: "Revelação C41, Digitalização Tradicional" },
  ])

  // ── Compra na loja (usa os produtos reais do site) ──
  const [deliveryType, setDeliveryType] = useState("retirada")
  const [items, setItems] = useState<{ productId: string; quantity: string }[]>(
    products.length ? [{ productId: products[0].id, quantity: "1" }] : [],
  )

  // ── Negativos ──
  const [filmName, setFilmName] = useState("Viagem SP 2024")
  const [negStatus, setNegStatus] = useState("embalado")

  async function enviar(label: string, payload: Record<string, unknown>) {
    if (!to.trim()) {
      setFeedback({ ok: false, text: "Informe o e-mail de destino." })
      return
    }
    setEnviando(label)
    setFeedback(null)
    try {
      const res = await fetch("/api/debug/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), customerName, orderId: orderId.trim(), ...payload }),
      })
      const raw = await res.text()
      let data: { ok?: boolean; error?: string; orderId?: string } | null = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = null }
      if (!res.ok || !data?.ok) {
        // Surfaça o status HTTP e a resposta crua para diagnóstico.
        const detalhe = data?.error ?? (raw ? raw.slice(0, 200) : "sem corpo na resposta")
        throw new Error(`HTTP ${res.status}: ${detalhe}`)
      }
      setFeedback({ ok: true, text: `Enviado: ${label} (pedido ${data.orderId?.slice?.(0, 8) ?? ""})` })
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Erro." })
      console.error("[debug/emails] falha:", e)
    } finally {
      setEnviando(null)
    }
  }

  function enviarServico(status: string) {
    const serviceItems = films
      .filter((f) => f.name.trim() || f.services.trim())
      .map((f) => ({
        film: f.name.trim() || "Filme",
        services: f.services.split(",").map((s) => s.trim()).filter(Boolean),
      }))
    enviar(`serviço · ${status}`, {
      type: "order-status",
      status,
      totalValue: Number(total) || 0,
      paymentLinkUrl,
      pixCopyPaste,
      photoLink,
      serviceItems,
    })
  }

  const prodMap = new Map(products.map((p) => [p.id, p]))

  function enviarLoja() {
    const parsed = items
      .map((i) => {
        const prod = prodMap.get(i.productId)
        if (!prod) return null
        return { name: prod.name, quantity: Number(i.quantity) || 1, unitPrice: prod.price }
      })
      .filter((x): x is { name: string; quantity: number; unitPrice: number } => x !== null)
    const totalLoja = parsed.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    enviar("loja · compra", {
      type: "store-purchase",
      items: parsed,
      totalValue: totalLoja,
      deliveryType,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 font-mono">
      <h1 className="text-2xl font-bold">Debug de e-mails</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Página de teste (não vai para produção). Dispara os e-mails reais via Resend
        para o endereço abaixo.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <label className="sm:col-span-1">
          <span className="text-xs text-muted-foreground">E-mail de destino *</span>
          <input className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} placeholder="voce@exemplo.com" />
        </label>
        <label className="sm:col-span-1">
          <span className="text-xs text-muted-foreground">Nome do cliente</span>
          <input className={inputCls} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label className="sm:col-span-1">
          <span className="text-xs text-muted-foreground">Order ID (vazio = aleatório)</span>
          <input className={inputCls} value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="opcional" />
        </label>
      </div>

      {feedback && (
        <div
          className={`mb-6 rounded border px-3 py-2 text-sm ${
            feedback.ok ? "border-green-600 text-green-500" : "border-destructive text-destructive"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* ── PEDIDO DE SERVIÇO ── */}
      <section className="mb-8 rounded border border-border p-4">
        <h2 className="mb-3 text-lg font-bold">Pedido de serviço (revelação)</h2>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs text-muted-foreground">Total (R$)</span>
            <input className={inputCls} value={total} onChange={(e) => setTotal(e.target.value)} />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Link de pagamento</span>
            <input className={inputCls} value={paymentLinkUrl} onChange={(e) => setPaymentLinkUrl(e.target.value)} placeholder="usado em aguardando_pagamento" />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Pix copia-e-cola</span>
            <input className={inputCls} value={pixCopyPaste} onChange={(e) => setPixCopyPaste(e.target.value)} />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Link das fotos</span>
            <input className={inputCls} value={photoLink} onChange={(e) => setPhotoLink(e.target.value)} placeholder="usado em finalizado" />
          </label>
        </div>

        <div className="mb-2 text-xs text-muted-foreground">Filmes (nome + serviços separados por vírgula)</div>
        <div className="mb-3 flex flex-col gap-2">
          {films.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                className={`${inputCls} flex-1 min-w-[120px]`}
                value={f.name}
                placeholder="Nome do filme"
                onChange={(e) => setFilms((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className={`${inputCls} flex-[2] min-w-[180px]`}
                value={f.services}
                placeholder="Revelação C41, Digitalização Trilhas, Expresso"
                onChange={(e) => setFilms((p) => p.map((x, j) => (j === i ? { ...x, services: e.target.value } : x)))}
              />
              <button className={btnGhost} onClick={() => setFilms((p) => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className={btnGhost} onClick={() => setFilms((p) => [...p, { name: "", services: "" }])}>
            + adicionar filme
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {["criado", "recebido", "aguardando_pagamento", "pago", "finalizado"].map((s) => (
            <button key={s} className={btnCls} disabled={enviando !== null} onClick={() => enviarServico(s)}>
              {enviando === `serviço · ${s}` ? "enviando…" : s}
            </button>
          ))}
        </div>
      </section>

      {/* ── COMPRA NA LOJA ── */}
      <section className="mb-8 rounded border border-border p-4">
        <h2 className="mb-3 text-lg font-bold">Compra na loja</h2>

        <label className="mb-3 block max-w-xs">
          <span className="text-xs text-muted-foreground">Tipo de entrega</span>
          <select className={inputCls} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
            <option value="retirada">retirada</option>
            <option value="envio">envio</option>
          </select>
        </label>

        <div className="mb-2 text-xs text-muted-foreground">
          Itens (produtos reais do site + quantidade)
        </div>
        {products.length === 0 ? (
          <p className="mb-3 text-sm text-destructive">
            Nenhum produto ativo encontrado no banco.
          </p>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {items.map((it, i) => {
              const prod = prodMap.get(it.productId)
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${inputCls} flex-[2] min-w-[200px]`}
                    value={it.productId}
                    onChange={(e) =>
                      setItems((p) => p.map((x, j) => (j === i ? { ...x, productId: e.target.value } : x)))
                    }
                  >
                    {products.map((prd) => (
                      <option key={prd.id} value={prd.id}>
                        {prd.name} — R$ {prd.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputCls} w-20`}
                    value={it.quantity}
                    type="number"
                    min="1"
                    placeholder="qtd"
                    onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    = R$ {(((Number(it.quantity) || 0)) * (prod?.price ?? 0)).toFixed(2)}
                  </span>
                  <button className={btnGhost} onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>✕</button>
                </div>
              )
            })}
            <button
              className={btnGhost}
              onClick={() => setItems((p) => [...p, { productId: products[0].id, quantity: "1" }])}
            >
              + adicionar item
            </button>
          </div>
        )}

        <button className={btnCls} disabled={enviando !== null || products.length === 0} onClick={enviarLoja}>
          {enviando === "loja · compra" ? "enviando…" : "Enviar e-mail de compra"}
        </button>
      </section>

      {/* ── NEGATIVOS ── */}
      <section className="mb-8 rounded border border-border p-4">
        <h2 className="mb-3 text-lg font-bold">Devolução de negativos</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className={`${inputCls} flex-1 min-w-[160px]`} value={filmName} placeholder="Nome do filme" onChange={(e) => setFilmName(e.target.value)} />
          <select className={`${inputCls} w-40`} value={negStatus} onChange={(e) => setNegStatus(e.target.value)}>
            <option value="embalado">embalado</option>
            <option value="enviado">enviado</option>
            <option value="retirado">retirado</option>
          </select>
        </div>
        <button
          className={btnCls}
          disabled={enviando !== null}
          onClick={() => enviar(`negativos · ${negStatus}`, { type: "negativos", status: negStatus, filmName })}
        >
          {enviando === `negativos · ${negStatus}` ? "enviando…" : "Enviar notificação"}
        </button>
      </section>
    </div>
  )
}
