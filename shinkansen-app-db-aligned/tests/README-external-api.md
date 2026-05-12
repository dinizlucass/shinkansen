# Testes da API externa

Estes testes batem na API externa do projeto, inclusive em `localhost`.

## 1. Suba a aplicacao local

```powershell
npm.cmd run dev
```

Por padrao, o teste usa:

```text
http://localhost:3000
```

Se quiser outro host, defina:

```powershell
$env:API_BASE_URL="http://localhost:3000"
```

## 2. Configure a autenticacao

Voce pode usar **uma** destas abordagens:

### Opcao A: informar o token admin direto

```powershell
$env:API_ADMIN_TOKEN="SEU_TOKEN_ADMIN_DO_SUPABASE"
```

### Opcao B: deixar o teste logar no Supabase

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="SUA_ANON_KEY"
$env:SUPABASE_ADMIN_EMAIL="admin@exemplo.com"
$env:SUPABASE_ADMIN_PASSWORD="SUA_SENHA"
```

## 3. Configure os dados que vao ser alterados

Perfil:

```powershell
$env:TEST_PROFILE_EMAIL="cliente@exemplo.com"
$env:TEST_PROFILE_LINK="https://example.com/profile-link-test"
```

Pedido:

```powershell
$env:TEST_ORDER_ID="UUID_DO_PEDIDO"
$env:TEST_ORDER_LINK="https://example.com/order-link-test"
```

Se quiser testar mudanca de status:

```powershell
$env:TEST_ORDER_STATUS="recebido"
```

Status aceitos:

- `criado`
- `recebido`
- `aguardando_pagamento`
- `pago`
- `finalizado`

## 4. Rodar os testes

```powershell
python -m unittest tests.external_api_test -v
```

Ou:

```powershell
python tests/external_api_test.py
```

## O que os testes fazem

- valida que a rota de perfil retorna `401` sem autenticacao
- atualiza `photoLink` do perfil por email
- atualiza `photoLink` do pedido por UUID
- opcionalmente atualiza `status` do pedido

## Observacoes

- o teste de status pode disparar email e outras automacoes normais do sistema
- se `TEST_ORDER_ID` nao for definido, os testes de pedido sao pulados
- se `TEST_ORDER_STATUS` nao for definido, o teste de mudanca de status e pulado
