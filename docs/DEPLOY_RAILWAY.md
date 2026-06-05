# Deploy do GO na Railway

Guia para colocar o **backend + banco MySQL** no ar na [Railway](https://railway.app). O mesmo serviço serve a API (`/api/trpc`) e o app web (client). O app nativo (iOS/Android) também aponta para esta URL.

> O repositório já vem pronto para a Railway: `railway.json` cuida do build, da migração do banco e do start automaticamente.

---

## Como o deploy funciona (automático, via `railway.json`)

1. **Build:** `pnpm build` → gera o servidor (`dist/index.js`) e o client (`dist/public`)
2. **Pré-deploy:** `pnpm db:deploy` → sincroniza as tabelas no MySQL (`drizzle-kit push`)
3. **Start:** `pnpm start` → sobe o servidor na porta que a Railway define (`PORT`)

---

## Passo a passo

### 1. Criar o projeto
1. Acesse [railway.app](https://railway.app) e faça login com o GitHub
2. **New Project → Deploy from GitHub repo → `stevango/appgo`**
3. Selecione a branch que vamos publicar

### 2. Adicionar o banco MySQL
1. No projeto: **+ New → Database → Add MySQL**
2. A Railway cria o serviço **MySQL** com as credenciais prontas

### 3. Configurar as variáveis de ambiente
No serviço do **app** (não no MySQL), aba **Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` *(referência ao serviço MySQL)* |
| `JWT_SECRET` | uma string longa e aleatória (ex.: `openssl rand -hex 32`) |
| `VITE_APP_ID` | `go-app` |
| `NODE_ENV` | `production` |
| `VITE_VAPID_PUBLIC_KEY` | (ver passo 4) |
| `VAPID_PRIVATE_KEY` | (ver passo 4) |
| `OWNER_WEBHOOK_URL` | *(opcional)* webhook de alertas da central |

> 🗺️ **Mapas:** o app usa **OpenStreetMap** (Leaflet) + **Nominatim** — não precisa de chave de API nem configuração. Funciona out-of-the-box.

> ⚠️ **Importante:** variáveis que começam com `VITE_` são embutidas **no momento do build**. Defina-as **antes** do deploy. Se mudar uma `VITE_*` depois, é preciso **redeployar** (Deploy → Redeploy).

> Se o serviço do banco tiver outro nome, ajuste a referência (ex.: `${{MySQL-XYZ.MYSQL_URL}}`).

### 4. Gerar as chaves de Push (VAPID)
Na sua máquina:
```bash
npx web-push generate-vapid-keys
```
Copie a **Public Key** para `VITE_VAPID_PUBLIC_KEY` e a **Private Key** para `VAPID_PRIVATE_KEY`.

### 5. Publicar e gerar o domínio
1. A Railway faz o primeiro deploy automaticamente (build → migração → start)
2. No serviço do app: **Settings → Networking → Generate Domain**
3. Você recebe uma URL tipo `https://goapp-production.up.railway.app`

### 6. Apontar o app nativo para o backend
Para os apps iOS/Android (Capacitor), defina **antes de gerar os builds nativos**:
```
VITE_API_URL=https://goapp-production.up.railway.app
```
(pode ser uma variável local no `.env` da sua máquina ao rodar `pnpm cap:sync`).

### 7. Domínio próprio (opcional)
**Settings → Networking → Custom Domain** → aponte seu domínio (ex.: `app.suaempresa.com.br`) e configure o CNAME indicado.

---

## Verificação pós-deploy
- Acesse a URL gerada → deve abrir a tela de login do GO
- Crie uma conta (e-mail/senha) → confirma que o banco está conectado
- **Deploy logs** mostram `Server running on ...` e a migração aplicada

---

## Lembretes automáticos (já vêm ligados)

Em produção o app roda um **agendador interno** que dispara, sozinho, a cada 6h:
- **Lembrete de cobrança** (fatura em aberto)
- **Alerta de manutenção** (rastreador sem posicionar)

Não é preciso configurar nada no Railway — basta o serviço estar no ar. Ambos
são deduplicados (cobrança e manutenção ~1x/dia por cliente/veículo),
então rodar a cada 6h nunca gera spam. Para desligar: `SCHEDULER_DISABLED=1`.

### Disparo manual / agendador externo (opcional)
Os endpoints HTTP continuam disponíveis (protegidos por `CRON_SECRET`) caso queira
disparar na hora ou usar um Cron Job externo:
```
GET https://SEU-DOMINIO/api/cron/billing-reminders?token=SEU_CRON_SECRET
```
Responde `{ sent, skipped, total }`.

## Alerta de manutenção (rastreador sem posicionar)

Já roda automático pelo agendador interno (acima). Para disparar na hora,
reaproveite a mesma `CRON_SECRET`:
```
GET https://SEU-DOMINIO/api/cron/maintenance-reminders?token=SEU_CRON_SECRET
```
Avisa veículos com mais de **3 dias** sem posição (ajustável com `&days=N`).
O alerta no app é atualizado **todo dia** (1 card por veículo, contagem subindo:
49, 50, 51...); o **push** vai só na 1ª vez e depois **semanalmente** (sem fadiga).
Responde `{ sent, pushed, skipped, total }`.

## Custos (estimativa)
- Plano **Hobby** da Railway (US$ 5/mês de crédito incluído) costuma cobrir app + MySQL para começar
- Escala conforme uso (CPU/RAM/banco)

## Dicas de produção
- **Backups do MySQL:** ative no serviço do banco
- **Rate limiting no login:** recomendado antes de abrir ao público (posso implementar)
- **Observabilidade:** os logs ficam na aba Deployments; dá para integrar Sentry depois
