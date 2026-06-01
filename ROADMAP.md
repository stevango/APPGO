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

### Fase 2 — Desacoplar serviços da Manus
Hoje ainda dependem da Manus (em `server/_core`): LLM, mapa/geocodificação, storage (S3), notificações e o runtime do Vite.
- Mapa/geocodificação reversa → Google Maps Geocoding API direta (chave própria) ou Mapbox
- Storage → bucket S3 próprio (o código já usa `@aws-sdk/client-s3`)
- Notificações → manter Web Push (VAPID, já implementado) como canal principal
- LLM/assistente (AIChatBox) → opcional; ligar a um provedor próprio ou desativar na v1
- Remover `vite-plugin-manus-runtime` e dependências `__manus__`

### Fase 3 — Integração do rastreador (coração do produto)
- Definir a API/protocolo do rastreador do cliente (REST da plataforma, ou protocolo GPS tipo GT06/Suntech via Traccar)
- Criar camada de ingestão: endpoint/worker que recebe posição+telemetria e chama `updateTelemetry`
- Mapear campos reais → schema (velocidade, bateria 12V/backup, GPS, ignição, odômetro)
- Substituir dados simulados por dados reais; manter modo demo para testes

### Fase 4 — Empacotamento Capacitor (iOS + Android)
- Adicionar Capacitor, gerar projetos `ios/` e `android/`
- Plugins nativos: Geolocation, Push Notifications (FCM/APNs), App, Share, Haptics
- Ícones e splash a partir da marca GO (#243FF7, #E2FF04)
- `capacitor.config` apontando para o backend de produção
- Permissões nativas (localização, notificações) com textos de justificativa

### Fase 5 — Loja & conformidade
- Apple: conta Developer (US$99/ano), Sign in with Apple se houver login social, política de privacidade, App Privacy
- Google Play: conta Developer (US$25 único), Data Safety, política de privacidade
- LGPD: termo de uso, política de privacidade, consentimento de localização, exclusão de conta (exigência das lojas)
- Telas obrigatórias: exclusão de conta, exclusão de dados

### Fase 6 — Produção & escala
- Hospedagem do backend (Node) + MySQL gerenciado (PlanetScale/RDS/Railway)
- HTTPS, segredos via variáveis de ambiente, rate limiting no login
- Observabilidade (logs/erros), backup do banco
- Code-splitting do bundle (hoje o JS principal tem ~744KB) para acelerar o carregamento

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

# Mapa (Fase 2)
GOOGLE_MAPS_API_KEY=...

# Storage S3 próprio (Fase 2) — se usado
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
