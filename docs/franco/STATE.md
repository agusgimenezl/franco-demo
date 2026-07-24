# Estado de Franco

Última actualización manual: **2026-07-22**

<!-- AUTOGENERADO: no editar a mano. Regenerar con: node scripts/state-sync.mjs -->

**Workflow en producción:** `franco-n8n-v60.json` · 35 nodos

| | |
|---|---|
| Webhooks | 6 (auth: ninguna) |
| Nodos Postgres | 15 |
| Tools de Franco | Listar stock, Buscar auto, Guardar lead, Detalle auto |
| Modelos | OpenAI Chat Model: gpt-4.1-mini · OpenAI Chat Model (CRM): gpt-4.1 |
| Ventana de memoria de Franco | 20 |
| Empresa configurada | Automotores Tucumán |
| Evals | 57 casos · baseline-v33.json → 30/35 |

**Invariantes:** ✅ los 5 pasan

<!-- FIN AUTOGENERADO -->

> **Sesión 2026-07-24. BUG-EMBUDO (paréntesis, captura Agustina). v59 arregla el dump; v60 arregla una regresión.**
> BUG: cliente con interés PUNTUAL (T-Cross/Amarok) + permuta + SIN presupuesto → Franco llama Listar stock con
> `precio_objetivo=0, tiene_permuta=1` → la query etiqueta TODO 'entra' → dumpea 17 autos (Ranger $57M…). Debe
> ofrecer el embudo: asesor-tasación O ver-más (→ presupuesto o full stock). Repro `permuta-interes-puntual-sin-
> presupuesto` (3/3 falla, log 7548).
> - **v58 — `scripts/embudo-interes-puntual-sin-presupuesto.mjs` (prompt). PEGADO, PARCIAL.** Gate del abanico +
>   guion del embudo + anti-dump. Medido: leakea (1/3 dumpea entero, 1/3 mezcla) — el prompt solo NO aguanta (trampa 6).
> - **v59 — `scripts/embudo-guard-sql-sin-presupuesto.mjs` (SQL + prompt). PEGADO Y MEDIDO.** DETERMINÍSTICO:
>   `Listar stock` devuelve 0 filas si `precio_objetivo=0 AND (tiene_permuta=1 OR con_financiacion=1)` → sin
>   munición, no hay dump. toolDescription aclara que 0 filas = señal del embudo; línea 135 deja de decir "mostrás
>   stock". **Medido: repro 0/3 dump, 3/3 embudo.** Verificado byte a byte.
> - **REGRESIÓN de v58 detectada en v59 (log 7612):** el gate condicionaba en "(a) pidió ver opciones EN GENERAL",
>   demasiado estricto → suprimía el abanico de capacidad cuando el cliente da anticipo pero no dice "mostrame el
>   catálogo" → `capacidad-de-compra-financiada` cayó a name-ask 3/3 (Franco ni llama Listar stock).
> - **v60 — `scripts/embudo-gate-no-puntual.mjs` (prompt). PEGADO Y MEDIDO.** Condición (a) pasa a "NO vino por
>   autos PUNTUALES" (dar anticipo YA es pedir opciones). **Medido:** repro embudo 3/3 sin dump (el fix aguanta),
>   `capacidad-de-compra-financiada` abanico 2/3 (era 0/3 en v59 → regresión cerrada), `permuta-contado` abanico
>   2/3. El 1/3 restante de name-ask es la flakiness histórica name-ask-vs-abanico (decisión abierta), no de esto.
>   Verificado byte a byte. **BUG-EMBUDO RESUELTO. Puntero: v60 vivo.**
> **NUEVOS BUGS (captura Agustina, para v60+):** (A) pedido puntual sin stock → alternativas por CARROCERÍA (pidió
> pickup → S10/Hilux/Ranger/Amarok), y no ocultar el modelo que SÍ está (Amarok 2018); siempre ofrecer todo el
> stock o más detalle. (B) comparación de 2+ vehículos → incluir la info DESCRIPTIVA de la base, no solo la ficha
> técnica. Tareas #6, #7. Pusheado hasta v57; v58-v60 sin pushear aún.

> **Sesión 2026-07-24. TARGET-B (abanico y cards por código) — EN CURSO. TB-1 (dedup de cards) HECHO Y MEDIDO.**
> Arquitectura de la respuesta: Franco emite `{messages, auto_ids}` → `Hidratar autos` (DB) → `Autos ya
> mostrados` → `Armar respuesta` (code, arma product_cards/images + guard de cierre) → `Responder a Render`.
> Las cards YA se hidratan por código; la data es determinística. Falla A4: Franco a veces deja `auto_ids`
> vacío (cards flaky) → TB-2. Y el abanico (3+ autos) se mandaba SIN dedup → TB-1.
> - **TB-1 — `scripts/dedup-cards-abanico.mjs` (v56→v57). PEGADO Y MEDIDO.** Pedido de Agustina: no repetir
>   el mismo mazo de cards si ya se mandó y la charla sigue sobre esos autos. (A) `Autos ya mostrados` ahora
>   devuelve `cards_recientes` (ids con product_cards en los últimos 8 msgs; el `ids_recientes` de fotos sigue).
>   (B) `Armar respuesta` rama autos>=3: si TODOS ya están en cards_recientes → product_cards=[] (no repite);
>   si hay al menos uno nuevo → lista completa (sin huecos). Test offline + sintaxis JS válida. Verificado byte
>   a byte (Armar respuesta 7768, Autos ya mostrados 806). **PRUEBA VINCULANTE (log 7470):** Franco re-emitió
>   `auto_ids=[2,3,4,1]` ("acá te las vuelvo a mostrar"), `cards_recientes="1,2,3,4"`, `Armar respuesta` sacó
>   `product_cards=[]`. El dedup funciona end-to-end. Caso nuevo `dedup-cards-repite`.
> - **Caveat de instrumento:** el check `media_si_lista_autos` (TIPO B, en ALWAYS) ahora da FALSO POSITIVO en
>   turnos de dedup (Franco lista autos en texto, cards=[] a propósito). Solo ve un turno, no la sesión. Volverlo
>   consciente del dedup (trackear cards ya mostradas en la sesión) va con TB-2, que es donde toca el tema cards.
> **Puntero: v57 vivo.** **Sigue:** TB-2 (cards flaky: que el abanico emita auto_ids siempre) y TB-3 (eco del
> encabezado). Interpretación de dedup usada: suprimir solo cuando el set ENTERO ya se mostró (repeticiones/
> subsets), no cuando hay algo nuevo. Pusheado.

> **Sesión 2026-07-23. SESIÓN C (confiabilidad/arquitectura) — EN CURSO. Target (a): colapso determinístico.**
> Baseline limpio medido (`evals/c-baseline-cadena-eco.json`, `c-baseline-estado.json`): parser fallback spikea
> (3/5 en `permuta-contado` a --delay 3000), eco residual, re-ofrecimiento a la distancia 1/3 limpio. **Hallazgo
> param-level (ejecución 7351):** el abanico corto NO es solo `usado_valor=0` — aun con la cadena perfecta
> (usado_km=65000, usado_valor=12.4M OK), Franco manda un `precio_max=12.5M` de su cosecha que colapsa el techo
> `estirar` determinístico. La tesis de C en su forma pura.
> - **a2 — `scripts/precio-max-no-colapsa-permuta.mjs` (v52→v53). PEGADO Y MEDIDO.** En `Listar stock`, `precio_max`
>   no se aplica cuando `tiene_permuta=1 OR con_financiacion=1` (el techo lo fija el SQL, el LLM no lo achica).
>   Verificado byte a byte (Listar stock 6330, systemMessage 40825 intacto). **Prueba vinculante (log 7412, mismos
>   params que 7351):** Franco SIGUE mandando `precio_max=12.5M` pero el guard lo ignora → `estirar` ahora llega a
>   Cronos (16.8M) y Kangoo (18.5M). Atribución airtight. Auto-checks `permuta-contado` 1/5→4/5.
> - **EFECTO COLATERAL de a2 (run4):** al no filtrar `precio_max`, Listar stock en contado devuelve también las
>   filas `categoria='fuera'` (financiación las strippea, contado NO) → Franco sobre-ofreció Renegade 25.5M /
>   Corolla 24.8M / Duster 22.5M como "estirar" (overshoot tipo $38M/v45, reintroducido en contado).
> - **a2.1 — `scripts/permuta-no-muestra-fuera.mjs` (v53→v54). PEGADO Y MEDIDO.** Strippea `categoria='fuera'`
>   cuando `tiene_permuta=1`, espejo del strip de financiación (v45). Completa a2: el techo estirar es el cap, el
>   LLM no lo achica (a2) ni lo excede (a2.1). Verificado byte a byte (Listar stock 6496, systemMessage 40825
>   intacto). **Medido:** logs 7430 (`precio_max=12.5M`) y 7423 (`precio_max=0`) devuelven las MISMAS 5 filas
>   accesibles (Kangoo/Cronos/Etios estirar + Gol/Fiesta entra), **cero filas `fuera`** (a2/7412 traía 17 con 12
>   fuera). Chat `permuta-contado` 5/5 SIN overshoot (adiós Renegade/Corolla/Duster $22-25M). Auto-checks 4/5 (el
>   miss es parser fallback en t2 = ruido TPM, trampa 5, no el abanico).
> - **a1a — `scripts/colapso-valuacion-en-listar-stock.mjs` (v54→v55). PEGADO Y MEDIDO.** La valuación del usado
>   pasa a un CTE `usado_val` DENTRO de `Listar stock` (expresión extraída byte a byte de `Valuar usado`, gate
>   `tiene_permuta=1 AND usado_anio>0`); las 5 refs a `usado_valor` → `usado_val.valor`; **la key `usado_valor`
>   se removió del schema** → el LLM ya no puede mandar 0. Prompt pto 5 (fin+contado) + pto 6 reescritos (pasa
>   descriptores directo, no llama `Valuar usado`; el valor ni se lo devuelven). Verificado byte a byte (Listar
>   stock 7329, systemMessage 40941). **Medido (logs 7445/7438):** Franco pasa `usado_marca/modelo/anio/km/categoria`,
>   NO `usado_valor`; `Listar stock` computa el valor interno (≈12.4M) y el `estirar` llega a Cronos/Kangoo; SQL
>   válido, 5 filas limpias, 0 overshoot. Chat 4/5 (miss = parser fallback). Eco del km bajó a 1/5.
>   **Residual:** Franco TODAVÍA llama a `Valuar usado` (resultado ignorado) → llamada TPM desperdiciada → a1b.
> - **a1b — `scripts/remover-valuar-usado-huerfano.mjs` (v55→v56). PEGADO Y MEDIDO.** Removido el nodo `Valuar
>   usado` (huérfano; la valuación vive copiada en el CTE). Verificado vivo = **35 nodos**, `Valuar usado` fuera,
>   Listar stock/systemMessage byte-idénticos. **Medido:** `parser fallback 0/5` (a1a 1/5, baseline 3/5 → la
>   llamada de tool de menos baja TPM), 0 overshoot, abanico correcto. Invariantes ✓.
> **✅ TARGET (a) COMPLETO** (a2 guard precio_max + a2.1 strip fuera + a1a colapso valuación + a1b remoción):
>   el techo del abanico es 100% determinístico (el LLM no lo achica ni lo excede ni puede mandar usado_valor=0),
>   sin cadena de 3 pasos, con una llamada de tool menos. **Puntero: v56 vivo.**
> - **HALLAZGO para target-b (líder):** `product_cards` sale INCONSISTENTE — batch a1b 3/5 con `product_cards=0`
>   pese a listar 4 autos en el texto del abanico (TIPO B); a2.1/a1a fueron 1/5. Es la flakiness A4 (el LLM decide
>   `product_cards` free-form; remover un nodo no toca el output schema → preexistente, quizás nudgeada, n=5 no
>   discrimina ruido). **Target-b lo mata:** armar el abanico + las cards por CÓDIGO desde las filas hidratadas
>   (como el cierre comercial de "Armar respuesta", trampa 7) en vez de que Franco elija `product_cards`. Eso
>   resuelve de una: cards inconsistentes, eco del modelo/km en el encabezado (~1-2/5) y presentación floja.
> **Sin pushear aún** (branch `fixes/historial-color-fotos`, tanda v34–v56 acumulada). Agustina autorizó pushear
> cuando esté maduro; Target (a) es un hito coherente para respaldar.

> **Sesión 2026-07-23. v52 PEGADO Y MEDIDO (bug del re-ofrecimiento de financiación). Parcial; el resto es C.**
> `scripts/financiacion-no-reofrece.mjs`. Captura: Franco recolectó anticipo (10M) + cuotas (36) de la Duster; el
> cliente pivotea a "más info del auto"; Franco da la ficha y RE-OFRECE la financiación ("te interesa financiarla o
> entregando tu usado?"). RAÍZ: el cierre comercial de ## Paso 3 tenía el ejemplo "te interesa financiarlo..." y su
> única excepción era la permuta (name-ask). Fix: **Excepción 2** — si ya dio anticipo/cuotas, consolidar con una
> AFIRMACIÓN, no re-preguntar. Verificado byte a byte (systemMessage 40825). **Medido:**
> - `financiacion-no-re-ofrece` (corto): **0/4 → 2/3**. El fix ayuda cuando la financiación está cerca.
> - `financiacion-no-re-ofrece-largo` (~9 turnos, con ida y vuelta): **1/3**. Agustina precisó que el bug aparece tras
>   ~10 mensajes, no continuo: **a la distancia el fix por prompt NO aguanta** (el anticipo/cuotas quedan lejos en la
>   ventana y "mirá la conversación reciente" no alcanza). **Fix robusto = que `estado_cliente` capture anticipo/cuotas**
>   (siempre en contexto) → C.
> - `financiacion-pide-anticipo` (control): **0/3 pero es RUIDO DEL PARSER**, no regresión. Las fallas son la burbuja de
>   fallback ("se me trabó el sistema") en el TURNO 1 (Structured Output Parser intermitente); el turno 4 responde bien
>   ("de cuánto sería el anticipo?"). El parser fallback SPIKEÓ esta sesión — probable carga/TPM (trampa 5) de correr
>   muchos evals seguidos. **Anotar para C:** medir el parser fallback aislado (con --delay alto) y ver si es TPM.
> **Puntero: v52.** Sin pushear.

> **Sesión 2026-07-23. TANDA DE PERMUTA CERRADA (v48→v51, todo pegado y medido). Terreno listo para C.**
> Sobre 3 capturas + el pedido de "concreto y sin redundancias". Resumen de la tanda (producción = **v51**):
> - **v48 — verbosidad #3 (WIN) + ofrecer stock #2 (parcial).** pto 3 seco: `permuta-km-conciso` 1/6→5/6 (v51: 4/4).
> - **v49 — contado proporcional #1 (WIN, verificado en log 7118):** el `estirar` factoriza el usado (×0.70), techo
>   14M→18.68M, deja de subtasar. Falta que Agustina sume populares (Yaris, etc.) a `valores_usados.csv` para que el
>   fallback no lo deje corto.
> - **v50 — anti-eco del abanico (pto 6)** y **v51 — anti-eco GLOBAL (# Tono).** El eco ("recibo que tenés 10 millones
>   y un usado", "tu Yaris 2020 con 65.000 km") se atacó en dos capas. Medido: `permuta-sin-eco-primer-turno` 2/4→**4/4**
>   (v51 mató el eco del primer turno); `permuta-sin-eco-datos` (eco del km en el ENCABEZADO del abanico) 0/4→3/4 (v50)→
>   ~2/4 (v51): **residual flaky ~50%**. Reforzarlo más por prompt es whack-a-mole → va a C.
> - Verificado byte a byte vivo==v51 en cada paso (systemMessage 40286). Invariantes ✓. **Sin pushear** (branch
>   `fixes/historial-color-fotos`). Evals nuevos: `permuta-km-conciso`, `permuta-ofrece-stock-completo`,
>   `permuta-contado-factoriza-usado`, `permuta-sin-eco-datos`, `permuta-sin-eco-primer-turno`.
>
> **TERRENO PARA C (sesión propia, es rediseño no parche).** Todo lo que quedó flaky en esta tanda tiene la MISMA raíz:
> gpt-4.1-mini no orquesta confiable la cadena de 3 pasos ni mantiene el contexto. Síntomas medidos esta sesión:
> - **usado_km / usado_valor inconsistentes:** Franco pasa `usado_km=0` (km fix dormido, logs 6921/6930) o `usado_valor=0`
>   (abanico colapsa) unas veces y bien otras (log 7118 pasó km=65000 y valor OK). Sin patrón estable.
> - **Pérdida de contexto:** Franco olvida el modelo del usado ("ya tengo los km, ahora la marca/modelo/año") — visto en
>   varios runs de `permuta-ofrece-stock` y `sin-eco`.
> - **Ruteo contado vs financiación ambiguo:** "10M de presupuesto" cae a veces en contado, a veces en financiación.
> - **Financiación no persiste:** anticipo/cuotas NO viven en `estado_cliente` (solo memoria de conversación) → tras
>   ~10 mensajes Franco re-ofrece la financiación que ya recolectó (v52 lo mitigó cerca, no a la distancia). Fix: que
>   el CRM extraiga anticipo/cuotas a `estado_cliente`, como ya hace con nombre/usado/financia.
> - **Parser fallback ("se me trabó el sistema") intermitente** — spikea bajo carga; medir aislado (TPM, trampa 5).
> - **Presentación floja + gate del km leakea 5/5** (ya en STATE).
> - **Eco residual del encabezado del abanico** (~50%): el encabezado lo arma el LLM free-form.
> **Hipótesis de fondo para C (regla del proyecto: lo determinístico va a código):** colapsar la cadena a UN salto —
> que `Listar stock` valúe el usado internamente (o `Valuar usado` devuelva ya los tramos), y que el ENCABEZADO del
> abanico lo arme un guard/código (como el cierre comercial de "Armar respuesta", trampa 7) en vez del prompt. Eso
> mataría de raíz: km dormido, usado_valor=0, eco del encabezado, y descargaría el prompt (40k chars, empeora la
> orquestación). Ojo trampa 5 (TPM) si se suman nodos/subagentes. Arrancar C con su propio plan y baseline.

> **Sesión 2026-07-23. v49 PEGADO Y VERIFICADO (Tarea B: contado proporcional). WIN determinístico.**
> `scripts/contado-proporcional.mjs`. El contado+permuta subtasaba (techo estirar = efectivo×1.40 = 14M, no
> factorizaba el usado → al cliente del Yaris 2020 le ofrecía autos más viejos). Fix (factor ×0.70, decisión de
> Agustina): SQL `estirar = GREATEST(efectivo×1.40, efectivo + usado_valor×0.70)` (degrada solo si usado_valor=0) +
> prompt (la rama contado pasa usado_valor con con_financiacion=0). Verificado byte a byte (systemMessage 39560,
> Listar stock 6015). **BINDING VERIFICADO en el log 7118:** Valuar usado (Yaris 2020/65k → $12.406.105 fallback
> categoría, y Franco pasó usado_km=65000 — la cadena del km funcionó acá) → Listar stock (usado_valor=12406105,
> con_financiacion=0) → **categoría `estirar` = Kangoo $18.5M, Cronos $16.8M, Etios $12.5M** (techo subió a 18.68M vs
> 14M en v48). El subtasado está arreglado. Nota: con el Yaris en la tabla a valor real (~16M) el techo llegaría a
> ~21M (Onix/208/EcoSport); el fallback lo deja en Kangoo/Cronos → **Agustina: sumar populares a `valores_usados.csv`.**
> **REDUNDANCIA (énfasis de Agustina, ABIERTO):** Franco recita "tu Yaris 2020 con 65.000 km" en los encabezados de la
> narrativa de permuta/capacidad, repitiendo lo que el cliente acaba de decir. La regla global "No repitas los datos
> que el cliente acaba de darte" no aguanta ahí (el guion del encabezado invita el eco). Próximo fix (v50): anti-eco en
> los encabezados de permuta con ejemplo concreto (trampa 6). **Puntero: v49.** Falta C (colapsar la cadena de 3 pasos).

> **Sesión 2026-07-23. v48 PEGADO Y MEDIDO (Tarea A de la tanda de permuta). #3 WIN, #2 parcial.**
> Pedido de Agustina sobre 2 capturas (permuta al contado con 10M + Yaris 2020) + revisión general del flujo. Tres temas:
> #3 verbosidad, #2 no ofrece el stock completo, #1 subtasa (contado proporcional). A = #2 + #3 (prompt); B = #1 (SQL);
> C = confiabilidad de la cadena. **v48 (`scripts/permuta-conciso-ofrece-stock.mjs`):**
> - **#3 verbosidad — WIN.** pto 3 reescrito seco (sacó el guion "valorá lo que entrega (es de los más buscados)" que
>   enseñaba el piropo; ejemplo terso "genial, y cuántos km tiene?"). Eval `permuta-km-conciso` **1/6 → 5/6**. Verificado
>   byte a byte (systemMessage 39342). name-ask control `permuta-una-pregunta-por-vez` **5/6, sin regresión**.
> - **#2 ofrecer stock — PARCIAL.** Ofrecimiento agregado a la rama contado; funciona cuando Franco se queda en contado
>   (runs 1/3/5: "y si querés te paso todo el stock"), pero el eval quedó **4/6 → 3/6** por DOS cosas ajenas al fix
>   (log): (a) **pérdida de contexto** — Franco a veces olvida el "Yaris 2020" del turno previo y re-pide marca/modelo/año;
>   (b) **ruteo a financiación** — trata "10M de presupuesto" como anticipo → va por el abanico (donde el ofrecimiento no
>   está). La parte que falta de #2 se resuelve con B (arreglar el ruteo contado vs financiación).
> **HALLAZGO para B:** el subtasado del Yaris (#1) tiene DOS causas: (1) la rama contado usa el techo viejo (efectivo×1.40,
> no factoriza el usado); (2) el ruteo "10M presupuesto" → a veces contado, a veces financiación, inconsistente. B tiene que
> desambiguar el ruteo Y factorizar el usado en la capacidad al contado. **Puntero de producción: v48.** Sigue B (contado
> proporcional, con sim de números antes) y C (confiabilidad de la cadena de 3 pasos). Sin pushear.

> **Sesión 2026-07-23. v47 PEGADO Y MEDIDO (bundle v46+v47). Tarea B: WIN. Tarea A (km): instalada pero DORMIDA.**
> Dos cambios en secciones separadas, cada uno con su eval que falló en v45. Agustina pegó v47 (acumulativo: km fix +
> financiación). Verificado byte a byte vs el vivo (systemMessage 38859, Valuar usado 2010, Listar stock 5272 — idénticos).
>
> **v46 (`scripts/km-ajusta-valor.mjs`, "el 2"): el km del usado AJUSTA el valor (Valuar usado).** Backlog del
> gate del km. Hoy `valor = base_2020 * 0.93^edad`, el km no entra → el gate ("pedí el km antes de mostrar") no
> tiene razón computacional y Franco lo saltea (reforzarlo por prompt fue whack-a-mole). Fix (regla del proyecto,
> determinístico → SQL): Valuar usado multiplica por un `km_factor` = `clamp(0.65..1.0, 0.88^((km - km_esperado)/50000))`,
> `km_esperado = 15000*(año_actual-año)`. **Penaliza el exceso de km sobre el esperado para la edad, NO premia el bajo
> km (techo 1.0)** — decisión de Agustina. Param nuevo `usado_km`. Con `km=0` (Franco no lo pidió) → factor 1.0 →
> degrada EXACTO a v45 (no rompe nada si el gate leakea). Prompt pto 5: (a) corrige la frase "el km es obligatorio
> **aunque no cambie el cálculo del valor**" (ahora es falsa → el km SÍ cambia el valor, eso le da razón al gate);
> (b) suma `usado_km` a la llamada y aclara que el km del usado NO es filtro de stock (en el log Franco lo mandaba
> como `km_max`).
> - **Matiz honesto (dicho a Agustina):** meter el km al valor es la arquitectura correcta y le da SENTIDO al gate,
>   pero NO fuerza a Franco a gatear ("pedí el km" sigue siendo lenguaje). Sí garantiza valuaciones realistas cuando
>   Franco tiene el km.
> - **Verificación VINCULANTE (el chat-text NO discrimina):** sim offline `scripts/sim-km-valor.mjs` (espejo fiel del
>   SQL) — Ka 2015 250k km → valor $7.1M, techo ~24M → **Corolla (24.8M) y Renegade (25.5M) pasan a `fuera` y el SQL
>   los FILTRA** (hardening v45). Post-paste: correr `capacidad-km-alto-achica` y LEER el output de `Listar stock` en
>   el log (get_execution): Corolla/Renegade ya no deben venir (en v45 vienen en tramo `alto`).
> - **HALLAZGO del baseline (log 6897, método #1):** con Ka 2015 250k km, `Valuar usado` devolvió 8.83M (km ignorado,
>   correcto) y `Listar stock` devolvió el abanico COMPLETO con Corolla/Renegade en `alto` — **pero Franco en el texto
>   mostró solo los 3 más baratos** (Etios/Fiesta/Gol, ids 4/2/3). NO era `usado_valor=0` (hipótesis descartada por el
>   log): es la **presentación floja** (Franco elige los más baratos, no llega al techo), ya anotada en STATE. Por eso
>   el eval `capacidad-km-alto-achica` va con la composición del abanico en MANUAL y checks reales solo en lo
>   determinístico (pickups filtradas, no recita el valor). Baseline v45: **0/3** (falla, como debe).
>
> **v47 (`scripts/financiacion-anticipo-transparencia.mjs`): flujo de financiación (las 2 capturas).** Cliente
> interesado en el Etios pregunta cómo financiarlo; Franco preguntaba compuesto ("anticipo O usado" + "cuántas
> cuotas"), el cliente skipeaba el MONTO del anticipo, y Franco avanzaba a pedir el nombre "con el anticipo que tenés"
> (que nunca dio) + ofrecía "prepararte una simulación" como si la hiciera él. Fix (trampa 6, se REEMPLAZA el guion
> en `# Financiación`): (R1) la simulación SIEMPRE la arma el asesor, Franco nunca ofrece prepararla él; (R2)
> pre-perfil de a UNA pregunta, ANTICIPO primero — sin el monto NO avanza (ni confirma, ni pide nombre, ni deriva),
> salvo derivación explícita; + regla de DATO INCOMPLETO (si contesta a medias, re-pedir el faltante; si en la 2da no
> sabe/quiere, no insistir); (R3) saca el ejemplo ambiguo "que te prepare la simulación". Baseline v45 (eval
> `financiacion-pide-anticipo`, 4 turnos fieles a la captura): **0/2** — run2 reproduce exacto el bug (pide el nombre
> sin el monto). Transparencia va en MANUAL (el "te prepare" es ambiguo en español, el regex no discrimina).
>
> **MEDIDO (v47 en el vivo):**
> - **Tarea B `financiacion-pide-anticipo`: 0/2 → 3/3.** Las 3 veces Franco pide el MONTO del anticipo ("de cuánto sería
>   el anticipo, más o menos?"), no avanza al nombre, y atribuye la simulación al asesor. WIN limpio, verificado en texto.
> - **Tarea A (km) `capacidad-km-alto-achica`: 3/3 en los checks deterministas, pero DORMIDA.** Log 6921/6930: Franco llama
>   a Valuar usado con **usado_km=0** en las dos ejecuciones — NO le pasa el km real (100k ni 250k). La valuación queda en
>   8.83M (factor 1.0). El SQL del km_factor está bien y es inofensivo (km=0 → idéntico a v45), pero **Franco no le alimenta
>   el km al tool**, así que el fix no tiene efecto observable todavía. Cadena flaky de gpt-4.1-mini (misma familia que el
>   gate). El matiz se predijo de antemano.
> - **Control `capacidad-de-compra-financiada`: 0/5 — NO es regresión.** El gate leakea 5/5 (turno 1 muestra el abanico
>   sin pedir el km) = el "único abierto" que STATE ya marcaba en v45. El turno-2 (abanico real) sale ~3/5 (flakiness de
>   presentación de siempre). Log 6921: en 1 run Franco pasó usado_valor=0 → abanico chico (orquestación flaky, no valuación
>   rota). El abanico funciona cuando orquesta bien.
> **Puntero de producción: v47** (state-sync.mjs L18 actualizado, encabezado regenerado). **Backlog:** (1) el km fix está
> DORMIDO hasta que Franco pase usado_km — bajo impacto, no forzar por prompt (whack-a-mole); (2) **presentación floja del
> abanico + gate del km** (Franco muestra los más baratos / no gatea) es el tema de calidad que más se nota — candidato a
> fondo por SQL/estructura, no prompt; (3) contado proporcional; purga global "efectivo". **Sin pushear** (branch
> fixes/historial-color-fotos).

> **Sesión 2026-07-23. v41: fix de la regresión del name-ask. PEGADO Y MEDIDO — OK.** v40 regresó
> `permuta-una-pregunta-por-vez` a 0/5 (el guion de tramos se metía en el turno del name-ask).
> `scripts/capacidad-nameask-guard.mjs`: guard al inicio del pto 5 (si venís en la progresión con auto+km,
> NO abanico, andá al name-ask) + refuerzo en el cierre + calidad (mejores por tramo, no los más baratos).
> Verificado byte a byte vs vivo. Medido: `permuta-una-pregunta-por-vez` **0/5 → 3/5** (volvió al flaky
> histórico ~50%, regresión cerrada); `capacidad-de-compra-financiada` **5/5** (`--repeat 5`); controles
> verdes. La entrada ahora arranca con Cronos/Etios, no Fiesta/Gol.
>
> **Sesión 2026-07-23. v44 + v45: pulido del abanico. PEGADO Y MEDIDO. Demo-crítico RESUELTO; queda el gate del km.**
> **v44** (`scripts/valor-usado-interno.mjs`): (1) el valor del usado es INTERNO — Franco no recita el monto
> ("$13.339.898"); (2) km obligatorio antes de mostrar (reforzado, NO aguantó); (3) abanico en 3 bloques.
> Medido: valor interno OK, presentación 3 bloques OK, PERO apareció bug del $38M (ver v45).
> **v45** (`scripts/hardening-tramos-whatsapp.mjs`), tres fixes de raíz:
> - **(A) HARDENING $38M:** v44 mostraba S10 $39.5M / Hilux $38M a un cliente con 7M (mi frase "no te quedes
>   corto" + los `fuera` le llegaban). Fix: `Listar stock` FILTRA `tramo='fuera'` cuando con_financiacion=1
>   (`WHERE NOT (con_financiacion=1 AND tramo='fuera')`). Determinístico, no depende del LLM. Medido: **el
>   abanico ya no muestra pickups de $38M** (turno 2 verde).
> - **(B) WhatsApp:** ofrecía el número sin que lo pidan. Fix: nunca lo ofrece, solo si lo piden explícito.
>   `no-ofrece-whatsapp` **VERDE**.
> - **(C) SCOPE del abanico:** cliente interesada en el Etios + ofrece usado → Franco le tiraba SUVs/pickups
>   (¡Hilux a quien mira un Etios!). Fix: el abanico SOLO va si pide ver opciones EN GENERAL; con auto puntual
>   elegido, deriva a asesor o muestra parecidos. `auto-puntual-no-abanico` **0/1 (v44) → VERDE (v45)**.
> Controles permuta×2 + derivación **3/3**, sin recitar el valor. Verificado byte a byte (37546 chars, filtro
> en Listar stock 5272). **ÚNICO ABIERTO: el gate del km** (Franco muestra el abanico correcto sin pedir el km
> primero; no lo necesita para calcular, lo saltea aunque el prompt lo pida). Bajo impacto (el abanico ya es el
> bueno). **Backlog:** km en el gate; que el km ajuste el valor; contado proporcional; purga global "efectivo".
> **NADA COMMITEADO de v40-v45** — pendiente.
>
> **Sesión 2026-07-23. TABLA DE REFERENCIA + v43: tool `Valuar usado`. PEGADO Y MEDIDO. Valuación anda; 3 arrugas.**
> Decisión de Agustina: los valores los investiga Claude (mercado AR); fallback por categoría si el modelo no
> está. Investigación (Infobae 07/2026, LA NACION 03/2026) → `valores_usados.csv` (30 modelos, ancla 2020) →
> `scripts/gen-valores-usados.mjs` → `scripts/valores-usados.sql` (tabla `valores_usados_referencia`, corrida en
> Supabase). **v43** (`scripts/valuar-usado-tool.mjs`, 35→36 nodos): tool `Valuar usado` (aislada, NO toca Listar
> stock/Buscar auto) — match exacto marca+modelo → fallback promedio de categoría → ajuste por año ~7%. Franco
> clasifica y la tool valúa; el prompt (ptos 5/6) lo manda a consultarla en vez de adivinar. Verificado byte a byte
> (36 nodos, systemMessage 36249, Valuar usado 1495, Listar stock intacto). **Medido:**
> - **Valuación ANDA:** Ka 2015 → $8.83M (tabla), Yaris 2021 → $13.3M (fallback categoría). El abanico mejoró
>   (llega a Onix/208 $21M, vs el todo-barato de v42). El mecanismo determinístico funciona.
> - 🔴 **Franco RECITA el valor exacto** ("tu Yaris vale $13.339.898"): precisión falsa, malo en demo. Fix: redondear
>   la salida de Valuar usado (a $500k) + reforzar pto 6 (no afirmarlo).
> - 🟡 **Gate del km no aguanta:** Franco muestra el abanico sin km (la valuación no usa km). Decidir: que el km
>   ajuste el valor, o sacarlo del gate.
> - 🟡 **Presentación floja:** mezcla dos-caminos viejo con tramos, no llega al techo (~26M).
> - Controles: `permuta-una-pregunta-por-vez` y `derivacion-pide-datos-del-usado` OK; `permuta-mas-efectivo` cayó
>   (perdió el "asesor/tasación" en el contado + recita el valor). `capacidad-de-compra-financiada` 0/3 (el check
>   de gate de km falla porque Franco no gatea; el abanico en sí mejoró).
> **PENDIENTE:** decidir el km + el redondeo/recitación (v44 chico), y commit de v40-v43 (nada commiteado aún).
>
> **Sesión 2026-07-23. v42: capacidad con TOMA DEL USADO AL 70% + gate. PEGADO Y MEDIDO. Objetivo anda; 3 temas ABIERTOS.**
> **Medido `evals/v42-medicion.json` + repeats (vivo == v42 byte a byte):**
> - `capacidad-de-compra-financiada` (2 turnos): **VERDE mecánicamente** — el gate de km anda (t1 pide el km),
>   el abanico se arma (t2). PERO **calidad floja**: con el Ka a 100k km Franco lo SUBTASÓ → Capital Base bajo →
>   abanico todo barato (entrada Gol 110k / Fiesta 105k, "alto" = Cronos 16.8M; nada de EcoSport/208/Corolla).
>   Pasó el check de casualidad (matcheó "Cronos"). **Es el problema del valor del usado, en vivo → la tabla de
>   referencia es la solución.**
> - `financiacion-pide-usado-primero`: **lógica OK** (cuando el parser no falla, pide el usado bien), pero **2/3 +
>   1/1 cayeron en el fallback del parser (TIPO A)**. Tasa de parser alta en estos turnos complejos — la complejidad
>   de v42 puede estar estresándolo.
> - Controles `permuta-mas-efectivo`, `derivacion-pide-datos-del-usado`: **verdes**.
> - **`permuta-una-pregunta-por-vez`: 0/3 — REGRESIÓN DEL NAME-ASK OTRA VEZ** (v41 lo tenía 3/5). El guion más rico
>   de v42 (capital base, estimación, deslinde) se mete en el turno del nombre, pasando por encima del guard de v41.
>   **Tercera vez con este patrón: enriquecer el abanico le gana al name-ask. Ya no se arregla con otro guard
>   (whack-a-mole). Tensión de fondo: el abanico y la progresión hacia el nombre compiten por el mismo momento.**
> **DECISIÓN PENDIENTE (estratégica, de Agustina):** (a) name-ask — relajar el eval y aceptar el abanico en ese turno
> (evolución de producto) vs pelear por preservar el nombre vs revertir a v41; (b) valor del usado — arrancar la tabla
> de referencia; (c) parser — investigar si v42 lo estresa. v42 está en el vivo. Comparación honesta: v41 (objetivo
> 5/5 con math ×4, name-ask 3/5) vs v42 (objetivo verde pero flojo, name-ask 0/3, + gate/deslinde/anticipo/pide-usado).
>
> **[nota original de v42, criterio y build:]**
> Criterio comercial de Agustina. `scripts/capacidad-toma-70.mjs` (v41→v42, aserciones OK). **(A)** SQL:
> param `usado_valor` (estimación de Franco); el tramo se calcula sobre `Capital Base = anticipo +
> usado_valor*0.70`, techo = CB*2 (financiando 50%); bandas entrada ≤CB*1.2, intermedio ≤CB*1.5, alto
> ≤techo, fuera >techo. Reemplaza el capacidad=anticipo*(4/2) de v40. **(B)** pto 5 rama financiación:
> gate DURO de 4 datos del usado (marca/modelo/año/**km**) antes de calcular; Franco estima el valor;
> 2 por tramo, carrocerías distintas; lenguaje "anticipo"/"capital inicial" (no "efectivo") en el texto
> nuevo; deslinde legal. **(C)** pto 6: deja de prohibir estimar el usado (lo necesita), aclara que es
> preliminar. **Decisión (Agustina):** Franco estima el valor del usado (única forma sin base de tasación;
> cubierto por el deslinde). **Sim offline (`sim-toma70.mjs`):** 7M+Ka(7.5M) → CB 12.25M, techo 24.5M →
> entrada Fiesta/Gol/Etios, **intermedio SOLO Cronos**, alto Kangoo/EcoSport/208/Onix/Duster, Corolla/Renegade
> quedan fuera (24.8/25.5 > 24.5). Bandas disparejas con este stock: **Agustina eligió pegar y medir así**,
> ajustar toma/bandas después con datos reales.
> **NO tocado (deuda v43):** rama contado (dos caminos), gate de v16, ~6 menciones de "efectivo" fuera del
> pto 5. **Backlog:** tabla de referencia de valores de usado (Agustina la quiere explorar) para no depender
> del guess del LLM. Subagentes n8n: evaluados — no arreglan la precisión del valor (problema de datos), sí
> descongestionarían el prompt (36k chars); cuidar trampa 5 (TPM). Eval `capacidad-de-compra-financiada`
> reestructurado a 2 turnos (pide km, después abanico); `financiacion-pide-usado-primero` nuevo.

> **Sesión 2026-07-23. v40: CAPACIDAD DE COMPRA con financiación. PEGADO Y MEDIDO. Objetivo VERDE; 1 regresión ABIERTA.**
> Captura (Sofía): con 7M de anticipo + un Ford Ka 2015 + ganas de financiar, Franco mostró SOLO la
> Fiesta 8.2M y el Gol 9.2M (lo más barato), trató los 7M como techo total y **ni factoró el 50%**.
> Reproducido en el eval nuevo `capacidad-de-compra-financiada` → **0/1 en v39** (no nombra ningún auto
> de tramo medio/alto). RAÍZ: `## Permuta` pto 5 arma "dos caminos" anclados al **efectivo crudo** que
> Franco pasa como precio_objetivo; la financiación vive en otro bloque y nunca entra al cálculo del stock.
>
> **Fix (`scripts/capacidad-de-compra.mjs`, v39→v40, aserciones OK):** dos partes, regla del proyecto.
> **(A) determinístico** — parámetro `con_financiacion` en `Listar stock` (NO `financia`: ese nombre ya
> lo usa Guardar lead con firma string 'Si/No/No mencionado' — trampa 3 lo cazó). Con
> `con_financiacion=1` la query calcula la capacidad real (anticipo × 4 con permuta / × 2 sin: el 50%
> financiado duplica, el usado ≈ otro anticipo duplica de nuevo) y devuelve un `tramo` por auto:
> entrada ≤60% de la capacidad, intermedio ≤80%, techo ≤100%, fuera >100%. **(B) lenguaje (trampa 6:
> se REEMPLAZA el guion)** — el pto 5 pasa a dos ramas: financia → explica la capacidad y muestra 2 por
> tramo (segmentos distintos); contado → los "dos caminos" de siempre (por eso `permuta-mas-efectivo`,
> que es contado/financia=0, NO se toca).
> **Los multiplicadores 4/2 y 0.60/0.80 son el número a ajustar** (agresividad comercial); hoy reproducen
> el ejemplo de Agustina: 7M+permuta → cap 28M → entrada Etios/Cronos, intermedio EcoSport/208, techo
> Corolla/Renegade, Ranger 57M queda fuera. Validado offline (`scratchpad/sim-tramos.mjs`).
>
> **PEGADO por Agustina y VERIFICADO byte a byte vs el vivo** (systemMessage 34941, query y toolDescription
> de Listar stock IDÉNTICOS; workflow activo, 35 nodos) — la deuda de verificación v39==vivo queda saldada
> de paso. Medido `evals/v40-medicion.json` + `evals/v40-permuta-repeat.json`:
> - **`capacidad-de-compra-financiada` 0/1 (v39) → VERDE (v40)**, respuesta ideal: 3 tramos × 2 autos, 6
>   cards (entrada Fiesta/Gol, intermedio Onix/208, techo Renegade/Corolla). El feature anda.
> - Controles `permuta-mas-efectivo` y `derivacion-pide-datos-del-usado` **verdes**.
> - **REGRESIÓN ABIERTA:** `permuta-una-pregunta-por-vez` cayó a **0/5** (era ~45-50% en v39). El name-ask
>   del turno 3 se pierde SIEMPRE: la narrativa nueva de tramos/capacidad se mete en ese turno (evidencia
>   directa en los t3: "Teniendo en cuenta tu anticipo... financiar hasta el 50%... Para entrada..."). v40
>   amplificó de ~50% a 0 la deuda del name-ask que Agustina había decidido NO tocar. Fix candidato (v41):
>   guard para que el guion de tramos NO dispare cuando Franco ya viene en la progresión de permuta con
>   auto+km (ahí el turno es el name-ask). **PENDIENTE DECIDIR con Agustina** antes de tocar (área marcada
>   "no re-abrir sin preguntar").
> - Nota de calidad: dentro de cada tramo Franco elige los más baratos, no los mejores (entrada arrancó con
>   Fiesta 105k / Gol 110k en vez de Etios 45k / Cronos 28k). Afinable con una línea de prompt.
>
> **PENDIENTES por la regresión:** puntero de producción (state-sync.mjs L18 → v40) y commit quedan EN
> ESPERA hasta decidir el v41 (o aceptar la regresión). El código de v40 ya está en el vivo igual.

> **Sesión 2026-07-23. REDISEÑO DE STOCK (datos, no workflow). APLICADO EN SUPABASE Y VALIDADO.**
> Pedido de Agustina: redistribuir año/km/precio de los 17 autos para reflejar un mercado más real,
> **manteniendo marca y modelo** (atados a las fotos, `foto-{id}-N.webp`). Cambio de DATOS, no de
> workflow: no genera versión nueva de `franco-n8n`. Se hizo por el pipeline de `stock.csv` (los
> generadores lo leen y verifican).
>
> **Lo que se tocó:** (1) `stock.csv` — año/km/precio de los 17 + condición del 208 (2025/8k →
> Seminuevo) y la S10 (2022/68k → Usado), que quedaban incoherentes (condición es vestigial: sale de
> `ficha_completa` y no la leen las tools, pero se corrigió por honestidad del dato fuente). (2) **3
> descripciones curadas quedaron MINTIENDO** y las cazó el verificador de superlativos de
> `gen-descripcion-sql.mjs`: **Onix** ("km más bajos" → ahora T-Cross 5.2k y 208 8k son menores),
> **T-Cross** ("el más nuevo fuera de pickups" → empata con 208 2025), **Duster** ("la SUV más barata"
> → ahora EcoSport 19.8M es más barata). Reescritas + 2 absolutas que el verificador NO caza (**Vento**
> "prácticamente sin uso" con 24k, **S10** "casi sin uso" con 68k). CLAIMS actualizados: se quitaron 2
> y se cambió el de T-Cross por `10 tiene los km más bajos del stock` (verdadero). Verificado
> `✓ 19 superlativos`. (3) `content` se reescribe junto con año/km/precio: `Detalle auto` devuelve
> `ficha_completa` = `content` tal cual, que tiene año/km/precio embebidos — sin esto Franco daría el
> precio nuevo (metadata) y el viejo (ficha) en la misma llamada.
>
> **Por qué NO se revectoriza** (no se corre `revectorizar_con_consumo_v2.py`): (a) `Buscar auto` dejó
> de ser vectorial en v8, la columna `embedding` ya no se usa para recuperar; (b) el `armar_metadata`
> del .py NO incluye color/descripcion/condicionantes/tamano — correrlo los BORRARÍA. El nuevo
> `scripts/gen-stock-update-sql.mjs` emite un UPDATE aditivo idempotente (pisa solo las 4 claves que
> cambian + reescribe content), mismo patrón que color/descripcion.
>
> **Evals realineados** (tenían valores viejos cableados): `km-con-presupuesto` (ahora el único
> <50k km Y ≤13M es el Etios 12.5M; el resto <50k km se va de presupuesto) y `filtro-por-anio`
> (últimos 4 años = 2022+ = **9 autos** ahora, no 5; se agregó 2021 al `text_not_matches` y `cards_max`
> 6→9). **Corrido 2026-07-23 contra n8n: `filtro-por-anio`, `km-con-presupuesto`,
> `presupuesto-aproximado`, `rango-14-20`, `presupuesto-en-dolares` → 5/5 ok.** Manual: km-con-presupuesto
> lidera con el Etios (único <50k km Y ≤13M); filtro-por-anio arranca por Ranger 2024 y no cuela ningún
> 2017-2021 (cards_max 9 pasó). Sin expectativas viejas que reajustar. Los casos de permuta 8/10/12M no
> se corrieron (miden flujo, no autos puntuales); ojo que ya nada entra ≤8M (Fiesta 8.2M es el piso).
>
> **Aplicado en Supabase** (backup `autos_disponibles_backup_20260723`): se corrieron
> `scripts/stock-update-metadata.sql` (base + content) y `scripts/descripcion-metadata.sql` (regenerado).
> **Cards verificadas por código:** `Hidratar autos` (v37, línea 305) arma título+precio desde
> `metadata->>'año'`/`->>'precio'` fresco cada turno → se actualizan solas, foto sigue atada al id.
> **Falta:** commit (`stock.csv scripts/ evals/cases.json docs/franco/STATE.md`).

> **Sesión 2026-07-22 (cerrada). Producción: v37, alineado** (state-sync apunta a
> `franco-n8n-v37.json`; el puntero de producción está hardcodeado en `scripts/state-sync.mjs`
> línea 18 — actualizarlo al desplegar cada versión). Se pegaron y verificaron byte a byte, en
> orden, v34 → v35 → v36 → v37. Resumen de la tanda:
>
> **Baseline-v33 corrida: `evals/baseline-v33.json` → 30/35.** Triage de las 5 fallas:
> - `control-nombre-sin-apostrofe`: **ruido** (lead TIMEOUT 31s, cola de latencia del CRM, no dato corrupto — trampa 10).
> - `no-repreguntar-asesor`: la cola #1 conocida-abierta; su `lead_check estado="Requiere asesor"` **pasa** (v32 aguanta).
> - `permuta-una-pregunta-por-vez` (0/4) y `derivacion-pide-datos-del-usado` (0/4): **regresiones reales** del clúster permuta/derivación (STATE las daba por cerradas en v23/v29). `permuta-mas-efectivo` flaky 2/4.
>
> **v34 (`franco-n8n-v34.json`, PEGADO Y VERIFICADO byte a byte 2026-07-22):** fix del pedido
> del nombre en T3 de la progresión de permuta. Medido: `permuta-una-pregunta-por-vez` name-ask
> **0/4 → 2/3** (mejora, no cerrado); controles `permuta-mas-efectivo` **2/4 → 3/3**,
> `derivacion-no-repite-asesor`/`detalle-un-auto-fotos`/`cierre-conversacion` **3/3**. Sin
> regresiones. Agustina decidió aceptarlo así y seguir con otros fixes.
>
> **Instrumento arreglado:** el check T2 de `derivacion-pide-datos-del-usado` usaba `[^.?!]` y
> daba **falso positivo** cuando Franco preguntaba "qué auto entregás**?** Marca..." (el `?`
> cortaba el match). Cambiado a `[^.!]`, verificado por replay offline sobre 4 T2 guardados
> (Franco contestaba bien las 4 veces). Esa parte de la falla era del check, no de Franco.
>
> **v36 (`franco-n8n-v36.json`, PEGADO Y MEDIDO 2026-07-22):** apila dos fixes de secciones
> distintas, cada uno con su eval. Medido `evals/v36-medicion.json`:
> - **#2 RESUELTO** (`scripts/asesor-revisa-estado-no-km.mjs`, v34→v35): el asesor "ve el estado
>   del auto en persona" (ya no "el estado y los kilómetros"). `asesor-ve-estado-no-km` **3/3**;
>   verificación fuerte estructural (la frase se borró del prompt, no puede recitarse).
> - **#4 RESUELTO (core)** (`scripts/recomendacion-concreta.mjs`, v35→v36): recomendación con
>   molde (intro directo, lista con motivo, cierre simple). **El bookending desapareció 3/3** (el
>   bug de la captura: repetir el criterio al inicio Y al final). Queda un eco leve de intro en
>   2/3 ("estas te pueden servir por ser económicas") que **Agustina aceptó** como natural. El
>   check `recomendacion-sin-redundancia` se relajó para medir el bug real (resumen de cierre que
>   repite el criterio) y no el eco de intro: **v36 pasa 3/3**, y sigue cazando el bookend de v34.
>   Controles `recomendacion-por-tamano`/`detalle-un-auto-fotos` **3/3**, sin regresiones.
>
> **#1 (re-pide el nombre teniéndolo): NO se reproduce en v34.** El eval nuevo
> `derivacion-completada-nueva-pregunta` (derivación aceptada → da nombre → nueva pregunta FAQ →
> re-acepta) da **2/3** — Franco confirma sin re-pedir las 3 veces; el único rojo es cosmético
> (1/3 no la nombró "Natalia"). El lead queda `estado=Requiere asesor` + nombre correcto 3/3.
> El laburo de v30–v33 lo mitigó más de lo que STATE le acreditaba. **Para reproducir hace falta
> la captura exacta** (¿la nueva pregunta era sobre cuotas de un auto puntual? ¿había permuta?
> ¿el re-pedido fue apenas dado el nombre, con estado_cliente atrasado?). Sin reproducir no se
> arregla (regla de fierro). Eval queda como guardarraíl.
>
> **v37 (`franco-n8n-v37.json`, PEGADO Y MEDIDO 2026-07-22): regresión "derivación manda" RESUELTA.**
> Medido `evals/v37-medicion.json`: `derivacion-pide-datos-del-usado` **0/4 (v33) → 1/3 (v36) → 3/3 (v37)**.
> Controles `permuta-mas-efectivo` y `derivacion-no-repite-asesor` **3/3**. `permuta-una-pregunta-por-vez`
> name-ask: 2/3 (v34) · 1/3 (v37 r3) · 3/5 (v37 r5) = **4/8 (50%) en v37** → es el mismo ~50-55%
> inestable de v34, **v37 NO lo regresó** (el 1/3 era muestra chica). Sigue siendo el name-ask a
> mejorar, ya decidido "dejar por ahora". Detalle:
> `scripts/derivacion-manda-confirma-cierra.mjs` (v36→v37). Con el asesor ya pedido, al recibir
> los datos del usado Franco relanzaba la permuta con 7-8 cards y a veces re-pedía el nombre ya
> dado. Medido v36: `derivacion-pide-datos-del-usado` **1/3** (era 0/4 en v33). Causa trampa 6:
> "LA DERIVACIÓN MANDA" decía "confirmás y cerrás" en abstracto, y el único ejemplo concreto de
> cierre era sobre recibir el NOMBRE, no el usado → al llegar el usado Franco caía en la permuta.
> Fix: se le da a "LA DERIVACIÓN MANDA" el ejemplo concreto que falta (recibir usado → UNA
> burbuja que confirma nombrando el usado y cierra, `auto_ids` VACÍO, sin re-pedir el nombre).
> Al no mandar cards, el guard de `Armar respuesta` tampoco dispara (trampa 7 desactivada por el
> prompt). El eval se endureció: check nuevo en T3 que caza el re-pedido del nombre; reproduce
> 1/3 en v36. **Al pegar v37, medir:** `derivacion-pide-datos-del-usado` (objetivo verde) +
> controles `permuta-una-pregunta-por-vez`, `derivacion-no-repite-asesor`, `permuta-mas-efectivo`.
>
> **v38 (`franco-n8n-v38.json`, PEGADO Y MEDIDO 2026-07-22): FEATURE de financiación para demo.**
> `scripts/financiacion-demo.mjs`. Pedido de Agustina: mostrarle a dueños que Franco maneja
> financiación con solvencia (empresa ficticia, sin accuracy provincial que cuidar). Dos partes
> (regla del proyecto: dato→FAQ, lenguaje→prompt): **(A)** `empresa_faq` (Config) +2 entradas —
> documentación del comprador para prenda (DNI, CUIT/CUIL, ingresos, Formulario 08) y gastos de la
> operación (aranceles, sellos, prenda, gestoría, seguro), **cero montos en pesos**. **(B)** bloque
> `# Financiación` en el prompt — pre-perfilado (preguntar anticipo + cuántas cuotas para el asesor)
> + reframe "asesor en marcha" (si ya lo pidió/aceptó, no re-ofrecer conectar). Medido
> `evals/v38-medicion.json`: `financiacion-documentacion`/`-gastos`/`-preperfilado` y
> `asesor-en-marcha-no-reofrece` **3/3 cada uno** (fallaban 0/2 en v37). **Adherencia OK pese al
> +1k de prompt:** `derivacion-pide-datos-del-usado` y `permuta-mas-efectivo` **3/3**;
> `permuta-una-pregunta-por-vez` 1/3 (name-ask ~50% de siempre, no regresión). El bug de la captura
> (re-ofrecer asesor ya en marcha) NO reproducía en v37 (ya mitigado); el reframe quedó como refuerzo.
> **PENDIENTE: verificación byte-a-byte por MCP** (el server de n8n se desconectó durante la sesión;
> re-verificar `franco-n8n-v38.json` y `franco-n8n-v39.json` contra el vivo cuando reconecte).
>
> **v39 (`franco-n8n-v39.json`, PEGADO Y MEDIDO 2026-07-22): intento de cerrar el name-ask, NO
> alcanzó — aceptado como deuda consciente.** `scripts/permuta-nombre-burbuja-final.mjs`. Segundo
> intento de subir `permuta-una-pregunta-por-vez` del ~50% (el primero fue v34). Medido
> `evals/v39-medicion.json` **2/5** — sigue ~45%. Controles `derivacion-pide-datos-del-usado` y
> `derivacion-no-repite-asesor` **5/5**, `permuta-mas-efectivo` **4/5**: sin regresión. **Mecanismo
> entendido (mirando los 5 T3):** las corridas que ACIERTAN no muestran opciones (confirman el usado
> y piden el nombre); las que FALLAN muestran opciones y cierran en pregunta comercial. O sea:
> mostrar opciones en ese turno descarrila el pedido del nombre. Dos intentos de prompt (v34, v39)
> quedaron ~50% — es el patrón yo-yo del CLAUDE.md, el prompt no lo fuerza. **El fix que cerraría:**
> cero opciones en ese turno (sólo confirmar + pedir nombre), evaluado y **DECIDIDO NO hacerlo**
> (2026-07-22): Agustina prefiere conservar que Franco muestre opciones ahí; el fallo no es grave
> (Franco sigue la charla, sólo no toma el nombre en ese turno exacto). Deuda consciente medida:
> ~50%, resistente a prompt, con el fix determinístico-de-diseño identificado si se retoma.

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
| **condicionantes a pedido — perfil comercial** (2026-07-21, v20 + v23) | Franco volcaba los contras de un auto a quien no los pidió: *"aunque la potencia queda justa si lo cargás mucho en subida y no tiene cámara ni sensores"*, *"tené en cuenta que es la opción más cara y con mayor consumo del stock"*. **Es criterio comercial: los contras sólo van en comparación o si el cliente pregunta.** **El bug lo introdujo la regla de v18**, que decía *"si trae algo que le importa a ESTE cliente, lo decís en UNA frase ("tené en cuenta que la potencia es justa para el tamaño")"* — criterio elástico **y un ejemplo literal que el modelo recitaba casi textual**, misma trampa que el "efectivo" de v16 | **v20** reemplaza la regla y **saca el ejemplo** (una aserción impide que vuelva a entrar). **v23** la endurece tras medir que seguía filtrándose: al reescribir los condicionantes "hacia adelante" por pedido de Agustina, el del Vento quedó *"es turbo: pide nafta de buena calidad y service al día"*, que **suena a consejo útil y no a defecto**, y Franco no lo reconocía como un contra. Ahora la regla no depende del tono: *"no lo juzgues por cómo suena, juzgalo por de dónde viene"*. Medido: Vento **0/3 → 3/3**, Duster 2/3 → 3/3. **Guardarraíl `condicionante-si-preguntan` 3/3** en las dos versiones: si le preguntan directo, sigue respondiendo sin esquivar |
| **datos del usado al derivar** (2026-07-21, v21) | Si el cliente entregaba un usado y pedía un asesor, Franco pedía sólo nombre y apellido: el asesor recibía el lead sin saber qué auto entrega y tenía que volver a preguntar todo. `## Permuta` sí lo pedía, pero sólo se activa con esa narrativa completa (necesita presupuesto declarado); por la derivación general el dato se perdía. Medido **1/3** | **`franco-n8n-v21.json`** (`scripts/derivacion-datos-usado.mjs`). Se apoya en lo que Franco **ya recibe** (`lead_entrega` y `lead_usado` de `Leer lead (estado)`): si la entrega es "Sí" y no hay detalles, los pide junto con el nombre, en **un solo pedido**; si ya están cargados, **no repregunta** (repreguntar un dato ya dado es el bug de "pendiente #1"). Medido **1/3 → 3/3**, y el lead guarda `Volkswagen Gol 2015 - 90.000 km` |
| **la derivación manda sobre la permuta** (2026-07-21, v23) | Con *"quiero que me contacte un asesor"* ya dicho, al recibir los datos del usado Franco **relanzaba la narrativa completa de `## Permuta`**: 7 a 17 cards, los dos caminos, y volvía a preguntar si quería que lo derivara — algo que el cliente había pedido dos turnos antes. Medido **0/3**. **Conflicto de precedencia, no una regla suelta:** `## Permuta` se dispara con `entrega = "Sí"` y nada más, sin mirar si la derivación ya está en curso. v21 sólo tocó el turno en que se PIDEN los datos, no el siguiente. Ningún caso anterior combinaba permuta con pedido explícito de asesor, así que el conflicto nunca se había ejercitado | **`franco-n8n-v23.json`** (`scripts/derivacion-manda.mjs`). Decisión de Agustina: la derivación gana. La regla va en **los dos lados** — el gate de `## Permuta` (punto de disparo) y `# Derivación a un asesor` (punto de uso): no relanzar la narrativa, no listar stock ni mandar cards, no volver a ofrecer asesor; pedir lo que falte y **cerrar**. Check nuevo `cards_empty` en el turno 3, determinístico y no dependiente de cómo redacte. Medido **0/3 → 3/3** (0 cards), controles `permuta-mas-efectivo`, `derivacion-no-repite-asesor` y `cierre-conversacion` **2/2 cada uno** |
| **condicionantes con criterio comercial + color** (2026-07-21, v22 + SQL) | Dos pedidos de Agustina sobre capturas reales. (1) Varios condicionantes eran **negativos puros que además ya están a la vista en la card**: *"es la opción más cara y con mayor consumo"*, *"su consumo es más alto que el de un aspirado equivalente"*. (2) *"Está blanco"* en vez de "es blanco" — error de ser/estar | **(1)** Los 17 condicionantes reescritos con un criterio: **son un criterio de uso —para qué NO encaja y qué del stock encaja mejor— no un defecto**. Los mejores ya eran así (*"es 4x2, no 4x4"*, *"dos asientos, no sirve como familiar"*). **Aserción nueva** en `gen-descripcion-sql.mjs` que rechaza `más caro`, `mayor consumo`, `consumo alto` y `precio más alto`. **(2)** `franco-n8n-v22.json` (`scripts/color-es-no-esta.mjs`): micro-regla en el punto de uso. Se asume como micro-regla — no hay nada determinístico que arreglar, la tool devuelve `color: "Blanco"` y la frase la compone el modelo. Medido **3/3** |
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
| **parser en `fuera-de-alcance`** (2026-07-22, v24) | En pedidos fuera de rubro el modelo a veces nombraba la clave del array `"output"` en vez de `"messages"`, el `Structured Output Parser` rechazaba el objeto entero y `Armar respuesta` caía al fallback ("Uy, se me trabó el sistema"). ~40% flaky, la deuda más vieja. No arreglable aguas abajo: el texto bueno se pierde EN el parser | **`franco-n8n-v24.json`** (`scripts/alcance-clave-messages.mjs`): refuerzo de la clave `messages` pegado en `# Alcance`, el punto de uso — no en `# Formato de salida` (que ya lo declaraba y no alcanzaba). Hipótesis: el `jsonSchemaExample` muestra una respuesta CON autos, así que al redirigir sin autos el ejemplo ancla poco. **El parser NO se tocó** (aserción explícita: "Auto-Fix Format" ya llevó la falla a 100%). Medido: **7/10 → 10/10** |
| **permuta progresiva: responder primero, una pregunta por vez** (2026-07-22, v25→v29) | Captura: a "tengo 8 millones y un usado, reciben?" Franco abría con "un usado siempre es una ventaja" (sin contestar), pedía 6 datos de una (formulario) y derivaba en el primer turno. **Costó 4 intentos** (v25 0/3, v26 diagnóstico, v28, v29) por la **trampa 6**: la regla de v21 "todo junto en UNA sola pregunta" traía el formulario de 6 campos como ejemplo literal, y el modelo lo recitaba. Lo que funcionó fue **reescribir el guion**, no prohibir | **v25→v29** (varios scripts). El guion de `## Permuta` reescrito: (1) contestar la pregunta primero; (2) si no sabés qué auto entrega, no llamar la tool de stock (`auto_ids` vacío) — captura mostraba precios sin saber el usado; (3) progresión auto → km → nombre, una por turno, nombre al final. **En el camino se descubrió que el guard de cierre (`Armar respuesta`) inyectaba el "asesor", no Franco** (trampa 7). El intento de arreglar el guard en v27 metió una regresión (el saludo "Cómo estás?" tiene "?" y desactivaba el guard) — **cazada por replay offline sobre baselines guardadas, sin gastar cuota**, y revertida en v28. Medido: t1 y t2 perfectos, t3 (pedir nombre) cerrado en v29 |
| **filtro por año** (2026-07-22, v30) | Captura: "autos usados de los últimos 4 años" devolvía los 17. NO era prompt: las tools no tenían **ningún** parámetro de año (sólo precio y km), así que el criterio era infiltrable. Medido `filtro-por-anio` **0/2** (17 y 14 cards, con 2018/2019) | **`franco-n8n-v30.json`** (`scripts/derivacion-y-anio.mjs`): `anio_min` en `Listar stock` y `Buscar auto` (firma única, trampa 3) + el año actual inyectado al prompt (`{{ $now.year }}`, 2 expresiones nuevas → 21). Medido: **0/2 → 2/2**, controles `stock-general-completo`/`km-con-presupuesto`/`permuta-mas-efectivo` **2/2** |
| **Franco no sabía que el lead ya aceptó el asesor** (2026-07-22, v30 + v32) | Capturas 3-5 (misma conversación): el cliente aceptó y Franco se lo volvió a ofrecer **cinco veces**. **Dos causas encadenadas, las dos verificadas:** (1) `Leer lead (estado)` no seleccionaba la columna `estado`, así que `estado_cliente` nunca le decía a Franco que el lead estaba en "Requiere asesor"; (2) el CRM ni siquiera marcaba "Requiere asesor" cuando el cliente aceptaba una derivación **ofrecida por Franco** — su prompt sólo contemplaba que el cliente lo pidiera espontáneamente, y "si porfa" lo leía como charla | **(v30)** `estado` agregado a `Leer lead (estado)` y a `estado_cliente`. **(v32, `scripts/crm-acepto-derivacion.mjs`)** el prompt del CRM ahora marca "Requiere asesor" cuando el cliente acepta una derivación ofrecida por Franco ("sí", "dale", "si porfa", "sí pero antes contame X"), aunque nunca escriba "asesor"; + ortografía fija de "En conversación" (venía con y sin tilde). Medido: el `estado` pasa a "Requiere asesor" **4/4 corridas**. **NO cierra la re-pregunta del todo** — ver Abierto: `estado_cliente` va un turno atrasado |
| **guard: no duplica preguntas ni re-ofrece asesor aceptado** (2026-07-22, v31) | El guard de cierre miraba sólo si la ÚLTIMA burbuja **terminaba** en "?", así que una pregunta de Franco a mitad de párrafo ("...cuotas? Así lo ves mejor.") no contaba y le pegaba otra encima. Y con 1-2 autos la variante que inyectaba ofrecía un asesor, aun si el lead ya estaba en "Requiere asesor" | **`franco-n8n-v31.json`** (`scripts/guard-no-duplica.mjs`, sólo `Armar respuesta`): el guard mira si la última burbuja **contiene** "?" (no "termina en"), y si el lead ya está en "Requiere asesor" cierra con "Cuál te llama la atención?" en vez de re-ofrecer. **Predicado verificado por replay offline sobre 15 disparos guardados** (12 siguen disparando, 3 dejan y ya tenían pregunta) — el mismo método que evitó la regresión de v27. `try/catch` defensivo al leer el estado |

## Abierto

**Lo urgente son los 4 primeros: son bugs de derivación/lenguaje vistos en capturas reales de
la demo, varios de la MISMA conversación. El #1 es el más caro comercialmente.**

| Prioridad | ID | Qué | Por qué importa |
|---|---|---|---|
| 1 | **re-pregunta el asesor y RE-PIDE el nombre teniéndolo** (2026-07-22, captura 1, **de v33 — NO cerrado**) | Conversación real: el cliente aceptó el asesor, dio "Natalia Giménez Lascano", Franco confirmó y cerró. Después el cliente preguntó otra cosa (cuotas) y Franco **volvió a ofrecer el asesor** y, al "dale", **volvió a pedir "me dejás tu nombre y apellido?" teniéndolo ya**. **Dos partes:** (a) la re-pregunta del asesor — atacada en v30/v31/v32/v33 y mejorada (el CRM ya marca "Requiere asesor" 4/4), pero **no cerrada**; (b) re-pedir el nombre **con el nombre ya en el lead** (`lead_nombre` = "Natalia..."), que es nuevo y peor. Franco tiene el dato en `estado_cliente` ("Se llama Natalia") y aun así lo re-pide. **Componente estructural:** `estado_cliente` va un turno atrasado (ver Deuda consciente), pero en captura 1 el dato YA estaba disponible varios turnos después y Franco igual re-preguntó → **también es adherencia de prompt, no sólo timing**. Eval `no-repreguntar-asesor` existe (3 turnos, `lead_checks estado`); falta un caso que cubra "derivación YA COMPLETADA (nombre dado) + nueva pregunta" | El peor de la demo: hace ver a Franco como que no escucha ni recuerda. Delante del dueño es letal |
| 2 | **"el asesor revisa estado Y kilómetros" del usado** (2026-07-22, captura 2) | Al recibir un usado ("Ford Ka Viral 2013 100000 km"), Franco dice *"un asesor debe revisar estado y kilómetros"*. **El asesor revisa el ESTADO del auto, no los km** — los km los da el cliente (Franco ya los tiene). Decir que el asesor "revisa los km" es raro y contradice que el cliente ya los dio. Debe decir sólo "el asesor revisa el estado en persona" | Chico pero se nota: sugiere que no registró el dato que le acaban de dar |
| 3 | **al pedir datos del usado, repregunta los ya dados** (2026-07-22, captura 2) | La progresión auto → km → nombre (v25→v29) no chequea qué datos YA dio el cliente. Si en "Ford k viral 2013 100000 km" ya vinieron marca, modelo, año Y km, Franco no tiene que volver a preguntarlos. Debe mirar `estado_cliente`/la conversación y pedir sólo lo que falta. **Es el mismo modo de falla que el nombre re-pedido del #1** — repreguntar un dato ya dado | Fricción y sensación de formulario, justo lo que v25→v29 vino a sacar |
| 4 | **recomendación redundante al inicio y al final** (2026-07-22, texto que pasó Agustina) | Al recomendar por criterio ("marca económica y segura") Franco abre con *"te recomiendo estas opciones de autos usados de los últimos 4 años"* y cierra con *"combinan economía y confiabilidad... y están dentro de los últimos 4 años. Querés que te pase detalles..."* — repite el criterio del cliente al principio Y al final. **Debe ser concreto:** un intro corto, una línea por auto con UN beneficio, y un cierre simple ("te interesa alguno o preferís que te muestre otras?"). Ya existe la regla `# No repitas lo que ya hiciste` (v30) y la de no devolverle su intención (`recomendacion-por-tamano`) — **ninguna cubre este caso**, que es recomendación de VARIOS autos por criterio blando. Modelo de respuesta ideal en las notas de Agustina | Se lee pesado y robótico; una demo tiene que leerse fácil |
| 5 | **la suite tiene huecos de combinación, no de casos** (2026-07-21) | Varios bugs de esta sesión aparecieron **sólo al ampliar la cobertura**, no al correr la suite: el condicionante del Vento (un solo auto daba confianza falsa), la derivación relanzando la permuta (ningún caso combinaba permuta + pedido de asesor), y ahora el nombre re-pedido (ningún caso cubría derivación completada + nueva pregunta). **La suite cubre casos, no combinaciones**, y las combinaciones es donde chocan las reglas. Candidatas sin cubrir: derivación completada + nueva pregunta; presupuesto + permuta + fuera de alcance; recomendación por criterio blando | Con 33 versiones de workflow, cada regla nueva multiplica las combinaciones. Es el riesgo de fondo |
| 6 | **M1** | `Listar stock` sin `LIMIT` | Con 200 autos revienta contexto y costo |

Detalle completo de cada ID en `auditoria/AUDITORIA-FRANCO.md`.

## Decisiones tomadas

No re-proponer como pendientes: fueron evaluadas y decididas.

- **A2 (config multi-tenant): DESPRIORIZADO — esto es una demo** (2026-07-21). Figuraba como
  "bloqueante #1 para vender a la segunda concesionaria", pero Agustina confirmó que **la
  solución que se vende se va a armar aparte y de cero**. Cablear nombres de tabla acá es
  trabajo que se tira: la arquitectura multi-tenant se decide en ese momento. Además **A2 no
  cambia nada de lo que ve el dueño en la demo**.
  **Relevamiento hecho, para no repetirlo cuando se retome** (`scripts` de sondeo en el
  scratchpad de la sesión):
  - **La parte de cliente YA funciona.** Las 14 variables de negocio (nombre, dirección,
    horarios, FAQ, tono, permuta, dólar) se leen todas desde el prompt. Onboardear en lo
    comercial ya es editar un solo bloque.
  - **7 de 23 variables del Config nunca se leen:** `modelo_llm_conversacion`,
    `supabase_table_autos`, `supabase_query_match`, `postgres_table_memoria`,
    `memoria_ventana_mensajes`, `cards_cantidad`, `empresa_moneda`.
  - **`supabase_query_match` quedó huérfana**: era del `Supabase Vector Store` que se
    eliminó en v8 (fix de C2). Hay que borrarla, no cablearla.
  - **Faltan declarar tres:** `crm_leads` (hardcodeada en **6** nodos), `mensajes_demo` (3) y
    `gpt-4.1` del CRM (2). La auditoría no las listaba.
  - **⚠️ EL FIX QUE PROPONE LA AUDITORÍA ES ESTRUCTURALMENTE IMPOSIBLE PARA 7 NODOS.** Dice
    "que cada nodo lea del Config", pero el Config vive sólo en la cadena de `franco-chat`
    (`Leer lead (estado)` → `Config` → `Franco`). No pueden usar `$('Config')`:
    `Contar mensajes previos` y `Leer lead (estado)` (corren **antes** que el Config), y
    `Query leads`/`sessions`/`messages`/`save`/`delete` (están en **otros webhooks**, que son
    ejecuciones independientes donde el Config nunca ejecuta). Justo esos 7 son los que tocan
    `crm_leads`, `mensajes_demo` y `n8n_chat_histories`. Para resolverlo hay que usar
    Variables de n8n (`$vars`, globales sin importar topología — **verificar primero si están
    disponibles en la edición instalada**) o `$env`, no referencias al Config.

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
