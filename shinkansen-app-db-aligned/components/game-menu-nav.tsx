"use client"

import React from "react"

import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LogIn, Package, Shield, User, Camera, ShoppingBag } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  href: string
  label: string
  description: string
  icon: React.ReactNode
  requiresAuth?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "INICIO",
    description: "Tela inicial",
    icon: <Home className="h-5 w-5" />,
  },
  {
    href: "/store",
    label: "LOJA",
    description: "Monte seu time de filmes e acessorios",
    icon: <ShoppingBag className="h-5 w-5" />,
  },
  {
    href: "/orders",
    label: "NOVO PEDIDO",
    description: "Envie seus filmes para revelação",
    icon: <Camera className="h-5 w-5" />,
    requiresAuth: true,
  },
  {
    href: "/dashboard",
    label: "MEUS PEDIDOS",
    description: "Acompanhe seus pedidos",
    icon: <Package className="h-5 w-5" />,
    requiresAuth: true,
  },
  {
    href: "/account",
    label: "CONTA",
    description: "Complete seus dados e ajuste",
    icon: <User className="h-5 w-5" />,
    requiresAuth: true,
  },
  {
    href: "/admin",
    label: "ADMIN",
    description: "Painel interno do laboratorio",
    icon: <Shield className="h-5 w-5" />,
    adminOnly: true,
  },
]

interface GameMenuNavProps {
  user?: { id: string; email?: string; user_metadata?: { is_admin?: boolean } } | null
  variant?: "vertical" | "horizontal"
}

export function GameMenuNav({ user, variant = "vertical" }: GameMenuNavProps) {
  const pathname = usePathname()
  const isAdmin = user?.user_metadata?.is_admin

  const filteredItems = navItems.filter((item) => {
    if (item.requiresAuth && !user) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 },
  }

  if (variant === "horizontal") {
    return (
      <TooltipProvider>
        <motion.nav className="flex items-center gap-1" variants={container} initial="hidden" animate="show">
          {filteredItems.map((navItem) => {
            const isActive = pathname === navItem.href
            return (
              <Tooltip key={navItem.href}>
                <TooltipTrigger asChild>
                  <motion.div variants={item}>
                    <Link
                      href={navItem.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-all duration-200",
                        "border border-transparent hover:border-primary hover:bg-primary/10",
                        isActive && "border-primary bg-primary/20 text-primary",
                      )}
                    >
                      {navItem.icon}
                      <span className="hidden md:inline">{navItem.label}</span>
                    </Link>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card border-primary">
                  <p className="font-mono text-zinc-500 text-xs">{navItem.description}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {!user && (
            <motion.div variants={item}>
              <Link
                href="/auth/login"
                className="flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/80 transition-all"
              >
                <LogIn className="h-5 w-5" />
                <span className="hidden md:inline">ENTRAR</span>
              </Link>
            </motion.div>
          )}
        </motion.nav>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <motion.nav className="flex flex-col gap-2" variants={container} initial="hidden" animate="show">
        {filteredItems.map((navItem, index) => {
          const isActive = pathname === navItem.href
          return (
            <Tooltip key={navItem.href}>
              <TooltipTrigger asChild>
                <motion.div variants={item} style={{ animationDelay: `${index * 0.1}s` }}>
                  <Link
                    href={navItem.href}
                    className={cn(
                      "game-menu-item flex items-center gap-4 px-6 py-4 font-mono text-lg uppercase tracking-widest transition-all duration-300",
                      "border-l-2 border-transparent hover:border-primary hover:bg-muted/50",
                      isActive && "border-primary bg-muted/30 text-primary",
                    )}
                  >
                    <span className="text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    {navItem.icon}
                    <span>{navItem.label}</span>
                  </Link>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card border-primary">
                <p className="font-mono text-zinc-500 text-sm">{navItem.description}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
        {!user && (
          <motion.div variants={item}>
            <Link
              href="/auth/login"
              className="flex items-center gap-4 px-6 py-4 font-mono text-lg uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/80 transition-all mt-4"
            >
              <LogIn className="h-5 w-5" />
              <span>ENTRAR / CADASTRAR</span>
            </Link>
          </motion.div>
        )}
      </motion.nav>
    </TooltipProvider>
  )
}