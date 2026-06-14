"use client"

/**
 * components/floating-faq.tsx
 *
 * Mascote FAQ inspirado no Clippy do Word.
 * Apresenta informação em estágios conversacionais:
 *   1. Saudação — bolha pequena
 *   2. Tópicos — lista compacta de perguntas
 *   3. Resposta — uma resposta por vez com "voltar"
 */

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

// ── Rotas onde o FAQ não aparece ──────────────────────────────────────

const BLACKLISTED_ROUTES = [
  "/store",
  "/admin",
  "/account",
  "/auth/login",
]

// ── Conteúdo ──────────────────────────────────────────────────────────

const SAUDACOES = [
  "Oi! Primeira vez revelando filme?",
  "E aí! Posso ajudar com alguma dúvida?",
  "Opa! Quer saber mais sobre revelação?",
]

const faqItems = [
  {
    id: "faq-1",
    short: "O que é revelação?",
    answer:
      "É o processo químico que torna a imagem visível e permanente no filme. O resultado é um negativo com a imagem fixada. Não é o mesmo que impressão de fotos — esse é o passo seguinte.",
  },
  {
    id: "faq-2",
    short: "Filme virgem vs velado?",
    answer:
      "Virgem: rolo novo, nunca exposto à luz, pronto para fotografar.\n\nVelado: filme que sofreu exposição acidental à luz externa (tampa aberta, vazamento no rolo). A luz queima a emulsão e inutiliza as fotos.",
  },
  {
    id: "faq-3",
    short: "JPG, DNG ou RAW?",
    answer:
      "JPG → comprimido, pronto para usar sem editar.\n\nDNG → não comprimido, ideal para quem vai editar.\n\nRAW → dados brutos do sensor, para quem quer fazer a conversão de cores do zero.",
  },
  {
    id: "faq-4",
    short: "Qualidade da digitalização?",
    answer:
      "Todas as digitalizações são feitas em alta qualidade: 24MP, 14 bits. Equipamento: Sony Alpha 7II + Takumar 50mm f/4.",
  },
  {
    id: "faq-5",
    short: "Trilhas vs tradicional?",
    answer:
      "Tradicional → só o fotograma, sem bordas.\n\nCom trilhas → mantém a perfuração do filme na imagem final, aquele visual clássico.",
  },
]

// ── Tipos de estágio ──────────────────────────────────────────────────

type Stage = "greeting" | "topics" | "answer"

const faqGifPath = "/faq-widget.gif"

// ══════════════════════════════════════════════════════════════════════
// COMPONENTE
// ══════════════════════════════════════════════════════════════════════

export function FloatingFaq() {
  const pathname = usePathname()

  const [dismissed, setDismissed] = useState(false)
  const [stage, setStage]         = useState<Stage>("greeting")
  const [answerId, setAnswerId]   = useState<string | null>(null)
  const [gifFailed, setGifFailed] = useState(false)
  const [saudacao]                = useState(() =>
    SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)]
  )

  // Auto-mostra saudação com delay
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const isBlacklisted = BLACKLISTED_ROUTES.some(
    (route) => pathname === route || pathname?.startsWith(`${route}/`)
  )

  if (dismissed || isBlacklisted) return null

  const answer = faqItems.find((f) => f.id === answerId)

  function handleTopicClick(id: string) {
    setAnswerId(id)
    setStage("answer")
  }

  function handleBack() {
    setStage("topics")
    setAnswerId(null)
  }

  function handleDismiss() {
    setVisivel(false)
    setTimeout(() => setDismissed(true), 200)
  }

  return (
    <div className="pointer-events-none fixed left-2 bottom-2 z-[70] flex flex-col items-end sm:right-4 sm:bottom-4">

      {/* ── Bolha de conversa ── */}
      <AnimatePresence>
        {visivel && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-auto mb-2 w-[min(80vw,20rem)]"
          >
            {/* Caixa com seta */}
            <div className="relative rounded-lg border border-border bg-card shadow-lg">

              {/* Header da bolha */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {stage === "greeting" ? "Sekkyō-sha" : stage === "topics" ? "Escolha um tópico" : "Resposta"}
                </span>
                <button
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Fechar FAQ"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Conteúdo por estágio */}
              <div className="px-3 py-3">
                <AnimatePresence mode="wait">

                  {/* ESTÁGIO 1: Saudação */}
                  {stage === "greeting" && (
                    <motion.div
                      key="greeting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="font-mono text-sm text-foreground leading-relaxed mb-3">
                        {saudacao}
                      </p>
                      <button
                        onClick={() => setStage("topics")}
                        className="w-full py-2 rounded border border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase tracking-wider hover:bg-primary/20 transition-colors"
                      >
                        Ver perguntas frequentes
                      </button>
                    </motion.div>
                  )}

                  {/* ESTÁGIO 2: Tópicos */}
                  {stage === "topics" && (
                    <motion.div
                      key="topics"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-1.5"
                    >
                      {faqItems.map((item, idx) => (
                        <motion.button
                          key={item.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleTopicClick(item.id)}
                          className="text-left px-3 py-2 rounded border border-border hover:border-primary/50 hover:bg-primary/5 font-mono text-xs text-foreground transition-all"
                        >
                          {item.short}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {/* ESTÁGIO 3: Resposta */}
                  {stage === "answer" && answer && (
                    <motion.div
                      key={`answer-${answer.id}`}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="font-mono text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
                        {answer.short}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground leading-[1.8] whitespace-pre-line">
                        {answer.answer}
                      </p>
                      <button
                        onClick={handleBack}
                        className="mt-3 font-mono text-[11px] text-primary hover:underline"
                      >
                        ← outras perguntas
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Seta apontando para o personagem */}
              <div className="absolute -bottom-[6px] right-22 w-3 h-3 rotate-45 border-r border-b border-border bg-card" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Personagem ── */}
      <div className="pointer-events-auto relative">
        <motion.button
          type="button"
          onClick={() => {
            if (!visivel) { setVisivel(true); return }
            if (stage === "greeting") setStage("topics")
            else setStage("greeting")
          }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-end justify-center overflow-hidden bg-transparent"
          style={{ width: "10rem", height: "20rem" }}
          aria-label={visivel ? "Fechar FAQ" : "Abrir FAQ"}
        >
          {!gifFailed ? (
            <img
              src={faqGifPath}
              alt="Mascote FAQ"
              className="h-full w-full object-contain drop-shadow-[0_0_16px_rgba(255,20,40,0.25)]"
              onError={() => setGifFailed(true)}
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <span className="font-mono text-lg font-bold">?</span>
            </div>
          )}
        </motion.button>

        {/* X para fechar permanentemente */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary"
          aria-label="Esconder mascote"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}