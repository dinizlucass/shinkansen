import { z } from "zod"

const E164_REGEX = /^\+[1-9]\d{7,14}$/

export function normalizePhoneToE164(input: string): string | null {
  if (typeof input !== "string") return null
  const raw = input.trim()
  if (!raw) return null

  // Already includes +
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "")
    const out = `+${digits}`
    return E164_REGEX.test(out) ? out : null
  }

  // Remove any formatting
  const digits = raw.replace(/\D/g, "")
  if (!digits) return null

  // Common Brazil patterns (DDD required)
  if (digits.length === 10 || digits.length === 11) {
    const out = `+55${digits}`
    return E164_REGEX.test(out) ? out : null
  }

  // If user typed 55 + DDD + number without '+'
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    const out = `+${digits}`
    return E164_REGEX.test(out) ? out : null
  }

  // Fallback: treat as international without '+' if plausible
  if (digits.length >= 8 && digits.length <= 15 && digits[0] !== "0") {
    const out = `+${digits}`
    return E164_REGEX.test(out) ? out : null
  }

  return null
}

const optionalText = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v
      const t = v.trim()
      return t === "" ? undefined : t
    },
    z.string().min(1).max(max)
  ).optional()

export const phoneE164RequiredSchema = z
  .string()
  .transform((v) => normalizePhoneToE164(v) ?? "")
  .refine((v) => E164_REGEX.test(v), {
    message:
      "Telefone inválido. Informe DDD e número (ex: (11) 99999-9999) ou E.164 (ex: +5511999999999).",
  })

export const profileUpsertSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: optionalText(120),
  phone: phoneE164RequiredSchema,
  adress: optionalText(200),
})

export type ProfileUpsertInput = z.infer<typeof profileUpsertSchema>
