# Plano — Widget de tela inicial (iOS/Android)

Widget é a **maior alavanca de DAU**: o usuário vê status/localização sem abrir o
app. Não dá para fazer só com o app web — exige código **nativo** em cada
plataforma. Como o app é Capacitor, o caminho:

## Arquitetura
1. **Endpoint leve** no backend para o widget (sem abrir o app):
   `GET /api/widget/summary` (autenticado por token de widget) → `{ plate, status,
   lastAddress, lastSignalAt, lat, lng }` do equipamento principal.
2. **Token de widget**: gerar um token de longa duração por dispositivo (no login)
   e guardar no App Group / SharedPreferences para o widget ler.
3. **iOS — WidgetKit (SwiftUI)**: extensão de widget que busca o endpoint a cada
   ~15–30 min (TimelineProvider) e mostra status + mini-mapa estático.
4. **Android — Glance/AppWidget (Kotlin)**: AppWidgetProvider com update periódico
   (WorkManager) consumindo o mesmo endpoint.
5. Compartilhamento de dados app↔widget via **App Group (iOS)** /
   **SharedPreferences (Android)**.

## Escopo do MVP
- 1 widget pequeno: nome do veículo + **status** (Online/Standby/Offline) +
  "atualizado há X".
- 1 widget médio: + mini-mapa estático (tile do OSM por lat/lng) + endereço.
- Toque abre o app na tela Rastrear do veículo (deep link `go://vehicle/:id`).

## Esforço
- Backend endpoint + token: ~1 sprint (dá pra adiantar já).
- iOS WidgetKit: ~1–1,5 sprint (precisa Xcode/conta Apple).
- Android Glance: ~1 sprint.

## O que já podemos adiantar no código (sem nativo)
- `GET /api/widget/summary` + emissão do token de widget no login.
- Deep links `go://vehicle/:id` no app.

Quando autorizar, começo pelo **endpoint + token + deep links** (parte web/back),
e a parte nativa entra no projeto Capacitor (iOS/Android) com Xcode/Android Studio.
