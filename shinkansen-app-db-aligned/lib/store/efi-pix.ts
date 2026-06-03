/**
 * lib/store/efi-pix.ts
 *
 * Cliente da API Pix da Efí (Gerencianet) para a loja.
 * Usa mTLS via certificado em base64 (compatível com Vercel serverless).
 *
 * Variáveis de ambiente:
 *   EFI_CLIENT_ID        → Client ID da aplicação Efí
 *   EFI_CLIENT_SECRET    → Client Secret
 *   EFI_CERT_BASE64      → certificado .pem convertido para base64
 *   EFI_PIX_KEY          → chave Pix (aleatória) que recebe os pagamentos
 *   EFI_BASE             → https://pix.api.efipay.com.br (produção)
 *                          ou https://pix-h.api.efipay.com.br (homologação)
 *   EFI_WEBHOOK_SKEY     → chave secreta usada na URL do webhook
 *
 * Como gerar o EFI_CERT_BASE64 a partir do .p12:
 *   1. openssl pkcs12 -in certificado.p12 -out cert.pem -nodes
 *   2. base64 -w 0 cert.pem > cert.b64   (Linux)
 *      ou: certutil -encode cert.pem cert.b64  (Windows, remover cabeçalhos)
 *   3. cole o conteúdo em EFI_CERT_BASE64
 */

import https from "https"
import { Agent } from "https"

const BASE       = process.env.EFI_BASE ?? "https://pix.api.efipay.com.br"
const CLIENT_ID  = process.env.EFI_CLIENT_ID ?? ""
const SECRET     = process.env.EFI_CLIENT_SECRET ?? ""
const PIX_KEY    = process.env.EFI_PIX_KEY ?? ""
const CERT_B64   = process.env.EFI_CERT_BASE64 ?? ""

// ── Agente HTTPS com o certificado mTLS ──────────────────────────────────────

let _agent: Agent | null = null

function getAgent(): Agent {
  if (_agent) return _agent
  if (!CERT_B64) throw new Error("EFI_CERT_BASE64 não configurado.")

  const pem = Buffer.from(CERT_B64, "base64").toString("utf-8")
  _agent = new https.Agent({
    cert: pem,
    key:  pem,   // o .pem com -nodes contém cert + chave juntos
    keepAlive: true,
  })
  return _agent
}

// ── Autenticação OAuth ───────────────────────────────────────────────────────

let _tokenCache: { token: string; exp: number } | null = null

async function getToken(): Promise<string> {
  // Reusa token em cache se ainda válido (margem de 60s)
  if (_tokenCache && Date.now() < _tokenCache.exp - 60_000) {
    return _tokenCache.token
  }

  const auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64")

  const res = await fetch(`${BASE}/oauth/token`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
    // @ts-expect-error - agent é suportado pelo undici no Node runtime
    agent: getAgent(),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Efí OAuth falhou (${res.status}): ${txt.slice(0, 200)}`)
  }

  const data = await res.json()
  _tokenCache = {
    token: data.access_token,
    exp:   Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return data.access_token
}

// ── Helper de request autenticado ────────────────────────────────────────────

async function efiFetch(path: string, method: string, body?: unknown) {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    // @ts-expect-error - agent suportado pelo undici no Node runtime
    agent: getAgent(),
  })

  const txt = await res.text()
  let json: any = {}
  try { json = txt ? JSON.parse(txt) : {} } catch { /* resposta não-JSON */ }

  if (!res.ok) {
    throw new Error(`Efí ${path} (${res.status}): ${txt.slice(0, 300)}`)
  }
  return json
}

// ── API pública ──────────────────────────────────────────────────────────────

export interface CobrancaPix {
  txid:           string
  charge_id:      string   // loc.id, usado para gerar QR
  pix_copia_cola: string
  qr_code_base64: string   // imagem do QR em base64
  valor:          number
  expiracao:      number   // segundos
}

/**
 * Cria uma cobrança Pix imediata (cob) e gera o QR Code.
 * @param valor    valor em reais (ex: 51.25)
 * @param infoPagador  texto livre que aparece para o pagador
 * @param expiracaoSegundos  tempo de expiração (default 1h)
 */
export async function criarCobrancaPix(
  valor: number,
  infoPagador: string,
  expiracaoSegundos = 3600
): Promise<CobrancaPix> {
  if (!PIX_KEY) throw new Error("EFI_PIX_KEY não configurada.")

  // 1. Cria a cobrança imediata
  const cob = await efiFetch("/v2/cob", "POST", {
    calendario: { expiracao: expiracaoSegundos },
    valor:      { original: valor.toFixed(2) },
    chave:      PIX_KEY,
    solicitacaoPagador: infoPagador.slice(0, 140),
  })

  const txid    = cob.txid
  const locId   = cob.loc?.id
  if (!locId) throw new Error("Efí não retornou loc.id da cobrança.")

  // 2. Gera o QR Code a partir do location
  const qr = await efiFetch(`/v2/loc/${locId}/qrcode`, "GET")

  return {
    txid,
    charge_id:      String(locId),
    pix_copia_cola: qr.qrcode,
    qr_code_base64: qr.imagemQrcode,   // já vem como data:image/png;base64,...
    valor,
    expiracao:      expiracaoSegundos,
  }
}

/**
 * Consulta o status de uma cobrança pelo txid.
 * Status possíveis: ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, etc.
 */
export async function consultarCobranca(txid: string) {
  return efiFetch(`/v2/cob/${txid}`, "GET")
}

/**
 * Configura o webhook do Pix para a chave (chamar uma vez no setup).
 * A URL deve conter a skey como parâmetro para validação na Vercel.
 */
export async function configurarWebhook(urlComSkey: string) {
  return efiFetch(`/v2/webhook/${encodeURIComponent(PIX_KEY)}`, "PUT", {
    webhookUrl: urlComSkey,
  })
}