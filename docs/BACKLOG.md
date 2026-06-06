# Backlog priorizado — GO

Plano de ação derivado da [`AUDITORIA.md`](./AUDITORIA.md). Ordenado por
**impacto × esforço**. Norte: **fazer o usuário voltar todo dia** (CS/CX/UI/UX),
sem abrir mão de segurança e escalabilidade.

Legenda esforço: ⚡ baixo (≤1 sprint) · 🔧 médio (1–2) · 🏗️ alto (3+).

---

## 🚑 Sprint 0 — Correções críticas (fazer já)

Segurança e dados — risco real, esforço baixo:

1. **Anti-IDOR** em todas as procedures com `vehicleId`/`id` (helper `assertOwnsVehicle`). ⚡ **Crítico**
2. **Rate limit** nas mutations sensíveis (block, updateEquipamento, updatePerfil, create*, feedback). ⚡ **Crítico**
3. **Índices de DB** (userId/vehicleId em vehicles, geofences, notifications, trips, routeHistory, invoices). ⚡ **Crítico**
4. **Cron/probe sem credenciais em query** (POST body / só header). ⚡ **Alto**
5. **Criptografar `go360Token`** em repouso. 🔧 **Crítico**
6. **TRPCError** em vez de `Error()` (códigos corretos) + parar `catch(()=>{})` silencioso. ⚡ **Alto**
7. **Timeout + rate limit** no proxy `/api/ficha`. ⚡ **Alto**

A11y rápida (mesmo sprint):
8. Contraste dos textos secundários (subir de gray-400 → gray-500/600). ⚡
9. Alvos de toque ≥44px (dots, chips, dot "não lido"). ⚡
10. `aria-label` nos botões "voltar"; `<label htmlFor>` nos inputs. ⚡

---

## 🔁 Fase 1 (mês 1–2) — Fundação de RETENÇÃO

Objetivo: criar **motivos diários** de abrir o app.

1. **Push inteligente (reengajamento)** — além de alertas críticos: ⚡ **alto impacto**
   - "Seu carro está há 5 dias parado, tudo bem?"
   - "Você rodou 150 km esta semana 🎉"
   - "Revisão em 15 dias" / "Boleto vence amanhã"
   - (já temos infra de push + scheduler + cron; é template + regras)
2. **Resumo diário na Home** — card "Hoje: 45 km · vel. média 62 · 3 alertas" → tela `daily-summary`. 🔧
3. **Score de direção** — nota 0–100 (frenagens/acelerações/excessos) com tendência semanal; card com gauge. 🏗️ **(maior gancho de "abrir pra ver")**
4. **Onboarding ativador** — 3 passos pós-login: ativar push, contato de emergência, 1ª cerca (casa/trabalho). 🔧
5. **Empty states com CTA** e **estados de erro** nas telas que faltam. ⚡

## 📈 Fase 2 (mês 3–4) — Engajamento e hábito

6. **Widget de tela inicial (iOS/Android)** — localização + status sem abrir o app. 🏗️ **(maior alavanca de DAU)**
7. **Histórico de trajetos com análise** — heatmap das rotas, km do mês, vel. média, comparativo. 🔧
8. **Manutenção preventiva** — "Próxima revisão em 1.500 km", agendamento em oficina parceira (receita). 🔧
9. **Conquistas/badges + streak** — "Semana perfeita (0 alertas)", "500 km". 🔧
10. **Padronização UI** — tokens de cor/espaçamento; migrar modal de editar veículo para FullScreenModal. ⚡

## 🌐 Fase 3 (mês 5–6) — Comunidade e monetização

11. **Ranking de direção** (anônimo, por região) + compartilhável. 🏗️
12. **Assistente IA proativo** — sugere ações ("ultrapassou o limite 5× esta semana, quer ajuda?"). 🏗️
13. **"Novidades pra você"** — recomendações por plano/comportamento (upsell contextual). ⚡
14. **Cobrança real (ASAAS)** + **contrato (DocuSign)** no app. 🔧

---

## 🔒 Trilha contínua — Segurança & Escalabilidade
- Migrar scheduler para lock distribuído/queue (multi-instância). 🔧
- Cache de `getVehicleById`; rever `refetchInterval` (pausar em background). ⚡
- Sessão 1 ano → 90 dias + refresh. ⚡
- Paginação no sync GO360 e em listas grandes (notifications, histórico). 🔧
- Observabilidade: logs estruturados, alarme de erro, auditoria de acesso a token.

## ♿ Trilha contínua — Acessibilidade & Transparência
- Foco visível consistente; revisão WCAG AA de contraste.
- Legenda/tooltip dos status; "Última edição por você" na ficha.
- Preços de/por reais nos banners de oferta.

---

## Métricas para acompanhar (definição de sucesso)
- **DAU/MAU** (stickiness) — alvo principal.
- **Retenção D1/D7/D30**.
- **Push opt-in %** e **CTR de push**.
- **Sessões/usuário/semana** e **tempo até a 2ª sessão**.
- **% com contato de emergência / 1ª cerca configurada** (ativação).
- **Tickets de CS** (transparência reduz contato).
