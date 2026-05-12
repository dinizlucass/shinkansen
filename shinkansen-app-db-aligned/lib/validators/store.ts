import { z } from 'zod'

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
})

export const checkoutSchema = z.object({
  email: z.string().email().optional(),
  items: z.array(cartItemSchema).min(1),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
