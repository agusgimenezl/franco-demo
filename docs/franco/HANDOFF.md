# Franco — Prompt de arranque para una sesión nueva

> Última actualización: **2026-07-23** (cierre de la tanda v40→v45). Copiá este archivo entero
> como prompt inicial de una sesión nueva. Es el handoff; la fuente de verdad viva es `STATE.md`.

Seguís trabajando sobre **Franco**, el agente vendedor de autos de una concesionaria (demo que se
muestra a dueños; un bug en vivo tiene costo comercial). Backend en **n8n**, frontend React en
Render, datos en **Supabase/Postgres**.

## LEÉ PRIMERO, EN ORDEN
1. **`CLAUDE.md`** — las 7 trampas (ojo la **6**: el ejemplo concreto le gana a la regla abstracta,
   hay que REEMPLAZAR el guion, no agregar prohibiciones; la **7**: fijate si la frase la inyecta el
   guard de `Armar respuesta`, no Franco), la **regla del proyecto** (lo determinístico va a
   SQL/código, solo el lenguaje al prompt), y el método de diagnóstico (medir antes de teorizar).
2. **`docs/franco/STATE.md`** — fuente de verdad. Leé las notas de la sesión **2026-07-23**
   (rediseño de stock + v40→v45). Ahí está qué se cerró y qué quedó abierto.
3. **`auditoria/AUDITORIA-FRANCO.md`** — hallazgos con IDs.

## ESTADO ACTUAL (producción = `franco-n8n-v45.json`, 36 nodos, activo)
Workflow n8n id `Khct6BjiMNXZK5Oi`. Franco en `gpt-4.1-mini`, CRM en `gpt-4.1`.
**5 tools:** `Listar stock`, `Buscar auto`, `Detalle auto`, `Guardar lead`, y **`Valuar usado`**
(nueva en v43).
**Tablas Supabase:** `autos_disponibles` (stock, datos en `metadata` jsonb), `crm_leads`
(PK session_id), `n8n_chat_histories`, `mensajes_demo`, y **`valores_usados_referencia`** (nueva —
valores de mercado de usados para la permuta, generada por `scripts/valores-usados.sql`).

**Lo que se hizo en la sesión 2026-07-23 (commiteado, sin pushear, branch `fixes/historial-color-fotos`):**
- **Rediseño de stock:** precios/años/km de los 17 autos redistribuidos (marca/modelo/fotos
  intactos, atados al `id`). Descripciones curadas regeneradas. Aplicado en Supabase.
- **Feature de CAPACIDAD DE COMPRA en la permuta con financiación (v40→v45):** cuando el cliente
  tiene un anticipo + un usado + va a financiar, Franco pide los 4 datos del usado
  (marca/modelo/año/km), llama a **`Valuar usado`** (devuelve un valor de mercado desde la tabla,
  con **fallback por categoría** chico/mediano/grande si el modelo no está), pasa ese valor como
  `usado_valor` a `Listar stock`, que calcula **Capital Base = anticipo + usado_valor×0,70** y
  **techo = Capital Base×2** (financiando hasta 50%), y devuelve cada auto con un **`tramo`**
  (entrada/intermedio/alto/fuera). Con `con_financiacion=1`, `Listar stock` **FILTRA los `fuera`**.
  Franco muestra 3 bloques (entrada/intermedio/alto), 2 por bloque, carrocerías distintas.
  **El valor del usado es INTERNO** (Franco nunca le dice el monto al cliente; lo tasa el asesor).
  Deslinde legal al cierre.
- **Reglas de contexto (v45):** el abanico SOLO se dispara si el cliente pide ver opciones **en
  general**; si ya eligió un **auto puntual** y ofrece su usado, Franco NO le tira otros modelos —
  deriva a un asesor para la tasación o muestra parecidos. Y **nunca ofrece el WhatsApp** salvo que
  se lo pidan explícito.
- Todo pegado a mano por Agustina y **verificado byte a byte vs el vivo por MCP**.

## LO QUE QUEDÓ ABIERTO (backlog en STATE, no urgente)
- **Gate del km:** Franco muestra el abanico (correcto) **sin pedir el km antes**, porque el km no
  entra en la valuación, entonces lo saltea aunque el prompt lo pida. Bajo impacto. Reforzarlo por
  prompt no aguantó (whack-a-mole). Opción de fondo: que el km ajuste el valor (y el gate tenga
  sentido).
- **Tabla `valores_usados_referencia`:** 30 modelos, varios valores son estimados por segmento
  (columna `fuente` en `valores_usados.csv`). Conviene revisarlos/ampliarlos con precios reales.
- Contado proporcional (permuta sin financiar con tramos), y purga global de la palabra "efectivo"
  del prompt (toca el gate de v16 — hacerlo con cuidado, hoy solo se sacó de los guiones nuevos).

## DEUDA CONSCIENTE — no la "arregles" sin preguntar (detalle en STATE)
- **Structured Output Parser falla ~40%** en algunos turnos (nombra la clave `"output"` en vez de
  `"messages"` → burbuja de fallback "Uy, se me trabó"). NO reactivar "Auto-Fix Format" (ya se
  midió, empeora a 100%). Aparece en turnos complejos de permuta/financiación.
- El **abanico depende de una cadena de 3 pasos** (`Valuar usado` → pasar el valor → usar tramos)
  que gpt-4.1-mini **no sigue 100% confiable** — por eso lo robusto va al SQL (ej: el filtro de
  `fuera`), no al prompt. No lo "arregles" solo reforzando el prompt.
- **`estado_cliente` va un turno atrasado.** Los evals están calibrados contra el stock de 17.

## CÓMO SE TRABAJA (no negociable)
- **Medí antes y después.** Un bug nuevo se hace **eval primero y tiene que FALLAR**. **Un cambio
  por vez** (o si apilás, cada uno con su eval).
- Los cambios de workflow los **pega Agustina a mano**. Vos preparás el JSON con un **script en
  `scripts/*.mjs` con aserciones** (mirá `scripts/hardening-tramos-whatsapp.mjs`,
  `scripts/valuar-usado-tool.mjs`, `scripts/capacidad-toma-70.mjs` como molde: verifican trampa 1/3,
  `=` inicial, que sobrevivan los fixes previos, que no se dupliquen reglas). **NO uses
  `update_workflow` del MCP** (pisa trampas 6/7); el MCP es de lectura.
- **Después de cada paste, verificá byte a byte** contra el vivo: `get_workflow_details`
  (id `Khct6BjiMNXZK5Oi`) y comparás `systemMessage` de `Franco (AI Agent)` + las queries tocadas
  contra el archivo local. El MCP también tiene `search_executions`/`get_execution` para leer logs
  (regla: leer el log antes de teorizar).
- Ante un bug de prompt que "no se va", **reemplazá el guion**, no agregues prohibición (trampa 6).
- **Evals:** `FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs --case a,b --delay 3000 --json evals/<archivo>.json`.
  Casos en `evals/cases.json`. Los `manual` no cuentan como falla (imprimen para revisión).
  `--repeat N` para medir flakiness. Los checks a veces son más gruesos que el criterio: **si un
  check da rojo, leé el texto real antes de tocar el prompt.**

## OPERATIVO
- **Puntero de producción:** `scripts/state-sync.mjs` línea 18 apunta a `franco-n8n-v45.json` (al
  día, invariantes verificados). Al desplegar una versión nueva, actualizalo y corré
  `node scripts/state-sync.mjs` para regenerar el encabezado autogenerado de STATE.
- **Requisito Supabase para v43+:** la tabla `valores_usados_referencia` tiene que existir
  (`scripts/valores-usados.sql`, idempotente). Si tocás los valores, editás `valores_usados.csv` y
  corrés `node scripts/gen-valores-usados.mjs`.
- Nada pusheado; branch `fixes/historial-color-fotos`.
