# Handoff — sesión nueva

Prompt para arrancar una sesión nueva de Claude Code en esta carpeta.
Generado 2026-07-21. Si ya pasó tiempo, `docs/franco/STATE.md` manda sobre este archivo.

---

Vas a seguir trabajando sobre **Franco**, un agente vendedor de autos para concesionarias.
Backend en n8n, frontend React en Render. Se lo muestra a dueños de concesionarias como
producto a vender, así que un bug en vivo tiene costo comercial.

## Leé esto antes de tocar nada

1. `CLAUDE.md` — las 5 trampas de n8n, la regla del proyecto, el método de diagnóstico.
2. `docs/franco/STATE.md` — **es la fuente de verdad**. Está actualizado al día de hoy con
   evidencia medida, incluida una corrección importante sobre el bug que está abierto.
3. `auditoria/AUDITORIA-FRANCO.md` — los 21 hallazgos con IDs estables.

*Ojo con los IDs:* en AUDITORIA-FRANCO.md, C2 es "doble LLM en serie sobre los datos del
stock" (el `toolVectorStore` de Buscar auto) y **sigue abierto, sin resolver**. En STATE.md y
en el trabajo reciente, C2 es "el agente devuelve ids en vez de datos" — esa ya está cerrada.
Son cosas distintas con el mismo ID.

---

## Arrancá por acá

**Empezá por el bug tipo B** (abajo). Es el arranque óptimo por tres razones: está diagnosticado
al 80% y falta una sola medición decisiva; el paso que falta es barato (una corrida de evals y
la lectura de un log); y el desenlace más probable es un fix de una línea. Además es el bug más
caro de los abiertos: hace que el cliente vea una respuesta **sin fotos ni cards**, que es
justamente lo que el dueño de la concesionaria está comprando. La demo está en uso, así que
esto está pasando en vivo.

No arranques por la revectorización ni por A2: son más grandes, y dejar el tipo B a medio
diagnosticar tira el contexto que ya está construido.

## El bug tipo B

La sesión anterior se quedó sin shell justo cuando iba a cerrarlo. Está todo el contexto en
STATE.md (sección "Deuda consciente" → "Respuestas sin cards"), pero el resumen es:

Hay respuestas que llegan **sin cards ni fotos**. Son **dos fenómenos distintos**, y la
sesión anterior los había mezclado antes de corregirlo con logs:

- **Tipo A — confirmado.** Es el bug del Structured Output Parser ya documentado como deuda.
  `Franco (AI Agent)` devuelve `{"error": "Model output doesn't fit required format"}` y
  `Armar respuesta` cae al fallback. Se ve como **burbuja de fallback + 0 cards**, y lo caza
  el check `no_fallback_bubble`. Confirmado en la ejecución 3605 (3 reintentos, los 3
  fallaron el parseo). **No es lo que hay que arreglar ahora.**
- **Tipo B — sin confirmar, ES ESTO.** Texto real con los autos listados, **sin** burbuja de
  fallback, pero 0 cards. Visto en `permuta-mas-efectivo` y `memoria-presupuesto-5-turnos`.

Corré esto:

```bash
FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs --case permuta-mas-efectivo --repeat 4 --no-cleanup
```

Buscá una corrida que falle `cards_min` **sin** fallar `no_fallback_bubble` — esa es tipo B.
Anotá su `session_id` (sale en el `--json`).

Después leé la ejecución en n8n. **Tenés MCP de n8n con acceso de lectura**: workflow
`Khct6BjiMNXZK5Oi` ("Franco Master - Demo Render (Fase 2)", activo). Usá `search_executions`
acotando por hora y después `get_execution` con
`nodeNames: ["Webhook Render", "Franco (AI Agent)", "Hidratar autos"]` y `truncateData: 2`
(sin filtrar, el payload es enorme y te come el contexto).

**Aviso para no perder tiempo:** el frontend de Render manda tráfico real todo el tiempo, así
que en la lista de ejecuciones vas a ver muchas que no son tuyas. Las tuyas **no** traen el
header `x-franco-auth`; las del frontend sí. Filtralas por ahí en vez de adivinar por hora.

**El dato que decide, y son dos fixes completamente distintos:**

- Si `Franco (AI Agent)` trae `auto_ids` con ids **y aun así** `Hidratar autos` sale con
  `{json:{}}` → el problema es la expresión de `Hidratar autos`, que usa
  `$('Franco (AI Agent)').item.json.output` mientras `Armar respuesta` usa `.first()`.
  Fix de una línea.
- Si `auto_ids` viene vacío aunque el texto liste autos → es el prompt.

**Ya está descartado** que el `.item` falle en el camino normal: las ejecuciones sanas 3579 y
3592 muestran a Franco emitiendo un solo item con `pairedItem` limpio y `Hidratar autos`
trayendo las filas bien. Si el `.item` estuviera roto fallaría siempre, no de a ratos. La
hipótesis viva y más precisa es que `.item` y `.first()` divergen **cuando el agente
reintenta** (`retryOnFail`, `maxTries: 3`), porque el nodo queda con varios runs — lo que
ataría la intermitencia a los reintentos. **Confirmalo con el log antes de tocar nada.**

---

## Qué se cerró en la sesión anterior (todo medido)

| Qué era | Cómo se resolvió | Medición |
|---|---|---|
| **C2 fase 1** — el agente devolvía datos en vez de ids | `franco-n8n-v7.json`, ya versionado en el repo (no existía). Schema `{messages, auto_ids}` + `Hidratar autos` + `Armar respuesta` | 22/22, después 23/23 |
| **Guard fuera de contexto** — pegaba "querés un asesor?" al despedirse y después de derivar | El guard ahora solo corre si el turno mostró autos: `autos.length >= 1 && !texto.endsWith('?')` | disparos espurios **2 → 0** |
| **Nombre y apellido** — pedía solo el nombre | 5 reemplazos asertados en el prompt | eval 2/2 |
| **Recomendación por criterio** — encabezaba con un Cronos (4,36 m) a quien pidió mantener el tamaño de un Mobi (3,57 m), en párrafo corrido y justificando con algo falso | Sección nueva `## Recomendación por criterio` en el prompt | 3/3 fallando → **4/4 estable** |

Todo eso está aplicado **en el n8n en vivo y en el repo**. La única diferencia entre ambos son
3 líneas de comentario en el nodo `Armar respuesta` que no se pegaron — cosmético.

**Evals:** hay 25 casos (se agregaron `cierre-conversacion`, `derivacion-no-repite-asesor` y
`recomendacion-por-tamano`). `evals/baseline-v7.json` es de cuando había 23 — **está
desactualizada**, regenerala cuando cierres un bloque.

**Checks nuevos en `evals/run.mjs`:** `no_fallback_bubble` (corre en ALWAYS),
`not_ends_with_question`, `first_car_in`, `cars_in_list_format`.

---

## Cómo se trabaja acá

**Evals: solo los necesarios.** Corré los casos que toca el cambio, más 2-3 que puedan hacer
yo-yo con ese cambio puntual. La suite completa (25 casos, 4+ min) se reserva para cerrar un
bloque o actualizar la baseline. La **repetición** importa más que la cantidad de casos: varios
bugs de este proyecto son intermitentes y una sola corrida verde no prueba nada — usá
`--repeat N`.

**Reglas que no se negocian:**
- Medir antes y después de cada cambio. Sin corrida previa no hay línea de base.
- **Un cambio por vez.** Los cambios de prompt y los de código se miden por separado: en este
  proyecto tocar el prompt produce el patrón yo-yo.
- Un bug nuevo se convierte en caso de eval **antes** de arreglarlo, y **tiene que fallar
  primero**. Si no falla, no entendiste el bug.
- Los checks `manual` no cuentan como falla, pero **leelos**: ahí se escondió la burbuja de
  fallback durante una corrida entera.
- Leé el log de ejecución de n8n **antes** de teorizar.
- Actualizá `docs/franco/STATE.md` como parte del cambio, no después.

**Cómo se aplican los cambios en n8n:** los pega Agustina a mano. Vos preparás el cambio en
`franco-n8n-v7.json` (programáticamente, con aserciones tipo `build-v7.mjs`: si el texto no
matchea exacto, error) y le pasás el find/replace exacto para el nodo correspondiente.
**No uses `update_workflow` del MCP:** exige el workflow entero como código SDK y lo reescribe,
lo que pisa las trampas 6 y 7 (inventar `typeVersion`, credenciales en placeholder que dejan
los 6 webhooks sin registrar). El MCP se usa **solo para leer**.

---

## Trampas nuevas, aprendidas a los golpes (sumar a las 5 de CLAUDE.md)

6. **No inventes `typeVersion`.** Copiá siempre la versión de un nodo del mismo tipo que ya
   funcione en esa instancia.
7. **Una credencial con id en placeholder impide ACTIVAR el workflow**, y el síntoma que se ve
   es "no encuentra la URL", porque un workflow inactivo no registra su webhook de producción.
8. **Verificá el payload de tus propias sondas.** El webhook espera
   `{session_id, type, content, timestamp}`.
9. **Chequeá tu instrumento antes de culpar al sistema.** Un check exigía 3 ítems de lista
   *siempre*, y marcaba en rojo una respuesta correcta (un solo auto recomendado en prosa). El
   check estaba mal, no Franco. Si un eval falla, preguntate primero si mide lo que creés.
10. **Distinguí clases de síntoma antes de atribuir causa.** "Respuesta sin cards" eran dos
    bugs distintos con la misma pinta; tratarlos como uno llevó a una conclusión equivocada que
    hubo que corregir con logs.
11. **Un fix medido puede empeorar las cosas.** Activar "Auto-Fix Format" en el Structured
    Output Parser llevó la falla de ~40% a **100%**. Se revirtió y se remidió para confirmar
    que el toggle era la variable. Siempre remedí después de revertir.

---

## La cola, después del tipo B

En este orden, **una fase por vez, sin empezar la siguiente hasta que la anterior esté verde**:

1. **Revectorización.** Idea de Agustina, ya diseñada: agregar por auto un campo `descripcion`
   (prosa editorial curada, para que Franco justifique sin inventar) **y** comparables
   estructurados (`tamano`: chico/mediano/grande, o `largo_mm`). Lo segundo es clave: la prosa
   sola no arregla las comparaciones — el bug del Cronos era un problema de comparar 4,36 m vs
   3,57 m, y eso tiene que ser determinístico, no interpretado. **Descartado a propósito:** un
   único párrafo comparativo de los 17 autos (habría que reescribirlo con cada cambio de stock,
   y viaja en cada llamada → trampa de los 30.000 TPM). **No metas el párrafo en `Listar
   stock`** (devuelve los 17 en cada llamada): ahí va un one-liner, y el párrafo completo en
   `Detalle auto`. Decisión a medir: si la descripción entra al `content` cambia el embedding y
   por lo tanto el retrieval de "Buscar auto". **Hacé backup de la tabla antes** — el script
   hace `borrar_tabla()` y recarga. De paso, sacar las credenciales del código (ver abajo).
2. **A2 — Config real y multi-tenant.** Bloqueante para vender a la segunda concesionaria.
   6 variables declaradas y no usadas. Partir en `config_cliente` y `config_tecnico`, documentar
   en `auditoria/ONBOARDING.md`.
3. **M1 — `Listar stock` sin LIMIT.** Leerlo del Config. Ojo: los `cards_min` están calibrados
   contra el stock de 17 autos.
4. **M2 — persistir el saludo en memoria.** Ojo con `Contar mensajes previos`: usa el conteo de
   `n8n_chat_histories` para decidir si es el primer mensaje; si agregás una fila, se rompe el
   saludo.
5. **C5 (auth) — al final.** Decisión explícita de Agustina. El frontend ya manda
   `X-Franco-Auth` y n8n todavía no lo exige (estado intermedio correcto). Al activarlo, los
   evals necesitan `FRANCO_TOKEN`. Si algo sale en rojo: **403 es el auth, cualquier otra cosa
   no**.

---

## Credenciales expuestas — arreglar cuando toques la revectorización

`revectorizar_con_consumo.py` y `revectorizar_con_consumo_v2.py` tienen en texto plano la API
key de OpenAI y la **service_role de Supabase** (que saltea RLS: es acceso total a la base).
Los dos archivos están **sin trackear**, así que todavía no se filtraron al repo. Hay que
moverlas a variables de entorno y rotarlas.

## Deuda consciente — no la "arregles" sin preguntar

Está toda listada en `STATE.md`. Las que más importan:

- **El Structured Output Parser falla ~40-44%** en pedidos fuera de rubro. Causa raíz
  confirmada por log: el modelo a veces nombra la clave del array `"output"` en vez de
  `"messages"`, y el parser rechaza el objeto entero aunque la respuesta sea correcta. Se
  aceptó como deuda de bajo impacto (no toca ningún flujo de compra/venta). Si se retoma:
  probar un refuerzo puntual del nombre de la clave en la sección "Alcance" del prompt,
  midiendo antes/después. **No vuelvas a probar "Auto-Fix Format": ya se midió y empeora.**
- **El guard de cierre comercial gana piso y pierde techo**, ahora acotado a los turnos que
  muestran autos.
- **`estado_cliente` está un turno atrasado.**
- **Los evals están calibrados contra el stock de 17 autos.**
