# API externa de administracao

Esta API permite que um usuario **admin** do sistema atualize:

- o link do perfil de um usuario
- o link de um pedido
- o status de um pedido

## Autenticacao

Todas as requisicoes exigem um token de acesso do **Supabase** pertencente a um usuario com `is_admin = true`.

Use o header:

```http
Authorization: Bearer SEU_SUPABASE_ACCESS_TOKEN
Content-Type: application/json
```

Se o token estiver invalido ou expirado, a API responde `401`.

Se o usuario do token nao for admin, a API responde `403`.

## 1. Atualizar perfil por email

### Endpoint

```http
PATCH /api/external/profiles/by-email
```

### Body

```json
{
  "email": "cliente@exemplo.com",
  "photoLink": "https://drive.google.com/..."
}
```

Para limpar o link:

```json
{
  "email": "cliente@exemplo.com",
  "photoLink": null
}
```

### Resposta de sucesso

```json
{
  "ok": true,
  "data": {
    "profileId": "uuid-do-profile",
    "email": "cliente@exemplo.com",
    "photo_link": "https://drive.google.com/..."
  }
}
```

### Exemplo cURL

```bash
curl -X PATCH "https://SEU-DOMINIO/api/external/profiles/by-email" \
  -H "Authorization: Bearer SEU_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@exemplo.com",
    "photoLink": "https://drive.google.com/..."
  }'
```

## 2. Atualizar pedido por UUID

### Endpoint

```http
PATCH /api/external/orders/:orderId
```

`orderId` deve ser o **UUID** do pedido.

### Campos aceitos

```json
{
  "status": "recebido",
  "photoLink": "https://drive.google.com/..."
}
```

Todos os campos sao opcionais, mas e necessario enviar pelo menos um:

- `status`
- `photoLink`

### Status aceitos

- `criado`
- `recebido`
- `aguardando_pagamento`
- `pago`
- `finalizado`

### Exemplos de uso

Atualizar apenas o status:

```json
{
  "status": "recebido"
}
```

Atualizar apenas o link:

```json
{
  "photoLink": "https://drive.google.com/..."
}
```

Atualizar os dois:

```json
{
  "status": "finalizado",
  "photoLink": "https://drive.google.com/..."
}
```

Limpar o link:

```json
{
  "photoLink": null
}
```

### Comportamento importante

- Se o `status` mudar, o sistema dispara automaticamente o email correspondente para o cliente.
- Se o pedido for atualizado para `aguardando_pagamento`, o sistema tenta gerar automaticamente a cobranca Pix.
- Ao finalizar um pedido, **nao e obrigatorio** enviar `photoLink`.
- Se o pedido ja tiver `photoLink` salvo, o email de `finalizado` usara esse link automaticamente.

### Resposta de sucesso

```json
{
  "ok": true,
  "data": {
    "orderId": "uuid-do-pedido",
    "status": "finalizado",
    "photo_link": "https://drive.google.com/..."
  }
}
```

Quando houver geracao de Pix em `aguardando_pagamento`, a resposta tambem pode incluir campos como:

- `payment_provider`
- `payment_status`
- `payment_link_url`
- `payment_requested_at`
- `payment_link_expires_at`
- `efi_charge_id`
- `efi_charge_status`

### Exemplo cURL

```bash
curl -X PATCH "https://SEU-DOMINIO/api/external/orders/7013115b-8ab4-46f5-9763-632a7dd3aa98" \
  -H "Authorization: Bearer SEU_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "finalizado",
    "photoLink": "https://drive.google.com/..."
  }'
```

## Erros comuns

### 401 Unauthorized

```json
{
  "ok": false,
  "error": {
    "message": "Authorization Bearer token obrigatorio."
  }
}
```

ou

```json
{
  "ok": false,
  "error": {
    "message": "Token invalido ou expirado."
  }
}
```

### 403 Forbidden

```json
{
  "ok": false,
  "error": {
    "message": "Acesso negado."
  }
}
```

### 404 Not Found

```json
{
  "ok": false,
  "error": {
    "message": "Pedido nao encontrado."
  }
}
```

ou

```json
{
  "ok": false,
  "error": {
    "message": "Perfil nao encontrado."
  }
}
```
