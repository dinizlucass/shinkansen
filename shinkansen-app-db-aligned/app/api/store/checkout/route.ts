import { NextRequest } from "next/server"

import { jsonErr } from "@/lib/api/http"

export async function POST(_request: NextRequest) {
  return jsonErr("Loja temporariamente indisponivel.", 503)
}
