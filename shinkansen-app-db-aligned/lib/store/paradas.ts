// ────────────────────────────────────────────────────────────────────────
// PARADAS SHINKANSEN — pontos de coleta/retirada de filmes.
// Edite aqui os dados reais (descrição, andar/prédio, metrô, contatos).
// Os links do Maps abaixo são de BUSCA (funcionam e são copiáveis). Se tiver
// o link exato do "pin" (Compartilhar → Copiar link), troque `maps` e ajuste
// `mapsEmbed` para o mesmo lugar.
// ────────────────────────────────────────────────────────────────────────

export type Parada = {
  id: string
  nome: string
  bairro: string
  descricao: string
  detalhe: string // andar / prédio / referência
  metro: string // metrô mais próximo
  maps: string // link clicável/copiável
  mapsEmbed: string // src do iframe do mapa
  instagram: string // URL do perfil (vazio = oculta)
  contato: string // URL de contato do parceiro (vazio = oculta)
}

export const PARADAS: Parada[] = [
  {
    id: "naif",
    nome: "Naïf Café",
    bairro: "Santa Cecília",
    descricao: "Café com grãos especiais.", // TODO: confirmar descrição
    detalhe: "", // TODO: andar/prédio/referência, se houver
    metro: "Estação Santa Cecília (Linha 3-Vermelha)", // TODO: confirmar
    maps: "https://www.google.com/maps/search/?api=1&query=Na%C3%AFf%20Caf%C3%A9%2C%20Santa%20Cec%C3%ADlia%2C%20S%C3%A3o%20Paulo",
    mapsEmbed:
      "https://maps.google.com/maps?q=Na%C3%AFf%20Caf%C3%A9%2C%20Santa%20Cec%C3%ADlia%2C%20S%C3%A3o%20Paulo&z=16&output=embed",
    instagram: "https://instagram.com/naif.cafe", // TODO: @ do parceiro, se houver
    contato: "", // TODO: link de contato do parceiro, se houver
  },
  {
    id: "brecho-di-mil",
    nome: "Brechó Di Mil",
    bairro: "República",
    descricao: "Especializado em moda street, discos e acessórios.",
    detalhe: "Dom Jose de Barros 337 Sala 101 Republica-SP", // TODO: confirmar andar/prédio
    metro: "Estação República (Linhas 3-Vermelha e 4-Amarela)", // TODO: confirmar
    maps: "https://www.google.com/maps/search/?api=1&query=Brech%C3%B3%20Di%20Mil%2C%20Rep%C3%BAblica%2C%20S%C3%A3o%20Paulo",
    mapsEmbed:
      "https://maps.google.com/maps?q=Brech%C3%B3%20Di%20Mil%2C%20Rep%C3%BAblica%2C%20S%C3%A3o%20Paulo&z=16&output=embed",
    instagram: "https://instagram.com/brechodimil", // TODO
    contato: "", // TODO
  },
]

// @ único usado em todas as redes (Instagram, TikTok, X)
export const HANDLE = "shinkansen.films"

// Canais de suporte / contato da Shinkansen
export const SUPORTE = {
  handle: `@${HANDLE}`,
  whatsappNumero: "5511934411641",
  whatsappExibicao: "+55 (11) 93441-1641",
  whatsapp: "https://wa.me/5511934411641",
  instagram: `https://instagram.com/${HANDLE}`,
  tiktok: `https://tiktok.com/@${HANDLE}`,
  x: `https://x.com/${HANDLE}`,
  email: "sac@shinkansen.com.br", // suporte / retirada
  emailContato: "lab@shinkansen.com.br", // página de contato
}

// Chave usada para passar o resumo do último pedido até a página /proxima-parada

export const ULTIMO_PEDIDO_KEY = "shinkansen:ultimoPedido"
