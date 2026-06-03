/**
 * lib/drive-slides.ts
 *
 * Carrega slides do portfólio a partir de public/slides-data.json.
 *
 * As imagens ficam em public/slides/ e são servidas pelo CDN da Vercel
 * em https://seusite.com/slides/nome-do-arquivo.jpg.
 *
 * Para atualizar os slides:
 *   1. Copie a foto redimensionada para public/slides/
 *   2. node scripts/manage-slides.mjs adicionar foto.jpg --autor "Nome"
 *   3. git add public/slides/ public/slides-data.json
 *   4. git commit && git push → deploy automático
 */

export interface Slide {
  file_name:   string
  author:      string
  title:       string
  order:       number
  url:         string
  orientation: "portrait" | "landscape"   // detectado automaticamente pelo script
}

export async function obterSlides(): Promise<Slide[]> {
  try {
    const data = await import("../public/slides-data.json", {
      with: { type: "json" },
    })
    const slides: Slide[] = data.default ?? []
    return slides.sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}