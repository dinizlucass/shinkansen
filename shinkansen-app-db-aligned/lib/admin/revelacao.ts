import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

// Químicas de revelação válidas (paridade com o sistema local)
export const QUIMICAS = ["c41", "d76", "ecn2"] as const
export type Quimica = (typeof QUIMICAS)[number]

// Limite físico do tanque de revelação (igual ao local)
export const LIMITE_TANQUE = 8

// Vocabulário autoritativo de status de filme (routers/admin.py do local)
export const STATUS_FILME = [
  "criado",
  "cadastrado",
  "revelando",
  "digitalizando",
  "edicao",
  "concluido",
  "virgem",
  "velado",
  "suporte",
  "limpeza",
  "embalado",
  "enviado",
  "descartado",
] as const
export type StatusFilme = (typeof STATUS_FILME)[number]

export const PUSH_PULL_OPCOES = ["-3", "-2", "-1", "0", "+1", "+2", "+3"] as const

export const MAX_OBSERVACAO = 999

export type FilmeRevelacao = {
  id: string
  id_humano: number | null
  name: string | null
  status: string | null
  film_type: string | null
  push_pull: string | null
  notes: string | null
  grupo_id: string | null
}

export type GrupoRevelacao = {
  id: string
  id_caixa: string
  quimica: string
  push_pull: string | null
  status: string
  criado_em: string | null
  films: FilmeRevelacao[]
}

type AdminOk = { ok: true; userId: string }
type AdminErr = { ok: false; status: number; message: string }

/** Garante que o request vem de um usuário admin autenticado. */
export async function assertAdmin(): Promise<AdminOk | AdminErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401, message: "Você precisa estar logado." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return { ok: false, status: 403, message: "Acesso negado." }
  }

  return { ok: true, userId: user.id }
}

const FILM_COLS =
  "id, id_humano, name, status, film_type, push_pull, notes, grupo_id"

/** Próximo id_caixa numérico sequencial (igual ao _proximo_id_caixa do local). */
export async function proximoIdCaixa(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("grupos_develop").select("id_caixa")
  const nums = (data ?? [])
    .map((r: { id_caixa: string | null }) => parseInt(String(r.id_caixa ?? ""), 10))
    .filter((n: number) => !Number.isNaN(n))
  if (!nums.length) return "1"
  return String(Math.max(...nums) + 1)
}

/**
 * Fila de filmes avulsos (status "cadastrado", sem grupo, não "ja_revelado")
 * e grupos ativos (status "revelando") com seus filmes.
 *
 * Busca filmes e grupos separadamente e junta em JS para não depender do
 * nome da relação FK no PostgREST.
 */
export async function fetchFilaEGrupos(
  admin: SupabaseClient,
  opts: { todosGrupos?: boolean } = {},
): Promise<{ fila: FilmeRevelacao[]; grupos: GrupoRevelacao[] }> {
  const { data: fila } = await admin
    .from("films")
    .select(FILM_COLS)
    .is("grupo_id", null)
    .eq("status", "cadastrado")
    .neq("film_type", "ja_revelado")
    .order("id_humano", { ascending: true, nullsFirst: false })

  let grupoQuery = admin
    .from("grupos_develop")
    .select("id, id_caixa, quimica, push_pull, status, criado_em")
  if (!opts.todosGrupos) grupoQuery = grupoQuery.eq("status", "revelando")
  const { data: grupos } = await grupoQuery.order("id_caixa", {
    ascending: true,
  })

  const grupoIds = (grupos ?? []).map((g: { id: string }) => g.id)
  let filmesEmGrupos: FilmeRevelacao[] = []
  if (grupoIds.length) {
    const { data } = await admin
      .from("films")
      .select(FILM_COLS)
      .in("grupo_id", grupoIds)
      .order("id_humano", { ascending: true, nullsFirst: false })
    filmesEmGrupos = (data ?? []) as FilmeRevelacao[]
  }

  const gruposComFilmes: GrupoRevelacao[] = (grupos ?? []).map(
    (g: Omit<GrupoRevelacao, "films">) => ({
      ...g,
      films: filmesEmGrupos.filter((f) => f.grupo_id === g.id),
    }),
  )

  return { fila: (fila ?? []) as FilmeRevelacao[], grupos: gruposComFilmes }
}

// ─────────────────────────────────────────────────────────────────────────
// REGRA DE OURO da revelação
//   D76 (P&B) NÃO mistura com C41/ECN2.
//   C41 e ECN2 podem revelar juntos.
//   Puxadas (push/pull) podem misturar.
// ─────────────────────────────────────────────────────────────────────────

export type ClasseQuimica = "cor" | "pb"

export const REGRA_OURO =
  "D76 (P&B) não mistura com C41/ECN2. C41 e ECN2 podem revelar juntos. Puxadas podem misturar."

/** Classe de compatibilidade de um film_type/química. */
export function classeCompat(t: string | null | undefined): ClasseQuimica | null {
  if (t === "c41" || t === "ecn2") return "cor"
  if (t === "d76") return "pb"
  return null
}

/**
 * Verifica se um conjunto de tipos (film_types e/ou químicas) pode revelar
 * junto. Retorna ok=false quando há mistura proibida (cor + P&B).
 */
export function classeUnica(tipos: (string | null | undefined)[]): {
  ok: boolean
  classe: ClasseQuimica | null
} {
  const classes = new Set<ClasseQuimica>()
  for (const t of tipos) {
    const c = classeCompat(t)
    if (c) classes.add(c)
  }
  if (classes.size > 1) return { ok: false, classe: null }
  return { ok: true, classe: [...classes][0] ?? null }
}
