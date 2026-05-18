"use client"

import * as React from "react"
import { FilmSlideshow } from "@/components/film_slideshow"
import { motion } from "framer-motion"
import AnimatedLogo from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"
import type { User } from "@supabase/supabase-js"

interface HomeClientProps {
  user: User | null
}

export function HomeClient({ user }: HomeClientProps) {
  const slides = ["/slides/01.jpg", "/slides/02.jpg", "/slides/03.jpg"]
  const slideAuthors = ["Larissa Higa", "Larissa Higa", "Larissa Higa"]
  const slideTitles = ["", "", ""]

  const [currentSlide, setCurrentSlide] = React.useState(0)
  const expText = `SHINKANSEN FILMS - EXP ${String(currentSlide + 1).padStart(2, "0")}`
  const authorText = `FOTO: ${slideAuthors[currentSlide] ?? "-"}` 
  const titleText = slideTitles[currentSlide] ? `TITULO: ${slideTitles[currentSlide]}` : ""

  return (
    <div className="min-h-screen bg-background scanline-overlay flex flex-col">
      <div
        className="fixed inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 flex flex-1">
        <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center px-8 md:px-16 lg:px-24 py-16">
          <FadeIn delay={0.2}>
            <AnimatedLogo className="w-[clamp(160px,25vw,320px)] h-auto" />
          </FadeIn>

          <SlideIn direction="left" delay={0.4}>
            <p className="text-muted-foreground font-mono text-sm mb-8 max-w-md">
              Serviços de revelação e digitalização. Processamento de qualidade para todo tipo de filme em
              C-41, ECN-2 e P&amp;B.
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
            {user && <p className="text-xs text-muted-foreground mt-2">Logado como {user.email}</p>}
          </FadeIn>
        </div>

        <div className="hidden md:flex w-1/2 lg:w-3/5 items-center justify-center relative overflow-hidden">
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <div className="relative w-[420px] h-[540px]">
              <div className="absolute inset-0 rounded-md border-4 border-muted/60 bg-[#0e1321] shadow-[0_0_0_1px_rgba(105,255,255,0.10)]" />
              <div className="absolute inset-[18px] rounded-sm border border-muted/60 bg-muted/10" />
              <div className="absolute inset-y-[18px] left-[14px] w-[54px] rounded-sm border border-muted/40" />
              <div className="absolute inset-y-[18px] right-[14px] w-[54px] rounded-sm border border-muted/40" />

              <div className="absolute top-[70px] left-[3px] bottom-[70px] flex items-center pointer-events-none">
                <span
                  className="font-mono text-[20px] tracking-[0.25em] text-[#f5d976] opacity-90 rotate-180"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {expText}
                </span>
              </div>

              <div className="absolute top-[70px] right-[3px] bottom-[70px] flex items-center pointer-events-none">
                <div
                  className="flex flex-col gap-2 font-mono text-[20px] tracking-[0.22em] text-[#f3f1e7] opacity-80"
                  style={{ writingMode: "vertical-rl" }}
                >
                  <span>{authorText}</span>
                  {titleText ? <span className="opacity-70">{titleText}</span> : null}
                </div>
              </div>

              <div className="absolute inset-y-[32px] left-[26px] flex flex-col justify-between">
                {[...Array(14)].map((_, i) => (
                  <motion.div
                    key={`L-${i}`}
                    className="h-[18px] w-[26px] rounded-[6px] bg-background border border-muted/50"
                    initial={{ opacity: 0, x: -10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.55 + i * 0.03, duration: 0.25 }}
                  />
                ))}
              </div>

              <div className="absolute inset-y-[32px] right-[26px] flex flex-col justify-between">
                {[...Array(14)].map((_, i) => (
                  <motion.div
                    key={`R-${i}`}
                    className="h-[18px] w-[26px] rounded-[6px] bg-background border border-muted/50"
                    initial={{ opacity: 0, x: 10, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.55 + i * 0.03, duration: 0.25 }}
                  />
                ))}
              </div>

              <div className="absolute inset-[10px] rounded-sm border border-muted/40" />
              <div className="absolute inset-y-[38px] left-[78px] right-[78px] rounded-sm border-2 border-muted/40 bg-black/20 overflow-hidden">
                <FilmSlideshow intervalMs={5000} showBadge={false} slides={slides} onIndexChange={setCurrentSlide} />
              </div>

              <motion.div
                className="absolute bottom-[-30px] left-[24px] font-mono text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
              />
            </div>
          </motion.div>

          <motion.div
            className="absolute top-20 right-20 w-32 h-32 border border-primary/30"
            animate={{
              rotate: [0, 90, 180, 270, 360],
              borderColor: ["var(--primary)", "var(--secondary)", "var(--primary)"],
            }}
            transition={{
              rotate: { repeat: Infinity, duration: 20, ease: "linear" },
              borderColor: { repeat: Infinity, duration: 4, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute bottom-32 left-20 w-16 h-16 bg-secondary/20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
        </div>
      </div>

      <footer className="relative z-10 px-8 py-4 flex justify-between items-center text-xs font-mono text-muted-foreground border-t border-border bg-background/80 backdrop-blur">
        <span>SKS v0.3</span>
        <span>DESDE 2026</span>
      </footer>
    </div>
  )
}
