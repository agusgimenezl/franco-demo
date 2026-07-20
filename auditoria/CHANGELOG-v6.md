# Franco v6 — changelog

Archivo: `franco-n8n-v6.json` (35 nodos; v5 tenía 33). Tu export de producción
`franco-n8n.json` quedó intacto.

---

## Qué se arregló

### C0 — El `systemMessage` no era una expresión ⚠️ EL MÁS IMPORTANTE

Descubierto con la primera corrida de evals, después de que el resto de v6 ya estuviera
armado.

En n8n un campo se evalúa como expresión **solo si arranca con `=`**. `text` lo tenía,
`responseBody` lo tenía, el `systemMessage` **no**. Las 18 expresiones `{{ }}` del prompt
eran texto literal.

Franco nunca recibió el nombre de la empresa, la dirección, el teléfono, los horarios, su
propio nombre y tono, el tipo de cambio, ni **la FAQ entera**.

Evidencia de dos corridas consecutivas del mismo workflow:
- `Estamos ubicados en {{ $node["Config"].json.empresa_direccion }}` ← copió el placeholder
- `Estamos en Av. Las Flores 1234` ← inventó una dirección que no existe en el Config

El bug #11 ("alucina datos de empresa") nunca fue una alucinación: era un dato ausente. Se
reforzó el prompt trece veces contra el síntoma equivocado.

**Fix:** prefijar el `systemMessage` con `=`. Verificado antes de aplicar: 19 aperturas,
19 cierres, todas expresiones válidas, y la única llave simple del prompt
(`{ id, titulo, ... }`) n8n la ignora.

**Nota:** sin este fix, el bloque `estado_cliente` que agrega v6 tampoco habría funcionado
— se sumaba al mismo campo sin `=`. El fix principal de v6 llegaba muerto.

### C1 — Comillas simples rompiendo SQL (tu bug #8, que había quedado parchado por prompt)

**8 nodos Postgres** pasaron de interpolación cruda a `queryReplacement` con `$1`:
`Contar mensajes previos`, `Leer conversación (CRM)`, `Query messages`, `Query save`,
`Query delete`, `Query leads`, `Query sessions`, y el nuevo `Leer lead (estado)`.

**`Guardar lead`** es un tool con `$fromAI`, así que no podía usar `queryReplacement` sin
riesgo. Los **31 valores** interpolados ahora pasan por:

```js
String($fromAI('nombre', '<descripción idéntica>', 'string') ?? '').replace(/'/g, "''")
```

Verificado: 31 slots, 0 sin escapar. Y verificado que las descripciones de cada `$fromAI`
siguen siendo byte-idénticas entre sus ocurrencias (`nombre` ×4, `session_id` ×3,
`descripcion_usado` ×4, etc.) — el `.replace()` va **fuera** de la llamada, así que no
dispara `Duplicate key found with different description or type`.

Simulación del resultado:

| Entrada | SQL generado |
|---|---|
| `Martín D'Angelo` | `'Martín D''Angelo'` ✅ |
| `O'Brien` | `'O''Brien'` ✅ |
| *(vacío)* | `''` ✅ |

### C4 — Leads calientes degradándose

`temperatura` y `estado` ya no se pisan con `EXCLUDED` en cada turno:

- `temperatura` solo cambia si `info_nueva = 'si'`. Un `"dale, gracias"` ya no baja un lead.
  **Sigue siendo reversible** cuando el turno realmente aporta información, como querías.
- `estado`: además, `'Requiere asesor'` no se auto-revierte. Es un hito comercial —
  si el cliente pidió que lo contacten, eso no se deshace porque un mensaje posterior
  suene tibio. *(Si preferís que sí se pueda revertir, es una línea; decime.)*

### A1 — Memoria de Franco

`Postgres Chat Memory.contextWindowLength`: **8 → 20**, y `Config.memoria_ventana_mensajes`
a 20 para que dejen de contradecirse.

Lo dejé como literal en vez de expresión hacia el Config a propósito: es el nodo que ya te
rompió Franco entero cuando Supabase se pausó, y no puedo probar acá si n8n acepta una
expresión en ese campo numérico. Cuando lo pruebes, la unificación es:
`={{ $('Config').item.json.memoria_ventana_mensajes }}`.

---

## Qué se agregó

### `Leer lead (estado)` — nodo nuevo

Cadena nueva: `Webhook → Contar mensajes previos → Leer lead (estado) → Config → Franco`

Lee `crm_leads` para la sesión actual. Usa `FROM (SELECT 1) d LEFT JOIN crm_leads` para
devolver **siempre exactamente una fila**, incluso en el primer mensaje cuando el lead
todavía no existe — si devolviera 0 filas cortaría la cadena y Franco no respondería.

Filtra el nombre autogenerado: si `nombre LIKE '+54%'` (el teléfono ficticio de
`hashtext`), lo trata como vacío en vez de saludar al cliente por su número de teléfono.

### `Config.estado_cliente`

Arma el bloque de texto con lo que el cliente ya dijo. Omite lo que está en
`No mencionado` y `Auto usado mencionado, sin detalles`, así el prompt no se llena de ruido.
Si no hay nada: `"(Todavía no te dio ningún dato.)"`.

### `Detalle auto` — tool nueva (resuelve C3)

`SELECT` por `id` que devuelve los campos de `metadata` **más**:

- `fotos` — todas las URLs del auto, como array. Con fallback a `[foto_principal]` si
  `metadata->'fotos'` no existe o no es un array (`jsonb_typeof` check).
- `ficha_completa` — el `content` original, **verbatim desde Postgres**.

Este es el punto: `motor`, `transmisión` y `equipamiento` **no están en `metadata`** (lo
verifiqué: 0 apariciones en cualquier query). Solo existen en el texto de `content`. Antes
la única vía era `Buscar auto` → LLM interno del `toolVectorStore` → Franco. Ahora el texto
llega **sin ningún modelo en el medio**.

No es el fix definitivo — el definitivo es meter esos campos en `metadata` con una
revectorización. Pero saca un LLM de la cadena hoy, sin tocar Supabase.

---

## Prompt (3.210 → 3.495 palabras)

1. **Bloque `# Lo que ya sabés de este cliente`** — inyecta `Config.estado_cliente`. Dice
   dos cosas: estos datos son verdad y no los vuelvas a preguntar; **y si algo no está acá,
   no lo sabés**. Esa segunda mitad es la que ataca tu pendiente #1.
2. **Regla anti-invención extendida a los datos del cliente** — con los dos ejemplos exactos
   del bug: no asumir efectivo, no inventar la transmisión del usado.
3. **Pedir modelo, año y km del usado antes de derivar a tasación** — el resto del pendiente #1.
4. **`## Detalle auto` documentada** — motor/transmisión/equipamiento salen SOLO de
   `ficha_completa`; si no están ahí, deriva. URLs copiadas exacto de `fotos`.
5. **Paso 3 reescrito** para usar `Detalle auto` por id.

---

## Antes de importar

1. **`metadata->'fotos'`**: tu resumen lo lista, pero no pude confirmarlo contra la base.
   Si no existe, el fallback usa `foto_principal` y el detalle muestra una sola foto —
   degradación limpia, no error.
2. **`Guardar lead` es el cambio más delicado.** Probá primero una conversación donde el
   cliente diga un nombre con apóstrofe. Ese caso hoy falla y debería pasar.
3. `estado = 'Requiere asesor'` ahora es pegajoso — decidí si te sirve.

## Qué NO toqué

- `auto_ids` / hidratación por código (C2) — es la rearquitectura, va después de los evals.
- `supabaseUrl.js` en el front — sigue haciendo falta hasta que C2 esté.
- Auth en los webhooks (C5) — **sigue abierto y es el riesgo más alto para una demo con un
  cliente adelante.**
- Config real / multi-tenant (A2).
- Regla fotos-vs-cards a código, y el `¿` (tus pendientes #5 y #6).
