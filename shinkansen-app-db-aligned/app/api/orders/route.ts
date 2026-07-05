import { NextResponse } from "next/server"
import { z } from "zod"

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

interface Service {
  id: string | number
  name: string
  price: number
  category: string
  ui_id: string | null
}

function hasService(
  film: CreateOrderInput["films"][number],
  services: Service[],
  uiId: string
) {
  return services.some(
    (s) => film.serviceIds.includes(String(s.id)) && s.ui_id === uiId
  )
}

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

function isAlreadyDeveloped(
  film: CreateOrderInput["films"][number],
  services: Service[]
) {
  return hasService(film, services, "s_rev")
}

function composeFilmNotes(
  film: CreateOrderInput["films"][number],
  services: Service[]
): string | null {
  const parts: string[] = []
  const alreadyDeveloped = isAlreadyDeveloped(film, services)

  if (alreadyDeveloped) {
    parts.push("Ja revelado")
  } else {
    parts.push("Revelar")
  }

  if (film.pushPull !== 0) {
    parts.push(`Push/Pull: ${signPushPull(film.pushPull)}`)
  }

  if (film.observation?.trim()) {
    parts.push(film.observation.trim())
  }

  const notes = parts
    .join(" | ")
    .trim()
    .slice(0, MAX_FILM_OBSERVATION_LENGTH)

  return notes.length ? notes : null
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const body = await req.json().catch(() => null)
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: parsed.error.issues[0]?.message ?? "Payload invalido." } },
        { status: 400 }
      )
    }

    const input = parsed.data
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let clientId: string
    let clientEmail: string | null
    let clientFullName: string | null

    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single()

      const hydratedProfile = getProfileDefaults(user, profileError ? null : profile)

      if (!isProfileComplete(hydratedProfile)) {
        return NextResponse.json(
          { ok: false, error: { message: "Complete seu perfil com nome e telefone antes de criar um pedido." } },
          { status: 403 }
        )
      }

      clientId = user.id
      clientEmail = user.email ?? null
      clientFullName = hydratedProfile.full_name ?? null
    } else {
      // Cadastro embutido: cria a conta junto com o pedido (sem exigir login prévio).
      const accountSchema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().trim().min(1),
        phone: z.string().trim().min(8),
      })
      const accParsed = accountSchema.safeParse((body as { account?: unknown } | null)?.account)
      if (!accParsed.success) {
        return NextResponse.json(
          { ok: false, error: { message: "Para pedir sem login, informe nome, telefone, e-mail e senha (mín. 6)." } },
          { status: 400 }
        )
      }
      const acc = accParsed.data

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.full_name },
      })

      if (createErr || !created?.user) {
        console.error("[/api/orders] createUser falhou:", createErr)
        const rawMsg = createErr?.message ?? ""
        const jaExiste =
          rawMsg.toLowerCase().includes("already") ||
          rawMsg.toLowerCase().includes("registered") ||
          (createErr as { code?: string } | null)?.code === "email_exists"
        const detalhe =
          rawMsg && rawMsg !== "{}"
            ? rawMsg
            : `status=${(createErr as { status?: number } | null)?.status ?? "?"} code=${
                (createErr as { code?: string } | null)?.code ?? "?"
              } name=${(createErr as { name?: string } | null)?.name ?? "?"}`
        return NextResponse.json(
          {
            ok: false,
            error: {
              message: jaExiste
                ? "Este e-mail já tem conta. Faça login para continuar."
                : `Não foi possível criar a conta (${detalhe}).`,
            },
          },
          { status: jaExiste ? 409 : 400 }
        )
      }

      clientId = created.user.id
      clientEmail = acc.email
      clientFullName = acc.full_name

      // Garante o profile completo (nome + telefone) para o novo usuário.
      await admin
        .from("profiles")
        .upsert(
          { id: clientId, email: acc.email, full_name: acc.full_name, phone: acc.phone },
          { onConflict: "id" }
        )
    }

    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("id, name, price, category, ui_id")
      .eq("active", true)

    if (servicesError || !servicesData) {
      return NextResponse.json(
        { ok: false, error: { message: "Nao foi possivel carregar os servicos disponiveis." } },
        { status: 500 }
      )
    }

    const services = servicesData as Service[]
    const priceByServiceId = new Map<string, number>()
    const categoryByServiceId = new Map<string, string>()

    for (const service of services) {
      priceByServiceId.set(String(service.id), Number(service.price ?? 0))
      categoryByServiceId.set(String(service.id), normalizeCategory(service.category))
    }

    // Validações de Regras de Negócio
    for (const film of input.films) {
      const selectedServices = services.filter((s) => film.serviceIds.includes(String(s.id)))
      
      const hasPrimaryService = selectedServices.some((s) =>
        ["development", "scanning"].includes(normalizeCategory(s.category))
      )
      const hasJaRevelado = hasService(film, services, "s_rev")
      const hasRevealService = selectedServices.some(
        (s) => normalizeCategory(s.category) === "development" && s.ui_id !== "s_rev"
      )

      if (!hasPrimaryService) {
        return NextResponse.json(
          { ok: false, error: { message: "Selecione pelo menos um serviço principal para o filme." } },
          { status: 400 }
        )
      }

      if (!hasJaRevelado && !hasRevealService) {
        return NextResponse.json(
          { ok: false, error: { message: "Selecione um tipo de revelação ou marque já revelado." } },
          { status: 400 }
        )
      }

      if (hasJaRevelado) {
        const invalidReveal = selectedServices.some(
          (s) => normalizeCategory(s.category) === "development" && s.ui_id !== "s_rev"
        )

        if (invalidReveal) {
          return NextResponse.json(
            { ok: false, error: { message: "Filmes já revelados não podem incluir outro tipo de revelação." } },
            { status: 400 }
          )
        }
      }

      // Valida IDs de serviços inexistentes/inativos
      for (const serviceId of film.serviceIds) {
        if (!priceByServiceId.has(String(serviceId))) {
          return NextResponse.json(
            { ok: false, error: { message: "Um ou mais serviços selecionados não estão disponíveis." } },
            { status: 400 }
          )
        }
      }
    }

    const totalValue = input.films.reduce((sum, film) => {
      const filmSum = film.serviceIds.reduce(
        (acc, serviceId) => acc + (priceByServiceId.get(String(serviceId)) ?? 0),
        0
      )
      return sum + filmSum
    }, 0)

    const orderInsert = orderInsertSchema.parse({
      client_id: clientId,
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
      const selectedServices = services.filter((s) => film.serviceIds.includes(String(s.id)))
      const hasScanning = selectedServices.some((s) => normalizeCategory(s.category) === "scanning")
      const name = (film.name?.trim() || `FILME ${index + 1}`).trim()
      
      const row = filmInsertSchema.parse({
        order_id: order.id,
        name,
        film_type: null,
        // CORREÇÃO DO BUG: Se JÁ foi revelado, ignora push_pull. Se NÃO foi, aplica.
        push_pull: isAlreadyDeveloped(film, services) 
          ? null
          : film.pushPull !== undefined
          ? signPushPull(film.pushPull)
          : null,
        notes: composeFilmNotes(film, services),
        status: "criado",
        file_format: hasScanning ? film.fileFormat : null,
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
      }))
    )

    if (joins.length) {
      const { error: joinError } = await admin.from("film_services").insert(joins)

      if (joinError) {
        await admin.from("films").delete().eq("order_id", order.id)
        await admin.from("orders").delete().eq("id", order.id)
        throw new Error(joinError.message)
      }
    }

    if (clientEmail && process.env.RESEND_API_KEY) {
      try {
        await sendOrderStatusEmail({
          to: clientEmail,
          customerName: clientFullName,
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
    console.error("[/api/orders] erro:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido."
    return NextResponse.json({ ok: false, error: { message } }, { status: 500 })
  }
}