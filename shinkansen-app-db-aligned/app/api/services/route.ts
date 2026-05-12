import { jsonErr, jsonOk } from '@/lib/api/http'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, price, category, active, ui_id')
      .eq('active', true)
      .order('name')

    if (error) return jsonErr(error.message, 500, error.code)
    return jsonOk({ services: data ?? [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return jsonErr(message, 500)
  }
}
