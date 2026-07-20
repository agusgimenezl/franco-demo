# Prompt para Claude Code — Franco fase 2 (C2, A2, M1, revectorización, M2)

> Copiá todo lo que sigue y pasáselo a Claude Code como primer mensaje.

---

Vas a trabajar sobre **Franco**, un agente vendedor de autos para concesionarias, en fase
demo. Backend en n8n, frontend React en Render. Se lo muestra a dueños de concesionarias
como producto a vender e implementar, así que un bug en vivo tiene costo comercial.

## Antes de tocar nada: leé esto

Estos archivos existen y son la verdad del proyecto. Leelos primero, en este orden:

1. `auditoria/AUDITORIA-FRANCO.md` — 21 hallazgos con IDs estables (C1–C5, A1–A4, M1–M7)
2. `auditoria/CHANGELOG-v6.md` — qué ya se arregló y por qué
3. `evals/README.md` — el harness de tests

Los IDs de hallazgo son el vocabulario del proyecto. Usalos.

## Las cinco trampas de n8n que ya nos costaron caro

Aprendidas a los golpes en una sesión de auditoría. No las redescubras:

1. **Un campo de n8n solo se evalúa como expresión si su valor arranca con `=`.** El
   `systemMessage` de Franco no lo tenía, así que sus 18 expresiones `{{ }}` eran texto
   literal y el agente nunca recibió los datos de empresa ni la FAQ. Se atribuyó a
   "alucinación" durante meses. **Si agregás expresiones a un campo, verificá que empiece
   con `=`.**

2. **`queryReplacement` parte el string por comas.** Un mensaje de usuario con una coma
   corría las posiciones de `$1, $2, $3` y rompía el INSERT. **Usá siempre la forma array:**
   `={{ [ v1, v2, v3 ] }}`. Nunca la forma string.

3. **Los `$fromAI` con la misma key deben tener descripción y tipo byte-idénticos** en
   todas sus ocurrencias, o n8n falla con `Duplicate key found with different description`.

4. **Todo nodo Postgres en la cadena principal debe devolver ≥1 fila**, o corta el flujo y
   el usuario no recibe respuesta. Patrón: `FROM (SELECT 1) d LEFT JOIN <tabla> ...`, o
   `alwaysOutputData: true` en el nodo.

5. **Rate limit de OpenAI.** `gpt-4.1` tiene 30.000 TPM en esta organización. Mandarle JSON
   crudo con URLs al agente CRM lo reventaba y se perdían leads al azar. Cuidá el volumen de
   tokens y dejá `retryOnFail` puesto.

## La regla del proyecto

> **Todo lo que se pueda calcular determinísticamente va en SQL o código. Solo lo que es
> lenguaje va en el prompt.**

Cada vez que se aplicó, el bug murió y no volvió. Cada vez que se intentó arreglar algo
mecánico editando el prompt, apareció el patrón yo-yo: reforzar una regla aflojaba otra.

## Cómo se valida: NO NEGOCIABLE

Hay 22 evals. La línea de base actual es **22/22** (`evals/baseline-v6.json`).

```bash
FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs --json /tmp/despues.json
```

Opciones: `--case a,b` (subset), `--repeat N` (mide flakiness), `--delay N` (aísla
contención), `--no-cleanup` (deja sesiones para inspeccionar en n8n).

**Reglas:**
- Corré los evals ANTES de empezar cada fase, para tener línea de base.
- Hacé **una fase por vez**. No empieces la siguiente hasta que la anterior esté verde.
- Si una fase deja algo en rojo, arreglalo o revertí ANTES de seguir. No acumules.
- Si encontrás un bug nuevo, **primero escribí el caso de eval que lo reproduce** y
  confirmá que falla. Si no falla, no entendiste el bug.
- Los checks `manual` no cuentan como falla: imprimen la respuesta para revisión humana.

El archivo de producción es `franco-n8n-v6.json` (ya importado en n8n). Trabajá sobre una
copia versionada (`franco-n8n-v7.json`) y nunca pises el archivo que está en producción sin
avisar.

---

# FASE 1 — C2: el agente devuelve decisiones, no datos

**La más importante. Hacela primero.**

## El problema

Hoy Franco tipea dentro de su JSON estructurado los títulos, precios y URLs de fotos de cada
auto. Todo dato que pasa por un LLM puede mutar. Consecuencias medidas:

- `frontend/src/lib/supabaseUrl.js` existe **solo** para reconstruir URLs que el modelo
  corrompe (68 líneas de parche, con comentarios que documentan el problema)
- el Structured Output Parser falla intermitentemente cuando hay 17 cards que generar
- el JSON con URLs infla el contexto del agente CRM y dispara el rate limit

## El cambio

Franco pasa a devolver **ids**, no datos:

```json
{
  "messages": [{ "type": "text", "content": "..." }],
  "auto_ids": [3, 7, 12]
}
```

Un nodo Postgres hidrata esos ids con datos reales, y el JS de `Responder a Render` arma
`product_cards` / `images`.

## Implementación en n8n

1. **`Structured Output Parser`** → nuevo `jsonSchemaExample`:
   ```json
   { "messages": [{ "type": "text", "content": "Mirá lo que tenemos:" }], "auto_ids": [1, 5, 9] }
   ```

2. **Nodo nuevo `Hidratar autos`** (Postgres, entre `Franco (AI Agent)` y
   `Responder a Render`):
   ```sql
   SELECT
     (metadata->>'id')::int AS id,
     metadata->>'marca' || ' ' || (metadata->>'modelo') || ' ' || (metadata->>'año') AS titulo,
     '$' || replace(to_char((metadata->>'precio')::bigint, 'FM999G999G999'), ',', '.') AS precio,
     metadata->>'foto_principal' AS foto_principal,
     COALESCE(
       CASE WHEN jsonb_typeof(metadata->'fotos') = 'array'
            THEN (SELECT jsonb_agg(f) FROM jsonb_array_elements_text(metadata->'fotos') f)
       END,
       to_jsonb(ARRAY[metadata->>'foto_principal'])
     ) AS fotos
   FROM autos_disponibles
   WHERE (metadata->>'id')::int = ANY($1::int[]);
   ```
   `queryReplacement`:
   ```
   ={{ [ '{' + (($('Franco (AI Agent)').item.json.output?.auto_ids) || []).join(',') + '}' ] }}
   ```
   Con `auto_ids` vacío queda `'{}'`, un array vacío válido. **Poné
   `alwaysOutputData: true`** para que 0 filas no corte la cadena (trampa 4).

3. **`Responder a Render`** → el JS arma la salida con las filas reales:
   - `ids.length >= 3` → una card por auto, `images` vacío
   - `ids.length` 1 o 2 → todas las `fotos` de cada auto en `images`, `product_cards` vacío
   - `ids.length === 0` → ambos vacíos
   - Mantené el guard de cierre comercial y el strip de `¿`/`¡` que ya están ahí
   - Mantené el blindaje: si `output` no es un objeto válido, devolver una burbuja de
     fallback (hay 6 caminos de fallo ya contemplados, no los rompas)

4. **Prompt de Franco** → sacá toda la sección de formato de salida que ya no aplica:
   la regla fotos-vs-cards, el formato de las cards, "no escribas URLs en content", las
   instrucciones de copiar URLs carácter por carácter. Son ~1.500 palabras. Reemplazalas por:
   "devolvés `auto_ids` con los ids de los autos que estás mostrando, en el orden en que los
   mencionás en el texto". **Verificá que el `systemMessage` siga arrancando con `=`.**

## Implementación en el frontend

5. **Borrá `frontend/src/lib/supabaseUrl.js`** y sus usos en `francoItems.js`. Ya no hace
   falta: las URLs vienen de Postgres. Este borrado es la prueba de que C2 funcionó.

6. `francoItems.js` — el contrato de `{messages, images, product_cards}` hacia el front no
   cambia. Solo desaparece la normalización de URLs.

## Verificación

- `photo_urls_canonical` y `card_photo_matches_id` deben pasar siempre, no por suerte
- Corré `--repeat 5` sobre `stock-general-completo` y `detalle-un-auto-fotos`: el parser ya
  no debería fallar, porque el schema es mucho más chico
- 22/22

---

# FASE 2 — M1: paginar el stock

`Listar stock` no tiene `LIMIT`. Con 17 autos anda; con 200 revienta el contexto y el costo
por turno.

- Agregá `LIMIT` leyendo de Config (ver fase 3 para el patrón)
- Cuando el resultado se trunque, el prompt tiene que poder decir "tenemos más, te muestro
  por marca o presupuesto" en vez de mentir con "esto es todo"
- Ojo: los evals `cards_min` están calibrados contra el stock actual de 17 autos. Si el
  límite queda por debajo, actualizá los casos.

---

# FASE 3 — A2: Config real y multi-tenant

**El bloqueante de negocio.** Hoy configurar una concesionaria nueva es tocar 6 lugares en 2
repos y acordarse de todos.

Estas variables están declaradas en `Config` y **no se usan** — el valor real está
hardcodeado en otro lado:

| variable | dónde está en realidad |
|---|---|
| `supabase_table_autos` | literal en el SQL de `Listar stock` y `Detalle auto` |
| `supabase_query_match` | literal en `Supabase Vector Store` |
| `postgres_table_memoria` | literal en 4 queries |
| `modelo_llm_conversacion` | literal en el nodo OpenAI |
| `memoria_ventana_mensajes` | literal en `Postgres Chat Memory` |
| `cards_cantidad` | no se usa en ningún lado |

Además el dominio de Supabase está hardcodeado en el frontend (desaparece con la fase 1).

**Qué hacer:**
1. Que cada nodo lea del Config: `{{ $('Config').item.json.<var> }}`
2. Partí el Config en dos bloques: **`config_cliente`** (nombre, dirección, teléfono,
   horarios, FAQ, tono, moneda) y **`config_tecnico`** (tablas, modelos, ventanas, límites).
   Onboarding de una concesionaria nueva = editar un solo bloque.
3. Documentá en `auditoria/ONBOARDING.md` los pasos exactos para un cliente nuevo.

**Cuidado con `Postgres Chat Memory`:** se dejó en literal `20` a propósito porque no se
pudo probar si n8n acepta una expresión en un campo numérico, y es el nodo que ya tiró
Franco entero una vez. Probalo aislado antes de dejarlo.

---

# FASE 4 — Revectorizar: specs a `metadata`

`motor`, `transmisión` y `equipamiento` **no están en `metadata`** — solo en el texto de
`content`. La tool `Detalle auto` los expone como `ficha_completa` (texto verbatim, sin LLM
en el medio), que es mejor que antes pero sigue siendo texto libre que el modelo interpreta.

Existen scripts previos (`cargar_autos_supabase.py`, `revectorizar_con_consumo_v2.py`) —
pedíselos a Nicolás si no están en el repo.

- Agregá `motor`, `transmision`, `equipamiento` (y lo que ya esté en `content`) como campos
  estructurados de `metadata`
- Verificá que `metadata->'fotos'` exista como array — hoy hay un fallback a
  `foto_principal` porque no se pudo confirmar
- Actualizá `Detalle auto` para devolverlos desde `metadata` en vez de `ficha_completa`
- Actualizá el prompt: esos datos pasan a salir de campos, no de texto
- **Hacé backup de la tabla antes de revectorizar.**

---

# FASE 5 — M2: el saludo no queda en la memoria

`Responder a Render` antepone el saludo de bienvenida por código, pero ese mensaje no se
escribe en `n8n_chat_histories` ni en `mensajes_demo`. Consecuencias:

- Franco no sabe que ya saludó
- El historial que ve el dueño difiere de lo que vio el cliente
- El agente CRM lee una conversación que no es la real

Persistí el saludo junto con el resto del turno. Ojo con `Contar mensajes previos`: usa el
conteo de `n8n_chat_histories` para decidir si es el primer mensaje — si agregás una fila
más, ajustá esa lógica o se rompe el saludo.

---

# Al terminar

1. Corré la suite completa y guardá el resultado como nueva línea de base
2. Actualizá `auditoria/CHANGELOG-v6.md` (o creá `CHANGELOG-v7.md`)
3. Listá qué quedó abierto y qué deuda nueva se generó

## Deuda conocida que ya existe, no la "arregles" sin avisar

- El guard de cierre comercial garantiza que haya una pregunta, pero a veces reemplaza una
  mejor pregunta de Franco por la genérica (se vio en `permuta-mas-efectivo`). Gana piso,
  pierde techo. Fue una decisión consciente.
- El header auth de los webhooks está **desactivado a propósito**. Existe
  `franco-n8n-v6-auth.json` y `auditoria/C5-runbook.md` para cuando se active. No lo
  actives sin coordinar: rompe la demo si el frontend no manda el header primero.
- `Leer lead (estado)` lee `crm_leads` antes del agente, pero el CRM escribe después de
  responder: el estado que ve Franco está siempre un turno atrasado. La ventana de memoria
  de 20 lo compensa. Si lo mejorás, medí que no rompas nada.
