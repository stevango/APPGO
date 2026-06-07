# Integração — Roleta da Sorte (GO360)

As **regras** (prêmios, pesos, estoque, limites, cooldown, vigência, gatilho)
ficam no **GO360** (admin de marketing/CS). A **roleta só roda no app**. O
sorteio é **server-side no GO360** (ponderado) — o app envia só os pesos para
desenhar as fatias e anima até o prêmio retornado.

## Como o app consome (proxy seguro)

Os endpoints do GO360 (`{GO360_BASE_URL}/roletas`) exigem o **JWT do cliente**.
Nós **não expomos** esse token ao front: as chamadas passam pelo nosso backend
(tRPC) usando o token guardado/descriptografado por usuário.

- **Server**: `server/integrations/roletas.ts` (4 endpoints) + router tRPC
  `roletas` (`disponiveis`, `elegibilidade`, `girar`, `resgatar`).
  `girar` tem rate-limit (10/min/usuário) e converte erros de regra do GO360
  (400) em mensagem amigável.
- **Cliente**:
  - `RoletaModal` — a roda (SVG, fatias proporcionais ao `peso`), botão girar,
    animação até o prêmio, tela de resultado com `mensagemPos` e "Resgatar".
  - `RoletaTrigger` — banner discreto que aparece **só se houver roleta
    disponível** para um gatilho; toca → abre a `RoletaModal`.

## Gatilhos e onde estão ligados

| Gatilho | Onde dispara no app | Status |
|---|---|---|
| `acesso_app` | Banner na Home | ✅ ligado |
| `trocou_pagamento` | Banner na tela de Pagamento | ✅ ligado |
| `intencao_excluir_conta` | Fluxo de retenção (excluir conta) no Perfil | ✅ ligado |
| `intencao_cancelar_contrato` | Tela de Contrato (cancelamento) | ⏳ drop-in `<RoletaTrigger trigger="intencao_cancelar_contrato" />` |
| `manual` | Tela específica acionada pelo cliente | ⏳ drop-in |

Para ligar os pendentes, basta colocar `<RoletaTrigger trigger="..." />` na tela
desejada (opcionalmente com `contexto` para auditoria, ex.:
`contexto={{ trocouPara: "cartao" }}`).

## Fluxo

1. `roletas.disponiveis({ trigger })` → lista (filtrada por elegibilidade no GO360).
2. Cliente gira → `roletas.girar({ roletaId, contexto })` → `{ giro, premio }`
   (servidor sorteia, baixa estoque, registra auditoria).
3. App anima até `premio.id` e mostra `mensagemPos`.
4. Ao usar o prêmio → `roletas.resgatar({ giroId })` (marca `resgatado_em`).

> "Tente novamente" é um prêmio válido (peso alto) — tratado como qualquer outro.
> O resultado é sempre do servidor; o app nunca decide o prêmio.
