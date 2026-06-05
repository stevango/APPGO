# Integração GO360 — foto do veículo no app

O app GO mostra o **render/foto do veículo** no card principal (estilo app de
montadora). A forma mais simples e sem custo de trazer a imagem certa é a GO360
**enviar o link da foto** na resposta do equipamento. O app importa
automaticamente, sem nenhuma mudança do nosso lado.

## O que precisa ser feito (lado GO360)

No endpoint **`GET /api/app/equipamento`**, para cada item de `veiculos`,
incluir um campo com a **URL pública (https) da foto** do veículo.

Aceitamos qualquer um destes nomes de campo (use o que for mais natural):

```
imagem | foto | url_imagem | imagemUrl | foto_url | fotoUrl |
image | image_url | imageUrl | thumbnail | thumb
```

Exemplo de resposta:

```jsonc
{
  "veiculos": [
    {
      "placa": "QOP2H92",
      "marca": "Nissan",
      "modelo": "VERSA 1.0 12V FlexStar",
      "ano_modelo": 2020,
      "imagem": "https://cdn.go360.com.br/veiculos/qop2h92.png",  // 👈 só isso
      "equipamento": { "imei": "...", "id_tracker": "...", "status": "em_operacao" }
    }
  ]
}
```

Também funciona se a foto vier dentro de `equipamento` (campos `imagem`/`foto`/
`image`/`imageUrl`).

## Requisitos da imagem
- **URL absoluta e pública** começando com `https://` (sem necessidade de token).
- **PNG ou JPG.** PNG com **fundo transparente** fica melhor no card.
- Ideal: ângulo 3/4 (frente-lateral), como nos apps de montadora.
- Tamanho recomendado: ~800px de largura.

## O que o app faz automaticamente
- No login e a cada sincronização, lê o link e salva em `vehicle.imageUrl`.
- O card passa a exibir a foto; se o link falhar/estiver ausente, cai no
  fallback (logo da marca) sem quebrar.
- Se a GO360 **não** mandar a foto, o app tenta preencher pela biblioteca
  própria (cache por marca|modelo|ano). O link da GO360 sempre tem prioridade.

## Como validar
Use o probe (já existente), que mostra a resposta crua do `/equipamento`:

```
GET https://appgo-production.up.railway.app/api/cron/go360-probe?token=CRON_SECRET&email=<cliente>&senha=<senha>
```

Confirme que o campo da imagem aparece em `equipamento.veiculos[].imagem`
(ou um dos apelidos acima). Pronto — a foto aparece no card no próximo acesso.
