# Estado de Franco

Última actualización manual: **2026-07-21**

<!-- AUTOGENERADO: no editar a mano. Regenerar con: node scripts/state-sync.mjs -->

**Workflow en producción:** `franco-n8n-v19.json` · 35 nodos

| | |
|---|---|
| Webhooks | 6 (auth: ninguna) |
| Nodos Postgres | 15 |
| Tools de Franco | Listar stock, Buscar auto, Guardar lead, Detalle auto |
| Modelos | OpenAI Chat Model: gpt-4.1-mini · OpenAI Chat Model (CRM): gpt-4.1 |
| Ventana de memoria de Franco | 20 |
| Empresa configurada | Automotores Tucumán |
| Evals | 30 casos · baseline-v18.json → 27/30 |

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
| pendiente #1 | Franco inventaba datos que el cliente había dado ("efectivo", "Ka automático") | `Leer lead (estado)` + bloque `estado_cliente` en el prompt. La rama "efectivo" **se reabrió y se volvió a cerrar el 2026-07-21** — ver la fila de abajo |
| **"efectivo" inventado** (2026-07-21) | Cliente que entrega un usado y **nunca menciona plata** (`presupuesto`/`financia` = "No mencionado" en el lead) recibía *"opciones que con **tu efectivo** podrías cubrir"*. **Tres capas, todas verificadas.** **(1) El instrumento medía mal, dos veces:** el check vivía sólo en el turno 3 (la invención nace antes — se vio en t1 y t2) y prohibía el substring `"en efectivo"` a secas, que da **falso positivo** con la pregunta legítima *"tenés un monto aproximado en efectivo para sumar?"* — justo lo que Franco DEBE hacer. Con el check a secas la tasa medía ~12%; **re-puntuando las corridas guardadas con un patrón que distingue AFIRMAR de PREGUNTAR, la tasa real era 5/12 = 42%**. **(2) El prompt le dictaba la frase:** la sección `## Permuta` estaba escrita entera asumiendo que el efectivo existe y traía el guion literal *"con tu presupuesto, tu efectivo cubre el total de estas, y el valor de tu usado te queda a favor"*, disparado por la permuta sola. Evidencia decisiva (sesión `fd1a03aa`): Franco dijo *"Con tu presupuesto solo te doy la lista completa **porque no me diste un techo**, pero acá te paso opciones que podrías cubrir **en efectivo**"* — reconoce que no hay presupuesto **y aun así recita la plantilla**. Estaba copiando, no infiriendo; por eso las **dos** prohibiciones que ya existían no alcanzaban. **(3) Raíz determinística, documentada y NO tocada:** el `CASE` de `Listar stock` arranca con `WHEN precio_objetivo = 0 THEN 'entra'`, así que sin presupuesto los 17 autos salen `entra`, y el prompt traduce `entra` a "tu efectivo cubre el total" | **`franco-n8n-v16.json`** (`scripts/efectivo-sin-presupuesto.mjs`, pegado a mano y verificado byte a byte contra el workflow vivo por MCP). Gate arriba de `## Permuta` + la línea del guion acotada. **No agrega una tercera prohibición** — ya fallaron dos: le da una **narrativa correcta para recitar** en el caso sin presupuesto, en el mismo punto de uso donde recitaba la incorrecta, más el aviso de que `entra` **no** significa "le alcanza". Es el patrón del gate del guard de cierre, que ya le ganó al whack-a-mole. Aserciones: preserva los 4 puntos de la narrativa, la rama `estirar` (la que hace andar `permuta-mas-efectivo`), la regla `TRATO:` de v15, el `=` inicial y las 19 expresiones. Medido: **5/12 (42%) → 0/8**, controles **9/9** (`presupuesto-aproximado`, `rango-14-20`, `permuta-mas-efectivo`, 3/3 cada uno). El check quedó corregido en `cases.json`: corre en los 3 turnos y distingue afirmación de pregunta |
| **etiqueta `fuera` declarada — la mitad que le faltaba a v14** (2026-07-21) | Con presupuesto + un criterio ("tengo 13 millones" + "menos de 50.000 km"), Franco contestaba *"no hay opciones que entren dentro del presupuesto"* **teniendo los autos en la mano**. Medido: `km-con-presupuesto` **2/6**. **El SQL de v14 está perfecto:** en la ejecución **4986** Franco llamó a `Listar stock` **cuatro veces** y las cuatro devolvieron los 5 autos correctos (Ranger, S10, T-Cross, Vento, Onix) con `categoria: "fuera"`. **La causa: el prompt nunca declaró esa etiqueta.** Definía el vocabulario como lista CERRADA — `entra`, `estirar`, `economica` — y encima ordenaba *"Confiá en esa etiqueta, no compares precios vos"*. Franco recibía autos con una etiqueta desconocida, en un vocabulario donde ninguna significa "sirve", y sacaba la única conclusión coherente con lo que se le dijo. Las 4 llamadas seguidas eran él reintentando para encontrar algo "de verdad". **No fue regresión de v15–v18: el agujero existía desde v14**, y el 2/3 de entonces fue suerte de muestra chica | **`franco-n8n-v19.json`** (`scripts/etiqueta-fuera.mjs`, importado y verificado contra el workflow vivo). Declara `fuera` ("se pasa del presupuesto, PERO cumple el criterio"), explica que su sola presencia significa que SÍ existen opciones, **prohíbe decir "no hay opciones"** cuando llegan autos así, exige decir con todas las letras que se van del presupuesto, y le pide que **no reintente la tool** (si vinieron como `fuera` es porque no hay nada mejor). Va al prompt y no a SQL porque lo determinístico ya está resuelto desde v14: lo que faltaba era puramente lenguaje. Aserciones: preserva `TRATO` (v15), el gate de permuta (v16), y el detalle y la viñeta (v18). Medido: **2/6 → 6/6**, controles **10/10** (`presupuesto-aproximado`, `rango-14-20`, `presupuesto-en-dolares`, `km-maximo`, `permuta-mas-efectivo`) |
| **presentación del auto: viñeta, sin "usado", descripción primero** (2026-07-21) | Tres pedidos de Agustina. (1) Las listas salían en renglones pelados sin viñeta — y el desacuerdo era entre el prompt (que sólo pedía "un auto por renglón") y el check `cars_in_list_format` (que exigía viñeta): Franco cumplía el prompt y fallaba el check. (2) Franco decía *"Está en usado bueno"* pese a que el Paso 3 **ya** pedía no aclararlo: la tool le entregaba `condicion: "Usado"`, y no se puede prohibir un dato que le estás dando. (3) Al pedir info de un auto arrancaba por el motor, no por el porqué | **`franco-n8n-v18.json`** (`scripts/presentacion-auto.mjs`). (1) El prompt pide la viñeta explícitamente y ahora prompt y check dicen lo mismo. (2) **Por dato, no por prompt:** sale la columna `condicion` de las 3 tools y `Detalle auto` limpia el `content` con `regexp_replace`, porque el texto vectorizado trae *"Condición: usado."* embebido; además `gen-descripcion-sql.mjs` tiene una aserción que rechaza la palabra en las descripciones curadas (cazó 2 que se habían colado). `Hidratar autos` no se tocó: las cards de la UI quedan igual. (3) El Paso 3 arranca por `descripcion` y después va a la ficha, con `condicionantes` en UNA frase y sólo si viene al caso. **Tres cambios de prompt juntos, estirando la regla de uno por vez**, aceptable porque cada uno cae en una sección distinta y tiene su propio check. Medido: `recomendacion-por-tamano` en verde, `detalle-un-auto-fotos` **3/3**, `descripcion-que-aporta` 2/3 → **3/3**. El check de "usado" se corrigió dos veces: excluye `tu/su/un/una/el/la/los/las/mi + usado` (el auto que entrega el cliente es un uso legítimo), verificado con 12 casos |
| pendiente #5 | El `¿` reaparecía pese al prompt | strip por código |
| cierre comercial | Se perdía cuando había 1-2 autos (el guard solo cubría 3+ cards) | guard extendido a toda respuesta |
| guard fuera de contexto (2026-07-20) | El guard le pegaba la pregunta genérica de venta a **todo** turno que no terminara en `?`: al despedirse ("gracias, estoy bien" → "querés un asesor?" x3) y después de derivar ("le paso tu nombre a un asesor" → "querés un asesor?"). Franco ya cerraba y derivaba bien solo; el string era byte-idéntico al hardcodeado en `Armar respuesta` | El guard ahora **solo corre si el turno mostró autos** (`autos.length >= 1 && !texto.endsWith('?')`), que es su propósito original: no dejar una lista de autos sin próximo paso. Primero se probó una heurística de markers de despedida y quedó corta (no cubría la derivación); se reemplazó por el gate, que cubre todos los turnos sin autos sin whack-a-mole. Medido con `analiza-guard`: disparos espurios **2 → 0**, los legítimos intactos. Evals `cierre-conversacion` y `derivacion-no-repite-asesor` |
| nombre y apellido (2026-07-20) | Pedía solo el nombre para derivar al asesor | 5 reemplazos asertados en el prompt. Eval `derivacion-no-repite-asesor` |
| recomendación por criterio (2026-07-20) | Pidiendo "cambiar el Mobi manteniendo el tamaño", encabezaba con un **Cronos** (4,36 m vs 3,57 m), en párrafo corrido y justificando con algo falso ("todos son autos compactos"). Reproducido 3/3, cada corrida fallando por un síntoma distinto: no había ninguna política para recomendar con restricción, así que improvisaba | Sección nueva `## Recomendación por criterio` en el prompt: primero los que cumplen, tamaño según `carroceria` de la ficha (no de memoria), motivo corto por auto sacado de la ficha, lo que no cumple va en grupo aparte y explícito, sin repetirle al cliente su intención. Eval `recomendacion-por-tamano` (3/3 fallando → **4/4 estable**) |
| **C5 (proxy)** | El PIN de borrado vivía en el bundle; `POST /api/session-delete` borraba sin autenticación | PIN validado en Express contra `CRM_PIN`, **falla cerrado**. Verificado en producción: 403 |
| **C5 (header)** | El frontend no mandaba header de auth a n8n | Manda `X-Franco-Auth` en las 3 rutas, incluidos los GET. n8n todavía **no lo exige** (estado intermedio correcto) |
| **criterio fuera de presupuesto** (2026-07-21) | Con un presupuesto activo, al agregar un criterio (ej: "menos de 50.000 km") Franco contestaba "no tenemos opciones" aunque existieran, más caras. Reproducido en `km-con-presupuesto` **0/4**. **Tres intentos, todos medidos:** v12 puso una política en el prompt (1/4, y una vez presentó el Cronos de 58k como si cumpliera) → **revertido**; v13 agregó `km_max` a las tools (2/4) → el log 3963 mostró que el filtro andaba pero la **combinación** presupuesto+km daba `response: []`, y desde ahí Franco no sabía que los autos existían; v14 lo resolvió en SQL | **`franco-n8n-v14.json`** (`scripts/criterio-sin-resultados.mjs`): en `Listar stock` el techo de precio pasa de filtro duro a **preferencia**. El criterio del cliente (km) filtra siempre; si con presupuesto no queda nada, un `UNION ALL … WHERE NOT EXISTS` devuelve igual los que cumplen con `categoria='fuera'`. El `CASE` de categoría se conservó byte a byte; `precio_num` queda dentro del CTE para no sumar tokens. **⚠️ CORRECCIÓN (2026-07-21): esta fila decía que `fuera` "es la etiqueta que el prompt ya sabe leer". ERA FALSO y nunca se verificó — el prompt no mencionaba la palabra ni una sola vez, y declaraba el vocabulario de categorías como lista cerrada de tres. v14 arregló el dato y dejó el lenguaje sin hacer; el 2/3 que se midió fue suerte de muestra chica. Ver "etiqueta `fuera` declarada" abajo.** Medido: `km-con-presupuesto` **2/3** (el "no hay opciones" desapareció; queda un ~1/3 donde pregunta antes de mostrar, ver Abierto), controles de presupuesto **15/15** (`presupuesto-aproximado`, `rango-14-20`, `permuta`, `memoria`). `km_max` (v13) queda en las tools: `km-maximo` sigue 3/3 |
| **fotos repetidas** (2026-07-21) | `Armar respuesta` armaba `images` desde `auto_ids` en cada turno, sin noción de "ya mostrado": si el cliente seguía preguntando por el mismo auto ("cuál es el consumo?"), Franco reenviaba las mismas 3 fotos. Quedaba robótico. Eval `fotos-no-repetidas` **0/5**, siempre 3 imágenes repetidas en el turno 2 | Nodo nuevo `Autos ya mostrados` (Postgres) entre `Hidratar autos` y `Armar respuesta`: saca de las URLs de las `images` de los **últimos 8 mensajes** qué autos ya tienen fotos enviadas (`foto-2-1.webp` → 2). `franco-n8n-v11.json` (`scripts/fotos-no-repetidas.mjs`, 34 → 35 nodos). **Dos límites deliberados:** (1) sólo mira `images` previas, NO `product_cards` — ver la ficha con fotos después de la miniatura es un flujo válido; (2) sólo filtra en la rama de 1-2 autos, nunca en listas de 3+, que si no saldrían incompletas. El guard de cierre sigue usando la lista completa. Si el nodo falla, no se filtra nada (mejor repetir una foto que ocultar un auto). Medido: `fotos-no-repetidas` **0/5 → 3/3** (`t2` de 3 a 0 imágenes), y los límites verificados: `detalle-un-auto-fotos` 3/3 (`t1` 6 cards → `t2` 3 fotos) y `stock-general-completo` con las 17 cards completas |
| **color en `metadata`** (2026-07-21) | `armar_metadata()` nunca guardó `color`: sólo vivía en el texto de `content`, y las tools leen `metadata`. Franco podía describir el color de UN auto (lo leía de la ficha) pero no listar todos los grises — contestaba literalmente *"no tengo un filtro específico por color automático"*. Eval `color-gris` **0/3** | **(1)** `scripts/color-metadata.sql` (generado desde `stock.csv` por `gen-color-sql.mjs`): `UPDATE` aditivo e idempotente que suma la clave `color` al jsonb. **No toca `content` ni `embedding`** — no hizo falta revectorizar. **(2)** `franco-n8n-v10.json` (`scripts/color-en-tools.mjs`): `color` como columna en `Listar stock`, `Buscar auto` y `Detalle auto`, y filtro en `Buscar auto` por **dos caminos** (parámetro `color` explícito + color sumado al concat del ILIKE), para no depender de que el modelo elija bien el parámetro. El script verifica automáticamente la **trampa 3** sobre las 18 keys `$fromAI` del workflow. Medido: `color-gris` **0/3 → 3/3**, con `product_cards` = `[1,4,5,11,14]` exacto en las 3 corridas (los 5 grises, cero colados) |
| **M2 / historial fiel** (2026-07-21) | **Franco SÍ saludaba** — el bug nunca fue el saludo. `Armar respuesta` devolvía dos objetos: `respuesta.messages = finalMsgs` (lo que ve el cliente) e `historial.messages = messages`, la variable **previa** a todo el post-proceso. Como `Guardar mensajes (historial)` persiste `historial` en `mensajes_demo` y de ahí sale la pestaña **Historial**, el dueño veía una conversación sin saludo, sin la pregunta de cierre del guard y con los `¿` que el cliente nunca vio. Detectado por dos capturas independientes (saludo faltante y `¿` presente), las dos predichas por el código | `historial: { messages: finalMsgs, images: finalImgs, product_cards }` (`franco-n8n-v9.json`, `scripts/m2-historial-fiel.mjs`, aplicado a mano). **Instrumento nuevo**, que era el agujero de fondo: el runner ahora lee `mensajes_demo` vía `/webhook/session-messages` y soporta `history_checks` (`first_bubble_greeting`, `no_apertura`, `bubbles_min`) — antes **todos** los checks miraban sólo la respuesta del webhook, por eso el bug vivía sin que nadie lo viera. Medido: `saludo-solo` **0/2 → 3/3**, con historial y respuesta byte a byte iguales. El `historial` de `fallback()` se dejó intacto a propósito: ya era fiel. **No se tocó `esPrimero`** |
| **C2 (auditoría)** (2026-07-21) | `Buscar auto` era un `toolVectorStore`: le pasaba las fichas a su **propio LLM**, que las resumía, antes de dárselas a Franco. El `content` vectorizado no tiene el `id` (`armar_content()` no lo escribe), así que el id le llegaba a Franco sólo por un canal accidental: las URLs de las fotos (`foto-5-1.webp` → 5), como se ve en la ejecución 3626 | `franco-n8n-v8.json`, generado por `scripts/c2-buscar-auto-postgres.mjs` con aserciones (37 → 34 nodos: caen `Supabase Vector Store`, `Embeddings OpenAI` y `OpenAI Chat Model (Tool)`). `Buscar auto` pasa a `postgresTool` y devuelve **filas crudas con `id`**, igual que `Listar stock`; `typeVersion` y credenciales copiadas de un nodo que ya funcionaba (trampas 6 y 7), `precio_min`/`precio_max` byte-idénticos (trampa 3), texto sanitizado a alfanuméricos en vez de escapado. Aplicado en producción y medido: `typos` 3/3, `detalle-un-auto-fotos` 3/3, `lead-sin-nombre` 3/3 (4 cards con las 4 pickups reales), control `permuta` 3/3 y `memoria` 3/3. Verificado en la ejecución **3677**: la tool devuelve las filas con `id` y Franco los **copia** en vez de inferirlos; el nodo baja de ~8.300 ms a **20 ms** y desaparece un LLM de la ruta. **No arregla el "tipo B"** (ver Deuda consciente): no era su causa |
| **trato por nombre de pila** (2026-07-21) | El cliente decía "soy Martín D'Angelo" y Franco contestaba "Perfecto Martín **D'Angelo**, le paso tu nombre a un asesor". Suena a formulario, no a vendedor. **La forma del bug no era la de la captura:** depende de CÓMO llega el nombre. Dentro de una frase ("soy Martín D'Angelo, quiero que me contacte un asesor") eco-a el string entero casi siempre; como respuesta a un pedido explícito ("Julieta Miguez") acorta bien la mayoría. Por eso la suite casi no lo cazaba y la captura sí. Antes medido: `nombre-con-apostrofe` **0/3**, `control-nombre-sin-apostrofe` **1/3**, `derivacion-no-repite-asesor` **3/3** (acá el check ya pasaba; su rojo fue `no_fallback_bubble`, el parser) | **`franco-n8n-v15.json`** (`scripts/trato-nombre-de-pila.mjs`, pegado a mano y verificado byte a byte contra el workflow vivo por MCP). **Un** bullet nuevo en `# Derivación a un asesor`, pegado al cierre cuyo ejemplo ("listo Julio") ya era correcto: separa **pedir/guardar** (nombre + apellido) de **dirigirse** (nombre de pila), y nombra explícitamente el caso de la frase. **No toca ninguno de los 5 refuerzos de "nombre y apellido"** de 2026-07-20 — las aserciones exigen que sobrevivan (7 → 8 menciones, ninguna reemplazada), más el `=` inicial y las 19 expresiones `{{ }}`. Va al prompt y no a código a propósito: partir "Martín D'Angelo" en nombre/apellido **no es determinístico** (apellidos compuestos, "de la Vega", nombres de pila dobles), así que no aplica la regla del proyecto. Medido: **0/3 → 3/3**, **1/3 → 3/3**, **3/3 → 3/3**. **Guardarraíl verificado, que era el riesgo de yo-yo:** el apellido se sigue guardando **9/9** (`Martín D'Angelo`, `Martin Dangelo`, `Julieta Miguez`) y Franco lo sigue pidiendo (`text_matches "(?i)apellido"` en t2, verde) |
| **apóstrofe literal: desestimado como falla** (2026-07-21) | `nombre-con-apostrofe` exigía `field_matches nombre "D'Angelo"` y el check nuevo de trato usaba `text_not_contains ["D'Angelo"]`: si el apóstrofe se perdiera en el camino, daban rojo | Decisión de Agustina: en entorno de demo es cosmético y muy eventual. Los patrones pasan a **`(?i)d.?angelo`**, que matchea `D'Angelo`, `DAngelo` y `D Angelo` por igual. **C1 sigue cubierto**: lo que detecta C1 no es la ortografía sino que **el lead se guarde**, y eso lo vigila `field_not_matches nombre "^\\+54"` (si la comilla rompe el INSERT no hay fila y queda el placeholder del teléfono). Sin efecto sobre las mediciones: el apóstrofe sobrevivió **7/7** en las 4 baselines más la corrida previa, y las 3 respuestas del "antes" decían `D'Angelo` con apóstrofe, así que también matchean el patrón nuevo |
| **revectorización — `descripcion`, `condicionantes`, `tamano`** (2026-07-21) | Franco sólo tenía la ficha técnica, así que al recomendar decía "1.6L, 106 HP, 71.000 km": datos, no criterio. No podía explicar POR QUÉ un auto le convenía a un cliente ni advertir un límite real. Además el tamaño para comparar ("algo del tamaño de mi Mobi") se infería de `carroceria` por un parche de prompt | **(1) `scripts/descripcion-metadata.sql`** (generado por `gen-descripcion-sql.mjs` desde `stock.csv`): `UPDATE` aditivo e idempotente que suma tres claves al jsonb. **No toca `content` ni `embedding`** — no hizo falta revectorizar de verdad, mismo mecanismo que el color. **Los superlativos de cada descripción se verifican contra `stock.csv` en el generador** (21 aserciones): cazó 3 afirmaciones falsas antes de que salieran ("el Gol Trend es el más barato" → es el Fiesta; "la Hilux es la pickup más barata" → es la Amarok; "la Ranger es la más nueva" → empata con el T-Cross). Si el stock cambia y una deja de ser cierta, el script **falla** en vez de generar una mentira que Franco le diría a un cliente. **(2) `franco-n8n-v17.json`** (`scripts/descripcion-en-tools.mjs`): `tamano` en las 3 tools; `descripcion` + `condicionantes` **sólo** en `Detalle auto` y `Buscar auto`. El reparto es deliberado: `Listar stock` trae los 17 autos y la prosa serían ~1.500 tokens por llamada (trampa 5), y en un listado de 17 el cliente lee precios, no prosa. Verificado en la **ejecución 4824**: la tool devuelve la prosa curada de los 4 hatchbacks. **No se tocó el prompt a propósito**, para medir qué hacía Franco solo: lo usa **2 de 3 veces** y cuando lo usa lo usa bien (*"ideal para caminos ripio, tiene despeje alto, pero tené en cuenta que la potencia es justa para su tamaño"*). El tercio restante queda en Abierto. **`largo_mm` NO se cargó**: habría que inventar 17 medidas exactas y un número inventado es peor que ninguno, porque Franco lo afirma como dato de ficha. `tamano` (chico/mediano/grande) cubre el caso del Cronos-vs-Mobi, que era para lo que se lo quería |
| **C2** (2026-07-20) | El agente devolvía datos en vez de ids: precios/URLs mutaban al pasar por el LLM | `franco-n8n-v7.json` (activo en n8n, versionado en el repo). Schema `{messages, auto_ids}`, nodo `Hidratar autos` (Postgres) + `Armar respuesta` (Code) arman `product_cards`/`images` desde datos reales. Medido: 22/22 evals, `photo_urls_canonical` y `card_photo_matches_id` pasan por construcción (`--repeat 5` en los dos casos que ejercitan el camino nuevo, 5/5 estable). Queda una falla de parser conocida, ver Deuda consciente. |

## Abierto

**Orden de trabajo acordado (2026-07-21)**, por beneficio/costo *ponderado por certeza del
diagnóstico* — primero lo verificado y barato, último lo no verificado y caro:
**1)** historial fiel (M2) · **2)** color en `metadata` · **3)** tipo B · **4)** `km_max` +
política de fuera-de-presupuesto · **5)** trato por nombre de pila · **6)** fotos duplicadas.

| Prioridad | ID | Qué | Por qué importa |
|---|---|---|---|
| 1 | **criterio fuera de presupuesto: queda un ~1/3** (2026-07-21) | Con v14 la query ya le entrega los autos que cumplen el criterio aunque excedan el presupuesto, y Franco lo sabe. En ~1 de cada 3 corridas, en vez de mostrarlos **pregunta si los quiere ver** ("querés que te muestre algunas opciones que están por encima del presupuesto?"). No dice más "no tenemos". **Es defendible comercialmente**: decidir si se muestran directo o se pregunta es criterio de negocio, no un bug. Si se retoma, va por prompt y midiendo | Bajo. El "no hay opciones" (el problema real) está resuelto |
| 6 | **no aclarar que el auto es usado/seminuevo** (2026-07-21, pedido de Agustina — sin diagnosticar ni medir) | Franco no tiene que decir "usado" ni "seminuevo": se entiende solo por los km y el año que ya muestra en cada auto. Decirlo suena defensivo y baja el valor percibido. **Es prompt legítimo** (trato = lenguaje). Antes de tocar: convertirlo en check (`text_not_matches "(?i)\\b(usado\\|seminuevo)\\b"` en las respuestas donde Franco presenta stock) y verificar que falle. **Ojo con el falso positivo:** "tu usado" es correcto y necesario cuando habla del auto que el cliente entrega en permuta — el check tiene que excluir ese caso, no prohibir la palabra entera | Cosmético pero de percepción de marca, y barato |
| 5 | **A2** | Config declarado pero no usado; 6 variables hardcodeadas en otro lado | Bloqueante para vender a la segunda concesionaria |
| 3 | **revectorización: falta consistencia** (2026-07-21) | `descripcion`, `condicionantes` y `tamano` ya están en producción (ver Cerrado). Franco los usa **2 de 3 veces**; en el tercio restante vuelve a recitar la ficha técnica. Eval `descripcion-que-aporta` (**2/3**, tiene que llegar a 3/3). El fix es prompt: una regla que le diga que al presentar un auto arranque por el porqué y no por el motor. **Ojo al escribirla:** cuando la usa, la usa BIEN (*"ideal para caminos ripio, tiene despeje alto, pero tené en cuenta que la potencia es justa"*) — la regla tiene que empujar la consistencia sin convertir el condicionante en lista de defectos, que espantaría al cliente | Es lo que separa "planilla que habla" de "vendedor". Es el valor entero de la revectorización |
| 7 | **M1** | `Listar stock` sin `LIMIT` | Con 200 autos revienta contexto y costo |

Detalle completo de cada ID en `auditoria/AUDITORIA-FRANCO.md`.

## Decisiones tomadas

No re-proponer como pendientes: fueron evaluadas y decididas.

- **"El CRM guardó el teléfono como nombre": NO ERA UN BUG DEL CRM. Cerrado** (2026-07-21).
  Estaba listado como pendiente por un lead con `nombre = "+54 381 555-6175"` en vez de
  "Julieta Miguez" (`derivacion-no-repite-asesor`, corrida de `baseline-v11`). **Era una cola
  de latencia del bloque CRM async, leída como dato corrupto.** Medido:
  - Reproducción aislada (`--case derivacion-no-repite-asesor --repeat 5 --delay 3000`):
    **5/5 ok**, `nombre = "Julieta Miguez"` las 5 veces, resuelto en el **primer poll**
    (2751–3171 ms, con `INTERVAL_MS` de 2500).
  - La corrida que falló tiene `leadWaitMs: 31071` — **agotó el `DEADLINE_MS` de 30 s entero**.
    Mediana de las 4 baselines: 2,8–3,2 s; máximo de v14: 3371 ms. Es **el único outlier en
    38 observaciones** de `lead_checks`.
  - La fila que el runner alcanzó a leer refleja el **turno 2, no el 3**: `estado` =
    `Requiere asesor` y `resumen` = "Quiere que lo contacte un asesor por Toyota Etios",
    sin rastro del turno donde el cliente da el nombre.

  El teléfono en `nombre` **es el placeholder correcto** de `Guardar lead` para un lead que
  todavía no se presentó (`CASE WHEN '<nombre>' = '' THEN '+54 381 555-' || lpad(...)`); el
  `ON CONFLICT` lo pisa en cuanto el CRM manda un nombre no vacío, y lo pisó bien 5/5. El
  nombre nunca estuvo mal: la fila estaba vieja cuando se la leyó. Por eso los dos casos de
  apóstrofe con `field_not_matches nombre "^\\+54"` pasaron en esa misma corrida — no
  comparten el modo de falla, comparten la pinta (**trampa 10**).
  **No se tocó nada del workflow**: no hay bug de datos que arreglar.
  **Lo que sí se arregló fue el instrumento**, que era el problema de fondo: `run.mjs`
  imprimía igual un timeout de poleo y un dato corrupto. Ahora marca `leadTimedOut` y
  prefija la falla con `lead TIMEOUT (...la fila leída puede ser de un turno anterior...)`.
  **Queda una incertidumbre honesta:** no se puede probar que la escritura del turno 3 haya
  llegado después de los 31 s, porque el `cleanup` borró la sesión. En producción nadie
  borra la sesión a los 30 s, así que el riesgo comercial que este ítem declaraba ("el
  asesor recibe un lead sin nombre real") **no está sostenido por la evidencia**.
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
- **`baseline-v15` es 27/29, pero NO son las mismas dos fallas que en v14 (2026-07-21).**
  El número coincide y eso invita a leerlo como "todo igual". No lo es. En v15 las dos deudas
  conocidas (`memoria-presupuesto-5-turnos` y `fuera-de-alcance`) **pasaron**, y los dos rojos
  fueron otros — los dos re-testeados en verde inmediatamente:
  - `km-maximo` — `ERROR: The operation was aborted due to timeout` (el abort de 90 s del
    runner). Re-test **3/3 en 4,5–6,6 s**: ruido de red, misma clase que el timeout de
    `stock-general-completo` ya documentado.
  - `no-inventar-datos-del-cliente` — `text_not_contains: "tu efectivo"` en el turno 3
    ("...opciones que podrías cubrir con tu efectivo"). Pasaba en v11 y v14, así que era
    **candidata a regresión del cambio de prompt de v15**. Re-test con el prompt nuevo ya
    vivo: **5/5 limpio**. Flake de ~1/6, no regresión. Es el mismo modo de falla de
    "pendiente #1" (inventar la forma de pago), que quedó latente y no del todo muerto.
  Regla que esto confirma: **comparar el número de una baseline contra otra no dice nada si
  no se compara la composición.** Un 27/29 puede esconder dos deudas resueltas y dos flakes
  nuevos.
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
- **La cuota de OpenAI se agotó en producción el 2026-07-21** y tiró la demo entera: todas
  las ejecuciones fallaban con `Insufficient quota` y Franco contestaba la burbuja de
  fallback a cualquier mensaje, incluido "hola" (ejecución **4392**). Se recargó y volvió a
  la normalidad. **Cómo reconocerlo rápido:** si TODOS los casos fallan a la vez, incluido
  `saludo-solo` (que no llama ninguna tool), no es lógica ni contención de TPM — es la
  cuenta. Se descarta contención relanzando con `--delay`; si igual falla todo, leer el log
  y buscar `Insufficient quota`. Correr la suite completa consume cuota real: un día de
  diagnóstico intensivo fueron ~250 turnos.

## Cómo verificar el estado

```bash
node scripts/state-sync.mjs            # chequea los 5 invariantes y actualiza este archivo
node scripts/state-sync.mjs --check    # solo chequea (sale 1 si algo falla)
node scripts/state-sync.mjs --file franco-n8n-v7.json   # audita un workflow antes de importarlo

FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs   # los 22 evals
```
