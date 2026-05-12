import { NextResponse } from "next/server"

import { sendOrderStatusEmail } from "@/lib/email/order-status"
import { getProfileDefaults } from "@/lib/profile-bootstrap"
import { isProfileComplete } from "@/lib/profile-completion"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  createOrderSchema,
  filmInsertSchema,
  MAX_FILM_OBSERVATION_LENGTH,
  orderInsertSchema,
  type CreateOrderInput,
} from "@/lib/validators/orders"

function signPushPull(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function normalizeCategory(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  if (["development", "revelacao", "revelacao_filme"].includes(normalized)) return "development"
  if (["scanning", "digitalizacao", "digitalizacao_filme"].includes(normalized)) return "scanning"
  if (["printing", "impressao"].includes(normalized)) return "printing"
  return normalized
}

function composeFilmNotes(film: CreateOrderInput["films"][number]): string | null {
  const parts: string[] = []

  if (film.filmType !== "ja_revelado") {
    const label = film.filmType === "c41" ? "C-41" : film.filmType === "d76" ? "D-76" : "ECN-2"
    parts.push(`Revelacao: ${label}`)
  } else {
    parts.push("Ja revelado")
  }

  if (film.observation?.trim()) {
    parts.push(film.observation.trim())
  }

  const notes = parts.join(" | ").trim().slice(0, MAX_FILM_OBSERVATION_LENGTH)
  return notes.length ? notes : null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const admin = createAdminClient()

  try {
    const body = await req.json().catch(() => null)
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: parsed.error.issues[0]?.message ?? "Payload invalido." } },
        { status: 400 },
      )
    }

    const input = parsed.data
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: { message: "Voce precisa estar logado para criar um pedido." } },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    const hydratedProfile = getProfileDefaults(user, profileError ? null : profile)

    if (!isProfileComplete(hydratedProfile)) {
      return NextResponse.json(
        { ok: false, error: { message: "Complete seu perfil com nome e telefone antes de criar um pedido." } },
        { status: 403 },
      )
    }

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, price, category")
      .eq("active", true)

    if (servicesError) {
      return NextResponse.json(
        { ok: false, error: { message: "Nao foi possivel carregar os servicos disponiveis." } },
        { status: 500 },
      )
    }

    const priceByServiceId = new Map<string, number>()
    const categoryByServiceId = new Map<string, string>()
    for (const service of services ?? []) {
      priceByServiceId.set(String(service.id), Number(service.price ?? 0))
      categoryByServiceId.set(String(service.id), normalizeCategory(service.category))
    }

    for (const film of input.films) {
      if (film.serviceIds.length === 0) {
        return NextResponse.json(
          { ok: false, error: { message: "Cada filme precisa ter pelo menos um servico selecionado." } },
          { status: 400 },
        )
      }

      for (const serviceId of film.serviceIds) {
        if (!priceByServiceId.has(String(serviceId))) {
          return NextResponse.json(
            { ok: false, error: { message: "Um ou mais servicos selecionados nao estao disponiveis." } },
            { status: 400 },
          )
        }

        const category = categoryByServiceId.get(String(serviceId))
        if (film.filmType === "ja_revelado" && category === "development") {
          return NextResponse.json(
            { ok: false, error: { message: "Filmes ja revelados nao podem incluir servicos de revelacao." } },
            { status: 400 },
          )
        }

        if (film.scanType === "so_revelar" && category === "scanning") {
          return NextResponse.json(
            { ok: false, error: { message: "A opcao so revelar nao pode incluir servicos de digitalizacao." } },
            { status: 400 },
          )
        }
      }
    }

    const totalValue = input.films.reduce((sum, film) => {
      const filmSum = film.serviceIds.reduce((acc, serviceId) => acc + (priceByServiceId.get(String(serviceId)) ?? 0), 0)
      return sum + filmSum
    }, 0)

    const orderInsert = orderInsertSchema.parse({
      client_id: user.id,
      status: "criado",
      total_value: totalValue,
      discount: 0,
      credits_used: 0,
      notes: input.notes?.trim() || null,
    })

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single()

    if (orderError) {
      throw new Error(orderError.message)
    }

    const filmRows = input.films.map((film, index) => {
      const name = (film.name?.trim() || `FILME ${index + 1}`).trim()
      const row = filmInsertSchema.parse({
        order_id: order.id,
        name,
        film_type: film.filmType,
        push_pull: film.filmType === "ja_revelado" ? null : signPushPull(film.pushPull),
        notes: composeFilmNotes(film),
        scan_type: film.scanType,
        status: "criado",
        file_format: film.scanType === "so_revelar" ? null : film.fileFormat,
      })

      return {
        legacyServiceIds: film.serviceIds.map(String),
        ...row,
      }
    })

    const { data: insertedFilms, error: filmsError } = await admin
      .from("films")
      .insert(filmRows.map(({ legacyServiceIds, ...row }) => row))
      .select("id")

    if (filmsError) {
      await admin.from("orders").delete().eq("id", order.id)
      throw new Error(filmsError.message)
    }

    const joins = (insertedFilms ?? []).flatMap((film, index) =>
      (filmRows[index]?.legacyServiceIds ?? []).map((serviceId) => ({
        film_id: film.id,
        service_id: String(serviceId),
        price: priceByServiceId.get(String(serviceId)) ?? 0,
      })),
    )

    if (joins.length) {
      const { error: joinError } = await admin.from("film_services").insert(joins)

      if (joinError) {
        await admin.from("films").delete().eq("order_id", order.id)
        await admin.from("orders").delete().eq("id", order.id)
        throw new Error(joinError.message)
      }
    }

    if (user.email && process.env.RESEND_API_KEY) {
      try {
        await sendOrderStatusEmail({
          to: user.email,
          customerName: hydratedProfile.full_name ?? null,
          orderId: order.id,
          status: "criado",
          totalValue,
        })
      } catch (emailError) {
        console.error("Failed to send created order email", emailError)
      }
    }

    return NextResponse.json({ ok: true, orderId: order.id }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido."
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 })
  }
}
