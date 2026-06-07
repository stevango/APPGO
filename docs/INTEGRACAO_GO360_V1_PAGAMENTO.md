# Integração — GO360 API v1 (server-to-server) · Promoções de Pagamento

Namespace **`/api/v1/app/*`** autenticado por **API Key** (`X-API-Key`). É o
**nosso backend** agindo em nome do cliente / lendo configs. A chave **nunca**
vai para o app. O módulo de Promoções de Pagamento é **configurado no GO360**;
o app apenas **renderiza** e registra a auditoria.

## Configuração

1. GO360 → **Configurações → Chaves de API** → criar chave com os scopes
   `app:config:read`, `app:cliente:read`, `app:cliente:write`.
2. Railway (backend): `GO360_API_KEY=gok_…` (e, se necessário,
   `GO360_API_V1_BASE`, padrão `https://go360.gogestao.com.br/api/v1/app`).

## O que o app consome

- **Server** `server/integrations/go360api.ts` (X-API-Key, cache, timeout):
  - `go360Health()`
  - `go360MetodosPagamento()` — métodos + badges (cache 6h)
  - `go360PromocaoPagamento(metodoAtual)` — `{ promocao, beneficios }` (cache 30m)
  - `go360MudarPagamento(payload)` — registra a troca (auditoria)
- **tRPC** `paymentPromo`:
  - `metodos` — lista configurável
  - `promocao` — usa o método atual do cliente (mapeado p/ código GO360)
  - `mudar` — monta `cliente { id, cpf, email }` de `go360ClienteId`/`cpf`/`email`
- **Cliente**:
  - `PaymentPromoBanner` (Home) — banner 100% configurado no GO360 (texto/cores/
    CTA/badge); cai no banner padrão quando não há promoção.
  - `PaymentManagement` — quando o método novo é o `metodoDestino` da promoção,
    a etapa de benefícios mostra os **benefícios do GO360** (com `beneficioId`);
    ao confirmar, dispara `paymentPromo.mudar` (auditoria), respeitando
    `permiteRecusar`. Sem promoção, mantém o fluxo/incentivos locais (fallback).

## Mapa de códigos (local → GO360)

| Local | GO360 |
|---|---|
| `boleto` | `boleto` |
| `pix` | `pix` |
| `credit_card` | `cartao_credito` |
| `debit_card` | `cartao_debito` |
| `recurring_card` | `cartao_recorrente` |

> ⚠️ Confirmar com o time GO360 se os códigos de cartão são exatamente
> `cartao_credito`/`cartao_debito`. Se diferirem, ajustar `TO_GO360`/`GO360_METHOD_MAP`.

## Erros (resumo)
`401/403` → chave inválida/sem scope (alertar time, não repetir em loop);
`404` → tratar como "não disponível"; `429` → backoff; `5xx` → backoff e
"serviço indisponível". O app é tolerante: sem chave/erro, cai no comportamento
padrão e nada quebra.
