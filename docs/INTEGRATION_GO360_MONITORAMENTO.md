# Integração — Status oficial do rastreador (GO360)

A **régua de status** (online / standby / offline / manutenção) é mantida pela
**GO360**. O app **não duplica** essa lógica: consome o status oficial. Quando a
GO360 muda a régua no admin (ex.: offline de 72h → 96h), o app reflete no próximo
refresh — **sem deploy dos dois lados**.

## Endpoint (GO360, público)

```
GET {host}/api/public/monitoramento/rastreador/:identificador
```

- `identificador` aceita **IMEI, série, placa ou chassi**
- `Cache-Control: public, max-age=60`
- `404` quando não encontra

### Resposta (200)

```json
{
  "encontrado": true,
  "item": {
    "ativoId": "uuid",
    "status": "standby_atualizado",
    "rotulo": { "label": "Standby", "cor": "#d97706", "descricao": "..." },
    "horasSemComunicar": 30,
    "ultimaComunicacao": "2026-06-06T12:00:00Z",
    "placa": "...", "chassi": "...", "imei": "...", "serie": "...",
    "veiculo": "...", "cliente": "..."
  }
}
```

Estados: `online_tempo_real`, `online_atualizado`, `standby_atualizado`,
`offline_desatualizado`, `manutencao_urgente`, `sem_dado`.

## Como o app consome

- **Server** (`server/integrations/monitoramento.ts`): proxy com cache de 60s em
  memória, URL derivada do host do GO360 (override `MONITORAMENTO_BASE_URL`).
- **tRPC** (`monitoring.status({ vehicleId })`): protegido e **gated por dono do
  veículo** (anti-IDOR) — não é proxy aberto. Usa `trackerSerial` (IMEI/série) →
  `placa` → `chassi` como identificador.
- **Cliente**: a página de detalhes do veículo (`/vehicle/:id`) mostra o status
  oficial (`rotulo.label/cor/descricao` + `horasSemComunicar`) com selo
  "via GO360"; **fallback** para a régua local por tempo (`getTrackerStatus`)
  quando o endpoint está indisponível, marcando o status como "estimado".

> As listas (Home/Equipamentos) seguem usando a régua local instantânea para não
> gerar N+1 de requisições; como ambas são baseadas em tempo, ficam consistentes.

## Config

```
# Opcional — por padrão deriva do host do GO360.
MONITORAMENTO_BASE_URL=https://go360.com.br
```
