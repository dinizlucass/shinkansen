#!/usr/bin/env node
/**
 * scripts/manage-slides.mjs
 *
 * Gerencia os metadados dos slides do portfólio em public/slides-data.json.
 * Detecta automaticamente a orientação da imagem (portrait/landscape).
 * As imagens ficam em public/slides/ — copie a foto para lá antes de usar.
 *
 * Uso:
 *   node scripts/manage-slides.mjs adicionar foto-01.jpg --autor "Nome" [--titulo "Título"]
 *   node scripts/manage-slides.mjs listar
 *   node scripts/manage-slides.mjs remover foto-01.jpg
 *   node scripts/manage-slides.mjs reordenar foto-01.jpg 2
 *
 * Dependência para detecção de orientação (instale uma vez):
 *   npm install image-size
 *
 * Depois de qualquer mudança:
 *   git add public/slides/ public/slides-data.json
 *   git commit -m "feat: atualiza slides"
 *   git push
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

const SLIDES_JSON = resolve("public/slides-data.json")
const SLIDES_DIR  = resolve("public/slides")

// ── Detecção de orientação ──────────────────────────────────────────

async function detectarOrientacao(filePath) {
  try {
    // Tenta image-size (leve, sem dependências nativas)
    const { imageSize } = await import("image-size").catch(() => ({ imageSize: null }))
    if (imageSize) {
      const dim = imageSize(filePath)
      return (dim.width ?? 0) >= (dim.height ?? 1) ? "landscape" : "portrait"
    }
  } catch {}

  // Fallback: lê os primeiros bytes do JPEG/PNG para extrair as dimensões
  // sem dependência externa — funciona para jpg/png comuns
  try {
    const buf = readFileSync(filePath)

    // PNG: bytes 16-23 contêm largura e altura
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      return w >= h ? "landscape" : "portrait"
    }

    // JPEG: procura o marcador SOF (0xFFC0, FFC1, FFC2...)
    for (let i = 2; i < Math.min(buf.length - 8, 65536);) {
      if (buf[i] !== 0xFF) break
      const marker = buf[i + 1]
      if (marker >= 0xC0 && marker <= 0xC3) {
        const h = buf.readUInt16BE(i + 5)
        const w = buf.readUInt16BE(i + 7)
        return w >= h ? "landscape" : "portrait"
      }
      const segLen = buf.readUInt16BE(i + 2)
      i += 2 + segLen
    }
  } catch {}

  info("Não foi possível detectar orientação — assumindo portrait")
  return "portrait"
}

// ── Helpers ──────────────────────────────────────────────────────────

function carregar() {
  if (!existsSync(SLIDES_JSON)) return []
  try { return JSON.parse(readFileSync(SLIDES_JSON, "utf-8")) }
  catch { return [] }
}

function salvar(slides) {
  writeFileSync(SLIDES_JSON, JSON.stringify(slides, null, 2) + "\n", "utf-8")
}

function ok(msg)   { console.log(`  ✓  ${msg}`) }
function err(msg)  { console.error(`  ✕  ${msg}`); process.exit(1) }
function info(msg) { console.log(`  ·  ${msg}`) }

// ── Comandos ─────────────────────────────────────────────────────────

async function adicionar(fileName, autor, titulo) {
  if (!existsSync(`${SLIDES_DIR}/${fileName}`)) {
    err(`Arquivo não encontrado em public/slides/${fileName}\nCopie a foto para public/slides/ antes de adicionar.`)
  }

  const filePath = `${SLIDES_DIR}/${fileName}`
  const url      = `/slides/${fileName}`
  const slides   = carregar()
  const existe   = slides.find(s => s.file_name === fileName)

  if (existe && !process.argv.includes("--force")) {
    err(`"${fileName}" já existe. Use --force para sobrescrever.`)
  }

  info("Detectando orientação da imagem...")
  const orientation = await detectarOrientacao(filePath)
  ok(`Orientação detectada: ${orientation}`)

  const ordem = existe
    ? existe.order
    : slides.length > 0 ? Math.max(...slides.map(s => s.order)) + 1 : 1

  const novo = {
    file_name:   fileName,
    author:      autor,
    title:       titulo ?? "",
    order:       ordem,
    url,
    orientation,   // "portrait" | "landscape"
  }

  const atualizados = existe
    ? slides.map(s => s.file_name === fileName ? novo : s)
    : [...slides, novo]

  salvar(atualizados)
  ok(`"${fileName}" adicionado (posição ${ordem}, ${orientation})`)
  info(`Autor: ${autor}`)
  console.log()
  console.log("  Próximo passo:")
  console.log("    git add public/slides/ public/slides-data.json")
  console.log("    git commit -m 'feat: atualiza slides'")
  console.log("    git push")
}

function listar() {
  const slides = carregar()
  if (!slides.length) { console.log("  Nenhum slide cadastrado."); return }
  console.log(`\n  ${slides.length} slide(s):\n`)
  for (const s of slides) {
    console.log(`  [${String(s.order).padStart(2,"0")}] ${s.file_name}`)
    console.log(`       Autor : ${s.author}`)
    if (s.title) console.log(`       Título: ${s.title}`)
    console.log(`       URL   : ${s.url}`)
    console.log()
  }
}

function remover(fileName) {
  const slides = carregar()
  if (!slides.find(s => s.file_name === fileName)) {
    err(`"${fileName}" não encontrado no slides-data.json`)
  }
  const atualizados = slides
    .filter(s => s.file_name !== fileName)
    .map((s, i) => ({ ...s, order: i + 1 }))
  salvar(atualizados)
  ok(`"${fileName}" removido do slides-data.json`)
  info(`Lembre de deletar public/slides/${fileName} também, se quiser remover do repositório.`)
}

function reordenar(fileName, novaOrdem) {
  const slides = carregar()
  const idx    = slides.findIndex(s => s.file_name === fileName)
  if (idx === -1) err(`"${fileName}" não encontrado.`)
  const [slide] = slides.splice(idx, 1)
  slides.splice(novaOrdem - 1, 0, slide)
  salvar(slides.map((s, i) => ({ ...s, order: i + 1 })))
  ok(`"${fileName}" movido para posição ${novaOrdem}`)
}

// ── Main ─────────────────────────────────────────────────────────────

const cmd  = process.argv[2]
const args = process.argv.slice(3)

console.log("\n════════════════════════════════════")
console.log("  LabOS — Gerenciador de Slides")
console.log("════════════════════════════════════\n")

if (cmd === "listar" || cmd === "list") {
  listar()
} else if (cmd === "remover" || cmd === "remove") {
  if (!args[0]) err("Informe o nome do arquivo: remover foto.jpg")
  remover(args[0])
} else if (cmd === "reordenar" || cmd === "reorder") {
  if (!args[0] || !args[1]) err("Uso: reordenar foto.jpg 2")
  reordenar(args[0], parseInt(args[1]))
} else if (cmd === "adicionar" || cmd === "add") {
  const file = args[0]
  if (!file) err("Informe o nome do arquivo: adicionar foto.jpg --autor 'Nome'")
  let autor = "", titulo = ""
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--autor"  && args[i+1]) { autor  = args[++i]; continue }
    if (args[i] === "--titulo" && args[i+1]) { titulo = args[++i]; continue }
  }
  if (!autor) err("--autor é obrigatório. Ex: --autor 'Larissa Higa'")
  adicionar(file, autor, titulo).catch(e => err(e.message))
} else {
  console.log("  Uso:")
  console.log("    node scripts/manage-slides.mjs adicionar <foto.jpg> --autor 'Nome' [--titulo 'Título']")
  console.log("    node scripts/manage-slides.mjs listar")
  console.log("    node scripts/manage-slides.mjs remover <foto.jpg>")
  console.log("    node scripts/manage-slides.mjs reordenar <foto.jpg> <posição>")
  console.log()
}
