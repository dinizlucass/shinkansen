"use client"

import * as React from "react"
import { FilmSlideshow } from "@/components/film_slideshow"
import { motion } from "framer-motion"
import AnimatedLogo from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"
import type { User } from "@supabase/supabase-js"
import type { Slide } from "@/lib/drive-slides"

// ─────────────────────────────────────────────────────────────────────
// AJUSTE FINO
// ─────────────────────────────────────────────────────────────────────

const C_BORDER  = "#000000"   // borda externa do rolo

const ROLO_W    = 420         // largura do rolo (px)
const ROLO_H    = 640         // altura do rolo (px)
const ROLO_H_LS = 420          // largura do rolo deitado (px)
const ROLO_W_LS = 640        // altura do rolo deitado (px)

// ─────────────────────────────────────────────────────────────────────

interface HomeClientProps {
  user:          User | null
  initialSlides: Slide[]
}

export function HomeClient({ user, initialSlides = [] }: HomeClientProps) {
  const [isLandscape, setIsLandscape] = React.useState(false)
  return (
    <div className="min-h-screen bg-background scanline-overlay flex flex-col">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px),
                            linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 flex flex-1">

        {/* ── Coluna esquerda: menu ── */}
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center px-8 md:px-16 lg:px-24 py-16">
          <FadeIn delay={0.2}>
            <AnimatedLogo className="w-[clamp(160px,25vw,320px)] h-auto" />
          </FadeIn>
          <SlideIn direction="left" delay={0.4}>
            <p className="text-muted-foreground font-mono text-sm mb-8 max-w-md">
              Serviços de revelação e digitalização. Processamento de qualidade
              para todo tipo de filme em C-41, ECN-2 e P&amp;B.
            </p>
          </SlideIn>
          <GameMenuNav user={user} variant="vertical" />
          <FadeIn delay={1} className="mt-12">
            <div className="flex items-center gap-3 text-sm font-mono">
              <motion.div
                className="w-2 h-2 rounded-full bg-green-500"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <span className="text-muted-foreground">STATUS DO LAB: OPERACIONAL</span>
            </div>
            {user && (
              <p className="text-xs text-muted-foreground mt-2">
                Logado como {user.email}
              </p>
            )}
          </FadeIn>
        </div>

        {/* ── Coluna direita: rolo de filme ── */}
        <div className="hidden md:flex w-1/2 lg:w-3/5 items-center justify-center relative overflow-hidden">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <div style={{
              position:   "relative",
              width:      isLandscape ? ROLO_W_LS : ROLO_W,
              height:     isLandscape ? ROLO_H_LS : ROLO_H,
              //transition: "height 0.4s ease",
              border:     `2px solid ${C_BORDER}`,
              boxShadow:  "0 20px 60px rgba(0,0,0,0.65)",
              overflow:   "hidden",
            }}>

              <FilmSlideshow
                intervalMs={8000}
                showBadge={false}
                initialSlides={initialSlides}
                onIndexChange={(_, slide) => setIsLandscape(slide?.orientation === "landscape") }
              />
            </div>
          </motion.div>

          {/* Decorações de fundo */}
          <motion.div
            className="absolute top-20 right-20 w-32 h-32"
            style={{ border: `1px solid ${C_BORDER}50` }}
            animate={{ rotate: [0, 90, 180, 270, 360] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          />
          <motion.div
            className="absolute bottom-32 left-20 w-16 h-16"
            style={{ background: `${C_BORDER}18` }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
        </div>

      </div>

      <footer className="relative z-10 px-8 py-4 flex justify-between items-center text-xs font-mono text-muted-foreground border-t border-border bg-background/80 backdrop-blur">
        <span>SKS v0.5</span>
        <span>DESDE 2026</span>
      </footer>
    </div>
  )
}