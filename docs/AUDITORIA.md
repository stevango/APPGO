# Auditoria GO — pente fino (2026-06)

Diagnóstico do app inteiro: segurança, corretude, UX/CX/UI, acessibilidade,
transparência e escalabilidade. Achados com **arquivo:linha** (aproximados —
confirmar no fix) e **severidade**. O plano de ação priorizado está em
[`BACKLOG.md`](./BACKLOG.md).

> **Tese central (retenção):** hoje o app é **transacional** ("abre, vê o carro,
> fecha"). Não há nada que crie **hábito**. O maior risco do produto não é um bug
> — é o usuário instalar e não voltar. A prioridade nº 1 é dar **motivos diários**
> de uso (ver `BACKLOG.md › Retenção`).

---

## 1. Segurança — CRÍTICO

### 1.1 IDOR (acesso a recurso de outro usuário)
Procedures `protectedProcedure` que recebem `vehicleId`/`id` e **não validam** que
o recurso pertence a `ctx.user.id`:

| Sev | Local | Procedure |
|---|---|---|
| Crítico | routers.ts (vehicles.get) | retorna qualquer veículo por id |
| Crítico | vehicles.setSpeedLimit | altera limite de veículo alheio |
| Crítico | vehicles.updatePosition / updateTelemetry | injeta telemetria em veículo alheio |
| Crítico | routeHistory.list, trips.list/get/getRoutePoints | lê trajetos alheios |
| Crítico | geofences.delete | apaga cerca alheia (db.deleteGeofence não checa userId) |
| Crítico | notifications.markRead | marca notificação alheia |
| Alto | alerts.lastAck | lê ciência por vehicleId sem checar dono (acknowledge já checa — padronizar) |

**Correção padrão:** `const v = await db.getVehicleById(id); if (!v || v.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });` (e helpers `getGeofenceById`/`getNotificationById` para os demais). Idealmente criar um helper `assertOwnsVehicle(ctx, id)`.

### 1.2 Segredos em texto puro
- **Crítico** `drizzle/schema.ts` `go360Token: text()` — token GO360 de **todos** os clientes em texto puro. Quem tiver acesso ao banco assume todas as contas GO360. → Criptografar em repouso (AES‑256 com chave em env), restringir, e logar acesso.

### 1.3 Endpoints Express
- **Alto** `/api/cron/go360-probe` aceita `email`/`senha` em **query string** → credenciais vazam em logs. Mudar para POST body (ou remover do produto).
- **Alto** `/api/cron/*` e `/api/ingest/telemetry` aceitam token em query **ou** header → forçar só header `x-api-key`/`x-cron-secret`.
- **Médio** `/api/ficha/:vehicleId` (proxy): já valida dono + `https`. Falta **timeout** no `fetch`, **rate limit** e sanitizar mensagem de erro.

---

## 2. Segurança — ALTO

### 2.1 Rate limiting
Hoje só `auth.login`/`register` têm limite. **~48 mutations sem limite.** Aplicar
`enforceRateLimit` (já existe em `server/rateLimit.ts`) nas sensíveis:
- `vehicles.block` (comando crítico!) — ex. 3/h
- `go360.updateEquipamento`, `go360.updatePerfil` — 5–10/dia
- `vehicles.create`, `geofences.create`, `sharing.create` — limitar criação
- `feedback.submit`, `alerts.acknowledge/dismiss`, `emergencyContacts.sendAlert`

### 2.2 Validação de entrada (zod)
- `updatePosition`/`geofences.create`: `latitude/longitude` são `z.string()` sem formato → validar regex/`z.number()` com range.
- `updateTelemetry`: `speed/heading/gpsSatellites/simSignal` sem range → `min/max`.
- `setIconType`: `z.string()` → `z.enum([...])`.
- vários `z.string()` sem `.max()` → limitar tamanho.

### 2.3 Erros e códigos
- `sharing.create`, `vehicles.block`, `emergencyContacts.sendAlert` lançam `new Error()` → cliente recebe **500** em vez de 400/403. Usar `TRPCError`.
- `catch(() => {})` silenciosos (feedback notify, retention.logEvent) → logar.

---

## 3. Escalabilidade / Banco — CRÍTICO/ALTO

- **Crítico:** faltam **índices** em FKs muito consultadas: `vehicles.userId`,
  `geofences.userId/vehicleId`, `notifications.userId`, `trips.vehicleId`,
  `routeHistory.vehicleId`, `invoices.userId`, `notificationLog.userId`.
  → criar migração com índices (full table scan hoje).
- **Alto:** `scheduler.ts` roda **in-process** — com mais de 1 instância, lembretes
  duplicam. → lock distribuído (Redis) ou job queue; ou garantir 1 worker.
- **Alto:** `getVehicleById` é chamado por muitas procedures sem cache.
- **Médio:** `syncGo360Equipment` sem paginação (cliente com muitos veículos).
- **Médio:** sessão dura **1 ano** (`ONE_YEAR_MS`) → reduzir + refresh.
- **Cliente:** `refetchInterval` agressivo (Home 15s, Tracking 10s) — rever/parar quando aba em background.

---

## 4. UX / CX / UI

- **Modal "Editar veículo"** (VehicleDetails) ainda usa portal próprio → padronizar no `FullScreenModal`.
- **Estados de erro ausentes** em queries principais (Geofences, TripHistory, Tracking) → falham em silêncio.
- **Estados vazios fracos** (Equipamentos vazio, Cercas sem empty state) → adicionar CTA ("Adicionar veículo", "Criar primeira cerca").
- **Inconsistências** de espaçamento/cor (p-4 vs p-5; gradientes -r vs -br) → tokens.
- **Onboarding** sem tour pós-login nem "primeiro passo" (push, contato de emergência, primeira cerca).
- **Descoberta de recursos:** Perfil é lista longa sem agrupamento; Ações rápidas não priorizam por uso.
- **Feedback de ação:** bloqueio/SOS sem confirmação contextual ("HB20 bloqueado às 14:23") nem "Desfazer".

---

## 5. Acessibilidade (A11y)

- **Contraste:** muito `text-gray-400/500` em fundo branco reprova WCAG AA (Home, Notifications, AlertsHistory) → escurecer secundários.
- **Alvos de toque <44px:** dots do carrossel (~6px), dot "não lido" (8px), chips "Todos/Rota".
- **`aria-label` faltando** em botões "voltar" (Tracking, Notifications, SOS, Geofences).
- **Inputs sem `<label htmlFor>`** (feedback textarea; modal de edição).
- **Foco visível** inconsistente (sem ring claro em botões).
- **`<img>`** já têm `alt`, mas genérico — ok.

---

## 6. Transparência da informação

Já melhoramos (status por tempo, "valores da última comunicação", staleness).
Falta:
- Explicar o que significa cada status (tooltip/legenda: "Online = comunicou nas últimas 24h").
- Tornar o "Desatualizado/Standby" mais evidente (hoje âmbar sutil).
- Preços/planos vagos ("Economize 15%") → mostrar de/por em R$ e plano atual vs ofertado.
- "Última edição em DD/MM • por você" na ficha (GO360 expõe `editado_em`).

---

## 7. O que falta implementar (lacunas funcionais)
- Edição real grava no GO360 ✅ (feito) — falta refletir `editado_em` no app.
- Ficha técnica nativa ✅ (aguarda JSON da GO360).
- **Retenção:** resumo diário, score de direção, manutenção preventiva, widget, push de engajamento (ver `BACKLOG.md`).
- **Cobrança real (ASAAS)** e **contrato (DocuSign)** no app — estruturas conhecidas, aguardando cliente com dados.
- **Ignorar fatura demo** para clientes GO360 (resíduo de demonstração) — pendência conhecida.

---

### Como foi feito
Varredura por dois agentes de leitura (segurança/back-end e UX/a11y/retenção) +
revisão. Os números de linha podem ter pequena defasagem; confirmar no momento do
fix. Total: ~48 achados de segurança/corretude + achados de UX/A11y.
