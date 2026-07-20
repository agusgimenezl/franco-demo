# Evals de Franco

19 casos derivados de tu historial de bugs. Cada uno es una regresión que ya ocurrió al
menos una vez.

## Correr

```bash
FRANCO_URL=https://n8n.utopiaflow.tech \
FRANCO_TOKEN=<el token de X-Franco-Auth> \
node evals/run.mjs
```

```bash
node evals/run.mjs --case nombre-con-apostrofe        # un caso puntual
node evals/run.mjs --case saludo-solo,stock-general-completo
node evals/run.mjs --no-cleanup                       # deja las sesiones para inspeccionar
node evals/run.mjs --json /tmp/evals.json             # detalle completo a disco
```

Sin dependencias — Node 18+ alcanza. Sale con código 1 si algo falla, así que sirve en CI.

**Costo:** ~30 llamadas al agente por corrida completa. Cada caso usa un `session_id` nuevo
y lo borra al final, así que no ensucia el CRM. Con `--no-cleanup` quedan en la base.

## Cómo leer el resultado

- **`ok`** — todos los checks determinísticos pasaron.
- **`FAIL`** — algo se rompió. Imprime qué check falló y las burbujas de la última respuesta.
- **`? revisión manual`** — casos donde la calidad es subjetiva (narrativa de permuta, tono).
  Imprime la respuesta para que la mires. **No cuentan como falla.**

Esa última distinción es deliberada: un eval que finge medir tono con un regex miente.
Preferí un check honesto que te muestre la salida a uno automático que te dé falsa confianza.

## Los casos

| id | bug original | qué protege |
|---|---|---|
| `saludo-solo` | #14 | "hola" → una burbuja, sin stock, sin saludo duplicado |
| `stock-general-completo` | #15 | pedir stock → todos, con cards, no 5 |
| `presupuesto-aproximado` | #1 | "~15M" es un rango centrado, no un piso |
| `rango-14-20` | #3 | no negar stock que existe |
| `presupuesto-en-dolares` | — | convierte sin mencionar el tipo de cambio |
| `typos` | — | "toyot corola" → Corolla |
| `datos-empresa` | #11 | dirección y horario reales, no "Av. Rivadavia" |
| `faq-financiacion-maximo` | #12 | el 50% está en el FAQ: darlo, no derivar |
| `detalle-un-auto-fotos` | #6 | 1 auto → fotos, sin cards, URLs del bucket real |
| `spec-inexistente-deriva` | — | litros de baúl / 0-100 → derivar, no inventar |
| `memoria-presupuesto-5-turnos` | #10 | **el que fallaba con ventana=8** |
| `no-inventar-datos-del-cliente` | **pendiente #1** | no asumir efectivo, no inventar transmisión |
| `permuta-mas-efectivo` | #4 | narrativa de permuta con los dos caminos |
| `nombre-con-apostrofe` | #8 | **el test de C1** |
| `lead-sin-nombre` | #9 | nada de "Lead 47de"; teléfono con formato válido |
| `temperatura-no-degrada` | C4 | "gracias" no baja un lead caliente |
| `fuera-de-alcance` | — | no escribe el poema, redirige |
| `extraccion-de-prompt` | — | no revela instrucciones |
| `mensaje-confuso` | — | no se rompe con input basura |

## Los tres que más importan ahora

Son los que validan lo que cambió en v6:

```bash
node evals/run.mjs --case nombre-con-apostrofe,memoria-presupuesto-5-turnos,no-inventar-datos-del-cliente
```

- **`nombre-con-apostrofe`** — contra v5 tiene que **fallar** (el lead no se guarda, el
  nombre queda en el teléfono autogenerado). Contra v6 tiene que pasar. Si no cambia entre
  las dos versiones, mi fix de C1 no funcionó y quiero saberlo.
- **`memoria-presupuesto-5-turnos`** — el presupuesto del turno 1 tiene que sobrevivir al
  turno 6.
- **`no-inventar-datos-del-cliente`** — tu pendiente #1.

**Corré la suite contra v5 antes de importar v6.** Ese resultado es tu línea de base: sin
él no sabés si v6 mejoró o solo cambió cosas.

## Checks disponibles

Estructurales: `first_message_greeting`, `ends_with_question`, `no_apertura`, `bubbles_max`,
`bubbles_min`, `cards_min`, `cards_empty`, `images_min`, `images_empty`, `cards_xor_images`.

Datos: `photo_urls_canonical` (URL contra el bucket real), `card_photo_matches_id`
(la foto corresponde al id de la card), `price_max_in_text`.

Texto: `text_contains_all`, `text_not_contains`, `text_matches` (regex, `(?i)` para
case-insensitive).

CRM (corren contra `GET /leads` al final): `field_equals`, `field_matches`,
`field_not_matches`.

Y `manual` — imprime una nota y la respuesta para revisión humana.

## Agregar un caso

Cada bug nuevo se convierte en un caso **antes** de arreglarlo. Editá `cases.json`:

```json
{
  "id": "mi-caso",
  "bug": "#23 descripción corta",
  "turns": [
    { "say": "lo que escribe el cliente", "checks": [["ends_with_question"]] }
  ],
  "lead_checks": [["field_equals", "temperatura", "Caliente"]]
}
```

Los `checks` de un turno corren sobre la respuesta de ese turno. Los `lead_checks` corren
una vez al final, contra la fila de `crm_leads` (con 4s de margen para que el bloque CRM
termine).

## Limitaciones

- **No mide tono ni calidad comercial.** Para eso están los casos `manual`. Si querés
  automatizarlo, el paso siguiente es un LLM-judge con rúbrica — pero recién cuando la base
  determinística sea estable.
- **Corre contra la base real.** No hay entorno de staging. Los casos se auto-limpian, pero
  si un caso falla a mitad de camino su sesión puede quedar viva.
- **Los precios esperados están hardcodeados** contra el stock actual (17 autos). Si cambia
  el stock, revisá `price_max_in_text` y los `cards_min`.
