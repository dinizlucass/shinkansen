/**
 * lib/supabase/single-cookie.ts
 *
 * O Firebase Hosting clássico só repassa ao backend (Cloud Run) UM cookie
 * chamado exatamente `__session`. O @supabase/ssr, quando a sessão é grande,
 * divide o cookie em pedaços (`__session.0`, `__session.1`, ...) — e o Firebase
 * descarta esses pedaços, quebrando o login.
 *
 * Este helper junta os pedaços de volta em UM único cookie `__session`, tanto na
 * escrita (mergeChunks) quanto garantindo que a leitura devolve o cookie base.
 *
 * Limite: um cookie de navegador vai até ~4096 bytes. Se a sessão couber nisso
 * (o caso normal), funciona. Se estourar, o navegador recusa o cookie — aí seria
 * preciso reduzir o tamanho do token (ex.: enxugar user_metadata).
 */

export const SESSION_COOKIE = '__session'

export interface CookieItem {
  name: string
  value: string
  options?: Record<string, unknown>
}

/**
 * Recebe a lista de cookies que o @supabase/ssr quer gravar (já possivelmente
 * fatiada em `__session.0`, `__session.1`, ...) e devolve uma lista com um único
 * `__session` contendo a concatenação dos pedaços, na ordem correta.
 */
export function mergeChunks(cookies: CookieItem[]): CookieItem[] {
  const partes: { idx: number; value: string; options?: Record<string, unknown> }[] = []
  const outros: CookieItem[] = []

  for (const c of cookies) {
    if (c.name === SESSION_COOKIE) {
      partes.push({ idx: -1, value: c.value, options: c.options })
    } else if (c.name.startsWith(SESSION_COOKIE + '.')) {
      const n = parseInt(c.name.slice(SESSION_COOKIE.length + 1), 10)
      partes.push({ idx: Number.isNaN(n) ? 0 : n, value: c.value, options: c.options })
    } else {
      outros.push(c)
    }
  }

  if (partes.length === 0) return outros

  partes.sort((a, b) => a.idx - b.idx)
  const value = partes.map((p) => p.value).join('')
  const options = partes[0].options
  return [...outros, { name: SESSION_COOKIE, value, options }]
}
