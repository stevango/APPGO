# GO — Roadmap até as Lojas (App Store + Google Play)

App de rastreamento e segurança veicular. Stack: React 19 + Tailwind 4 + tRPC 11 + Drizzle/MySQL, mobile-first.

## Decisões estratégicas (definidas com o cliente)

| Tema | Decisão |
|------|---------|
| Empacotamento p/ lojas | **Capacitor** — um código → web + iOS + Android |
| Infraestrutura | **Própria** — banco, auth e APIs sob seu controle (sem lock-in Manus) |
| Login do cliente | **E-mail + senha** (próprio do app) |
| Dados do veículo | **Integração com API do rastreador** (hardware/plataforma do cliente) |

---

## Fases

### ✅ Fase 1 — Autenticação própria (CONCLUÍDA)
Substituído o login OAuth da Manus por **e-mail + senha** próprio, reaproveitando a sessão JWT (HS256) que já existia.
- `drizzle/schema.ts`: coluna `passwordHash` na tabela `users`
- `server/auth.ts`: hash/verificação bcrypt (12 rounds) + emissão de cookie de sessão
- `server/routers.ts`: procedures `auth.register` e `auth.login` (validação Zod, e-mail único, erros claros)
- `server/db.ts`: `getUserByEmail`, `createUserWithPassword`, `setUserPassword`
- `client/src/pages/Onboarding.tsx`: tela de Entrar/Criar conta com identidade GO, mostrar/ocultar senha, loading e erros
- Testes: `server/auth.password.test.ts`
- **Pendência operacional:** rodar `pnpm db:push` no seu banco MySQL para criar a coluna `passwordHash`.

### 🟢 Fase 2 — Desacoplar serviços da Manus — EM ANDAMENTO
- ✅ **Mapa/geocodificação**: `server/_core/map.ts` agora usa Google Maps direto com `GOOGLE_MAPS_API_KEY` (proxy Manus só como fallback)
- ✅ **Mapa no frontend**: `Map.tsx` carrega o Google Maps com `VITE_GOOGLE_MAPS_API_KEY` próprio
- ✅ **Notificações da central**: `notifyOwner` envia para `OWNER_WEBHOOK_URL` (Slack/e-mail/seu sistema), sem derrubar o app quando ausente
- ✅ **Runtime da Manus removido**: tirado `vite-plugin-manus-runtime` — `index.html` caiu de ~368KB para ~1.4KB
- ✅ **Web Push (VAPID)** já é próprio e segue como canal principal de push
- ⏳ Storage S3 → apontar para bucket próprio (código já usa `@aws-sdk/client-s3`; falta `.env`)
- ⏳ LLM/assistente (AIChatBox) → ligar a provedor próprio ou desativar na v1
- ⏳ Auth OAuth Manus (`server/_core/oauth.ts`) → já substituído pelo login e-mail/senha; rota OAuth pode ser removida

### Fase 3 — Integração do rastreador (coração do produto)
- Definir a API/protocolo do rastreador do cliente (REST da plataforma, ou protocolo GPS tipo GT06/Suntech via Traccar)
- Criar camada de ingestão: endpoint/worker que recebe posição+telemetria e chama `updateTelemetry`
- Mapear campos reais → schema (velocidade, bateria 12V/backup, GPS, ignição, odômetro)
- Substituir dados simulados por dados reais; manter modo demo para testes

### 🟡 Fase 4 — Empacotamento Capacitor (iOS + Android) — EM ANDAMENTO
Base configurada neste repositório (ver `docs/MOBILE.md`):
- ✅ Capacitor instalado + `capacitor.config.ts` (`com.godirection.app`, webDir `dist/public`)
- ✅ Plugins: App, Geolocation, Push Notifications, Share, Haptics, Status Bar, Splash Screen
- ✅ Ícones/splash da marca GO gerados (`resources/`, `client/public/icons/`) + manifest PWA
- ✅ URL da API configurável (`VITE_API_URL`) para o app nativo + init nativo (`client/src/lib/native.ts`)
- ✅ Scripts `cap:sync`, `cap:assets`, `cap:ios`, `cap:android`
- ⏳ Falta (na sua máquina, exige Xcode/Android Studio): `npx cap add ios/android`, APNs/FCM, build e envio

### Fase 5 — Loja & conformidade
- Apple: conta Developer (US$99/ano), Sign in with Apple se houver login social, política de privacidade, App Privacy
- Google Play: conta Developer (US$25 único), Data Safety, política de privacidade
- LGPD: termo de uso, política de privacidade, consentimento de localização
- ✅ Exclusão de conta e dados implementada (Perfil → "Excluir minha conta" + `account.deleteAccount`)
- Falta: publicar URLs de Política de Privacidade e Termos de Uso

### 🟢 Fase 6 — Produção & escala (Railway) — CONFIGURADA
- ✅ Deploy na **Railway** pronto: `railway.json` (build → migração `db:deploy` → start), `.nvmrc`, `engines.node>=22`
- ✅ Porta determinística em produção; HTTPS automático da Railway (cookies seguros funcionam)
- ✅ Guia completo em `docs/DEPLOY_RAILWAY.md` (projeto, MySQL, variáveis, domínio)
- ✅ **Rate limiting** no login/cadastro (proteção contra força bruta, por IP+e-mail)
- ✅ **Code-splitting**: páginas carregam sob demanda (bundle inicial 755KB → ~332KB core)
- ⏳ Observabilidade (Sentry) e backup do MySQL

---

## Variáveis de ambiente (infra própria)

Defina um `.env` (NÃO commitar):

```
DATABASE_URL=mysql://user:pass@host:3306/goapp   # seu MySQL
JWT_SECRET=<string longa e aleatória>             # assina a sessão
VITE_APP_ID=go-app                                # identificador do app

# Web Push (gere com: npx web-push generate-vapid-keys)
VITE_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Mapa — Google Maps próprio
GOOGLE_MAPS_API_KEY=...            # backend (geocodificação)
VITE_GOOGLE_MAPS_API_KEY=...       # frontend (mapa no navegador/app)
VITE_GOOGLE_MAPS_MAP_ID=...        # opcional (mapId p/ marcadores avançados)

# Alertas da central (opcional) — webhook próprio (Slack/e-mail/seu sistema)
OWNER_WEBHOOK_URL=https://...

# App nativo (Capacitor) — URL do backend de produção
VITE_API_URL=https://api.seu-dominio.com

# Storage S3 próprio (se usado)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

As variáveis `OAUTH_SERVER_URL`, `BUILT_IN_FORGE_API_*` e afins eram da Manus e deixam de ser necessárias conforme a Fase 2 avança.

---

## Como rodar localmente

```
pnpm install
pnpm db:push      # cria as tabelas no DATABASE_URL configurado
pnpm dev          # http://localhost:3000
pnpm test         # testes
pnpm check        # typecheck
```
