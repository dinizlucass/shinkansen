"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
// DB writes now happen through our backend (Route Handler) in /app/api
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
  Camera,
  Film
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { MAX_FILM_OBSERVATION_LENGTH } from "@/lib/validators/orders"

interface Service {
  id: string
  name: string
  description: string
  price: number
  category: string
}

type DevelopmentType = "ja_revelado" | "c41" | "d76" | "ecn2"
type ScanType = "normal" | "com_trilhas" | "normal_e_com_trilhas" | "so_revelar"

interface FilmEntry {
  id: string
  name: string
  filmType: DevelopmentType
  serviceIds: string[]
  fileFormat: "tiff" | "jpg" | "raw"
  scanType: ScanType
  pushPull: number
  observation: string
}

interface OrderFormClientProps {
  user: User | null
  services: Service[]
}

function normalizeCategory(category: string) {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["development", "revelacao", "revelacao_filme"].includes(normalized)) return "development"
  if (["scanning", "digitalizacao", "digitalizacao_filme"].includes(normalized)) return "scanning"
  if (["printing", "impressao"].includes(normalized)) return "printing"
  return normalized
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

const filmTypes = [
  { value: "ja_revelado", label: "Já Revelado" },
  { value: "c41", label: "C-41" },
  { value: "d76", label: "D-76" },
  { value: "ecn2", label: "ECN-2" },
]

export function OrderFormClient({ user, services }: OrderFormClientProps) {
  const router = useRouter()
  const [films, setFilms] = useState<FilmEntry[]>([
    { 
      id: crypto.randomUUID(), 
      name: "",
      filmType: "c41",
      serviceIds: [],
      fileFormat: "jpg",
      scanType: "normal",
      pushPull: 0,
      observation: ""
    }
  ])
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const hasAnyServiceSelected = films.some((f) => f.serviceIds.length > 0)
  const canContinue = hasAnyServiceSelected

  const addFilm = () => {
  setFilms((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      name: "",
      filmType: "c41",
      serviceIds: [],
      fileFormat: "jpg",
      scanType: "normal",
      pushPull: 0,
      observation: "",
    },
  ])
}

  const removeFilm = (id: string) => {
    if (films.length > 1) {
      setFilms(films.filter(f => f.id !== id))
    }
  }

  const normalizeFilm = (film: FilmEntry): FilmEntry => {
    let next = { ...film }

    // Regra: "Só Revelar" não pode coexistir com "Já Revelado"
    if (next.filmType === "ja_revelado" && next.scanType === "so_revelar") {
      next.scanType = "normal"
    }

    // Se já veio revelado: não tem puxada nem serviços de revelação
    if (next.filmType === "ja_revelado") {
      next.pushPull = 0
      next.serviceIds = next.serviceIds.filter((id) => {
        const s = services.find((x) => x.id === id)
        return normalizeCategory(s?.category ?? "") !== "development"
      })
    }

    // Se for "Só Revelar": não faz sentido selecionar serviços de digitalização
    if (next.scanType === "so_revelar") {
      next.serviceIds = next.serviceIds.filter((id) => {
        const s = services.find((x) => x.id === id)
        return normalizeCategory(s?.category ?? "") !== "scanning"
      })
    }

    return next
  }

  const updateFilm = (id: string, updates: Partial<FilmEntry>) => {
    setFilms((prev) =>
      prev.map((f) => (f.id === id ? normalizeFilm({ ...f, ...updates }) : f))
    )
  }

  const toggleService = (filmId: string, serviceId: string) => {
    const film = films.find((f) => f.id === filmId)
    if (!film) return

    const service = services.find((s) => String(s.id) === serviceId)
    if (!service) return

    // Travas do escopo:
    // - Se "Já Revelado", não deixa selecionar serviços de revelação (development)
    if (normalizeCategory(service.category) === "development" && film.filmType === "ja_revelado") return

    // - Se "Só Revelar", não deixa selecionar serviços de digitalização (scanning)
    if (normalizeCategory(service.category) === "scanning" && film.scanType === "so_revelar") return

    const newServiceIds = film.serviceIds.includes(serviceId)
      ? film.serviceIds.filter((id) => id !== serviceId)
      : [...film.serviceIds, serviceId]

    updateFilm(filmId, { serviceIds: newServiceIds })
  }
  
  const findService = (id: string) => services.find((s) => String(s.id) === String(id))
  const getFilmServices = (film: FilmEntry) =>
    film.serviceIds
      .map((id) => findService(id))
      .filter(Boolean) as Service[]

  const getFilmTotal = (film: FilmEntry) =>
    getFilmServices(film).reduce((acc, service) => acc + service.price, 0)

  const calculateTotal = () => {
    return films.reduce((total, film) => {
      const filmTotal = getFilmTotal(film)
      return total + filmTotal
    }, 0)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const payload = {
        notes,
        films: films.map(({ id, ...rest }) => ({
          ...rest,
          // keep IDs consistently string
          serviceIds: rest.serviceIds.map(String),
        })),
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        const message = json?.error?.message || 'Falha ao criar pedido.'
        throw new Error(message)
      }

      // Redirect to success or dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao criar o pedido.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const developmentServices = services.filter((s) => normalizeCategory(s.category) === "development")
  const scanServices = services.filter((s) => normalizeCategory(s.category) === "scanning")
  const printServices = services.filter((s) => normalizeCategory(s.category) === "printing")

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <Link href="/" className="shrink-0">
              <AnimatedLogo className="w-28 sm:w-36 h-auto" />
            </Link>

            {/* Menu: continua em linha, só vai pra "segunda linha" no mobile */}
            <div className="w-full sm:w-auto flex justify-center sm:justify-end">
              {/* leve compressão no mobile pra caber sem scroll lateral */}
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
            Adicione seus filmes e selecione os respectivos servicos.
          </p>
        </SlideIn>

        {/* Progress indicator */}
        <FadeIn delay={0.2}>
          <div className="flex items-center gap-4 mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-sm ${
                  step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {s}
                </div>
                <span className="font-mono text-xs uppercase text-muted-foreground hidden md:inline">
                  {s === 1 ? "Filmes" : s === 2 ? "Revisão" : "Termos"}
                </span>
                {s < 3 && <div className="w-8 h-px bg-border hidden md:block" />}
              </div>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait">
            {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
                {/* LEFT */}
                <div>
                  {/* Film entries */}
                  <div className="space-y-6 mb-8">
                    {films.map((film, index) => (
                      <FilmEntryCard
                        key={film.id}
                        film={film}
                        index={index}
                        services={services}
                        developmentServices={developmentServices}
                        scanServices={scanServices}
                        printServices={printServices}
                        onUpdate={(updates) => updateFilm(film.id, updates)}
                        onRemove={() => removeFilm(film.id)}
                        onToggleService={(serviceId) => toggleService(film.id, serviceId)}
                        canRemove={films.length > 1}
                      />
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    onClick={addFilm}
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
                        onChange={(e) => setNotes(e.target.value)}
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
                    total={calculateTotal()}
                    notes={notes}
                    user={user}
                    continueDisabled={!canContinue}
                    onContinue={() => setStep(2)}
                  />
                </div>
              </div>
            </motion.div>
          )}


          {step === 2 && (
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
                          const filmType = filmTypes.find((t) => t.value === film.filmType)
                          const filmServices = getFilmServices(film)
                          const filmTotal = getFilmTotal(film)

                          return (
                            <div key={film.id} className="border-b border-border pb-4 last:border-0">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  {film.name && (
                                    <p className="font-mono font-bold text-primary">{film.name}</p>
                                  )}
                                  <p className="font-mono font-bold">{filmType?.label}</p>
                                </div>
                                <p className="font-mono font-bold">{formatCurrency(filmTotal)}</p>
                              </div>

                              <div className="text-sm text-muted-foreground font-mono">
                                {filmServices.map((s) => s?.name).join(", ")}
                              </div>

                              <div className="mt-3 space-y-2">
                                {filmServices.map((service) => (
                                  <div
                                    key={`${film.id}-${service?.id}`}
                                    className="flex items-center justify-between rounded border border-border/60 bg-muted/20 px-3 py-2"
                                  >
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {service?.name}
                                    </span>
                                    <span className="font-mono text-xs font-bold">
                                      {formatCurrency(service?.price || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <div className="text-xs text-muted-foreground font-mono mt-1 flex flex-wrap gap-2">
                                {film.scanType !== "so_revelar" && (
                                  <span className="bg-muted px-2 py-0.5 rounded">
                                    {film.fileFormat.toUpperCase()}
                                  </span>
                                )}

                                <span className="bg-muted px-2 py-0.5 rounded">
                                  {film.scanType === "normal"
                                    ? "Normal"
                                    : film.scanType === "com_trilhas"
                                      ? "C/ Trilhas"
                                      : film.scanType === "normal_e_com_trilhas"
                                        ? "Normal + C/ Trilhas"
                                        : "Só Revelar"}
                                </span>

                                {film.filmType !== "ja_revelado" && film.pushPull !== 0 && (
                                  <span className="bg-muted px-2 py-0.5 rounded">
                                    Puxada: {film.pushPull > 0 ? `+${film.pushPull}` : film.pushPull}
                                  </span>
                                )}
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
                          {formatCurrency(calculateTotal())}
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
                      onClick={() => setStep(1)}
                      className="font-mono uppercase h-12 bg-transparent"
                    >
                      VOLTAR
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      className="font-mono uppercase h-12"
                    >
                      IR PARA TERMOS
                    </Button>
                  </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-mono text-lg">TERMOS DO PEDIDO</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="rounded border border-border bg-muted/20 p-4 font-mono text-sm text-muted-foreground space-y-4">
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        </p>
                        <p>
                          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                        </p>
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Integer feugiat scelerisque varius morbi enim nunc faucibus a pellentesque sit.
                        </p>
                      </div>

                      <div className="rounded border border-primary/30 bg-primary/5 p-4">
                        <p className="font-mono text-sm">
                          Ao clicar em <span className="font-bold text-primary">ACEITO</span>, voce confirma que leu e concorda com os termos acima para seguir com a criacao do pedido.
                        </p>
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
                      onClick={() => setStep(2)}
                      className="font-mono uppercase h-12 bg-transparent"
                    >
                      RECUSO
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="font-mono uppercase h-12"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "ACEITO"
                      )}
                    </Button>
                  </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}

function OrderSidebar({
  step,
  films,
  services,
  total,
  notes,
  user,
  isSubmitting = false,
  continueDisabled = false,
  onContinue,
  onBack,
  onSubmit,
}: {
  step: 1 | 2 | 3
  films: FilmEntry[]
  services: Service[]
  total: number
  notes: string
  user: User | null
  isSubmitting?: boolean
  continueDisabled?: boolean
  onContinue?: () => void
  onBack?: () => void
  onSubmit?: () => void
}) {
  const getSidebarFilmServices = (film: FilmEntry) =>
    film.serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter(Boolean) as Service[]

  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="font-mono text-lg">RESUMO DO PEDIDO</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{films.length} filme{films.length > 1 ? "s" : ""}</span>
        </div>

        {(step === 1 || step === 2 || step === 3) && (
          <div className="space-y-3">
            {films.map((film, idx) => {
              const filmTypeLabel = filmTypes.find((t) => t.value === film.filmType)?.label ?? film.filmType
              const filmServices = getSidebarFilmServices(film)

              const filmTotal = filmServices.reduce((acc, s) => acc + (s?.price || 0), 0)

              return (
                <div key={film.id} className="border border-border rounded p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">
                        FILME {idx + 1}
                      </p>
                      <p className="font-mono text-sm font-bold truncate">
                        {film.name || filmTypeLabel}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {filmTypeLabel}
                      </p>

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
        )}

        {step === 1 ? (
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="font-mono text-sm">TOTAL</span>
            <span className="font-mono text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        ) : (
          <div className="border-t border-border pt-4 space-y-2">
            {films.map((film) => {
              const filmLabel = film.name || filmTypes.find((t) => t.value === film.filmType)?.label || "Filme"
              const filmTotal = getSidebarFilmServices(film).reduce((acc, service) => acc + service.price, 0)

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
              <span className="font-mono text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        {(step === 2 || step === 3) && notes && (
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
              disabled={continueDisabled}
            >
              CONTINUAR PARA REVISÃO
            </Button>

            {continueDisabled && (
              <p className="text-xs text-muted-foreground font-mono">
                Selecione pelo menos um servico para continuar.
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
              ) : (
                step === 2 ? "IR PARA TERMOS" : "ACEITO"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FilmEntryCard({
  film,
  index,
  services,
  developmentServices,
  scanServices,
  printServices,
  onUpdate,
  onRemove,
  onToggleService,
  canRemove,
}: {
  film: FilmEntry
  index: number
  services: Service[]
  developmentServices: Service[]
  scanServices: Service[]
  printServices: Service[]
  onUpdate: (updates: Partial<FilmEntry>) => void
  onRemove: () => void
  onToggleService: (serviceId: string) => void
  canRemove: boolean
}) {
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
            {/* Film name */}
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
                    Este nome sera usado para criar a pasta com os arquivos digitalizados. 
                    Ex: "Viagem SP 2024", "Aniversario Maria"
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

             {/* Revelação */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-mono text-xs uppercase">Revelação</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                    Processo químico de revelação. Não inclui impressão de fotos.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={film.filmType}
                onValueChange={(value) => {
                  const next = value as FilmEntry["filmType"]
                  onUpdate({
                    filmType: next,
                    ...(next === "ja_revelado"
                      ? {
                          pushPull: 0,
                          scanType: film.scanType === "so_revelar" ? "normal" : film.scanType,
                        }
                      : {}),
                  })
                }}
              >
                <SelectTrigger className="font-mono bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filmTypes.map((type) => (
                    <SelectItem
                      key={type.value}
                      value={type.value}
                      className="font-mono"
                      disabled={film.scanType === "so_revelar" && type.value === "ja_revelado"}
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* New film options */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_0.8fr] gap-y-4 gap-x-0">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-mono text-xs uppercase">Arquivos</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                      JPG: pronto pra redes. TIFF: melhor pra edição. RAW: arquivo mais bruto.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={film.fileFormat}
                  onValueChange={(value: "tiff" | "jpg" | "raw") => onUpdate({ fileFormat: value })}
                  disabled={film.scanType === "so_revelar"}
                >
                   <SelectTrigger className="font-mono bg-input w-full min-w-0" disabled={film.scanType === "so_revelar"}>
                   <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpg" className="font-mono">JPG</SelectItem>
                    <SelectItem value="tiff" className="font-mono">TIFF</SelectItem>
                    <SelectItem value="raw" className="font-mono">RAW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-mono text-xs uppercase">Digitalização</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                      Filmes 120 só podem ser digitalizados com as trilhas.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={film.scanType}
                  onValueChange={(value) => onUpdate({ scanType: value as FilmEntry["scanType"] })}
                >
                  <SelectTrigger className="font-mono bg-input w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal" className="font-mono">Normal</SelectItem>
                    <SelectItem value="com_trilhas" className="font-mono">C/ Trilhas</SelectItem>
                    <SelectItem value="normal_e_com_trilhas" className="font-mono">Normal + C/ Trilhas</SelectItem>
                    <SelectItem value="so_revelar" className="font-mono" disabled={film.filmType === "ja_revelado"}>
                      Só Revelar
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="font-mono text-xs uppercase">Puxada</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0 bg-transparent">
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                      Se você expôs em ISO diferente do rótulo, ajuste aqui a puxada aplicada.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={film.pushPull.toString()}
                  onValueChange={(value) => onUpdate({ pushPull: parseInt(value) })}
                  disabled={film.filmType === "ja_revelado"}
                >
                  <SelectTrigger className="font-mono bg-input w-full min-w-0" disabled={film.filmType === "ja_revelado"}>
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
              </div>
            </div>

            {/* Observation field */}
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
                <span className={film.observation.length >= MAX_FILM_OBSERVATION_LENGTH ? "text-primary" : ""}>
                  {film.observation.length}/{MAX_FILM_OBSERVATION_LENGTH}
                </span>
              </div>
            </div>

            {/* Services selection */}
            <div className="space-y-4">
              {film.filmType !== "ja_revelado" && (
                <ServiceCategory
                  title="Revelação"
                  services={developmentServices}
                  selectedIds={film.serviceIds}
                  onToggle={onToggleService}
                />
              )}

              {film.scanType !== "so_revelar" && (
                <ServiceCategory
                  title="Digitalização"
                  services={scanServices}
                  selectedIds={film.serviceIds}
                  onToggle={onToggleService}
                />
              )}

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

function ServiceCategory({
  title,
  services,
  selectedIds,
  onToggle,
}: {
  title: string
  services: Service[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
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
                    onClick={() => onToggle(id)} // clique na linha toda
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => onToggle(id)}
                        onClick={(e) => e.stopPropagation()} // impede toggle duplo
                      />
                      <span className="font-mono text-sm truncate">
                        {service.name}
                      </span>
                      {service.description && (
                        <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    <span className="font-mono font-bold shrink-0">
                      ${service.price.toFixed(2)}
                    </span>
                  </div>
                </TooltipTrigger>

                {service.description && (
                  <TooltipContent className="bg-card border-primary max-w-xs">
                    <p className="font-mono text-xs">{service.description}</p>
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
