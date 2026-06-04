"use client"

/**
 * components/film_slideshow.tsx
 *
 * Dois layouts completos — portrait e landscape.
 * Cada layout inclui perfurações, fotos adjacentes, foto central e textos.
 * Alternados via AnimatePresence conforme a orientação do slide atual.
 */

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Slide } from "@/lib/drive-slides"

// ─────────────────────────────────────────────────────────────────────
// VARIÁVEIS DE AJUSTE FINO
// ─────────────────────────────────────────────────────────────────────

// Fundo — mantenha igual a C_BODY no home-client
const BG                = "#1a0a00"

// Perfurações
const PERF_COLOR        = "#000000"
const PERF_RADIUS       = 7

// Portrait: faixas laterais
const P_STRIP_W         = 58     // largura da faixa lateral (px)
const P_PERF_W          = 29     // largura do furo
const P_PERF_H          = 20     // altura do furo
const P_PERF_COUNT      = 13     // furos por lado
const P_PERF_PAD        = 8     // padding vertical da faixa

// Portrait: fotos adjacentes
const P_ADJ_H           = 90     // altura dos frames adjacentes (px)

// Landscape: faixas horizontais
const L_STRIP_H         = 58     // altura da faixa horizontal (px)
const L_PERF_W          = 20     // largura do furo
const L_PERF_H          = 29     // altura do furo
const L_PERF_COUNT      = 13     // furos por lado
const L_PERF_PAD        = 8      // padding horizontal da faixa

// Landscape: fotos adjacentes
const L_ADJ_W           = 0     // largura dos frames adjacentes (px)

// Separador entre frames
const SEP               = 0    // px — mesma cor do fundo → invisível

// Fotos adjacentes
const ADJ_FILTER        = "brightness(0.20) saturate(0.15)"

// Textos nas faixas
const T_FONT            = "monospace"
const T_SIZE_P          = 20      // portrait — cabe na faixa de P_STRIP_W
const T_SIZE_L          = 20     // landscape — cabe na faixa de L_STRIP_H
const T_SPACING         = "0.15em"
const T_COLOR           = "#da9514"
const T_OPACITY_DIM     = 0.55   // opacidade do título (mais discreto que o autor)

// Animações
const SPRING_FOTO       = { type:"spring" as const, stiffness:260, damping:30,
                             opacity:{ duration:0.18 } }
const SPRING_ORIENT     = { type:"spring" as const, stiffness:200, damping:28,
                             opacity:{ duration:0.22 } }

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function Img({ src, alt, cover, filter }: {
  src: string; alt: string; cover?: boolean; filter?: string
}) {
  return (
    <img src={src} alt={alt} draggable={false} style={{
      width: "100%", height: "100%", display: "block",
      objectFit: cover ? "cover" : "contain",
      filter,
    }} />
  )
}

// ─────────────────────────────────────────────────────────────────────
// LAYOUT PORTRAIT
// faixas laterais com perfurações + texto vertical
// frames empilhados em coluna
// ─────────────────────────────────────────────────────────────────────

function PortraitStrip({ prev, current, next, index, total, showBadge }: {
  prev: Slide; current: Slide; next: Slide
  index: number; total: number; showBadge: boolean
}) {
  const expText    = `SHINKANSEN FILMS · EXP ${String(index + 1).padStart(2, "0")}`
  const authorText = `FOTO: ${current.author}`
  const titleText  = current.title ?? ""

  return (
    <AnimatePresence mode="wait">
      <motion.div key={index}
        style={{ position:"absolute", inset:0, display:"flex", flexDirection:"row" }}
        initial={{ y:"28%", opacity:0, scale:0.97 }}
        animate={{ y:"0%",  opacity:1, scale:1    }}
        exit={{   y:"-7%",  opacity:0, scale:0.98 }}
        transition={SPRING_FOTO}
      >

        {/* ── Faixa esquerda: perfurações + expText ── */}
        <div style={{
          width:          P_STRIP_W,
          flexShrink:     0,
          background:     BG,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        `${P_PERF_PAD}px 0px 0 20px`,
          position:       "relative",
        }}>
          {Array.from({ length: P_PERF_COUNT }).map((_, i) => (
            <div key={i} style={{
              width: P_PERF_W, height: P_PERF_H,
              borderRadius: PERF_RADIUS, background: PERF_COLOR, flexShrink: 0,
            }} />
          ))}
          {/* Texto sobreposto centralizado na faixa */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            padding: "0px 34px 0 0px", // para não colar no topo e na borda direita
          }}>
            <span style={{
              fontFamily: T_FONT, fontSize: T_SIZE_P, color: T_COLOR,
              writingMode: "vertical-rl", transform: "rotate(180deg)",
              letterSpacing: T_SPACING, whiteSpace: "nowrap",
            }}>
              {expText}
            </span>
          </div>
        </div>

        {/* ── Coluna central: 3 frames ── */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", background:BG }}>

          {/* Frame anterior */}
          <div style={{ height:P_ADJ_H, flexShrink:0, overflow:"hidden" }}>
            <Img src={prev.url} alt="" cover filter={ADJ_FILTER} />
          </div>

          <div style={{ background:BG, flexShrink:0, height:SEP}} />
          <span style={{
                fontFamily: T_FONT, fontSize: T_SIZE_P,
                color: T_COLOR, 
                padding: "0px 20%", // para não colar na borda
                //writingMode: "vertical-rl", 
                letterSpacing: T_SPACING, whiteSpace: "nowrap",
              }}>
                {titleText}
              </span>

          {/* Frame central */}
          <div style={{ flex:1, minHeight:0, overflow:"hidden", position:"relative" }}>
            <Img src={current.url} alt={current.title || current.author} />
            {showBadge && (
              <div style={{
                position:"absolute", bottom:4, right:4,
                fontFamily:T_FONT, fontSize:8, color:T_COLOR,
                background:"rgba(18,6,0,0.75)", padding:"2px 5px", borderRadius:2,
              }}>
                {String(index+1).padStart(2,"0")}/{String(total).padStart(2,"0")}
              </div>
            )}
          </div>
          <span style={{
              fontFamily: T_FONT, fontSize: 12, color: T_COLOR,
              //writingMode: "vertical-rl", 
              padding: "10px", // para não colar na borda
              letterSpacing: T_SPACING, whiteSpace: "nowrap",opacity: T_OPACITY_DIM,
            }}>
              {authorText}
            </span>

          {/* Frame seguinte */}
          <div style={{ height:P_ADJ_H, flexShrink:0, overflow:"hidden" }}>
            <Img src={next.url} alt="" cover filter={ADJ_FILTER} />
          </div>

        </div>

        {/* ── Faixa direita: perfurações + autor + título ── */}
        <div style={{
          width:          P_STRIP_W,
          flexShrink:     0,
          background:     BG,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        `${P_PERF_PAD}px 20px 0 0px`,
          position:       "relative",
        }}>
          {Array.from({ length: P_PERF_COUNT }).map((_, i) => (
            <div key={i} style={{
              width: P_PERF_W, height: P_PERF_H,
              borderRadius: PERF_RADIUS, background: PERF_COLOR, flexShrink: 0,
            }} />
          ))}
          
        </div>

      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────
// LAYOUT LANDSCAPE
// faixas horizontais com perfurações + texto horizontal
// frames lado a lado em linha
// ─────────────────────────────────────────────────────────────────────

function LandscapeStrip({ prev, current, next, index, total, showBadge }: {
  prev: Slide; current: Slide; next: Slide
  index: number; total: number; showBadge: boolean
}) {
  const expText    = `SHINKANSEN FILMS · EXP ${String(index + 1).padStart(2, "0")}`
  const authorText = `FOTO: ${current.author}`
  const titleText  = current.title ?? `${current.title}`
  return (
    <AnimatePresence mode="wait">
      <motion.div key={index}
        style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column" }}
        initial={{ x:"28%", opacity:0, scale:0.97 }}
        animate={{ x:"0%",  opacity:1, scale:1    }}
        exit={{   x:"-7%",  opacity:0, scale:0.98 }}
        transition={SPRING_FOTO}
      >

        {/* ── Faixa superior: perfurações + expText ── */}
        <div style={{
          height:         L_STRIP_H,
          flexShrink:     0,
          background:     BG,
          display:        "flex",
          flexDirection:  "row",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        `20px ${L_PERF_PAD}px 5px 0px`,
          position:       "relative",
        }}>
          {Array.from({ length: L_PERF_COUNT }).map((_, i) => (
            <div key={i} style={{
              width: L_PERF_W, height: L_PERF_H,
              borderRadius: PERF_RADIUS, background: PERF_COLOR, flexShrink: 0,
            }} />
          ))}
          {/* Texto centralizado sobre as perfurações */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{
              fontFamily: T_FONT, fontSize: T_SIZE_L, color: T_COLOR,
              padding: "0px 0px 35px 0px", // para não colar na borda
              letterSpacing: T_SPACING, whiteSpace: "nowrap",
            }}>
              {expText}
            </span>
          </div>
        </div>

        {/* ── Linha central: 3 frames lado a lado ── */}
        <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"row", background:BG }}>

          {/* Frame anterior */}

          <div style={{ width:100, flexShrink:0, overflow:"hidden", padding: "0 20px 0px 0px" }}>
            <Img src={prev.url} alt="" cover filter={ADJ_FILTER} />
          </div>          
          <div style={{ width:SEP, background:BG, flexShrink:0 }} />

          {/* Frame central */}
          <div style={{ flex:1, minWidth:0, overflow:"hidden", position:"relative" }}>
            <Img src={current.url} alt={current.title || current.author} />
            {showBadge && (
              <div style={{
                position:"absolute", bottom:4, right:4,
                fontFamily:T_FONT, fontSize:8, color:T_COLOR,
                background:"rgba(18,6,0,0.75)", padding:"2px 5px", borderRadius:2,
              }}>
                {String(index+1).padStart(2,"0")}/{String(total).padStart(2,"0")}
              </div>
            )}
          </div>

          <div style={{ width:SEP, background:BG, flexShrink:0 }} />
          <span style={{
              fontFamily: T_FONT, fontSize: 12, color: T_COLOR,
              writingMode: "vertical-rl", transform: "rotate(180deg)",
              opacity: T_OPACITY_DIM,
              letterSpacing: T_SPACING, whiteSpace: "nowrap",
            }}>
              {authorText}
          </span>
          {/* Frame seguinte */}
          <div style={{ width:120, flexShrink:0, overflow:"hidden" }}>
            <Img src={next.url} alt="" cover filter={ADJ_FILTER} />
          </div>
        </div>

        {/* ── Faixa inferior: perfurações + autor · título ── */}
        <div style={{
          height:         L_STRIP_H,
          flexShrink:     0,
          background:     BG,
          display:        "flex",
          flexDirection:  "row",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        `0px ${L_PERF_PAD}px 18px 0px`,
          position:       "relative",
        }}>
          {Array.from({ length: L_PERF_COUNT }).map((_, i) => (
            <div key={i} style={{
              width: L_PERF_W, height: L_PERF_H,
              borderRadius: PERF_RADIUS, background: PERF_COLOR, flexShrink: 0,
            }} />
          ))}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            padding: "35px 0px 0px 0px", // para não colar na borda
          }}>
            <span style={{
              fontFamily: T_FONT, fontSize: 20, color: T_COLOR,
              //writingMode: "vertical-rl", transform: "rotate(180deg)",
              //opacity: T_OPACITY_DIM,
              
              letterSpacing: T_SPACING, whiteSpace: "nowrap",
            }}>
              {titleText}
            </span>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────

interface FilmSlideshowProps {
  intervalMs?:    number
  showBadge?:     boolean
  onIndexChange?: (index: number, slide?: Slide) => void
  initialSlides?: Slide[]
}

export function FilmSlideshow({
  intervalMs    = 5000,
  showBadge     = false,
  onIndexChange,
  initialSlides = [],
}: FilmSlideshowProps) {
  const [slides, setSlides] = React.useState<Slide[]>(initialSlides)
  const [index, setIndex]   = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)

  const current     = slides[index]
  const isLandscape = current?.orientation === "landscape"

  React.useEffect(() => {
    if (initialSlides.length > 0) { setSlides(initialSlides); setLoaded(true); return }
    fetch("/api/slides")
      .then(r => r.json())
      .then(d => { if (d.slides?.length) setSlides(d.slides) })
      .catch(console.error)
      .finally(() => setLoaded(true))
  }, [initialSlides])

  React.useEffect(() => {
    if (!slides.length) return
    ;[-1, 1].forEach(o => {
      const img = new Image()
      img.src   = slides[(index + o + slides.length) % slides.length]?.url ?? ""
    })
  }, [index, slides])

  React.useEffect(() => { onIndexChange?.(index, slides[index]) }, [index,slides, onIndexChange])

  React.useEffect(() => {
    if (!slides.length) return
    const id = setInterval(() => setIndex(p => (p + 1) % slides.length), intervalMs)
    return () => clearInterval(id)
  }, [slides, intervalMs])

  if (!loaded || !slides.length) {
    return <div style={{ width:"100%", height:"100%", background:BG }} />
  }

  const prev  = slides[(index - 1 + slides.length) % slides.length]
  const next  = slides[(index + 1) % slides.length]
  const props = { prev, current, next, index, total: slides.length, showBadge }

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", background:"transparent" }}>
      <AnimatePresence mode="wait">
        {isLandscape ? (
          <motion.div key="landscape" style={{ position:"absolute", inset:0 }}
            initial={{ opacity:0, scale:0.96 }}
            animate={{ opacity:1, scale:1    }}
            exit={{   opacity:0, scale:0.96  }}
            transition={SPRING_ORIENT}
          >
            <LandscapeStrip {...props} />
          </motion.div>
        ) : (
          <motion.div key="portrait" style={{ position:"absolute", inset:0 }}
            initial={{ opacity:0, scale:0.96 }}
            animate={{ opacity:1, scale:1    }}
            exit={{   opacity:0, scale:0.96  }}
            transition={SPRING_ORIENT}
          >
            <PortraitStrip {...props} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}