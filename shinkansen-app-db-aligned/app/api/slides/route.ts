/**
 * app/api/slides/route.ts
 *
 * Serve os slides do portfólio.
 * Os dados vêm do public/slides-data.json gerado pelo script de upload.
 * Sem cache dinâmico — o arquivo muda só em deploy.
 */

import { NextResponse }  from "next/server"
import { obterSlides }   from "@/lib/drive-slides"

export const dynamic = "force-static" // gerado no build, não em runtime

export async function GET() {
  const slides = await obterSlides()
  return NextResponse.json({ slides })
}
