"use client"

/**
 * components/store/diagonal-bg.tsx
 *
 * Fundo intrincado estilo fighting game / glitch — Multi-camadas de "SHINKANSEN FILMS"
 * se sobrepondo em diferentes tempos de execução para iniciar já preenchido e embaralhado.
 */

import * as React from "react"

const TEXT      = "SHINKANSEN FILMS"
const ROWS      = 14        // Quantidade de linhas por camada
const COLS      = 2         // Repetições horizontais base
const FONT_SIZE = 90        // px
const GAP_X     = 20        // Espaço horizontal entre repetições
const GAP_Y     = 20        // Espaço vertical entre linhas
const COLOR     = "#e5271a"

// 🌟 CONFIGURAÇÃO DAS CAMADAS (Com delays negativos para iniciar embaralhado)
const LAYERS = [
  {
    id: "back-layer",
    angle: -28,
    speed: 35,
    delay: "-12s",          // 🌟 Já nasce como se estivesse rodando há 12 segundos
    opacity: 0.12,
    direction: "normal",
    offsetMultiplier: 0
  },
  //{
  //  id: "mid-layer",
  //  angle: -28,
  //  speed: 25,
  //  delay: "-5s",           // 🌟 Já nasce em outro ponto do ciclo (5 segundos rodando)
  //  opacity: 0.25,
  //  direction: "normal",
  //  offsetMultiplier: 1
  //},
  {
    id: "front-layer",
    angle: -28,
    speed: 18,
    delay: "-15s",          // 🌟 Esse aqui já começa bem avançado no ciclo
    opacity: 0.40,
    direction: "normal",
    offsetMultiplier: 2.5
  }
]

export function DiagonalBg() {
  // Gera o offset das linhas (efeito tijolo)
  const lines = React.useMemo(() => {
    const arr: { key: number; offset: number }[] = []
    for (let r = 0; r < ROWS; r++) {
      arr.push({ key: r, offset: (r % 2) * (GAP_X / 2) })
    }
    return arr
  }, [])

  const oneLineWidth = COLS * (TEXT.length * (FONT_SIZE * 0.65) + GAP_X)

  return (
    <>
      <style>{`
        @keyframes sks-diagonal-normal {
          0%   { transform: translate(0px, 0px); }
          100% { transform: translate(${-oneLineWidth / COLS}px, ${-(GAP_Y * 2)}px); }
        }
        @keyframes sks-diagonal-reverse {
          0%   { transform: translate(0px, 0px); }
          100% { transform: translate(${oneLineWidth / COLS}px, ${GAP_Y * 2}px); }
        }
      `}</style>
      
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-25%", 
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
          background: "transparent",
        }}
      >
        {LAYERS.map((layer) => (
          <div
            key={layer.id}
            style={{
              position: "absolute",
              inset: 0,
              opacity: layer.opacity,
              transform: `rotate(${layer.angle}deg)`,
              transformOrigin: "center center",
              mixBlendMode: "screen" 
            }}
          >
            <div style={{
              // 🌟 Injetando o delay dinâmico aqui:
              animation: `sks-diagonal-${layer.direction} ${layer.speed}s linear infinite`,
              animationDelay: layer.delay, 
              willChange: "transform",
            }}>
              {lines.map(({ key, offset }) => (
                <div
                  key={key}
                  style={{
                    whiteSpace: "nowrap",
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: FONT_SIZE,
                    color: COLOR,
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                    marginBottom: GAP_Y,
                    paddingLeft: offset * layer.offsetMultiplier,
                    userSelect: "none",
                  }}
                >
                  {Array.from({ length: COLS * 2 }, (_, i) => (
                    <span key={i} style={{ marginRight: GAP_X }}>
                      {TEXT}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}