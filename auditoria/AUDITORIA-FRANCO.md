# Auditoría Franco — backend n8n + frontend

Fecha: 2026-07-19
Alcance: `franco-n8n.json` (33 nodos) + `github.com/agusgimenezl/franco-demo` (frontend)

---

## Tesis

Los tres síntomas que reportás — **respuestas erróneas, información inventada, información no guardada** — no son tres problemas. Son tres salidas de dos causas raíz:

1. **Los datos del stock viajan a través del LLM** para llegar a la UI. Todo dato que pasa por un LLM puede mutar.
2. **Los valores generados por el LLM se interpolan crudos dentro de SQL.** Una comilla rompe el INSERT en silencio.

Todo lo demás son consecuencias o agravantes.

---

## Hallazgos por severidad

### 🔴 CRÍTICO

#### C1 — SQL injection / rotura silenciosa en todos los `$fromAI`
**Dónde:** nodo `Guardar lead` (todos los campos), `Query messages`, `Query save`, `Query delete`, `Contar mensajes previos`, `Leer conversación (CRM)`, `Query leads`, `Query sessions`.

Los valores se interpolan directo dentro de comillas simples:
```sql
'{{ $fromAI('nombre', ...) }}'
```

Si el cliente dice `soy Martín D'Angelo`, o el `resumen` que genera el CRM contiene una comilla
(`Busca una SUV 'familiar'`), el SQL queda malformado y el INSERT falla. n8n no propaga ese error
al usuario: **el lead simplemente no se guarda.**

Esto explica por qué "información no guardada" es intermitente e irreproducible: depende de si el
cliente o el modelo usaron un apóstrofe.

Lo mismo con los webhooks GET/POST: `'{{ $json.query.session_id }}'` viene de la URL sin sanitizar.
Un `'` en el query param es injection real, no teórica.

**Fix:** usar `queryReplacement` con placeholders `$1, $2, ...` en TODOS los nodos Postgres.
El patrón correcto ya existe en tu workflow — el nodo `Guardar mensajes (historial)` lo hace bien:
```
query: INSERT INTO mensajes_demo (...) VALUES ($1, 'user', ...)
options.queryReplacement: ={{ ... }},{{ ... }}
```
Replicar eso en los 8 nodos restantes.

---

#### C2 — Doble LLM en serie sobre los datos del stock
**Dónde:** `Buscar auto` (`toolVectorStore`) + `OpenAI Chat Model (Tool)`.

`toolVectorStore` no devuelve los documentos: se los pasa a su **propio LLM interno**, que los
resume, y devuelve ese resumen a Franco. Entonces la cadena es:

```
Postgres/Supabase → LLM #1 (resume la ficha) → Franco/LLM #2 (arma el JSON) → UI
```

Precios, años, km, motor y URLs de fotos atraviesan dos modelos antes de llegar al usuario.
El prompt de Franco dice "los datos, tal cual vienen" — pero ya vinieron parafraseados.

**Esta es la fuente principal de "información inventada".**

**Fix:** reemplazar `Buscar auto` por un `postgresTool` que ejecute la búsqueda vectorial
(vía la función `match_disponibles` que ya tenés declarada en el Config, o el operador `<=>`)
y devuelva **filas crudas**, igual que `Listar stock`. Cero LLM intermedio.

---

#### C3 — El prompt pide datos que ninguna tool devuelve
**Dónde:** system message de Franco, "Paso 3 — Interés en un auto puntual".

El prompt exige:
> "precio, año, km, **motor, transmisión**, combustible, consumo, **equipamiento relevante**"
> "Las fotos de ese auto van en 'images' (**una entrada por URL de la ficha**)"

Pero `Listar stock` devuelve solo: `id, titulo, precio, foto_principal, carroceria, condicion,
anio, km, combustible, consumo, categoria`.

**No existe `motor`. No existe `transmision`. No existe `equipamiento`. No existe el array de fotos
secundarias — solo `foto_principal`.**

Franco tiene exactamente dos salidas posibles: inventar el dato, o derivar al asesor.
Hace ambas, de forma no determinística. Le estás pidiendo al prompt que resuelva un problema
de contrato de datos.

**Fix:** crear una tool `Detalle auto(id)` que devuelva la ficha completa de UN auto,
incluyendo `fotos[]` como array, motor, transmisión y equipamiento. El Paso 3 llama a esa tool.

---

#### C4 — `temperatura` y `estado` se pisan sin protección
**Dónde:** `Guardar lead`, cláusula `ON CONFLICT DO UPDATE`.

Todos los campos del CRM tienen guarda contra pérdida de información:
```sql
vehiculo_interes = CASE WHEN '...' = 'No mencionado' THEN crm_leads.vehiculo_interes ELSE '...' END
```

Pero estos dos, no:
```sql
temperatura = EXCLUDED.temperatura,
estado      = EXCLUDED.estado,
```

El agente CRM solo ve las últimas 20 filas (`Leer conversación (CRM)` tiene `LIMIT 20`). Cuando un
lead que ya estaba en `Caliente / Requiere asesor` manda un `"dale, gracias"`, el modelo relee un
fragmento sin señales de compra y lo reclasifica hacia abajo.

**Estás degradando leads calientes en la base de datos.** Para un producto cuyo valor ES el CRM,
esto es el bug más caro de la lista.

**Fix:** que la temperatura y el estado solo puedan subir, nunca bajar automáticamente —
o proteger con un `GREATEST` sobre un ranking numérico:
```sql
temperatura = CASE
  WHEN rank_temp(EXCLUDED.temperatura) > rank_temp(crm_leads.temperatura)
  THEN EXCLUDED.temperatura ELSE crm_leads.temperatura END
```

---

#### C5 — Webhooks sin autenticación
**Dónde:** `Webhook GET leads`, `Webhook GET sessions`, `Webhook GET messages`,
`Webhook POST save`, `Webhook POST delete`.

Ninguno tiene header auth, token ni validación de origen. `POST /session-delete` borra filas de
`n8n_chat_histories` y `crm_leads` con solo un `session_id`.

Cualquiera que vea la URL en el network tab del navegador puede leer todos los leads de tu demo
o borrarlos. Antes de mostrarle esto a una concesionaria, hay que cerrarlo.

**Fix:** header auth en los webhooks de n8n; el proxy (`server/n8n.js`) ya es server-side, así que
el token nunca llega al bundle del cliente. Es un cambio de 20 minutos.

---

### 🟠 ALTO

#### A1 — Ventana de memoria de 8 mensajes (~4 turnos)
**Dónde:** `Postgres Chat Memory`, `contextWindowLength: 8`.

El prompt de Franco depende fuertemente de recordar presupuesto, permuta y vehículo de interés
mencionados turnos atrás (todo el bloque "Enfoque comercial" y "Permuta"). A partir del quinto
turno esos datos salieron de la ventana: Franco vuelve a preguntar el presupuesto, o llama a
`Listar stock` con `precio_objetivo=0` y muestra el catálogo entero.

**Fix:** subir a 20–30. El costo extra en `mini` es marginal comparado con perder la venta.

#### A2 — El `Config` no configura nada
**Dónde:** nodo `Config` vs. el resto del workflow.

Declarados en Config pero **nunca leídos**:

| Variable | Valor declarado | Dónde está en realidad |
|---|---|---|
| `supabase_table_autos` | `autos_disponibles` | hardcodeado en el SQL de `Listar stock` |
| `supabase_query_match` | `match_disponibles` | hardcodeado en `Supabase Vector Store` |
| `postgres_table_memoria` | `n8n_chat_histories` | hardcodeado en 4 queries distintas |
| `modelo_llm_conversacion` | `gpt-4.1-mini` | hardcodeado en el nodo OpenAI |
| `memoria_ventana_mensajes` | `8` | hardcodeado en `Postgres Chat Memory` |
| `cards_cantidad` | `17` | no se usa en ningún lado |

Además el dominio de Supabase está hardcodeado en el frontend (`supabaseUrl.js`).

**Para el modelo de negocio que describís — vender e implementar en muchas concesionarias — este
es el bloqueante #1.** Hoy "configurar Franco para un cliente nuevo" significa tocar seis lugares
distintos, en dos repos, y esperar acordarse de todos. Es el error humano garantizado por diseño.

**Fix:** que cada nodo lea del Config (`{{ $('Config').item.json.postgres_table_memoria }}`).
Y separar el Config en dos: `config_cliente` (nombre, dirección, FAQ, horarios) vs `config_tecnico`
(tablas, modelos, ventanas). Onboarding de una concesionaria nueva = editar un solo bloque.

#### A3 — El prompt se contradice a sí mismo
**Dónde:** system message de Franco (~6.000 palabras, sobre `gpt-4.1-mini`).

Contradicciones directas:

| Regla | Regla que la contradice |
|---|---|
| "Respuestas cortas… nada de muros de texto" | "mostrás TODOS los autos… Si hay 17 autos, van los 17" |
| "Ante la duda entre inventar y derivar, derivá" | "No derivés por temas que el FAQ cubre" |
| "1 o 2 autos → fotos, `product_cards` VACÍO" | "stock general → ahí siempre van cards" (colisiona si el filtro devuelve 2) |
| "Las herramientas se usan sin anunciarlas… respondés directo" | Paso 3: "primero llamás a la herramienta… y con esos datos armás el detalle" |

`gpt-4.1-mini` no tiene la adherencia a instrucciones necesaria para arbitrar un prompt de este
tamaño con conflictos internos. Cuando el modelo tiene que elegir entre dos reglas, elige distinto
cada vez — y eso es exactamente lo que ves como "respuestas erróneas".

**Fix (dos partes):**
1. Sacar del prompt todo lo que es determinístico (ver A4). Reduce ~1.500 palabras.
2. Subir el modelo del agente conversacional a `gpt-4.1` (el CRM ya lo usa). Comparado con el
   costo de una venta perdida en una demo, la diferencia de precio es irrelevante.

#### A4 — Lógica determinística delegada al LLM
**Dónde:** system message, sección "Formato de salida" + "Regla de fotos vs cards".

> "1 o 2 autos → van las FOTOS… 3 o más autos → va una CARD por auto"

Esto es **contar elementos de un array**. No es una decisión de lenguaje. Está en el prompt,
consume atención del modelo, y falla.

La evidencia de que falla está en tu propio código, en tres capas de parche:
- `Responder a Render` inyecta por JS la pregunta de cierre que el prompt ya pedía
- `francoItems.js:splitIntoBubbles()` parte párrafos porque el modelo no respeta `messages[]`
- `supabaseUrl.js` reconstruye URLs corruptas

**Tres capas distintas parcheando el mismo fallo de diseño.**

**Fix:** un nodo Code después del agente decide fotos-vs-cards contando. Sacar la regla del prompt.

---

### 🟡 MEDIO

#### M1 — `Listar stock` sin `LIMIT`
Con `precio_objetivo=0` devuelve el catálogo entero, y con todo en 0 **todos** los autos quedan
etiquetados `entra`. Hoy con 17 autos funciona; una concesionaria con 200 unidades revienta el
context window y dispara el costo por turno. Agregar `LIMIT` y paginar.

#### M2 — El saludo inyectado no queda en la memoria
`Responder a Render` antepone el saludo de bienvenida por código, pero ese mensaje **no se
escribe** en `n8n_chat_histories` ni en `mensajes_demo`. Consecuencias:
- Franco no sabe que ya saludó
- El historial que ve el dueño en el front difiere de lo que vio el cliente
- El agente CRM lee una conversación que no es la real

#### M3 — Sin fallback si el output parser falla
En `Responder a Render`: `$json.output.messages || []`. Si el parser falla y `output` viene como
string, `.messages` es `undefined` → `[]` → **el front recibe una respuesta vacía sin error**.
El usuario ve el chat colgado sin explicación. Falta un guard de tipo + un mensaje de fallback.

#### M4 — Sin `onError` ni retry en ningún nodo del pipeline
Si `Contar mensajes previos` falla (Postgres saturado, timeout), el webhook **nunca responde** y
el front espera 60s antes de mostrar error. El prompt tiene una sección "Robustez" — pero cubre
solo las tools del agente, no el pipeline. Configurar `onError: continueRegularOutput` en los
nodos no críticos.

#### M5 — `descripcion_usado`: CASE con rama contradictoria
```sql
WHEN '{nuevo}' NOT IN ('No mencionado', 'Auto usado...') THEN '{nuevo}'
WHEN crm_leads.descripcion_usado NOT IN (...) THEN crm_leads.descripcion_usado
ELSE '{nuevo}'
```
Funciona, pero la tercera rama vuelve a poner el valor nuevo que la primera ya descartó.
Ilegible y frágil ante cambios. Simplificar a `COALESCE` + `NULLIF`.

#### M6 — `$fromAI` con la misma key repetida
`nombre` aparece 4 veces y `session_id` 3 veces en `Guardar lead`, cada una con su descripción
completa. Infla el schema de la tool que ve el modelo sin aportar nada. Consolidar.

#### M7 — Race condition potencial en el CRM
`Responder a Render` dispara dos ramas en paralelo, y `Leer conversación (CRM)` lee
`n8n_chat_histories` — tabla que escribe el nodo de memoria al terminar el agente. El orden es
probablemente correcto, pero no está garantizado por el grafo. Si el CRM lee antes de la
escritura, analiza la conversación **sin el último turno**. Encadenar explícitamente.

---

## Rearquitectura propuesta

El cambio de fondo es uno solo:

> **El agente devuelve decisiones, no datos.**

Hoy:
```
Franco → {messages, images:[URLs...], product_cards:[{id,titulo,precio,foto}...]} → UI
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         todo esto lo TIPEA el modelo, y por eso muta
```

Propuesto:
```
Franco → {messages, auto_ids:[3,7,12]}
   ↓
[Nodo Code] hidrata los ids contra Postgres → arma product_cards/images con datos REALES
   ↓
UI
```

Lo que esto elimina de un saque:
- URLs corruptas → **`supabaseUrl.js` entero se borra** (68 líneas de parche)
- Precios inventados o mal formateados
- Cards con datos que no matchean el texto
- ~1.500 palabras de prompt sobre formato de salida
- La regla fotos-vs-cards (pasa a ser `ids.length >= 3`)

El schema del output parser se reduce a `{ messages: [...], auto_ids: [...] }`. Muchísimo más
fácil de cumplir para el modelo, y **estructuralmente imposible** de alucinar: un id inexistente
no devuelve fila, en vez de devolver un dato falso.

### Orden de ejecución sugerido

**Semana 1 — parar la sangría (todo esto es bug fixing, sin rediseño):**
1. C1 — parametrizar todos los queries → arregla "información no guardada"
2. C4 — proteger temperatura/estado → deja de degradar leads
3. C5 — auth en los webhooks → riesgo de demo
4. A1 — subir la ventana de memoria a 20

**Semana 2 — la rearquitectura:**
5. C2 + C3 — tools que devuelven filas crudas + tool `Detalle auto(id)`
6. Agente devuelve `auto_ids`, nodo Code hidrata
7. A4 — sacar del prompt la lógica determinística
8. A3 — reescribir el prompt limpio sobre el contrato nuevo

**Semana 3 — escalar a N clientes:**
9. A2 — Config real, separado en cliente/técnico
10. M1 — paginación del stock

---

## Lo que falta y es lo más importante

No hay evals.

Cada vez que tocás el prompt para arreglar un caso, rompés otro sin enterarte hasta que un cliente
lo ve en vivo. Eso es exactamente el ciclo que describís cuando decís "vengo encontrando muchos
errores". No es que el prompt esté mal escrito — está muy trabajado. Es que **no tenés forma de
saber si un cambio mejoró o empeoró el sistema.**

Con ~30 conversaciones de prueba y sus salidas esperadas, cada cambio de prompt se valida en dos
minutos en vez de en una demo con un cliente adelante. Casos mínimos a cubrir:

- saludo solo → una sola burbuja, sin stock
- stock general → los 17, con cards, cerrando en pregunta
- presupuesto en pesos / en dólares / rango / techo / piso
- permuta + efectivo → las dos narrativas
- pregunta de FAQ que SÍ tiene respuesta concreta (el 50% de financiación) → no derivar
- pregunta de spec que NO está en la ficha → derivar, no inventar
- typos: "toyot corola", "amaroc", "jilux"
- nombre con apóstrofe ("D'Angelo") → **el lead se guarda** ← el que hoy falla
- fuera de alcance (pedile un poema) → redirección con gracia
- intento de extracción del system prompt → mantiene el rol

Este es el mayor retorno por hora invertida de toda la lista.
