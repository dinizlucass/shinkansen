import { jsonErr } from '@/lib/api/http'

export async function GET() {
  return jsonErr('Loja temporariamente indisponivel.', 503)
}
