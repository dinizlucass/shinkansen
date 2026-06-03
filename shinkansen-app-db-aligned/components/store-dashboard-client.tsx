"use client"

/**
 * components/store-dashboard-client.tsx
 *
 * Dashboard dos pedidos da LOJA (store_orders), seguindo o mesmo padrão
 * visual da dashboard de serviços (dashboard-client.tsx).
 *
 * É renderizado dentro do toggle Serviços/Loja em dashboard-tabs.tsx.
 */

import React, { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  CheckCircle2, ChevronRight, Clock, Package, Truck, Wallet,
  ShoppingBag, MapPin, Film,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

// ── Tipos ──────────────────────────────────────────────────────────────────

interface StoreOrderItem {
  id:         string
  quantity:   number
  unit_price: number
  product: {
    name:     string
    category: string
  } | null
}

interface IncludedFilm {
  id:        string
  name:      string
  status:    string
}

export interface StoreOrder {
  id:                string
  status:            string
  total_value:       number | null
  coupon_discount:   number | null
  delivery_type:     string
  shipping_address:  string | null
  shipping_cost:     number | null
  shipping_service:  string | null
  shipping_deadline: number | null
  shipping_cep:      string | null
  tracking_code:     string | null
  payment_status:    string | null
  payment_last_payload: {
    qrcode?: { qrcode?: string | null; imagemQrcode?: string | null }
  } | null
  created_at:        string
  items:             StoreOrderItem[]
  films:             IncludedFilm[]   // negativos incluídos no envio
}

interface StoreDashboardClientProps {
  orders: StoreOrder[]
}

// ── Configuração de status ───────────────────────────────────────────────────

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pendente: {
    color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/40",
    icon: <Clock className="h-4 w-4" />,
    label: "Aguardando pagamento",
  },
  pago: {
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
    icon: <Wallet className="h-4 w-4" />,
    label: "Pago",
  },
  enviado: {
    color: "bg-blue-500/15 text-blue-700 border-blue-500/40",
    icon: <Truck className="h-4 w-4" />,
    label: "Enviado",
  },
  entregue: {
    color: "bg-muted text-muted-foreground border-border",
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Entregue",
  },
  cancelado: {
    color: "bg-red-500/15 text-red-700 border-red-500/40",
    icon: <Clock className="h-4 w-4" />,
    label: "Cancelado",
  },
}

// Etapas visuais do pedido da loja
const STORE_STEPS = ["pendente", "pago", "enviado", "entregue"] as const

const storeStatusDisplay: Record<string, string> = {
  pendente: "Pagamento",
  pago:     "Pago",
  enviado:  "Enviado",
  entregue: "Entregue",
}

const DELIVERY_LABEL: Record<string, string> = {
  correios:       "Correios",
  transportadora: "Transportadora",
  retirada:       "Retirada no Lab",
}

const CATEGORIA_LABEL: Record<string, string> = {
  filme_35mm: "Filme 35mm",
  filme_120:  "Filme 120",
  camera:     "Câmera",
  acessorio:  "Acessório",
  outro:      "Outro",
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0))
}

// ── Componente principal ─────────────────────────────────────────────────────

export function StoreDashboardClient({ orders }: StoreDashboardClientProps) {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)

  const activeOrders = useMemo(
    () => orders.filter((o) => !["entregue", "cancelado"].includes(o.status)),
    [orders],
  )
  const completedOrders = useMemo(
    () => orders.filter((o) => ["entregue", "cancelado"].includes(o.status)),
    [orders],
  )
  const totalSpent = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total_value ?? 0), 0),
    [orders],
  )
  const totalItens = useMemo(
    () => orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0),
    [orders],
  )

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatsCard label="PEDIDOS ATIVOS" value={activeOrders.length} icon={<Package className="h-5 w-5" />} />
        <StatsCard label="TOTAL DE PEDIDOS" value={orders.length} icon={<ShoppingBag className="h-5 w-5" />} />
        <StatsCard label="ITENS COMPRADOS" value={totalItens} icon={<Package className="h-5 w-5" />} />
        <StatsCard label="TOTAL GASTO" value={formatCurrency(totalSpent)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      {/* Em andamento */}
      <section className="mb-12">
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
          <span className="text-primary">EM ANDAMENTO</span>
        </h2>
        {activeOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-mono text-center">
                Nenhum pedido da loja em andamento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order, index) => (
              <StoreOrderCard
                key={order.id}
                order={order}
                index={index}
                isSelected={selectedOrder === order.id}
                onSelect={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Histórico */}
      <section>
        <h2 className="text-xl font-mono font-bold mb-4 flex items-center gap-2">
          <span className="text-primary">HISTÓRICO DE COMPRAS</span>
        </h2>
        {completedOrders.length === 0 ? (
          <p className="text-muted-foreground font-mono text-sm">Nenhuma compra finalizada ainda.</p>
        ) : (
          <div className="space-y-2">
            {completedOrders.map((order, index) => (
              <StoreOrderCard
                key={order.id}
                order={order}
                index={index}
                isSelected={selectedOrder === order.id}
                onSelect={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                compact
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatsCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className="text-2xl font-mono font-bold">{value}</p>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  )
}

function StoreOrderCard({
  order, index, isSelected, onSelect, compact = false,
}: {
  order: StoreOrder
  index: number
  isSelected: boolean
  onSelect: () => void
  compact?: boolean
}) {
  const status = statusConfig[order.status] ?? statusConfig.pendente
  const currentStepIndex = STORE_STEPS.indexOf(order.status as any)
  const totalItens = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card
        className={`border-border hover:border-primary/50 transition-all cursor-pointer ${
          isSelected ? "border-primary bg-primary/5" : ""
        }`}
        onClick={onSelect}
      >
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="font-mono text-muted-foreground text-sm">#{order.id.slice(0, 8).toUpperCase()}</div>
              <Badge variant="outline" className={`font-mono text-xs ${status.color}`}>
                {status.icon}
                <span className="ml-1">{status.label}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-muted-foreground">
                {totalItens} {totalItens !== 1 ? "itens" : "item"}
              </span>
              <span className="font-mono font-bold">{formatCurrency(order.total_value)}</span>
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`}
              />
            </div>
          </div>

          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-border"
              >
                {/* Barra de progresso do pedido (oculta se cancelado) */}
                {order.status !== "cancelado" && (
                  <div className="mb-6">
                    <div className="relative flex justify-between items-center w-full before:content-[''] before:absolute before:left-0 before:right-0 before:top-[10px] before:h-[2px] before:bg-border before:z-0">
                      {STORE_STEPS.map((step, idx) => {
                        const isCompleted = idx < currentStepIndex
                        const isCurrent = idx === currentStepIndex
                        let dotColor = "bg-muted border-muted-foreground/30"
                        let textColor = "text-muted-foreground/60"
                        if (isCompleted) {
                          dotColor = "bg-emerald-500 border-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                          textColor = "text-emerald-600 dark:text-emerald-400 font-medium"
                        } else if (isCurrent) {
                          dotColor = "bg-yellow-500 border-yellow-600 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                          textColor = "text-yellow-600 dark:text-yellow-400 font-bold"
                        }
                        return (
                          <div key={step} className="flex flex-col items-center flex-1 relative z-10">
                            <div className={`w-[22px] h-[22px] rounded-full border-2 ${dotColor} transition-all duration-300 flex items-center justify-center bg-background text-[10px]`}>
                              {isCompleted && "✓"}
                            </div>
                            <span className={`font-mono text-[9px] uppercase tracking-tighter mt-1.5 text-center hidden md:block ${textColor}`}>
                              {storeStatusDisplay[step]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="font-mono text-[11px] font-bold text-center mt-3 block md:hidden text-yellow-500">
                      Status atual: <span className="uppercase">{status.label}</span>
                    </p>
                  </div>
                )}

                {/* Pix pendente — QR Code para pagamento */}
                {order.status === "pendente" && order.payment_last_payload?.qrcode?.imagemQrcode && (
                  <div className="mb-6 rounded border border-orange-500/40 bg-orange-500/5 p-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-orange-600 mb-3 flex items-center gap-2">
                      <Wallet className="h-4 w-4" /> Aguardando pagamento
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                      <div className="bg-white p-2 rounded shrink-0">
                        <img
                          src={order.payment_last_payload.qrcode.imagemQrcode!}
                          alt="QR Code Pix"
                          className="h-36 w-36"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Pix copia e cola
                        </p>
                        <p className="font-mono text-[11px] break-all bg-background border border-border rounded p-2">
                          {order.payment_last_payload.qrcode.qrcode}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Itens comprados */}
                  <div className="space-y-3">
                    <h4 className="font-mono text-xs uppercase text-muted-foreground">Itens</h4>
                    {order.items.map((item) => (
                      <div key={item.id} className="rounded border border-border p-3 bg-card/30 flex items-center justify-between">
                        <div>
                          <p className="font-mono text-sm font-bold text-foreground">
                            {item.quantity}× {item.product?.name ?? "Produto"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground mt-0.5">
                            {item.product ? CATEGORIA_LABEL[item.product.category] ?? item.product.category : ""}
                          </p>
                        </div>
                        <span className="font-mono text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}

                    {/* Negativos incluídos no envio */}
                    {order.films.length > 0 && (
                      <>
                        <h4 className="font-mono text-xs uppercase text-muted-foreground pt-2 flex items-center gap-1">
                          <Film className="h-3.5 w-3.5" /> Negativos incluídos
                        </h4>
                        {order.films.map((film) => (
                          <div key={film.id} className="rounded border border-border p-3 bg-card/30">
                            <p className="font-mono text-sm text-foreground">{film.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground mt-0.5 uppercase">
                              {film.status === "enviado" ? "Enviado" : film.status === "embalado" ? "Embalado para envio" : film.status}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Detalhes da entrega */}
                  <div>
                    <h4 className="font-mono text-xs uppercase text-muted-foreground mb-2">Entrega</h4>
                    <div className="space-y-2 text-sm font-mono text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {DELIVERY_LABEL[order.delivery_type] ?? order.delivery_type}
                      </p>
                      {order.shipping_address && <p>{order.shipping_address}</p>}
                      {order.shipping_service && (
                        <p>
                          {order.shipping_service}
                          {order.shipping_deadline ? ` · ${order.shipping_deadline} dias` : ""}
                        </p>
                      )}
                      {order.tracking_code && (
                        <p>Rastreio: <span className="text-foreground">{order.tracking_code}</span></p>
                      )}
                      <div className="border-t border-border/40 pt-2 mt-2 space-y-1">
                        {order.coupon_discount ? (
                          <p className="flex justify-between"><span>Desconto</span><span className="text-primary">-{formatCurrency(order.coupon_discount)}</span></p>
                        ) : null}
                        {order.shipping_cost ? (
                          <p className="flex justify-between"><span>Frete</span><span>{formatCurrency(order.shipping_cost)}</span></p>
                        ) : null}
                        <p className="flex justify-between text-foreground font-bold"><span>Total</span><span>{formatCurrency(order.total_value)}</span></p>
                      </div>
                      <p className="text-xs pt-1">Criado em {new Date(order.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}