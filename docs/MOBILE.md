# GO — Empacotamento Mobile (Capacitor) e Publicação nas Lojas

O app web foi preparado para virar **app nativo iOS e Android** via [Capacitor](https://capacitorjs.com/). Um único código → web + App Store + Google Play.

> ⚠️ Gerar e publicar os apps nativos exige um **Mac com Xcode** (para iOS) e o **Android Studio** (para Android). Estes passos rodam na **sua máquina**, não neste ambiente.

---

## O que já está configurado neste repositório

- `capacitor.config.ts` — `appId: com.godirection.app`, `appName: GO`, `webDir: dist/public`
- Plugins instalados: App, Geolocation, Push Notifications, Share, Haptics, Status Bar, Splash Screen
- `client/src/lib/native.ts` — inicializa status bar e esconde splash no app nativo
- `client/src/lib/apiBase.ts` — a URL da API é configurável (essencial no app nativo)
- Ícones/splash da marca em `resources/` + ícones PWA em `client/public/icons/`
- `manifest.webmanifest` (PWA instalável pelo navegador)
- Scripts no `package.json`: `icons`, `build:client`, `cap:sync`, `cap:assets`, `cap:ios`, `cap:android`

---

## Passo a passo (na sua máquina)

### 1. Apontar o app nativo para o backend de produção
O app nativo não usa URL relativa — ele precisa saber onde está sua API. Crie um `.env` com:

```
VITE_API_URL=https://api.seu-dominio.com
```

> O backend de produção precisa habilitar **CORS** para a origem do app e enviar o cookie de sessão (`SameSite=None; Secure`). Em apps nativos pode ser necessário usar tokens em header em vez de cookie — avaliar na Fase de produção.

### 2. Gerar os projetos nativos (uma única vez)
```bash
pnpm install
pnpm build:client
npx cap add ios
npx cap add android
```

### 3. Gerar ícones e splash nativos a partir da marca
```bash
pnpm icons          # regenera os PNGs a partir do SVG (já versionados)
pnpm cap:assets     # gera ícones/splash dentro de ios/ e android/
```

### 4. Rodar / abrir no IDE
```bash
pnpm cap:sync       # build do web + copia para os projetos nativos
pnpm cap:ios        # abre no Xcode
pnpm cap:android    # abre no Android Studio
```

Sempre que mudar o app web: `pnpm cap:sync`.

---

## Permissões nativas (já previstas pelo produto)

| Recurso | iOS (Info.plist) | Android (AndroidManifest) |
|---|---|---|
| Localização | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` |
| Notificações push | APNs (capability) | `POST_NOTIFICATIONS` + FCM |

Push: iOS usa **APNs** (precisa de chave no Apple Developer), Android usa **Firebase Cloud Messaging** (arquivo `google-services.json`).

---

## Checklist de publicação

### Apple App Store
- [ ] Conta Apple Developer (US$ 99/ano)
- [ ] Bundle ID `com.godirection.app` registrado
- [ ] Ícone 1024×1024, capturas de tela, descrição
- [ ] Política de Privacidade (URL) + seção **App Privacy** preenchida
- [ ] Tela de **exclusão de conta** no app — ✅ já implementada (Perfil → "Excluir minha conta")
- [ ] Justificativa de uso de localização clara
- [ ] Build enviado via Xcode / Transporter

### Google Play
- [ ] Conta Google Play Developer (US$ 25, pagamento único)
- [ ] `.aab` assinado
- [ ] Política de Privacidade (URL) + seção **Data Safety**
- [ ] Declaração de permissão de localização em segundo plano (se usada)
- [ ] Exclusão de conta — ✅ já implementada

### LGPD (Brasil)
- [ ] Termo de Uso e Política de Privacidade publicados
- [ ] Consentimento de localização
- [ ] Exclusão de conta e dados — ✅ implementada

---

## Pendências que dependem de você
1. **Backend hospedado** + `VITE_API_URL` apontando para ele
2. **Contas** Apple Developer e Google Play
3. **APNs** (iOS) e **FCM/google-services.json** (Android) para push
4. **URLs** de Política de Privacidade e Termos de Uso
