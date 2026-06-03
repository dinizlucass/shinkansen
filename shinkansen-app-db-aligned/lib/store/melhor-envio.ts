/**
 * lib/store/melhor-envio.ts
 *
 * Cliente da API do Melhor Envio para cálculo de frete.
 *
 * Variáveis de ambiente:
 *   MELHOR_ENVIO_TOKEN   → token de produção (Bearer)
 *   MELHOR_ENVIO_BASE    → https://www.melhorenvio.com.br (prod)
 *                          ou https://sandbox.melhorenvio.com.br (teste)
 *   LAB_CEP_ORIGEM       → CEP de origem do laboratório (só dígitos)
 *   MELHOR_ENVIO_FROM_NAME (opcional) → identificação do remetente
 */

import { agregarPacote, type PackageDimensions } from "./shipping-dimensions"
import type { ProductCategory } from "./types"

const BASE  = process.env.MELHOR_ENVIO_BASE  ?? "https://www.melhorenvio.com.br"
const TOKEN = process.env.MELHOR_ENVIO_TOKEN ?? ""
const CEP_ORIGEM = process.env.LAB_CEP_ORIGEM ?? ""

export interface OpcaoFrete {
  id:            number
  nome:          string   // "PAC", "SEDEX", etc
  empresa:       string   // "Correios", "Jadlog", etc
  preco:         number
  prazo:         number   // dias úteis
  erro?:         string   // se a transportadora retornou erro
}

interface CartItemInput {
  category: ProductCategory
  quantity: number
  price:    number   // valor para seguro/declaração
}

/**
 * Calcula opções de frete do CEP do lab até o CEP de destino.
 * Retorna lista de transportadoras com preço e prazo.
 */
export async function calcularFrete(
  cepDestino: string,
  itens: CartItemInput[],
  valorTotal: number
): Promise<OpcaoFrete[]> {
  if (!TOKEN)      throw new Error("MELHOR_ENVIO_TOKEN não configurado.")
  if (!CEP_ORIGEM) throw new Error("LAB_CEP_ORIGEM não configurado.")

  const cep = cepDestino.replace(/\D/g, "")
  if (cep.length !== 8) throw new Error("CEP de destino inválido.")

  const pacote: PackageDimensions = agregarPacote(
    itens.map((i) => ({ category: i.category, quantity: i.quantity }))
  )

  const body = {
    from: { postal_code: CEP_ORIGEM.replace(/\D/g, "") },
    to:   { postal_code: cep },
    package: {
      height: pacote.height,
      width:  pacote.width,
      length: pacote.length,
      weight: pacote.weight,
    },
    options: {
      insurance_value: valorTotal,
      receipt:         false,
      own_hand:        false,
    },
  }

  const res = await fetch(`${BASE}/api/v2/me/shipment/calculate`, {
    method:  "POST",
    headers: {
      "Accept":         "application/json",
      "Content-Type":   "application/json",
      "Authorization":  `Bearer ${TOKEN}`,
      "User-Agent":     process.env.MELHOR_ENVIO_FROM_NAME ?? "Shinkansen Films (contato@shinkansenfilms.com.br)",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Melhor Envio retornou ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json()

  // A resposta é um array de serviços; alguns podem vir com "error"
  return (Array.isArray(data) ? data : [])
    .map((s: any): OpcaoFrete => ({
      id:      s.id,
      nome:    s.name,
      empresa: s.company?.name ?? "",
      preco:   s.price ? Number(s.price) : 0,
      prazo:   s.delivery_time ?? 0,
      erro:    s.error ?? undefined,
    }))
    // remove serviços que retornaram erro (ex: CEP fora de área)
    .filter((o) => !o.erro && o.preco > 0)
    // ordena do mais barato para o mais caro
    .sort((a, b) => a.preco - b.preco)
}