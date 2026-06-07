# Integração GO360 — Telemetria (destrava score, km e alertas ricos)

O app já recebe **posição/última comunicação** e mostra status, mapa, distância
e manutenção. Para destravar **Score de direção**, **resumo de km** e **alertas
de comportamento** (frenagem/aceleração/excesso), precisamos que a GO360 envie a
**telemetria do rastreador** — em tempo quase real (push) ou em lote.

Já temos o endpoint pronto do nosso lado:

```
POST https://appgo-production.up.railway.app/api/ingest/telemetry
Header: x-api-key: <INGEST_API_KEY>
Content-Type: application/json
```

## 1) Telemetria de posição/estado (a cada comunicação)
Um POST por leitura do rastreador. Campos (aceitamos snake/camel e apelidos):

```jsonc
{
  "trackerSerial": "862520060920794",   // ou imei / id_tracker (obrigatório)
  "latitude": -22.84, "longitude": -43.34,
  "speed": 62,                           // km/h
  "heading": 145,                        // graus
  "ignition": true,
  "batteryMain": 13.8,                   // V (bateria do veículo)
  "batteryBackup": 4.1,                  // V (bateria do rastreador)
  "gpsSatellites": 9, "gpsSignal": 80,
  "odometer": 153420.5,                  // km (hodômetro acumulado) — habilita km real
  "trackerMode": "active",               // active|sleep|deep_sleep|emergency
  "eventAt": "2026-06-06T14:23:00Z"      // momento da leitura
}
```
→ Isso mantém o mapa em tempo real, alimenta o **histórico/trajetos** e o **km**.

## 2) Eventos de comportamento (o que falta para o SCORE)
O score de direção precisa de **eventos** detectados pelo rastreador/telemetria.
Enviar um POST por evento (mesmo endpoint, com `event`):

```jsonc
{
  "trackerSerial": "862520060920794",
  "event": "frenagem_brusca",   // harsh_braking
  "latitude": -22.84, "longitude": -43.34,
  "speed": 70, "severity": "media",   // leve|media|alta
  "eventAt": "2026-06-06T14:25:10Z"
}
```
Tipos de evento desejados:
- `frenagem_brusca` (harsh_braking)
- `aceleracao_brusca` (harsh_acceleration)
- `curva_brusca` (harsh_cornering) — opcional
- `excesso_velocidade` (overspeed) — se a plataforma já detecta
- `ignicao_ligada` / `ignicao_desligada`

> Se a plataforma de vocês **não detecta** esses eventos, conseguimos derivar
> uma versão simples no nosso lado a partir do fluxo de `speed` (variação brusca)
> — mas o ideal é virem prontos, mais precisos.

## 3) Hodômetro / km
Se vier `odometer` (km acumulado) nas leituras, calculamos km/dia e km/semana
com precisão. Sem ele, estimamos pela distância entre posições (menos preciso).

## Resumo do que pedimos à GO360
1. **POST de telemetria** por leitura (posição + estado + idealmente `odometer`).
2. **POST de eventos** de comportamento (frenagem/aceleração/excesso).
3. Autenticação por `x-api-key` (nós fornecemos a `INGEST_API_KEY`).

Com (1) e (2) ligados, ativamos no app: **Score de direção**, **resumo diário/
semanal de km**, **conquistas/streak** e **alertas de comportamento** — os
recursos que mais aumentam o uso recorrente.
