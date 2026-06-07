# Integração do Rastreador (Fase 3)

O GO recebe **posição e telemetria reais** por um endpoint HTTP. A plataforma do
seu rastreador (ou um middleware/conversor de protocolo) envia os dados; o app
atualiza a posição no mapa e dispara os alertas (bateria, velocidade, cerca) e o
push — tudo automático, reaproveitando a mesma lógica do app.

## Como ligar

1. **Cadastre o nº de série/IMEI** do rastreador no veículo (campo `trackerSerial`).
   É por ele que a telemetria é associada ao equipamento certo.
2. **Defina `INGEST_API_KEY`** (uma chave secreta) nas variáveis do servidor.
3. Faça a plataforma do rastreador **enviar um POST** a cada atualização:

```
POST https://SEU-DOMINIO/api/ingest/telemetry
Header: x-api-key: SUA_INGEST_API_KEY
Content-Type: application/json

{
  "imei": "DEMO-0001",        // ou trackerSerial / serial / device_id
  "latitude": -23.561414,
  "longitude": -46.655881,
  "speed": 42,                 // km/h
  "heading": 270,              // graus
  "ignition": true,
  "batteryMain": 12.6,         // tensão (V) — também aceita "voltage"
  "batteryBackup": 4.1,
  "gpsSatellites": 9,
  "trackerMode": "active",     // active | sleep | deep_sleep | emergency
  "simStatus": "active"        // active | inactive | no_signal
}
```

Resposta: `{ "ok": true, "vehicleId": 123 }`.
Erros: `401` (chave inválida), `400` (sem serial ou dispositivo não cadastrado).

## Campos aceitos (com apelidos comuns)

| Campo no app | Aliases aceitos |
|---|---|
| trackerSerial | `imei`, `serial`, `device_id`, `deviceId` |
| latitude / longitude | `lat` / `lng`, `lon` |
| speed | — (km/h) |
| heading | `course` |
| batteryMain | `battery_main`, `voltage` |
| batteryBackup | `battery_backup` |
| gpsSatellites | `satellites` |
| ignition | aceita boolean ou `1/true/on/ligada/yes` |

Campos ausentes são ignorados (atualização parcial é suportada).

## O que acontece a cada ingestão
- Atualiza a posição/telemetria do veículo (aparece no mapa em tempo real)
- Registra ponto na rota (histórico/trajeto)
- Dispara alertas com deduplicação + push: **bateria baixa**, **velocidade
  acima do limite**, **entrada/saída de cerca eletrônica**

## Protocolos GPS (GT06, Suntech, Teltonika...)
O endpoint recebe **JSON**. Se o seu rastreador fala um protocolo binário/TCP
(ex.: GT06, Suntech), use um **middleware** (ex.: Traccar ou um pequeno serviço
conversor) que receba o protocolo do aparelho e faça o POST acima. Assim o GO
fica agnóstico ao hardware.

## Teste rápido (com o veículo demo)
O veículo demo usa `trackerSerial = "DEMO-0001"`:
```
curl -X POST https://SEU-DOMINIO/api/ingest/telemetry \
  -H "x-api-key: SUA_INGEST_API_KEY" -H "Content-Type: application/json" \
  -d '{"imei":"DEMO-0001","latitude":-23.55,"longitude":-46.63,"speed":95,"batteryMain":10.4}'
```
(velocidade 95 e bateria 10.4V devem disparar os alertas de velocidade e bateria).
