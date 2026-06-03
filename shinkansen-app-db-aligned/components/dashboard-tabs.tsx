"use client"

/**
 * components/dashboard-tabs.tsx
 *
 * Alterna entre a dashboard de Serviços (revelação) e a da Loja (compras).
 * O botão de toggle segue a estética game-menu do projeto.
 *
 * Uso na página /dashboard:
 *   <DashboardTabs
 *     servicosSlot={<DashboardClient ... />}
 *     lojaSlot={<StoreDashboardClient orders={storeOrders} />}
 *   />
 *
 * Como o DashboardClient atual já renderiza header + título + conteúdo,
 * a forma menos invasiva é manter o DashboardClient como está para a aba
 * Serviços e renderizar a StoreDashboardClient na aba Loja, com o toggle
 * acima das duas. Veja a nota de integração no fim do arquivo.
 */

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Film, ShoppingBag } from "lucide-react"

type Aba = "servicos" | "loja"

export function DashboardTabs({
  servicosSlot,
  lojaSlot,
}: {
  servicosSlot: React.ReactNode
  lojaSlot: React.ReactNode
}) {
  const [aba, setAba] = useState<Aba>("servicos")

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 mb-8">
        <TabButton
          active={aba === "servicos"}
          onClick={() => setAba("servicos")}
          icon={<Film className="h-4 w-4" />}
          label="Serviços"
        />
        <TabButton
          active={aba === "loja"}
          onClick={() => setAba("loja")}
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Loja"
        />
      </div>

      {/* Conteúdo */}
      <motion.div
        key={aba}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {aba === "servicos" ? servicosSlot : lojaSlot}
      </motion.div>
    </div>
  )
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 font-mono text-sm uppercase tracking-wider border-b-2 transition-all
        ${active
          ? "border-primary text-primary bg-primary/10"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}`}
    >
      {icon}
      {label}
    </button>
  )
}