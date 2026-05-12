import "server-only"

import fs from "node:fs"
import https from "node:https"

type EfiPixTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

type EfiPixCreateChargeInput = {
  amount: string
  pixKey: string
  payerMessage: string
}

type EfiPixChargeResponse = {
  calendario: {
    criacao?: string
    expiracao: number | string
  }
  txid: string
  revisao: number
  loc?: {
    id: number
    location: string
    tipoCob?: string
  }
  location?: string
  status: string
  valor: {
    original: string
  }
  chave: string
  solicitacaoPagador?: string
  pixCopiaECola?: string
}

type EfiPixQrCodeResponse = {
  qrcode?: string
  imagemQrcode?: string
  linkVisualizacao?: string
}

type CreatedEfiPixCharge = {
  txid: string
  status: string
  amount: string
  locationId: number | null
  locationUrl: string | null
  pixCopyPaste: string | null
  qrCodeImage: string | null
  paymentLinkUrl: string | null
  expiresInSeconds: number | null
  raw: {
    charge: EfiPixChargeResponse
    qrcode: EfiPixQrCodeResponse | null
  }
}

type EfiPixWebhookResponse = {
  webhookUrl: string
  chave: string
  criacao?: string
}

let cachedPixToken: { value: string; expiresAt: number } | null = null

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

export function getEfiPixConfig() {
  const sandbox = (process.env.EFI_SANDBOX ?? "true").toLowerCase() === "true"
  const clientId = getRequiredEnv("EFI_CLIENT_ID")
  const clientSecret = getRequiredEnv("EFI_CLIENT_SECRET")
  const certificatePath = getRequiredEnv("EFI_PIX_CERT_PATH")
  const pixKey = getRequiredEnv("EFI_PIX_KEY")
  const certificatePassphrase = process.env.EFI_PIX_CERT_PASSPHRASE ?? ""
  const webhookUrl = getOptionalEnv("EFI_WEBHOOK_URL")
  const webhookHmac = getOptionalEnv("EFI_WEBHOOK_HMAC")
  const skipMtls = (process.env.EFI_PIX_SKIP_MTLS ?? "true").toLowerCase() === "true"
  const baseUrl = sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br"

  return {
    sandbox,
    clientId,
    clientSecret,
    certificatePath,
    certificatePassphrase,
    pixKey,
    webhookUrl,
    webhookHmac,
    skipMtls,
    baseUrl,
  }
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function toBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
}

function getPixAgent() {
  const { certificatePath, certificatePassphrase } = getEfiPixConfig()
  const certificate = fs.readFileSync(certificatePath)

  return new https.Agent({
    pfx: certificate,
    passphrase: certificatePassphrase,
  })
}

function requestWithMtls<T>({
  method,
  url,
  headers,
  body,
}: {
  method: "GET" | "POST" | "PUT"
  url: string
  headers?: Record<string, string>
  body?: string
}) {
  const requestUrl = new URL(url)

  return new Promise<{ status: number; data: T | null; rawBody: string }>((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: requestUrl.hostname,
        path: `${requestUrl.pathname}${requestUrl.search}`,
        headers,
        agent: getPixAgent(),
      },
      (res) => {
        let rawBody = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          rawBody += chunk
        })
        res.on("end", () => {
          let data: T | null = null
          if (rawBody) {
            try {
              data = JSON.parse(rawBody) as T
            } catch {
              data = null
            }
          }

          resolve({
            status: res.statusCode ?? 500,
            data,
            rawBody,
          })
        })
      },
    )

    req.on("error", reject)

    if (body) {
      req.write(body)
    }

    req.end()
  })
}

function getPixErrorMessage(json: Record<string, unknown> | null, rawBody: string) {
  if (json) {
    if (typeof json.mensagem === "string") return json.mensagem
    if (typeof json.nome === "string") return json.nome
    if (typeof json.error_description === "string") return json.error_description
    if (typeof json.error === "string") return json.error
    if (typeof json.message === "string") return json.message
    return JSON.stringify(json)
  }

  return rawBody || "Falha na comunicacao com a Efi Pix."
}

function formatPixAmount(value: number) {
  return value.toFixed(2)
}

function sanitizePixMessage(value: string) {
  return value.trim().slice(0, 140) || "Pagamento do pedido"
}

export async function getEfiPixAccessToken(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedPixToken && cachedPixToken.expiresAt > now + 30_000) {
    return cachedPixToken.value
  }

  const { baseUrl, clientId, clientSecret } = getEfiPixConfig()
  const body = JSON.stringify({ grant_type: "client_credentials" })
  const response = await requestWithMtls<EfiPixTokenResponse | Record<string, unknown>>({
    method: "POST",
    url: `${baseUrl}/oauth/token`,
    headers: {
      Authorization: `Basic ${toBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "identity",
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  })

  if (!response.data || response.status >= 400 || !("access_token" in response.data)) {
    const message = getPixErrorMessage(response.data as Record<string, unknown> | null, response.rawBody)
    throw new Error(`Efí Pix auth ${response.status}: ${message}`)
  }

  const tokenData = response.data as EfiPixTokenResponse

  cachedPixToken = {
    value: tokenData.access_token,
    expiresAt: now + Math.max(tokenData.expires_in - 60, 60) * 1000,
  }

  return tokenData.access_token
}

export async function createEfiPixCharge(input: EfiPixCreateChargeInput): Promise<CreatedEfiPixCharge> {
  const token = await getEfiPixAccessToken()
  const { baseUrl } = getEfiPixConfig()

  const body = JSON.stringify({
    calendario: {
      expiracao: 60 * 60 * 24 * 7,
    },
    valor: {
      original: input.amount,
    },
    chave: input.pixKey,
    solicitacaoPagador: sanitizePixMessage(input.payerMessage),
  })

  const response = await requestWithMtls<EfiPixChargeResponse | Record<string, unknown>>({
    method: "POST",
    url: `${baseUrl}/v2/cob`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "identity",
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  })

  if (!response.data || response.status >= 400 || !("txid" in response.data)) {
    const message = getPixErrorMessage(response.data as Record<string, unknown> | null, response.rawBody)
    throw new Error(`Efí Pix charge ${response.status}: ${message}`)
  }

  const chargeData = response.data as EfiPixChargeResponse

  let qrCodeData: EfiPixQrCodeResponse | null = null
  if (chargeData.loc?.id) {
    const qrResponse = await requestWithMtls<EfiPixQrCodeResponse | Record<string, unknown>>({
      method: "GET",
      url: `${baseUrl}/v2/loc/${chargeData.loc.id}/qrcode`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Encoding": "identity",
      },
    })

    if (qrResponse.status < 400 && qrResponse.data && "qrcode" in qrResponse.data) {
      qrCodeData = qrResponse.data
    }
  }

  return {
    txid: chargeData.txid,
    status: chargeData.status,
    amount: chargeData.valor.original,
    locationId: chargeData.loc?.id ?? null,
    locationUrl: chargeData.location ?? chargeData.loc?.location ?? null,
    pixCopyPaste: chargeData.pixCopiaECola ?? qrCodeData?.qrcode ?? null,
    qrCodeImage: qrCodeData?.imagemQrcode ?? null,
    paymentLinkUrl: qrCodeData?.linkVisualizacao ?? null,
    expiresInSeconds: Number(chargeData.calendario.expiracao ?? 0) || null,
    raw: {
      charge: chargeData,
      qrcode: qrCodeData,
    },
  }
}

export function centsToPixAmount(amountInCents: number) {
  return formatPixAmount(amountInCents / 100)
}

export async function configureEfiPixWebhook() {
  const token = await getEfiPixAccessToken()
  const { baseUrl, pixKey, webhookUrl, skipMtls } = getEfiPixConfig()

  if (!webhookUrl) {
    throw new Error("Missing env EFI_WEBHOOK_URL")
  }

  const body = JSON.stringify({
    webhookUrl,
  })

  const response = await requestWithMtls<EfiPixWebhookResponse | Record<string, unknown>>({
    method: "PUT",
    url: `${baseUrl}/v2/webhook/${encodeURIComponent(pixKey)}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "identity",
      "Content-Length": String(Buffer.byteLength(body)),
      "x-skip-mtls-checking": skipMtls ? "true" : "false",
    },
    body,
  })

  if (!response.data || response.status >= 400 || !("webhookUrl" in response.data)) {
    const message = getPixErrorMessage(response.data as Record<string, unknown> | null, response.rawBody)
    throw new Error(`Efí Pix webhook ${response.status}: ${message}`)
  }

  return response.data as EfiPixWebhookResponse
}

export async function getEfiPixWebhook() {
  const token = await getEfiPixAccessToken()
  const { baseUrl, pixKey } = getEfiPixConfig()

  const response = await requestWithMtls<EfiPixWebhookResponse | Record<string, unknown>>({
    method: "GET",
    url: `${baseUrl}/v2/webhook/${encodeURIComponent(pixKey)}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Encoding": "identity",
    },
  })

  if (!response.data || response.status >= 400 || !("webhookUrl" in response.data)) {
    const message = getPixErrorMessage(response.data as Record<string, unknown> | null, response.rawBody)
    throw new Error(`Efí Pix webhook read ${response.status}: ${message}`)
  }

  return response.data as EfiPixWebhookResponse
}
