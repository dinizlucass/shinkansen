import { z } from 'zod'

export const MAX_FILM_OBSERVATION_LENGTH = 999

export const filmEntrySchema = z.object({
  name: z.string().trim().optional().nullable(),
  filmType: z.enum(['ja_revelado', 'c41', 'd76', 'ecn2']).default('c41'),
  serviceIds: z.array(z.string().min(1)).default([]),
  fileFormat: z.enum(['tiff', 'jpg', 'raw']).default('jpg'),
  scanType: z.enum(['normal', 'com_trilhas', 'normal_e_com_trilhas', 'so_revelar']).default('normal'),
  pushPull: z.number().int().min(-3).max(3).default(0),
  observation: z.string().trim().max(MAX_FILM_OBSERVATION_LENGTH).optional().nullable(),
})

export const createOrderSchema = z.object({
  email: z.string().email().optional(),
  notes: z.string().trim().max(MAX_FILM_OBSERVATION_LENGTH).optional().default(''),
  films: z.array(filmEntrySchema).min(1),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>


export const orderStatusEnum = z.enum([
  "criado",
  "recebido",
  "aguardando_pagamento",
  "pago",
  "finalizado",
])

export const filmStatusEnum = z.enum([
  "criado",
  "cadastrado",
  "revelando",
  "digitalizando",
  "suporte",
  "limpeza",
  "edicao",
  "concluido",
])

export const filmTypeEnum = z.enum(["c41", "d76", "ecn2", "ja_revelado"])
export const filmScanTypeEnum = z.enum(["normal","com_trilhas","normal_e_com_trilhas","so_revelar"])
export const filmFileFormatEnum = z.enum(["tiff", "jpg", "raw"])
export const filmPushPullEnum = z.enum(["-3", "-2", "-1", "0", "+1", "+2", "+3"])

export const orderInsertSchema = z.object({
  client_id: z.string().uuid(),
  status: orderStatusEnum.default("criado"),
  total_value: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  credits_used: z.number().nonnegative().default(0),
  drive_link: z.string().url().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const filmInsertSchema = z.object({
  order_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  film_type: filmTypeEnum,
  push_pull: filmPushPullEnum.nullable().optional(),
  notes: z.string().max(MAX_FILM_OBSERVATION_LENGTH).nullable().optional(),
  scan_type: filmScanTypeEnum,
  status: filmStatusEnum.default("criado"),
  file_link: z.string().url().nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  file_format: filmFileFormatEnum.nullable().optional(),
})

export type OrderInsert = z.infer<typeof orderInsertSchema>
export type FilmInsert = z.infer<typeof filmInsertSchema>
