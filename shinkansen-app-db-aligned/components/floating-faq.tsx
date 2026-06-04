"use client"

import { useState } from "react"
import { usePathname } from "next/navigation" // 🌟 1. Importar o hook de rotas
import { motion, AnimatePresence } from "framer-motion"
import { HelpCircle, X } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

// 🌟 2. Lista de páginas onde o FAQ NÃO deve aparecer
const BLACKLISTED_ROUTES = [
  "/store",       // Tela de triagem/operação do laboratório
  "/admin",         // Painel administrativo completo
  "/account",
  "/auth/login"       // Configurações de conta do usuário
]

const faqItems = [
  {
    id: "faq-1",
    question: "O que é revelação?",
    answer:
      "Revelação é o processo quimico que ocorre para tornar a imagem visível e permanente no filme fotografico. O resultado final é um filme (negativo) com a imagem fixada. O processo de revelação é irreversivel e não é o mesmo que ampliação (impressão) de fotos, esse é um processo seguinte.",
  },
  {
    id: "faq-2",
    question: "O que é filme Virgem e filme Velado?",
    answer:
      "Filme Virgem: É o rolo de filme fotográfico novo, que ainda não foi exposto à luz. A sua emulsão está intacta e pronta para gravar fotos.  Filme Velado: É o filme que sofreu uma exposição acidental e excessiva à luz externa (fora da câmara), seja por abrir a tampa traseira da câmara ou por vazamento de luz no rolo. Esta luz indesejada queima a emulsão, inutilizando ou manchando as fotos permanentemente.",
  },
  {
    id: "faq-3",
    question: "Qual a diferença entre Jpg, Dng e Raw?",
    answer:
      "Jpg é um formato de imagem comprimido (acabado voltado para fotos que não serão editadas), Dng é um formato de imagem não comprimido (acabado voltado para fotos que serão editadas) e Raw é um formato de imagem que contém todos os dados do sensor da câmera (bruto, voltado para quem quer fazer o processo de conversão de cores do 0).",
  },
  {
    id: "faq-4",
    question: "Qual a qualidade da digitalização?",
    answer:
      "Todas as digitalizações são feitas com alta qualidade (24mp 14bits), utilizando o mesmo equipamento (Sony Alpha 7II + Takumar 50mm f4).",
  },
  {
    id: "faq-5",
    question: "Qual a diferença entre Digitalização com trilhas e tradicional?",
    answer:
      "A digitalização tradicional inclui apenas o fotograma enquanto a digitalização com trilhas mantém tambem a perfuração do filme na imagem final.",
  },
]

const faqGifPath = "/faq-widget.gif"

export function FloatingFaq() {
  const pathname = usePathname() // 🌟 3. Capturar a rota atual
  
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [gifFailed, setGifFailed] = useState(false)

  // 🌟 4. Verificar se a rota atual (ou sub-rota) está na blacklist
  // O .some com .startsWith garante que se "/admin" estiver bloqueado, "/admin/config" também estará.
  const isBlacklisted = BLACKLISTED_ROUTES.some((route) => 
    pathname === route || pathname?.startsWith(`${route}/`)
  )

  // Se foi fechado manualmente pelo usuário ou se está em uma página proibida, não renderiza nada
  if (dismissed || isBlacklisted) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex flex-col items-end sm:right-6 sm:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="pointer-events-auto mb-3 w-[min(88vw,24rem)] overflow-hidden rounded-md border border-primary/60 bg-card shadow-[0_0_0_1px_rgba(255,20,40,0.15),0_18px_50px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between border-b border-primary/30 bg-primary px-4 py-3 text-primary-foreground">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em]">FAQ Rapido</p>
                <p className="font-mono text-[11px] opacity-90">Perguntas e respostas</p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full text-primary-foreground hover:bg-black/15 hover:text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-4 py-2">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item) => (
                  <AccordionItem key={item.id} value={item.id} className="border-border/80">
                    <AccordionTrigger className="font-mono text-sm uppercase tracking-[0.04em] hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="font-mono text-xs leading-6 text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
        <motion.button
          type="button"
          onClick={() => setOpen((current) => !current)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex h-[18rem] w-[11rem] items-center justify-center overflow-hidden bg-transparent text-primary-foreground transition-transform sm:h-[22rem] sm:w-[14rem]"
          aria-label={open ? "Fechar FAQ rapido" : "Abrir FAQ rapido"}
        >
          {!gifFailed ? (
            <img
              src={faqGifPath}
              alt="FAQ rapido"
              className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(255,20,40,0.35)]"
              onError={() => setGifFailed(true)}
            />
          ) : (
            <div className="flex h-[10rem] w-[10rem] items-center justify-center rounded-full bg-primary shadow-[0_0_24px_rgba(255,20,40,0.35)] sm:h-[12rem] sm:w-[12rem]">
              <HelpCircle className="h-14 w-14" />
            </div>
          )}
        </motion.button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-primary/60 bg-background/90 text-primary shadow-[0_0_16px_rgba(255,20,40,0.22)] transition-colors hover:bg-primary hover:text-primary-foreground"
          aria-label="Fechar atalho da FAQ"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}