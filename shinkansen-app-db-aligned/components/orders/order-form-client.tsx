"use client"

import { useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AnimatedLogo } from "@/components/animated-logo"
import { GameMenuNav } from "@/components/game-menu-nav"
import { FadeIn, SlideIn } from "@/components/page-transition"
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Info, 
  Loader2,
  Film
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { MAX_FILM_OBSERVATION_LENGTH } from "@/lib/validators/orders"

/* ============================================================================
   TYPES
   ============================================================================ */

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  category: string
  ui_id: string | null
}

interface FilmEntry {
  id: string
  name: string
  serviceIds: string[]
  fileFormat: "dng" | "jpg" | "raw" | "tiff" | null
  pushPull: number
  observation: string
}

interface OrderFormClientProps {
  user: User | null
  services: Service[]
}

type Step = 1 | 2 | 3

/* ============================================================================
   CONSTANTS kimi generator
   ============================================================================ */

const FILE_FORMATS: { value: FilmEntry["fileFormat"]; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "dng", label: "DNG" },
  { value: "raw", label: "RAW" },
]

const PUSH_PULL_OPTIONS = [
  { value: "-3", label: "-3" },
  { value: "-2", label: "-2" },
  { value: "-1", label: "-1" },
  { value: "0", label: "0 (Padrão)" },
  { value: "1", label: "+1" },
  { value: "2", label: "+2" },
  { value: "3", label: "+3" },
]

const STEP_LABELS: Record<Step, string> = {
  1: "Filmes",
  2: "Revisão",
  3: "Termos",
}

/* ============================================================================
   UTILITIES
   ============================================================================ */

function normalizeCategory(category: string): string {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["development", "revelacao", "revelacao_filme"].includes(normalized)) return "development"
  if (["scanning", "digitalizacao", "digitalizacao_filme"].includes(normalized)) return "scanning"
  if (["printing", "impressao"].includes(normalized)) return "printing"
  if (["prazo", "deadline"].includes(normalized)) return "prazo"
  return normalized
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function findService(services: Service[], id: string): Service | undefined {
  return services.find((s) => String(s.id) === String(id))
}

function getFilmServices(services: Service[], film: FilmEntry): Service[] {
  return film.serviceIds
    .map((id) => findService(services, id))
    .filter((s): s is Service => s !== undefined)
}

function getFilmDisplayName(film: FilmEntry, services: Service[]): string {
  if (film.name?.trim()) {
    return film.name.trim()
  }

  const selectedServices = services.filter((s) =>
    film.serviceIds.includes(String(s.id))
  )

  const development = selectedServices.find(
    (s) => normalizeCategory(s.category) === "development"
  )

  return development?.name ?? "Filme"
}

function isAlreadyDeveloped(services: Service[], film: FilmEntry): boolean {
  return film.serviceIds.some((id) => {
    const service = findService(services, id)
    return service?.ui_id === "s_rev"
  })
}

function createEmptyFilm(): FilmEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    serviceIds: [],
    fileFormat: null,
    pushPull: 0,
    observation: "",
  }
}

/* ============================================================================
   VALIDATION
   ============================================================================ */

function validateFilm(film: FilmEntry, services: Service[]): boolean {
  const selectedServices = getFilmServices(services, film)

  const hasReveal = selectedServices.some(
    (s) => normalizeCategory(s.category) === "development"
  )

  const hasScanning = selectedServices.some(
    (s) => normalizeCategory(s.category) === "scanning"
  )

  const hasPrinting = selectedServices.some(
    (s) => normalizeCategory(s.category) === "printing"
  )

  const hasAlreadyDeveloped = selectedServices.some(
    (s) => s.name.toLowerCase().includes("já revelado")
  )

  const hasExpress = selectedServices.some(
    (s) => s.name.toLowerCase().includes("expresso")
  )

  // expresso sozinho = inválido
  if (hasExpress && !hasReveal && !hasAlreadyDeveloped && !hasScanning && !hasPrinting) {
    return false
  }

  // precisa ter revelação OU já revelado
  if (!hasReveal && !hasAlreadyDeveloped) {
    return false
  }

  // já revelado obriga scan
  if (hasAlreadyDeveloped && !hasScanning) {
    return false
  }

  // scan precisa formato
  if (hasScanning && !film.fileFormat) {
    return false
  }

  return true
}

/* ============================================================================
   MAIN COMPONENT
   ============================================================================ */

export function OrderFormClient({ user, services }: OrderFormClientProps) {
  const router = useRouter()
  const [films, setFilms] = useState<FilmEntry[]>([createEmptyFilm()])
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)

  // Memoized service categories
  const developmentServices = useMemo(
    () => services.filter((s) => normalizeCategory(s.category) === "development"),
    [services]
  )
  const scanServices = useMemo(
    () => services.filter((s) => normalizeCategory(s.category) === "scanning"),
    [services]
  )
  const printServices = useMemo(
    () => services.filter((s) => normalizeCategory(s.category) === "printing"),
    [services]
  )
  const prazoServices = useMemo(
    () => services.filter((s) => normalizeCategory(s.category) === "prazo"),
    [services]
  )

  // Validation
  const allFilmsValid = useMemo(
    () => films.every((film) => validateFilm(film, services)),
    [films, services]
  )

  const canContinue = films.length > 0 && allFilmsValid

  // Actions
  const addFilm = useCallback(() => {
    setFilms((prev) => [...prev, createEmptyFilm()])
  }, [])

  const removeFilm = useCallback((id: string) => {
    setFilms((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const updateFilm = useCallback((id: string, updates: Partial<FilmEntry>) => {
    setFilms((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f

        const next = { ...f, ...updates }

        // Se já revelado, resetar push/pull
        if (isAlreadyDeveloped(services, next)) {
          next.pushPull = 0
        }

        return next
      })
    )
  }, [services])

  const toggleService = useCallback((filmId: string, serviceId: string) => {
    setFilms((prev) =>
      prev.map((film) => {
        if (film.id !== filmId) return film

        const service = findService(services, serviceId)
        if (!service) return film

        let newServiceIds = [...film.serviceIds]
        const isSelected = newServiceIds.includes(String(serviceId))

        // Serviços de revelação = radio button (mutuamente exclusivos)
        if (normalizeCategory(service.category) === "development") {
          const developmentIds = services
            .filter((s) => normalizeCategory(s.category) === "development")
            .map((s) => String(s.id))

          newServiceIds = newServiceIds.filter((id) => !developmentIds.includes(String(id)))

          if (!isSelected) {
            newServiceIds.push(String(serviceId))
          }
        } else {
          newServiceIds = isSelected
            ? newServiceIds.filter((id) => String(id) !== String(serviceId))
            : [...newServiceIds, String(serviceId)]
        }

        const next = { ...film, serviceIds: newServiceIds }

        // Se já revelado, resetar push/pull
        if (isAlreadyDeveloped(services, next)) {
          next.pushPull = 0
        }

        return next
      })
    )
  }, [services])

  const calculateTotal = useCallback((): number => {
    return films.reduce((total, film) => {
      const filmServices = getFilmServices(services, film)
      return total + filmServices.reduce((acc, service) => acc + service.price, 0)
    }, 0)
  }, [films, services])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const payload = {
        notes,
        films: films.map(({ id, ...rest }) => ({
          ...rest,
          serviceIds: rest.serviceIds.map(String),
        })),
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const message = json?.error?.message || "Falha ao criar pedido."
        throw new Error(message)
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao criar o pedido.")
    } finally {
      setIsSubmitting(false)
    }
  }, [films, notes, router])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <Link href="/" className="shrink-0">
              <AnimatedLogo className="w-28 sm:w-36 h-auto" />
            </Link>

            <div className="w-full sm:w-auto flex justify-center sm:justify-end">
              <div className="max-w-full scale-[0.92] sm:scale-100 origin-top">
                <GameMenuNav user={user} variant="horizontal" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        <FadeIn>
          <Link
            href={user ? "/dashboard" : "/"}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 font-mono text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {user ? "VOLTAR PARA MEUS PEDIDOS" : "VOLTAR PARA O INICIO"}
          </Link>
        </FadeIn>

        <SlideIn direction="left" delay={0.1}>
          <h1 className="text-3xl font-mono font-bold mb-2">NOVO PEDIDO</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Adicione seus filmes e selecione os respectivos serviços.
          </p>
        </SlideIn>

        {/* Progress indicator */}
        <FadeIn delay={0.2}>
          <div className="flex items-center gap-4 mb-8">
            {([1, 2, 3] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm ${
                    step >= s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s}
                </div>
                <span className="font-mono text-xs uppercase text-muted-foreground hidden md:inline">
                  {STEP_LABELS[s]}
                </span>
                {i < 2 && <div className="w-8 h-px bg-border hidden md:block" />}
              </div>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <StepOne
              key="step1"
              films={films}
              services={services}
              developmentServices={developmentServices}
              scanServices={scanServices}
              printServices={printServices}
              prazoServices={prazoServices}
              notes={notes}
              user={user}
              canContinue={canContinue}
              onUpdateFilm={updateFilm}
              onRemoveFilm={removeFilm}
              onToggleService={toggleService}
              onAddFilm={addFilm}
              onSetNotes={setNotes}
              onContinue={() => setStep(2)}
              total={calculateTotal()}
            />
          )}

          {step === 2 && (
            <StepTwo
              key="step2"
              films={films}
              services={services}
              notes={notes}
              error={error}
              total={calculateTotal()}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepThree
              key="step3"
              error={error}
              isSubmitting={isSubmitting}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

/* ============================================================================
   STEP 1: FILMES
   ============================================================================ */

interface StepOneProps {
  films: FilmEntry[]
  services: Service[]
  developmentServices: Service[]
  scanServices: Service[]
  printServices: Service[]
  prazoServices: Service[]
  notes: string
  user: User | null
  canContinue: boolean
  total: number
  onUpdateFilm: (id: string, updates: Partial<FilmEntry>) => void
  onRemoveFilm: (id: string) => void
  onToggleService: (filmId: string, serviceId: string) => void
  onAddFilm: () => void
  onSetNotes: (notes: string) => void
  onContinue: () => void
}

function StepOne({
  films,
  services,
  developmentServices,
  scanServices,
  printServices,
  prazoServices,
  notes,
  user,
  canContinue,
  total,
  onUpdateFilm,
  onRemoveFilm,
  onToggleService,
  onAddFilm,
  onSetNotes,
  onContinue,
}: StepOneProps) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div>
          <div className="space-y-6 mb-8">
            {films.map((film, index) => (
              <FilmEntryCard
                key={film.id}
                film={film}
                index={index}
                services={services}
                developmentServices={developmentServices}
                prazoServices={prazoServices}
                scanServices={scanServices}
                printServices={printServices}
                onUpdate={(updates) => onUpdateFilm(film.id, updates)}
                onRemove={() => onRemoveFilm(film.id)}
                onToggleService={(serviceId) => onToggleService(film.id, serviceId)}
                canRemove={films.length > 1}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={onAddFilm}
            className="w-full font-mono uppercase mb-8 bg-transparent"
          >
            <Plus className="h-4 w-4 mr-2" />
            ADICIONAR MAIS FILMES
          </Button>

          {/* Notes */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-mono text-lg">OBSERVAÇÃO DOS PEDIDOS</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Alguma instrução ou preferência adicional..."
                value={notes}
                maxLength={MAX_FILM_OBSERVATION_LENGTH}
                onChange={(e) => onSetNotes(e.target.value)}
                className="break-all whitespace-pre-wrap font-mono bg-input border-border"
              />
              <div className="mt-2 flex justify-end text-[11px] font-mono text-muted-foreground">
                <span className={notes.length >= MAX_FILM_OBSERVATION_LENGTH ? "text-primary" : ""}>
                  {notes.length}/{MAX_FILM_OBSERVATION_LENGTH}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT (SIDEBAR) */}
        <div className="lg:sticky lg:top-24 h-fit">
          <OrderSidebar
            step={1}
            films={films}
            services={services}
            total={total}
            notes={notes}
            user={user}
            canContinue={canContinue}
            onContinue={onContinue}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   STEP 2: REVISÃO
   ============================================================================ */

interface StepTwoProps {
  films: FilmEntry[]
  services: Service[]
  notes: string
  error: string | null
  total: number
  onBack: () => void
  onContinue: () => void
}

function StepTwo({ films, services, notes, error, total, onBack, onContinue }: StepTwoProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">REVISÃO</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {films.map((film) => {
                const filmLabel = getFilmDisplayName(film, services)
                const filmServices = getFilmServices(services, film)
                const filmTotal = filmServices.reduce((acc, service) => acc + service.price, 0)

                return (
                  <div key={film.id} className="border-b border-border pb-4 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        {film.name && (
                          <p className="font-mono font-bold text-primary">{film.name}</p>
                        )}
                        <p className="font-mono font-bold">
                          {filmServices.map((s) => s.name).join(", ")}
                        </p>
                      </div>
                      <p className="font-mono font-bold">{formatCurrency(filmTotal)}</p>
                    </div>

                    <div className="text-sm text-muted-foreground font-mono">
                      {filmServices.map((s) => s.name).join(", ")}
                    </div>

                    <div className="mt-3 space-y-2">
                      {filmServices.map((service) => (
                        <div
                          key={`${film.id}-${service.id}`}
                          className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-3 py-2"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {service.name}
                          </span>
                          <span className="font-mono text-xs font-bold">
                            {formatCurrency(service.price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {film.observation && (
                      <div className="mt-1 break-all text-xs italic text-muted-foreground font-mono">
                        Obs: {film.observation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 border-t border-border pt-4 flex items-center justify-between">
              <span className="font-mono text-sm">TOTAL DO PEDIDO</span>
              <span className="font-mono text-xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 border border-destructive bg-destructive/10 text-destructive font-mono text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onBack}
            className="font-mono uppercase h-12 bg-transparent"
          >
            VOLTAR
          </Button>
          <Button onClick={onContinue} className="font-mono uppercase h-12">
            IR PARA TERMOS
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   STEP 3: TERMOS
   ============================================================================ */

interface StepThreeProps {
  error: string | null
  isSubmitting: boolean
  onBack: () => void
  onSubmit: () => void
}

function StepThree({ error, isSubmitting, onBack, onSubmit }: StepThreeProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">TERMOS DE SERVIÇO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TermsSection title="Envio">
              <TermsItem number={1} title="Envio e responsabilidade do cliente">
                O cliente é responsável por enviar o filme{" "}
                <strong className="text-red-600 font-semibold">
                  em bom estado e devidamente identificado,
                </strong>{" "}
                para que a revelação possa ser realizada corretamente. Os custos de embalagem e
                envio são de inteira responsabilidade do cliente.
              </TermsItem>

              <TermsItem number={2} title="Extravio antes da entrega ao laboratório">
                O laboratório
                <strong className="text-red-600 font-semibold">
                  {" "}não se responsabiliza por perdas, extravios ou danos ocorridos antes da
                  entrega do filme em nossas instalações.
                </strong>{" "}
                A responsabilidade é do cliente e/ou da transportadora ou prestador de serviço
                contratado para o envio.
              </TermsItem>

              <TermsItem number={3} title="Identificação e inspeção dos filmes recebidos">
                Todo filme recebido passa por um processo de inspeção e identificação. Caso não seja
                possível identificar o remetente, o material será mantido em
                <strong className="text-red-600 font-semibold">
                  {" "}isolamento por até 30 dias a partir da data de recebimento.
                </strong>{" "}
                Após esse período, sem identificação ou contato do responsável, o filme será
                descartado.
              </TermsItem>
            </TermsSection>

            <TermsSection title="Pagamento e Estorno">
              <TermsItem number={5} title="Conferência do pedido e ajustes de cobrança">
                Todos os pedidos passam por uma etapa de conferência antes da cobrança, com o
                objetivo de{" "}
                <strong className="text-red-600 font-semibold">
                  corrigir possíveis erros de preenchimento no pedido inicial e reduzir falhas
                  humanas no processo.
                </strong>
                <p className="mt-3">
                  Caso algum serviço não possa ser realizado por motivos técnicos ou de força maior,
                  os valores serão ajustados durante a conferência do pedido, antes do envio do
                  link de pagamento.
                </p>
                <p className="mt-3">
                  Em casos de
                  <strong className="text-red-600 font-semibold">
                    {" "}filme sem exposição (&quot;filme virgem&quot;) ou filme exposto a luz
                    (&quot;filme velado&quot;),
                  </strong>{" "}
                  a revelação química do filme ainda será realizada e
                  <strong className="text-red-600 font-semibold">
                    {" "}será cobrada normalmente,
                  </strong>{" "}
                  pois o processo laboratorial foi executado. No entanto,
                  <strong className="text-red-600 font-semibold">
                    {" "}a digitalização não será cobrada,
                  </strong>{" "}
                  uma vez que não há imagens disponíveis para captura.
                </p>
              </TermsItem>

              <TermsItem number={6} title="Pagamento">
                <strong className="text-red-600 font-semibold">
                  O pagamento é realizado somente após a inspeção dos filmes contidos no pedido.
                </strong>{" "}
                Após a conferência, um link de pagamento será gerado e enviado por e-mail.
                <p className="mt-3">
                  <strong className="text-red-600 font-semibold">
                    No momento, aceitamos apenas pagamentos via Pix.
                  </strong>
                </p>
              </TermsItem>

              <TermsItem number={7} title="Prazo expresso e estorno">
                Caso o
                <strong className="text-red-600 font-semibold">
                  {" "}prazo expresso contratado não possa ser cumprido, independentemente do motivo,
                </strong>{" "}
                o valor referente ao serviço expresso será estornado.
                <p className="mt-3">
                  O valor poderá ser{" "}
                  <strong className="text-red-600 font-semibold">
                    utilizado como crédito em serviços futuros ou devolvido via Pix,
                  </strong>{" "}
                  conforme preferência do cliente.
                </p>
              </TermsItem>
            </TermsSection>

            <TermsSection title="Devolução">
              <TermsItem number={8} title="Devolução dos negativos">
                A devolução dos negativos é realizada via Correios, e os custos de envio são{" "}
                <strong className="text-red-600 font-semibold">
                  calculados e cobrados separadamente.
                </strong>
              </TermsItem>

              <TermsItem number={9} title="Disponibilidade e acesso aos arquivos digitais">
                Os arquivos digitais disponibilizados pelo nosso sistema possuem um
                <strong className="text-red-600 font-semibold">
                  {" "}prazo mínimo de disponibilidade de 90 dias.
                </strong>{" "}
                Durante esse período,{" "}
                <strong className="text-red-600 font-semibold">
                  garantimos o acesso aos arquivos e, se necessário, o reenvio
                  (&quot;re-upload&quot;) sem custos adicionais.
                </strong>
                <p className="mt-3">
                  O{" "}
                  <strong className="text-red-600 font-semibold">
                    link de acesso e a segurança de seu compartilhamento são de responsabilidade do
                    cliente.
                  </strong>{" "}
                  Caso o link seja compartilhado indevidamente ou comprometido, o cliente deve entrar
                  em contato conosco para que seja realizada a troca do link de acesso.
                </p>
                <p className="mt-3">
                  <strong className="text-red-600 font-semibold">
                    Não compartilhamos seus arquivos ou link com terceiros.
                  </strong>{" "}
                  Apenas um número reduzido de técnicos autorizados possui acesso temporário aos
                  arquivos, exclusivamente para uma rápida conferência técnica e validação da
                  entrega.
                </p>
              </TermsItem>
            </TermsSection>
          </CardContent>
        </Card>

        {error && (
          <div className="p-4 border border-destructive bg-destructive/10 text-destructive font-mono text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onBack}
            className="font-mono uppercase h-12 bg-transparent"
          >
            RECUSO
          </Button>
          <Button
            onClick={onSubmit}
            className="font-mono uppercase h-12"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACEITO"}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   TERMS HELPERS
   ============================================================================ */

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-2xl font-bold mb-5">{title}</h3>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

function TermsItem({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="text-xl font-semibold mb-2">
        <span className="text-red-600">{number}. </span>
        {title}
      </h4>
      <div className="text-base leading-relaxed">{children}</div>
    </div>
  )
}

/* ============================================================================
   ORDER SIDEBAR
   ============================================================================ */

interface OrderSidebarProps {
  step: Step
  films: FilmEntry[]
  services: Service[]
  total: number
  notes: string
  user: User | null
  isSubmitting?: boolean
  canContinue?: boolean
  onContinue?: () => void
  onBack?: () => void
  onSubmit?: () => void
}

function OrderSidebar({
  step,
  films,
  services,
  total,
  notes,
  isSubmitting = false,
  canContinue = false,
  onContinue,
  onBack,
  onSubmit,
}: OrderSidebarProps) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="font-mono text-lg">RESUMO DO PEDIDO</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>
            {films.length} filme{films.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="space-y-3">
          {films.map((film, idx) => {
            const filmLabel = getFilmDisplayName(film, services)
            const filmServices = getFilmServices(services, film)
            const filmTotal = filmServices.reduce((acc, s) => acc + (s?.price || 0), 0)

            return (
              <div key={film.id} className="border border-border rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">
                      FILME {idx + 1}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{filmLabel}</p>
                    {filmServices.length > 0 && (
                      <p className="font-mono text-xs text-muted-foreground mt-1 line-clamp-2">
                        {filmServices.map((s) => s.name).join(", ")}
                      </p>
                    )}
                  </div>

                  <span className="font-mono text-sm font-bold whitespace-nowrap">
                    {formatCurrency(filmTotal)}
                  </span>
                </div>

                {step !== 1 && filmServices.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {filmServices.map((service) => (
                      <div
                        key={`${film.id}-${service.id}`}
                        className="flex items-center justify-between text-xs font-mono text-muted-foreground"
                      >
                        <span>{service.name}</span>
                        <span>{formatCurrency(service.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="font-mono text-sm">TOTAL</span>
            <span className="font-mono text-xl font-bold text-primary">
              {formatCurrency(total)}
            </span>
          </div>
        ) : (
          <div className="border-t border-border pt-4 space-y-2">
            {films.map((film) => {
              const filmLabel = getFilmDisplayName(film, services)
              const filmTotal = getFilmServices(services, film).reduce(
                (acc, service) => acc + service.price,
                0
              )

              return (
                <div
                  key={`summary-${film.id}`}
                  className="flex items-center justify-between text-xs font-mono text-muted-foreground"
                >
                  <span className="truncate pr-4">{filmLabel}</span>
                  <span>{formatCurrency(filmTotal)}</span>
                </div>
              )
            })}

            <div className="pt-2 flex items-center justify-between">
              <span className="font-mono text-sm">TOTAL</span>
              <span className="font-mono text-xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}

        {step !== 1 && notes && (
          <div className="p-3 bg-muted/50 rounded">
            <p className="font-mono text-xs uppercase text-muted-foreground mb-1">Observacoes</p>
            <p className="break-all whitespace-pre-wrap font-mono text-sm">{notes}</p>
          </div>
        )}

        {step === 1 ? (
          <>
            <Button
              onClick={onContinue}
              className="w-full font-mono uppercase h-12"
              disabled={!canContinue}
            >
              CONTINUAR PARA REVISÃO
            </Button>

            {!canContinue && (
              <p className="text-xs text-muted-foreground font-mono">
                Selecione pelo menos um serviço para continuar.
              </p>
            )}
          </>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1 font-mono uppercase h-12 bg-transparent"
            >
              {step === 2 ? "VOLTAR" : "RECUSO"}
            </Button>
            <Button
              onClick={step === 2 ? onContinue : onSubmit}
              className="flex-1 font-mono uppercase h-12"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === 2 ? (
                "IR PARA TERMOS"
              ) : (
                "ACEITO"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ============================================================================
   FILM ENTRY CARD
   ============================================================================ */

interface FilmEntryCardProps {
  film: FilmEntry
  index: number
  services: Service[]
  developmentServices: Service[]
  prazoServices: Service[]
  scanServices: Service[]
  printServices: Service[]
  onUpdate: (updates: Partial<FilmEntry>) => void
  onRemove: () => void
  onToggleService: (serviceId: string) => void
  canRemove: boolean
}

function FilmEntryCard({
  film,
  index,
  services,
  developmentServices,
  prazoServices,
  scanServices,
  printServices,
  onUpdate,
  onRemove,
  onToggleService,
  canRemove,
}: FilmEntryCardProps) {
  const idRevelarDoBanco = services.find(s => 
    s.name.toLowerCase() === "revelar"
  )?.id;

  // Descobre o ID real do banco para o serviço "Já Revelado" pelo nome
  const idJaReveladoDoBanco = services.find(s => 
    s.name.toLowerCase().includes("já revelado")
  )?.id;
  const selectedServices = getFilmServices(services, film)
  const filmIsAlreadyDeveloped = isAlreadyDeveloped(services, film)
  const hasScanningSelected = selectedServices.some(
    (s) => normalizeCategory(s.category) === "scanning"
  )

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <Film className="h-5 w-5 text-primary" />
              FILME {index + 1}
            </CardTitle>
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground hover:text-destructive bg-transparent"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Nome do Filme */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-mono text-xs uppercase">Nome do Filme</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                    Este nome será usado para criar a pasta com os arquivos digitalizados. Ex:
                    &quot;Viagem SP 2024&quot;, &quot;Aniversário Maria&quot;
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                placeholder="Ex: Viagem SP 2024"
                value={film.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="font-mono bg-input"
              />
            </div>

            {/* Observação */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-mono text-xs uppercase">Observação</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                    Caso precise de informação complementar use esse campo.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                placeholder="Instruções especiais para este filme..."
                value={film.observation}
                maxLength={MAX_FILM_OBSERVATION_LENGTH}
                onChange={(e) => onUpdate({ observation: e.target.value })}
                className="min-h-[60px] break-all whitespace-pre-wrap font-mono bg-input border-border"
              />
              <div className="flex justify-end text-[11px] font-mono text-muted-foreground">
                <span
                  className={
                    film.observation.length >= MAX_FILM_OBSERVATION_LENGTH ? "text-primary" : ""
                  }
                >
                  {film.observation.length}/{MAX_FILM_OBSERVATION_LENGTH}
                </span>
              </div>
            </div>

            {/* Seleção de Serviços Dinâmicos */}
            <div className="space-y-4">
              
              {/* CATEGORIA: REVELAÇÃO */}
              <div className="space-y-3">
                <ServiceCategory
                  title="Revelação"
                  services={developmentServices}
                  selectedIds={film.serviceIds}
                  onToggle={onToggleService}
                />
                
                {/* O PUSH/PULL SÓ APARECE SE "REV" ESTIVER SELECIONADO E "S_REV" NÃO */}
                <AnimatePresence>
                  {idRevelarDoBanco && film.serviceIds.includes(idRevelarDoBanco) && (!idJaReveladoDoBanco || !film.serviceIds.includes(idJaReveladoDoBanco)) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="space-y-2 overflow-hidden border-l-2 border-primary/30 pl-3 ml-1"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Ajuste de Puxada (Push/Pull)</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                            Se expôs o rolo num ISO diferente do rótulo, indique aqui a puxada a aplicar no químico.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select
                        value={film.pushPull.toString()}
                        onValueChange={(value) => onUpdate({ pushPull: parseInt(value) })}
                      >
                        <SelectTrigger className="font-mono bg-input w-full md:max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-3" className="font-mono">-3</SelectItem>
                          <SelectItem value="-2" className="font-mono">-2</SelectItem>
                          <SelectItem value="-1" className="font-mono">-1</SelectItem>
                          <SelectItem value="0" className="font-mono">0 </SelectItem>
                          <SelectItem value="1" className="font-mono">+1</SelectItem>
                          <SelectItem value="2" className="font-mono">+2</SelectItem>
                          <SelectItem value="3" className="font-mono">+3</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* CATEGORIA: DIGITALIZAÇÃO */}
              <div className="space-y-3">
                <ServiceCategory
                  title="Digitalização"
                  services={scanServices}
                  selectedIds={film.serviceIds}
                  onToggle={onToggleService}
                />

                {/* OS ARQUIVOS SÓ APARECEM SE SELECIONOU DIGITALIZAÇÃO */}
                <AnimatePresence>
                  {hasScanningSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="space-y-2 overflow-hidden border-l-2 border-primary/30 pl-3 ml-1"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Formato dos Arquivos Digitais</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                            JPG: pronto para redes sociais. DNG: ideal para edição. RAW: ficheiro bruto do scanner.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select 
                        value={film.fileFormat ?? ""}
                        onValueChange={(value: "dng" | "jpg" | "raw") => onUpdate({ fileFormat: value })}
                      >
                        <SelectTrigger className="font-mono bg-input w-full md:max-w-xs">
                          <SelectValue placeholder="Escolha o formato dos arquivos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jpg" className="font-mono">JPG</SelectItem>
                          <SelectItem value="dng" className="font-mono">DNG</SelectItem>
                          <SelectItem value="raw" className="font-mono">RAW</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>              
              
              {/* CATEGORIA: PRAZO */}
              <ServiceCategory
                title="Prazo"
                services={prazoServices}
                selectedIds={film.serviceIds}
                onToggle={onToggleService}
              />

              {/* CATEGORIA: IMPRESSÃO */}
              <ServiceCategory
                title="Impressão"
                services={printServices}
                selectedIds={film.serviceIds}
                onToggle={onToggleService}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  )
}

/* ============================================================================
   SERVICE CATEGORY
   ============================================================================ */

interface ServiceCategoryProps {
  title: string
  services: Service[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

function ServiceCategory({ title, services, selectedIds, onToggle }: ServiceCategoryProps) {
  if (services.length === 0) return null

  return (
    <div>
      <Label className="font-mono text-xs uppercase text-muted-foreground mb-2 block">
        {title}
      </Label>

      <div className="grid gap-2">
        {services.map((service) => {
          const id = String(service.id)
          const checked = selectedIds.includes(id)

          return (
            <TooltipProvider key={id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center justify-between min-w-0 p-3 border rounded cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => onToggle(id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="font-mono text-sm truncate">{service.name}</span>
                      {service.description && (
                        <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    <span className="font-mono font-bold shrink-0">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </TooltipTrigger>

                {service.description && (
                  <TooltipContent className="bg-card border-primary max-w-xs">
                    <p className="font-mono text-white text-xs">{service.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </div>
  )
}
