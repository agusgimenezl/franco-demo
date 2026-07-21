# Estado de Franco

Última actualización manual: **2026-07-20**

<!-- AUTOGENERADO: no editar a mano. Regenerar con: node scripts/state-sync.mjs -->

**Workflow en producción:** `franco-n8n-v14.json` · 35 nodos

| | |
|---|---|
| Webhooks | 6 (auth: ninguna) |
| Nodos Postgres | 15 |
| Tools de Franco | Listar stock, Buscar auto, Guardar lead, Detalle auto |
| Modelos | OpenAI Chat Model: gpt-4.1-mini · OpenAI Chat Model (CRM): gpt-4.1 |
| Ventana de memoria de Franco | 20 |
| Empresa configurada | Automotores Tucumán |
| Evals | 29 casos · baseline-v11.json → 25/27 |

**Invariantes:** ✅ los 5 pasan

<!-- FIN AUTOGENERADO -->

---

## Cerrado

Todo esto está en producción y verificado con evals (línea de base v5: 15/19 → hoy 22/22).

| ID | Qué era | Qué se hizo |
|---|---|---|
| **C0** | El `systemMessage` no arrancaba con `=`, así que sus 18 expresiones eran texto literal. Franco nunca recibió datos de empresa ni la FAQ. Se atribuyó a "alucinación" durante meses | prefijo `=` |
| **C1** | Se perdían leads. Diagnosticado primero como comillas simples; **la causa real era la coma**: `queryReplacement` parte el string por comas y corría `$1,$2,$3` | forma array en los 9 nodos |
| **C4** | `temperatura`/`estado` se reseteaban a Frío/Nuevo con un "gracias" | solo cambian si `info_nueva='si'`; `Requiere asesor` no se auto-revierte |
| **A1** | Ventana de memoria de Franco en 8 (≈4 turnos) | 20 |
| **C3** (parcial) | El prompt pedía motor/transmisión/equipamiento y ninguna query los devolvía | tool `Detalle auto` con `ficha_completa` desde Postgres |
| **M3** | Si el parser fallaba, el chat quedaba colgado. `$json.output.messages \|\| []` tiraba TypeError | `onError` + `Responder a Render` blindado (6 caminos de fallo testeados) |
| **M4** (parcial) | `Guardar mensajes` abortaba la ejecución y se llevaba puesto al CRM | `onError: continueRegularOutput` |
| **rate limit** | `gpt-4.1` a 30.000 TPM; el CRM recibía el catálogo completo con URLs (~9.200 tokens/llamada, techo de 3/min) | query adelgazada 92% (~750 tokens, ~40/min) + `retryOnFail` |
| pendiente #1 | Franco inventaba datos que el cliente había dado ("efectivo", "Ka automático") | `Leer lead (estado)` + bloque `estado_cliente` en el prompt |
| pendiente #5 | El `¿` reaparecía pese al prompt | strip por código |
| cierre comercial | Se perdía cuando había 1-2 autos (el guard solo cubría 3+ cards) | guard extendido a toda respuesta |
| guard fuera de contexto (2026-07-20) | El guard le pegaba la pregunta genérica de venta a **todo** turno que no terminara en `?`: al despedirse ("gracias, estoy bien" → "querés un asesor?" x3) y después de derivar ("le paso tu nombre a un asesor" → "querés un asesor?"). Franco ya cerraba y derivaba bien solo; el string era byte-idéntico al hardcodeado en `Armar respuesta` | El guard ahora **solo corre si el turno mostró autos** (`autos.length >= 1 && !texto.endsWith('?')`), que es su propósito original: no dejar una lista de autos sin próximo paso. Primero se probó una heurística de markers de despedida y quedó corta (no cubría la derivación); se reemplazó por el gate, que cubre todos los turnos sin autos sin whack-a-mole. Medido con `analiza-guard`: disparos espurios **2 → 0**, los legítimos intactos. Evals `cierre-conversacion` y `derivacion-no-repite-asesor` |
| nombre y apellido (2026-07-20) | Pedía solo el nombre para derivar al asesor | 5 reemplazos asertados en el prompt. Eval `derivacion-no-repite-asesor` |
| recomendación por criterio (2026-07-20) | Pidiendo "cambiar el Mobi manteniendo el tamaño", encabezaba con un **Cronos** (4,36 m vs 3,57 m), en párrafo corrido y justificando con algo falso ("todos son autos compactos"). Reproducido 3/3, cada corrida fallando por un síntoma distinto: no había ninguna política para recomendar con restricción, así que improvisaba | Sección nueva `## Recomendación por criterio` en el prompt: primero los que cumplen, tamaño según `carroceria` de la ficha (no de memoria), motivo corto por auto sacado de la ficha, lo que no cumple va en grupo aparte y explícito, sin repetirle al cliente su intención. Eval `recomendacion-por-tamano` (3/3 fallando → **4/4 estable**) |
| **C5 (proxy)** | El PIN de borrado vivía en el bundle; `POST /api/session-delete` borraba sin autenticación | PIN validado en Express contra `CRM_PIN`, **falla cerrado**. Verificado en producción: 403 |
| **C5 (header)** | El frontend no mandaba header de auth a n8n | Manda `X-Franco-Auth` en las 3 rutas, incluidos los GET. n8n todavía **no lo exige** (estado intermedio correcto) |
| **criterio fuera de presupuesto** (2026-07-21) | Con un presupuesto activo, al agregar un criterio (ej: "menos de 50.000 km") Franco contestaba "no tenemos opciones" aunque existieran, más caras. Reproducido en `km-con-presupuesto` **0/4**. **Tres intentos, todos medidos:** v12 puso una política en el prompt (1/4, y una vez presentó el Cronos de 58k como si cumpliera) → **revertido**; v13 agregó `km_max` a las tools (2/4) → el log 3963 mostró que el filtro andaba pero la **combinación** presupuesto+km daba `response: []`, y desde ahí Franco no sabía que los autos existían; v14 lo resolvió en SQL | **`franco-n8n-v14.json`** (`scripts/criterio-sin-resultados.mjs`): en `Listar stock` el techo de precio pasa de filtro duro a **preferencia**. El criterio del cliente (km) filtra siempre; si con presupuesto no queda nada, un `UNION ALL … WHERE NOT EXISTS` devuelve igual los que cumplen con `categoria='fuera'`. El `CASE` de categoría se conservó byte a byte; `precio_num` queda dentro del CTE para no sumar tokens. Medido: `km-con-presupuesto` **2/3** (el "no hay opciones" desapareció; queda un ~1/3 donde pregunta antes de mostrar, ver Abierto), controles de presupuesto **15/15** (`presupuesto-aproximado`, `rango-14-20`, `permuta`, `memoria`). `km_max` (v13) queda en las tools: `km-maximo` sigue 3/3 |
| **fotos repetidas** (2026-07-21) | `Armar respuesta` armaba `images` desde `auto_ids` en cada turno, sin noción de "ya mostrado": si el cliente seguía preguntando por el mismo auto ("cuál es el consumo?"), Franco reenviaba las mismas 3 fotos. Quedaba robótico. Eval `fotos-no-repetidas` **0/5**, siempre 3 imágenes repetidas en el turno 2 | Nodo nuevo `Autos ya mostrados` (Postgres) entre `Hidratar autos` y `Armar respuesta`: saca de las URLs de las `images` de los **últimos 8 mensajes** qué autos ya tienen fotos enviadas (`foto-2-1.webp` → 2). `franco-n8n-v11.json` (`scripts/fotos-no-repetidas.mjs`, 34 → 35 nodos). **Dos límites deliberados:** (1) sólo mira `images` previas, NO `product_cards` — ver la ficha con fotos después de la miniatura es un flujo válido; (2) sólo filtra en la rama de 1-2 autos, nunca en listas de 3+, que si no saldrían incompletas. El guard de cierre sigue usando la lista completa. Si el nodo falla, no se filtra nada (mejor repetir una foto que ocultar un auto). Medido: `fotos-no-repetidas` **0/5 → 3/3** (`t2` de 3 a 0 imágenes), y los límites verificados: `detalle-un-auto-fotos` 3/3 (`t1` 6 cards → `t2` 3 fotos) y `stock-general-completo` con las 17 cards completas |
| **color en `metadata`** (2026-07-21) | `armar_metadata()` nunca guardó `color`: sólo vivía en el texto de `content`, y las tools leen `metadata`. Franco podía describir el color de UN auto (lo leía de la ficha) pero no listar todos los grises — contestaba literalmente *"no tengo un filtro específico por color automático"*. Eval `color-gris` **0/3** | **(1)** `scripts/color-metadata.sql` (generado desde `stock.csv` por `gen-color-sql.mjs`): `UPDATE` aditivo e idempotente que suma la clave `color` al jsonb. **No toca `content` ni `embedding`** — no hizo falta revectorizar. **(2)** `franco-n8n-v10.json` (`scripts/color-en-tools.mjs`): `color` como columna en `Listar stock`, `Buscar auto` y `Detalle auto`, y filtro en `Buscar auto` por **dos caminos** (parámetro `color` explícito + color sumado al concat del ILIKE), para no depender de que el modelo elija bien el parámetro. El script verifica automáticamente la **trampa 3** sobre las 18 keys `$fromAI` del workflow. Medido: `color-gris` **0/3 → 3/3**, con `product_cards` = `[1,4,5,11,14]` exacto en las 3 corridas (los 5 grises, cero colados) |
| **M2 / historial fiel** (2026-07-21) | **Franco SÍ saludaba** — el bug nunca fue el saludo. `Armar respuesta` devolvía dos objetos: `respuesta.messages = finalMsgs` (lo que ve el cliente) e `historial.messages = messages`, la variable **previa** a todo el post-proceso. Como `Guardar mensajes (historial)` persiste `historial` en `mensajes_demo` y de ahí sale la pestaña **Historial**, el dueño veía una conversación sin saludo, sin la pregunta de cierre del guard y con los `¿` que el cliente nunca vio. Detectado por dos capturas independientes (saludo faltante y `¿` presente), las dos predichas por el código | `historial: { messages: finalMsgs, images: finalImgs, product_cards }` (`franco-n8n-v9.json`, `scripts/m2-historial-fiel.mjs`, aplicado a mano). **Instrumento nuevo**, que era el agujero de fondo: el runner ahora lee `mensajes_demo` vía `/webhook/session-messages` y soporta `history_checks` (`first_bubble_greeting`, `no_apertura`, `bubbles_min`) — antes **todos** los checks miraban sólo la respuesta del webhook, por eso el bug vivía sin que nadie lo viera. Medido: `saludo-solo` **0/2 → 3/3**, con historial y respuesta byte a byte iguales. El `historial` de `fallback()` se dejó intacto a propósito: ya era fiel. **No se tocó `esPrimero`** |
| **C2 (auditoría)** (2026-07-21) | `Buscar auto` era un `toolVectorStore`: le pasaba las fichas a su **propio LLM**, que las resumía, antes de dárselas a Franco. El `content` vectorizado no tiene el `id` (`armar_content()` no lo escribe), así que el id le llegaba a Franco sólo por un canal accidental: las URLs de las fotos (`foto-5-1.webp` → 5), como se ve en la ejecución 3626 | `franco-n8n-v8.json`, generado por `scripts/c2-buscar-auto-postgres.mjs` con aserciones (37 → 34 nodos: caen `Supabase Vector Store`, `Embeddings OpenAI` y `OpenAI Chat Model (Tool)`). `Buscar auto` pasa a `postgresTool` y devuelve **filas crudas con `id`**, igual que `Listar stock`; `typeVersion` y credenciales copiadas de un nodo que ya funcionaba (trampas 6 y 7), `precio_min`/`precio_max` byte-idénticos (trampa 3), texto sanitizado a alfanuméricos en vez de escapado. Aplicado en producción y medido: `typos` 3/3, `detalle-un-auto-fotos` 3/3, `lead-sin-nombre` 3/3 (4 cards con las 4 pickups reales), control `permuta` 3/3 y `memoria` 3/3. Verificado en la ejecución **3677**: la tool devuelve las filas con `id` y Franco los **copia** en vez de inferirlos; el nodo baja de ~8.300 ms a **20 ms** y desaparece un LLM de la ruta. **No arregla el "tipo B"** (ver Deuda consciente): no era su causa |
| **C2** (2026-07-20) | El agente devolvía datos en vez de ids: precios/URLs mutaban al pasar por el LLM | `franco-n8n-v7.json` (activo en n8n, versionado en el repo). Schema `{messages, auto_ids}`, nodo `Hidratar autos` (Postgres) + `Armar respuesta` (Code) arman `product_cards`/`images` desde datos reales. Medido: 22/22 evals, `photo_urls_canonical` y `card_photo_matches_id` pasan por construcción (`--repeat 5` en los dos casos que ejercitan el camino nuevo, 5/5 estable). Queda una falla de parser conocida, ver Deuda consciente. |

## ⚠️ BLOQUEANTE — la demo está caída (2026-07-21, 22:20)

**Se agotó el crédito de la API key de OpenAI** (credencial `Demo key 2`, id `3rQJbWcRh84K3CCT`).
Error exacto en el log de n8n (ejecución **4392**, y en todas las posteriores):

```
Insufficient quota detected.   ← nodos OpenAI Chat Model / OpenAI Chat Model (CRM)
```

**Síntoma:** Franco contesta *"Uy, se me trabó el sistema un segundo. Me repetís lo último?"* a
**todo**, incluido un simple "hola". El blindaje de `Armar respuesta` funciona como fue
diseñado, pero no hay respuesta real. **Cualquier visitante de la demo ve esto.**

**Qué NO es:** no es v14, no es contención de TPM y no es lógica. `saludo-solo` no llama
ninguna tool y también falla. Se descartó contención relanzando la suite con `--delay 5000`:
volvió a fallar 29/29, y ahí el log dio el error real.

**Fix:** recargar saldo en la cuenta de OpenAI. No hay nada que tocar en el workflow.

**Consecuencia para los evals:** no hay `baseline-v14.json` — la corrida salió 100% roja por la
cuota y se descartó en vez de guardarla (habría quedado una baseline falsa). La última baseline
válida es **`baseline-v7.json`** (23/23) y la última corrida completa real es la de
**`baseline-v11.json` (25/27)**. Regenerar la de v14 apenas haya crédito.

---

## Abierto

**Orden de trabajo acordado (2026-07-21)**, por beneficio/costo *ponderado por certeza del
diagnóstico* — primero lo verificado y barato, último lo no verificado y caro:
**1)** historial fiel (M2) · **2)** color en `metadata` · **3)** tipo B · **4)** `km_max` +
política de fuera-de-presupuesto · **5)** trato por nombre de pila · **6)** fotos duplicadas.

| Prioridad | ID | Qué | Por qué importa |
|---|---|---|---|
| 1 | **criterio fuera de presupuesto: queda un ~1/3** (2026-07-21) | Con v14 la query ya le entrega los autos que cumplen el criterio aunque excedan el presupuesto, y Franco lo sabe. En ~1 de cada 3 corridas, en vez de mostrarlos **pregunta si los quiere ver** ("querés que te muestre algunas opciones que están por encima del presupuesto?"). No dice más "no tenemos". **Es defendible comercialmente**: decidir si se muestran directo o se pregunta es criterio de negocio, no un bug. Si se retoma, va por prompt y midiendo | Bajo. El "no hay opciones" (el problema real) está resuelto |
| 5 | **trato por nombre de pila** (2026-07-21, captura) | El cliente dice "Maximiliano Rodriguez" y Franco contesta "Listo Maximiliano Rodriguez, ...". Debe dirigirse **sólo por el nombre de pila** ("Gracias Maximiliano"), pero seguir **pidiendo y guardando nombre + apellido** | Suena a formulario, no a vendedor. **Es prompt legítimo** (trato = lenguaje), pero con riesgo de yo-yo contra los 5 reemplazos de "nombre y apellido" de 2026-07-20. Guardarraíles ya existentes: `text_matches "(?i)apellido"` en t2 y `field_matches nombre` en `lead_checks`. **Falta el check que lo caza** (hoy fallaría, como debe ser): `text_not_contains` del apellido en `derivacion-no-repite-asesor` t3 (`Miguez`), `nombre-con-apostrofe` (`D'Angelo`) y `control-nombre-sin-apostrofe` (`Dangelo`) |
| 4 | **el CRM guardó el teléfono como nombre** (2026-07-21, suite completa) | En `derivacion-no-repite-asesor` el lead quedó con `nombre = "+54 381 555-6175"` en vez de "Julieta Miguez". Es el mismo modo de falla que ya vigilan `field_not_matches nombre "^\\+54"` en los dos casos de apóstrofe — que esa corrida **sí** pasaron. **No es regresión de los cambios de hoy** (ninguno tocó el CRM ni `Guardar lead`); parece intermitente. **Reproducir con `--repeat` antes de tocar nada** | El asesor recibe un lead sin nombre real |
| 5 | **A2** | Config declarado pero no usado; 6 variables hardcodeadas en otro lado | Bloqueante para vender a la segunda concesionaria |
| 6 | revectorizar | `motor`/`transmisión`/`equipamiento` y `color` solo en el texto de `content`, no en `metadata`. Sumar además `descripcion` (prosa curada) y comparables estructurados (`tamano`/`largo_mm`) | Datos estructurados > texto interpretado. Absorbe el ítem 3 y desactiva el parche de prompt de "Recomendación por criterio" |
| 7 | **M1** | `Listar stock` sin `LIMIT` | Con 200 autos revienta contexto y costo |

Detalle completo de cada ID en `auditoria/AUDITORIA-FRANCO.md`.

## Decisiones tomadas

No re-proponer como pendientes: fueron evaluadas y decididas.

- **Tipo B ("respuesta sin cards"): diagnosticado y POSPUESTO a conciencia** (2026-07-21).
  Causa raíz confirmada en la ejecución **3681**: `Franco (AI Agent)` devolvió
  `output: { messages: [...] }` con la clave **`auto_ids` ausente** (no vacía: ausente), así
  que `Hidratar autos` armó `'{}'` y trajo 0 filas. El schema del parser usa
  `jsonSchemaExample`, que **no marca nada `required`**, y por eso un output sin `auto_ids`
  pasa la validación. **Frecuencia medida: 1 de 172 turnos** (check `media_si_lista_autos`
  aplicado a todas las respuestas guardadas, 0 falsos positivos). Con esa tasa, ningún fix es
  demostrable: distinguir 1/172 de 0/172 necesitaría cientos de corridas. Decisión de negocio:
  no vale el riesgo ni el tiempo ahora. **Los dos fixes evaluados, para cuando se retome:**
  (a) marcar `auto_ids` como `required` — riesgoso, puede convertir turnos sin autos en
  burbujas de fallback, igual que pasó con Auto-Fix Format (40% → 100%); (b) hacer
  `Hidratar autos` tolerante, recuperando por SQL los autos que Franco nombró en el texto
  cuando `auto_ids` viene vacío — puramente aditivo, en el peor caso queda como hoy.
  **Preferir (b).** El check `media_si_lista_autos` queda en ALWAYS vigilando: si la tasa sube,
  se va a ver solo.
- **Header auth: el frontend ya lo manda, n8n todavía no lo exige** (2026-07-19). Es el
  estado intermedio correcto y es seguro: n8n ignora headers desconocidos. Para activarlo,
  importar `franco-n8n-v6-auth.json` y crear la credencial Header Auth (ver
  `auditoria/C5-runbook.md`). Pospuesto a conciencia: datos ficticios de demo. **Revisar
  cuando entre el primer dato de un cliente real.** Al activarlo, los evals necesitan
  `FRANCO_TOKEN`.
- **`/api/leads` y `/api/sessions` abiertos a propósito.** El dueño tiene que ver el CRM
  llenándose en vivo durante la demo. `visible_ids` desde localStorage limita a cada
  visitante a sus propias sesiones más las `is_saved`.
- **`contextWindowLength` como literal `20`, no expresión al Config.** No se pudo probar si
  n8n acepta expresiones en campos numéricos, y es el nodo que ya tiró Franco entero cuando
  Supabase se pausó. Expresión lista para cuando se pruebe:
  `={{ $('Config').item.json.memoria_ventana_mensajes }}`.
- **`Guardar lead` usa escapado inline, no `queryReplacement`.** No hay certeza de que
  `$fromAI` sobreviva dentro de `queryReplacement`, y no valía meter una incógnita en el
  nodo que escribe los leads.

## Deuda consciente

Cosas que se rompieron a propósito. **No "arreglar" sin avisar.**

- **Structured Output Parser falla ~40-44% en pedidos fuera de rubro (2026-07-20).**
  Reproducido en `fuera-de-alcance` (`--repeat 8/10`, cuatro corridas). Causa raíz confirmada
  por log de n8n: el modelo a veces nombra la clave del array `"output"` en vez de
  `"messages"` — el resto de la respuesta es correcta (el chiste de siempre), pero el parser
  rechaza el objeto entero, `Franco (AI Agent)` devuelve `{error: "..."}` sin rastro del
  texto bueno, y `Armar respuesta` cae al fallback genérico ("Uy, se me trabó...") tal como
  está diseñado. Se probó activar "Auto-Fix Format" en el `Structured Output Parser` como
  fix — **empeoró a 100% de fallo (10/10)**, se revirtió a OFF y se remidió (vuelve a ~40%).
  Aceptado como deuda de bajo impacto en vez de seguir iterando a ciegas sobre el parser. El
  check `no_fallback_bubble` en `evals/run.mjs` (ALWAYS) lo deja visible en cualquier corrida
  futura. Pendiente si se retoma: probar un refuerzo puntual del nombre de la clave en la
  sección "Alcance" del prompt, midiendo antes/después.
- **`baseline-v7.json` es una corrida limpia de 23/23 (2026-07-20, post guard-fix), pero
  `fuera-de-alcance` es ~40% flaky.** Esa corrida pasó los 23, incluido `fuera-de-alcance`,
  que pasó por suerte (rama buena del parser). Una baseline futura puede pescarlo fallando por
  el bug de parser de arriba: es esperable, no una regresión. En corridas previas también se
  vieron `stock-general-completo` (timeout de red) y `memoria-presupuesto-5-turnos`
  (`cards_min: 0`) como rojos aislados; los dos se re-testearon (`--repeat 3` y `--repeat 5`,
  3/3 y 5/5) y son ruido de fondo de LLM/red, no un patrón. Regla: no repetir hasta que dé
  verde para maquillar la baseline; guardar la corrida real.
- **El guard de cierre comercial gana piso y pierde techo.** Garantiza que haya una pregunta,
  pero a veces reemplaza una mejor de Franco por la genérica — se vio en
  `permuta-mas-efectivo`, donde perdió la pregunta de dos caminos de la narrativa de permuta.
  **Acotado (2026-07-20):** ahora solo corre en turnos que mostraron autos (ver "guard fuera de
  contexto" en Cerrado), así que el "pierde techo" quedó limitado a esos turnos.
- **Respuestas sin cards: son DOS fenómenos distintos, no uno** (corregido 2026-07-21 con logs
  de n8n vía MCP; la versión anterior de esta nota los mezclaba).
  - **Tipo A — el parser.** Es el mismo bug de `fuera-de-alcance` ya documentado arriba.
    `Franco (AI Agent)` devuelve `{"error": "Model output doesn't fit required format"}`,
    `Hidratar autos` recibe `'{}'` y sale con `{json:{}}` (0 filas por `alwaysOutputData`), y
    `Armar respuesta` cae al fallback. Se ve como burbuja de fallback **+** 0 cards, y lo caza
    `no_fallback_bubble`. **Confirmado en la ejecución 3605**: 3 reintentos del agente
    (`maxTries: 3`), los 3 fallaron el parseo. La mayoría de los rojos de
    `stock-general-completo` son esto, no un bug de ids.
  - **Tipo B — no reproducido; la causa candidata es C2 (2026-07-21).** Texto real con los
    autos listados, sin burbuja de fallback, pero 0 cards. Visto en `permuta-mas-efectivo` y
    `memoria-presupuesto-5-turnos`.
    **REFUTADO — la divergencia `.item` / `.first()`.** Era la hipótesis viva: que
    `Hidratar autos` (`$('Franco (AI Agent)').item.json.output`) y `Armar respuesta`
    (`.first()`) resolvieran distinto cuando el agente reintenta y el nodo queda con varios
    runs. **El log de la ejecución 3605 la mata:** `Franco (AI Agent)` aparece con **un solo
    run** en `runData` pese a los 3 reintentos — `retryOnFail` NO crea runs adicionales del
    nodo, los reintentos se ven como subRuns de `Structured Output Parser` y
    `OpenAI Chat Model`. Con un único item y `pairedItem: {item: 0}`, `.item` y `.first()`
    resuelven al mismo sitio **siempre**. El "fix de una línea" habría sido un no-op.
    **Causa raíz estructural, verificada:** `armar_content()` en `revectorizar_con_consumo_v2.py`
    **no escribe el `id`** en el `content` vectorizado (el id vive solo en `metadata`), y
    `Buscar auto` es un `toolVectorStore`: le devuelve a Franco prosa resumida por un segundo
    LLM, no columnas. Confirmado en la ejecución **3626**: las dos llamadas a `Buscar auto`
    devolvieron fichas **sin ningún id**, y Franco igual emitió `auto_ids: [5, 15]` correctos
    — los **infirió de las URLs de las fotos** (`foto-5-1.webp` → 5). El id llega por un canal
    accidental que ningún contrato garantiza: el mismo sumarizador que reformateó el precio a
    `$34,000,000` puede omitir las URLs, y ahí `auto_ids` sale vacío con el texto perfecto y
    sin fallback = tipo B. Esto es un síntoma de **C2 de `auditoria/AUDITORIA-FRANCO.md`**
    (el toolVectorStore, todavía abierto), no un bug aparte.
    **No reproducido en 27 corridas** (2026-07-21): `permuta-mas-efectivo` 4/4,
    `stock-general-completo` 6/6, `typos` 3/3 y 10/10, `memoria-presupuesto-5-turnos` 4/4.
    Los 13 turnos que pasaron por `Buscar auto` trajeron las 6 imágenes: el canal accidental
    aguantó siempre. Los casos que van por `Listar stock` (que sí trae `id` como columna SQL)
    no pueden dar tipo B. También **descartada** la sub-hipótesis de que el agente respondiera
    de memoria sin llamar tool: el turno 6 de `memoria-presupuesto-5-turnos` ("volveme a
    mostrar opciones dentro de lo mío") trajo cards en las 4 corridas (5, 5, 6, 10).
    **RESUELTO EL DIAGNÓSTICO (2026-07-21, ejecución 3681).** Reproducido por fin en
    `stock-general-completo` (1 de 3 corridas), caso que va por `Listar stock` y **no** por
    `Buscar auto`. El log es inequívoco: `Franco (AI Agent)` devolvió
    `output: { messages: [...los 17 autos...] }` — **la clave `auto_ids` no vino vacía, vino
    AUSENTE**. `Hidratar autos` hace `(output.auto_ids) || []`, así que armó `'{}'`, la query
    trajo 0 filas y salió `{json:{}}`. La expresión de `Hidratar autos` funcionó bien: el
    problema está aguas arriba.
    **Mecanismo:** el `Structured Output Parser` está configurado con `jsonSchemaExample`, que
    genera un schema **sin campos `required`**. Un objeto con sólo `messages` pasa la
    validación. En 3681 se ven 2 subRuns del parser y 4 del chat model: el intento 1 fue
    rechazado y el intento 2 devolvió un objeto sin `auto_ids` que el parser **aceptó**. Por eso
    correlaciona con los reintentos sin que la causa sean los reintentos.
    **Lo que NO era:** ni la divergencia `.item`/`.first()` (refutada arriba), ni el
    `toolVectorStore` de `Buscar auto`. El fix de C2 (v8) es correcto y valioso por sus propios
    méritos, pero **no era la causa del tipo B** y no lo elimina.
    **Fix candidato, sin aplicar ni medir:** declarar `auto_ids` (y `messages`) como `required`
    en el schema del parser, pasando de `jsonSchemaExample` a schema manual. Es determinístico
    y no toca el prompt. **Riesgo a medir (trampa 11):** en turnos que legítimamente no muestran
    autos (saludo, FAQ, fuera de alcance) el modelo tiene que mandar `auto_ids: []`; si en vez
    de eso omite la clave, el parser pasaría a rechazar y caería al fallback — cambiaría un
    fallo silencioso por una burbuja de fallback. Medir `saludo-solo`, `datos-empresa`,
    `faq-financiacion-maximo` y `fuera-de-alcance` antes y después.
    **Instrumento nuevo:** check `media_min` en `evals/run.mjs` (cards + imágenes ≥ n) y
    `["media_min", 1]` en `typos`, que antes pasaba verde con 0 cards. No se usó `cards_min`
    ni `images_min` porque `Armar respuesta` manda cards con 3+ autos e imágenes con 1-2: un
    umbral fijo da rojos falsos según cuántos autos haya elegido Franco.
  - **Efecto lateral del gate del guard:** en tipo B la respuesta además queda sin pregunta de
    cierre (antes el guard la tapaba). Más visible ahora, pero la causa está aguas arriba.
- **`estado_cliente` está un turno atrasado.** `Leer lead (estado)` corre antes del agente,
  pero el CRM escribe después de responder. La ventana de memoria de 20 lo compensa.
- **Los evals están calibrados contra el stock de 17 autos.** `cards_min` y
  `price_max_in_text` asumen ese inventario. Si cambia el stock, dan rojos falsos.

## Incertidumbres

Cosas que no se pudieron verificar contra la base:

- **¿`metadata->'fotos'` existe como array?** `Detalle auto` tiene fallback a
  `foto_principal` con `jsonb_typeof`, así que degrada limpio si no. Confirmar al revectorizar.
- **¿El CRM necesita `gpt-4.1`?** Ahora recibe 750 tokens de texto limpio en vez de 9.200 de
  JSON crudo. `gpt-4.1-mini` probablemente alcance: más barato y con límite propio.
  Experimento de un minuto ahora que hay evals.
- **¿`CRM_PIN` es de exactamente 4 dígitos?** `PinModal` filtra a solo dígitos y corta en 4
  (`replace(/\D/g,'').slice(0,4)`, `maxLength={4}`). Si el valor en Render no cumple eso, el
  modal nunca puede mandar un PIN que coincida y el borrado da 403 para siempre — parece un
  bug del server, es una config incompatible. Confirmar borrando una sesión de prueba.
- **El PIN de 4 dígitos no tiene rate limiting.** 10.000 combinaciones, forzables con un
  script. Frena el `curl` a ciegas y el borrado accidental, no a alguien decidido.
  Dimensionado a propósito para una demo con datos ficticios; revisar junto con el header
  auth cuando entren datos de clientes reales.
- **Mínimo de financiación.** La FAQ solo tiene el máximo (50%). Decisión de negocio
  pendiente de Nicolás — Franco no puede dar un dato que no existe.

## Cómo verificar el estado

```bash
node scripts/state-sync.mjs            # chequea los 5 invariantes y actualiza este archivo
node scripts/state-sync.mjs --check    # solo chequea (sale 1 si algo falla)
node scripts/state-sync.mjs --file franco-n8n-v7.json   # audita un workflow antes de importarlo

FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs   # los 22 evals
```
