# Estado de Franco

Última actualización manual: **2026-07-30**

<!-- AUTOGENERADO: no editar a mano. Regenerar con: node scripts/state-sync.mjs -->

**Workflow en producción:** `franco-n8n-v133.json` · 35 nodos

| | |
|---|---|
| Webhooks | 6 (auth: ninguna) |
| Nodos Postgres | 15 |
| Tools de Franco | Listar stock, Buscar auto, Guardar lead, Detalle auto |
| Modelos | OpenAI Chat Model: gpt-4.1-mini · OpenAI Chat Model (CRM): gpt-4.1 |
| Ventana de memoria de Franco | 20 |
| Empresa configurada | Automotores Tucumán |
| Evals | 93 casos · baseline-v132.json → 6/12 |

**Invariantes:** ✅ los 6 pasan

<!-- FIN AUTOGENERADO -->

> **🟢 ETAPA 2 DE LA MIGRACIÓN — LA COPY: APLICADA. 12 frases reescritas contra la ficha.
> Decisión de Agustina (2026-08-11): la ficha manda, las frases se amoldan. Sesión 2026-08-11.**
>
> **BACKUP: `autos_disponibles_backup_20260811`** (17 filas, previo al cambio).
> **Cambio verificado contra el backup clave por clave: exactamente 12 diferencias, todas en
> `descripcion`/`condicionantes`, en 10 autos. `content` intacto en las 17 filas. Ningún otro campo.**
>
> **🔴 ERAN 12 FRASES PERO 14 CONTRADICCIONES: verificando aparecieron DOS que no estaban en el
> conteo original.** La Fiesta decía *"ya viene con pantalla multimedia"* y su equipamiento es SYNC
> con Bluetooth, **sin pantalla**; y el Gol Trend mandaba al Cronos *"si pesa tener pantalla y
> cámara"* y el Cronos **tiene cámara pero no pantalla**.
>
> **🔴 CORRIJO ALGO QUE SE DIJO EN ESTA MISMA SESIÓN: "la ficha no tiene asientos ni equipamiento"
> ERA FALSO.** Sí los tiene — **en la columna `content`, no en las claves de `metadata`**. El Kangoo
> dice *"5 asientos, configuración de 5 pasajeros"* y el Etios *"central multimedia con pantalla
> táctil y Bluetooth"*. Por eso las 3 que se habían clasificado como "necesitan un dato que no
> existe" se resolvieron contra la ficha igual que las otras. **Antes de decir que un dato no está,
> mirar `content`, no sólo `metadata`.**
>
> **ACOPLAMIENTO VERIFICADO ANTES DE TOCAR:** `content` **NO** contiene `descripcion` ni
> `condicionantes` (viven sólo en `metadata`), así que el texto vectorizado no quedó desincronizado.
> Y de los evals, la única palabra tocada que aparece en `cases.json` es `justa` (5 veces), **siempre
> como prohibición** — no se rompe ningún check.
>
> **⚠️ PENDIENTE QUE DEJA ESTE CAMBIO: `descripcion-que-aporta` PIERDE EL FILO.** Su check
> `text_not_matches \bjusta\b` se diseñó alrededor de la frase del Duster, que ya no existe: ahora
> pasa trivialmente. **El caso sigue siendo válido por sus otros checks, pero ese en particular ya no
> mide nada** — hay que darle un objetivo nuevo o sacarlo.
>
> **🛠 TRAMPA DE SQL QUE COSTÓ UNA CORRIDA Y CONVIENE ANOTAR: `UPDATE ... FROM` aplica UNA SOLA fila
> de origen cuando varias matchean el mismo destino.** El Onix y el Etios tenían dos cambios cada uno
> y se aplicó sólo el condicionante: 12 intentos → 10 filas. Se detectó **porque el script comparaba
> el conteo esperado contra el real**; sin ese conteo pasaba silencioso. Las 2 restantes se aplicaron
> aparte.

> **🟢 v133 DESPLEGADO Y MEDIDO: `derivacion-aceptada-igual-pide-nombre` CERRADO EN 3/3 después de
> estar rojo desde v128. 9/12. Sesión 2026-08-11.**
>
> **MEDICIÓN (`evals/baseline-v133.json`), contra v132:**
> · `derivacion-aceptada-igual-pide-nombre` **1/3 → 3/3** ← el objetivo. Venía 0/3 (v128), 1/3
>   (v129), 0/3 (v130), 2/8 (v131), 1/3 (v132).
> · `derivacion-completada-no-reofrece-visita` **2/3 → 3/3** ← arrastrado por el mismo fix
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **3/3** · `no-repreguntar-asesor` **0/3** (sin cambio)
>
> **LA SEÑAL DECLARADA ANTES DE MEDIR, Y ES LA QUE VALE — no el score:**
> el check de re-ofrecer el asesor pasó de **3 → 3 → 0** (v131 → v132 → v133), y las fallas totales
> de los 4 casos de **10 → 9 → 5**. Las cuatro predicciones que se escribieron antes de correr
> (subir / 3-3 / quedarse / no esperar nada) se cumplieron.
>
> **⚠️ SE CUMPLIÓ TAMBIÉN LA RESERVA QUE SE HABÍA ANOTADO: el re-ofrecimiento sale por más de un
> lado.** A `no-repreguntar-asesor` le queda un check DISTINTO en el turno 2
> (`(querés|te interesa|te gustaría|preferís) … asesor … ?`) que v133 no toca, más sus dos causas
> propias ya documentadas: el consumo (`6,8 L/100km`) en el turno 2 y el nombre en el turno 3. Su
> raíz sigue siendo la de siempre — `Leer lead (estado)` no trae la columna `estado`— y va aparte.
>
> **QUEDA COMO PRÓXIMO EN LA LISTA: la ETAPA 2 de la migración (la copy).** Es la única pendiente
> bloqueada esperando criterio comercial: 12 de las 34 frases de `descripcion`/`condicionantes`
> contradicen la ficha (el Kangoo dice "sólo dos asientos" y son 5; Onix y EcoSport dicen "caja
> manual" y son automáticas), y una de esas palabras la chequea `descripcion-que-aporta`.

> **🟢 v132 DESPLEGADO Y MEDIDO: CERO NOMBRES INVENTADOS EN 12 CORRIDAS — cumplió el criterio que se
> había declarado ANTES de medir. 🟡 v133 ARMADO Y APROBADO, NO DESPLEGADO
> (`scripts/el-techo-no-reofrece-el-asesor-ya-aceptado.mjs`). 1 nodo. Sesión 2026-08-11.**
>
> **v132 (`evals/baseline-v132.json`) contra la línea de base de v131 — 6/12 vs 7/12:**
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **3/3 → 3/3** · `derivacion-aceptada-igual-pide-nombre`
>   **0/3 → 1/3** · `derivacion-completada-no-reofrece-visita` **3/3 → 2/3** ·
>   `no-repreguntar-asesor` **1/3 → 0/3**
> · **`no_nombre_inventado` NO disparó ni una vez.** Era el único criterio declarado de antemano.
>
> **LOS DOS QUE BAJARON NO SON REGRESIÓN, Y ESTA VEZ SE PUDO ATRIBUIR PORQUE HABÍA "ANTES":**
> · `derivacion-completada-no-reofrece-visita`: su única falla es el turno 5 con **el mismo check de
>   re-ofrecer el asesor** que rompe el otro caso. **Es el bug que ataca v133 asomando en otro
>   lado**, no algo que rompió v132.
> · `no-repreguntar-asesor`: **4 fallas en v131 y 4 en v132** — el score cambió sólo porque se
>   repartieron distinto entre corridas. No está peor. Una de sus fallas es sobre el consumo
>   (`6,8 L/100km`), que no tiene nada que ver con este cambio.
> **Sin la línea de base esto se habría leído como "v132 rompió dos casos".**
>
> **🔴 v133 — TRAMPA 7 POR TERCERA VEZ EN EL DÍA, Y ES LA CAUSA RAÍZ DE UN CASO ROJO DESDE v128.**
> La respuesta que falla está escrita **TEXTUAL** en la inyección de v100, que ordena *"Decí TEXTUAL
> esta frase"* y termina con *"…o, si preferís, puedo ponerte en contacto con un asesor para revisar
> alternativas de financiación."* — **que es exactamente el string que el `text_not_matches` marca en
> rojo**. Franco no desobedece: obedece. Y como esa inyección se declara *"la regla que manda sobre
> cualquier otra"*, **le gana al name-ask que restauró v131** — por eso restaurar el fix no alcanzó.
>
> **EL FIX (determinístico, los dos datos ya están en el lead):** el cierre de esa frase pasa a
> depender del estado de derivación. no derivado → el cierre de hoy intacto · ya derivado sin nombre
> → **pide el nombre** · ya derivado con nombre → ofrece opciones **sin re-ofrecer el asesor**.
> Los números, el techo y la prohibición de nombrar autos más caros **no se tocan** (assert cada uno).
> **Las 3 ramas se evalúan EJECUTANDO el bloque**, con el techo de $30.000.000 verificado en las tres.
>
> **AL PEGAR v133:** `workflows/franco-n8n-v133.json`, 35 nodos, 6 invariantes. Aprobado por la
> compuerta contra `evals/baseline-v132.json`.
> **MEDIR** los mismos 4 casos, `--repeat 3 --delay 45000 --json evals/baseline-v133.json`.
> **Puede cerrar DOS casos a la vez:** `derivacion-aceptada-igual-pide-nombre` y la falla de turno 5
> de `derivacion-completada-no-reofrece-visita`, que son el mismo check.

> **🟡 v132 ARMADO Y APROBADO POR LA COMPUERTA, NO DESPLEGADO
> (`scripts/ningun-ejemplo-de-salida-lleva-nombre-propio.mjs`). 1 nodo. Sesión 2026-08-11.**
>
> **QUÉ ATACA:** `no_nombre_inventado` disparó sobre v131 en producción — Franco volvió a decir un
> nombre propio a un cliente anónimo. **v130 tapó UNA fuente y quedaban dos plantillas más**, las dos
> de SALIDA, o sea el formato exacto de lo que Franco escribe, listo para copiar:
> · línea 32: `Esto NO aplica a nombrarlo por su nombre de pila ("perfecto Martín"), que sí va.`
> · línea 246: `Si te dice "...", le contestás "Perfecto Martín", nunca "Perfecto Martín D'Angelo"`
>
> **LA DISTINCIÓN QUE GENERALIZA LO DE v130, Y ES LA LECCIÓN:**
> · un ejemplo de **ENTRADA** (*"si te dice X"*) describe lo que llega — es **información**;
> · un ejemplo de **SALIDA** (*"le contestás X"*) es una **PLANTILLA**, y el modelo copia plantillas.
> v132 borra las de salida y **conserva las de entrada**. Misma forma que v124: quitar el insumo,
> no agregar una prohibición. Nombres propios en el prompt **5 → 2**, plantillas de salida **0**.
> La advertencia agregada **no nombra a nadie** (assert propio): escribirlo dentro de una
> prohibición es volver a darle el ejemplo — es el error que cometió v130.
>
> **🛠 LA COMPUERTA DE PRE-DEPLOY SE ESTRENÓ EN EL FLUJO REAL Y BLOQUEÓ ESTE MISMO CANDIDATO:** con
> v132 ya armado y sin la línea de base escrita, `--file` salió en rojo. Recién con
> `evals/baseline-v131.json` (4 casos) lo aprobó. **Tres horas antes, en esa situación exacta, se
> habría desplegado.**
>
> **LÍNEA DE BASE DE v131 (`evals/baseline-v131.json`, 4 casos × 3):**
> `derivacion-aceptada-igual-pide-nombre` **0/3** · `no-repreguntar-asesor` **1/3** (ahora SÍ tiene
> "antes", que era lo que faltó toda la tarde) · `derivacion-completada-no-reofrece-visita` **3/3** ·
> `cuotas-el-plazo-se-contesta-y-se-deriva` **3/3**.
>
> **AL PEGAR v132:** `workflows/franco-n8n-v132.json`, 35 nodos, 6 invariantes.
> **MEDIR** con los mismos 4 casos del baseline, `--repeat 3 --delay 45000`.
> **La señal de v132 NO es el score del caso:** es que **`no_nombre_inventado` no dispare** en
> ninguna corrida. El caso puede seguir rojo por lo de abajo.
>
> **🔎 PASO 3, DIAGNÓSTICO EN CURSO — DOS INYECCIONES COMPITEN EN EL TURNO 4.** Las 3 fallas de la
> línea de base son idénticas y NO son "faltó el name-ask": Franco contesta
> *"Con un anticipo de $15.000.000 … podríamos buscar vehículos de hasta aproximadamente
> $30.000.000"*. **15 × 2 = 30: esa cuenta la hace una inyección determinística, no el modelo.**
> O sea que en ese turno pelean el guion del techo de capacidad y el del name-ask, y gana el
> primero. **Se diagnostica con el log de n8n, no razonando sobre el prompt.**

> **⚠️ CORRECCIÓN CON MÁS MUESTRA (misma sesión): "EL MEJOR RESULTADO DE LAS ÚLTIMAS CUATRO
> VERSIONES" FUE UNA CONCLUSIÓN APURADA.** La línea de base de v131 (3 corridas más, misma versión)
> dio **0/3**, así que sobre v131 el acumulado es **2 de 8 = 25%**, contra **1/3 = 33%** de v129.
> **No es claramente mejor.** El 2/5 era una muestra favorable y se leyó como tendencia.
> Lo que sí queda en pie, porque es mecánico y no estadístico: **el fix restaurado ESTÁ y la
> inyección dispara** — ninguna de las 8 fallas es "no apareció la línea del name-ask".
>
> **🟡 v131 DESPLEGADO Y MEDIDO: `derivacion-aceptada-igual-pide-nombre` 2/8. Sesión 2026-08-11.**
>
> **MEDICIÓN (caso a 5 repeats, controles a 3):**
> · `derivacion-aceptada-igual-pide-nombre` **2/5** (v128 0/3 · v129 1/3 · v130 0/3)
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **3/3** (v130: 2/3) · `derivacion-completada-no-reofrece-visita` **3/3**
> · 🟡 `no-repreguntar-asesor` **1/3 — NO ATRIBUIBLE**, ver abajo
>
> **LO QUE QUEDA ROJO NO ES EL NAME-ASK: SON DOS COSAS DISTINTAS.** Ninguna de las 3 fallas es que
> la inyección restaurada no dispare:
> · **2 corridas** — turno 4: Franco se va a **calcular capacidad** (*"Con un anticipo de
>   $15.000.000 y sin un usado para entregar, podríamos buscar vehículos de hasta…"*) y de paso
>   **re-ofrece el asesor**. Es el otro check del caso, el que ya estaba anunciado como no cubierto.
> · **1 corrida** — turno 3: **`no_nombre_inventado` DISPARÓ.** Ver abajo, es lo importante.
>
> **🔴 EL CHECK NUEVO CAZÓ UN BUG REAL EN PRODUCCIÓN, UNA HORA DESPUÉS DE ESCRIBIRLO.** Franco
> volvió a decir *"Martín"* a un cliente anónimo, en el turno 3. **v130 NO cerró el problema, sólo
> una de sus fuentes:** sacó el nombre literal de UN guion, pero en el prompt quedan **5
> apariciones más**, y una es directamente copiable —
> `Si te dice "Martín D'Angelo", le contestás "Perfecto Martín"`—: le está mostrando la plantilla
> `"Perfecto <nombre>"` lista para usar. **Ésa es la próxima fuente a tapar, y ya no hace falta
> encontrarla leyendo la base a mano: ahora la caza el eval.**
>
> **🟡 `no-repreguntar-asesor` 1/3: NO SE PUEDE ATRIBUIR, Y ES LA ÚLTIMA VEZ QUE PASA.** No hay
> corrida sobre v130 porque **v131 se armó y se pegó sin medir los controles antes** — el mismo
> error de v128, cometido de nuevo. Falla `text_matches /nombre/` en el turno 3: Franco pide el
> anticipo en vez del nombre. **Contexto, que NO es atribución:** STATE ya lo tiene anotado como
> *"la cola #1 conocida-abierta"*, con raíz propia verificada (`Leer lead (estado)` no trae la
> columna `estado`). Por mecanismo, la rama que agregó v131 sólo puede EMPUJAR a pedir el nombre,
> no a evitarlo — pero eso es un argumento, no una medición.
> **A partir de ahora lo impide la compuerta de pre-deploy** (ver la entrada correspondiente).
>
> **PRÓXIMO PASO, EN ORDEN:** (1) tapar la plantilla `"Perfecto Martín"` de la regla de nombre de
> pila; (2) recién después, el re-ofrecimiento del asesor y el desvío a calcular capacidad, que es
> el resto del caso. **Antes de armar el candidato hay que producir
> `evals/baseline-v131.json`** con el caso y sus controles — la compuerta no aprueba sin eso.

> **🛠 COMPUERTA DE PRE-DEPLOY: SIN LÍNEA DE BASE CON CONTROLES, UN CANDIDATO NO SE APRUEBA.
> Sesión 2026-08-11.**
>
> **POR QUÉ ES UNA COMPUERTA Y NO UNA NOTA: la nota ya existía y falló.** Se anotó como regla el
> 2026-08-11, se guardó en la memoria del proyecto, y **dos horas después se repitió el mismo
> error** al armar v131. Antes había pasado con v128: se midió el caso antes de desplegar y los
> controles no, se rompió `financiacion-pide-anticipo` y la regresión apareció con la versión ya en
> producción. **Una regla que depende de acordarse no es una regla.**
>
> **CÓMO FUNCIONA:** corre en `scripts/state-sync.mjs`, sólo con `--file` y sólo si el archivo
> auditado es una versión MAYOR que la de producción — o sea, justo cuando se está por aprobar un
> candidato. Exige que exista `evals/baseline-<produccion>.json` y que cubra **al menos DOS casos
> distintos**. Dos es el punto: con uno solo se mide el caso que se está arreglando y se comete el
> error de nuevo. **Los controles son la parte que se saltea.**
>
> **PROBADA EN TRES DIRECCIONES:** sin baseline → bloquea · con baseline de UN caso → bloquea igual
> · con caso + 2 controles → pasa. Los archivos de prueba se borraron, **incluida la baseline falsa**
> (si quedaba, dejaba pasar un deploy real).
>
> **Producir la línea de base:**
> `node evals/run.mjs --case <caso>,<control1>,<control2> --repeat 3 --delay 45000 --json evals/baseline-<produccion>.json`
>
> **De paso:** el puntero de producción ahora es la constante `PRODUCCION` en una línea propia de
> `state-sync.mjs`. Antes vivía dentro de un ternario y se editaba a ciegas.
> **También quedó escrito en `CLAUDE.md`**, en las reglas no negociables de validación.

> **🔴 EL CASO NO ERA FLAKY: EL FIX SE HABÍA PERDIDO. `derivacion-aceptada-igual-pide-nombre` viene
> rojo porque el fix determinístico de v75 DESAPARECIÓ DEL WORKFLOW EN v77 y estuvo perdido 53
> versiones. v131 ARMADO Y NO DESPLEGADO (`scripts/restaurar-el-name-ask-perdido-en-v77.mjs`).
> 1 nodo. Sesión 2026-08-11.**
>
> **⚠️ EL ENCABEZADO DE ARRIBA DICE "❌ 2 rotos" A PROPÓSITO Y NO ES UN ERROR: producción (v130)
> efectivamente NO tiene el fix.** Vuelve a verde al pegar v131.
>
> **LA TRAZA, VERSIÓN POR VERSIÓN** (contando las apariciones de `YA ACEPT` en `Config`):
> `v75` **2** (la línea partida según el nombre — el fix) · `v76` **2** · **`v77` 1 ← se perdió acá**
> · y **1** en todas hasta `v130`.
> **Se perdió SÓLO ese campo, no un nodo entero:** entre v76 y v77 el único cambio en todo el
> workflow es `Config.estado_cliente`, de 1404 a 1154 chars. Alguien editó esa expresión partiendo
> de una copia vieja. **Verificado nodo por nodo: no hay otros fixes perdidos por ese camino.**
>
> **POR QUÉ NADIE LO VIO EN 53 VERSIONES:** el caso no se cayó de golpe, empezó a fallar de a poco
> y se lo trató como flaky. Su histórico "3/4 y 7/8" es de v78 — o sea que **ya estaba roto cuando
> se anotó ese número**. En esta sesión dio 0/3, 1/3 y 0/3, y hasta hoy se lo estuvo explicando
> como ruido.
>
> **v131 = EL TEXTO DE v75, IDÉNTICO.** No es un fix nuevo y no se "mejora" de paso: es el que se
> midió 1/7 → 7/8. `Config.estado_cliente` parte la línea según `lead_nombre`, que ya viene
> normalizado a `''` (su CASE trata el teléfono ficticio `+54%` como vacío). **Es la regla del
> proyecto y la trampa 7:** la frase la inyecta el CÓDIGO, así que el fix va donde está la frase, no
> en el prompt. **El systemMessage no se toca** (hay assert).
> **Las 4 ramas se evalúan EJECUTANDO la expresión**, no chequeando strings: derivado sin nombre
> pide el nombre, derivado con nombre no lo repide y conserva el nombre, y sin derivar no dice que
> aceptó. **4/4.**
>
> **🛠 INVARIANTE 6 NUEVO EN `state-sync.mjs`, Y ES LA LECCIÓN QUE VALE MÁS QUE EL FIX:**
> **un fix que se puede perder en silencio se va a perder.** Los 5 invariantes viejos son trampas de
> n8n; éste es de otra clase: verifica que las inyecciones determinísticas **que ya costaron una
> medición** sigan estando. **Probado en las dos direcciones: falla contra v130 (producción, sin el
> fix) y pasa contra v131.** Si hubiera existido en v77, la pérdida se cazaba ese mismo día.
>
> **AL PEGAR v131:** `workflows/franco-n8n-v131.json`, 35 nodos, **6** invariantes. 1 nodo (`Config`,
> sólo `estado_cliente`).
> **MEDIR:** `--case derivacion-aceptada-igual-pide-nombre --repeat 5 --delay 45000`
> (sobre v130: **0/3**; v129 1/3; v128 0/3) · controles: `no-repreguntar-asesor`,
> `derivacion-completada-no-reofrece-visita`, `cuotas-el-plazo-se-contesta-y-se-deriva`.
>
> **⚠️ NO VA A ARREGLAR TODO EL CASO, Y CONVIENE SABERLO ANTES:** en v130 el caso también falla por
> **re-ofrecer el asesor** (*"preferís, puedo ponerte en contacto con un asesor"*), que es un check
> distinto del name-ask. v131 ataca el name-ask. Si el caso sube pero no llega a 5/5, eso es lo que
> queda, y va aparte.

> **🟢 v130 DESPLEGADO Y MEDIDO: CERO NOMBRES INVENTADOS. 🛠 Y EL CHECK `no_nombre_inventado` YA
> ESTÁ EN `ALWAYS` — corre en los 93 casos. Sesión 2026-08-11.**
>
> **MEDICIÓN DE v130 (15:31–15:5xZ), contra la de v129:**
> · **0 nombres inventados en toda la tanda** (12 corridas) — consultado directo contra
>   `mensajes_demo`, no hay un solo vocativo con nombre. Antes: **3 de 6**.
>   **OJO CON EL TAMAÑO:** son 3 corridas del guion que fallaba; a la tasa anterior (50%) ver cero
>   en 3 pasa 1 de cada 8 veces. **Buena señal, no prueba.**
> · `financiacion-pide-anticipo` **3/3** · `financiacion-cuanto-falta` **3/3** — los dos se mantienen
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **2/3** (v128 5/5, v129 3/3 → acumulado **10/11**).
>   La corrida que falló perdió el porqué. Con n=3 está dentro del ruido; **no se toca**.
> · 🔴 `derivacion-aceptada-igual-pide-nombre` **0/3** (v128 0/3, v129 1/3) — ver abajo
>
> **🛠 EL CHECK NUEVO, Y ES LA LECCIÓN DE PROCESO MÁS IMPORTANTE DE LA SESIÓN: una regresión
> visible y vergonzosa pasó por debajo de los 93 casos sin que ninguno la cazara.** Se encontró
> leyendo la base a mano. `no_nombre_inventado` vive ahora en `ALWAYS`.
> · **La señal es el VOCATIVO, no el nombre:** Franco sólo nombra al cliente para dirigirse a él.
>   La prueba de que es inventado es que el cliente **nunca lo escribió**, y para eso `run.mjs`
>   acumula sus turnos en `dichoPorCliente` (igual que ya acumulaba la media vista).
> · **Verificado contra las 2701 sesiones: 380 vocativos, 358 legítimos, 22 inventados,
>   0 falsos positivos.** Compara **sin tildes** a propósito: el cliente escribe "Martin" y Franco
>   contesta "Martín" — eso es correcto.
> · Prueba: `scripts/no-le-pongas-nombre-al-que-no-se-presento.mjs`, **15/15** (5 inventados +
>   10 legítimos, con los bordes que romperían un detector mal hecho: *"Perfecto. Con un
>   anticipo…"*, una marca detrás del vocativo, y el mismo nombre con y sin tilde).
> · **NO ES UN BUG NUEVO:** 22 casos repartidos en 20–25/07, 06/08, 10/08 y 11/08. Vive hace meses;
>   lo que lo hacía invisible es que ningún check miraba esto.
>
> **🔴 `derivacion-aceptada-igual-pide-nombre`: 3 VERSIONES SEGUIDAS EN ROJO (0/3, 1/3, 0/3) Y YA NO
> ALCANZA CON LLAMARLO FLAKY.** Sus fallas de v130 **ya no son el nombre inventado**: son el
> name-ask ausente y el re-ofrecimiento del asesor (*"preferís, puedo ponerte en contacto con un
> asesor"*), que es **el bug original del caso**. STATE ya dice que su fix va en `Config` —que falte
> el nombre es determinístico (`lead_nombre === ''`)— **y no en el prompt**. Su histórico de 3/4 y
> 7/8 es de v78, muchas versiones atrás. **Es el próximo pendiente y va solo, sin mezclarlo con
> nada.** No se puede descartar que v128–v130 hayan contribuido: no hay corrida sobre v127.
>
> **🛠 DATO OPERATIVO QUE CORRIGE ALGO ESCRITO MÁS ABAJO:** *"el eval no imprime nada mientras
> corre"* vale para el **pipe** (`| head`), no para el **redirect**. Con `> archivo.log` la salida
> se va escribiendo y se puede leer el avance a mitad de tanda. Verificado hoy. Sirve justo para lo
> que STATE señala como problema: distinguir una tanda colgada de una lenta.

> **🟢 v129 DESPLEGADO Y MEDIDO: LA REGRESIÓN DE v128 ESTÁ CERRADA. 🔴 PERO APARECIÓ UNA SEGUNDA,
> TAMBIÉN MÍA. v130 ARMADO Y NO DESPLEGADO
> (`scripts/el-nombre-de-ejemplo-no-se-le-dice-al-cliente.mjs`). 1 nodo. Sesión 2026-08-11.**
>
> **MEDICIÓN DE v129 (15:04–15:23Z), con el "antes" completo por primera vez en esta cadena:**
> · `financiacion-pide-anticipo` **0/3 → 3/3** — la regresión de v128 está cerrada
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **3/3** — lo que ganó v128 se mantuvo
> · `financiacion-cuanto-falta` **3/3** — control sano
> · 🔴 `derivacion-aceptada-igual-pide-nombre` **0/3 → 1/3** — mejoró, pero ver abajo
>
> **⚠️ CORRECCIÓN (misma sesión, medido después): "LO INTRODUJE YO" ES DEMASIADO FUERTE Y ESTÁ MAL.**
> El bug de los nombres inventados **existe desde julio**: 20–25/07 hubo 16 casos (Martín, Agustín,
> Lucía), más 1 el 06/08 y 1 el 10/08. Lo que sí está medido es más acotado: **en el guion de
> `derivacion-aceptada-igual-pide-nombre` pasó de 0 en 28 corridas a 3 de 6**, o sea que v128/v129 lo
> **amplificaron en ese camino**. Eso sigue siendo mío; haberlo creado, no. El párrafo de abajo se
> deja como quedó escrito, con esta corrección arriba.
>
> **🔴 FRANCO LE DICE UN NOMBRE PROPIO A CLIENTES QUE NUNCA SE LO DIERON.**
> Corridas del guion de `derivacion-aceptada-igual-pide-nombre`, donde el cliente **no da nombre en
> ningún turno**:
> · 2026-08-01: **24 corridas, 0** con nombre inventado · 2026-08-05: **4, 0**
> · 2026-08-11 (v128+v129): **6 corridas, 3** — *"Perfecto Martín, el plan y el valor de la cuota…"*
> **Cero en 28 antes, 3 de 6 después.** No es la flakiness histórica del caso.
>
> **🔴 LA LECCIÓN, Y ES UNA VUELTA DE TUERCA DE LA TRAMPA 6 QUE NO ESTABA ESCRITA:** el guion con el
> nombre de ejemplo **ya existía y nunca se copiaba**. v128 le agregó EL PORQUÉ —justo lo que el
> modelo quiere decir cuando el tema son las cuotas— y con eso **volvió más atractiva la rama
> equivocada**: el modelo pasó a elegir ese guion (el de "ya tenés el nombre") en vez del anónimo, y
> se trajo el nombre de ejemplo puesto.
> → v129 dejó dicho *"preguntate a qué REGLA le gana un ejemplo nuevo"*. **Falta la otra mitad:
> preguntate también A QUÉ OTRO EJEMPLO se lo hacés parecer.** El modelo copia lo que más se parece
> a lo que está por escribir, y mejorar un guion es hacerlo más elegible.
>
> **v130: saca el nombre literal del guion** y deja `<su nombre de pila>` más la condición de cuándo
> no corre. **El texto nuevo NO vuelve a escribir el nombre de ejemplo** (dárselo otra vez, aunque
> sea dentro de una prohibición, es cómo se propaga — assert incluido). Las otras 5 apariciones del
> nombre en el prompt NO se tocan: enseñan a acortar nombre+apellido y están enmarcadas con "si te
> dice X". Apariciones **6 → 5**, con assert de que baja exactamente 1.
> **Nota de proceso:** el primer assert de este script era demasiado ancho (`/perfecto Martín/i`) y
> **frenó el build** por la aparición legítima. Quedó acotado a la forma de guion. El assert hizo
> justo lo que tenía que hacer.
>
> **AL PEGAR v130:** `workflows/franco-n8n-v130.json`, 35 nodos, 5 invariantes.
> **MEDIR — el "antes" es la medición de v129 de arriba:**
> `--case derivacion-aceptada-igual-pide-nombre,cuotas-el-plazo-se-contesta-y-se-deriva,financiacion-pide-anticipo,financiacion-cuanto-falta --repeat 3 --delay 45000`
> `derivacion-aceptada…` tiene que subir de **1/3** y, sobre todo, **no puede aparecer ningún nombre
> propio inventado**; los otros tres tienen que quedarse en **3/3**.
>
> **⚠️ SIN MEDIR:** `derivacion-aceptada-igual-pide-nombre` tiene **una segunda falla, distinta**, que
> v130 no ataca: una corrida se fue a calcular capacidad y re-ofreció el asesor
> (*"preferís, puedo ponerte en contacto con un asesor"*), que el caso prohíbe. Su histórico es 3/4 y
> 7/8, así que aun sin nombres inventados puede no llegar a 3/3. **Es un caso con bug propio y va
> aparte** — STATE ya dice que su fix va en `Config`, no en el prompt.

> **🔴 v128 DESPLEGADO: ARREGLÓ SU CASO Y ROMPIÓ OTRO. v129 ARMADO Y NO DESPLEGADO
> (`scripts/el-porque-no-se-come-el-anticipo.mjs`). 1 nodo. Sesión 2026-08-11.**
>
> **MEDICIÓN DE v128 (14:31–14:45Z):**
> · `cuotas-el-plazo-se-contesta-y-se-deriva` **0/5 → 5/5** — el fix anda
> · `financiacion-cuanto-falta` **3/3** — control sano
> · 🔴 `financiacion-pide-anticipo` **0/3 — REGRESIÓN, ATRIBUIDA**
> · 🟡 `derivacion-aceptada-igual-pide-nombre` **0/3 — NO ATRIBUIBLE** (ver abajo)
>
> **LA REGRESIÓN, Y LA ATRIBUCIÓN NO ES UNA SOSPECHA:** los TRES turnos 3 contestaron con el guion
> NUEVO de v128 palabra por palabra (sesiones `2276e660`, `4fe58204`, `92c245a9`):
> · Franco: *"…de cuánto pensás poner de anticipo más o menos?"*
> · Cliente: *"24 creo que sería mejor"* ← **son CUOTAS, no un anticipo**
> · Franco: *"Perfecto, con 24 cuotas el plan y el valor de la cuota te los confirma un asesor…
>   Me dejás tu nombre y apellido?"* — **saltea el anticipo y va al nombre.**
>
> **🔴 TRAMPA 6 EN CONTRA DEL QUE ESCRIBE EL FIX, Y ES LA LECCIÓN NUEVA.** v128 metió *"si el cliente
> preguntó por un plazo, eso es una PREGUNTA y se contesta antes de pedirle nada"* **dentro del guion
> del name-ask**, y esa frase le ganó a la regla de DATO INCOMPLETO que está justo abajo (*"si te da
> las cuotas pero no el anticipo, volvé a pedir el que falta ANTES de seguir"*). **El ejemplo nuevo
> se comió la regla vieja.** La trampa 6 se conocía como algo que le pasa al prompt viejo; **acá la
> provocó un fix**. Corolario: cuando agregues un ejemplo, preguntate a qué regla de abajo le gana.
>
> **v129: acota el disparador con la condición que faltaba (que el anticipo YA esté) y sobre todo
> pone el CONTRA-EJEMPLO textual** con el diálogo medido y el guion del re-pedido — que es el MISMO
> que ya usa la regla de DATO INCOMPLETO (hay un assert de que aparece 2 veces: dos redacciones para
> lo mismo es pedirle al modelo que elija). Una condición sola sería otra regla abstracta, y contra
> un ejemplo las reglas pierden.
>
> **🟡 `derivacion-aceptada-igual-pide-nombre` 0/3: NO SE PUEDE ATRIBUIR Y NO SE VA A FINGIR QUE SÍ.**
> 1 de las 3 corridas usó el guion nuevo, las otras 2 el texto viejo, y el caso ya venía flaky
> (3/4 y 7/8 en tandas anteriores). **No hay corrida sobre v127**, así que no se sabe si v128 lo
> empeoró. Queda como incógnita explícita, ni regresión ni sano.
>
> **⚠️ EL ERROR DE MÉTODO, ANOTADO PORQUE ES LA CAUSA RAÍZ DE TODO ESTO: se midió el caso antes de
> desplegar, pero los controles NO.** Por eso la regresión se descubrió con v128 ya en producción, y
> por eso el segundo control quedó sin línea de base. `CLAUDE.md` ya pedía la corrida previa; lo que
> faltaba era entender que **incluye los controles**. Decisión de Agustina (2026-08-11): de ahora en
> más, línea de base del caso **Y** de los controles, siempre.
>
> **AL PEGAR v129:** `workflows/franco-n8n-v129.json`, 35 nodos, 5 invariantes.
> **MEDIR — y acá el "antes" ya existe, es la medición de v128 de arriba:**
> `--case cuotas-el-plazo-se-contesta-y-se-deriva,financiacion-pide-anticipo,derivacion-aceptada-igual-pide-nombre,financiacion-cuanto-falta --repeat 3 --delay 45000`
> Tiene que: `financiacion-pide-anticipo` **0/3 → 3/3**, `cuotas-el-plazo…` **quedarse en 5/5**,
> `financiacion-cuanto-falta` **quedarse en 3/3**, y `derivacion-aceptada…` da la primera lectura
> comparable que vamos a tener.

> **🟡 v128 ARMADO Y NO DESPLEGADO — LAS CUOTAS SE CONTESTAN CON EL PORQUÉ
> (`scripts/las-cuotas-se-contestan-con-el-porque.mjs`). 1 nodo. Sesión 2026-08-11.**
>
> **LÍNEA DE BASE: `cuotas-el-plazo-se-contesta-y-se-deriva` 0/5 sobre v127**, y siempre falla el
> MISMO único check: el del porqué (`depende|según`). Los otros tres (reconocer las 24, nombrar al
> asesor, no pedir datos de un usado inexistente) pasan. El caso aísla una sola cosa.
>
> **🔴 TRAMPA 6 EN ESTADO PURO, Y LA PRUEBA ES QUE LA FRASE ESTÁ ESCRITA EN EL PROMPT.** Franco
> contesta *"Perfecto, le dejo anotado al asesor la simulación con $13.000.000 de anticipo en 24
> cuotas. Me dejás tu nombre y apellido"* — **la frase literal de la charla de Valentina**. Y está en
> la **línea 320** del systemMessage: `Guion: "perfecto, le dejo anotado al asesor la simulación con
> $15.000.000 de anticipo en 36 cuotas. Me dejás tu nombre y apellido así te contacta?"`.
> **Franco no está fallando: está OBEDECIENDO.** Por eso el fix NO agrega una regla que diga
> "explicá el porqué" —eso ya falló tres veces en este proyecto— sino que **reemplaza los guiones**.
>
> **EL FIX: 3 guiones reemplazados, 1 nodo (`Franco (AI Agent)`), systemMessage 78.763 → 79.370.**
> El porqué queda con UNA sola redacción en los tres lugares (si cada guion lo dice distinto, el
> modelo elige): *"el plan y el valor de la cuota te los confirma un asesor, porque depende de las
> condiciones de financiación"*. **Conserva el name-ask** (sin nombre el lead queda anónimo) y la
> prohibición de dar un monto de cuota — las dos con assert.
>
> **DECISIÓN DE AGUSTINA (2026-08-11), Y NO HAY QUE REVERTIRLA: Franco NO dice el monto a financiar
> (precio − anticipo).** Se había evaluado y era determinístico, así que por la regla del proyecto
> habría ido a SQL. **Agustina decidió que no hace falta decirlo.** De paso evita un problema ya
> medido: el corrector de precios de v105 se comía ese número en **2 de 7 redacciones**.
> **⚠️ CORRIJO UNA CORRECCIÓN MÍA:** más abajo escribí que la clasificación de este pendiente como
> *"guion (trampa 6)"* estaba mal y que el bug era determinístico. **Con la decisión de Agustina, la
> clasificación original era la correcta y la mía sobraba.** El fix es 100% de guion.
>
> **AL PEGAR:** `workflows/franco-n8n-v128.json`, 35 nodos, 5 invariantes.
> **MEDIR:** `--case cuotas-el-plazo-se-contesta-y-se-deriva --repeat 5 --delay 45000`
> (sobre v127: **0/5**) · **controles obligatorios, porque el guion tocado es el del name-ask:**
> `derivacion-aceptada-igual-pide-nombre`, `financiacion-pide-anticipo`, `financiacion-cuanto-falta`.
> (Los tres verificados contra `cases.json`: **existen**. En una versión anterior de esta entrada
> puse `financiacion-cierra-pidiendo-nombre` y `no-repedir-el-nombre`, que **no son ids de caso**
> sino nombres de archivo de `scripts/` — corregido.)
>
> **⚠️ LO QUE v128 NO CUBRE, Y ESTÁ SIN MEDIR:** la **línea 9** del prompt (la que corre cuando el
> cliente YA dio el nombre) tiene su propio guion —*"le paso todo a un asesor así te contacta y te
> arma la simulación"*— y dice que manda sobre CUALQUIER guion de más abajo. **Ése no se tocó**: si
> el cliente ya dio el nombre y pregunta por un plazo, sigue sin el porqué. Es el mismo bug en otra
> rama, no tiene caso de eval, y tocarlo mete mano en el flujo del nombre — va aparte.
>
> **EL BUG, de la charla real de Valentina Uria (sesión `340c6109`, 2026-08-09):** Franco ofrece el
> menú *"en cuántas cuotas, 12, 24, 36 o 48?"*, el cliente contesta *"cómo sería con 24?"* y Franco
> devuelve **cero números** — repite la frase del asesor y pide el nombre. Reproducido 3 de 3.
>
> **ESTÁ PARTIDO EN DOS Y NO HAY QUE CONFUNDIRLOS:**
> · **el VALOR de la cuota no es calculable y no debe serlo.** No hay tasa en `Config` a propósito, y
>   la FAQ ya dice que la simulación la arma un asesor. **Que Franco no invente una cuota es
>   CORRECTO y tiene que seguir así** — está escrito en el caso para que nadie lo "arregle".
> · **el MONTO A FINANCIAR sí es aritmética:** precio − anticipo = 21.000.000 − 13.000.000 =
>   **8.000.000**, y entra en el tope del 50%. Ese número no lo da nunca.
>
> **⚠️ CORRIJO LA CLASIFICACIÓN QUE ESTABA EN STATE:** este pendiente estaba anotado como *"esto es
> guion (trampa 6)"*. **El número que falta es DETERMINÍSTICO** y por la regla del proyecto va a
> código. Lo único que es guion es el encuadre ("la cuota exacta la arma un asesor"), que ya funciona.
>
> **🔴 Y LA LECCIÓN DE v126 SE CUMPLE OTRA VEZ, MEDIDA ANTES DE ESCRIBIR EL FIX: el corrector de
> precios SE COME EL NÚMERO NUEVO. 2 de 7 redacciones**, ejecutando el corrector REAL de v127:
> *"…quedarían $8.000.000 a financiar"* → sale **$21.000.000**. Mueren justo las naturales, las que
> ponen "a financiar" DESPUÉS del monto: el guard semántico sólo mira los 40 caracteres ANTERIORES,
> y el aritmético no aplica porque 8.000.000 no es la mitad de 21.000.000.
> **Y OJO: una de las que sobrevive lo hace POR ACCIDENTE** —el regex se consume el $21.000.000 del
> renglón y ya no vuelve a matchear—, no porque un guard la salve. No confiar en ésa.
>
> **POR ESO EL FIX SON DOS COSAS:** (1) `Detalle auto` devuelve el monto a financiar; (2) ampliar el
> guard semántico para que mire también lo que viene DESPUÉS del monto. Sin (2), (1) llega pisado.

> **🟡 FUGA DE VOCABULARIO INTERNO: CENTINELA ARMADO, BUG NO REPRODUCIDO. NO SE TOCÓ NADA DE
> FRANCO. Sesión 2026-08-11.**
>
> **LO QUE SÍ QUEDÓ, Y ESTÁ PROBADO:** el check `no_vocabulario_interno` en `evals/run.mjs`, dentro
> de `ALWAYS` — corre en los **92** casos, en todos los turnos. Prueba:
> `scripts/el-vocabulario-interno-no-sale-al-cliente.mjs`, **32/32**, extrayendo la función REAL del
> runner (no una copia). Caso nuevo `no-fugar-vocabulario-interno` con el estado que la provoca.
>
> **LO QUE NO QUEDÓ: LA REPRODUCCIÓN. 0 fugas en 18 corridas sobre v127** (12 de
> `chico-no-es-utilitario` + 6 del caso nuevo). **La regla dice que si no falla primero no se
> entendió el bug, así que NO se intentó ningún fix.**
>
> **LA CARACTERIZACIÓN (medida contra `mensajes_demo`, 2701 sesiones): 19 fugas, 3 firmas.**
> · token entre comillas — 15: `opciones "estirar"`, `categoría "económica"`, `precio "entra"`
> · `categoría <token>` sin comillas — 2
> · el valor crudo de `tamano` como sustantivo — 5: *"la opción chico"*, *"opciones mediano/grande"*
> `estirar` es el que más fuga (11 de 15) y **siempre en el mismo momento: cuando el modelo tiene
> que NOMBRAR el bloque de arriba.** La última fuga registrada es del **2026-08-10**.
>
> **🔴 EL CHECK NO PROHÍBE LAS PALABRAS, Y ESO ES EL DISEÑO, NO UN DETALLE.** "económica" y
> "estirar" son español normal y aparecen **91 y 404 veces legítimamente** en el historial ("algo de
> más categoría", "podés estirar un poco", "equipada para su categoría"). Prohibir el token habría
> pintado de rojo medio corpus **en los 92 casos a la vez**. Se caza la etiqueta *usada como
> etiqueta*. **Verificado contra las 2701 sesiones: 19 rojos, todos reales, 0 falsos positivos** — la
> lección de v122 aplicada a una regex. Y el borde peligroso quedó ejercitado EN VIVO: una corrida
> contestó *"Si podés estirar un poco y llegar hasta $15 millones"* y el check se quedó verde.
>
> **POR QUÉ PROBABLEMENTE NO FUGÓ, Y ES UNA HIPÓTESIS, NO UN HECHO:** la fuga necesita que el bloque
> `entra` quede **vacío**, porque ahí el modelo tiene que nombrar los otros bloques para explicarse.
> Las dos fugas del 08-10 salieron del guion de `chico-no-es-utilitario` cuando **v118 todavía
> silenciaba el Etios** por la etiqueta `economica`: sin Etios, `entra` quedaba vacío. Con v118
> arreglado, ese guion **ya no llega al estado**: las 12 corridas contestaron *"el auto chico que
> entra bien es: Etios"*. El caso nuevo fuerza el estado por presupuesto (con 12M la ventana
> `entra` 10,8–12M está vacía de verdad, Fiesta 8,2M y Gol Trend 9,2M caen en `economica` y el Etios
> 14,5M en `estirar` — verificado contra `autos_disponibles`) y tampoco fugó en 6.
>
> **LO QUE ESTO NO PRUEBA, Y HAY QUE DECIRLO:** 0 de 18 **no prueba ausencia**. A la tasa histórica
> del guion (3 de 26, ~12%) ver cero en 12 pasa 1 de cada 5 veces; a la tasa global (0,73%) ver cero
> en las 92 sesiones del 08-11 pasa la mitad de las veces. **El bug no está cerrado: está sin
> reproducir.** El centinela es lo que lo va a cazar cuando aparezca, con el texto exacto y el
> estado, en cualquiera de los 92 casos.
>
> **SIN MEDIR:** los otros 90 casos no se corrieron con el check nuevo. El respaldo es offline y es
> más grande que una pasada de la suite (2701 sesiones), pero no es lo mismo.

> **🟢 v127 DESPLEGADO Y MEDIDO — EL ANTICIPO MÍNIMO LLEGA ENTERO AL CLIENTE: 0/3 → 3/3.
> Puntero: v127 vivo, encabezado verificado (35 nodos, 5 invariantes). Sesión 2026-08-11.**
>
> **MEDICIÓN LIMPIA (ventana 05:31:59–05:44:10Z, 12 min, `--repeat 3 --delay 45000 --no-cleanup`):
> 12/12.**
> · `anticipo-minimo-es-la-mitad` **0/3 sobre v126 → 3/3 sobre v127**
> · los tres controles, los que tienen montos en renglones con nombre de auto —que es justo lo que
>   v127 toca— siguen **3/3**: `stock-general-completo`, `no-ofrecer-lo-que-no-existe`,
>   `capacidad-de-compra-financiada`.
>
> **LA PRUEBA ESTÁ EN `mensajes_demo`, QUE ES EL LADO DONDE ANTES SALÍA MAL.** Las tres corridas
> entregaron el número correcto al cliente, cada una con una redacción distinta —o sea que no lo
> salvó una plantilla, lo salvó la guarda:
> · `d6c1c51b` → *"necesitás un anticipo mínimo de **$10.500.000**"*
> · `3daefd3f` → *"el anticipo mínimo que necesitás es **$10.500.000**"*
> · `271ef0fc` → *"necesitás un anticipo mínimo de **$10.500.000** para financiar hasta el 50%"*
> **Ni un solo `$21.000.000` presentado como anticipo en toda la ventana** (consultado directo contra
> `mensajes_demo`). En v126 eran 3 de 3 pisados.
>
> **EL CORRECTOR DE PRECIOS SIGUE CORRIGIENDO** — el control que importaba, porque las dos guardas
> podrían haberlo desarmado: los listados salieron con los precios de catálogo (Ranger $57.000.000,
> Cronos $16.800.000, EcoSport $19.800.000, 208 $21.000.000).
> `search_executions` (error+crashed, ventana exacta): **0** — sabiendo que no caza errores de tool,
> por eso además se cruzó el texto entregado contra la base.
>
> **LO QUE QUEDÓ SIN MEDIR, Y ES DELIBERADO:** la guarda aritmética no corrige un precio inventado
> que caiga exactamente en la mitad del precio real. Es el sesgo elegido (igual que v116): pasarse de
> prudente lo caza `no_inventa_autos`; quedarse corto le miente al cliente sobre cuánta plata
> necesita y no lo caza nadie. **No hay caso de eval para ese borde.**
>
> **LA LECCIÓN SIGUE SIENDO LA DE v126, AHORA CON EL CIERRE MEDIDO: UN CORRECTOR DETERMINÍSTICO ES UN
> ARMA CARGADA APUNTANDO AL FUTURO.** Hoy son dos (precios v105, años v109). Antes de agregar un dato
> numérico a una respuesta, preguntarse cuál lo va a tocar.

> **⚠️ ENTRADA SUPERADA — decía "v127 ARMADO Y NO DESPLEGADO". Ya se desplegó y se midió: ver la
> entrada de arriba. El diagnóstico de v126 que sigue abajo SIGUE SIENDO VÁLIDO como historia.**

> **🟡 v126 DESPLEGADO Y MEDIDO: 0/3 — PERO v126 ANDA. EL QUE ROMPE ESTÁ AGUAS ABAJO.
> v127 ARMADO Y NO DESPLEGADO (`scripts/el-corrector-no-pisa-el-anticipo.mjs`). Sesión 2026-08-11.**
>
> **MEDICIÓN DE v126 (ventana 05:12:38–05:23:34Z, toda sobre v126 — `updatedAt` 05:12:13):**
> `anticipo-minimo-es-la-mitad` **0/3** · pero los tres controles que tocan `Detalle auto` quedaron
> **3/3**: `detalle-un-auto-fotos`, `no-repite-la-ficha` y `la-ficha-que-no-se-dio-no-esta-dada`.
>
> **🔴 TRAMPA 7 EN ESTADO PURO, Y LA PRUEBA SON LOS DOS NODOS DE LA MISMA EJECUCIÓN `15225`
> (sesión `b035fc81`):**
> · `Detalle auto` → `anticipo_minimo: "$10.500.000"` — **v126 anda**
> · `Franco (AI Agent)` → *"el anticipo mínimo que necesitas es **$10.500.000**"* — **el modelo anda**
> · lo que recibió el cliente (`mensajes_demo`) → *"… es **$21.000.000**"* — **el código lo pisó**
> **Difieren, así que no lo escribió el modelo.** 3 de 3.
>
> **QUIÉN LO PISA: el corrector de precios de v105 en `Armar respuesta`.** Busca en CADA RENGLÓN que
> nombre un auto del catálogo cualquier monto, y si no coincide con el precio de ese auto lo
> reemplaza. El renglón traía el nombre del 208 y $10.500.000 ≠ $21.000.000 → lo reescribió.
> **EL COMENTARIO DEL PROPIO NODO YA LO ANTICIPABA Y SE QUEDÓ CORTO:** dice *"Acotado al MISMO
> RENGLÓN a propósito: un '$5.000.000 de anticipo' en otro párrafo no se toca"*. Se protegió por
> PÁRRAFO, no por SIGNIFICADO.
>
> **v127 — DOS GUARDAS, LAS DOS SÓLO PUEDEN DEJAR DE CORREGIR, NUNCA CORREGIR DE MÁS:**
> (1) **semántica**: si justo antes del monto dice anticipo / entrega / seña / cuota / mínimo /
> financiás, ese monto no es el precio; (2) **aritmética**: si el monto es exactamente la mitad del
> precio, es el anticipo mínimo por definición — no depende de cómo lo redacte el modelo.
> **Probado 10/10 ejecutando el corrector de verdad**, con el texto REAL de `15225` y con los tres
> casos reales que motivaron v105 (Renegade $24,5M, Gol Trend $17M, EcoSport $27M), que **se siguen
> corrigiendo**. 1 nodo: `Armar respuesta` (27.732 → 28.464). El corrector de AÑO (v109) no se toca.
>
> **LA LECCIÓN, Y ES NUEVA: UN CORRECTOR DETERMINÍSTICO ES UN ARMA CARGADA APUNTANDO AL FUTURO.**
> v105 se escribió para pisar precios inventados y funciona. Pero cada campo NUEVO que agregue un
> monto al texto —el anticipo mínimo de v126, y mañana una cuota o una tasación— entra en su rango de
> tiro. **Antes de agregar un dato numérico a una respuesta, revisar qué correctores lo van a tocar.**
> Hoy son dos: el de precios (v105) y el de años (v109).

> **🟡 v126 ARMADO Y VERIFICADO CONTRA LA BASE, NO DESPLEGADO — BUG 2, EL ANTICIPO MÍNIMO
> (`scripts/el-anticipo-minimo-es-la-mitad.mjs`). 2 nodos. Sesión 2026-08-11.**
>
> **LÍNEA DE BASE: `anticipo-minimo-es-la-mitad` 0/3 sobre v125.**
> **🔴 Y EL MODO DE FALLA REAL NO ES EL QUE DECÍA EL REPORTE — vale anotarlo.** El reporte original
> era que contestaba el precio entero ($21.000.000 para el 208, cuando el mínimo es $10.500.000).
> Hoy, medido, hace algo distinto y peor: **no da la cuenta.** Explica la regla del 50% y le devuelve
> la pregunta al cliente — *"la financiación puede cubrir hasta el 50% del valor… De cuánto sería el
> anticipo que pensás poner?"* — en las 3 corridas. Le pide justo el dato que el cliente vino a
> buscar. El check que caza esto es `text_matches 10.500.000`; el que prohibía decir el precio entero
> pasó, así que **si sólo hubiera puesto ese, el caso habría dado verde con el bug vivo.**
>
> **POR QUÉ PASA:** el número no existe en ningún lado. `pisos_carroceria` hace la misma cuenta pero
> por CARROCERÍA (el piso del segmento), no por auto puntual. Cuando preguntan por UN auto el modelo
> tiene que multiplicar, y no lo hace. **Es aritmética: va a SQL.**
>
> **EL FIX:** `Detalle auto` devuelve `anticipo_minimo` = precio/2 **ya formateado igual que
> `precio`** (mismo `to_char`), para que se copie tal cual y no se recalcule. Declarado en la
> toolDescription y en el prompt, con el ejemplo concreto del fallo medido (trampa 6) y **sin números
> de este stock** (lección de v120).
> **VA FUERA DEL BLOQUE DE SUPRESIÓN DE v119**, como `version`: hay un assert que lo exige, porque si
> quedara adentro desaparecería justo cuando la ficha ya se dio.
>
> **VERIFICADO CONTRA LA BASE (la lección de v122):** la query real devuelve
> Ranger **$28.500.000** · Corolla **$12.400.000** · 208 **$10.500.000** · Cronos **$8.400.000** ·
> Fiesta **$4.100.000**, y `estado_ficha` sigue completa. Más 5/5 en la cuenta offline.
> **NO SE TOCÓ `Listar stock`** (hay assert): el bug es sobre un auto puntual.
>
> **AL PEGAR — 2 NODOS:** `Detalle auto` → **query** (4.222 → 4.791) y **toolDescription**, y
> `Franco (AI Agent)` → **systemMessage** (78.130 → 78.763). 35 nodos, 5 invariantes.
> **MEDIR:** `--case anticipo-minimo-es-la-mitad --repeat 3 --delay 45000` (sobre v125: **0/3**) ·
> controles: `detalle-un-auto-fotos`, `no-repite-la-ficha`, `la-ficha-que-no-se-dio-no-esta-dada`
> (los tres tocan `Detalle auto`).

> **🛠 EL EVAL YA DISTINGUE UNA FALLA DE RED DE UN ROJO DE CONTENIDO (`evals/run.mjs`).**
> Nace de la caída de n8n de hoy: la tanda reportaba `FAIL` y `ERROR` mezclados y se estuvo leyendo
> como si midiera algo. Ahora `esFallaDeRed()` clasifica y `veredictoRed()` imprime cuántas corridas
> murieron por transporte, **cuántas midieron de verdad**, y si fueron todas dice *"esta tanda no
> vale. Repetirla."*. **Probado 26/26** en `scripts/el-guardia-de-deploy-avisa.mjs`, con los mensajes
> LITERALES de hoy (`fetch failed`, `The operation was aborted due to timeout`) y con los negativos
> que NO tiene que excusar: un rojo de contenido, un 404 de ruta mal y una respuesta no-JSON.

> **🟢 v125 DESPLEGADO Y MEDIDO — EL GEMELO EN CARROCERÍA CERRADO: 0/3 → 3/3.
> Puntero: v125 vivo, encabezado verificado. Sesión 2026-08-11.**
>
> **MEDICIÓN LIMPIA (ventana 04:47:07–04:59:00Z, 12 min):**
> `hatchback-que-entra-no-se-silencia` **0/3 → 3/3** · `chico-no-es-utilitario` **3/3** (el control
> que importa: v125 REORDENÓ el mismo `CASE` que usa v118, y no lo movió) ·
> `no-ofrecer-lo-que-no-existe` **3/3** · `stock-general-completo` **2/3, y el rojo es
> `ERROR: The operation was aborted due to timeout` — RED, NO CONTENIDO.** Total 11/12.
> Las tres corridas encabezan con el Peugeot 208.
>
> **🔴 LA PRIMERA TANDA DE v125 NO MIDIÓ NADA Y HAY QUE SABER RECONOCER ESTO: n8n SE CAYÓ.**
> Arrancó 00:42:02Z y quedó viva **4 horas**. En `mensajes_demo` hay un hueco de **3h50 entre las
> 00:50 y las 04:41**, y el log tiene `fetch failed` y `operation aborted due to timeout`. Tres
> corridas murieron por red. **Se descartó entera y se repitió.**
> · **EL EVAL NO DISTINGUE UNA FALLA DE RED DE UNA DE CONTENIDO:** un `FAIL` por timeout se lee
>   igual que un rojo real. **Pendiente: que el runner lo separe, igual que ahora separa un deploy
>   a mitad de tanda.**
> · **Y NO AVISA MIENTRAS CORRE** (la salida va bufereada por el pipe), así que una tanda colgada
>   parece una tanda lenta. **Mirar el reloj.** Lo detectó Agustina, no yo.
> · **NO USAR `head -N` en el pipe del eval:** trunca justo el detalle de las fallas.
>
> **🛠 DEFECTO LATENTE ENCONTRADO Y ARREGLADO DE PASO:** el `fetch` del guardia de deploy era **el
> único del archivo sin timeout**. Hoy no fue la causa (con la key apagada ni se ejecuta), pero era
> una bomba para el día que se configure `N8N_API_KEY`: el guardia que existe para proteger la
> medición podía colgar la tanda entera. Ahora corta a **10 s**, más agresivo que los 90 s del resto,
> porque es telemetría y no la medición.
>
> **(entrada previa) 🟡 v125 ARMADO Y VERIFICADO CONTRA LA BASE, NO DESPLEGADO
> (`scripts/la-carroceria-que-entra-no-se-silencia.mjs`) — EL GEMELO DEL BUG DEL ETIOS, EN
> CARROCERÍA. 1 nodo: `Listar stock` (12.987 → 14.417). Sesión 2026-08-11.**
>
> **LÍNEA DE BASE TOMADA ANTES, Y FALLA: `hatchback-que-entra-no-se-silencia` 0/3 sobre v124.**
> Ninguna de las tres nombra el Peugeot 208 y una dice textual *"no hay hatchback"*. En otra **lista
> el Gol Trend ($9.200.000) a un cliente de $24.000.000 pero saltea el 208 ($21.000.000)**: le baja
> la gama justo salteando el único que le servía.
>
> **EL AGUJERO, MEDIDO:** con capital $24M los CUATRO hatchbacks caen en `economica` → cero `entra`
> y cero `estirar`. Y no es exclusivo del hatchback: barriendo capitales de $10M a $40M aparece en
> las cinco carrocerías — **Hatchback 25 capitales (desde $11M), Utilitario 20, Sedán 13, SUV 8,
> Pickup 2**.
>
> **ES LA MITAD DE v118 Y POR DISEÑO:** el CTE `criterio` se hizo genérico por criterio justamente
> para esto, así que sólo se agrega la parte de **promover**. La de **reetiquetar** NO va: para la
> carrocería ya están `carroceria_solo_si_hay` y la prosa que prohíbe llamarle pickup a un hatchback.
>
> **🔴 UNA TRAMPA QUE HABRÍA ROTO ESTO EN SILENCIO, ENCONTRADA ANTES DE ESCRIBIR EL FIX:**
> `metadata.carroceria` guarda **"Sedán"** con tilde y el detector de `Config` emite **"sedan"** sin
> tilde. Un `lower(carroceria) = carroceria_pedida` **NUNCA** habría matcheado sedán —una de las
> cinco— y nadie se habría enterado, porque las otras cuatro andan. **Probado contra la base: sin
> `translate` el match da 0; con `translate` da 4.** Hay un assert que exige los tres `translate`.
>
> **VERIFICACIÓN, LAS TRES CAPAS (la lección de v122 aplicada):**
> · tabla de verdad del CASE como función pura: **10/10**, incluido que **el tamaño manda sobre la
>   carrocería** (si pidió chico y el auto cumple carrocería pero no tamaño, va a `otro_tamano`);
> · **la query REAL contra la base**: hatchback+$24M → **208 pasa a `entra`, y es UN SOLO cambio
>   respecto de v124**; sin criterio → **CERO cambios**; siempre **17 filas** (trampa 4 a salvo);
> · el assert de columnas de v123 corre también acá, porque este cambio toca los mismos CTEs.
>
> **AL PEGAR — 1 NODO:** `Listar stock` → **query**. 35 nodos, `connections` sin tocar, los 5
> invariantes pasan.
> **MEDIR ASÍ:** `--case hatchback-que-entra-no-se-silencia --repeat 3 --delay 45000` (sobre v124:
> **0/3**) · controles: `chico-no-es-utilitario` (3/3, es el que verifica que v118 siga intacto),
> `no-ofrecer-lo-que-no-existe` (3/3), `stock-general-completo` (3/3),
> `sin-presupuesto-no-hay-piso` (3/3).

> **🛠 HERRAMENTAL DEL EVAL — dos arreglos que no tocan el workflow. Sesión 2026-08-11.**
>
> **1. GUARDIA DE DEPLOY en `evals/run.mjs`.** El 2026-08-10 entraron **tres deploys en mitad de una
> tanda** y cada vez costó lo mismo: la corrida de "antes" deja de valer y hay que reconstruirla a
> mano cruzando `updatedAt` del workflow contra los timestamps de sesión de `mensajes_demo`. Ahora
> el runner pregunta la versión **antes y después de CADA corrida**, marca las que quedaron a
> caballo, y al final —si hubo cambio— imprime el desglose **por versión** en vez de un promedio que
> mezcla dos builds.
> · **ES OPT-IN por `N8N_API_KEY`** (más `N8N_WORKFLOW_ID`, que por defecto es el de producción):
>   la API de n8n pide su propia key y el eval no la necesita para nada más. **Sin la key el guardia
>   no corre y LO AVISA en el encabezado** — no falla en silencio, que sería peor que no tenerlo.
> · Ante cualquier error de red devuelve `null`: **el guardia nunca puede tumbar una tanda.**
> · **VERIFICADO:** endpoint correcto (`/api/v1/workflows/{id}` da 401 sin key, no 404) · camino sin
>   key probado en vivo · y la lógica del veredicto, que es la parte que sólo corre el día que hace
>   falta, está **separada en una función pura y probada 12/12** en
>   `scripts/el-guardia-de-deploy-avisa.mjs` — incluido el escenario exacto de hoy (0/2 antes, 1/1
>   después, separados) y el de deploy+rollback dentro de la misma tanda.
> · **LO QUE NO PUDE PROBAR: el camino CON key**, porque esa credencial no está en el repo. La
>   primera tanda que corras con `N8N_API_KEY` puesta es la que lo estrena.
>
> **2. `images_min` DEJÓ DE SER CIEGO AL DEDUP DE FOTOS.** Era el mismo choque que ya se había
> arreglado en `media_si_lista_autos`: el check exigía imágenes en un turno donde `Armar respuesta`
> las había suprimido BIEN. **Medido:** sesión `f0c23a2f` del 2026-08-10 — el turno 1 mandó las fotos
> de los ids 17 y 9, el turno 2 preguntaba justo por el 9. Eso ponía `detalle-un-auto-fotos` en 2/3
> por conducta correcta.
> · **LA SUTILEZA QUE HACE CORRECTO AL ARREGLO: son DOS dedup distintos.** Las cards se suprimen por
>   `cards_recientes`; las fotos sólo por `ids_recientes`, y el propio nodo aclara que *"haber
>   aparecido como card NO cuenta"*. Si `images_min` usara el rastreo combinado, perdonaría un turno
>   sin fotos cuando lo único previo fue una card — **y eso sí es un bug**. Por eso hay un
>   `imagenesPorTurno` separado de `mediaPorTurno`.
> · `images_min` se usa en **un solo lugar** de los 89 casos (turno 2 de `detalle-un-auto-fotos`),
>   así que el radio del cambio es mínimo. `media_min` es de la misma familia pero **no se tocó**:
>   no tiene ningún rojo medido, y aflojar checks sin falla que lo justifique es cómo se tapan bugs.
> · La prueba de `scripts/el-check-de-media-respeta-el-dedup.mjs` pasó de 10 a **16 casos**, con la
>   distinción card-vs-foto asserteada explícitamente.

> **🟢 v124 DESPLEGADO Y MEDIDO — 12/12, TODO VERDE. EL BUG DEL PISO CERRADO Y EL 4x4 CONFIRMADO.
> Puntero: v124 vivo, encabezado regenerado y verificado. Sesión 2026-08-10/11.**
>
> **MEDICIÓN (ventana 2026-08-11 00:00:18Z):**
>
> | caso | antes | **v124** |
> |---|---|---|
> | `sin-presupuesto-no-hay-piso` | **1/3** (v123) | **3/3** |
> | `no-ofrecer-lo-que-no-existe` | 3/3 | **3/3** — el control aguantó |
> | `stock-general-completo` | 3/3 | **3/3** con los 3 checks nuevos del 4x4 |
> | `chico-no-es-utilitario` | 3/3 | **3/3** |
>
> **LAS TRES CORRIDAS DEL CASO OBJETIVO AHORA LISTAN:** *"Estas son las pickups que tenemos ahora:
> - Ford Ranger 2024 — 18.000 km — $57.000.000 (4x4) - Chevrolet S10 2022…"*. Cero recitación del
> piso, y de paso se ve el 4x4 funcionando en el mismo renglón.
>
> **LO QUE ESTO CONFIRMA, Y VALE COMO REGLA:** v120 intentó arreglar el mismo bug **agregando una
> inyección determinística que decía "PROHIBIDO"** y no alcanzó (medido: seguía saliendo en 2 de 3,
> con la inyección presente y verificada en la ejecución 15019). v124 lo cerró **sacando el dato que
> alimentaba la frase**. Contra una sección entera de prosa que empuja para el otro lado, **quitar el
> insumo gana; agregar una prohibición pierde.**
>
> **EL 4x4 QUEDÓ MEDIDO DE FORMA INDEPENDIENTE.** El check vivía en `sin-presupuesto-no-hay-piso`,
> enganchado al bug del piso (sólo listaba camionetas cuando el guion NO disparaba), así que medía
> dos cosas a la vez. Se movió a `stock-general-completo`, que lista los 17, y son tres checks
> validados en las tres direcciones: exige **4x4** (Ranger/Hilux/Amarok), exige **4x2** (S10), y
> **prohíbe que un auto que no sea camioneta lleve tracción**.

> **🟢 v123 DESPLEGADO Y MEDIDO — LA ROTURA DE v122 ESTÁ CERRADA. El 4x4 anda.
> 🔴 PERO EL BUG DEL PISO (v120) NO SE ARREGLÓ, Y AHORA SE SABE POR QUÉ. Sesión 2026-08-10.**
>
> **MEDICIÓN (ventana 23:40:07Z):** `stock-general-completo` **0/3 → 3/3** (la rotura de v122
> cerrada) · `recomendacion-por-tamano` **3/3** · `no-ofrecer-lo-que-no-existe` **3/3** ·
> `sin-presupuesto-no-hay-piso` **1/3**.
> **El 4x4 funciona cuando llega a listar:** *"- Ford Ranger 2024 — 18.000 km — $57.000.000 (4x4)"*.
>
> **🔴 EL PISO SIGUE SALIENDO EN 2 DE 3, Y LA CAUSA YA NO ES UNA HIPÓTESIS.** Ejecución **15019**
> (sesión `ecdc0e5b`, una de las que falla): `carroceria_pedida: "pickup"`, `entrega_plata: 0`.
> O sea que la condición `carr && !techo` de v120 **SE CUMPLIÓ y la rama SÍ se inyectó**: a Franco le
> llegó *"ESO NO ES UNA PREGUNTA DE PLATA, ES UNA PREGUNTA DE STOCK: llamá a la herramienta…
> PROHIBIDO decir el piso de esa carrocería"*. **La ignoró y recitó el piso igual**, y el `metadata`
> de esa ejecución **no lista ningún subrun de herramienta**: tampoco llamó a `Listar stock`.
>
> **LA LECCIÓN, Y ES LA MÁS FUERTE DE LA SESIÓN: una inyección determinística con "PROHIBIDO EN ESTE
> TURNO" NO ALCANZA CONTRA UNA SECCIÓN ENTERA DE PROSA QUE EMPUJA PARA EL OTRO LADO.** Toda la
> sección "## Antes de ofrecer una carrocería" está construida sobre la premisa de que preguntar por
> una carrocería es una pregunta de presupuesto: la línea 145 ("nunca ofrezcas una carrocería cuyo
> piso esté por encima del techo"), la 147 (la plantilla del guion) y la 149 ("si insiste, la salida
> es el número"). Un párrafo inyectado pierde contra esa gravedad.
>
> **EL FIX QUE CORRESPONDE (v124) NO ES MÁS PROMPT: ES SACARLE EL COMBUSTIBLE.** Los números que
> recita salen de la línea 143, `PISOS DE STOCK`, que **se inyecta SIEMPRE**
> (`Pickup desde $32.000.000 (anticipo mínimo $16.000.000)`). Si esa línea no aparece cuando no hay
> techo declarado, Franco no tiene de dónde sacar el número y no le queda otra que llamar a la
> herramienta. Es la misma mecánica condicional que ya funciona en la línea 62, y es determinístico.
> **CONTROL OBLIGADO: `no-ofrecer-lo-que-no-existe` NECESITA esa línea** (ahí el cliente declaró
> $5.000.000 de anticipo, y el caso está **3/3**); con la condición `entrega_plata > 0` la sigue
> teniendo.
>
> **🟡 v124 ARMADO, NO DESPLEGADO (`scripts/sin-techo-no-se-inyecta-el-piso.mjs`) — 1 nodo,
> `Franco (AI Agent)` → systemMessage (77.137 → 78.130).** La línea `PISOS DE STOCK` pasa a
> inyectarse SÓLO si el cliente declaró algo: anticipo (en el mensaje, en la respuesta o en el
> historial), monto a financiar, o un presupuesto en el lead. **`pisos_carroceria` tiene UN solo
> punto de inyección, así que el corte es limpio.**
> **LA CONDICIÓN SE VERIFICÓ CONTRA DATOS REALES DE LOS DOS CASOS, no en abstracto:**
> · el caso del bug (`ecdc0e5b`, todo en cero) → **OCULTA**;
> · el control `no-ofrecer-lo-que-no-existe` → corriendo el parser REAL de `Config` sobre su
>   `msg_financiar_hist` (*"Quiero financiar 30.000.000"*) da `monto_financiar_hist = 30.000.000`
>   → **MUESTRA**. El control conserva la línea que necesita.
> Más 9/9 en la tabla de decisión (anticipo en cada una de sus tres fuentes, financiar en sus dos,
> presupuesto del lead, y los vacíos).
> **Línea de base ya medida sobre v123: `sin-presupuesto-no-hay-piso` 1/3.**
>
> **🟡 DEUDA DE CHECK DETECTADA: el check `\b4x4\b` está ENGANCHADO al bug del piso.** Vive en el
> turno 2 de `sin-presupuesto-no-hay-piso`, que sólo lista camionetas cuando el guion del piso NO
> dispara — así que hoy mide las dos cosas a la vez y no puede dar verde hasta que v124 cierre.
> **Hay que moverlo/duplicarlo a `stock-general-completo`,** que lista los 17 y siempre incluye las
> cuatro pickups.

> **🔴 v122 SE DESPLEGÓ ROTO Y ES DEFECTO MÍO. NO USAR v122. El fix es `v123`, ya verificado
> contra la base. Sesión 2026-08-10.**
>
> **SÍNTOMA (visto por Agustina en producción):** el listado de stock salió con **5 autos en vez de
> 17** y con **todos los kilómetros inventados** (Duster 98.000 cuando son 31.000; Ranger 70.000
> cuando son 18.000; Gol Trend 30.000 cuando son 110.000). **Los precios y las cards estaban BIEN, y
> esa combinación es la firma del diagnóstico:** las cards las arma `Hidratar autos`, que lee la base
> por otro lado. Si las cards están bien y el TEXTO está mal, el texto no salió de la herramienta.
> Confirmado en paralelo por el eval: `stock-general-completo` **3/3 → 0/3**
> (`cards_min: 8 cards, mínimo 10`) y `sin-presupuesto-no-hay-piso` **0/3**.
>
> **LA CAUSA:** v122 agregó `traccion` al SELECT del CTE `base` y al SELECT final, pero el CTE
> intermedio `con_categoria` —que v118 creó con **lista explícita de columnas**— no la incluía.
> `base` la produce · `marcado` la conserva (`SELECT b.*`) · **`con_categoria` la tira** · el SELECT
> final la pide. Postgres devuelve `ERROR 42703: column "traccion" does not exist`, reproducido con
> una query mínima de la misma forma.
> **EL ERROR NO APARECE COMO EJECUCIÓN FALLIDA EN n8n:** el agente se come el error de la tool y
> sigue, así que `search_executions` con status error da **vacío**. Por eso el síntoma es "inventa" y
> no "se rompió" — y por eso hay que mirar el CONTENIDO, no sólo el estado de la ejecución.
>
> **POR QUÉ NO LO CACÉ, Y ES LA LECCIÓN:** en v118 rendericé la query completa y la corrí contra la
> base. En v122 probé **sólo la expresión `CASE` por separado** y me apoyé en asserts de reemplazo de
> strings. El assert `q.split('tamano, traccion,').length === 2` pasó —el string estaba— pero nadie
> verificó que la columna RESOLVIERA. **Un assert que mira el texto y no el significado no es un
> assert.** Es la misma familia que "un check que no distingue el caso malo no es un check", ahora
> del lado del SQL.
>
> **v123 (`scripts/traccion-tiene-que-sobrevivir-el-cte.mjs`) — 1 nodo, `Listar stock`, 10 chars de
> diferencia.** Trae el assert que faltaba: **verifica que toda columna que el SELECT final le pide
> a `u` exista en la lista explícita de `con_categoria`**. Corrido contra v122 devuelve
> `["traccion"]`, o sea que lo habría cazado.
> **Y ESTA VEZ SÍ SE CORRIÓ LA QUERY RENDEREADA CONTRA LA BASE, que es el paso que me salteé:**
> 17 filas, 4 con tracción, y las camionetas con sus km reales —
> `Ranger (4x4) 18000km · S10 (4x2) 68000km · Hilux (4x4) 95000km · Amarok (4x4) 135000km`.
>
> **LA TANDA DE v122 (ventana 20:19:21Z) NO VALE COMO MEDICIÓN DE NADA:** midió un build roto. Hay
> que re-medir sobre v123. `no-ofrecer-lo-que-no-existe` dio 3/3 incluso ahí, porque su rama no
> depende de que `Listar stock` devuelva filas.

> **🟢 v120 + v121 DESPLEGADOS JUNTOS (se pegó v121, que contiene los dos) Y MEDIDOS.
> Puntero: v121 vivo, encabezado regenerado y verificado. Sesión 2026-08-10.**
>
> **v120 — SIN TECHO DECLARADO NO HAY NADA QUE "NO ENTRE"**
> (`scripts/sin-techo-no-hay-nada-que-no-entre.mjs`). Bug de Agustina: pregunta "y que pickups
> tenes?" **sin haber dado nunca un presupuesto** y Franco recita el guion del piso
> (*"la más accesible es de $32.000.000, necesitarías $16.000.000 de anticipo"*) más *"con tu
> presupuesto, con tu anticipo…"* — los dos "tu" inventados. Y no le muestra ninguna de las cuatro.
> **PRUEBA, EJECUCIÓN 14830, LA MÁS LIMPIA QUE DIO EL PROYECTO PARA LA TRAMPA 6: el `metadata` de
> esa ejecución NO LISTA NI UN SUBRUN DE HERRAMIENTA.** Contestó una pregunta de stock sin consultar
> el stock, con `auto_ids: []`. Recitó la línea 147 del prompt, carácter por carácter.
> **LO DETERMINÍSTICO FUNCIONÓ BIEN:** la guarda de la línea 138 (`!techo → ''`) hizo lo correcto.
> Lo que no tenía guarda era el EJEMPLO EN PROSA, porque es prosa. **Por eso el fix no agrega más
> prosa: extiende el bloque inyectado con la rama que faltaba** (`carr && !techo` → "es una pregunta
> de stock, llamá a la herramienta"), y **le saca al guion los números recitables**, que además eran
> los de Automotores Tucumán —una segunda fuente de verdad duplicando `Config.pisos_carroceria`, y
> un problema de configurabilidad en otra concesionaria.
>
> **v121 — LAS FOTOS NO EXIGEN IR AL LOCAL** (`scripts/las-fotos-no-exigen-ir-al-local.mjs`).
> Bug de Agustina: pide fotos del interior y Franco dice que se las muestra un asesor *"cuando
> vengas a verlo en persona"*. **CAUSA: no había NINGÚN guion sobre fotos en las 333 líneas**, y sí
> cinco instancias de *"un asesor lo ve en persona"* — todas legítimas y todas sobre la TASACIÓN DEL
> USADO. Trampa 6 en su forma inversa: el vacío se llena con el ejemplo vecino, así que el fix es
> PONER el guion que falta. **Redacción definida por Agustina, usada textual**, con `<AUTO>` como
> marcador en vez del modelo (hardcodear un auto es lo que hizo recitable el guion del piso).
> **Cierra también el BUG 3 que estaba pendiente**: no hay metadato de interior/exterior, así que el
> guion dice explícitamente que Franco no sabe qué muestra cada foto.
>
> **MEDICIÓN LIMPIA (ventana 20:03:49Z, todo post-deploy):**
>
> | caso | antes | **v121** |
> |---|---|---|
> | `fotos-del-interior-no-exigen-visita` | (sin base en vivo) | **3/3** |
> | `no-ofrecer-lo-que-no-existe` | 1/3 | **3/3** |
> | `sin-presupuesto-no-hay-piso` | **0/2 en v119** | **2/3** |
> | `detalle-un-auto-fotos` | 3/3 | 2/3 |
>
> **EL "ANTES" DE `sin-presupuesto-no-hay-piso` ES REAL Y SALIÓ DE UN CRUCE ACCIDENTAL:** el deploy
> de v121 (19:59:42Z) entró en medio de la tanda de base (19:57:37Z), y el corte quedó limpio —
> ninguna sesión a caballo, verificado por timestamp. Las repeticiones 1 y 2 corrieron sobre v119 y
> **fallaron las dos con 4 checks**; la 3 corrió sobre v121 y pasó, contestando *"Las pickups que
> tenemos son: - Ford Ranger 2024 — 18.000 km — $57.000.000 - Chevrolet S10 2022…"*.
>
> **🟡 v120 MEJORÓ MUCHO PERO NO CERRÓ: queda 1 de 3 recitando el piso.** Los números ya no están en
> el guion, pero **siguen en `PISOS DE STOCK`**, que se inyecta siempre, así que el modelo puede
> recomponer la frase desde ahí usando la plantilla con marcadores. El check de `tu presupuesto/tu
> anticipo` sí pasó en esa corrida (3 rojos en vez de 4). **No dar el caso por cerrado.**
>
> **`detalle-un-auto-fotos` 2/3 NO ES ATRIBUIBLE A v121, y se puede decir por mecanismo:** en la
> sesión que falló (`f0c23a2f`) el turno 1 mandó fotos de los autos **17 y 9** en vez de cards
> (Franco listó sólo 2 autos y `Armar respuesta` tomó el camino de imágenes), y el turno 2 preguntaba
> justo por el **9**, cuyas fotos ya habían salido → el dedup las suprimió bien.
> **ES EL MISMO CHOQUE QUE SE ARREGLÓ EN `media_si_lista_autos`, AHORA EN `images_min`: el check es
> ciego al dedup de imágenes.** v121 toca Paso 3 y es sobre QUÉ DECIR de las fotos, no sobre si se
> emiten. **Pendiente: darle a `images_min` el mismo tratamiento.**
>
> **🟡 v122 ARMADO, NO DESPLEGADO — LAS CAMIONETAS DICEN 4x4 O 4x2**
> (`scripts/las-camionetas-dicen-4x4-o-4x2.mjs`). Pedido de Agustina, no es un bug. `Listar stock`
> expone `traccion` **sólo para Pickup** (`CASE WHEN carroceria = 'Pickup'`), verificado contra la
> base: 4 filas con dato (Hilux/Ranger/Amarok **4x4**, S10 **4x2**), 13 en NULL, cero fugas. El
> prompt declara el campo y suma el sufijo al renglón, **con la forma `(4x4)` y sin un renglón
> completo con precios reales** — lección de v120. 2 nodos, los 5 invariantes pasan.
> **El check ya está puesto y verificado: `\b4x4\b` en el turno 2 de `sin-presupuesto-no-hay-piso`,
> ROJO sobre la salida actual de v121 y VERDE con la tracción.**

> **🟢 v119 DESPLEGADO Y MEDIDO — LA FIRMA DEL DETECTOR DE v103 NO ERA ÚNICA. CERRADO.
> `la-ficha-que-no-se-dio-no-esta-dada` 3/3 · `no-repite-la-ficha` 3/3 (el control que importa).**
>
> **MEDICIÓN (v119 desplegado 19:40:47Z).** Los tres turnos contestan bien; el turno 3 dice
> *"El Toyota Corolla 2022 es la versión XEI 2.0 Dynamic Force."* — una línea, sin repetir la ficha
> y sin derivar al asesor. Controles: **`no-repite-la-ficha` 3/3** (la supresión legítima sigue
> viva), **`detalle-un-auto-fotos` 3/3**, `charla-real-reapertura-con-usado` 1/3.
>
> **EL 1/3 DE `charla-real` NO ES ATRIBUIBLE A v119, Y NO ES SÓLO ESTADÍSTICA:** se midió que en
> TODAS las burbujas donde aparece el consumo `7.2`, el string "Corolla" está **en la misma
> burbuja** (1 de 1, en las dos sesiones donde aparece). La condición nueva exige justamente eso,
> así que no cambia el resultado en ese caso. Además STATE ya registraba ese check disparando sobre
> v117 post-migración, con el caso en 2/3.
>
> **🟡 DEUDA DE MÉTODO, EXPLÍCITA: v119 NO TUVO LÍNEA DE BASE EN VIVO.** El deploy entró
> (19:40:47Z) mientras la tanda de base corría (arrancó 19:38:02Z), y **las tres repeticiones del
> caso nuevo cayeron post-deploy** — verificado por timestamp de sesión, no estimado. Se reconstruyó
> con datos: evaluando las dos condiciones sobre las burbujas del turno 1 **de las tres sesiones que
> generó el propio eval**, v118 habría suprimido en 3 de 3 y v119 en 0 de 3. **Es una reconstrucción,
> no una corrida en vivo.** Sumada a la ejecución 14788 y al diferencial sobre la charla real de
> Agustina, el mecanismo queda probado en tres lugares independientes — pero el "antes" del eval se
> perdió. **Lección operativa: no lanzar tandas largas sin avisar que hay una corriendo.**
>
> **(el diagnóstico original, que sigue siendo la referencia del bug)**
>
> **SÍNTOMA (charla real, sesión de las 19:25–19:30Z):** pide la ficha del Onix y de la T-Cross y las
> recibe completas; después pide *"perfecto y el corolla?"* y le llega **una sola línea**: *"El Toyota
> Corolla 2022 tiene 35.000 km y cuesta $24.800.000."* Cuando insiste (*"es el full?"*, *"que versión
> tiene el auto?"*) Franco deriva al asesor y dice **"Ya viste la info que te pasé antes"**, que es
> FALSO: nunca le dio la ficha del Corolla.
>
> **NO ES DEL PROMPT NI ES UNA ALUCINACIÓN. LO DICE EL LOG, ejecución `14788`,** salida cruda de
> `Detalle auto` con `auto_id: 5`:
> · `descripcion: ""`
> · `ficha_completa: "YA LE DISTE LA FICHA COMPLETA DE ESTE AUTO EN ESTA MISMA CONVERSACIÓN…"`
> **El código le pasó una premisa falsa y Franco la obedeció.** Es la trampa 7 en estado puro.
>
> **LA CAUSA: `metadata.consumo` se usa como firma de "la ficha ya se dio" (v103) y NO ES ÚNICA.**
> `Detalle auto` busca el consumo EXACTO de ese auto en las últimas 12 burbujas de Franco. El Corolla
> y la T-Cross comparten **`7.2 L/100km`**: como la ficha de la T-Cross acababa de imprimir ese
> string, el detector del Corolla lo encontró y concluyó que su ficha ya se había dado.
>
> **TRES GRUPOS EN COLISIÓN HOY — 7 de los 17 autos expuestos:**
> | `consumo` | autos |
> |---|---|
> | `7.8 L/100km` | Gol Trend · EcoSport · Duster |
> | `7.2 L/100km` | **Corolla · T-Cross** (el caso reportado) |
> | `9.5 L/100km` | Renegade · Ranger |
>
> **LO INTRODUJO LA MIGRACIÓN DE LA FICHA V2** (16 consumos reescritos). La nota de STATE decía que
> la firma "tiene que seguir siendo UN solo `X.Y L/100km`" — se cuidó el FORMATO y **nunca se
> verificó la UNICIDAD entre autos**. Lección: *una firma que no es única no es una firma.*
>
> **SEGUNDA CAPA, Y ES LA QUE CONTESTA "SI EL DATO EXISTE, POR QUÉ NO LO DIJO":
> `Detalle auto` NO devuelve `version` como campo.** El dato está
> (`metadata.version = "XEI 2.0 Dynamic Force"`), pero sólo le llega a Franco EMBEBIDO dentro de
> `content` → `ficha_completa`. Cualquier supresión de ese campo se lleva la versión puesta —
> incluso una supresión LEGÍTIMA: si el cliente ya recibió la ficha y después pregunta "qué versión
> es?", Franco tampoco puede contestar, porque el nodo blanquea todo.
>
> **FIX PROPUESTO, NO APLICADO (sería v119, y el caso de eval va primero):**
> 1. **Firma discriminante:** exigir que la burbuja contenga el consumo **Y** el modelo del auto. No
>    necesita tocar datos. (`motor` NO sirve como alternativa: Onix y T-Cross son los dos
>    "1.0 Turbo de 116 CV".)
> 2. **`version` como campo propio** de `Detalle auto`, fuera de `ficha_completa`, para que sobreviva
>    a la supresión y se pueda contestar "qué versión es" sin repetir la ficha entera.
>
> **DIVULGACIÓN:** mi tanda de evals arrancó 19:29:36Z y se solapó con los dos últimos turnos de esa
> charla. **No causó este bug** — el turno del Corolla fue 19:29:21Z, quince segundos ANTES de que mi
> corrida empezara, y la causa está en el log.

> **🟢 v118 DESPLEGADO Y MEDIDO — EL BUG 1 CERRADO: 3 DE 3 CONTESTAN BIEN EL TURNO 2.
> Puntero: v118 vivo (encabezado regenerado y verificado). Sesión 2026-08-10.**
>
> **MEDICIÓN, ventana 19:06:42–19:20Z. Humo 9,4 s. `search_executions` status error sobre la
> ventana exacta: CERO.**
>
> **🔴 EL TITULAR DEL CASO ENGAÑA Y HAY QUE LEER LOS CHECKS: `chico-no-es-utilitario` da 1/3 igual
> que la base, pero los checks que fallan cambiaron por completo.** Turno 2:
>
> | check | v117 (base) | **v118** |
> |---|---|---|
> | `text_matches etios` | **rojo 2 de 3** | **verde 3 de 3** |
> | `text_not_matches kangoo` | **rojo** | **verde 3 de 3** |
> | `first_car_in [Etios,208,Onix]` | **rojo** (Kangoo primero) | **verde 3 de 3** |
> | no afirma que el Etios se pasa | **rojo** | **verde 3 de 3** |
> | no filtra `otro_tamano` | verde | verde 3 de 3 |
> | `media_si_lista_autos` | rojo 1 de 3 | rojo 2 de 3 |
>
> **Las 3 corridas encabezan con el Etios como el que entra, Onix/208 como estirón por encima, y
> cero Kangoo** — textualmente la respuesta que el caso define como correcta. El bug medido murió.
>
> **CONTROLES:** `recomendacion-por-tamano` **3/3** (el que más importa: mide el mismo criterio desde
> el otro lado, sin regresión) · `stock-general-completo` **3/3** · `capacidad-de-compra-financiada`
> **3/3** · `no-ofrecer-lo-que-no-existe` **1/3**. Total de la tanda de controles: **10/12**.
>
> **NINGUNA BAJA ES ATRIBUIBLE A v118, Y SE PUEDE DECIR POR CHECK Y POR CONSTRUCCIÓN.** Los dos rojos
> de `no-ofrecer` son los dos modos ya documentados: **dos burbujas de fallback del parser** (turno 1)
> y **la frase del piso de v97** (turno 3, los checks de "16.000.000" y "50%"), que oscila
> 3/6 → 2/3 → 1/3 → 2/3 → 1/3 desde hace cuatro versiones. **Y hay un argumento estructural, no sólo
> estadístico: el detector de tamaño no dispara en NINGÚN turno de ese caso** (dispara en 2 de los 213
> de la suite, los dos de `chico-no-es-utilitario`), y con `tamano_pedido` vacío el `CASE` devuelve la
> etiqueta de v117 sin tocarla. **v118 es, demostrablemente, un no-op ahí.**
>
> **🟡 EL ROJO QUE QUEDA NO ES DE v118: ES UN CHOQUE ENTRE DOS REGLAS, LAS DOS DELIBERADAS.**
> `media_si_lista_autos` exige media cuando se nombran 3+ autos. El dedup de `Armar respuesta`
> (líneas 43-44) prohíbe reenviar cards ya vistas — **y el comentario dice "Pedido de Agustina: no
> repetir el mismo mazo cuando el cliente sigue hablando de esos autos"**. Leído del log, sin teoría:
> · corridas 1 y 2 → `auto_ids: [4,7,8]`, `cards_recientes: "4,7,8"` → las 3 ya se habían mandado en
>   el turno 1 → dedup → 0 cards y 0 imágenes → **rojo**;
> · corrida 3 → `auto_ids: [4]` (sólo el Etios) → camino de imágenes, `ids_recientes` vacío →
>   3 fotos → **verde**.
> **v118 no rompió el dedup: cambió la forma de la conversación** (el turno 2 ahora nombra justo los
> 3 chicos que el turno 1 mostró), así que el solapamiento pasó a ser total y el choque dispara más
> seguido: 1/3 → 2/3, con n=3.
> **✅ RESUELTO — DECISIÓN DE AGUSTINA (2026-08-10): el check aprende del dedup.
> `chico-no-es-utilitario` PASÓ A 3/3 ESTABLE** (ventana 19:29:36Z). Recorrido completo del caso:
> v117 **1/3** → v118 con el check viejo **1/3** (el bug ya muerto, el rojo era el choque) →
> v118 con el check arreglado **3/3**.
>
> **EL ARREGLO, EN `evals/run.mjs`:** `media_si_lista_autos` ahora sólo cuenta los autos que el
> cliente **todavía no vio**. Tres piezas: un bloque espejo del dedup, `registrarMedia(res)` llamado
> **después** de los checks del turno (si no, la media del propio turno se autoacredita y el check no
> mide nada), y el filtro en el check. El umbral sigue en 3.
> · **LA VENTANA NO SE ESTIMÓ: sale del nodo.** `Autos ya mostrados` hace `LIMIT 8` sobre
>   `mensajes_demo` y cada turno escribe DOS filas (usuario + Franco) → **son los últimos 4 turnos**,
>   y quedó como constante con su porqué.
> · **LAS FOTOS SÓLO TRAEN EL ID** (`foto-4-1.webp`), no el modelo. Se resuelve con un mapa id→modelo
>   que arman las cards de la propia sesión. Un auto que llegó SÓLO como foto y nunca como card
>   queda sin acreditar y el check sigue exigiendo media: **el sesgo es a falso ROJO, nunca a falso
>   verde.** Se prefirió eso antes que hardcodear una tabla id→modelo, que es la clase de mapa que
>   ya mordió con `PRECIOS`.
>
> **POR QUÉ NO HIZO FALTA RE-CORRER TODA LA SUITE:** el check nuevo **sólo puede aflojar**
> (`nuevos ⊆ nombrados`, así que `nombrados < 3` implica `nuevos < 3`). No puede volver rojo nada que
> estuviera verde, y el único caso con rojos de media era el objetivo.
>
> **LA PRUEBA DEL CHECK NO PRUEBA UNA COPIA:** `scripts/el-check-de-media-respeta-el-dedup.mjs`
> **extrae el check real de `run.mjs`** y lo ejecuta, así que si alguien lo edita la prueba corre
> sobre el texto editado. **10/10**, con el bug original todavía rojo en cuatro formas —incluida
> "3 autos nuevos después de haber mostrado otros 3"—, la ventana de 4 turnos, y el caso de que la
> media del turno actual no se autoacredite.
>
> **(entrada previa) 🟡 v118 ARMADO Y VERIFICADO CONTRA LA BASE, NO DESPLEGADO
> (`scripts/el-chico-que-entra-no-se-silencia.mjs`).**
>
> **❌ EL DIAGNÓSTICO DEL TURNO 2 QUE QUEDÓ ESCRITO ABAJO ES INCOMPLETO — NO LO LEAS COMO VERDAD.**
> La entrada de v117 y la de la migración dicen que el problema es "el gate de tamaño en SQL". Lo es
> para el turno 1. Para el turno 2 **no**, y ahora hay log.
>
> **LA PREGUNTA QUE HABÍA QUE CONTESTAR PRIMERO ERA "¿`Listar stock` le devolvió el Etios?".
> LA RESPUESTA ES SÍ.** Ejecución **14658** — la MISMA en la que `Franco (AI Agent)` escribió el
> texto del Kangoo, así que tampoco es la trampa 7. Entrada: `precio_objetivo=20000000`,
> `anio_min=2021`. Salida: 13 filas, con
> `Toyota Etios 2021 · $14.500.000 · tamano=chico · categoria='economica'`.
> **No faltaba el dato, no faltaba el filtro y el tamaño no fue el discriminador: fue el precio.**
>
> **LO QUE LO EXCLUYÓ.** Con capital 20M el `CASE` manda al Etios a `economica`
> (precio < capital × 0,90 = 18M) y la **línea 125 del prompt** dice, textual: *"Las economica NO se
> ofrecen"*. Silenciado el Etios, el único `entra` que quedaba era el Kangoo ($18,5M, mediano), y la
> **línea 122** ("recomendás 2 a 5 de los `entra`") le ganó a la **155** ("un mediano NO es una
> respuesta a algo chico"), porque para cuando la 155 podía aplicar el Etios ya no estaba en el
> conjunto de candidatos. **Franco obedeció el prompt.** El *"el Etios queda por encima de los 20
> millones"* es la verbalización de un auto que tenía prohibido ofrecer — y es falso.
>
> **MEDIDO EN LOS 3 REPEATS: 2 de 3 silencian el Etios** (`7501adc4` lo omite entero, `8d8fed95` es
> el bug); la única correcta es `89f55764`. El defecto es de ~2/3, no de 3/3.
>
> **🔴 POR QUÉ EL GATE DE TAMAÑO SOLO HABRÍA DADO VERDE CON EL BUG VIVO.** Sacar al Kangoo del SQL
> deja al Etios igual de silenciado: la respuesta pasa a *"los chicos se te pasan un poco"* con un
> chico de $14,5M en el payload. **El check del turno 2 sólo prohibía "kangoo"**, así que la corrida
> que omite el Etios en silencio pasaba limpia. Es la lección de la sesión anterior otra vez: **un
> check que no distingue el caso malo no es un check.**
>
> **EL CASO SE AFILÓ ANTES DEL FIX Y LA LÍNEA DE BASE ES 1/3** (v117 vivo, con los checks nuevos):
> `text_matches etios` **rojo**, más `text_not_matches kangoo` y `media_si_lista_autos`. Checks
> agregados al turno 2: exigir el Etios por nombre, `first_car_in [Etios,208,Onix]`, que no afirme
> que el Etios se pasa del presupuesto, y que no filtre la etiqueta interna nueva.
>
> **EL CAMBIO — 3 NODOS.** `Config` (+1 asignación: `tamano_pedido`, detector determinístico hermano
> de `carroceria_pedida`, **no** un `$fromAI` nuevo), `Listar stock` (10.936 → 12.695) y
> `Franco (AI Agent)` → systemMessage (73.256 → 74.121). `connections` sin tocar, 35 nodos,
> **los 5 invariantes pasan**, el systemMessage sigue arrancando con `=`.
>
> **NO FILTRA NINGUNA FILA: REETIQUETA.** El que no cumple el criterio pasa a `otro_tamano`; el más
> caro que SÍ cumple y entra al bolsillo se promueve de `economica` a `entra`. **La trampa 4 queda
> esquivada por construcción, no por cuidado**, y hay un assert que lo exige.
> **SE PROMUEVE UNO SOLO, A PROPÓSITO:** promover todos los `economica` que cumplen despertaría el
> Gol Trend ($9,2M) y el Fiesta ($8,2M) para un cliente de 20M — literalmente el caso que la línea
> 125 existe para evitar. La protección de gama se conserva entera.
>
> **VERIFICACIÓN CONTRA LA BASE, NO SIMULADA.** Se rendereó la query real de v118 y se corrió en
> Supabase:
> · **sin criterio → 13 filas y las 13 etiquetas IDÉNTICAS a la salida real de la ejecución 14658.**
>   El control de no-regresión usa el payload de producción como oráculo, no una re-derivación.
> · con criterio `chico` → **Etios `entra`**, Onix/208 `estirar`, **Kangoo `otro_tamano`**,
>   Corolla/Duster/Cronos `otro_tamano`, los 6 `fuera` intactos, **13 filas**.
> · barrido previo de 12 capitales × 4 criterios × 2 filtros de año (816 combinaciones): sin criterio
>   la etiqueta nunca difiere de v117, `fuera` nunca se altera ni se inventa, y nunca se promueve
>   más de uno.
>
> **EL RADIO DEL CAMBIO ESTÁ MEDIDO: el detector despierta en 2 de los 213 turnos de la suite**, y
> los dos son de `chico-no-es-utilitario`. En los otros 211 v118 es un no-op **por construcción**
> (con `tamano_pedido` vacío el `CASE` devuelve la etiqueta de v117 sin tocarla). Hay un assert que
> falla si el detector empieza a dispararse en otro caso.
>
> **LIMITACIONES QUE NO HAY QUE DESCUBRIR DE NUEVO:**
> · **Sin memoria entre turnos.** El detector lee sólo el mensaje actual. Si el cliente dice "algo
>   chico" en el turno 1 y "y con 20 palos?" en el turno 2, el criterio se pierde y v118 se comporta
>   como v117 (degradación limpia, nunca peor). El patrón para arreglarlo existe: un
>   `tamano_pedido_hist` en `Leer lead (estado)`, como los otros 7 derivados de `mensajes_demo`.
> · **`recomendacion-por-tamano` NO se beneficia:** pide *"mantener el tamaño de mi Mobi"*, sin la
>   palabra. No dispara, y está 3/3 — el assert de identidad garantiza que queda igual.
> · **Falso positivo conocido del detector:** *"tengo un chico de 5 años"* → `chico`. Dispara en 0 de
>   213 turnos y su daño está acotado a reetiquetar un turno. Se dejó documentado en vez de
>   sobre-ingenierarlo.
>
> **MEDIR ASÍ:** humo · `--case chico-no-es-utilitario --repeat 3 --delay 45000` (sobre v117: **1/3**,
> con `text_matches etios` rojo) · controles obligados: `recomendacion-por-tamano` (**3/3**, mide el
> mismo criterio desde el otro lado), `stock-general-completo` (**3/3**),
> `no-ofrecer-lo-que-no-existe` (oscila, hoy 1/3), `capacidad-de-compra-financiada`.
>
> **HALLAZGO APARTE, NO ES DE v118 Y NO SE TOCÓ: Franco le filtra el vocabulario interno al cliente.**
> En la corrida *correcta* (`89f55764`) escribió *«el Toyota Etios 2021 … pero es categoría
> "económica"»*. Es una fuga vieja, ajena a este cambio; por eso el check nuevo se limitó a la
> etiqueta que v118 introduce. **Merece su propio caso.**
>
> **VERIFICADO DE PASO, SIN ACCIÓN: la cadena principal NO tiene exposición a la trampa 4.** Los 4
> nodos Postgres sin `alwaysOutputData` están cubiertos: `Contar mensajes previos` y
> `Leer conversación (CRM)` son agregados sin `GROUP BY` (1 fila siempre, aunque sea NULL),
> `Leer lead (estado)` ya usa el patrón `LEFT JOIN`, y `Guardar mensajes (historial)` es el último
> nodo — `Responder a Render` ya disparó. **No hace falta tocar nada ahí.**
>
> ---

> **🟢 STOCK MIGRADO A LA FICHA TÉCNICA V2 DEL DEPÓSITO — ETAPA 1 EJECUTADA Y VERIFICADA (17/17).
> 🟢 v117 DESPLEGADO Y MEDIDO: el turno 1 del tamaño cerrado, el turno 2 abierto.
> Sesión 2026-08-10.**
>
> **RESPALDO ANTES DE TOCAR NADA: tabla `autos_disponibles_backup_20260810`, 17 filas.** Permite
> revertir con un `UPDATE ... FROM` sin depender de ningún volcado.
>
> **DÓNDE SE INTEGRÓ Y POR QUÉ AHÍ.** En `autos_disponibles` (metadata + content), **no** como
> documento-herramienta: un doc aparte sería una SEGUNDA fuente de verdad, que es el bug que este
> proyecto ya pagó dos veces hoy (el prompt contra el dato en la línea 154; el CRM contra la
> conversación en v115). Además todo el pipeline —`Listar stock`, `Buscar auto`, `Detalle auto`,
> `catalogo_precios`, los pisos, los correctores de precio y año— lee de esa tabla, y un tool nuevo
> costaría tokens contra un TPM de 30.000 (trampa 5).
> **VÍA LIBRE VERIFICADA: no hay búsqueda semántica.** No existe nodo vectorStore; `match_disponibles`
> es un valor de `Config` que nadie consume y la columna `embedding` está muerta. Reescribir `content`
> no degrada ninguna búsqueda.
>
> **LO QUE CAMBIÓ:** año (Etios 2019→2021), combustible (Kangoo Nafta→Diesel), **7 transmisiones** a
> Automática (Cronos, Onix, 208, EcoSport, Duster, Amarok, S10), **16 consumos**, y los 17 suman
> `version`, `motor`, `traccion`, `consumo_urbano/ruta/mixto` + equipamiento **distintivo** en
> `content` — esto último **cierra el pendiente 6** ("aire acondicionado en 17 de 17").
> **SIN TOCAR:** km (los 17 ya coincidían), color, carrocería, tamaño, fotos, y `descripcion` /
> `condicionantes` (eso es la ETAPA 2).
>
> **EL PRECIO DEL ETIOS: $12.500.000 → $14.500.000.** El documento NO trae precios: sale de la
> estructura del propio stock (interpolando desde el Gol Trend 2018 hacia el Cronos 2023 da $13,76M;
> hacia el Onix 2024 da $15,35M; punto medio $14,5M). **Propiedad que lo hace seguro y está
> asserteada: no cambia el ORDEN de ningún auto** —sigue entre Gol Trend y Cronos— y **siguen siendo
> 2 los autos que entran con techo de $10M**, que es de lo que depende `no-ofrecer-lo-que-no-existe`.
>
> **🔴 EL ACOPLAMIENTO QUE CASI PONE ROJA LA SUITE ENTERA, Y LO FRENÓ UN ASSERT:** `evals/run.mjs`
> tiene el mapa `PRECIOS` **hardcodeado**, y `no_inventa_autos` corre en TODOS los turnos de TODOS
> los casos. Con la base en $14,5M y el mapa en $12,5M, Franco diría el precio CORRECTO y el eval lo
> marcaría como **inventado**, en toda la suite. El script se negó a generar el SQL hasta sincronizar
> el mapa. Queda un assert permanente que lo verifica.
>
> **🔴 UN DEFECTO PROPIO, ENCONTRADO Y ARREGLADO EN LA MISMA CORRIDA — Y LA LECCIÓN ES LA MISMA DE
> HOY.** El primer UPDATE dejó basura: *"Consumo promedio aproximado: **7.0.3**."*. Causa: **en
> Postgres la avidez de TODA la expresión la fija el PRIMER cuantificador**; como el patrón arranca
> con `.*?`, el `[0-9.,]+` del final también se volvió no ávido y consumió sólo `6.` de `6.3.`.
> **Y mi propia verificación no lo cazó**, porque usaba `LIKE '%: 7.0.%'` y `"7.0.3."` contiene
> `"7.0."`. Es EXACTAMENTE el error de v113 (assertear `autos.length` en vez de `product_cards`) en
> otra forma: **un check que no distingue el caso malo no es un check.** Arreglado anclando el patrón
> a `' Condición:'`, y la verificación pasó a regex anclado + un check explícito de basura numérica.
>
> **VERIFICACIÓN FINAL: 17/17 en las diez condiciones** — `Condición:` intacta, URLs intactas, precio
> alineado entre metadata y content, versión presente, consumo EXACTO, transmisión matcheando el
> `ILIKE` real de `Buscar auto`, los 3 autos 4x4 conservando su token, cero duplicados, cero basura.
> **EL 4x4 NO ERA TEÓRICO:** `Buscar auto` matchea tracción con `content ILIKE '%4x4%'` y el
> equipamiento del documento para la Amarok dice sólo *"4Motion"*. Copiarlo literal la sacaba de las
> búsquedas de 4x4; se le agregó el token a propósito y hay un assert que lo exige.
> **Y una contradicción que generaba el propio documento:** el Kangoo decía *"2 asientos"* en el
> encabezado y *"5 pasajeros"* en el equipamiento nuevo. Corregido a 5 asientos (dato duro).
>
> **EVALS ACTUALIZADOS EN EL MISMO MOVIMIENTO, porque si no dejan de medir:**
> · `charla-real` turno 11 buscaba `"1.8L"`, `"140 HP"`, `"6.5 L/100km"` — con el documento el Corolla
>   pasa a 2.0/170 CV y el Cronos a 6,7, así que esos strings **ya no existen y el check habría
>   quedado siempre verde sin medir nada**. Ahora busca los valores nuevos.
> · `chico-no-es-utilitario`: su nota decía que ningún chico mayor a 2020 entra en 20M. Con el Etios
>   2021 a $14,5M **ahora sí existe uno**, y ésa pasa a ser la respuesta correcta del turno 2.
>
> **MEDICIÓN DE v117 (ventana 16:06:20–16:22:02), antes de la migración:**
>
> | caso | antes | **v117** |
> |---|---|---|
> | `chico-no-es-utilitario` | 0/3 | **1/3** — el turno 1 (que nombre el Onix) **cerrado** |
> | su turno 2 (Kangoo) | rojo 3 de 3 | rojo 2 de 3 |
> | `stock-general-completo` | 3/3 | **3/3** |
> | `no-ofrecer-lo-que-no-existe` | 1/3 | **2/3** |
> | `capacidad-de-compra-financiada` | 3/5 | 2/3 |
> | `recomendacion-por-tamano` | (sin base propia) | 2/3 |
>
> **`recomendacion-por-tamano` NO TIENE LÍNEA DE BASE DE ESTA SESIÓN y no se puede decir si bajó.**
> Su rojo fue *"no matcheó etios|208"* en el turno 1. **HIPÓTESIS SIN VERIFICAR:** con el Onix ahora
> `chico`, Franco puede estar encabezando con Onix y salteando Etios/208 — el caso exige uno de esos
> dos por nombre. Si es eso, el Etios 2021 a $14,5M debería mejorarlo. **Leer el log antes de tocar.**
>
> **🔴 MEDICIÓN DE LA MIGRACIÓN — ventana 16:33:44–16:44:40. `chico-no-es-utilitario` 1/3 → 0/3.**
>
> | caso | pre | post |
> |---|---|---|
> | `recomendacion-por-tamano` | 2/3 | **3/3** — respalda (no prueba) que el Onix desplazaba al Etios/208 |
> | `stock-general-completo` | 3/3 | **3/3** |
> | `charla-real-reapertura-con-usado` | 2/3 | 2/3 — **el check nuevo del turno 11 DISPARÓ** |
> | `no-ofrecer-lo-que-no-existe` | 2/3 | 1/3 — los mismos checks del piso de v97 |
> | `chico-no-es-utilitario` | 1/3 | **0/3**, y con una falla NUEVA en el turno 1 |
>
> **EL CHECK DE `charla-real` VOLVIÓ A MEDIR, Y ESO ES LO BUENO DE ESTA TANDA:** disparó con los
> strings nuevos (`1.3 Firefly`, `99 CV`, `2.0 de 170`, `170 CV`). Estaba muerto desde el cambio de
> datos y el bug de la ficha repetida pasaba sin que nadie lo viera.
>
> **EL TEXTO REAL DEL TURNO 2 (16:34:20), QUE CIERRA EL DIAGNÓSTICO DEL BUG 1:**
> *"La opción **chico** que entra en tu presupuesto de hasta 20 millones es el Renault Kangoo 2021,
> $18.500.000. **Es un vehículo utilitario, tamaño mediano.** Los autos chicos que te interesaron como
> el Onix, el 208 y el **Toyota Etios 2021 quedan un poco por encima de los 20 millones.**"*
> 1. **La línea 154 de v117 SÍ llegó:** Franco lee `tamano` y lo dice en voz alta. Sabe que es mediano
>    y lo ofrece igual porque es lo único que le entra. **Lo mecánico no se sostiene desde el prompt.**
> 2. **Dice que el Etios 2021 supera los 20 millones y sale $14.500.000.** Se equivoca sobre su propio
>    catálogo, y ese error es el que lo empuja al Kangoo.
> **SIN VERIFICAR, Y ES LO PRIMERO A LEER:** si `Listar stock` le devolvió el Etios en ese turno o si
> razona de memoria del turno 1. Cambia el fix (gate de presupuesto vs gate de tamaño). **No asumirlo.**
> ⚠️ **YA SE VERIFICÓ (ver la entrada de v118, arriba de todo): SÍ le devolvió el Etios, y la
> respuesta no era ninguna de las dos ramas que se anticipaban acá.** Lo excluyó la etiqueta
> `economica` + la línea 125 del prompt, no el tamaño ni el presupuesto. **No leas el punto 1 de
> "LO QUE SIGUE" como el plan vigente.**
>
> **LO QUE SIGUE, EN ORDEN:**
> 1. ~~Medir la migración~~ **HECHO, arriba.** Lo que sigue es el **v118: el gate de tamaño en SQL**,
>    con la lectura del log primero. Nota: `Config.carroceria_pedida` NO filtra SQL —alimenta 4
>    inyecciones del prompt—, así que el gate sería un mecanismo nuevo, y ahí vive la trampa 4.
> 1b. (referencia) los casos a correr eran:
>    `chico-no-es-utilitario`, `recomendacion-por-tamano`, `charla-real` (por el check nuevo),
>    `stock-general-completo` y `no-ofrecer`. **Sin esa corrida, la migración está sin medir.**
> 2. **ETAPA 2 — la copy.** 12 de las 34 frases de `descripcion`/`condicionantes` quedaron
>    contradichas por el documento. Las peores: el Kangoo dice *"sólo dos asientos: no sirve como auto
>    familiar"* (son 5), y el Onix dice *"es caja manual: si buscás automático, el Vento"* (ya es
>    automático). **Necesita decisión comercial, no sólo corrección factual.**
> 3. BUG 2 (anticipo mínimo = precio/2 en `Detalle auto`) y BUG 3 (las fotos).

> **🟡 v117 ARMADO Y PROBADO, NO DESPLEGADO (`scripts/el-tamano-lo-dice-la-ficha-no-la-carroceria.mjs`)
> — BUG 1: EL TAMAÑO. Puntero: v116 vivo. Sesión 2026-08-10.**
>
> **EL CASO NUEVO YA EXISTE Y YA FALLA: `chico-no-es-utilitario`** (86 casos en total), armado con la
> charla real de Valentina Uria. **Línea de base sobre v116 vivo (15:48:35–15:50:44): 0/3** — sin
> Onix en el turno 1 en 2 de 3, y con Kangoo en el turno 2 en **3 de 3**.
> Una corrida lo dejó textual: *"- Renault Kangoo 2021 — 82.000 km — $18.500.000 (utilitario, un poco
> más grande pero dentro del presupuesto)"* — Franco SÍ aplica la regla del grupo aparte (línea 156);
> el problema es que se la aplica al único auto que ofrece, como respuesta a "algo chico".
>
> **LA CAUSA NO ES QUE FALTE EL DATO.** `autos_disponibles.metadata` TIENE `tamano` y el modelo LO VE
> (la línea 68 del prompt lo lista entre los campos que devuelve la herramienta). **La línea 154 le
> manda explícitamente a ignorarlo:** *"Para el tamaño guiate por la carroceria de la ficha… los
> hatchback cumplen y los sedán no"*. Esa frase hace las dos cosas: excluye al Onix por ser sedán y
> deja al Kangoo sin regla, porque "utilitario" ni figura. **Trampa 6 y "un dato que el modelo lee
> como instrucción es una instrucción" al mismo tiempo: con esa línea puesta, cualquier filtro que le
> agreguemos abajo pierde.**
>
> **EL DATO YA SE CAMBIÓ (decisión de Agustina):** Onix → `tamano: chico`, **1 fila**, carrocería
> sigue `Sedán`. Verificado antes de escribir que **`content` NO menciona el tamaño en ningún auto**,
> así que no contradice el texto vectorizado y no hay que re-embeber.
>
> **EL CAMBIO — 1 NODO, 1 LÍNEA DEL PROMPT** que pasa a apuntar a `tamano`, con el ejemplo concreto
> del fallo medido (trampa 6: sin ejemplo, la regla nueva pierde contra el guion viejo). No inventa
> la conducta del "mediano como alternativa": **manda al grupo aparte de la línea 156, que ya la
> describe.** 8/8 en las revisiones del texto, y **no hardcodea ningún modelo de este stock**
> (configurabilidad: se vende a varias concesionarias).
>
> **LO QUE NO HACE Y ES DELIBERADO:** no agrega el gate de tamaño en el SQL de `Listar stock`. Lo
> determinístico va a SQL, de acuerdo, pero un gate nuevo ahí es donde vive la trampa 4 (cero filas =
> Franco no contesta) y merece su propia medición. Si después de medir sigue mezclando tamaños, ése
> es el v118.
> ⚠️ **CORREGIDO: v118 NO terminó siendo un gate de tamaño.** El log (14658) mostró que el Etios
> llegaba y lo silenciaba la etiqueta `economica`, no el tamaño. v118 reetiqueta en vez de filtrar,
> y por eso la trampa 4 ni entra en juego. Ver la entrada de v118 arriba de todo.
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v117.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan, el systemMessage **sigue arrancando con `=`** —trampa 1, asserteado—):
> `Franco (AI Agent)` → **systemMessage** (72.680 → 73.256).
> **MEDIR ASÍ:** humo · `--case chico-no-es-utilitario --repeat 3 --delay 45000` (sobre v116: **0/3**)
> · controles, y el que más importa acá es **`recomendacion-por-tamano`**, que ya existía y mide el
> mismo criterio desde el otro lado · más `stock-general-completo` (**3/3**),
> `no-ofrecer-lo-que-no-existe` (**1/3**), `capacidad-de-compra-financiada` (**3/5**).
>
> ---
>
> **🟢 v116 DESPLEGADO Y MEDIDO: EL PENDIENTE 1 CERRADO — `capacidad-de-compra-financiada` turno 2
> VERDE 5 DE 5. Puntero: v116 vivo.** Ventana 15:28:02–15:47:53, humo 12 s.
>
> | caso | v114 | v115 | **v116** |
> |---|---|---|---|
> | `capacidad-de-compra-financiada` | 2/3 | 0/5 | **3/5** |
> | su **turno 2** (`cards_empty`) | rojo 1 de 3 | rojo 3 de 5 | **verde 5 de 5** |
> | `stock-general-completo` | 3/3 | 3/3 | **3/3** |
> | `capacidad-km-alto-achica` | 3/3 | 2/3 | **3/3** |
> | `charla-real-reapertura-con-usado` | 2/3 | 2/3 | **2/3** |
> | `no-ofrecer-lo-que-no-existe` | 2/3 | 2/3 | 1/3 |
>
> **v115 puso la señal y v116 sacó las cards: juntas cierran el pendiente 1.** El único rojo que le
> queda al caso es el **turno 1, el gate de km**, abierto desde v45 y ajeno a estos cambios.
> **NINGUNA BAJA ES ATRIBUIBLE A v116, y se puede decir por check:** los rojos de `no-ofrecer` son la
> frase del piso de v97 (32M/16M/50%) y **dos burbujas de fallback del parser** en toda la tanda —
> v116 no toca ni el parser ni esas frases.
>
> **(entrada previa) 🟡 v116 ARMADO Y PROBADO (`scripts/ni-las-cards-ni-el-auto-del-cliente.mjs`) — DOS
> COSAS QUE EL CÓDIGO ROMPE.**
>
> **(A) LAS CARDS NO SE IBAN CON EL TEXTO — DEFECTO DE v113 QUE v115 DESTAPÓ.** v113 escribió
> `autos.length = 0` para que el guion no saliera "con las fotos abajo". **No alcanza:**
> `product_cards` e `images` se arman ~200 líneas ANTES a partir de `autos`, así que vaciarlo después
> no los toca. **MEDIDO en producción sobre v115** (turno 2 de `capacidad-de-compra-financiada`):
> sesión `8468b31c` → el guion + **6 cards**; `931148e9` → el guion + **5 cards**; `4d6c799e` → el
> guion + 0 cards (ahí `autos` ya venía vacío, y por eso el defecto estuvo tapado desde v113: el
> bloque casi nunca disparaba y, cuando disparaba, era sin autos hidratados).
> **POR QUÉ NADIE LO VIO: la prueba offline de v113 asserteaba `r1.autos === 0` — medía la variable
> equivocada.** Pasó 8/8 sin mirar nunca `product_cards`. Es la lección de v107 en otra forma.
>
> **(B) EL AÑO DEL AUTO DEL CLIENTE SE PISABA — BUG REPORTADO POR AGUSTINA, DIAGNOSTICADO.**
> **PRUEBA VINCULANTE, los DOS nodos de la ejecución `14244`:**
> `Franco (AI Agent)` → *"Listo, ya tengo los datos de tu **Toyota Hilux 2014**…"*
> `Armar respuesta` → *"Listo, ya tengo los datos de tu **Toyota Hilux 2021**…"*
> **Difieren: lo corrompió el código.** Es el corrector de año de v109: ve "Toyota Hilux" en el
> catálogo y le impone el año del STOCK (2021) al auto que entrega el cliente (2014). El CRM había
> guardado bien (`descripcion_usado = "Toyota Hilux 2014 - 135.000 km"`) y el modelo lo había escrito
> bien. Es intermitente porque exige la marca: *"tu Hilux 2014"* (sin "Toyota") no lo tocaba.
> **Fix: dos guardas en OR, y las dos sólo pueden DEJAR DE CORREGIR, nunca corregir de más:**
> (1) el año es uno de los de `lead_usado`; (2) el nombre viene con posesivo delante (*"tu Toyota
> Hilux"*) — ésta **no depende del CRM** y cubre el turno en que el CRM todavía no escribió.
> **El sesgo es deliberado:** pasarse de prudente deja vivo un año inventado (bug de v109, que el
> eval caza); quedarse corto le cambia el auto al cliente en la cara.
>
> **VAN JUNTAS Y ES UNA EXCEPCIÓN CONSCIENTE A "UN CAMBIO POR VEZ":** son independientes, cada una
> tiene su assert y su reproducción, y **sus síntomas son distinguibles a simple vista** (el guion
> con fotos abajo / el año del usado cambiado), así que un rojo sigue siendo atribuible. La
> alternativa era dejar v115 en producción con (A) vivo, que es peor.
>
> **PRUEBA OFFLINE: 15/15, con los dos bugs fallando primero.** (B) sobre el texto real de `14244`:
> v115 lo reescribe a 2021, v116 lo respeta — **y también lo respeta sin `lead_usado`**, que es el
> caso del CRM tarde. (A) corriendo el nodo DESDE donde se arman las cards: v115 deja 6 cards con el
> guion, v116 deja 0, y el guion sigue saliendo; con 2 autos se van las imágenes. **Y lo que ya
> funcionaba sigue igual:** los 3 casos medidos de v109 se siguen corrigiendo, la Hilux DE STOCK con
> año mal se sigue corrigiendo, y si el cliente pidió ver las cards **no se tocan**.
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v116.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (25.801 → 27.732).
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada --repeat 5 --delay 45000` mirando el
> **turno 2**, que sobre v115 falló 3 de 5 por las cards · controles: `stock-general-completo`
> (**3/3**), `capacidad-km-alto-achica` (**2/3**), `no-ofrecer-lo-que-no-existe` (**2/3**),
> `charla-real-reapertura-con-usado` (**2/3**).
>
> **LO QUE QUEDA ABIERTO DE LA MEDICIÓN DE v115, SIN TOCAR:** en la sesión `91de0ceb` la señal
> `tiene_usado_hist` era **true** y el bloque **igual no disparó** (el texto listó, 0 cards).
> Sospecha: `_listados < 2` o el `try/catch`. **NO verificado en el log — no lo tomes como diagnóstico.**
>
> **BUGS REPORTADOS EL 2026-08-10 QUE NO TOCA v116** (de la charla de Valentina Uria, 4 imágenes):
> 1. **EL FILTRO DE TAMAÑO NO EXISTE, Y EL DATO SÍ.** `autos_disponibles.metadata` **tiene `tamano`**
>    (chico 4: Fiesta, Gol Trend, Etios, 208 · mediano 9 · grande 4: las 4 pickups). En el SQL de
>    `Listar stock` **sólo se SELECCIONA (líneas 46 y 87): no filtra por él.** Por eso a "opción
>    chica, techo 20 millones" le contestó **Kangoo** (mediano, utilitario). Determinístico → SQL, con
>    un `tamano_pedido` en `Config` hermano de `carroceria_pedida`. **Ojo con el dato, no sólo con el
>    filtro:** Onix y Cronos son los dos `mediano`, así que el reclamo "el Onix es más chico que el
>    Cronos" **no lo resuelve el filtro** — es la clasificación. Decidir con Agustina antes de tocar.
> 2. **ANTICIPO MÍNIMO MAL.** Dijo *"$21.000.000"* (el precio entero) cuando es el 50% = $10.500.000.
>    Determinístico → `Detalle auto` puede entregar `anticipo_minimo = precio/2`, que es la MISMA
>    cuenta que ya hace `pisos_carroceria`. Aparte, *"cómo sería con 24 cuotas"* no lo entiende: eso
>    es guion (trampa 6). **El CUIL NO existe en `crm_leads`** (columnas verificadas): no es una
>    regresión, es una función nueva.
> 3. **LAS FOTOS.** Dijo *"acá te dejo las fotos por dentro y por fuera"* con 3 fotos exteriores.
>    **No hay metadato de interior/exterior**, así que Franco no puede saberlo: el fix es de lenguaje
>    (no prometer lo que no sabe + ofrecer al asesor + tomar nombre y apellido ante un sí). Trampa 6:
>    hay que REEMPLAZAR el guion, no agregar una prohibición.

> **🟡 v115 ARMADO Y PROBADO, NO DESPLEGADO (`scripts/el-usado-sale-de-la-conversacion-no-del-crm.mjs`)
> — ATACA EL PENDIENTE 1: EL USADO SALE DE LA CONVERSACIÓN, NO DEL CRM. Puntero: v114 vivo.
> Sesión 2026-08-10.**
>
> **EL DIAGNÓSTICO, LEÍDO DEL LOG Y NO SUPUESTO — ejecución `14150`** (turno 2 de
> `capacidad-de-compra-financiada`, `mensaje_usuario: "tiene 100.000 km"`, sesión `3fee53ee`):
> `Leer lead (estado)` devolvió `lead_entrega: "No mencionado"`, `lead_usado: "No mencionado"`,
> `lead_estado: "Nuevo"`; `Config` traía `pidio_ver: 0` y `monto_financiar` / `entrega_plata` /
> `entrega_plata_resp` **todos en 0**. Con eso `_tieneUsado` y `_dioPlata` son false y
> `_noEraDeMostrar` **no puede** ser true: la guarda de v113 no dispara y salen 5 cards. El cliente
> había dicho en el turno 1 que entrega un Ford Ka 2015 — **el dato existía, el CRM no lo había
> escrito todavía.** v113 no está roto: es CONDICIONAL AL CRM.
>
> **EL PRECEDENTE ESTABA EN EL MISMO NODO Y ES LO QUE HACE QUE ESTO NO SEA UN INVENTO:**
> `ya_derivado` (v103) dice en su propio comentario *"el hecho 'ya derivé' sale de las propias
> burbujas de Franco, NO del CRM (el CRM escribe DESPUÉS de responder, así que su estado llega >=1
> turno tarde)"*. Hay **seis** campos más en `Leer lead (estado)` derivados de `mensajes_demo` por
> esa misma razón. `tiene_usado_hist` es el séptimo, aplicado al usado.
>
> **EL REGEX SE ELIGIÓ MIDIENDO, con verdad de referencia = lo que el CRM terminó escribiendo en las
> 1.774 sesiones que todavía tienen lead.** Se probaron tres variantes; ganó la más simple:
>
> | lo que dice el CRM | sesiones | marca el regex | |
> |---|---|---|---|
> | `entrega = 'Sí'` | 505 | **412 (81,6%)** | recall |
> | `entrega = 'No'` | 90 | **0 (0%)** | **cero falsos positivos** |
> | `entrega = 'No mencionado'` | 1.179 | 14 (1,2%) | se leyeron: el cliente SÍ entrega un usado y el CRM no lo registró → **aciertos** |
>
> **LA GUARDA DE NEGACIÓN NO ES OPCIONAL, Y ESTÁ MEDIDO:** sin ella *"no tengo nada para entregar"*,
> *"no entrego mi auto"*, *"no quiero permutar"* y *"cuándo es la entrega del auto?"* dan **todos
> true**. Con ella, **16/16** sobre el set de prueba (11 negativas, 5 positivas), y *"quiero vender
> mi auto, me lo toman en consignación?"* queda afuera, que es lo correcto: consignación no es
> permuta. Mismo patrón `match AND NOT` que ya usa `franco_pidio_anticipo` en ese nodo.
>
> **POR QUÉ ES SEGURO — LA PROPIEDAD QUE DECIDIÓ EL DISEÑO:** la señal nueva entra en **OR** con las
> dos de v113. **Un miss del regex degrada EXACTAMENTE al comportamiento de hoy**; sólo un falso
> positivo haría daño, y contra el corpus son cero. Y no ensancha el predicado en el tiempo:
> `lead_entrega` también se queda en `'Sí'` por el resto de la charla una vez que el CRM escribe.
> **Esto no agrega una condición nueva: le saca el retraso a la que ya existía.**
> Las tres guardas de v113 siguen intactas: `pidio_ver === 0`, `!ya_derivado` (la ejecución `13797`
> sigue sin tocarse) y `_listados >= 2`.
>
> **EL CAMBIO — 2 NODOS, UNA SEÑAL:**
> (A) `Leer lead (estado)`: columna nueva `tiene_usado_hist`, subconsulta ESCALAR con `COALESCE`
>     (trampa 4), `queryReplacement` en forma array sin tocar (trampa 2).
> (B) `Armar respuesta`: `_tieneUsado` suma `|| _le2.tiene_usado_hist === true`.
>
> **PRUEBAS. Contra la base:** el bloque nuevo, compuesto con el MISMO `FROM (SELECT 1) d LEFT JOIN
> crm_leads` de la query real, **devuelve 1 FILA** y da `true` para la sesión exacta de `14150` — y
> esa sesión **ya no tiene fila en `crm_leads`** (la borró el cleanup del eval), o sea que el caso
> probado es justamente el `LEFT JOIN` sin match, que es el escenario de la trampa 4.
> **Offline: 25/25**, con el bug fallando primero: con el código de v114 y los valores reales de
> `14150` el bloque **no dispara**; con v115 y la señal, **dispara**; y con la señal en false v115 se
> comporta **idéntico a v114**. Más las tres guardas (pidió ver, derivado por `lead_estado`, derivado
> por `ya_derivado`), el camino viejo intacto, el gate de plata de v88, y las 16 frases del regex.
>
> **🔴 LO QUE NO SE PUDO CORRER Y HAY QUE SABERLO ANTES DE PEGAR:** la query **completa** de 13.929
> caracteres no se ejecutó de una pieza contra la base (v112 sí lo hizo). Se ejecutó el bloque nuevo
> compuesto con el `FROM` real. **El riesgo remanente es la convivencia con las otras 8 subconsultas,
> y el humo lo caza en 12 segundos:** si `Leer lead (estado)` devolviera cero filas, la trampa 4
> corta la cadena y Franco **no contesta nada**. Si el humo falla, se vuelve a pegar v114 y listo.
>
> **AL PEGAR — 2 NODOS** (desde `workflows/franco-n8n-v115.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Leer lead (estado)` → **Query** (11.642 → 13.377) ·
> `Armar respuesta` → **jsCode** (25.333 → 25.801). El prompt no se toca.
> **MEDIR ASÍ:** **humo primero, es el que valida la trampa 4** · después
> `--case capacidad-de-compra-financiada --repeat 5 --delay 45000` mirando el **turno 2**
> (`cards_empty` + `text_not_matches`), que sobre v114 falla de forma intermitente — 2 de 3 el
> 2026-08-07 y 1 de 3 el 2026-08-10, por eso van **5 repeticiones y no 3** · controles:
> `charla-real-reapertura-con-usado` (**2/3**, y su turno 10 es candidato a MEJORAR: es el mismo
> patrón, cliente completando datos del usado y Franco listando sin que se lo pidan),
> `stock-general-completo` (**3/3**), `capacidad-km-alto-achica` (**3/3**),
> `no-ofrecer-lo-que-no-existe` (**2/3**), `financiacion-techo-por-anticipo`.
> **EL RIESGO A MIRAR EN LOS CONTROLES:** que el guion reemplace una respuesta legítima en una charla
> donde el cliente mencionó un usado hace rato y después pide ver con una frase que `pidio_ver` no
> reconoce. Es el residual de v113, ahora activo desde un turno antes.

> **🟢 v114 DESPLEGADO Y VERIFICADO BYTE A BYTE (`scripts/el-encabezado-pegado-al-item.mjs`) — CIERRA
> EL PENDIENTE 4, Y EN LOS DOS LADOS A LA VEZ. Puntero: v114 vivo.
> 🔵 PENDIENTE 2: v112 SIGUE SIN EJERCITARSE, Y AHORA SE SABE POR QUÉ ES CASI INALCANZABLE.
> Sesión 2026-08-07.**
>
> **EL HUECO DE v109 + DEL EVAL DEJÓ DE SER UNA HIPÓTESIS: TIENE SU TURNO REAL Y SU AUTO INVENTADO.**
> `mensajes_demo` **11684** (2026-08-06 19:42, o sea la tanda de v110 — coincide con el "visto en una
> corrida de v110" que estaba anotado). Franco escribió, y salió al cliente:
> *"Alto: - Volkswagen Polo 2021 — 25.000 km — $15.000.000 (hatchback)"*.
> **NO HAY NINGÚN POLO EN EL STOCK** (17 autos, verificado contra `autos_disponibles` por MCP). Los
> otros cuatro renglones del turno eran correctos: no fue un turno roto, fue ESE renglón colado por
> el formato.
>
> **REPRODUCIDO ANTES DE TOCAR NADA, sobre el texto real y contra el código desplegado:** el borrado
> de v109 borra **cero** renglones y `no_inventa_autos` devuelve **null**. El MISMO texto con la
> viñeta en su propia línea lo cazan los dos. La única diferencia es dónde cae la viñeta.
>
> **CUÁNTO PASA — medido sobre las 5.992 respuestas de `mensajes_demo`, no estimado:**
>
> | renglones con precio y año | turnos | qué son |
> |---|---|---|
> | 8.157 que el check SÍ ve | 1.454 | los de siempre, viñeta al principio |
> | 1.171 que no ve **y hace bien** | 850 | prosa (*"La Ford Ranger 2024 es la pickup más nueva…"*) |
> | **3 con encabezado + viñeta** | **1** | **el 11684, el del Polo** |
> | 3 con encabezado y punto y coma | 1 | el 7914 — **queda abierto**, ver abajo |
>
> O sea: raro, pero cuando pasa se cuela justo lo que el proyecto más cuida.
>
> **EL CAMBIO — UN NODO Y UN PATRÓN COMPARTIDO, EN LOS DOS ARTEFACTOS A LA VEZ.** En `Armar
> respuesta`, `_esOferta` y `_esItem` pasan a usar `_ITEM`, que acepta un encabezado corto pegado
> adelante; en `evals/run.mjs`, el mismo patrón sale una sola vez como `ES_ITEM` y lo usan los **tres**
> checks que lo tenían copiado (`cars_in_list_format`, `no_inventa_autos`, `carroceria_solo_si_hay`).
> **Hay un assert que compara el texto del patrón en los dos archivos**: si divergen, el script falla.
> Lo que decide si el renglón se borra NO se toca — sigue siendo "no nombra ningún auto del catálogo",
> así que un renglón que mezcle un auto real con uno inventado se sigue respetando entero, y el usado
> del propio cliente también.
>
> **BLAST RADIUS DEL CAMBIO DEL EVAL, CALCULADO SOBRE TODO EL HISTORIAL:** los únicos renglones que
> cambian de clasificación en las 5.992 respuestas son **los 3 del turno 11684**. Efecto neto: **+1
> rojo verdadero** (el Polo, que hoy pasa invisible) y **−1 rojo falso** (`cars_in_list_format` decía
> *"nombró 4 autos pero solo 2 en formato lista"* sobre un turno que SÍ estaba en lista).
>
> **PRUEBA OFFLINE: 20/20**, con el bug fallando primero. Corre el bloque de v109 **de v113 y de
> v114** sobre las 5 burbujas reales del 11684: en v113 el Polo sobrevive, en v114 se va y quedan los
> cuatro renglones reales, la primera burbuja y la pregunta de cierre. Más los controles: el Cruze de
> `13306` se sigue borrando, un encabezado con un auto REAL no se toca, el usado del cliente se
> respeta, la prosa con dos puntos no se toca, y el check nuevo no da rojo por los renglones buenos.
>
> **LO QUE NO TOCA, A PROPÓSITO Y CON ASSERT QUE LO FIJA:**
> · **El contador `_listados` de v111/v113 usa el MISMO patrón viejo y se deja como está.** Ampliarlo
>   haría disparar el guion de v113 en turnos donde hoy no dispara, que es exactamente el riesgo
>   residual que STATE le anotó a v113. Un cambio por vez. El script assertea que quede **una sola**
>   ocurrencia del patrón viejo y que sea ésa.
> · **LA OTRA FORMA QUE NADIE VE, con su evidencia** (`mensajes_demo` **7914**, 2026-08-01):
>   *"Intermedio: Renault Duster 2023, SUV mediana, 31.000 km, $22.500.000; Chevrolet Onix 2024, …"* —
>   encabezado y autos encadenados con punto y coma, **sin una sola viñeta**. En ese turno los 8 autos
>   eran reales y los precios correctos, así que **no hay daño medido**. Cubrirla exige razonar por
>   AUTO y no por renglón: es otro diseño, no un regex más ancho.
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v114.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (24.645 → 25.333).
> **MEDIR ASÍ:** humo · controles, porque este cambio no tiene un caso que lo encienda a voluntad —
> el formato aparece 1 vez cada 1.500 turnos: `stock-general-completo`, `capacidad-de-compra-financiada`,
> `capacidad-km-alto-achica`, `charla-real-reapertura-con-usado`, `no-ofrecer-lo-que-no-existe`.
> **Lo que hay que mirar es que NADA se ponga rojo**: el fix sólo puede borrar renglones, y los
> controles dicen si borra alguno que no debía.
>
> ---
>
> **PENDIENTE 2 — v112 SIGUE SIN EJERCITARSE. 8 CORRIDAS MÁS, Y LA CONDICIÓN NO SE DIO.**
> Ventana **13:02:07–13:09:18 del 2026-08-07**, `--case stock-general-completo --repeat 8 --delay
> 45000` sobre v113 vivo: **8/8 ok**, 0 ejecuciones en error (`search_executions` sobre la ventana
> exacta). Es la prueba más propensa que existe (un solo turno, *"qué autos tenés disponibles?"*, o
> sea `pidio_ver = 1` garantizado), y en las 8 Franco devolvió los ids reales: los 17 autos con sus
> 17 cards. **Verificado en la ejecución `14127`: `Hidratar autos` devolvió filas reales**, así que
> el camino de siempre alcanzó y el bloque de v112 no corrió. Con las 3 de ayer, **11 corridas
> seguidas sin reproducir**.
>
> **🔴 Y ACÁ ESTÁ LO QUE NO SE HABÍA VISTO, LEÍDO DEL CÓDIGO DE `Armar respuesta`: v111 LE COME LA
> MAYOR PARTE DE LA SUPERFICIE A v112.** La guarda de v111 es `ids.length > 0 && autos.length === 0`
> y corre **antes**; cuando dispara, reemplaza el texto por el guion, que no nombra ningún auto. Y el
> bloque de v112 sólo se mete si el texto FINAL nombra 3 o más autos del catálogo. O sea:
> · `auto_ids` con ids **inventados** → dispara v111 y **v112 ya no puede disparar**;
> · `auto_ids: []` → v111 no dispara (exige `ids.length > 0`) y **ésa es la única puerta real de v112**.
> **La superficie viva de v112 es sólo `auto_ids: []`, que es el sabor 3a.** No es un bug: con ids
> inventados el texto también suele venir inventado (`13749`: seis autos con años y precios falsos),
> así que tapar es lo correcto y el orden actual está bien. Pero explica por qué 11 corridas no lo
> tocaron, y **acota qué hay que buscar para darlo por probado**.
>
> **MI LECTURA, PARA DECIDIR: dejarlo.** No es "código sin verificar" en el sentido de v107: v107
> leía un nodo con una forma de dato **supuesta**, y v112 lee `catalogo_precios` de `Leer lead
> (estado)`, que es el ÚNICO mecanismo verificado disparando en producción (lo probó v109). Lo que
> falta no es que su lectura funcione, es que su condición ocurra. Y sólo puede **agregar** cards
> donde no había ninguna: si no dispara, la respuesta es idéntica. **Sacarlo costaría una versión y
> un deploy para volver a un estado peor.** La decisión es de Agustina.
>
> ---
>
> **LÍNEA DE BASE PRE-DEPLOY DE v114, SOBRE v113 VIVO — ventana 13:14:11–13:33:35 del 2026-08-07,
> `--repeat 3 --delay 45000`, 0 ejecuciones en error (`search_executions` sobre la ventana exacta).**
> Es contra estos números que hay que medir v114 después de pegarlo.
>
> | caso | v113 hoy | lo que decía STATE |
> |---|---|---|
> | `stock-general-completo` | **3/3** | 3/3 ✅ |
> | `capacidad-km-alto-achica` | **3/3** | 3/3 ✅ |
> | `charla-real-reapertura-con-usado` | **2/3** | 2/3 ✅ |
> | `no-ofrecer-lo-que-no-existe` | **0/3** | 1/3 — sigue bajando desde v97 |
> | `capacidad-de-compra-financiada` | **0/3** | **2/3 — NO SE REPRODUJO** |
>
> **🔴 CORRECCIÓN A LA ENTRADA DE v113, MEDIDA Y CON EL LOG: SU TURNO 2 NO ESTÁ "VERDE 3 DE 3".**
> Hoy salió **verde 1 de 3**, con `cards_empty: hay 5` y `hay 6` en las otras dos — el mismo síntoma
> que v113 decía haber cerrado. **La causa está leída, no supuesta: ejecución `14150`** (turno 2,
> `mensaje_usuario: "tiene 100.000 km"`, sesión `3fee53ee`). `Leer lead (estado)` devolvió
> `lead_entrega: "No mencionado"`, `lead_usado: "No mencionado"`, `lead_estado: "Nuevo"`, y `Config`
> traía `pidio_ver: 0` con `monto_financiar`, `entrega_plata` y `entrega_plata_resp` **todos en 0**.
> Con eso `_tieneUsado` y `_dioPlata` son false y **`_noEraDeMostrar` NO PUEDE ser true**: el bloque
> de v113 no disparó. `estado_cliente` lo dice en castellano: *"(Todavía no te dio ningún dato.)"* —
> y el cliente había dicho en el turno 1 que entrega un Ford Ka 2015 con $7.000.000 de anticipo.
> **v113 no está roto: es CONDICIONAL AL CRM.** Cuando el CRM ya escribió, dispara; cuando llega
> tarde, no. La ventana de ayer fue favorable y la de hoy no. **Eso no es el residuo de 1 de 3 que
> anotaba el pendiente 1: hoy es el camino dominante, 2 de 3.**
>
> **🟢 Y APARECIÓ LA PIEZA QUE EL PENDIENTE 1 ANDABA BUSCANDO, EN EL MISMO LOG.** `Leer lead
> (estado)` **ya calcula campos que NO dependen del CRM**, sacados de la conversación por SQL:
> `msg_financiar_hist` y `msg_anticipo_hist` traían, en ese mismo turno 2, el mensaje del turno 1
> completo (*"tengo un ford ka 2015 para entregar y unos 7 millones de anticipo…"*). **O sea que la
> señal existe y es determinística** — que es el criterio que este proyecto le exige a una señal
> nueva para no ser una paráfrasis.
>
> > ❌ **FALSO, CORREGIDO EL 2026-08-10 AL ESCRIBIR v115 — NO LO LEAS COMO VERDAD:** acá decía que
> > *"el gate de v85 de `Listar stock` ya calcula `tiene_permuta` por la misma vía"*. **No es
> > cierto.** `tiene_permuta` es **`$fromAI`** —lo decide el MODELO— en sus 7 apariciones del SQL de
> > `Listar stock`. No es determinístico y ese camino no existe. Lo verifiqué antes de usarlo. El
> > precedente bueno es otro y estaba al lado: `ya_derivado`, que sale de `mensajes_demo` por SQL
> > justamente porque el CRM llega tarde. Es el que usa v115.
>
> **LO QUE ESTA TANDA SÍ DEJA CERRADO DEL LADO DEL EVAL:** en las **15 conversaciones** completas, el
> patrón ampliado (`ES_ITEM`) **no produjo ni un rojo**: ni `no_inventa_autos` (que corre en TODOS
> los turnos), ni `cars_in_list_format`, ni `carroceria_solo_si_hay`. Los 8 rojos son todos de checks
> que este cambio no toca. **El widening no da falsos positivos en tráfico real.**
>
> ---
>
> **DEPLOY DE v114 VERIFICADO byte a byte:** `updatedAt 2026-08-10T13:36:27Z`, 35 nodos, **cero
> diferencias de parámetros** con `franco-n8n-v114.json`, `connections` idénticas; `Armar respuesta`
> 25.333 chars con `_ITEM` ×3. Puntero de `scripts/state-sync.mjs` en v114, los 5 invariantes pasan,
> humo 12 s.
>
> **CONTROLES POST-DEPLOY — ventana 13:38:39–13:57:50, `--repeat 3 --delay 45000`, 0 ejecuciones en
> error. 12/15 contra 8/15 de la base. 🔴 Y ESE NÚMERO NO ES MÉRITO DE v114 — HAY QUE LEERLO BIEN:**
>
> | caso | base (v113) | **v114** | qué pasó |
> |---|---|---|---|
> | `stock-general-completo` | 3/3 | **3/3** | igual |
> | `capacidad-km-alto-achica` | 3/3 | **3/3** | igual |
> | `charla-real-reapertura-con-usado` | 2/3 | **2/3** | igual (turno 11, la ficha repetida) |
> | `capacidad-de-compra-financiada` | 0/3 | **2/3** | **flakiness**, ver abajo |
> | `no-ofrecer-lo-que-no-existe` | 0/3 | **2/3** | **flakiness**, ver abajo |
>
> **POR QUÉ ES FLAKINESS Y NO EL FIX, Y NO ES UN ARGUMENTO SINO UNA PRUEBA:** en las 66 respuestas de
> la ventana hubo **119 renglones de lista normales y CERO de la forma nueva** (encabezado pegado al
> ítem). Si ningún renglón matchea el patrón nuevo-y-no-el-viejo, entonces `_esOferta` y `_esItem`
> devuelven **exactamente lo mismo que en v113 para toda línea**: el comportamiento de v114 en esta
> ventana fue **idéntico al de v113 por construcción**. No puede haber arreglado ni roto nada acá.
> Los rojos que se fueron son los dos casos que STATE ya documenta oscilando, y los que quedaron son
> los de siempre: `cards_empty` con 5 cards en el turno 2 (el CRM tarde, pendiente 1) y la frase del
> piso de v97 que no adhiere.
>
> **ENTONCES, DICHO DERECHO: v114 QUEDA DESPLEGADO Y SIN EJERCITAR, igual que v112.** Lo que está
> verificado es (a) que el bug existe y salió a producción (`mensajes_demo` 11684), (b) que el código
> viejo no lo veía y el nuevo sí, sobre ESE texto real (20/20 offline), y (c) que en 15
> conversaciones reales el patrón ampliado **no produjo ni un falso positivo** ni del lado del código
> ni del lado del eval. Lo que NO está verificado es verlo disparar en vivo, y a 1 cada ~1.500 turnos
> **no se puede provocar**: hay que esperar a que aparezca. La diferencia con v112 es que acá el eval
> ahora lo caza solo, así que la próxima vez que pase va a quedar registrado en vez de pasar de largo.
>
> **(entrada previa) 🟢 v113 DESPLEGADO Y MEDIDO: `capacidad-de-compra-financiada` 0/3 → 2/3, LA MEJOR MARCA DE SU
> HISTORIA. LOS TRES SABORES DEL BUG, CERRADOS O ACOTADOS. Puntero: v113 vivo.
> Sesión 2026-08-06 (segunda).**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 21:19:43Z`, 35 nodos, cero diferencias con
> `franco-n8n-v113.json`; único nodo distinto de v112: `Armar respuesta` (24.645).
>
> **MEDICIÓN — ventanas 21:29:58–21:32:46 y 21:33:07–21:40:33, `--delay 45000`, humo 19 s:**
>
> | caso | antes | **v113** |
> |---|---|---|
> | `capacidad-de-compra-financiada` | 0/3 | **2/3 — dos corridas verdes ENTERAS** |
> | su turno 2 · `cards_empty` | rojo 3 de 3 | **verde 3 de 3** ⚠️ *corregido arriba: el 2026-08-07 dio verde 1 de 3 — el fix es condicional al CRM, no estable* |
> | `charla-real-reapertura-con-usado` | 2/3 | 2/3 |
> | `no-ofrecer-lo-que-no-existe` | 2/3 | 1/3 |
>
> **EL RIESGO RESIDUAL QUE SE ANOTÓ AL ARMARLO NO SE MATERIALIZÓ, Y SE PUEDE AFIRMAR DESDE LA SALIDA
> DEL PROPIO EVAL:** en las dos corridas rojas de `no-ofrecer-lo-que-no-existe` lo que salió es **la
> LISTA de autos, no el guion**, o sea que el bloque de v113 **no disparó** y su salida es idéntica a
> la de v112. Lo que falla ahí es que Franco no dice la frase del piso ($32.000.000 / $16.000.000 /
> 50%), que vive en el prompt de v97 y este cambio no toca. Ese caso viene oscilando 3/6 → 2/3 → 1/3
> desde v97. **No hay evidencia de que v113 haya vaciado ninguna respuesta legítima.**
>
> **LO QUE LE QUEDA AL CASO:** una corrida donde el turno 2 lista igual **con cero cards** — o sea
> `auto_ids: []` (sabor 3) combinado con el LAG DEL CRM: si `lead_entrega`/`lead_usado` todavía dicen
> "No mencionado" y no hay plata en `Config`, `_noEraDeMostrar` queda en false y el bloque no
> dispara. Es el residuo conocido, no algo nuevo.
>
> **LOS TRES SABORES, AL CIERRE DE LA SESIÓN:**
> 1. **ids INVENTADOS** → cerrado por **v111**, con prueba directa en `13749`.
> 2. **ids REALES de memoria** → cerrado por **v113** (`cards_empty` verde 3 de 3).
> 3. **`auto_ids: []`** → la mitad legítima (el cliente pidió ver) la cubre **v112**, *desplegado pero
>    todavía sin ejercitar en producción*; la mitad ilegítima queda ACOTADA por v113 y **abierta**
>    cuando el CRM llega tarde o el lead ya está derivado (`13797`).
>
> **(entrada previa) 🟢 v112 DESPLEGADO Y MEDIDO: SIN REGRESIONES, PERO EL BLOQUE NUEVO NO SE EJERCITÓ.
> 🟡 v113 ARMADO Y PROBADO, **NO DESPLEGADO** (`scripts/si-no-pidio-ver-no-se-lista.mjs`) — ES EL
> SABOR 2, EL ÚLTIMO. Puntero: v112 vivo. Sesión 2026-08-06 (segunda).**
> **DEPLOY DE v112 VERIFICADO byte a byte:** `updatedAt 20:59:51Z`, 35 nodos, cero diferencias con
> `franco-n8n-v112.json`; los 2 nodos distintos de v111 son los esperados, el SQL trae `i` y `f`, y
> la trampa 2 sigue en pie.
>
> **MEDICIÓN — ventanas 21:00:48–21:03:55 y 21:04:46–21:12:13, `--delay 45000`:**
> `stock-general-completo` **2/3 → 3/3 estable** · `capacidad-km-alto-achica` **3/3** ·
> `capacidad-de-compra-financiada` turno 3 **verde 3 de 3** · **`no_inventa_autos`: 0 fallas en 6
> corridas**, o sea que agregar `i`/`f` al catálogo **no rompió a v105 ni a v109**, que era el riesgo
> real de este cambio.
>
> **🟠 PERO EL 3/3 DE `stock-general-completo` NO PRUEBA QUE v112 FUNCIONE, Y HAY QUE DECIRLO:** en
> las TRES corridas Franco devolvió los **17 ids reales** (ejecuciones `13886` y `13890`), así que el
> camino de siempre alcanzó y el bloque nuevo **nunca se ejecutó**. El bug no reprodujo en esa
> ventana. **v112 queda desplegado, verificado OFFLINE (14/14 sobre el texto real) y sin ejercitar en
> producción.** Lo que lo probaría: un turno con `auto_ids: []` + `pidio_ver = 1` en el que igual
> salgan cards.
>
> **v113 — SI NO PIDIÓ VER Y ESTÁ DANDO DATOS, NO SE LISTA, AUNQUE LOS ids EXISTAN.**
> Es el sabor 2: con ids REALES traídos de memoria, hidratan, salen cards y v111 no dispara. Medido
> sobre v112: el turno 2 de `capacidad-de-compra-financiada` falla **3 de 3** con
> `cards_empty: hay 6` (y 5, y 6) más el texto listando "Gol Trend". **Es el único rojo que le queda
> a ese caso.**
> **CADA PIEZA DE LA SEÑAL ES EL MISMO DATO QUE YA DECIDE ESTO EN OTRO LADO, no una paráfrasis:**
> `Config.pidio_ver` (el campo que lee el gate de `Listar stock`) · el usado con la MISMA expresión
> del fallback de TB-3 de este nodo · la plata con los MISMOS campos de `Config` del gate de v88 ·
> `ya_derivado` con el mismo criterio del guard de cierre.
> **LA GUARDA DE `ya_derivado` ES LA QUE EVITA CAMBIAR UN ROJO POR OTRO PEOR:** en `13797`
> (`ya_derivado: true`) el guion ofrecería un asesor a alguien que YA está derivado. Con la guarda,
> ese turno **no se toca** y sigue abierto con su propia evidencia.
> **Y CUANDO DISPARA, LAS CARDS SE VAN CON EL TEXTO** (`autos.length = 0`): sin eso quedaría el guion
> con seis fotos abajo, que es peor que el bug.
> **PRUEBA OFFLINE: 8/8** sobre el texto REAL del turno 2 medido en v112 — sale el guion y las cards
> quedan en 0; `13797` con `ya_derivado: true` **no se toca**; si pidió ver no se mete (el turno 3
> sigue intacto); sin usado ni plata no se mete; con plata sí; una ficha suelta sin lista no se toca;
> y v111 sigue funcionando aunque el cliente haya pedido ver.
>
> **🔴 EL RIESGO RESIDUAL, Y NO ES CERO:** si el cliente pide ver con una frase que el regex de
> `pidio_ver` no reconoce (*"y de esos cuáles me convienen?"*), teniendo un usado declarado y sin
> estar derivado, este bloque le reemplaza una respuesta legítima por el guion. El requisito de DOS
> renglones de lista con precio lo acota pero no lo elimina. **Es la contracara de cerrar el sabor 2
> por código y hay que mirarlo en los controles**, en especial en `charla-real-reapertura-con-usado`
> y `no-ofrecer-lo-que-no-existe`.
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v113.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (22.986 → 24.645).
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada --repeat 3 --delay 45000` mirando el
> **turno 2** (`cards_empty` + el `text_not_matches`), que sobre v112 falla **3 de 3** · controles,
> y acá está el riesgo: `charla-real-reapertura-con-usado` (**2/3**),
> `no-ofrecer-lo-que-no-existe` (**2/3, su marca**), `capacidad-km-alto-achica` (**3/3**),
> `stock-general-completo` (**3/3**), `financiacion-techo-por-anticipo` (**3/3**).
>
> **(entrada previa) 🟡 v112 ARMADO Y PROBADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v111 vivo.
> `scripts/las-cards-salen-del-texto.mjs`. Sesión 2026-08-06 (segunda).**
>
> **ATACA LA MITAD DEL SABOR 3 QUE SE PUEDE ARREGLAR SIN RIESGO, Y LA OTRA MITAD NO SE TOCA A
> PROPÓSITO — ESTO ES LO IMPORTANTE DE ESTA ENTRADA.** Extender el guion de v111 al turno 10 de
> `charla-real` parecía la continuación obvia y **está mal**. En la ejecución `13797` el lead trae
> `ya_derivado: true`, `lead_estado: "Requiere asesor"` y `lead_usado: "No mencionado"` —el CRM
> todavía no había registrado el usado que el cliente dio un turno antes—, así que el guion habría
> salido *"Perfecto, ya lo tengo anotado. Querés que te contacte un asesor para avanzar?"* **a
> alguien que YA está derivado**: un bug que este proyecto ya arregló. Se cambiaba un rojo por otro
> peor. **Lo cazó verificar el lead en el log en vez de suponerlo.** Esa mitad va aparte.
>
> **LAS DOS SITUACIONES DEL SABOR 3, LAS DOS MEDIDAS HOY:**
> (a) **el cliente PIDIÓ ver** y Franco lista bien pero se olvida los ids — `stock-general-completo`
>     turno 1: nombró los **17 autos correctos** y mandó **cero cards**. El texto está bien; faltan
>     las fotos. **Esto es lo que arregla v112.**
> (b) **el cliente NO pidió ver** — `charla-real` turno 10 (`13797`, mensaje *"35mil km"*). Sin tocar.
>
> **EL DISCRIMINADOR ES `Config.pidio_ver`, Y NO ES UNA RÉPLICA:** es el MISMO campo que ya lee el
> gate de `Listar stock`, calculado una vez en `Config`. **Probado con la expresión DESPLEGADA sobre
> los mensajes reales:** *"qué autos tenés disponibles?"* → **1** · *"35mil km"* → **0** ·
> *"tiene 100.000 km"* → 0 · *"dale, mostrame las opciones que me entran"* → **1**.
>
> **EL CAMBIO — 2 NODOS, UN OBJETIVO:**
> (A) `Leer lead (estado)`: `catalogo_precios` pasa a traer también `i` (id) y `f` (foto).
> (B) `Armar respuesta`: si no quedó ninguna card ni imagen, el cliente pidió ver, y el texto FINAL
>     nombra 3 o más autos del catálogo, las cards se arman con esos autos **en el orden en que
>     aparecen en el texto**, con precio y foto de la base.
> **POR QUÉ ES SEGURO: nunca reescribe ni borra nada.** Sólo AGREGA cards de autos que el texto ya
> ofrece, y sólo si no había ninguna. Si no dispara, la respuesta es idéntica a la de hoy.
> **Y CIERRA EL SABOR 2 EN ESTE CAMINO:** si las cards salen del texto, no pueden contradecirlo.
> (Con ids que SÍ hidratan sigue mandando el camino de siempre: ese resto queda abierto.)
> **NO CUESTA TOKENS DEL MODELO:** verificado que `catalogo_precios` no está en el System Message ni
> en ningún campo de `Config` — sólo lo leen `Leer lead (estado)` y `Armar respuesta`.
>
> **PRUEBAS. Contra la base:** los 17 autos traen `i` y `f` (URL más larga 102 chars, catálogo 2.883
> bytes), y **la query GENERADA COMPLETA devuelve 1 FILA** con los 17 en el catálogo — trampa 4, las
> nueve subconsultas escalares conviven. **Offline, 14/14** sobre el texto real de
> `stock-general-completo`: recupera las 7 cards en el orden del texto, con precio de la base; y NO
> se mete en 9 casos donde no debe (no pidió ver, ya hay cards, hay imágenes, el guion de v111, sólo
> 2 autos, sin catálogo, catálogo con la forma VIEJA sin `i`/`f`, y las dos ramas del dedup).
>
> **AL PEGAR — 2 NODOS** (desde `workflows/franco-n8n-v112.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Leer lead (estado)` → **Query** (11.376 → 11.642) ·
> `Armar respuesta` → **jsCode** (20.603 → 22.986). El prompt no se toca.
> **MEDIR ASÍ:** humo · `--case stock-general-completo --repeat 3 --delay 45000` mirando
> **`media_si_lista_autos` y `cards_min`** (sobre v111: 2/3, con una roja de TIPO B + `cards_min 0 de
> 10`) · controles: `capacidad-km-alto-achica` (**3/3, no puede bajar**),
> `capacidad-de-compra-financiada` (turno 3 **verde 3/3**), `financiacion-techo-por-anticipo`
> (**3/3**), `charla-real-reapertura-con-usado` (**2/3; su turno 10 NO lo toca este cambio**).
>
> **(entrada previa) 🟢 v111 DESPLEGADO Y MEDIDO: EL PENDIENTE 1 CERRADO —CON PRUEBA DIRECTA DE QUE EL CÓDIGO
> DISPARÓ— Y `capacidad-km-alto-achica` 1/3 → 3/3. Puntero: v111 vivo. Sesión 2026-08-06 (segunda).**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 19:58:10Z`, 35 nodos, cero diferencias con
> `franco-n8n-v111.json`; único nodo distinto de v110: `Armar respuesta` (20.603).
>
> **MEDICIÓN — ventanas 19:58:54–20:06:29 y 20:07:27–20:17:20, `--delay 45000`, humo 10,3 s:**
>
> | | v110 | **v111** |
> |---|---|---|
> | `capacidad-km-alto-achica` | 1/3 | **3/3 estable** |
> | `media_si_lista_autos` TIPO B en los 2 casos de capacidad | 2 de 6 | **0 de 6** |
> | `capacidad-de-compra-financiada` · turno 3 | verde 3 de 3 | **verde 3 de 3** |
> | `financiacion-techo-por-anticipo` (control: SÍ debe listar) | 3/3 | **3/3** |
>
> **🟢 PRUEBA DIRECTA DE QUE EL BLOQUE DISPARÓ, que es lo que faltó todo el día — ejecución `13749`,
> los DOS nodos del MISMO turno:** `Franco (AI Agent)` escribió un abanico de SEIS autos con años y
> precios falsos (Onix 2020 $10.500.000, Gol Trend 2019 $11.000.000, Fiesta 2021, Cronos 2020, Etios
> 2021, Duster 2020) con `auto_ids: [101,102,103,104,105,106]`; `Armar respuesta` devolvió **UNA
> burbuja con el guion** y `product_cards: []`. **Difieren: el código tapó al modelo.** Ojo con esto
> al leer resultados futuros: el guion es el MISMO texto que renderiza la inyección de v102 en el
> prompt, así que verlo en la salida NO prueba nada — hay que comparar los dos nodos.
>
> **EL BUG TIENE TRES SABORES Y AHORA ESTÁN NOMBRADOS. v111 cierra el primero:**
> 1. **ids INVENTADOS** (`[101..106]`, `[111..116]`, `[197,163,…]`): no hidratan → **v111 los tapa.** ✅
> 2. **ids REALES traídos de memoria** (`13583`: `[9,5,8,6,7,12]`): hidratan, así que v111 no dispara
>    y **salen cards que no coinciden con el texto**. Señal: texto contra cards, también main chain.
> 3. **`auto_ids: []`** con el texto listando autos igual: no hay ids que hidratar, v111 no dispara y
>    el cliente ve una lista sin una sola foto. **PRUEBA VINCULANTE: ejecución `13797`** (turno 10 de
>    `charla-real-reapertura-con-usado`), `auto_ids: []` y seis autos en el texto —dos de ellos la
>    Ranger de $57.000.000 y la Hilux de $38.000.000, muy por encima del techo—.
> **EL SABOR 3 ES HOY EL MÁS FRECUENTE EN LAS MEDICIONES:** explica el 2/3 de
> `charla-real-reapertura-con-usado` (era 3/3) y el 2/3 de `stock-general-completo`.
> **NINGUNO DE LOS DOS ES REGRESIÓN DE v111, Y NO ES UN ARGUMENTO SINO LA SALIDA:** v111 sólo puede
> reemplazar el texto por un guion que no nombra ningún auto, o sea que sólo puede APAGAR
> `media_si_lista_autos`, nunca encenderlo; y en las dos corridas rojas el texto que salió es la
> lista, no el guion, así que el bloque no disparó.
>
> **EL PENDIENTE 2 (el techo como número legible) PERDIÓ URGENCIA Y HAY QUE DECIRLO:** era la
> hipótesis para el turno 3, y el turno 3 **ya está verde 3 de 3** por otra vía (v106 + v108 + v110).
> No hace falta tocarlo.
> **EL PENDIENTE 3 (gate de km) SIGUE ABIERTO** desde v45: falló 2 de 3 en esta tanda, una de ellas
> con burbuja de fallback del parser.
>
> **LO QUE SIGUE, EN ORDEN, SI SE RETOMA:**
> 1. **Sabor 3** (`auto_ids: []`), que es el que más rojos genera hoy. Señal disponible y main chain,
>    **pero ojo:** a diferencia del sabor 1, `auto_ids: []` NO implica que ese turno no fuera de
>    mostrar — puede ser un turno legítimo donde Franco se olvidó los ids. Para no romper esos habría
>    que sumar la guarda de "este turno no era de mostrar", que hoy vive en `Config` (`pidio_ver`) y
>    en el SQL. **Replicarla es exactamente el riesgo de desincronización que este proyecto ya
>    sufrió**, así que es una decisión de diseño, no una obviedad.
> 2. **Sabor 2** (cards que no coinciden con el texto).
> 3. **Gate de km.**
> 4. **Hueco de v109 + del eval:** el encabezado y el ítem en la MISMA línea
>    (*"Alto: - Volkswagen Polo 2021 — $15.000.000"*) no lo ve ni el borrado de v109 ni el check
>    `no_inventa_autos`, porque los dos exigen la viñeta al principio del renglón.
>
> **(entrada previa) 🟢 v110 DESPLEGADO Y MEDIDO: EL TURNO 3 PASÓ DE ROJO 3 DE 3 A VERDE 3 DE 3, Y
> `capacidad-de-compra-financiada` DIO SU PRIMERA CORRIDA VERDE. Puntero: v110 vivo.
> 🟡 v111 ARMADO Y PROBADO, **NO DESPLEGADO** (`scripts/ids-que-no-hidratan-son-inventados.mjs`) —
> CIERRA EL PENDIENTE 1 SIN LEER LA TOOL. Sesión 2026-08-06 (segunda).**
> **DEPLOY DE v110 VERIFICADO byte a byte:** `updatedAt 19:34:01Z`, 35 nodos, cero diferencias con
> `franco-n8n-v110.json`; único nodo distinto de v109: `Armar respuesta` (20.053), con la comparación
> nueva puesta y la vieja ausente.
>
> **MEDICIÓN — ventana 19:35:31–19:42:42, `--delay 45000`, humo 9,7 s:**
>
> | | v109 | **v110** |
> |---|---|---|
> | `capacidad-de-compra-financiada` (caso entero) | 0/3 | **1/3 — primera corrida verde de su historia** |
> | su **turno 3** (el abanico) | rojo 3 de 3 | **verde 3 de 3** |
> | su **turno 1** (gate de km) | rojo 1 de 3 | verde 3 de 3 |
> | `capacidad-km-alto-achica` | 3/3 | 1/3 |
>
> **EL TURNO 3 CIERRA v106 + v108 + v110 JUNTOS:** el abanico llega al cliente con los autos de
> arriba (Renegade $25.500.000, Corolla $24.800.000, Duster $22.500.000) y una corrida llegó a listar
> **los 11**. Lo que faltaba era el encabezado de v110: sin él, el turno traía el abanico correcto y
> era rojo igual.
> **EL ÚNICO ROJO QUE LE QUEDA AL CASO ES EL TURNO 2**, que es el pendiente 1.
>
> **`capacidad-km-alto-achica` 3/3 → 1/3 NO ES REGRESIÓN DE v110, Y ESTÁ LEÍDO DEL LOG:** las dos
> rojas son `media_si_lista_autos` TIPO B, y la ejecución `13702` muestra por qué —
> **`auto_ids: [197,163,128,182,148,176]`, ids INVENTADOS** (el stock va del 1 al 17): `Hidratar
> autos` no trae nada y no hay cards. v110 no toca `auto_ids` ni la hidratación. Es la flakiness que
> el propio caso documenta desde v46, y es el MISMO bug que ataca v111.
>
> **v111 — SI NINGÚN id HIDRATA, LOS AUTOS QUE NOMBRÓ NO SALIERON DE LA BASE. UN NODO, UNA CONDICIÓN.**
> **CIERRA EL PENDIENTE 1 SIN RESOLVER LA INCÓGNITA:** no hace falta averiguar qué devuelve
> `$('Listar stock').first().json` en este nodo — alcanza con **no usarlo**. La señal es 100% main
> chain y son las dos piezas de las que ya salen las cards:
> `auto_ids` (de `Franco (AI Agent)`) tiene ids **y ninguno hidrata** ⇒ los inventó.
> **VERIFICADA DOS VECES EN PRODUCCIÓN, leída del log:** `13306` (`auto_ids: [111..116]`) y `13702`
> (`[197,163,128,182,148,176]`), las dos con cero filas hidratadas y el texto listando autos con
> precios. **Y es consistente por construcción:** si la herramienta le hubiera dado autos, usaría SUS
> ids; que los invente significa que en ese turno no tenía ninguno — justo lo que v102 quería
> detectar.
> Fix: `if (centinela)` → `if (centinela || (ids.length > 0 && autos.length === 0))`. El cuerpo del
> bloque de v107 **no se toca** (assert que lo compara byte a byte): sigue exigiendo ≥2 renglones de
> lista con precio que nombren un auto del catálogo, y sigue reemplazando por el guion de v102.
> `centinela` se deja por si esa lectura se arregla algún día.
> **PRUEBA OFFLINE: 9/9, sobre los casos REALES del log**, y **con el control que faltaba**: se corre
> el bloque de v110 sobre `13702` y **no dispara** (prueba de que estaba muerto), y el de v111 sobre
> el mismo dato y **sale el guion**. Más `13306`, y 4 casos donde NO debe meterse (ids que sí
> hidratan, sin ids, texto sin lista, un solo renglón), el camino del centinela intacto y el guion
> genérico sin usado.
> **LO QUE NO CUBRE, DICHO DERECHO:** el caso de `13583`, donde los ids son REALES pero de memoria.
> Ahí hidratan, el detector no dispara, y salen cards que no coinciden con el texto. Esa es otra
> señal (texto contra cards) y va aparte.
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v111.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (20.053 → 20.603).
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada,capacidad-km-alto-achica --repeat 3
> --delay 45000` mirando **`media_si_lista_autos` y el turno 2** · controles:
> `financiacion-techo-por-anticipo` (**3/3**), `stock-general-completo`,
> `no-ofrecer-lo-que-no-existe` (**2/3, su marca**), `charla-real-reapertura-con-usado`.
>
> **HUECO DE v109 ANOTADO, NO ARREGLADO:** si Franco pone el encabezado y el ítem en la MISMA línea
> (*"Alto: - Volkswagen Polo 2021 — $15.000.000"*), el borrado no lo ve, porque exige la viñeta al
> principio del renglón. Visto en una corrida de v110. **El check `no_inventa_autos` del eval tiene
> exactamente el mismo patrón, así que tampoco lo caza** — o sea que ese formato pasa por los dos
> lados. Se arregla en los dos a la vez o no sirve.
>
> **(entrada previa) 🟢 v109 DESPLEGADO Y MEDIDO: EL AUTO INVENTADO SE FUE — 2 de 3 → 0 de 3 EN LOS DOS CASOS, Y
> `capacidad-km-alto-achica` 0/3 → 3/3. Puntero: v109 vivo.
> 🟡 v110 ARMADO Y PROBADO, **NO DESPLEGADO** (`scripts/el-encabezado-dice-anticipo-no-efectivo.mjs`).
> Sesión 2026-08-06 (segunda).**
> **DEPLOY DE v109 VERIFICADO byte a byte:** `updatedAt 19:17:18Z`, 35 nodos, cero diferencias con
> `franco-n8n-v109.json`; único nodo distinto de v108: `Armar respuesta` (19.544), con los dos
> bloques nuevos y el corrector de v105 intacto.
>
> **MEDICIÓN — ventana 19:18:10–19:24:39, `--delay 45000`, humo 9 s, 0 ejecuciones en error:**
>
> | | v108 | **v109** |
> |---|---|---|
> | `no_inventa_autos` en `capacidad-de-compra-financiada` | 2 de 3 | **0 de 3** |
> | `no_inventa_autos` en `capacidad-km-alto-achica` | 2 de 3 | **0 de 3** |
> | `capacidad-km-alto-achica` (caso entero) | 0/3 | **3/3 estable** |
>
> **CONTROLES (19:25:11–19:30:28):** `financiacion-techo-por-anticipo` **3/3** ·
> `no-ofrecer-lo-que-no-existe` **2/3**, su marca desde v97, no es regresión.
> **LA REGLA FUNCIONÓ:** construir sólo sobre el único mecanismo verificado disparando en producción
> (`catalogo_precios` de `Leer lead (estado)`) dio resultado al primer intento, contra los tres
> cambios anteriores que se apoyaron en lecturas no verificadas.
>
> **🟢 Y LA MEDICIÓN DEJÓ UNA BUENA NOTICIA SOBRE v106+v108: LLEGAN AL CLIENTE.** En la corrida 2 el
> turno 3 trajo el abanico alto CORRECTO —Renegade $25.500.000, Corolla $24.800.000, Duster—. O sea
> que la selección del modelo es FLAKY, no está sistemáticamente rota como parecía sobre v108.
> **Ese turno fue rojo igual, y por una causa determinística y ajena:** falló
> `text_matches financ|50 %|anticipo` porque el encabezado que arma el código decía *"Con tu usado
> como parte de pago y **tu efectivo**"*.
>
> **v110 — EL ENCABEZADO DICE "ANTICIPO Y FINANCIACIÓN", NO "EFECTIVO". UN NODO, UNA COMPARACIÓN.**
> El fallback del encabezado TB-3 compara `lead_financia === 'Si'` SIN TILDE y la base guarda `'Sí'`
> CON tilde: **la rama nunca puede ser verdadera**. Verificado contra la base: `crm_leads.financia`
> tiene 'Sí' (495), 'No' (68), 'No mencionado' (1127) y **cero** 'Si'.
> **Y NO ES UN DETALLE DE REDACCIÓN, PORQUE ESE FALLBACK CORRE SIEMPRE:** como la lectura del tool no
> funciona, `ls.eco_permuta` queda null y el fallback entra en todos los turnos.
> **LA PRUEBA ES LA FRASE MISMA:** *"Con tu usado como parte de pago y tu efectivo…"* sólo la produce
> `permuta=true, presu=true, financia=false`; está unívocamente determinada por cómo se arman las
> partes. **Daño medido: tapó un turno que YA funcionaba**, y en la demo en vivo le dice *"tu
> efectivo"* a alguien que está financiando.
> Fix: `=== 'Si'` → `/^s[ií]$/i.test(...trim())`. **Se normaliza** en vez de arreglar la tilde a
> secas, porque ese valor lo escribe un modelo. Los otros dos campos del fallback no se tocan
> (`lead_entrega` ya compara con tilde y es correcto), y hay un assert de que la diferencia de largo
> es EXACTAMENTE la del reemplazo.
> **PRUEBA OFFLINE: 19/19, sobre el bloque TB-3 ENTERO del v110 generado.** Reproduce el bug sobre
> v109 y el fix sobre v110 **bajo LAS DOS formas posibles de la lectura del tool** —que tire, y que
> devuelva el input— porque no está establecido cuál ocurre y las dos llevan al mismo fallback. El
> stub de `Leer lead (estado)` usa la forma exacta leída del log (`13306`). Cubre además las 6
> variantes que puede escribir el CRM ('Sí', 'sí', 'Si', 'si', 'SI', ' Sí ') y las 4 que NO deben
> contar. Y verifica que si el tool SÍ se pudiera leer, ese camino no cambia.
> antes: *"Con tu usado como parte de pago y tu efectivo, estas opciones te pueden servir:"*
> ahora: *"Con tu usado como parte de pago, tu anticipo y la posibilidad de financiar, estas opciones
> te pueden servir:"*
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v110.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (19.544 → 20.053).
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada --repeat 3 --delay 45000` mirando el
> **turno 3**, que sobre v109 falló 3 de 3 por dos causas distintas (1 de 3 por el encabezado, 2 de 3
> porque el modelo eligió los baratos) · controles: `capacidad-km-alto-achica` (**3/3, no puede
> bajar**), `financiacion-techo-por-anticipo` (**3/3**), `permuta-contado-factoriza-usado`.
> **LO QUE SIGUE ABIERTO, EN ORDEN:** (1) que leer la salida del tool desde `Armar respuesta` no
> funcione —deja muertos v102 y v107, y necesita verificación contra una ejecución real ANTES de
> escribir código—; (2) el techo financiado no existe como número legible para el modelo, que es la
> hipótesis del turno 3 y **sigue sin medir**; (3) el gate de km, abierto desde v45.
>
> **(entrada previa) 🟡 v109 ARMADO Y PROBADO SOBRE LOS TEXTOS REALES DEL LOG, **NO DESPLEGADO**. Puntero: v108 vivo.
> `scripts/el-auto-que-no-existe-se-borra.mjs`. Sesión 2026-08-06 (segunda).**
>
> **LA REGLA QUE SALIÓ DE LOS TRES CAMBIOS ANTERIORES Y QUE ESTE APLICA: se construye SÓLO sobre
> mecanismos VERIFICADOS DISPARANDO EN PRODUCCIÓN.** En `Armar respuesta` hay exactamente uno: el
> corrector de precios de v105, que lee `catalogo_precios` de `Leer lead (estado)` (main chain).
> Prueba vinculante, ejecución `13583`, comparando el output de `Franco (AI Agent)` con el de
> `Armar respuesta` del MISMO turno: Etios $10.800.000→$12.500.000, Duster →$22.500.000,
> Renegade →$25.500.000, Amarok →$32.000.000. **Los dos bloques que leen la salida del TOOL (v102 y
> v107) NO funcionan y este cambio no los usa ni los toca.**
>
> **QUÉ ATACA — LO QUE MÁS DAÑO HACE EN LA DEMO, y todo medido hoy (ventanas 18:43–19:07):**
> AUTOS QUE NO EXISTEN (*"Chevrolet Cruze 2019 — $22.500.000"*, *"Renault Sandero 2020/2021/2022"*,
> *"Nissan Kicks 2019"*, *"Volkswagen Tiguan 2018"*, *"Nissan Versa 2022"*) y AÑOS INVENTADOS sobre
> autos que sí existen (*"Gol Trend 2022"* → 2018, *"Duster 2018"* → 2023, *"Renegade 2019"* → 2021,
> *"Etios 2018"* → 2019). El auto y el año son lo que el cliente se lleva anotado.
> **LA BASELINE YA ESTÁ MEDIDA, no hace falta correrla de nuevo:** `no_inventa_autos` viene rojo
> sobre v108 en `capacidad-de-compra-financiada` (2 de 3, 18:56–19:00) y en `capacidad-km-alto-achica`
> (2 de 3, 19:01–19:07).
>
> **EL CAMBIO — UN NODO (`Armar respuesta`), DOS BLOQUES, los dos hermanos del de v105 y con su MISMA
> fuente.** El bloque de v105 **no se toca** (hay un assert que compara su texto byte a byte).
> **(A) EL AÑO:** en cada renglón que nombra un auto del catálogo, el primer año que aparece justo
> después del nombre se reemplaza por el de la base. Acotado a 12 caracteres sin dígitos en el medio,
> para no pisar los km ni el precio.
> **(B) EL AUTO QUE NO EXISTE:** un renglón de LISTA con PRECIO **y** AÑO es una OFERTA; si no nombra
> ningún auto del catálogo, se borra. **Las tres condiciones juntas son lo que lo hace seguro:** un
> *"- Sellos, $208.000"* (sin año) y un *"el Etios que viste"* (sin viñeta) quedan afuera solos. El
> usado del PROPIO cliente se respeta (sale de `lead_usado`). Los encabezados que quedan sin ningún
> renglón abajo (*"Alto:"* y nada) se van con ellos. **Y si borrar dejara la respuesta vacía, no se
> aplica.**
> **POR QUÉ BORRAR Y NO CORREGIR, al revés que v105:** con el precio el auto existe y hay con qué
> corregir; acá el auto no existe y no hay número que poner.
>
> **PRUEBA OFFLINE — 24/24, y sobre los TEXTOS REALES traídos del log, no inventados.** El stub de
> `$` reproduce la forma EXACTA que `Leer lead (estado)` devolvió en `13583` (leída del log): por ahí
> pasa el mecanismo que ya sabemos que funciona. El texto de `13306` queda así:
> el Cruze **borrado**, Gol Trend **2018**, Etios **2019**, Renegade **2021**, Corolla **2022**, los
> km y los precios intactos, el *"Ford Ka 2015"* del cliente intacto y los encabezados en su lugar.
> Y no se mete en 6 casos donde no debe (lista de gastos sin año, mención en prosa, catálogo vacío,
> borrado que dejaría todo vacío, un *"service en 2024"* en el mismo renglón, sin catálogo).
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v109.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Armar respuesta` → **jsCode** (15.445 → 19.544). El prompt no se toca.
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada,capacidad-km-alto-achica --repeat 3
> --delay 45000` mirando **`no_inventa_autos`**, que es el check de este cambio · controles:
> `financiacion-techo-por-anticipo` (**3/3**), `stock-general-completo`,
> `charla-real-reapertura-con-usado`, `no-ofrecer-lo-que-no-existe`.
> **OJO AL LEER EL RESULTADO:** el turno 1 (gate de km, abierto desde v45) y el turno 3 (el modelo
> elige los más baratos) **van a seguir rojos**: este cambio no los toca y no hay que atribuirle
> ninguno de los dos.
>
> **(entrada previa) 🔴 v108 DESPLEGADO Y MEDIDO: EL CASO SIGUE 0/3, Y APARECIÓ ALGO MÁS GRANDE —
> EL CENTINELA DE v102 NUNCA FUNCIONÓ EN PRODUCCIÓN. Puntero: v108 vivo. Sesión 2026-08-06 (segunda).**
> **DEPLOY DE v108 VERIFICADO byte a byte:** `updatedAt 18:53:25Z`, 35 nodos, cero diferencias con
> `franco-n8n-v108.json`; el único nodo distinto de v107 es `Listar stock`.
>
> **AUDITORÍA DE CONSUMIDORES ANTES DE MEDIR** (el paso que faltó en v106, ahora hecho): los únicos
> consumidores de `categoria`/`tramo` son el SM y la propia query. El SM dice *"Recomendás 2 a 5 de
> los `entra`, empezando por los de mayor precio (vienen primeros)"* — consistente con v108. No había
> contradicción.
>
> **MEDICIÓN — ventana 18:56:25–19:00:02, `--delay 45000`, humo 11 s:** `capacidad-de-compra-financiada`
> **0/3**, turno 3 rojo **3 de 3**. **CONTROLES 19:01:19–19:06:39:**
> `financiacion-techo-por-anticipo` **3/3** (el más expuesto: no se rompió) ·
> `capacidad-km-alto-achica` **0/3**.
>
> **v108 HIZO LO QUE DECÍA Y TAMPOCO ALCANZÓ.** Ejecución `13570` (turno 3): la tool devolvió los 11
> con **todos `categoria: "entra"`**, ordenados de mayor a menor (Renegade $25.500.000 primero). Y
> **Franco eligió `auto_ids: [2,4,3,1,17]`** —Gol Trend, Etios, Fiesta, Cronos, Kangoo, los CINCO MÁS
> BARATOS— salteando los seis primeros, y encabezó *"Con tu Ford Ka 2015 y $7.000.000 de anticipo…"*.
> **El modelo elige contra los $7.000.000 del cliente, no contra el techo de la herramienta.** Y no es
> raro: **el techo financiado ($26.365.000) no existe como número en ningún lugar que el modelo pueda
> leer** — vive sólo adentro del SQL. `estado_cliente` dice $7.000.000 y `precio_objetivo` dice
> 7000000. Lo único que asoma del techo es la palabra `tramo`.
>
> **🔴 Y ACÁ EL HALLAZGO QUE OBLIGA A CORREGIR LA ENTRADA DE ABAJO: EL CENTINELA DE v102 NO VACÍA
> NADA EN PRODUCCIÓN, Y LA ENTRADA ANTERIOR DE ESTE ARCHIVO LO DIO POR BUENO SIN PRUEBA.**
> **LA ATRIBUCIÓN EQUIVOCADA:** de la ejecución `13306` se leyó `product_cards: []` y se concluyó
> *"v102 vació las cards y funcionó"*. **FALSO.** El `Franco (AI Agent)` de ESA MISMA ejecución
> devolvió **`auto_ids: [111,112,113,114,115,116]` — ids INVENTADOS** (el stock va del 1 al 17):
> `Hidratar autos` no encontró ninguno y las cards salieron vacías **por eso**, no por el centinela.
> **LA PRUEBA AL REVÉS, ejecución `13583`** (turno 2 de `capacidad-km-alto-achica`): `Listar stock`
> devolvió el centinela `[{"success": true}]` y Franco puso **ids REALES de memoria**
> (`[9,5,8,6,7,12]`) → **salieron las 6 product_cards**, de autos que ni siquiera son los que nombró
> el texto. Con el centinela puesto. **No vació nada.**
> **CAUSA: `$('Listar stock').first().json` no devuelve `{response:[...]}` en el main chain.** Los DOS
> bloques de `Armar respuesta` que leen la tool así fallan. Evidencia independiente: el bloque TB-3
> tiene un fallback puesto exactamente por eso, y en `13522` ese fallback CORRIÓ (encabezado *"tu
> efectivo"*) aunque la tool había devuelto filas con `eco_financia: 1`.
> **CONSECUENCIA DIRECTA: v107 ESTÁ MUERTO.** Su bloque depende de esa misma señal. En `13583` había
> 6 renglones de lista con precio y nombre del catálogo y no disparó. (El corrector de precios de
> v105 SÍ disparó en ese turno —Etios $10.800.000→$12.500.000, Duster →$22.500.000, Renegade
> →$25.500.000, Amarok →$32.000.000— porque lee `catalogo_precios` de `Leer lead (estado)`, que es
> main chain.)
> **LECCIÓN, Y ES LA QUE EXPLICA LOS TRES CAMBIOS QUE NO LLEGARON AL USUARIO: una prueba offline con
> `$` stubbeado prueba la lógica, NO la forma real del dato.** Lo mismo que v100 con `entrega_plata_hist`,
> una capa más arriba. **Todo bloque que lea la salida de un nodo TOOL necesita una verificación
> CONTRA UNA EJECUCIÓN REAL antes de contarse como puesto.**
>
> **`capacidad-km-alto-achica` 0/3 NO ES REGRESIÓN DE v108, Y ESTÁ PROBADO:** en `13583` la tool
> devolvió CERO filas (gate de v85, el cliente da los km sin pedir ver), así que el Amarok, el
> Renegade y el Duster los **inventó** el modelo. v108 no pudo introducirlos. Es la conducta que el
> propio caso documenta desde v46 (*"el chat-text NO discrimina"*). **Dicho derecho: no tengo baseline
> de ese caso sobre v105/v107, así que afirmo la causa del turno leída del log, no un antes/después.**
>
> **LO QUE ESTÁ PROBADO Y LO QUE NO, PARA NO VOLVER A CONSTRUIR SOBRE ARENA:**
> · PROBADO — la capa de datos quedó bien: la tool devuelve los 11 correctos, con etiquetas
>   coherentes, sin pickups, y el contado y `financiacion-techo-por-anticipo` no se movieron.
> · PROBADO — el centinela de v102 y por lo tanto v107 no funcionan; la lectura de la tool es la causa.
> · NO PROBADO — por qué el modelo elige los más baratos. Hay una hipótesis fuerte (el techo no existe
>   como número legible) pero **no está medida**.
>
> **(entrada previa — SU AFIRMACIÓN SOBRE EL CENTINELA DE v102 ES FALSA, VER ARRIBA) 🟠 v107 DESPLEGADO Y MEDIDO: LA TOOL YA DEVUELVE LOS 11 AUTOS, PERO EL CLIENTE SIGUE VIENDO 3.
> LA CAUSA ESTÁ LEÍDA DEL LOG Y v108 YA ESTÁ ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**.
> Puntero: v107 vivo. `scripts/si-manda-el-tramo-la-categoria-no-opina.mjs`. Sesión 2026-08-06 (segunda).**
> **DEPLOY DE v107 VERIFICADO byte a byte:** `updatedAt 18:42:14Z`, 35 nodos, **cero diferencias** con
> `franco-n8n-v107.json`, `connections` intactas, y los únicos 2 nodos distintos de v105 son
> `Listar stock` y `Armar respuesta`. SM sin tocar (72.680, arranca con `=`).
>
> **MEDICIÓN — ventana 18:43:12–18:46:53, `--delay 45000`, humo 10 s (sin contención):**
> `capacidad-de-compra-financiada` sigue 0/3 y **el turno 3 sigue fallando
> `text_matches onix|208|ecosport|duster|corolla|renegade` 3 de 3**.
>
> **v106 HIZO EXACTAMENTE LO QUE PROMETÍA, Y NO ALCANZÓ.** Ejecución `13522` (turno 3):
> `Listar stock` devolvió **los ONCE autos previstos** —Renegade, Corolla, Duster, Onix, 208,
> EcoSport, Kangoo, Cronos, Etios, Gol Trend, Fiesta—, con sus tramos alto/intermedio/entrada y
> **ninguna pickup**. Idéntico a la prueba contra la base. **El dato llegó perfecto y el modelo
> mostró 5.** Texto completo de esa ejecución:
> *"Con tu usado como parte de pago y tu efectivo, estas opciones te pueden servir: - Toyota Etios
> 2019 … - Volkswagen Gol Trend 2018 … - Ford Fiesta 2017 … **Y si querés algo de más categoría,
> entregando tu usado podrías llegar a estas otras, dependiendo de cuánto te lo tomen:** - Renault
> Kangoo 2021 … - Fiat Cronos 2023 …"*
>
> **EL CORTE CAE EXACTAMENTE EN LA FRONTERA DE `categoria`, Y FRANCO NO DESOBEDECIÓ NADA.** Los 3 que
> vienen `'estirar'` son el bloque principal; de los 8 que vienen `'fuera'` sólo asoman los dos más
> baratos, como apéndice. Eso es al pie de la letra lo que el SM enseña sobre `'fuera'` (*"se pasa del
> presupuesto… los mostrás, y decís con todas las letras que se van del presupuesto"*): la etiqueta lo
> manda a OTRO guion y el abanico por tramos nunca se dispara. De yapa sale el *"entregando tu usado
> podrías llegar"*, que el SM prohíbe dos párrafos más abajo.
> **ERROR DE DISEÑO MÍO EN v106, Y LO CAZÓ EL LOG:** saqué el FILTRO y dejé la ETIQUETA mintiendo. Con
> financiación, `categoria` sigue midiendo contra $13.182.000 mientras `tramo` mide contra
> $26.365.000. **La lección, que es la de siempre en este proyecto: un dato que el modelo lee como
> instrucción es una instrucción. No alcanza con dejar de filtrar; hay que dejar de etiquetar mal.**
>
> **v108 — SI MANDA EL `tramo`, LA `categoria` NO OPINA.** UN nodo, UNA rama de CASE:
> `WHEN con_financiacion = 1 AND capital > 0 THEN 'entra'`, o sea exactamente cuando `tramo` deja de
> valer `'n/a'` y pasa a decidir. Y `'entra'` es LA VERDAD, no un parche: la query ya excluyó por
> `tramo` todo lo que se pasa del techo financiado. Al contado no cambia nada.
> **v106 NO SE REVIERTE** aunque su filtro ya no llegue a dispararse en la rama financiada: los dos
> dicen el mismo principio en los dos lugares donde vive, y dejar uno solo convierte esa coincidencia
> en un acoplamiento implícito.
> **PRUEBA CONTRA LA BASE sobre la query GENERADA del v108** (mismo renderizador de bloques `{{ }}`,
> con los valores exactos del `inputOverride` de `13522`):
>
> | escenario | filas | etiquetas |
> |---|---|---|
> | turno 3 (pidió ver) | **11** | **todos `categoria='entra'`**, tramos alto/intermedio/entrada |
> | turno 2 (NO pidió ver) | **0** | el centinela: v102 intacto |
> | contado | **3** | `n/a/estirar` — idéntico a hoy |
> | financia sin permuta (`financiacion-techo-por-anticipo`) | **3** | `entra` en vez de `fuera`; el conjunto NO cambia |
>
> **AL PEGAR — 1 NODO** (desde `workflows/franco-n8n-v108.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Listar stock` → **Query**. El prompt no se toca.
> **BASELINE PARA MEDIR:** turno 3 de `capacidad-de-compra-financiada`, **3 de 3 en rojo sobre v107**
> (ventana 18:43:12–18:46:53). Controles: `financiacion-techo-por-anticipo` (**3/3, es el más
> expuesto: cambia de etiqueta**), `capacidad-km-alto-achica`, `permuta-contado-factoriza-usado`,
> `charla-real-reapertura-con-usado` (**3/3**), `no-ofrecer-lo-que-no-existe`.
>
> **LO DE v107 QUEDÓ SIN MEDIR TODAVÍA:** el turno 2 falló 1 de 3 por lista de autos, pero **las 3
> corridas vinieron sucias por arriba** (2 con burbuja de fallback en el turno 1, y una en la que el
> turno 2 trajo 6 cards de verdad porque el flujo se desvió). El bloque nuevo de `Armar respuesta` no
> tuvo una ventana limpia; se vuelve a mirar con la tanda de v108.
>
> **(entrada previa) 🟡 v106 + v107 ARMADOS Y VALIDADOS CONTRA LA BASE, **NO DESPLEGADOS**. Puntero: v105 vivo.
> `scripts/permuta-financiada-no-se-corta.mjs` · `scripts/centinela-tambien-borra-el-texto.mjs`.
> Sesión 2026-08-06 (segunda).**
>
> **PRIMERO, EL DIAGNÓSTICO DEL TIPO B — Y LA HIPÓTESIS QUE DEJÓ LA ENTRADA DE ABAJO ERA FALSA.**
> Leído del log ANTES de tocar nada (ejecución `13306`, sesión `91c03467-825f-4fdd-8969-ab7eda736ca1`,
> turno 2 de `capacidad-de-compra-financiada`):
> · el centinela vino del **gate de permuta de v85** (`tiene_permuta=1 AND pidio_ver=0`), con
>   `Config.pidio_ver: 0` — el *"tiene 100.000 km"* no es pedido ni afirmativo. No era un camino sin
>   cubrir.
> · **la inyección de v102 SÍ cubre ese camino y SÍ se renderizó** (`franco_ofrecio_mostrar: true`,
>   `lead_usado: "Ford Ka 2015"`): las otras 2 corridas del `--repeat 3` la dijeron casi textual.
>   **Adhiere 2 de 3.** La que falla listó 6 autos con `product_cards: []`, uno inexistente
>   (*"Chevrolet Cruze 2019 — $22.500.000"*).
> · **Y HAY UN SEGUNDO BUG DEBAJO, QUE NADIE HABÍA VISTO:** aunque el gate se abra, el abanico sale
>   cortado a la mitad. Ver v106.
>
> **EL CASO SE REESCRIBIÓ, PORQUE EL INSTRUMENTO CONTRADECÍA A v102.** `capacidad-de-compra-financiada`
> exigía el abanico en el turno del km; v102 —pedido de Agustina— manda que si el cliente está DANDO
> datos y no pidió ver, la tool no devuelva nada. **Ese turno no podía ponerse verde nunca.** Ahora el
> turno 2 mide la conducta de v102 (cero autos, cards vacías, las dos salidas) y **el turno 3 es
> nuevo** (*"dale, mostrame las opciones que me entran"*) y mide el abanico. Decisión de Agustina:
> gana v102, se arregla el caso, y el bug de datos se arregla igual.
>
> **v106 — CON PERMUTA + FINANCIACIÓN EL ABANICO SE CORTA A LA MITAD DEL TECHO.** UN nodo,
> UNA condición, `Listar stock`. `Listar stock` clasifica dos veces y después AND-ea los dos filtros:
> `categoria` mide la capacidad SIN financiar y `tramo` la financiada. Con permuta manda el más chico
> y **la financiación deja de existir**. Con el caso medido (anticipo $7.000.000, Ford Ka 2015 de
> 100.000 km tasado en $8.832.460): techo por `tramo` **$26.365.000**, techo por `categoria`
> **$13.182.000** → Onix, 208, EcoSport, Duster, Corolla y Renegade quedan `categoria='fuera'` aunque
> `tramo` los acepte. **El cliente ve TRES hatchbacks en vez de once autos.** No es sólo del eval: le
> pasa a cualquiera que entregue un usado y financie.
> Fix: `NOT (tiene_permuta=1 AND u.categoria='fuera')` → `NOT (tiene_permuta=1 AND con_financiacion<>1
> AND u.categoria='fuera')`. Al contado queda todo igual, porque ahí `tramo` vale `'n/a'` y no filtra.
> **PRUEBA CONTRA LA BASE SOBRE LA QUERY GENERADA, no transcripta a mano:** el script renderiza los
> bloques `{{ }}` del v106 con los valores EXACTOS del `inputOverride` de `13306` y escribe el SQL.
> Los 4 escenarios, medidos en Supabase:
>
> | escenario | filas | qué salió |
> |---|---|---|
> | v105 turno 3 (HOY) | **3** | Fiesta, Etios, Gol Trend — el bug |
> | v106 turno 3 (pidió ver) | **11** | + Cronos, Kangoo, EcoSport, 208, Onix, Duster, Corolla, Renegade · **ninguna pickup** |
> | v106 turno 2 (NO pidió ver) | **0** | el centinela: **v102 intacto** |
> | v106 contado (sin financiar) | **3** | idéntico a hoy: el cambio es angosto |
> | v106 km 250.000 (`capacidad-km-alto-achica`) | **9** | **Corolla y Renegade siguen afuera** por tramo |
>
> **v107 — EL CENTINELA TAMBIÉN LIMPIA EL TEXTO, NO SÓLO LAS CARDS.** UN nodo, `Armar respuesta`.
> v102 vacía las cards cuando la tool devolvió el centinela y funcionó (`product_cards: []`), pero el
> TEXTO seguía listando. **Con el centinela arriba, cualquier auto listado está inventado por
> definición: la herramienta no le dio ninguno.** Se reemplaza la respuesta por el guion de v102
> —el mismo texto, armado en el código con los mismos datos— en vez de borrar los renglones, porque
> borrarlos deja colgado el encabezado (*"tenés este abanico estimado de opciones:"* y abajo nada).
> **DOS CONDICIONES, las dos necesarias:** el centinela, y **≥2 renglones de LISTA que nombren un auto
> del catálogo Y traigan precio** — el criterio con que `no_inventa_autos` distingue una oferta de una
> mención al pasar.
> **POR QUÉ NO FUE AL PROMPT, y esto se midió en vez de suponerse:** la inyección de v102 ya cubre el
> caso y adhiere 2 de 3, y el prompt lo prohíbe en cuatro lugares. Trampa 6.
> **PRUEBAS OFFLINE sobre el v107 GENERADO: 5/5 + 10/10.** El centinela de v102 conserva su conducta
> exacta con las cards; el bloque nuevo corre sobre el **texto REAL de la ejecución 13306** traído de
> `mensajes_demo` y lo reemplaza por el guion; y NO se mete en 8 casos donde no debe (sin centinela,
> centinela sin lista, una sola línea, menciones en prosa, renglones sin precio, sin usado declarado,
> un *"$208.000"* que no es un Peugeot, y catálogo vacío).
>
> **AL PEGAR — 2 NODOS** (desde `workflows/franco-n8n-v107.json`, 35 nodos, `connections` sin tocar,
> los 5 invariantes pasan): `Listar stock` → **Query** · `Armar respuesta` → **jsCode**
> (12.902 → 15.445). El prompt NO se toca.
>
> **BASELINE PARA MEDIR — ventana 18:27:49–18:31:05, `--delay 45000`, 0 ejecuciones en error:**
> `capacidad-de-compra-financiada` con el caso reescrito, sobre v105. **El turno 3 falla
> `text_matches onix|208|ecosport|duster|corolla|renegade` 3 DE 3** (las tres respuestas arrancan
> listando el Etios): ESO es lo que tiene que desaparecer con v106. El turno 2 falla 1 de 3 por la
> lista de autos (v107) y el turno 1 sigue rojo por el **gate de km, abierto desde v45 y ajeno a estos
> cambios**.
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada --repeat 3 --delay 45000` ·
> controles: `capacidad-km-alto-achica` (el hermano directo de v106),
> `permuta-contado-factoriza-usado` (prueba que al contado no cambió nada),
> `charla-real-reapertura-con-usado` (**3/3, no puede bajar**), `financiacion-techo-por-anticipo`
> (**3/3**), `financiacion-no-dumpea-abanico-sin-pedirlo` y `no-ofrecer-lo-que-no-existe`.
>
> **(entrada previa) 🟢 v105 DESPLEGADO Y MEDIDO: EL PRECIO INVENTADO BAJÓ DE 3/3 A 1/3, Y LO QUE QUEDA ES OTRA
> CLASE DE BUG. Puntero: v105 vivo. Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 16:35:53Z`, 35 nodos, **cero diferencias** con
> `franco-n8n-v105.json`, `connections` intactas.
> **MEDICIÓN — ventana 16:36:47–16:55:19, `--delay 45000`:**
> `no_inventa_autos` en `capacidad-de-compra-financiada`: **3 de 3 corridas → 1 de 3**. Y la que
> queda **NO es un precio inventado**: es *"Chevrolet Cruze 2019"*, un auto que no está en el
> stock — exactamente el caso que el propio script documentó como NO CUBIERTO. Los tres precios
> falsos medidos sobre v104 (Gol Trend $17.000.000, EcoSport $27.000.000, Onix $15.200.000)
> **desaparecieron**.
> **CONTROLES:** `charla-real-reapertura-con-usado` **3/3**, `financiacion-techo-por-anticipo`
> **3/3**, `stock-general-completo` **3/3**, `no-ofrecer-lo-que-no-existe` 2/3 (su marca de v97).
> **`capacidad-de-compra-financiada` SIGUE 0/3 PERO YA NO POR PRECIOS:** queda (a) el gate de km
> del turno 1, abierto desde v45, y (b) **`media_si_lista_autos` TIPO B: nombró 5 autos y no llegó
> ninguna card**.
> **(b) ES EL PRÓXIMO PASO Y HAY UNA HIPÓTESIS CONCRETA, NO CONFIRMADA:** puede ser efecto del
> centinela de v102 — si `Listar stock` devuelve cero filas, ahora las cards se vacían por código
> pero el TEXTO puede seguir listando, así que un bug visible ("lista autos que no debía") se
> convertiría en otro ("nombra autos y no llegan cards"). **HAY QUE CONFIRMARLO EN EL LOG antes de
> tocar nada:** mirar si `Listar stock` corrió en ese turno y si devolvió el centinela. Si es eso,
> el fix es que la inyección de v102 cubra también ese camino (turno con permuta donde el cliente
> SÍ completó los datos), no tocar el centinela.
>
> **LO QUE QUEDA ABIERTO AL CERRAR ESTA SESIÓN, EN ORDEN:**
> 1. El TIPO B de arriba (hipótesis lista, falta el log).
> 2. **Autos que no existen** (*"Chevrolet Cruze"*, *"Renault Sandero"*): distinto del precio —
>    hay que BORRAR el renglón, no corregirlo. El catálogo ya está disponible en
>    `catalogo_precios`, así que la pieza de datos ya está puesta.
> 3. El **gate de km** de `capacidad-de-compra-financiada`, abierto desde v45.
> 4. El **equipamiento que no distingue nada** (*"aire acondicionado"* en 17 de 17), pendiente de
>    la sesión anterior.
> 5. `financiacion-preperfilado` y `permuta-una-pregunta-por-vez`: rojos **por instrumento viejo**,
>    no por conducta — los checks exigen algo que el prompt prohíbe desde v47. Ahí se arregla el
>    CASO, no Franco.
>
> **(entrada previa) 🟡 v105 ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v104 vivo.
> `scripts/precios-no-se-inventan.mjs`. Sesión 2026-08-06.**
> **QUÉ ATACA — EL PRECIO INVENTADO, que es el peor error posible en una demo:** es el único dato
> que el cliente se lleva anotado. En la captura de Agustina: *"Jeep Renegade 2019 — $24.500.000"*
> (real: 2021, $25.500.000). En `capacidad-de-compra-financiada` sobre v104, **3 de 3 corridas**:
> Gol Trend $17.000.000 (real $9.200.000), EcoSport $27.000.000 (real $19.800.000), Onix
> $15.200.000 (real $21.500.000).
> **NO HACE FALTA CASO NUEVO: el rojo ya existe** — `no_inventa_autos` en
> `capacidad-de-compra-financiada`, 3 de 3 sobre v104.
> **POR QUÉ NO VA AL PROMPT:** "no inventes" ya está en `# Regla base: no inventar` —la PRIMERA
> sección— y v95/v96/v97 le sumaron tres reglas más. Sigue pasando. El precio es un dato
> DETERMINÍSTICO que vive en la base: se corrige con código.
> **EL CAMBIO — 2 NODOS, y no toca el prompt:**
> (A) `Leer lead (estado)` → `catalogo_precios`, jsonb con {marca+modelo, año, precio} de todo el
> stock vivo (subconsulta ESCALAR, hermana de `pisos_map`). (B) `Armar respuesta` → antes de
> devolver, en cada RENGLÓN que nombra un auto del catálogo y trae un monto, compara con el precio
> real y lo reemplaza si no coincide.
> **CORRIGE, NO BORRA:** el cliente ya está leyendo esa línea; borrarla le deja un hueco. El número
> corregido deja la respuesta útil y verdadera.
> **ACOTADO AL MISMO RENGLÓN A PROPÓSITO:** un *"$5.000.000 de anticipo"* en otro párrafo no se
> toca, porque no comparte renglón con ningún modelo. **Y LO QUE NO CUBRE, DICHO DERECHO:** si el
> auto NO está en el catálogo (el *"Renault Sandero"* que apareció 2 veces) no hay con qué
> corregir. Eso lo sigue cazando `no_inventa_autos` y se ataca aparte.
> **PRUEBA OFFLINE, sobre el v105 GENERADO: 9/9** — los tres casos medidos, un precio correcto que
> NO se toca, dos renglones a la vez, el anticipo en párrafo aparte intacto, el auto fuera de
> catálogo intacto, y texto sin precios.
> **PRUEBA CONTRA LA BASE:** `catalogo_precios` da **17 autos** y **1 fila por sesión** con una
> `session_id` real y una inexistente (trampa 4). Los tres precios reales coinciden con los de la
> prueba offline. Los 5 invariantes pasan.
> **MEDIR ASÍ:** humo · `--case capacidad-de-compra-financiada --repeat 3 --delay 45000`
> (baseline v104: **0/3**, con `no_inventa_autos` en 3 de 3 — ESO es lo que tiene que desaparecer;
> el gate de km va a seguir rojo y no es de este cambio) · controles:
> `charla-real-reapertura-con-usado`, `financiacion-techo-por-anticipo`, `stock-general-completo`,
> `no-ofrecer-lo-que-no-existe`.
>
> **(entrada previa) 🟢 v104 DESPLEGADO Y MEDIDO: LOS 3 BUGS DE AGUSTINA CERRADOS + EL TECHO. Puntero: v104 vivo.
> Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 15:51:57Z`, 35 nodos, **cero diferencias** con
> `franco-n8n-v104.json`. Y verificado en el VALOR VIVO: `entrega_plata_hist` con
> `msg_anticipo_hist = "7 millones"` devuelve **7000000** (antes tiraba TypeError).
> **MEDICIÓN — ventana 15:52:38–16:09:10, `--delay 45000`:**
>
> | caso | v99 | v103 | **v104** |
> |---|---|---|---|
> | `charla-real-reapertura-con-usado` (los 3 bugs) | 0/3 | 2/3 | **3/3** |
> | `financiacion-techo-por-anticipo` | 0/3 | 0/3 | **3/3** |
> | `financiacion-cuanto-falta` | 3/3 | 3/3 | **3/3** |
> | `financiacion-cuanto-falta-numero-pelado` | 3/3 | 3/3 | **3/3** |
>
> **LOS TRES BUGS, POR TURNO:** el name-ask repetido (turno 12) y el abanico sin pedirlo (turno 10)
> ya estaban en 0 fallas en v103; **la ficha repetida (turno 11) pasó de fallar 3 de 3 en v99 y 1
> de 3 en v103 a 0 de 3 en v104.**
>
> **EL ERROR PROPIO QUE COSTÓ UN CICLO DE DEPLOY ENTERO, Y LA LECCIÓN:** v100 compuso
> `entrega_plata_hist` con los dos parsers existentes y les dejó **una invocación de más**
> (`})()()`), porque la función que extrae el cuerpo de una expresión n8n devuelve algo que YA
> viene invocado. El campo tiraba `TypeError` en cada ejecución, así que el anticipo del historial
> valía 0 y **ni la frase del techo ni el acotamiento del capital podían dispararse**: los dos leen
> ese campo. `financiacion-techo-por-anticipo` siguió 0/3 sobre v103 por eso.
> **EL SQL ESTABA BIEN Y SE VERIFICÓ CONTRA LA BASE** (sesión real `2653c307`, reproduciendo el
> estado exacto del turno 3: `msg_anticipo_hist` = `"7 millones"`). El error estaba UNA CAPA
> DESPUÉS. **REGLA QUE SALE DE ACÁ: todo campo nuevo de Config va con prueba offline, sin
> excepción.** v98 y v99 la tenían (8/8 y 14/14); v100 la saltó y probó sólo el techo de
> `Listar stock` y la frase renderizada — las dos capas que el campo alimenta, ninguna el campo.
> `scripts/arreglar-entrega-plata-hist.mjs` la trae: **12/12**.
>
> **CONTROLES — DOS DE LAS CUATRO CAÍDAS ERAN CONTENCIÓN, NO CONDUCTA.** Re-medidos con
> `--delay 45000` (ventana 15:37:59–15:50:35): `entregar-plata-no-es-permuta` 1/3 → **3/3** y
> `financiacion-techo-50-por-ciento` 2/3 → **3/3**. `no-ofrecer-lo-que-no-existe` 1/3 → **2/3**,
> su marca de v97. **COROLARIO PARA MEDIR: con `--delay 20000` la tanda larga se contamina sola;
> con 45000 no.** En la primera tanda hubo 6 burbujas de fallback del parser y tiempos de 20–35 s
> contra 8–16 s; en la segunda, ninguna.
>
> **EL ÚNICO ROJO: `capacidad-de-compra-financiada` 0/3, Y NO ES REGRESIÓN — MISMA FIRMA
> HISTÓRICA.** La roja del turno 1 es `no matcheó /kil[oó]metr|km/`, o sea **el gate de km que no
> gatea**, que este mismo archivo marca como abierto desde v45 (*"0/5 — NO es regresión. El gate
> leakea 5/5: el turno 1 muestra el abanico sin pedir el km"*) y desde v44 (*"el check de gate de
> km falla porque Franco no gatea"*). Los precios inventados del turno 2 también están descriptos
> ahí como flakiness de presentación del abanico. **DICHO DERECHO: no tengo baseline propia sobre
> v99 para este caso —lo agregué recién, como control de v100—, así que lo que afirmo es que la
> firma es idéntica a la histórica, no que esté probado que estos cambios no lo tocaron.** Mismo
> criterio con que se resolvió `permuta-no-dumpea-abanico-sin-pedirlo` en v96.
>
> **QUEDA ABIERTO, ANOTADO Y NO URGENTE:** el gate de km de `capacidad-de-compra-financiada`
> (abierto desde v45) y la invención de precios al listar el abanico de permuta (el mismo eje que
> "el Etios inventado" de v97). Ninguno de los dos es de esta sesión.
>
> **(entrada previa) 🟡 v100→v103 ARMADOS Y VALIDADOS CONTRA LA BASE, **NO DESPLEGADOS**. Puntero: v99 vivo.
> CUATRO cambios encadenados, un script por cada uno. Sesión 2026-08-06.**
> **POR QUÉ ENCADENADOS Y NO DE A UNO:** Agustina reportó 3 bugs nuevos en una sola charla en vivo
> y pidió los tres arreglados. El deploy es manual, así que se pegan juntos. **LA ATRIBUCIÓN SE
> CONSERVA:** cada versión intermedia existe como archivo (`v100`, `v101`, `v102`, `v103`) y cada
> bug tiene su propio check en el eval, así que si algo se rompe se puede volver a la intermedia.
> **AL PEGAR — 6 NODOS** (desde `workflows/franco-n8n-v103.json`, 35 nodos, `connections` sin
> tocar, los 5 invariantes pasan): `Leer lead (estado)` → Query · `Config` → campo nuevo
> `entrega_plata_hist` (number) · `Listar stock` → Query · `Detalle auto` → Query ·
> `Armar respuesta` → jsCode · `Franco (AI Agent)` → System Message (69.930 → 72.680).
>
> **v100 — EL TECHO SALE DEL ANTICIPO** (`scripts/techo-sale-del-anticipo.mjs`).
> Bug: con $7.000.000 de anticipo y sin usado, Franco ofrecía "hasta unos $60.000.000" y listaba
> una Ranger de $57.000.000. Caso `financiacion-techo-por-anticipo` (84): **0/3 sobre v99**, y las
> 3 rojas importan — no dice $14.000.000, nombra la T-Cross, y **manda cards de Hilux, S10 y
> T-Cross**: la frase sola no alcanzaba.
> Causa (ejecución `12423`, `inputOverride` de `Listar stock`): `precio_objetivo: 60000000` lo puso
> **el modelo** — el valor que el auto TENÍA que tener para financiar 30M, usado como capacidad.
> Fix: `msg_anticipo_hist` en SQL + `entrega_plata_hist` en Config + un CTE `cap` en `Listar stock`
> que acota el capital, y los **11 bloques** de `$fromAI('precio_objetivo')` pasan a
> `(SELECT capital FROM cap)` → **una sola** ocurrencia del `$fromAI` (trampa 3 trivial).
> **ERROR PROPIO QUE CAZÓ LA PRUEBA CONTRA LA BASE, Y VALE ANOTARLO:** primero puse ahí el TECHO
> DEL AUTO (anticipo × 2) y seguían saliendo **7 autos por encima**, hasta la Corolla de
> $24.800.000. `precio_objetivo` **NO es el techo: es el CAPITAL**, y el cálculo de `tramo` YA lo
> multiplica × 2. Se duplicaba: 7M → 14M → 28M. Corregido a **anticipo a secas**; con capital
> $7.000.000 la query devuelve SÓLO Etios $12.500.000, Gol Trend $9.200.000 y Fiesta $8.200.000.
>
> **v101 — NO REPEDIR EL NOMBRE** (`scripts/no-repedir-el-nombre.mjs`). UN nodo: el SM.
> Bug: ya le había dado "Agustina Gimenez Lascano" y se lo volvió a pedir.
> **PRUEBA VINCULANTE (`12618`): `lead_nombre` LLENO, `lead_estado: "Requiere asesor"`,
> `ya_derivado: true`. EL DATO LLEGÓ PERFECTO Y EL MODELO LO IGNORÓ** — no es SQL ni datos.
> Es la TRAMPA 6 en su forma más cruda: el barrido del SM da **27 menciones** del nombre y **al
> menos 8 GUIONES TEXTUALES** que lo piden, contra UNA regla abstracta que dice que no.
> Fix: inyección renderizada en `# Rol` (la primera sección) que anula esos guiones y **da el guion
> de reemplazo con el nombre de pila ya puesto**, más la oración de `# Financiación` reescrita con
> su propio ejemplo. Los guiones viejos NO se borran (para un cliente anónimo siguen siendo los
> correctos) y hay un assert que lo verifica.
> **UN ASSERT CAZÓ QUE MI PROPIA INYECCIÓN REINTRODUCÍA EL GUION PROHIBIDO ESCRITO TEXTUAL** —
> exactamente lo que la trampa 6 dice que no hay que hacer. Ahora lo describe sin escribirlo.
>
> **v102 — SI LA TOOL NO DEVOLVIÓ AUTOS, NO SE LISTAN** (`scripts/cero-filas-no-se-lista.mjs`).
> Bug: tras dar los datos de su usado, Franco dumpeó un abanico de 6 autos sin que se lo pidan.
> **PRUEBA VINCULANTE (`12601`): `Listar stock` devolvió `[{"success": true}]` — CERO FILAS. EL
> GATE DE v85 FUNCIONÓ PERFECTO y Franco listó seis igual**, uno de ellos inventado: "Jeep Renegade
> 2019 — $24.500.000" (el real es 2021 y sale $25.500.000). El modelo llena el vacío (v93, v95).
> Fix en dos capas: (a) `Armar respuesta` descarta los autos si la tool devolvió el centinela —hace
> falta porque Franco puede poner `auto_ids` DE MEMORIA y `Hidratar autos` los trae igual—; (b) el
> guion renderizado con las dos salidas que pidió Agustina (asesor o ver opciones).
>
> **v103 — LA FICHA QUE YA DISTE NO VUELVE** (`scripts/no-repetir-la-ficha.mjs`). UN nodo:
> `Detalle auto` → Query. Es la regla del proyecto aplicada al DATO: si la ficha de ese auto ya se
> dio en esta conversación, la query devuelve un aviso en vez de `ficha_completa` y vacía
> `descripcion`. **Lo que no le llega, no lo puede recitar.** La señal es el CONSUMO
> ("6.5 L/100km"), que sólo aparece cuando se dio la ficha —las listas de stock llevan km y precio—.
> **PROBADO CONTRA LA BASE sobre la charla real:** Cronos y Corolla (fichas ya dadas) → aviso;
> Etios y Hilux (no dadas) → ficha completa normal.
>
> **EL CASO DE EVAL ES LA CHARLA REAL COMPLETA:** `charla-real-reapertura-con-usado` (caso 85, 12
> turnos), **0/3 sobre v99**, con un check por bug: turno 10 `cards_empty` (6 cards, 2 de 3), turno
> 11 `text_not_contains` (**3 de 3**), turno 12 el name-ask (2 de 3).
> **UNA VERSIÓN CORTA DEL CASO DEL NOMBRE MIDIÓ 3/3 VERDE, o sea NO REPRODUCE:** la variable es la
> DISTANCIA más la REAPERTURA del embudo (7 turnos y un embudo nuevo entero en el medio). Mismo eje
> que `financiacion-no-re-ofrece-largo`. Por eso el caso no se puede acortar.
> **MEDIR ASÍ:** humo · `--case charla-real-reapertura-con-usado --repeat 3` (baseline **0/3**) ·
> `--case financiacion-techo-por-anticipo --repeat 3` (baseline **0/3**) · `financiacion-cuanto-falta`
> y `financiacion-cuanto-falta-numero-pelado` (**3/3, no pueden bajar**) · los 6 controles de v98.
> **OJO CON `capacidad-de-compra-financiada`:** es el control natural de v100 (permuta + anticipo) y
> NO estaba en la tanda de controles. Agregarlo.
>
> **(entrada previa) 🟢 v99 DESPLEGADO Y VERIFICADO — SIN MEDIR CON EVALS (se cortó la sesión). Puntero: v99 vivo.
> BUG NUEVO ABIERTO CON PRUEBA VINCULANTE. Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 02:26:01Z`, 35 nodos, **todos los `parameters`
> idénticos a `franco-n8n-v99.json`**, los únicos 3 distintos de v98 son los esperados,
> `connections` iguales.
> **FUNCIONA EN VIVO, VISTO EN LA CAPTURA DE AGUSTINA:** con `"7 millones"` (número PELADO) salió
> *"Con un anticipo de $7.000.000 y queriendo financiar $30.000.000, todavía faltarían
> aproximadamente $23.000.000..."* — el detector del número pelado anda end-to-end.
> **LO QUE FALTA HACER MAÑANA, EN ESTE ORDEN:**
> 1. `--case financiacion-cuanto-falta-numero-pelado --repeat 3 --delay 20000` (**baseline v98:
>    0/3**) · 2. `--case financiacion-cuanto-falta` (**baseline v98: 3/3, no puede bajar**) ·
> 3. los 6 controles de v98. **NO filtrar el output con `tail`** (ver la lección de v98).
>
> **🔴 BUG NUEVO — EL TECHO DE COMPRA LO ELIGE EL MODELO, Y ELIGE MAL. PRUEBA VINCULANTE:
> ejecución `12423`** (sesión REAL `c1afbc8b-54d3-411c-8792-cf2d081a8bd5`, turnos *"Quiero
> financiar 30.000.000"* → *"7 millones"* → *"no tengo usado"*).
> **LO QUE PASÓ:** con $7.000.000 de anticipo y sin usado, Franco dijo *"puedo mostrarte autos
> hasta unos $60.000.000 financiando la mitad"* y listó la **Ford Ranger 2024 de $57.000.000**.
> El techo correcto es **anticipo × 2 = $14.000.000**.
> **LA CAUSA, DEL `inputOverride` DE `Listar stock` (o sea de los `$fromAI`, o sea del MODELO):**
> `precio_objetivo: 60000000`, `con_financiacion: 1`, `tiene_permuta: 0`, `precio_max: 75000000`.
> **Los $60.000.000 son el VALOR DEL AUTO del guion de v92** (*"para financiar $30.000.000 el auto
> tiene que valer al menos $60.000.000"*), que el modelo metió como si fuera la capacidad del
> cliente. La tool hizo lo suyo bien: devolvió las 17 filas con la Ranger en `categoria: "entra"`.
> **DAÑO QUE NO SE VE EN LA CAPTURA:** `Leer lead (estado)` de ese mismo turno ya traía
> `lead_presupuesto: "$60.000.000"` — **el error quedó persistido en `crm_leads`** y vuelve por
> `Config.estado_cliente` todos los turnos siguientes. Mismo daño que documentó
> `financiar-monto-no-es-anticipo` (v86).
> **ES LA REGLA DEL PROYECTO OTRA VEZ:** el techo de compra es **aritmética pura** (`anticipo × 2`)
> y hoy lo elige el modelo al completar `precio_objetivo` con `$fromAI`.
> **OBSTÁCULO YA IDENTIFICADO:** en ese turno el anticipo NO está en `Config` — el mensaje es *"no
> tengo usado"*, así que `entrega_plata` = 0 y `entrega_plata_resp` = 0. **Hace falta persistir el
> anticipo entre turnos** (hermano de `msg_financiar_hist` de v98), emparejando el mensaje del
> cliente con la burbuja de Franco inmediatamente anterior — el `RE_PIDE` de v99 ya sirve.
> **LO QUE PIDIÓ AGUSTINA, TEXTUAL:** *"Perfecto. Con un anticipo de $7.000.000 y sin un usado para
> entregar, podríamos buscar vehículos de hasta aproximadamente $14.000.000, ya que financiamos
> hasta el 50% del valor de la unidad. Si te parece, puedo mostrarte las opciones disponibles
> dentro de ese rango o, si preferís, puedo ponerte en contacto con un asesor para revisar
> alternativas de financiación."* Y explícito: **"no debe mostrar vehículos por encima de ese
> monto"**.
> **DECISIÓN PENDIENTE DE AGUSTINA, Y ES LA PRIMERA PREGUNTA DE MAÑANA:** la frase renderizada sola
> NO alcanza para el "no debe mostrar" — ya se midió en v95 que Franco puede decir un número y
> listar otro. El fix de raíz es **acotar `precio_objetivo` en `Listar stock`**
> (`LEAST(precio_objetivo, anticipo × 2)`), que es tocar un nodo que ningún cambio reciente toca, y
> **con cuidado de la trampa 3** (el `$fromAI` tiene que quedar byte-idéntico). Opciones: (a) las
> dos cosas en una versión, con checks separados para poder atribuir; (b) partirlo en dos y quedar
> a mitad de camino un rato. **NO EMPEZAR SIN ESA RESPUESTA.**
>
> **(entrada previa) 🟡 v99 ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v98 vivo.
> `scripts/anticipo-numero-pelado.mjs`. Sesión 2026-08-06.**
> **QUÉ ATACA:** el anticipo contestado con un **NÚMERO PELADO**. Captura de Agustina **ya sobre
> v98**, sesión REAL `adab421d-4f8e-43c5-9891-dcee41e2ab91`: turno 1 *"Quiero financiar
> 30.000.000"* (Franco responde bien y pide el anticipo), turno 2 *"6 millones"* → *"Perfecto, con
> $6.000.000 de anticipo ya tengo un parámetro... qué auto tenés para entregar como parte de pago?
> Necesito marca, modelo y año."* No dice que faltan $24.000.000 y pide el usado sin el para qué.
> **EL CASO REPRODUCE: `financiacion-cuanto-falta-numero-pelado` (caso 83, la captura tal cual)
> mide 0/3 sobre v98**, ventana 02:08:09–02:09:06, y la única roja es la de los $24.000.000.
> **CAUSA LEÍDA DEL LOG (`12256`), NO SUPUESTA:** `msg_financiar_hist = "Quiero financiar
> 30.000.000"` — **la mitad nueva de v98 funcionó, el minuendo llegó**. Faltó el sustraendo: el
> regex de `entrega_plata` exige un VERBO antes del número. Probado contra la expresión
> DESPLEGADA: `"6 millones"` → **0**, `"entrego 6 millones"` → 6000000.
> **LA SEÑAL QUE LO VUELVE DETERMINÍSTICO:** que la ÚLTIMA burbuja de Franco haya **pedido** el
> anticipo. Hermana exacta de `franco_ofrecio_mostrar` (v85), que existe por la misma razón: un
> dato suelto del cliente sólo significa algo a la luz de lo que se le acababa de preguntar.
> **VALIDADO CONTRA EL CORPUS REAL ANTES DE ESCRIBIRLO:** sobre las **1.136 burbujas de Franco que
> dicen "anticipo"**, el detector marca **375** como pedido y descarta **411** por *anticipo ya
> dado*. Revisadas a mano las dos muestras: las que marca son pedidos; las que descarta piden OTRA
> cosa (el usado, marca/modelo/año, el presupuesto). Los falsos negativos sólo dejan la conducta
> como está hoy; los falsos positivos serían el daño, y por eso el patrón es estrecho.
> **AL PEGAR — 3 NODOS, 3 CAMPOS** (desde `workflows/franco-n8n-v99.json`):
> `Leer lead (estado)` → **Query** · `Config` → **campo nuevo `entrega_plata_resp`** (number) ·
> `Franco (AI Agent)` → **System Message**. 35 nodos, `connections` sin tocar, **los 5 invariantes
> pasan**. SM 66.082 → 66.143 (sólo dos líneas de la inyección). Query 6.881 → 8.474.
> **`entrega_plata` NO SE TOCA** (gate de v88 + `precio_objetivo` de `Listar stock`), mismo
> argumento por el que v98 no tocó `monto_financiar`. El campo nuevo dispara **sólo** si Franco
> pidió el anticipo Y el mensaje es ENTERO un monto: *"6 millones"* sí, *"6 millones y entrego el
> Yaris"* no. La lista negra se **copia** de `entrega_plata`, no se reescribe.
> **EL TECHO DE LA GUARDA SIGUE LEYENDO `entrega_plata` A SECAS, A PROPÓSITO:** esa cuenta existe
> sólo para replicar la guarda de v97, y v97 lee `entrega_plata`. Con el combinado, las dos
> inyecciones dejarían de estar de acuerdo sobre a quién le toca y podrían **callarse las dos**.
> **DEUDA ANOTADA:** v97 tampoco ve el número pelado, así que con *"pickup"* + *"6 millones"* su
> frase no sale. Es la conducta de hoy, no una regresión; se ataca aparte.
> **PRUEBA VINCULANTE CONTRA LA BASE (Supabase por MCP), sobre la conversación REAL de la captura,
> reproduciendo el estado EXACTO del momento del bug (`OFFSET 1` = la burbuja que era la última
> cuando corrió `12256`):** → **true**, sobre *"dale. Y de anticipo, de cuánto pensás poner más o
> menos?"*. Y la burbuja SIGUIENTE (*"Perfecto, con $6.000.000 de anticipo ya tengo un
> parámetro..."*) → **false**: el filtro de *anticipo ya dado* funciona sobre el caso real. Sesión
> inexistente → **false**. La composición con las otras 6 subconsultas corre y da **1 fila por
> sesión** (trampa 4). *Nota: esa corrida de composición usó una versión abreviada de la query —
> la columna nueva va con su texto exacto, pero no es la generada byte a byte.*
> **PRUEBAS OFFLINE, sobre el v99 GENERADO:** detector del número pelado **14/14** (el caso real,
> "millones", "palos", `$6.000.000`, "unos/serían", y los 8 que tienen que dar 0: sin pedido
> previo, "36", "36 cuotas", "100.000 km", con un auto nombrado, "en 24 meses", vacío); la
> inyección renderiza el guion textual con **$24.000.000**; **el camino de v98 sigue dando
> $25.000.000**; y las dos inyecciones **no disparan juntas en ninguna de las 432 combinaciones**.
> **MEDIR ASÍ:** humo, después `--case financiacion-cuanto-falta-numero-pelado --repeat 3
> --delay 20000` (**baseline v98: 0/3**) y `--case financiacion-cuanto-falta` (**baseline v98:
> 3/3, no puede bajar**). Controles: los mismos 6 de v98.
>
> **(entrada previa) 🟢 v98 DESPLEGADO Y MEDIDO: 0/3 → 3/3, CONTROLES 18/18. Puntero: v98 vivo.
> Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 01:54:12Z`, 35 nodos con TODOS los `parameters`
> idénticos a `franco-n8n-v98.json`, y los únicos 3 distintos de v97 son los esperados. SM vivo
> 66.082, arranca con `=`, con la inyección nueva y conservando la de v97.
> **MEDICIÓN — ventana 01:54:55–01:56:07 verificada: 0 ejecuciones en `error` ni `crashed`.**
> `financiacion-cuanto-falta` **0/3 → 3/3**, sin variación entre corridas. Humo 2,5 s (contra 48 s
> y 88 s en v95/v96: no hubo contención). **TEXTO COMPLETO LEÍDO DEL LOG (`12235`), no del volcado
> del eval que trunca:** sale el guion de Agustina **textual**, en UNA burbuja, `auto_ids: []`, sin
> cards, sin imágenes, sin derivación y sin name-ask.
> **CUARTA MEDICIÓN DEL MISMO PRINCIPIO:** la frase ya armada adhiere donde el guion suelto adhiere
> a medias (v86, v90→v92, v97, y ahora v98).
> **CONTROLES: 18/18, ventana 02:09:06–02:19:12** — `financiacion-techo-50-por-ciento`,
> `entregar-plata-no-es-permuta`, `financiacion-no-dumpea-abanico-sin-pedirlo`,
> `financiacion-pide-anticipo`, `financiar-monto-no-es-anticipo` y `no-ofrecer-lo-que-no-existe`,
> **los 6 en 3/3** (este último mejora su 2/3 de v97).
> **UNA TANDA DE CONTROLES ANTERIOR DIO 16/18 Y NO SE PUEDE DECIR CUÁLES DOS:** corrió
> 01:56:41–02:07:10, y Agustina estuvo charlando en vivo con la demo 01:57–01:58, adentro de esa
> ventana. Además el `tail` del comando recortó el detalle. Se repitió limpia y dio 18/18; la
> lección es del instrumento, no del workflow: **no filtrar el output del eval con `tail` cuando
> el resultado es lo que hay que reportar.**
>
> **(entrada previa) 🟡 v98 ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v97 vivo.
> `scripts/cuanto-falta-para-cerrar.mjs`. Sesión 2026-08-06.**
> **QUÉ ATACA:** el BUG NUEVO 3 de la entrada de abajo — Franco no cruza el monto a financiar con
> el anticipo y deriva como si la operación cerrara cuando faltan ~$25.000.000.
> **EL CASO REPRODUCE ANTES DE TOCAR NADA: `financiacion-cuanto-falta` (caso 82, 3 turnos) mide
> 0/3 sobre v97**, ventana 01:44:40–01:45:51 verificada con **0 ejecuciones en `error` ni
> `crashed`**. La única roja es la del número que falta; el turno 2 (la precondición de v92, los
> $60.000.000 y el 50%) sale bien en las 3, así que el rojo mide lo que dice medir.
> **EL TURNO 1 NO NOMBRA CARROCERÍA A PROPÓSITO:** con "pickup" se dispara la inyección de v97
> (piso $32.000.000 > techo $10.000.000) y el turno quedaría midiendo dos frases renderizadas.
> **CAUSA LEÍDA DEL LOG, NO SUPUESTA — ejecución `12220`, nodo `Config`:** `monto_financiar: 0`,
> `entrega_plata: 5000000`, `estado_cliente: "(Todavía no te dio ningún dato.)"`. El $30.000.000
> que el cliente dijo un turno antes **no está en ninguna parte del contexto calculado**: Franco no
> puede restar porque no tiene el minuendo. (El CRM sí lo termina guardando —en la base quedó
> `presupuesto = "$5.000.000 de anticipo, quiere financiar $30.000.000"`— pero escribe DESPUÉS de
> responder, así que llega un turno tarde. Por eso la fuente es `mensajes_demo`, no `crm_leads`.)
> **AL PEGAR — 3 NODOS, 3 CAMPOS** (desde `workflows/franco-n8n-v98.json`):
> `Leer lead (estado)` → **Query** · `Config` → **campo nuevo `monto_financiar_hist`** (number) ·
> `Franco (AI Agent)` → **System Message**. 35 nodos, `connections` sin tocar, **los 5 invariantes
> pasan**. SM 64.372 → 66.082. Query 5.784 → 6.881.
> **(A) `Leer lead (estado)`: una subconsulta ESCALAR más, `msg_financiar_hist`** — el último
> mensaje del CLIENTE que habla de financiar y trae un número. Trae el **TEXTO CRUDO, no el
> número**, a propósito: así el parseo lo hace **una sola implementación** (la de v86) y no quedan
> dos parsers para desincronizar, que es la deuda que v97 dejó anotada entre su CASE de SQL y su
> regex de JS.
> **(B) `Config`: `monto_financiar_hist` DERIVADO por reemplazo** de la expresión de
> `monto_financiar` — el mismo parser, cambiándole la fuente del texto, con una aserción de que la
> diferencia de largo es EXACTAMENTE la del reemplazo. **`monto_financiar` no se toca**: es la
> entrada del gate de v88 y del `precio_objetivo` de `Listar stock`.
> **(C) `Franco (AI Agent)`: la inyección renderizada** con el guion de Agustina TEXTUAL, al
> principio de `# Financiación`, debajo de la de v86/v92.
> **PRIORIDAD, Y ES DELIBERADA: si dispara la inyección de v97, ESTA NO DISPARA.** Dos frases
> textuales en el mismo turno es pedirle al modelo que arbitre, que es justo lo que este proyecto
> ya midió que no funciona. **CONSECUENCIA BUSCADA:** en `entregar-plata-no-es-permuta` (turno 1 =
> "pickup 4x2") manda la de v97, así que ese caso **no cambia de conducta** y su check ancho —que
> prohíbe "parte de pago" en ese turno— **no hay que tocarlo**. Si algún día se quiere que la nueva
> mande también ahí, ese check hay que achicarlo: el guion correcto lo rompe en 3 de sus 6
> alternativas.
> **PRUEBA VINCULANTE CONTRA LA BASE (Supabase por MCP), sobre la query GENERADA COMPLETA, ANTES de
> pegar:** con la `session_id` REAL del caso → `msg_financiar_hist = "Quiero financiar 30.000.000"`
> y las 5 columnas de v95/v97 intactas; con una `session_id` INEXISTENTE → `''`. **1 fila en las
> dos** (trampa 4: las CINCO subconsultas escalares conviven).
> **PRUEBAS OFFLINE, sobre el v98 GENERADO (no una copia):** el parser derivado **8/8** (incluye el
> texto REAL traído de la base, "millones", "palos", el vacío, la negación, "36 cuotas" y dólares);
> la inyección **compila y renderiza el guion entrecomillado TEXTUAL** asertado por regex; **no
> dispara** en 4 casos donde no debe (sin anticipo, sin monto, anticipo que ya cubre la otra mitad,
> resta negativa); y **las dos inyecciones no disparan juntas en ninguna de las 144 combinaciones**
> de carrocería × anticipo × monto a financiar.
> **MEDIR ASÍ:** humo, después `--case financiacion-cuanto-falta --repeat 3 --delay 20000`
> (**baseline v97: 0/3**). Controles: `financiacion-techo-50-por-ciento`,
> `entregar-plata-no-es-permuta`, `financiacion-no-dumpea-abanico-sin-pedirlo`,
> `no-ofrecer-lo-que-no-existe`, `financiacion-pide-anticipo` y `financiar-monto-no-es-anticipo`
> (los dos últimos son los que más cerca pasan del texto nuevo).
>
> **(entrada previa) 🟢 v97 DESPLEGADO Y MEDIDO: EL TURNO 3 SE ARREGLÓ. 3 BUGS NUEVOS DE AGUSTINA ANOTADOS,
> UNO YA CON PRUEBA VINCULANTE. Puntero: v97 vivo. Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 01:22:58Z`, 35 nodos idénticos a
> `franco-n8n-v97.json`, los 3 nodos esperados distintos de v96. En el VIVO: la query de
> `Leer lead (estado)` con `pisos_map` y `carroceria_pedida_hist`, `Config` con
> `carroceria_pedida`, y el SM (64.372) con la inyección y la línea de `# Regla base`.
> **MEDICIÓN — ventana 01:23:52–01:26:30: 0 ejecuciones en `error`. `no-ofrecer-lo-que-no-existe`
> 3/6 → 2/3, y lo que importa: el *"querés que te muestre las pickups…"* pasó de 3 de 6 a
> **0 de 3**.** El render determinístico funcionó donde el guion suelto no alcanzaba.
> **CONFIRMADO EN VIVO** (Config de la ejecución `12187`): `carroceria_pedida: "pickup"`.
> **LO QUE QUEDA DE v97:** el turno 4 inventó *"Toyota Etios 2021 — $8.800.000"* (real:
> $12.500.000). **NO es la regresión de v95** (el piso hatchback es $8.200.000, no $8.800.000):
> es invención al listar, en el turno donde sí muestra. Pendiente.
>
> **BUG NUEVO 1 — REPITE LA FICHA COMPLETA. CAUSA IDENTIFICADA CON EL LOG.**
> Sesión REAL `b6b3ed0c-484e-444d-92e2-83657d697f16`, leída de `mensajes_demo`. Turno 1 (*"Estoy
> buscando una Amarok 2023."*) da la ficha completa de la Amarok 2018 — eso está bien. Turno 2
> (*"2023 no tienen?"*) **repite los mismos 7 datos casi palabra por palabra**.
> **EL CASO DE EVAL `no-repite-la-ficha` (81 casos) NO REPRODUCE: 2/3, y la única roja es OTRO
> check** (no dijo "2018"). **No es un caso malo: es una variable sin identificar — y la
> encontré.**
> **PRUEBA VINCULANTE, ejecución `12186` (turno 2 de Agustina) contra `12202` (turno 2 mío):**
> · `12186`: `Buscar auto` **+ `Detalle auto` CUATRO VECES** (ids 15, 14, 16, 13). Cada llamada
>   devuelve `ficha_completa` entera → la vuelca toda, incluida la del auto que ya había detallado.
> · `12202`: **sólo `Buscar auto`, cero `Detalle auto`** → contestó *"No tenemos Amarok 2023 en
>   stock. La más nueva es una 2018, 4x4 diésel, completa y a $32.000.000."*, que es exactamente
>   la respuesta de UNA línea que pide Agustina.
> **LA VARIABLE ES SI EL TURNO DE SEGUIMIENTO VUELVE A LLAMAR `Detalle auto`.** Si la llama,
> recibe la ficha completa otra vez y la recita; si no, contesta corto. El caso de eval tiene que
> FORZAR esa llamada para reproducir (un turno 2 que pida detalle, o más repeticiones).
>
> **BUG NUEVO 2 — EL EQUIPAMIENTO QUE NO DISTINGUE NADA.** *"aire acondicionado"* está en **17 de
> 17** autos (multimedia 14/17, cámara 11/17, sensores 9/17) y en todo el stock hay **4
> combinaciones distintas**. **Confirmado también del lado de la tool:** en `12186` los CUATRO
> `ficha_completa` traen la misma frase textual *"Equipamiento: aire acondicionado, pantalla
> multimedia, cámara de retroceso, sensores de estacionamiento"*. Sale del campo `content` de
> `autos_disponibles`, que es lo que `Detalle auto` entrega como `ficha_completa`.
> **FIX PROPUESTO (determinístico, en la query de `Detalle auto`):** entregarle el equipamiento
> que SÍ distingue a ese auto, filtrando lo que está en los 17. Lo que no le llega no lo puede
> recitar.
>
> **BUG NUEVO 3 — NO RAZONA CON LOS NÚMEROS QUE YA TIENE (reporte de Agustina, con captura).**
> Cliente: *"Quiero financiar 30.000.000"* → Franco dice bien el guion de v92 (*"el auto tiene que
> valer al menos $60.000.000"*). Cliente: *"5.000.000"* de anticipo → Franco contesta *"Perfecto,
> con $5.000.000 de anticipo y la posibilidad de financiar hasta el 50%, un asesor podrá armarte la
> simulación exacta"* y **deriva como si la operación cerrara**, sin decir que **faltan
> ~$25.000.000** para la otra mitad. Y después pregunta por un usado **sin explicar para qué**, con
> lo que la charla se vuelve cuestionario.
> **LO QUE PIDIÓ AGUSTINA, TEXTUAL:** *"Perfecto. Con un anticipo de $5.000.000 y queriendo
> financiar $30.000.000, todavía faltarían aproximadamente $25.000.000 para completar la otra mitad
> del valor del vehículo. ¿Tenés un auto para entregar como parte de pago? Si es así, decime cuál es
> (marca, modelo y año) y vemos si la operación puede cerrar con esos valores."*
> **ES ARITMÉTICA PURA Y VA RENDERIZADA, igual que v90/v92/v97:** `falta = monto_financiar −
> entrega_plata`. **EL OBSTÁCULO CONOCIDO:** `monto_financiar` se calcula del mensaje de ESE turno,
> así que en el turno del anticipo vale 0. **La solución ya está construida y probada en v97:** una
> subconsulta escalar en `Leer lead (estado)` que saque el último monto a financiar que dijo el
> CLIENTE en `mensajes_demo`, igual que `carroceria_pedida_hist`.
>
> **(entrada previa) 🟡 v97 ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v96 vivo.
> `scripts/render-determinista-carroceria.mjs`. Sesión 2026-08-06.**
> **QUÉ ATACA:** el resto medido de v96 — **3 de 6** turnos 3 cierran con *"Querés que te muestre
> las pickups que entran con ese presupuesto?"* y sin ninguno de los tres números. **Mismo
> diagnóstico que el "50%" en v90→v92, ya probado acá:** pedirle al modelo que TOME dos números de
> una línea de contexto y arme la frase no adhiere; **la frase YA ARMADA sí** (v90 llevó el 50% de
> 1/3 a 3/3). Es además la regla del proyecto: lo determinístico va calculado, no como instrucción.
> **LO QUE FALTABA PARA PODER RENDERIZARLA:** saber **sin preguntarle al modelo** qué carrocería
> pidió el cliente. Tres capas, todas determinísticas y **sin tocar ningún `$fromAI`**: (1) el
> mensaje de ESTE turno, por regex en `Config`, como `pidio_ver`; (2) `lead_vehiculo` del CRM; (3)
> los mensajes anteriores del cliente en `mensajes_demo`, por regex en SQL — porque el pedido
> ("hola, busco una pickup 4x2") suele estar 2 turnos atrás y `Config` sólo ve el mensaje del turno.
> **AL PEGAR — 3 NODOS, 3 CAMPOS** (desde `workflows/franco-n8n-v97.json`):
> `Leer lead (estado)` → **Query** · `Config` → **campo nuevo `carroceria_pedida`** (string) ·
> `Franco (AI Agent)` → **System Message**. 35 nodos, `connections` sin tocar, **los 5 invariantes
> pasan**. SM 62.458 → 64.372.
> **PRUEBA VINCULANTE CONTRA LA BASE, sobre la query GENERADA COMPLETA (Supabase por MCP), y sobre
> una sesión REAL que pidió una pickup:** **1 fila** (trampa 4: las CUATRO subconsultas escalares
> conviven), `pisos_map` = `{"suv":19800000,"sedan":16800000,"pickup":32000000,"hatchback":8200000,
> "utilitario":18500000}`, `carroceria_pedida_hist` = `"pickup"`, y de yapa `lead_vehiculo` =
> `"Pickup 4x2"` (la capa 2 también daba).
> **PRUEBA OFFLINE DEL DETECTOR, extraído del v97 GENERADO (no una copia): 15/15** — incluye
> "camioneta", "chata", "pick-up", el caso REAL medido, el fallback sólo-SQL, que **el mensaje del
> turno le gana al historial**, y 3 negativos que tienen que dar vacío.
> **PRUEBA OFFLINE DE LA INYECCIÓN:** compila, y con pickup + anticipo $5.000.000 renderiza el
> techo $10.000.000, el piso $32.000.000, el anticipo mínimo $16.000.000 y el 50%, con el guion
> **entrecomillado textual** asertado por regex. **Y NO DISPARA** en los 4 casos donde no debe:
> hatchback (que sí entra), pickup con anticipo $20.000.000, sin carrocería, y sin anticipo.
> **LA REGLA ANTI-INVENCIÓN, QUE ES LO PRIMORDIAL, VA EN DOS LUGARES:** la inyección dice
> **"PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: ofrecerle mostrar
> pickups, preguntarle si quiere ver pickups, o llamar pickup a un auto que no lo es. Ofrecer algo
> que no existe es inventar stock."**; y se agrega una línea en **`# Regla base: no inventar`**, la
> PRIMERA sección del prompt: *"OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR, y es la peor forma
> porque el cliente dice que sí y ahí no hay nada."*
> **CUÁNDO DISPARA, Y POR QUÉ NO MÁS ANCHO:** sólo con `entrega_plata > 0` → techo = anticipo × 2.
> `monto_financiar` **no** da un techo (da un PISO: el auto tiene que valer al menos el doble) y
> `lead_presupuesto` es un string que escribe el CRM. Preferí que dispare **siempre bien** en el
> camino medido antes que **a veces mal** en todos; el resto lo cubren las reglas de texto de v95/v96.
> **MEDIR ASÍ:** humo, después `--case no-ofrecer-lo-que-no-existe --repeat 3 --delay 20000`
> (**baseline v96: 3/6**). Controles: los mismos 5 de v96 (4 en 3/3 y
> `permuta-no-dumpea-abanico-sin-pedirlo` en 0/3, que ya venía rojo desde v88 con la misma firma).
>
> **(entrada previa) 🟢 v96 DESPLEGADO Y MEDIDO: LA REGRESIÓN DE v95 ESTÁ CERRADA Y LOS CONTROLES ESTÁN LIMPIOS.
> Puntero: v96 vivo. Queda un resto medido, con el paso siguiente ya identificado.
> Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 00:52:17Z`, 35 nodos idénticos a
> `franco-n8n-v96.json`, y **el único nodo distinto de v95 es `Franco (AI Agent)`**. SM vivo 62.458
> chars, con la regla nueva y **sin el texto viejo** (las dos cosas asertadas contra el vivo).
> **MEDICIÓN — DOS TANDAS, las dos con ventana verificada (00:52:47–00:55:23 y 00:55:56–00:57:35):
> 0 ejecuciones en `error` ni `crashed`.** `no-ofrecer-lo-que-no-existe`: **1/3 + 2/3 = 3/6**.
>
> | | caso | `no_inventa_autos` | fallback del parser |
> |---|---|---|---|
> | v94 | **0/3** | no se disparó | no |
> | v95 | **1/3** | **2 de 3 (regresión)** | no |
> | **v96** | **3/6** | **0 de 6** | 2 de 6, sólo tanda 1 |
>
> **CERRADO:** la regresión de v95 (pegarle el piso de $8.200.000 al Gol Trend) **no volvió en 6
> corridas**, y el etiquetado falso de carrocería del turno 4 tampoco: ahora dice *"mirando
> hatchbacks que te entran para financiar"*, la carrocería REAL.
> **EL FALLBACK DEL PARSER ES INTERMITENTE Y NO ES DEL PROMPT.** `12093`:
> `"Model output doesn't fit required format"`, el `Structured Output Parser` falla **3 veces**
> (3 subRuns del modelo y del parser), 18.049 tokens de entrada y 65 de salida. Apareció **2 veces
> en la tanda 1 y CERO en la tanda 2 con el MISMO systemMessage**, y la tanda 1 corrió pegada a un
> humo que tardó 48 s (contra 9,5 s en v94). Es el patrón de la **trampa 5** (contención /
> límites), no una consecuencia del texto. Se anota; no se persigue ahora.
> **CONTROLES: 12/15, ventana 00:58:04–01:08:22.**
> · `stock-general-completo` **3/3** · `entregar-plata-no-es-permuta` **3/3** ·
>   `financiacion-no-dumpea-abanico-sin-pedirlo` **3/3** · `financiacion-techo-50-por-ciento` **3/3**.
> · `permuta-no-dumpea-abanico-sin-pedirlo` **0/3 — Y NO ES REGRESIÓN, ESTÁ VERIFICADO CONTRA EL
>   HISTORIAL DE ESTE ARCHIVO:** ya medía **0/3 en v88 con la MISMA firma de fallas** (turno 4 TIPO B
>   —nombra 4 autos y no llegan cards— y el check del ofrecimiento del turno 3). Su mejor marca
>   histórica es **1/4, en v85**. Sin baseline propia sobre v94 no se podía afirmar nada: la firma
>   idéntica es lo que lo resuelve.
> **EL RESTO, MEDIDO Y SIN MAQUILLAR:** en **3 de 6** turnos 3 Franco todavía cierra con *"Querés
> que te muestre las pickups que entran con ese presupuesto?"* y no dice ninguno de los tres
> números. **El guion adhiere a veces, no siempre.**
> **EL PASO SIGUIENTE YA ESTABA ESCRITO ANTES DE MEDIR, y la medición lo confirma:** renderizar la
> frase entera desde `Config` (patrón v90, que llevó el "50%" de 1/3 a 3/3) en vez de confiar en que
> el modelo tome los dos números de la línea de pisos. Exige calcular determinísticamente **qué
> carrocería pidió el cliente** — se puede en SQL sobre `mensajes_demo`, en el mismo nodo
> `Leer lead (estado)`, sin tocar ningún `$fromAI`.
>
> **(entrada previa) 🟠 v95 DESPLEGADO Y MEDIDO: 0/3 → 1/3. LAS DOS CAPAS FUNCIONAN, PERO ABRÍ UNA REGRESIÓN.
> v96 preparado y NO desplegado (`scripts/pisos-no-son-precios.mjs`). Puntero: v95 vivo.
> Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte:** `updatedAt 00:31:16Z`, 35 nodos **idénticos** a
> `franco-n8n-v95.json` en todos los `parameters`, y los nodos que cambian respecto de v94 son
> exactamente los 3 esperados (`Config`, `Franco (AI Agent)`, `Leer lead (estado)`).
> **MEDICIÓN — ventana 00:31:58–00:35:00 verificada: 0 ejecuciones en `error` ni `crashed`.**
> `no-ofrecer-lo-que-no-existe` **0/3 → 1/3**. Humo OK (tardó 88 s, anotado).
> **LO QUE FUNCIONA, VISTO EN EL LOG (`12073`):**
> · `Leer lead (estado)` devuelve `pisos_carroceria` con los 5 pisos reales: **la capa A anda
>   end-to-end**, y llega **sin que se llame ninguna herramienta**, que era todo el punto.
> · **El guion adhiere:** *"la pickup más accesible está en $32.000.000. Necesitarías $16.000.000
>   de anticipo, porque financiamos hasta el 50% del valor del vehículo."* En la corrida 3 sale
>   entero y el caso queda **verde**.
> **LA REGRESIÓN, Y ES UN ERROR DE DISEÑO MÍO. PRUEBA VINCULANTE, `12073`:** `Listar stock` **no
> aparece en el runData —no la llamó— y aun así listó** `- Volkswagen Gol Trend 2022 — 30.000 km —
> $8.200.000` y `- Toyota Etios 2019 — 45.000 km — $9.500.000`. **$8.200.000 es el piso del
> Hatchback de MI PROPIA LÍNEA**; el Gol Trend sale $9.200.000. `no_inventa_autos` lo cazó **2 de
> 3**, y sobre v94 ese check **no se disparaba** en este caso: es regresión, no ruido.
> **LA CAUSA, EXACTA:** el bullet que escribí decía *"decile el número Y MOSTRALE IGUAL lo que SÍ le
> entra"* **en el turno donde el gate de v89 le prohíbe llamar la herramienta**. Le pedí listar sin
> darle de dónde sacar los datos y llenó el hueco con el único número a mano — el mío. Es el patrón
> que ya documentó v93 (el modelo llena el vacío), pero **esta vez el vacío lo abrió la línea
> nueva**. Mi propio caso lo delataba: pide `cards_empty` en el turno 3 y el prompt le pedía mostrar.
> **LECCIÓN PARA LA PRÓXIMA:** meter un NÚMERO en el prompt sin el MODELO al lado, en un turno donde
> el modelo no puede consultar la fuente, es fabricar una alucinación. El dato de contexto y el dato
> mostrable tienen que distinguirse en el propio texto.
> **v96 (1 nodo, 1 campo: `Franco (AI Agent)` → System Message), invariantes OK, SM 61.813 → 62.458:**
> · el guion termina **OFRECIENDO** en vez de listando (*"con tu anticipo sí te entran hatchbacks,
>   querés que te los muestre?"*), así deja de chocar con v89: los autos van en el turno siguiente;
> · bullet nuevo con **anti-ejemplo textual de `12073`**: los montos de PISOS DE STOCK son pisos de
>   SEGMENTO, nunca el precio de un auto en una lista, y **sin llamada a la herramienta no se lista**.
> · Aserciones: **un solo nodo** con diferencias; `Leer lead (estado)`, `Config`, `Listar stock`,
>   `Buscar auto` y `Armar respuesta` **byte a byte**; la columna `pisos_carroceria` intacta; los
>   `$fromAI` sin cambios; y **asertado que el texto viejo YA NO ESTÁ**.
> **AL PEGAR:** `Franco (AI Agent)` → System Message. Humo, después
> `--case no-ofrecer-lo-que-no-existe --repeat 3 --delay 20000` (**baseline v95: 1/3**, con
> `no_inventa_autos` en 2 de 3 — eso es lo que tiene que desaparecer). **Recién ahí los controles**,
> que todavía NO se corrieron sobre v95: `entregar-plata-no-es-permuta`,
> `financiacion-no-dumpea-abanico-sin-pedirlo`, `financiacion-techo-50-por-ciento`,
> `permuta-no-dumpea-abanico-sin-pedirlo`, `stock-general-completo`.
>
> **(entrada previa) 🟡 v95 ARMADO Y VALIDADO CONTRA LA BASE, **NO DESPLEGADO**. Puntero: v94 vivo.
> `scripts/no-ofrecer-lo-que-no-existe.mjs`. Sesión 2026-08-06.**
> **AL PEGAR — 3 NODOS, 3 CAMPOS** (desde `workflows/franco-n8n-v95.json`):
> `Leer lead (estado)` → **Query** · `Config` → **campo nuevo `pisos_carroceria`** (string,
> `={{ $('Leer lead (estado)').item.json.pisos_carroceria }}`) · `Franco (AI Agent)` → **System
> Message**. 35 nodos, `connections` sin tocar, **los 5 invariantes pasan sobre v95**.
> **PRUEBA VINCULANTE CONTRA LA BASE REAL, sobre la query GENERADA (Supabase por MCP), ANTES de
> pegar:** con una `session_id` INEXISTENTE devuelve **1 fila** —trampa 4 respetada— y
> `pisos_carroceria` = *"Hatchback desde $8.200.000 (anticipo mínimo $4.100.000) · Sedán desde
> $16.800.000 ($8.400.000) · Utilitario desde $18.500.000 ($9.250.000) · SUV desde $19.800.000
> ($9.900.000) · Pickup desde $32.000.000 ($16.000.000)"*.
> **CAPA A — `Leer lead (estado)`, no la tool.** Una subconsulta **ESCALAR** más, hermana de
> `ya_derivado` y `franco_ofrecio_mostrar`. Va ahí porque ese nodo corre **todos los turnos**, antes
> de `Config` → Franco, **se llame o no una herramienta** — que es justo lo que v93 no cubría
> (`12019`: inventa sin llamar la tool). Sale del stock vivo: nada hardcodeado, sirve en otra
> concesionaria y no se desactualiza.
> **CAPA B — el lenguaje, con guion literal y ANTI-EJEMPLO (trampa 6):** sección nueva
> `## Antes de ofrecer una carrocería`, pegada a `## Enfoque comercial`; el encabezado del abanico
> **reescrito** para que no pueda llevar nombre de carrocería (con el anti-ejemplo exacto de
> `12047`); y la inyección de `entrega_plata` (v87) —la que corre justo en el turno de `12019`—
> manda a mirar la línea de pisos antes de cerrar. `systemMessage` 59.152 → 61.813 chars.
> **ASERCIONES DEL SCRIPT (todas pasan):** exactamente esos 3 nodos con diferencias;
> `Listar stock`, `Buscar auto`, `Armar respuesta` y `Guardar mensajes (historial)` **byte a byte**;
> **el gate de v89 entero**; la cantidad de `$fromAI` **no cambia** (no se le pregunta nada nuevo al
> modelo); `queryReplacement` sigue en forma array; los fixes de v79/v85/v86/v87/v88/v92 intactos;
> y la inyección de `entrega_plata` **compila** y renderiza el texto nuevo con `entrega_plata=5.000.000`
> y **queda vacía** con 0.
> **MEDIR ASÍ, DESPUÉS DE PEGAR:** humo *"qué autos tenés?"* → 17 cards. Después
> `--case no-ofrecer-lo-que-no-existe --repeat 3 --delay 20000` (**baseline v94: 0/3**, y en los 3
> turnos 3 no dice ninguno de los tres números). **CONTROLES obligatorios**, porque el gate de v89 y
> el guion del abanico están en juego: `entregar-plata-no-es-permuta`,
> `financiacion-no-dumpea-abanico-sin-pedirlo`, `financiacion-techo-50-por-ciento`,
> `permuta-no-dumpea-abanico-sin-pedirlo`, `stock-general-completo` (v94: 4/4, 4/4, —, —, ok).
> **LO QUE PUEDE SALIR MAL Y CÓMO SE VE:** si el guion no adhiere, el turno 3 va a seguir sin decir
> los números (mismos 3 checks rojos). El paso siguiente ya está identificado y NO se hizo a
> propósito, para medir uno por vez: **renderizar la frase entera desde `Config`** (patrón v90), lo
> que exige calcular en SQL la carrocería que pidió el cliente. Primero se mide esto.
>
> **(entrada previa) 🔬 "NO OFRECER LO QUE NO EXISTE": CAUSA RAÍZ ENCONTRADA Y MEDIDA. Instrumento listo y
> FALLANDO 0/3. Fix DISEÑADO, NO IMPLEMENTADO. Sesión 2026-08-06.**
> **EL CASO NUEVO YA FALLA PRIMERO, como manda la regla:** `no-ofrecer-lo-que-no-existe`,
> **0/3** (ventana 00:21:45–00:23:22, `search_executions`: 0 en `error`). En los 3 turnos 3
> Franco **nunca** dice $32.000.000, ni $16.000.000, ni el 50%.
> **CHECK NUEVO `carroceria_solo_si_hay`** (no en ALWAYS a propósito: *"querés que te muestre las
> pickups?"* es legítimo sin techo declarado). Rojo si Franco AFIRMA una carrocería y no hay NI UNA
> de esa carrocería en lo que ofrece. Distingue afirmar de negar por construcción: la palabra tiene
> que venir precedida (45 chars) de una frase de ofrecer, y la burbuja no puede tener negación.
> **Probado offline 9/9** contra los textos REALES del log —incluida *"estas pickups 4x2 dentro de
> tu capacidad no hay"*, que es la conducta buena y **no** dispara— y contra el guion nuevo.
> Tabla `CARROCERIA` de los 17, verificada contra Supabase por MCP.
>
> **LAS TRES PRUEBAS VINCULANTES, leídas del LOG (no del volcado):**
> **(1) LA FRASE ES DEL MODELO, NO DEL CÓDIGO — trampa 7 descartada.** Ejecución `12019`,
> `Franco (AI Agent)` devuelve **textual** *"Querés que te muestre las pickups 4x2 que te entran con
> ese presupuesto o preferís ajustar el anticipo?"*. No la agrega `Armar respuesta`.
> **(2) NO LLAMA LA TOOL. `Listar stock` NO APARECE en el runData de `12019`.** 17.904 tokens de
> entrada, 109 de salida, cero tools. **Esto mata cualquier fix del lado de la tool** —el error de
> v93— y obliga a que el dato viaje por el PROMPT.
> **(3) TENER EL DATO NO ALCANZA SI ESTÁ LEJOS DEL GUION.** Ejecución `12047`: la tool **sí** se
> llamó y devolvió **6 filas, cada una con su `carroceria`**: EcoSport (SUV), Kangoo (Utilitario),
> Cronos (Sedán), Etios/Gol Trend/Fiesta (Hatchback). **Cero pickups.** Con esa tabla delante,
> Franco escribió *"tenés este abanico de opciones de pickup 4x2"*. **La `carroceria` estaba en la
> mano y no la miró.**
> **DE DÓNDE SALE ESA FRASE, PALABRA POR PALABRA:** del guion del abanico del propio prompt —
> *"teniendo en cuenta tu anticipo… tenés este abanico"*— que además pide **"DOS autos por bloque,
> de CARROCERÍAS distintas"**. O sea: el guion lo manda a mezclar carrocerías, y él le pega encima
> la etiqueta de lo que pidió el cliente. **Trampa 6 pura: hay que REEMPLAZAR el guion, no
> prohibirle nada arriba.**
> **POR QUÉ NO HAY PICKUPS Y NADIE SE LO DICE:** con `precio_objetivo=10.000.000` y
> `con_financiacion=1`, las 4 pickups quedan `tramo='fuera'` y las borra el filtro final
> `NOT (con_financiacion = 1 AND tramo = 'fuera')`. El prompt **ya tiene** el mecanismo de escape
> para esto (*"Sobre 'fuera': … que aparezcan significa que SÍ EXISTEN opciones que cumplen"*),
> pero **ese mecanismo sólo existe para `categoria`, no para `tramo`**: por la rama de financiación
> las filas se caen **en silencio**.
>
> **EL FIX DISEÑADO — DOS CAPAS, como en v79, y las dos hacen falta:**
> **(A) DETERMINÍSTICA, en `Leer lead (estado)`** (NO en la tool: ver prueba 2). Es el nodo ideal y
> ya está en la cadena principal: corre **todos los turnos**, antes de `Config` → Franco, se llame
> o no una tool. Una **subconsulta ESCALAR** más, igual que `ya_derivado` y `franco_ofrecio_mostrar`
> — no puede cambiar la cantidad de filas (trampa 4), y el nodo ya usa `FROM (SELECT 1) d LEFT JOIN`
> y `queryReplacement` en forma array (trampa 2). **Query ya probada contra la base real por MCP:**
> `Hatchback desde $8.200.000 (anticipo mínimo $4.100.000) · Sedán desde $16.800.000 ($8.400.000) ·
> Utilitario desde $18.500.000 ($9.250.000) · SUV desde $19.800.000 ($9.900.000) · Pickup desde
> $32.000.000 ($16.000.000)`. ~300 chars, sale del stock vivo → **sirve para cualquier
> concesionaria y no se desactualiza** (nada hardcodeado).
> **(B) DE LENGUAJE, con GUION LITERAL** (describir no adhiere: lección del 50%). Guion aprobado por
> Agustina el 2026-08-06: *"La pickup más accesible que tengo es la Amarok a $32.000.000.
> Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del
> vehículo"* — **los dos números y el porqué**. Va con el patrón de inyección condicional que ya
> funciona en v86/v90 (`Config` calcula → el `systemMessage` renderiza la frase ya armada), y
> **pegado al guion del abanico**, no lejos (lección de v87→v88). Y el guion del abanico se
> **reescribe** para que no pueda ponerle nombre de carrocería a una lista que mezcla carrocerías.
> **LO QUE NO SE TOCA:** el gate de v89. El turno 3 sigue **sin mostrar autos** (el cliente está
> dando un dato de plata); ahí va el número. Se muestra en el turno 4, cuando pide.
> **COSA SUELTA VISTA EN `12047`, no es de este fix:** en un embudo de financiación pura, sin
> ningún usado en la conversación, Franco cerró con *"la tasación definitiva de tu usado la hace un
> asesor"*. Se anota, no se arregla acá.
>
> **(entrada previa) 🟢 v94 DESPLEGADO, VERIFICADO Y MEDIDO: EL REVERT FUNCIONÓ. Puntero: v94 vivo.
> Sesión 2026-08-06.**
> **DEPLOY VERIFICADO byte a byte contra `workflows/franco-n8n-v94.json`:** workflow
> `Khct6BjiMNXZK5Oi`, `updatedAt 2026-08-05T23:53:31Z`, **35 nodos, cero diferencias en los
> `parameters` de los 35**. `Listar stock` → Query `df4d3e43…` (9.212) y Description `6c11b7b4…`
> (2.113), **los dos idénticos a v92** y distintos de v93 (`8ea62f21…` / `b39e881e…`): **no queda
> rastro de la centinela**. Los 5 invariantes pasan sobre v94.
> **HUMO OK:** `stock-general-completo` verde en 9,6 s.
> **MEDICIÓN — ventana 23:57:13–00:02:43 verificada con `search_executions`: 0 ejecuciones en
> `error` ni `crashed`. 8/8.**
> · `entregar-plata-no-es-permuta` **4/4** (v92 medía 3/4; v93, 3/4).
> · `financiacion-no-dumpea-abanico-sin-pedirlo` **2/4 → 4/4. Recuperado.** El daño de v93 era
>   exactamente el que se le atribuyó: el turno donde el cliente SÍ pide vuelve a mostrar autos.
> · `no_inventa_autos` **no se disparó en ninguno de los 8**.
> **EL PUNTERO YA APUNTA A v94** (`scripts/state-sync.mjs`), y este bloque se regeneró con él.
> **LO QUE LA CORRIDA DEJA A LA VISTA, Y ES EL PENDIENTE 1 (no un hallazgo nuevo):** en 3 de 4
> corridas de `entregar-plata-no-es-permuta`, turno 3, Franco cierra ofreciendo lo que no existe —
> *"Querés que te muestre las pickups 4x2 que te entran con ese presupuesto?"*. **Verificado contra
> la base en esta sesión: con techo $10.000.000 entran 2 autos, Ford Fiesta $8.200.000 y VW Gol
> Trend $9.200.000, LOS DOS HATCHBACK; pickups, CERO** — la más accesible es la Amarok a
> $32.000.000 (anticipo mínimo $16.000.000).
> **Y HAY UNA SEGUNDA CARA DEL MISMO BUG, MEDIDA ACÁ:** en el turno 4 de
> `financiacion-no-dumpea-abanico-sin-pedirlo`, Franco **etiqueta como "pickup 4x2" autos reales que
> no lo son**: *"tenés este abanico de opciones de pickup 4x2"* seguido de **Gol Trend (hatchback),
> Etios (hatchback) y EcoSport (SUV)**. `no_inventa_autos` NO lo caza —y hace bien: modelo y precio
> son correctos—, pero la carrocería es falsa. **La invención no es sólo de autos: también es de
> categoría.** Otra corrida del mismo turno dice *"estas pickups 4x2 dentro de tu capacidad no
> hay"* y ofrece gama cercana: **ésa es la conducta que pidió Agustina**, y ya sale sola a veces.
>
> **(entrada previa) 🔴 v93 DESPLEGADO Y MEDIDO: NO SIRVE Y HACE DAÑO. SE REVIRTIÓ con v94
> (`scripts/revertir-centinela.mjs`). MI HIPÓTESIS CAUSAL ERA FALSA. Sesión 2026-08-05.
> — al cierre de esa sesión el puntero era v93; el revert se pegó a las 23:53 y está medido arriba.**
> **DEPLOY VERIFICADO byte a byte y HUMO OK** (17 cards, la centinela no se filtra al cliente).
> **MEDICIÓN — ventana 23:35:49–23:41:08 verificada: 0 ejecuciones en `error`.**
> · `entregar-plata-no-es-permuta` **3/4** — **igual que v92. Cero mejora.**
> · `financiacion-no-dumpea-abanico-sin-pedirlo` **4/4 → 2/4. EMPEORÓ.**
> **(1) NO ARREGLA EL BUG, Y LA HIPÓTESIS ERA FALSA.** Yo sostuve que la invención venía del vacío
> que dejaba el gate de v89. **Ejecución `11993` lo desmiente: Franco listó "Volkswagen Saveiro
> 2019 — $9.300.000" y "Fiat Strada 2018 — $8.900.000" —ninguno existe— y `Listar stock` NO APARECE
> EN EL LOG: no la llamó.** La invención **no necesita el vacío de la tool**. (Encima mandó
> `auto_ids: [15, 14]`, Amarok y Ranger: por eso el texto y las 6 imágenes no coincidían.)
> **LA CAUSA REAL:** Franco dice un techo de $10.000.000, el cliente quiere una pickup 4x2, y **no
> hay ninguna en ese rango**. Confabula con o sin tool. **Es exactamente el pendiente "no ofrecer
> lo que no existe"**, que ya tiene decisión de Agustina.
> **(2) HACE DAÑO, MEDIDO — ejecución `12009`, turno 4 (*"dale, mostrame qué autos me entran"*, el
> turno donde SÍ hay que mostrar):** `Listar stock` se llamó 3 veces; las dos primeras (con
> `tiene_permuta: 1`) devolvieron la centinela porque todo quedaba `fuera`, y **la tercera (con
> `tiene_permuta: 0`) SÍ devolvió autos reales** (Gol Trend y Fiesta). **Franco igual no mostró
> nada:** pidió los datos del usado.
> **EL ERROR DE DISEÑO ES MÍO Y ES EL TEXTO DE LA CENTINELA:** dice *"ESTE TURNO NO ES PARA MOSTRAR
> AUTOS"* — una instrucción a nivel **TURNO**. Alcanza con que UNA llamada la devuelva para que
> Franco dé el turno entero por "no mostrar", aunque otra le traiga autos.
> **LO QUE SE PIERDE AL REVERTIR:** cortaba el loop de reintentos (en `11923` la tool se llamó 11
> veces contra el vacío, 23 s). Real, pero mucho menor que dejar sin autos a quien los pidió.
> **SI ALGUIEN RETOMA LA IDEA:** el problema no es la fila centinela, es que su texto habla del
> TURNO. Una que hable sólo de ESA CONSULTA no tendría ese efecto. Pero primero conviene arreglar
> la causa real, porque la invención ocurre igual sin llamar a la tool.
> **v94 verificado:** único nodo con diferencias `Listar stock`, **idéntico a v92 en TODOS los
> `parameters`**, sin rastro de la centinela ni del CTE, los gates de v85 y v89 enteros, `$fromAI`
> sin cambios, los fixes de prompt de v86–v92 intactos, los 5 invariantes pasan.
> **AL PEGAR:** `Listar stock` → **Query** y → **Description** desde `franco-n8n-v94.json`.
> Humo: *"qué autos tenés?"* → 17 cards. Después re-medir
> `entregar-plata-no-es-permuta,financiacion-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000`
> y esperar volver a **3/4 y 4/4** (los números de v92).
>
> **(entrada previa) LO QUE SÍ QUEDA, Y ES LO MÁS VALIOSO: EL INSTRUMENTO.**
> **AHORA HAY SUPABASE POR MCP (project `qfmsdgjtlduravrtqrif`, sólo lectura).** Eso cambió el
> método: este cambio toca SQL, y por primera vez se pudo hacer **prueba vinculante contra los
> datos reales antes de pegar**, en vez de depender del humo.
> **INSTRUMENTO NUEVO EN `evals/run.mjs`, y es lo primero que se hizo (sin él no se puede medir
> ningún fix):**
> · **`no_inventa_autos`** — valida MODELO **y** PRECIO de cada auto ofrecido contra `PRECIOS`,
>   una tabla nueva con los 17 precios reales. **Validar sólo el nombre NO alcanza y está medido:**
>   Franco listó *"Toyota Hilux 2018 — $9.800.000"*, *"Ford Ranger 2019 — $9.700.000"* y
>   *"Volkswagen Amarok 2019 — $9.500.000"* — los tres modelos EXISTEN; lo inventado es el año y el
>   precio. **`PRECIOS` está verificado contra la base**, no transcripto a ojo. ⚠️ Si cambia el
>   stock, se actualiza.
> · **`no_filtra_centinela`** — el precio de introducir la centinela: si alguna vez Franco copia su
>   texto al cliente, se ve en el eval y no en una demo.
> · Los dos corren en **TODOS** los turnos de toda la suite (`ALWAYS`).
> **Probado offline 9/9** contra el texto REAL inventado y contra listados legítimos (stock
> completo y abanico por tramos, que no dan falso positivo).
> **BASELINE DE LA ALUCINACIÓN, ya con el check: 1 de 8 turnos** del camino del vacío
> (ventana 20:50:43–20:56:49, 0 ejecuciones en `error`). `entregar-plata-no-es-permuta` pasa a 3/4 —
> **el caso venía midiendo 3/3 EN LA MISMA CORRIDA donde Franco inventó tres autos**, porque ningún
> check miraba si existían.
> **EL FIX (v93): `Listar stock` devuelve UNA FILA CENTINELA en vez de cero.** `categoria`/`tramo`
> `= 'no_mostrar'`, `id NULL`, y un `titulo` que dice qué hacer. Es la **trampa 4 aplicada a una
> tool**: *nunca devolver el conjunto vacío cuando el vacío se puede confundir con "no hay"*.
> **PRUEBA VINCULANTE CONTRA LA BASE, sobre la query GENERADA y con los parámetros EXACTOS del log
> `11923`:**
> · gate **cerrado**: antes **0 filas** → ahora **1 fila**, la centinela, con `id NULL`.
> · gate **abierto** (`pidio_ver = 1`): **6 autos reales, 0 centinelas**, todos con id.
> **NO ROMPE AGUAS ABAJO:** `Armar respuesta` ya filtra las filas sin `id`, así que la centinela
> **no puede volverse card ni foto**. `precio_num` queda dentro del CTE para ordenar: la salida
> sigue teniendo **las mismas 16 columnas**.
> **Verificado:** un solo nodo con diferencias, `systemMessage` **sin tocar**, los 5 gates enteros,
> **la cantidad de `$fromAI` no cambia (92 → 92)** —no se le pregunta nada nuevo al modelo—, los 5
> invariantes pasan sobre v93.
> **AL PEGAR, MEDIR ASÍ. 1 nodo, 2 campos:** `Listar stock` → **Query** y → **Description**.
> · **Humo:** *"qué autos tenés?"* → tiene que llegar el **stock completo** (17 cards).
> · `--case entregar-plata-no-es-permuta,financiacion-no-dumpea-abanico-sin-pedirlo --repeat 4
>   --delay 25000`. **Baseline: 3/4 y 4/4**, con la invención en 1 de 8 turnos.
> · **Lo que tiene que pasar:** `no_inventa_autos` deja de dispararse, y `no_filtra_centinela`
>   **nunca** se dispara. Si se dispara el segundo, el texto de la centinela se está filtrando.
> · **CONTROLES:** `stock-general-completo`, `rango-14-20`, `capacidad-de-compra-financiada`.
>
> **(entrada previa) EL BUG, Y LO CAUSÉ YO CON EL GATE DE v89.**
> En una corrida de `entregar-plata-no-es-permuta` (medición de v92), Franco listó:
> `- Nissan Frontier 2016 — 110.000 km — $9.800.000` · `- Ford Ranger 2017 — 120.000 km —
> $9.200.000` · `- Volkswagen Ama…`
> **NINGUNO EXISTE.** El stock tiene 17 autos, **no hay ni un Nissan**, y la única Ranger es una
> **2024 de $57.000.000**. Los tres inventados caen convenientemente **debajo del techo de
> $10.000.000** que él mismo acababa de decir.
> **PRUEBA VINCULANTE — ejecución `11923`, el mismo turno:**
> `Listar stock` ← `precio_objetivo: 10000000`, `con_financiacion: 1`, `tiene_permuta: 0`
> → `[{"success": true}]`, **CERO FILAS**… **ONCE VECES SEGUIDAS**. 23 segundos, 12 llamadas al
> modelo, y termina contestando sin listar. En otra corrida, con el mismo vacío, **inventó**.
> **LAS 0 FILAS SON MI GATE DE v89** (`(monto_financiar > 0 OR entrega_plata > 0) AND
> pidio_ver = 0`): en ese turno `entrega_plata = 5.000.000` y `pidio_ver = 0`, así que bloquea —
> **que es lo que le pedí**. Pero el gate **deja un VACÍO, y el modelo lo llena**.
> **ANTES DE v89 ESTO NO PASABA:** la tool devolvía las 17 filas. No había invención, había dump.
> **Cambié un bug por otro peor.** El dump se ve feo; inventar stock delante de un dueño es fatal.
> **DOS DAÑOS, no uno:**
> · **11 reintentos de la tool en un solo turno** — latencia y tokens al pedo, y roza la **trampa 5**
>   (los 30.000 TPM). El `toolDescription` de v89 evita que diga "no hay stock", pero **no evita que
>   reintente ni que invente**.
> · **Alucinación de inventario**, que viola `# Regla base: no inventar`, la primera del prompt.
> **EL FIX, IDENTIFICADO Y NO IMPLEMENTADO: que el gate devuelva UNA FILA CENTINELA en vez de
> cero** — una fila cuyo contenido diga "este turno no es de mostrar autos, seguí el embudo". Corta
> el loop de reintentos **y** elimina el vacío que el modelo rellena. Es el principio de la
> **trampa 4** aplicado a una tool: *nunca devolver el conjunto vacío cuando el vacío se puede
> confundir con "no hay"*.
> **EL INSTRUMENTO NO LO CAZA, Y HAY QUE ARREGLARLO:** `entregar-plata-no-es-permuta` midió **3/3
> en la misma corrida donde Franco inventó tres autos**, porque sus checks no miran si los autos
> nombrados EXISTEN. **Hace falta un check nuevo** que valide los modelos nombrados contra el
> catálogo real (el runner ya tiene la constante `CATALOGO`): si nombra un auto que no está, es rojo.
> **Vale para toda la suite, no sólo para este caso.**
> **SI HAY UNA DEMO ANTES DEL FIX:** el camino que lo dispara es *pide una pickup → declara que
> quiere financiar → da un anticipo chico*. Revertir el gate de v89 (dejar `Listar stock` como en
> v88) devuelve el dump del abanico pero **elimina la invención**. Es una decisión de Agustina.

> **v90 DESPLEGADO Y MEDIDO: FUNCIONA. 0/4 → 3/4. Puntero: v90 vivo.
> v91 preparado y NO desplegado (corrige una regresión MÍA de v90). Sesión 2026-08-05.**
> **DEPLOY VERIFICADO byte a byte, y esta vez las cuentas se renderizaron DESDE EL VIVO:**
> `systemMessage` 59.225, financiar 30.000.000 → dice **$60.000.000**, anticipo 5.000.000 → dice
> **$10.000.000**, y con los campos en 0 las dos inyecciones **desaparecen**. `Listar stock`, el CRM
> y los 4 campos de `Config` sin tocar; único nodo distinto de v89 `Franco (AI Agent)`.
> **MEDICIÓN — ventana 19:56:57–19:59:07 verificada: 0 ejecuciones en `error`. 0/4 → 3/4.**
> La conducta pedida está: *"Perfecto, con $5.000.000 de anticipo seguimos. Con eso se puede
> financiar hasta otro tanto, así que el techo sería un auto de $10.000.000."* Una corrida hasta
> ofrece las dos salidas: *"…o preferís **ajustar el anticipo**?"*.
> **LA ROJA, SIN MAQUILLAR:** en 1 de 4 el turno 2 dijo los **$60.000.000** pero **no dijo "el
> 50%"** — falla sólo ese check, no el del monto. **NO se aflojó el check:** el "50%" es el porqué,
> y sin él la cifra suena arbitraria. Es lo que pidió Agustina, y queda como resto medido.
> **CONTROLES: 11/12, ventana 19:59:42–20:07:18 verificada: 0 ejecuciones en `error`.**
> `faq-financiacion-maximo` **3/3**, `financiar-monto-no-es-anticipo` **3/3** (v86 intacto),
> `financiacion-no-dumpea-abanico-sin-pedirlo` **3/3** (v89 intacto).
> **`entregar-plata-no-es-permuta` 2/3 contra 4/4 en v88 — Y LA REGRESIÓN ES MÍA.** La frase que
> escribí en el gate de v90 dice *"con ese anticipo **y sin usado** se puede financiar…"* y Franco
> la repite (*"Con ese anticipo y sin entregar un usado…"*). **No vuelve el bug original** —no abre
> la permuta ni pide marca/modelo/año— pero **le mete la palabra "usado" a un cliente que nunca
> mencionó ninguno**, que es justo lo que v87 y v88 sacaron.
>
> **`scripts/no-nombrar-el-usado-inexistente.mjs` (v90→v91) — preparado, NO desplegado. 1 NODO,
> 1 FRASE:** se saca *"y sin usado"* del guion. **Es redundante, no sólo riesgosa:** el gate SÓLO
> dispara cuando `entrega_plata > 0`, y ese cálculo ya exige que no haya vehículo en el mensaje Y
> que `lead_entrega` no sea "Sí". **La ausencia de usado está garantizada por la condición del
> gate**, así que el factor ×2 sigue siendo correcto sin decirla.
> **Verificado:** un solo nodo, `systemMessage` 59.225 → 59.213 (−12 chars, exactamente la frase),
> `## Permuta` y `# Financiación` intactos, `Listar stock` intacto, los fixes de v85–v88 presentes,
> el gate compila y sigue dando **$10.000.000**, y **en el texto renderizado no queda ninguna
> mención copiable de "usado"** fuera de la lista de frases prohibidas. Los 5 invariantes pasan.
> **AL PEGAR, MEDIR ASÍ. 1 campo:** `Franco (AI Agent)` → **System Message**.
> · `--case entregar-plata-no-es-permuta --repeat 4 --delay 25000`. **Baseline v90: 2/3** (v88: 4/4).
> · **CONTROLES:** `financiacion-techo-50-por-ciento` (que no se pierda la cuenta de v90, **3/4**) y
>   `financiar-monto-no-es-anticipo`.

> **v92 DESPLEGADO Y MEDIDO: FUNCIONA. 1/3 → 3/3, y los dos controles 3/3. Puntero: v92 vivo.**
> **DEPLOY VERIFICADO byte a byte**, con la frase **renderizada desde el vivo**: `systemMessage`
> 59.152, `## Permuta` y `Listar stock` y el CRM sin tocar, el guion del anticipo de v86 intacto, y
> ya no está la instrucción vieja que invitaba a resumir.
> **MEDICIÓN — ventana 20:35:59–20:41:57 verificada: 0 ejecuciones en `error`. 9/9:**
> `financiacion-techo-50-por-ciento` **1/3 → 3/3** · `financiar-monto-no-es-anticipo` **3/3** ·
> `entregar-plata-no-es-permuta` **3/3**.
> Las 3 corridas dan la frase completa: *"Tené en cuenta que financiamos hasta el 50% del valor del
> vehículo, así que para financiar $30.000.000 el auto tiene que valer al menos $60.000.000…"* +
> *"Dale. Y de anticipo, de cuánto pensás poner más o menos?"*.
> **LO QUE CONFIRMA, y es la lección repetida de la sesión:** el "50%" se caía porque yo **describía**
> la frase (*"decíselo en UNA oración natural, sin recitar la regla como un reglamento"* — una
> invitación explícita a podar justo lo que se podaba). Con el **guion textual** y el porcentaje
> ADENTRO del entrecomillado, pasa de 1/3 a 3/3. **Describir no alcanza; el guion literal adhiere.**
> **⚠️ EL VERDE TAPA ALGO GRAVE:** en esa misma tanda Franco **inventó tres pickups**. Ver la
> entrada de arriba — el eval salió 3/3 igual porque **ningún check mira si los autos existen**.

> **v91 DESPLEGADO Y MEDIDO: ARREGLA MI REGRESIÓN. Puntero: v91 vivo. Sesión 2026-08-05.**
> **DEPLOY VERIFICADO byte a byte:** `systemMessage` 59.213, la frase *"y sin usado"* ya no está,
> `## Permuta` y `# Financiación` byte a byte contra v90, `Listar stock` y el CRM sin tocar, y
> **renderizado desde el vivo**: el gate sigue diciendo **$10.000.000**, `# Financiación` sigue
> diciendo **$60.000.000**, y en el guion queda **1 sola** mención de "usado" (la del cierre, no
> copiable).
> **MEDICIÓN — ventana 20:11:38–20:18:00 verificada: 0 ejecuciones en `error`.**
> · **`entregar-plata-no-es-permuta` 2/3 → 3/3.** La regresión que metí en v90 está cerrada.
> · `financiar-monto-no-es-anticipo` **3/3**.
> · **`financiacion-techo-50-por-ciento` 3/4 (v90) → 1/3, y hay que leerlo bien:** las 2 rojas
>   fallan **SÓLO el check del "50%"**; el de los **$60.000.000 pasa siempre**. **v91 es inerte en
>   ese turno** (sólo tocó el gate de `## Permuta`; `# Financiación` quedó byte a byte, asertado).
>   **Lo que esto mide es que la mención del "50%" es INESTABLE**, no que v91 la rompiera.
> **CAUSA IDENTIFICADA, PARA v92:** en la inyección **describo** lo que tiene que decir
> (*"decíselo en UNA oración natural"*) en vez de **darle la frase literal**. Trampa 6: el guion
> textual es lo que adhiere. **v92 = un campo**, pasar esa descripción a guion entre comillas con
> el "50%" adentro. **Instrumento ya existe y ya falla: `financiacion-techo-50-por-ciento`, 1/3.**

> **FRONTEND (2026-08-05): GUARDADO AUTOMÁTICO + SE ELIMINÓ EL BOTÓN "GUARDAR". Pedido de Agustina.**
> Toda conversación queda registrada sola. `useChat.js` llama a `saveSession` **una vez por sesión**,
> después del primer intercambio real (recién ahí existe del lado del backend), **fire-and-forget**:
> si falla no rompe el chat y se reintenta en el mensaje siguiente (el id se saca del `Set`).
> `ChatHeader` pierde el botón y el `sessionId`; `ChatTab` deja de desestructurarlo (App lo sigue
> pasando por el spread). **NO se tocó el contrato de datos ni n8n.**
> **VERIFICADO EN LA APP CORRIENDO** (build de prod en `localhost:10000`, no sólo por lectura):
> · `POST /api/franco → 200` seguido de `POST /api/session-save → 200`, **sin apretar nada**;
> · **segundo mensaje: 2 `/api/franco` y UN SOLO `/api/session-save`** — el guard no spamea;
> · la conversación aparece arriba de todo en Historial con el badge "Activa";
> · `oxlint` limpio y **0 errores de consola**.
>
> **PEDIDO PENDIENTE — MARCAR LOS AUDIOS EN EL HISTORIAL. NECESITA BACKEND, NO ES SÓLO UI.**
> El código del front dice textual: *"Transcribimos TODO el audio acá … **n8n nunca ve audio**"*.
> Al webhook le llega texto común, así que **el dato no existe** en `mensajes_demo`, que es de donde
> lee el Historial. **El frontend no lo puede resolver solo.** Hay que hacer viajar el flag:
> `frontend → /webhook/franco-chat → Guardar mensajes (historial) → mensajes_demo`. **Es un cambio
> de contrato: se coordina, no se compensa en la UI.**
> **SINERGIA:** el nodo a tocar es `Guardar mensajes (historial)` — **el mismo** que necesita el fix
> del pedido pendiente. Conviene hacer los dos juntos y no tocar dos veces un `INSERT` que es
> territorio de la **trampa 2**. Lo que se guarda es la TRANSCRIPCIÓN, así que el Historial mostraría
> el texto con la marca de audio al lado (buscable y legible).

> **BUG ABIERTO NUEVO (2026-08-05): OFRECE MOSTRAR ALGO QUE NO EXISTE. Lo destapó v90, no lo causó.**
> Con el techo ya dicho bien, Franco cierra con *"Querés que te muestre **pickups 4x2 hasta
> $10.000.000**?"*. **No hay ninguna.** Verificado contra el stock real (humo de v89, 17 cards):
> · en $10.000.000 entran **2 autos**, Ford Fiesta 2017 ($8.200.000) y VW Gol Trend 2018
>   ($9.200.000), **los dos hatchback**;
> · **pickups que entran: CERO**. La más accesible es la **VW Amarok 2018 a $32.000.000**, o sea
>   que para una pickup el anticipo mínimo es **$16.000.000**.
> **NO ES UN AJUSTE DE v90:** v90 hace lo suyo (0/4 → 3/4, la cuenta sale bien). Antes Franco nunca
> decía el techo, así que el problema **no podía aparecer**. Va como bug propio, con su eval.
> **LA PARTE DETERMINÍSTICA, que es lo que lo hace atacable:** el precio mínimo del stock para lo
> que el cliente pidió sale de una query, y el anticipo mínimo es ese precio / 2. Nada que adivinar.
> **DECISIÓN DE AGUSTINA:** cuando lo que pidió **no le entra**, se le **muestra igual lo que sí le
> entra** (acá los dos hatchback), junto con el número que le falta para llegar a lo que quería.

> **DECISIÓN DE AGUSTINA (2026-08-05) — ALCANCE DE v85, PRECISADO. Vale para el cambio del pedido
> pendiente y para cualquier cosa que toque el abanico. NO RE-INTERPRETAR.**
> **(a) Si el cliente PIDIÓ opciones, Franco tiene que TERMINAR DE CONTESTARLE.** Si le falta un
> dato para calcular (los km del usado, el anticipo), lo pide — y **cuando lo tiene, muestra las
> opciones**. NO vuelve a preguntar *"querés que te muestre?"*: eso es hacerle repetir un pedido que
> ya hizo. **Esto corrige una lectura mía equivocada:** yo había dado por bueno que
> `capacidad-de-compra-financiada` estaba desactualizado porque Franco ofrecía en vez de mostrar.
> **No lo está: el caso mide bien y Franco se equivoca.** v85 se aplica al cliente que está DANDO
> datos o haciendo preguntas puntuales sin haber pedido opciones — no al que pidió.
> **(b) Una vez que pidió, se le mostró, y EMPIEZA A INTERESARSE POR UNO O MÁS MODELOS: no se le
> ofrece nada más salvo que lo pida.** A lo sumo se le PREGUNTA si quiere ver otras opciones. El
> abanico no vuelve solo. *"Siempre con un hilo coherente de conversación."*
> **CONSECUENCIA DE DISEÑO, ya medida:** un flag "pidió" PEGAJOSO a lo bruto **rompe 2 casos**
> (`detalle-un-auto-fotos` y `financiacion-no-dumpea-abanico-sin-pedirlo`, donde el turno 1 SÍ pide).
> La forma que sale bien de (a) y (b) a la vez es **"pidió y todavía no se le mostró"**: el flag se
> apaga apenas Franco manda cards o fotos. Con esa regla los 2 conflictos desaparecen solos.

> **v88 DESPLEGADO Y MEDIDO: FUNCIONA. 0/4 → 4/4. Puntero: v88 vivo.
> EL ABANICO POR LA RAMA DE FINANCIACIÓN — preparado (v89), NO desplegado. Sesión 2026-08-05.**
> **v88 — DEPLOY VERIFICADO byte a byte:** `systemMessage` 57.967, el gate en el vivo, **el CUERPO
> de `## Permuta` byte a byte igual que en v87**, `# Financiación` intacto, los 4 campos de `Config`
> intactos, el CRM sin tocar, único nodo distinto de v87 `Franco (AI Agent)`.
> **MEDICIÓN — ventana 18:48:02–18:50:23 verificada: 0 ejecuciones en `error`. 0/4 → 4/4.**
> Las 4 corridas arrancan con el guion del gate (*"Perfecto, con $5.000.000 de anticipo seguimos"*)
> y **ninguna** nombra un usado, una permuta ni pide marca/modelo/año. La corrida 4 es la ideal:
> vuelve al embudo (*"…Tenés en mente cuántas cuotas te gustaría para financiar ese saldo?"*).
> **LO QUE CONFIRMA:** el hecho tenía que estar **donde vive el guion**. Mismo dato, misma
> redacción, otro lugar: 0/4 → 4/4. Es trampa 6 en su forma más limpia que se haya medido acá.
> **CONTROLES DE PERMUTA: 6/12, ventana 18:50:49–19:00:43 verificada: 0 ejecuciones en `error`.**
> · `permuta-una-pregunta-por-vez` **3/3** (venía 2/3) · `financiar-monto-no-es-anticipo` **3/3**
>   → **v86 intacto.**
> · `permuta-mas-efectivo` **0/3**, igual que su baseline **0/3 a propósito**: falla por `media_min`
>   con 0 cards y 0 imágenes, la falla real que la sesión pasada decidió no tapar. Sin cambio.
> · `permuta-no-dumpea-abanico-sin-pedirlo` **0/3** contra **1/4** en v85. El turno 4 falla 3/3 por
>   **TIPO B** (nombra 4 autos, no llegan cards — instrumento ya documentado para ese caso). **El
>   turno 3 falla 3/3 en el check del ofrecimiento, y en v85 pasaba 2 de 4: lo marco, no lo barro.**
> **NINGUNA REGRESIÓN ES ATRIBUIBLE A v87/v88, Y ESTÁ PROBADO:** se corrieron las expresiones
> desplegadas sobre cada turno de los 3 casos de permuta y **`entrega_plata` y `monto_financiar` dan
> 0 en TODOS**, así que las dos inyecciones renderizan vacío. Son inertes ahí por construcción.
>
> **`scripts/abanico-financiacion-solo-si-lo-piden.mjs` (v88→v89) — preparado, NO desplegado.
> UN SOLO NODO: `Listar stock` (Query + Description).**
> **PRUEBA VINCULANTE — ejecución `11621`:** `Listar stock` ← `tiene_permuta: 0`,
> `con_financiacion: 1`, `precio_objetivo: 30000000` → **17 filas, el catálogo entero**. El gate de
> v85 es `NOT (tiene_permuta = 1 AND pidio_ver = 0)`: con `tiene_permuta = 0` **ni se activa**. Es
> el MISMO bug que v85 cerró, por la rama que el gate no cubre. Con 17 filas en la mano, 3 de 4
> corridas de v88 las listaron sin que se las pidan.
> **Eval nuevo `financiacion-no-dumpea-abanico-sin-pedirlo` (77 → 78 casos). BASELINE sobre v88
> (`--repeat 4 --delay 25000`, ventana 19:01:45–19:04:25 verificada con 0 ejecuciones en `error`):
> 2/4** — el bug es intermitente, igual que el de permuta (v82 1/3, v83 2/4). **El turno 4 pasa 4/4
> ya en el baseline**, o sea que el "riesgo opuesto" arranca desde verde y cualquier rojo ahí
> después del fix es del gate.
> **EL ANÁLISIS QUE CAMBIÓ EL DISEÑO — BARRIDO SOBRE LOS 177 TURNOS DE LOS 78 CASOS.** Extender el
> gate a `con_financiacion = 1` era lo obvio y **está medido que NO sirve: dejaría sin autos a 8
> turnos que sí tienen que mostrarlos** (*"tenés algo entre 14 y 20 millones?"*, *"Quiero un auto de
> 20 millones o menos"*, *"hola, tengo 18 millones para un auto"*…). **La causa: `pidio_ver` tiene
> falsos negativos en los mensajes de PRESUPUESTO.** En v85 eso era inocuo —el default deseado era
> preguntar— y acá sería **catálogo vacío para alguien que claramente pidió**. Y encima
> `con_financiacion` lo declara el MODELO, que es la familia descartada por medición en v83/v84.
> **EL GATE QUE SÍ PASA EL BARRIDO** se condiciona a los campos CALCULADOS de v86 y v87:
> `AND NOT ((monto_financiar > 0 OR entrega_plata > 0) AND pidio_ver = 0)`.
> Sobre los 181 turnos **bloquea 5, y CERO de los 18 que exigen material gráfico**.
> **EL BARRIDO CORRE DENTRO DEL SCRIPT, NO AL LADO:** si algún día alguien agrega un eval que este
> gate rompería, el script **no genera el workflow**. Es la aserción más útil de todo el cambio.
> **DEBILIDAD CONOCIDA, MEDIDA Y NO TAPADA:** *"entrego 5 millones, cuáles me entran?"* da
> `pidio_ver = 0` (falso negativo del patrón de v85) y quedaría bloqueado **aunque el cliente pidió**.
> El síntoma sería que Franco **PREGUNTA en vez de mostrar**, no que diga "no hay stock" — el
> `toolDescription` explica la señal de 0 filas desde v84, y este cambio le suma la nota gemela.
> **NO SE TOCA `pidio_ver`:** su corpus de validación son 152 mensajes que **no quedaron en el
> repo**, así que no se puede re-validar y modificarlo a ciegas arriesga sus 0 falsos positivos.
> **Verificado:** **un solo nodo con diferencias**, `systemMessage` **sin tocar** (el enforcement es
> duro, no de lenguaje — lo que funcionó en v85 y no en v83), el gate de v85 intacto, la query
> 8.519 → 9.212 chars terminando en su `ORDER BY`, **la cantidad de `$fromAI` NO cambia (92 → 92)**
> o sea que el gate nuevo **no le pregunta nada al modelo**, trampas 2 y 3 sobre todo el workflow,
> los 5 invariantes pasan sobre v89.
> **AL PEGAR, MEDIR ASÍ. 1 nodo, 2 campos:** `Listar stock` → **Query** y → **Description**.
> · **HUMO, Y ACÁ EL CRITERIO ES DISTINTO:** `Listar stock` **no** está en la cadena principal, así
>   que un error no deja al cliente sin respuesta; lo que puede pasar es que la tool devuelva **0
>   filas SIEMPRE**. Humo: *"qué autos tenés?"* → tiene que llegar el **stock completo**.
> · `--case financiacion-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000`. **Baseline: 2/4.**
>   **Cómo leerlo:** el **turno 3** tiene que quedar **sin autos** y el **turno 4 SÍ** tiene que
>   traerlos. Si el turno 4 queda vacío, el gate se pasó de estricto y se revierte.
> · **CONTROLES** (el riesgo es dejar sin autos a quien sí pidió): `stock-general-completo`,
>   `rango-14-20`, `presupuesto-aproximado`, `capacidad-de-compra-financiada` y
>   `financiar-monto-no-es-anticipo`.
> · **`search_executions` EN CADA TANDA.**
> **BUG QUE SIGUE ABIERTO Y SE VE EN ESTE MISMO BASELINE (no se toca acá):** una corrida encabeza
> *"Teniendo en cuenta **$30.000.000 de presupuesto**, $5.000.000 de anticipo y financiación hasta
> el 50%"* y llega a ofrecer la Ranger de $57M. Es la **incoherencia del 50%** que reportó Agustina:
> Franco le pasa el monto A FINANCIAR como `precio_objetivo`, así que la tool calcula capacidad
> 30M × 2 = 60M. El dato correcto sería el anticipo (5M → techo 10M). **Es el bug siguiente, y v86
> y v87 ya dejaron los dos montos separados y calculados para poder atacarlo.**

> **v87 DESPLEGADO Y MEDIDO: EL FIX QUEDÓ PARTIDO EN DOS. El CRM sí, el texto de Franco no. 0/4.
> Puntero: v87 vivo. v88 preparado y NO desplegado. Sesión 2026-08-05. Sin pushear a git.**
> **DEPLOY VERIFICADO byte a byte:** 35 nodos, `active`, `entrega_plata` (1.575 chars, number),
> **`monto_financiar`, `pidio_ver` y `estado_cliente` intactos**, `systemMessage` 56.922,
> **`## Permuta` y `# Financiación` byte a byte**, 0 nodos con diferencias fuera de los 3.
> **HUMO:** HTTP 200, stock completo, sin fallback. `Leer lead (estado)` devuelve **1 fila**
> (trampa 4 ✓) con `lead_entrega` —la dependencia nueva de la expresión—, y la cadena completó.
> **MEDICIÓN — ventana 18:34:13–18:36:52 verificada: 0 ejecuciones en `error`. `--repeat 4
> --delay 25000` → 0/4.** El caso NO pasa, y lo digo antes que nada.
> **LO QUE SÍ FUNCIONÓ, Y ES LA MITAD QUE ENVENENABA LA CHARLA — EL CRM, 4/4:** en `11593`,
> `11601` y `11605`, `Guardar lead` escribe **`entrega: "No mencionado"` y
> `descripcion_usado: "No mencionado"`**; una hasta resume *"sin usado en parte de pago"*. Antes
> escribía `entrega: "Sí"` + el usado fantasma. **La permuta fantasma ya no se persiste**, así que
> Franco deja de quedar encerrado en ella para el resto de la conversación.
> **LO QUE NO — EL TEXTO DE FRANCO.** Las 4 corridas toman bien los $5.000.000 como anticipo
> (*"tu anticipo de $5.000.000"*), pero:
> · **`11605` abre la permuta entera:** *"con esto más tu usado… contame qué pickup 4x2 entregás
>   como parte de pago (marca, modelo y año)"*. **El bug intacto.**
> · **`11593` y `11601`** no piden el auto, pero recitan el guion de tasación igual: *"la tasación
>   definitiva de tu financiación la hace un asesor"*, que **no significa nada**. Residuo.
> **CORRECCIÓN QUE ME HAGO: al leer el volcado TRUNCADO del runner dije que ninguna pedía
> marca/modelo/año. Era falso** — `11605` lo hace textual. **El volcado del eval trunca; el log no.
> Leer el log ANTES de describir la conducta, no después.**
> **POR QUÉ FALLÓ, Y ES DIAGNOSTICABLE:** el hecho quedó en `# Lo que ya sabés de este cliente`,
> **lejos del guion que lo contradice**. `## Permuta` son 27.573 chars de guiones concretos y
> **trampa 6 dice que el ejemplo concreto le gana a la regla abstracta POR MÁS VERDADERA QUE SEA**.
> Es la lección de v83 otra vez: gatear una cosa y dejar el guion en pie no alcanza.
> **v87 NO SE REVIERTE:** la mitad del CRM funciona y medida, y `Config.entrega_plata` se reusa tal
> cual en v88. Sólo falta mover el hecho de lugar.
> **APARECIÓ OTRA COSA, ANOTADA Y NO TOCADA:** **2 de 4 dumpean el abanico de autos sin que se lo
> pidan** (`11593`, `11601`). Es el bug de v85 **por la rama SIN permuta**: el gate de
> `Listar stock` sólo aplica con `tiene_permuta = 1`. Caso aparte, no se toca acá.
>
> **`scripts/entregar-plata-gate-en-permuta.mjs` (v87→v88) — preparado, NO desplegado. UN SOLO
> NODO: `Franco (AI Agent)`.**
> El mismo hecho, **arriba de `## Permuta`**, donde vive el guion. **No es una condición más de las
> 64:** es un **gate de entrada** que dice que la sección ENTERA no corre en ese turno, y trae **su
> propio guion concreto** (*"perfecto, con $5.000.000 de anticipo seguimos"*) más la lista textual
> de las frases a matar (*"recibimos usados como parte de pago"*, *"qué auto entregás"*, *"marca,
> modelo y año"*, *"si la tasación acompaña"*). Un guion concreto es lo único que le gana a otro
> guion concreto.
> **POR QUÉ ES SEGURO PARA LAS PERMUTAS REALES:** el gate está condicionado a `entrega_plata > 0`,
> que mide **0 en todos los mensajes de permuta legítima del corpus** (32 etiquetados, 0 FP), entre
> otras cosas porque una de sus tres condiciones es que `lead_entrega` no sea ya `"Sí"`. **En un
> flujo de permuta el gate es inerte POR CONSTRUCCIÓN, no por suerte.** Igual se mide.
> **Verificado:** **un solo nodo con diferencias**, `systemMessage` 56.922 → 57.967 arrancando con
> `=`, **el CUERPO de `## Permuta` byte a byte intacto** (sólo se insertó el gate después del
> encabezado, asertado contra la reconstrucción exacta), `# Financiación` intacto, las inyecciones
> de v86 y v87 presentes, el gate compila y con `entrega_plata = 0` **desaparece**. Los 5
> invariantes pasan sobre v88.
> **UN ERROR MÍO EN LAS ASERCIONES, QUE LAS ASERCIONES CAZARON:** el chequeo de render agarraba la
> inyección de v87 en vez del gate — **las dos contienen `entrega_plata > 0`** y busqué la primera.
> Anclado desde el encabezado de `## Permuta`.
> **AL PEGAR, MEDIR ASÍ. 1 campo:** `Franco (AI Agent)` → **System Message**.
> · `--case entregar-plata-no-es-permuta --repeat 4 --delay 25000`. **Baseline v87: 0/4**, con la
>   conducta ya descrita arriba (no leer el 0/4 como si nada se hubiera movido).
> · **CONTROLES, obligatorios y son los de permuta** (el riesgo es suprimir permutas reales):
>   `permuta-mas-efectivo`, `permuta-una-pregunta-por-vez`, `permuta-no-dumpea-abanico-sin-pedirlo`,
>   más `financiar-monto-no-es-anticipo` (que no pise a v86).
> · **`search_executions` EN CADA TANDA.**

> **(entrada previa, antes de desplegar) "ENTREGAR $X" ES PLATA, NO UN AUTO — preparado (v87).**
> Captura Agustina (2da pantalla): el cliente pregunta *"Puedo entregar 5.000.000?"* —plata, como
> anticipo— y Franco lo lee como entregar un AUTO: *"Sí, claro, recibimos usados como parte de
> pago… Qué auto entregás? Marca, modelo, año."* **El cliente nunca nombró ningún vehículo.**
> **BASELINE MEDIDO** (`entregar-plata-no-es-permuta`, `--repeat 4 --delay 25000`, ventana
> 18:20:28–18:22:57 verificada con 0 ejecuciones en `error`): **0/4.** Las 4 abren permuta.
> **EL LOG MUESTRA QUE ES PEOR QUE LA CAPTURA — ejecución `11588`, `Guardar lead`:**
> `entrega: "Sí"` · `descripcion_usado: "Auto usado mencionado, sin detalles"` ·
> `presupuesto: "$5.000.000 + financiación $30.000.000"`. **INVENTA UN USADO QUE NO EXISTE Y LO
> PERSISTE.** Desde ese turno `Config.estado_cliente` dice *"- Entrega un usado en parte de pago,
> todavía sin datos del auto"*, y de esa lista el prompt dice *"Son verdad: usalos, no se los
> vuelvas a preguntar y no los contradigas"*: **Franco queda ENCERRADO en una permuta fantasma**
> para el resto de la charla. Igual que v86, el error no muere en el turno — por eso se toca el CRM.
> **RAÍZ:** *"entregar"* es el disparador léxico de `## Permuta` — la sección **se titula
> literalmente** *"cliente con efectivo + un usado para entregar"* y su guion pide *"marca, modelo
> y año"*. **Es el MISMO EJE que el abierto #1 pero al revés** (ahí *"entrego un yaris 2021"* dio
> `tiene_permuta: 0`). **El modelo falla en las dos direcciones sobre la misma palabra**, lo que
> dice que ese eje no lo puede separar él: hay que calcularlo.
> **VALIDACIÓN OFFLINE: 32 mensajes etiquetados (22 reales), 0 FP y 0 FN.**
> **LA ASIMETRÍA ES LA INVERSA DE LA DE v86, Y POR ESO EL DISEÑO CAMBIA:** un FP acá **suprime una
> permuta legítima** —el cliente sí tenía usado y Franco no lo toma: un canal de venta perdido—,
> mientras que en v86 el FP era una repregunta. Por eso el patrón exige **TRES condiciones a la vez**
> y la detección de vehículo es **deliberadamente generosa** (ante la duda, hay auto → no dispara):
> · (a) un verbo de PONER PLATA adyacente a un monto,
> · (b) **ningún** indicio de vehículo en el mensaje (marcas, modelos, "auto", "usado", "km", un año),
> · (c) que `Leer lead (estado)` **no** tenga ya `lead_entrega = "Sí"`.
> **La (c) es la que casi elimina el riesgo**, y es el mismo recurso de v85 con
> `franco_ofrecio_mostrar`: parte del criterio vive en el ESTADO DEL LEAD, no en el texto. Probado:
> el MISMO mensaje del bug con un usado ya registrado da **0** — la permuta real no se toca nunca.
> **`scripts/entregar-plata-no-es-permuta.mjs` (v86→v87), 3 nodos, mismo reparto que v86:**
> · **(A) `Config`**: campo nuevo **`entrega_plata`** (number).
> · **(B) `Franco`**: el hecho va en **`# Lo que ya sabés de este cliente`**, que es donde viven los
>   datos confirmados. **NO se toca `## Permuta`** — 27.573 chars y 64 condiciones; sumarle una más
>   es el yo-yo documentado. Asertado byte a byte, igual que `# Financiación` (el fix de v86).
> · **(C) `CRM`, campo `text`**: para que deje de escribir `entrega: "Sí"` y el usado fantasma.
> **Verificado:** exactamente 3 nodos con diferencias, 35 nodos, `connections` idénticas,
> `systemMessage` 55.963 → 56.922 arrancando con `=`, **`## Permuta` y `# Financiación` byte a byte
> idénticos**, trampas 1/2/3 comprobadas, los 5 invariantes pasan sobre v87.
> **PRUEBA VINCULANTE OFFLINE** sobre el expression real del JSON generado (verifica además que
> **compila**): **14/14**, incluidos los 4 que tienen que dar el monto, las 6 permutas legítimas que
> tienen que dar 0, y `"Quiero financiar 30.000.000"` → 0, o sea que **no pisa a v86**.
> **AL PEGAR, MEDIR ASÍ. 3 campos:** `Config` → campo nuevo **`entrega_plata`** (tipo **Number**),
> `Franco (AI Agent)` → **System Message**, `CRM (AI Agent)` → el campo de **texto**.
> · **HUMO PRIMERO** (`Config` está en la cadena principal): mensaje simple → HTTP 200 y
>   `Config.entrega_plata` con un número, no `undefined`.
> · `--case entregar-plata-no-es-permuta --repeat 4 --delay 25000`. **Baseline: 0/4.**
> · **CONTROLES — acá el riesgo es SUPRIMIR PERMUTAS REALES, así que los de permuta son
>   obligatorios:** `permuta-mas-efectivo`, `permuta-una-pregunta-por-vez`,
>   `permuta-no-dumpea-abanico-sin-pedirlo`, `financiar-monto-no-es-anticipo` (que v87 no pise v86)
>   y `financiacion-pide-anticipo`.
> · **`search_executions` EN CADA TANDA.**
> **`evals/cases.json`: 76 → 77 casos.**

> **v86 DESPLEGADO Y MEDIDO: FUNCIONA. 0/4 → 4/4, y el CRM deja de guardar mal. Puntero: v86
> vivo. Sesión 2026-08-05. Sin pushear a git.**
> **DEPLOY VERIFICADO byte a byte:** 35 nodos, `active`, `connections` idénticas, los 3 campos
> pegados **byte a byte iguales a v86** (`monto_financiar` 1.026 chars y tipo **number**,
> `systemMessage` 55.963 arrancando con `=`, `text` del CRM 603), **`pidio_ver` de v85 intacto**,
> **`## Permuta` byte a byte igual que en v85**, `Listar stock` sin cambios, y **0 nodos con
> `parameters` distintos de v86**.
> **HUMO (era el riesgo grave — `Config` está en la cadena principal y un error de sintaxis ahí
> deja al cliente sin respuesta):** mensaje simple → **HTTP 200** en 12 s, stock completo, sin
> burbuja de fallback. En el log, **`Config.monto_financiar: 0`** —número válido, no `undefined`—
> y `pidio_ver: 1`, o sea que v85 sigue en pie. 29 ms.
> **MEDICIÓN — ventana 16:00:25–16:02:54 verificada: 0 ejecuciones en `error`.**
> `--case financiar-monto-no-es-anticipo --repeat 4 --delay 25000` → **4/4** (baseline 0/4).
> **LAS 4 CORRIDAS DAN EL GUION, Y ESO ES LA PRUEBA, NO UNA LECTURA DEL TEXTO:** *"Dale. Y de
> anticipo, de cuánto pensás poner más o menos?"* — esa frase **sólo existe dentro de la rama
> `monto_financiar > 0`**. Si el patrón hubiera dado 0, el guion no habría estado en el prompt.
> **LA MITAD INVISIBLE TAMBIÉN SE CERRÓ — ejecución `11518` contra la `11456`, mismo turno y mismo
> `lead_financia: "Sí"` de entrada:** `Guardar lead` pasa de `presupuesto: "$30.000.000"` /
> `estado: "Requiere asesor"` a **`presupuesto: "No mencionado"` / `estado: "En conversación"`**, y
> el dato igual queda registrado donde corresponde (`resumen: "…quiere financiar $30.000.000"`).
> **`crm_leads` deja de envenenar `estado_cliente` en los turnos siguientes.**
> **CONTROLES: 9/15, ventana 16:03:47–16:15:14 verificada con 0 ejecuciones en `error`.**
> `financiacion-pide-anticipo` **3/3** y `faq-financiacion-maximo` **3/3** — o sea que **el embudo
> que costó v47/v52/v78 sigue entero** y Franco sigue tomando un anticipo legítimo, que era el
> riesgo del cambio.
> **NINGUNO DE LOS 6 ROJOS PUEDE VENIR DE v86, Y NO ES UNA OPINIÓN: se evaluó la expresión REAL
> desplegada sobre los 13 turnos de los 5 controles y da 0 en TODOS.** Con `monto_financiar = 0` la
> línea inyectada renderiza **string vacío**, y el resto de `# Financiación` es byte a byte idéntico
> a v85 (verificado). **v86 es literalmente inerte en esos casos.**
> · **El turno 1 de `capacidad-de-compra-financiada` es el que más importa:** *"un ford ka 2015
>   para entregar y unos 7 millones de anticipo… me interesa financiar"* → **0**. Era el falso
>   positivo más peligroso del corpus (dispararía la repregunta de un anticipo YA DADO, o sea el
>   abierto #3), y queda confirmado inerte **en producción**, no sólo offline.
> **QUÉ SON LOS ROJOS, CON LO QUE SÉ Y LO QUE NO:**
> · **`financiacion-preperfilado` 0/3 — CHECK QUE CONTRADICE AL PROMPT, muy probablemente
>   desactualizado desde v47.** Exige *"cuántas cuotas"* en el turno 1, pero `# Financiación` dice
>   textual *"pre-perfilás de a UNA pregunta por mensaje, y arrancás por el ANTICIPO… **Recién con
>   el anticipo** preguntás las cuotas"*. O sea que **da rojo por cumplir el prompt**, misma forma
>   que `permuta-una-pregunta-por-vez` en la sesión anterior. **NO SE TOCA ACÁ: un cambio por vez,
>   y tocar checks tiene su propia verificación.** Dicho derecho: **no tengo baseline de v85 para
>   este caso**, así que afirmo que v86 no lo causó (probado), no que antes estuviera verde.
> · **`capacidad-de-compra-financiada` 2/3** — la roja arranca con **burbuja de fallback del
>   parser** (instrumento, no conducta) y los otros 2 checks de esa corrida caen en cascada de eso.
> · **`financiacion-no-re-ofrece` 1/3**, contra **2/3 en v52**. Sobre n=3 eso es ruido, no una
>   señal: no lo llamo regresión ni lo doy por igual. El turno 5 sí re-ofrece financiación (*"Si te
>   interesa, puedo ayudarte con la financiación"*), que es el resto conocido de ese caso desde v52.
> **LO QUE SE APRENDIÓ DEL MÉTODO, Y ES LO MÁS ÚTIL DE ESTA ENTRADA:** el **primer baseline dio 4/4
> VERDE y no reprodujo**. Decirlo en vez de inventar una falla fue lo que llevó al diagnóstico: el
> log mostró que la única diferencia con la captura era `lead_financia`. **Un caso que no reproduce
> no es un caso malo: es una variable sin identificar.**
> **Detalle de la medición del baseline abajo, en la entrada de preparación.**

> **(entrada previa, antes de desplegar) EL MONTO A FINANCIAR NO ES EL ANTICIPO — preparado (v86).**
> Captura Agustina: al mensaje *"Quiero financiar 30.000.000"* Franco contesta *"…con **$30.000.000
> de anticipo** en la financiación, me dejás tu nombre y apellido?"*. Toma el monto **a financiar**
> como si fuera el **anticipo**, y encima cierra en el name-ask sin tener anticipo NI cuotas.
> **PRUEBA VINCULANTE — ejecución `11456`** (sesión `9f1356e3`, 15:19:05 UTC): además del texto,
> **`Guardar lead` escribió `presupuesto: "$30.000.000"` y `estado: "Requiere asesor"`**. O sea que
> **el error se PERSISTE en `crm_leads`** y vuelve por `Config.estado_cliente` como dato confirmado
> en todos los turnos siguientes. El bug no muere en ese turno: eso es lo que obliga a tocar el CRM.
> **EL PRIMER BASELINE NO REPRODUJO, Y ESO FUE EL DIAGNÓSTICO.** Con 3 turnos (*pickup 4x2 /
> aceptan cheques? / el monto*) el caso midió **4/4 VERDE** (ventana 15:38:46–15:41:04, 0
> ejecuciones en `error`). Lo dije en vez de inventar una falla, y el log dio la variable: en mi
> corrida `11477` `Leer lead (estado)` traía **`lead_financia: "No mencionado"`** y Franco pidió el
> anticipo bien las 4 veces (y el CRM guardó `presupuesto: "No mencionado"`, también bien); en la
> `11456` traía **`"Sí"`**. **El bug necesita el EMBUDO DE FINANCIACIÓN YA ABIERTO:** con un
> casillero pendiente —el anticipo que `# Financiación` le manda pedir— el monto entrante se le cae
> adentro. Anotarlo: *un caso que no reproduce no es un caso malo, es una variable sin identificar.*
> **BASELINE REAL, con el embudo abierto (4 turnos, `--repeat 4 --delay 25000`, ventana
> 15:42:51–15:45:27 verificada con 0 ejecuciones en `error`): 0/4.** Y falla de **tres formas
> distintas, ninguna correcta**: 2 corridas dicen *"con ese anticipo"*, 1 lo usa de presupuesto y
> **lista pickups**, 1 se saltea el anticipo y pregunta las cuotas.
> **RAÍZ: el concepto "monto a financiar" NO EXISTE en ningún lado del sistema.** `# Financiación`
> tiene **un solo casillero para plata** (*"arrancás por el ANTICIPO, que es el dato clave"*) y el
> CRM define `presupuesto` como *"el presupuesto que mencionó"*. El monto entra y cae en el único
> casillero que hay. Trampa 6.
> **VALIDACIÓN OFFLINE ANTES DE TOCAR NADA (método de v74/v85): 62 mensajes etiquetados a mano —
> 44 REALES de capturas y de los 174 turnos de `evals/cases.json`— con `0 falsos positivos` y
> `0 falsos negativos`.** **La asimetría que fija el criterio:** un FP hace que Franco **repregunte
> un anticipo YA DADO**, que es el **abierto #3** y ya está vivo — amplificarlo es inaceptable; un
> FN deja el bug como está. Por eso FP=0 es requisito y FN se tolera. Las trampas del corpus son
> reales y son las que importan: *"me interesa financiar"* con **7 millones de anticipo** en el
> mismo mensaje, *"se podría financiar? tengo 5 millones para poner"*, *"sin financiar"*,
> *"financian hasta 50%?"*, *"financiar en 36 cuotas"*.
> **`scripts/monto-a-financiar-no-es-anticipo.mjs` (v85→v86), 3 nodos — UN mecanismo repartido por
> dónde vive cada CONSUMIDOR del dato, misma forma que v85:**
> · **(A) `Config`**: campo nuevo **`monto_financiar`** (number) con el patrón validado, sobre el
>   mensaje actual. Va acá y no en `mensajes_demo` por lo mismo que `pidio_ver`: el mensaje actual
>   todavía no está en la tabla cuando corre (`Guardar mensajes` corre DESPUÉS de responder).
> · **(B) `Franco`, `# Financiación`**: el hecho ya calculado **+ EL GUION DEL TURNO**
>   (*"dale. Y de anticipo, de cuánto pensás poner más o menos?"*). **Trampa 6: se compite con un
>   guion concreto, no con una prohibición suelta.** Con `monto_financiar = 0` la línea **desaparece**.
> · **(C) `CRM (AI Agent)`, campo `text`**: el mismo dato, para que no guarde el monto como
>   `presupuesto`. **OJO TRAMPA 1: el `systemMessage` del CRM NO arranca con `=` y no tiene ninguna
>   `{{ }}`** — una expresión ahí sería texto literal. `text` sí es expresión y ya usa `$('Config')`.
> **POR QUÉ ESTO NO ES "PREGUNTARLE AL MODELO" (la familia que v83/v84 dejaron descartada):** no se
> le pide que juzgue nada, se le **inyecta un hecho ya calculado**. El precedente vivo es
> `estado_cliente` / `ya_derivado`, no `cliente_pidio_ver`. **Dicho derecho: la adherencia sigue
> siendo del modelo** —el enforcement no es duro como el de v85, que devolvía 0 filas—, así que
> esto se juzga midiendo, no leyendo.
> **UN ERROR MÍO QUE VALE LA PENA ANOTAR:** la primera corrida del script **se comió medio texto
> del CRM**. Causa: en un string de reemplazo de `String.replace`, **`$'` es un patrón especial**
> (el sufijo posterior al match), y el texto inyectado tiene `$`. Era invisible leyendo el script y
> **evidente renderizando la expresión**. Quedó una aserción que renderiza las dos inyecciones con
> y sin monto, justamente para eso.
> **Verificado:** **exactamente 3 nodos con diferencias**, `connections` idénticas, 35 nodos,
> `systemMessage` 55.031 → 55.963 chars **arrancando con `=`**, **`## Permuta` byte a byte idéntico**
> (no se le suma nada a las 64 condiciones), los fixes de v78/v79/v81/v82/v85 presentes por
> aserción, trampa 2 y trampa 3 comprobadas sobre todo el workflow, y **los 5 invariantes pasan
> sobre v86**.
> **PRUEBA VINCULANTE OFFLINE:** se evalúa el **expression real extraído del JSON generado** (así
> se verifica además que **compila** — un error de sintaxis en `Config` corta la cadena principal y
> deja al cliente sin respuesta): **15/15**, con los 5 positivos dando el monto exacto y los 10
> negativos dando 0.
> **AL PEGAR, MEDIR ASÍ. 3 campos:** `Config` → campo nuevo **`monto_financiar`** (tipo **Number**),
> `Franco (AI Agent)` → **System Message**, `CRM (AI Agent)` → el campo de **texto** (el del
> `session_id`, NO el System Message).
> · **HUMO PRIMERO, ES EL RIESGO GRAVE:** `Config` está en la **cadena principal** y un error de
>   sintaxis ahí deja al cliente **sin respuesta**. Mandar un mensaje simple, confirmar HTTP 200 con
>   respuesta normal, y en el log que **`Config.monto_financiar` tiene un número** (0 en un mensaje
>   cualquiera), no `undefined` ni error.
> · Después: `--case financiar-monto-no-es-anticipo --repeat 4 --delay 25000`, el caso SOLO.
>   **Baseline: 0/4.**
> · **CONTROLES** (el riesgo es que ahora Franco NO tome un anticipo legítimo, o que rompa el embudo
>   de financiación que costó v47/v52/v78): `financiacion-pide-anticipo`, `financiacion-preperfilado`,
>   `financiacion-no-re-ofrece`, `faq-financiacion-maximo` y `capacidad-de-compra-financiada`.
> · **`search_executions` EN CADA TANDA** (status error, con `startedAfter` Y `startedBefore` de la
>   ventana exacta), no una vez por sesión.
> **LO QUE NO SE TOCA, Y POR QUÉ:** el techo del 50% **no se verbaliza acá** — es el bug siguiente y
> depende de que los montos estén bien separados, que es justo lo que hace este cambio. Y el
> `monto_financiar` **no se persiste** en `crm_leads`: eso necesita una columna nueva (la corre
> Agustina, como el CUIL) y recién hace falta para ese bug.
> **`evals/cases.json`: 75 → 76 casos.** El bloque autogenerado de arriba todavía dice 75; se
> regenera al correr `state-sync.mjs` sin `--file` cuando v86 sea el puntero.

> **Sesión 2026-08-05. CONTROLES DE v85 + TRES CHECKS DESACTUALIZADOS CORREGIDOS. Puntero: v85
> vivo. Sin pushear a git.**
> **CONTROLES DE v85 (`--repeat 3 --delay 25000`, ventana 14:49:01–15:01:00 verificada: 0
> ejecuciones en `error`): 10/15.** `stock-general-completo` **3/3** y `rango-14-20` **3/3** — o sea
> que **ningún flujo SIN permuta se vio afectado**, que era el riesgo del gate.
> **CASI REPORTO UNA REGRESIÓN QUE NO EXISTE — LEER EL LOG LO EVITÓ.** `permuta-mas-efectivo` 0/3
> con 0 cards, y la lectura obvia era "el gate se pasó de estricto". **Ejecución `11347` dice que
> no:** para el mensaje *"tengo 12 millones en efectivo y entrego un yaris 2021 con 85mil km"*
> Franco mandó **`tiene_permuta: 0` y `precio_objetivo: 0`**, así que **el gate ni se activó** — la
> tool devolvió las 17 filas y Franco decidió no mostrarlas. **La falta de cards NO es de v85.**
> (Verificada 1 de las 3 corridas; las otras dos no las abrí, así que no puedo afirmar que en las
> tres el gate estuvo inerte.)
> **BUG NUEVO QUE ESTO DESTAPÓ, no tocado:** Franco extrae `tiene_permuta: 0` y `precio_objetivo: 0`
> de un mensaje que dice literalmente "tengo 12 millones en efectivo y entrego un yaris 2021". Es
> extracción de parámetros, no el gate.
>
> **TRES CHECKS CORREGIDOS (`evals/cases.json`), y el criterio importa: se tocó el instrumento sólo
> donde estaba objetivamente mal, y se verificó RE-PUNTUANDO OFFLINE las corridas guardadas para no
> cambiarlos a ciegas.**
> · **`presupuesto-aproximado`** y **`permuta-mas-efectivo`**: `cards_min 1` → **`media_min 1`**.
>   Con 1-2 autos `Armar respuesta` manda **imágenes, no cards** — está documentado en el propio
>   runner ("un umbral fijo da rojos falsos según cuántos autos haya elegido Franco"). Medido: una
>   corrida salió roja con **0 cards y 6 imágenes**.
> · **`permuta-una-pregunta-por-vez`** turno 1: prohibía la **palabra** "asesor", pero lo que el
>   caso quiere prohibir es **DERIVAR antes de tiempo**. El prompt (`## Permuta` punto 4) **exige**
>   decir que la tasación la hace un asesor viéndolo en persona, así que la versión vieja **daba
>   rojo por cumplir el prompt**. Ahora prohíbe ofrecer/derivar y permite el guion legítimo.
>   **Validado sobre 6 frases reales: 6/6.** Misma distinción que hubo que hacer en el check de
>   "efectivo" (afirmar vs preguntar).
> **LO QUE NO SE TOCÓ, Y POR QUÉ:** el `text_matches "asesor|tasa"` de `permuta-mas-efectivo`
> **NO está desactualizado.** Se revisó: falló **sólo en la corrida con burbuja de fallback del
> parser**; las otras dos lo pasaron, y el prompt sí exige esa explicación. Encoda un requisito
> real.
> **LA VERIFICACIÓN QUE IMPORTA: `permuta-mas-efectivo` NO se puso verde con el cambio.** Ahí
> `media` era 0 (cero cards **y** cero imágenes), así que sigue rojo. **Se arregló el instrumento
> donde estaba mal sin tapar el caso que falla de verdad** — que era el riesgo de tocar checks.
> Re-puntuado offline: `presupuesto-aproximado` y `permuta-una-pregunta-por-vez` pasan a verde por
> motivos legítimos; el tercero no se mueve. **Controles esperados: 10/15 → 12/15.**
> **RE-MEDIDO CON LOS CHECKS CORREGIDOS (ventana 15:09:49–15:20:45 verificada: 0 ejecuciones en
> `error`): 11/15, NO 12/15 — la predicción falló por 1 y vale decir por qué.**
> · `presupuesto-aproximado` **2/3 → 3/3**: el fix funcionó exactamente como se predijo.
> · `permuta-una-pregunta-por-vez` **2/3**: el check corregido (el de "asesor") **pasó las 3
>   corridas** — o sea que el fix anduvo. Lo que falló en 1 corrida fue OTRO check
>   (`text_matches "qué auto|marca|modelo"`: Franco no preguntó por el auto que entrega).
>   **Varianza conversacional, no el fix.**
> · `permuta-mas-efectivo` **sigue 0/3, y está bien que así sea:** 2 fallas son `media_min` con
>   **0 cards Y 0 imágenes** (real, no instrumento) y 1 es `asesor|tasa`. **El arreglo del
>   instrumento NO tapó el caso que falla de verdad**, que era exactamente el riesgo de tocar
>   checks.
> · `stock-general-completo` y `rango-14-20` **3/3**: los flujos sin permuta siguen intactos.

> **v85 DESPLEGADO Y MEDIDO: FUNCIONA. El síntoma pasa a 0/4, y el gate NO se pasa de estricto.
> Puntero: v85 vivo. Sesión 2026-08-05. Sin pushear a git.**
> **HUMO (era el riesgo grave — `Leer lead (estado)` y `Config` están en la CADENA PRINCIPAL y un
> error de sintaxis deja al cliente sin respuesta):** mensaje simple → **HTTP 200**, stock completo,
> sin burbuja de fallback. **`Leer lead (estado)` devuelve 1 fila** (trampa 4 ✓) con la columna
> nueva `franco_ofrecio_mostrar`, `ya_derivado` conservado, 28 ms (antes ~20). En `Listar stock` el
> `$fromAI('cliente_pidio_ver')` **ya no aparece** en los parámetros (se eliminó bien) y la query
> **corrió sin error**, o sea que `$('Config').item.json.pidio_ver` resolvió a un número válido —
> si fuera `undefined` la query habría roto.
> **MEDICIÓN — ventana 14:41:28–14:45:35 verificada: 0 ejecuciones en `error`.**
> **EL GATE FUNCIONA EN LAS DOS DIRECCIONES, que es lo que había que probar:**
> · **turno 3** (`"110000 km"`, el cliente DA un dato): **0 de 4 corridas listan autos.** Cero
>   cards, cero fotos. Baselines: v82 1/3, v83 2/4, v84 3/4 listaban. **El síntoma que reportó
>   Agustina está muerto.**
> · **turno 4** (`"dale, mostrame alternativas"`, el cliente PIDE): **4 de 4 muestran autos.** El
>   gate no se pasó de estricto, que era el riesgo del cambio.
> · **2 de 4 dan el ofrecimiento textual pedido:** *"La tasación final de tu usado la hace un asesor
>   viéndolo en persona. Querés que te muestre alternativas que te entren con eso, o preferís que un
>   asesor te contacte directo?"*
> **EL EVAL IGUAL MARCA 1/4, Y HAY QUE SABER LEERLO:** las rojas restantes NO son de este cambio —
> (a) 2 corridas **repreguntan marca/modelo del usado** en el turno 3 (el **abierto #3**, "al pedir
> datos del usado, repregunta los ya dados", vivo desde 2026-07-22) y (b) 2 turnos caen en **TIPO B**
> (autos en el texto con 0 cards). Estaba anticipado y dicho antes de medir.
> **DESPUÉS DE TRES INTENTOS, LO QUE FUNCIONÓ Y POR QUÉ:** v83 (prompt) 0/4 y v84 (parámetro que
> declara el modelo) 0/4 fallaron **porque los dos le preguntaban al modelo**. v85 **lo calcula**.
> La diferencia no es "mejor prompt": es sacar la decisión del modelo. Es la regla del proyecto
> aplicada al lugar correcto — y costó dos intentos entender **cuál** era el dato determinístico
> (no "¿pidió?" como intención, sino el patrón sobre el texto del mensaje).
>
> **(entrada previa, antes de desplegar) TERCER INTENTO — preparado (v85).**
> **LOS DOS INTENTOS ANTERIORES ESTÁN MEDIDOS Y DESCARTADOS:** v83 (prompt) **0/4**; v84 (parámetro
> que declara el modelo) **0/4**, con la ejecución `11231` mandando `cliente_pidio_ver: 1` para un
> mensaje que era literalmente `"110000 km"`. **Preguntarle al modelo no funciona ni en prosa ni
> como parámetro.** Queda una sola vía: calcularlo.
> **VALIDACIÓN OFFLINE HECHA ANTES DE TOCAR EL WORKFLOW (método de v74):**
> · **Parte 1 — 152 mensajes reales** de cliente de 19 sesiones, etiquetados a mano. Patrón final:
>   **0 falsos positivos**, 11 falsos negativos, **15/15** en los mensajes exactos del bug.
>   **La asimetría que justifica ajustar a 0 FP:** un FP **deja pasar el dump** (el bug intacto); un
>   FN hace que Franco **PREGUNTE en vez de mostrar**, que es el default que pidió Agustina.
> · **Parte 2 — 154 pares (burbuja de Franco → mensaje del cliente).** Un "sí" pelado no se puede
>   clasificar solo: de los **6 afirmativos reales del corpus, 5 eran "sí" a un ASESOR** y 1 a
>   mostrar opciones. Tratarlos a todos como "pidió ver" habría abierto el gate **5 veces mal**.
>   Con la parte 2: **6/6**, y queda resuelto el loop *"¿querés ver alternativas?"* → *"dale si"* →
>   sin filas → vuelve a preguntar.
> **EL DETALLE DE ARQUITECTURA QUE DEFINE EL DISEÑO:** el mensaje ACTUAL del cliente **no está en
> `mensajes_demo`** cuando corre la tool — `Guardar mensajes (historial)` corre DESPUÉS de
> responder. Un patrón sobre `mensajes_demo` leería el mensaje del **turno anterior**. Por eso el
> cálculo va en `Config`, que es el único nodo con `mensaje_usuario` del webhook.
> **`scripts/pidio-ver-deterministico.mjs` (v84→v85), 3 nodos — UN mecanismo repartido por dónde
> vive cada dato:**
> · **(A) `Leer lead (estado)`**: columna `franco_ofrecio_mostrar` desde la ÚLTIMA burbuja de
>   Franco. Es la parte 2. Subconsulta **escalar**, igual que `ya_derivado` (trampa 4).
> · **(B) `Config`**: campo `pidio_ver` (0/1) con el patrón validado, sobre el mensaje actual.
> · **(C) `Listar stock`**: el gate pasa de `$fromAI('cliente_pidio_ver')` —el juicio del modelo,
>   que falló— a `$('Config').item.json.pidio_ver`. **El `$fromAI` muerto se elimina** y el
>   `toolDescription` deja de nombrar un parámetro que ya no existe.
> **PRECEDENTE DE QUE (C) FUNCIONA:** `Postgres Chat Memory` —también sub-nodo del agente— ya usa
> `={{ $('Config').item.json.session_id }}` en producción. No es un mecanismo nuevo.
> **PRUEBA VINCULANTE OFFLINE:** se evalúa el **expression real de `Config`** (extraído del JSON y
> corrido con datos simulados, así se verifica además que **compila** — un error de sintaxis ahí
> corta la cadena principal): los 15 mensajes del bug dan **0**, los pedidos claros dan **1**, y
> `"dale si"` da 1 **sólo** si Franco había ofrecido MOSTRAR.
> **Verificado:** exactamente **3 nodos** cambiados, `systemMessage` **intacto** (sigue sin sumarse
> una condición a las 64 de `## Permuta`), `queryReplacement` de `Leer lead` sin tocar (trampa 2),
> los 5 invariantes pasan sobre v85.
> **AL PEGAR, MEDIR ASÍ. 3 campos:** `Leer lead (estado)` → `Query`, `Config` → campo nuevo
> `pidio_ver` (number), `Listar stock` → `Query` y `Description`.
> · **HUMO PRIMERO, ES EL RIESGO GRAVE:** `Leer lead (estado)` y `Config` están en la **cadena
>   principal** — un error de sintaxis ahí y el cliente **no recibe respuesta**. Mandar un mensaje
>   simple y confirmar HTTP 200 con respuesta normal, y en el log que `Leer lead` devuelve **1 fila**
>   con `franco_ofrecio_mostrar` y que `Config.pidio_ver` tiene un 0/1 (no `undefined` ni error).
> · Después: `--case permuta-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000`, el caso SOLO.
>   Baselines: v82 1/3, v83 2/4, v84 0/4.
> · **CONTROLES** (el riesgo es que ahora NO muestre nunca): `permuta-mas-efectivo`,
>   `permuta-una-pregunta-por-vez`, `presupuesto-aproximado`, `rango-14-20`,
>   `stock-general-completo`.
> · **`search_executions` EN CADA TANDA.**

> **v84 DESPLEGADO Y MEDIDO: TAMPOCO FUNCIONA. 0/4. PERO EL LOG DICE POR QUÉ, Y DESCARTA UNA
> FAMILIA ENTERA DE FIXES. Puntero: v84 vivo. Sesión 2026-08-05.**
> **DEPLOY VERIFICADO:** 35/35 nodos idénticos a v84, **único nodo distinto de v83 `Listar stock`**,
> `systemMessage` **byte a byte idéntico** (55.031), gate presente, `toolDescription` con la nota.
> **MEDICIÓN VÁLIDA — ventana 13:33:49–13:37:35: 0 ejecuciones en `error`.** `--repeat 4` → **0/4**;
> en 3 de 4 el turno 3 sigue listando autos.
> **LA PRUEBA QUE CIERRA LA DISCUSIÓN — ejecución `11231`, turno cuyo mensaje del cliente es
> literalmente `"110000 km"`:**
> `Listar stock` ← **`tiene_permuta: 1`** (el gate SÍ aplicaba) **y `cliente_pidio_ver: 1`**.
> **El SQL funciona perfecto: con `cliente_pidio_ver = 0` habría devuelto 0 filas. El problema es
> que el modelo NUNCA pone 0 en ese momento.** A "110000 km" le puso 1. En la prueba de humo, a
> *"reciben usados? tengo 25 millones"* también le puso 1. **2 de 2 observaciones.**
> **LO QUE ESTO DESCARTA, Y ES EL VALOR DEL INTENTO FALLIDO:** se probaron **las dos formas de
> preguntarle al modelo** si el cliente pidió ver autos —**en prosa (v83, 5 reglas) y como
> parámetro explícito de la tool (v84)**— y **las dos fallaron**. No es que el prompt esté mal
> redactado ni que falte una condición: **el modelo no distingue "el cliente me está dando un dato"
> de "el cliente me pide opciones"** en ese punto del embudo. Cualquier fix que dependa de que él lo
> declare va a fallar igual. Queda descartada la familia entera.
> **LO ÚNICO QUE QUEDA EN PIE ES CALCULARLO SIN PREGUNTARLE (camino C, no implementado):** un
> patrón por SQL sobre el ÚLTIMO mensaje del CLIENTE en `mensajes_demo` — `"110000 km"` no pide,
> `"dale, mostrame alternativas"` sí. Es **mucho más separable** que `ya_derivado` (que discriminaba
> matices del lenguaje de Franco y midió 37/37 offline). **Viabilidad técnica verificada:**
> `$fromAI('session_id')` ya funciona en producción dentro de `Guardar lead`, así que la tool puede
> recibir el `session_id` y hacer la subconsulta. **Validar offline ANTES de tocar nada**, con el
> método de v74: bajar mensajes reales de clientes, etiquetarlos a mano, medir el patrón.
> **SOBRE v84: NO SE REVIRTIÓ.** El gate es inerte (el modelo siempre manda 1), no rompe nada, y
> **la estructura del gate se reusa tal cual en el camino C** — sólo cambia de dónde sale el flag.
> Si se decide no seguir por C, conviene revertirlo para no dejar un parámetro muerto en la tool.
> **HONESTIDAD SOBRE MIS DOS RECOMENDACIONES:** v83 y v84 los propuse yo y los dos fallaron. Lo que
> sí sirvió fue el método: en los dos casos el log dijo **exactamente** por qué, y por eso el
> descarte de la familia "preguntarle al modelo" está medido y no supuesto.
>
> **(entrada previa, antes de desplegar) SEGUNDO INTENTO DEL ABANICO — preparado (v84).**
> **POR QUÉ NO SE INTENTÓ UNA SEXTA REGLA — LOS NÚMEROS DE `## Permuta`, medidos:**
> **27.573 chars = la MITAD del prompt entero**, y **64 condiciones negativas** (NO/SOLO/OJO/NUNCA)
> en 68 líneas. Casi una por línea. Cuatro reglas preexistentes prohibían este dump y se violaron
> las cuatro; v83 fue la quinta y **midió 0/4**. El problema no es que falte una regla: **es que hay
> demasiadas para que el modelo las arbitre**, y cada fix agrega otra. Seguir por lenguaje era el
> yo-yo del CLAUDE.md.
> **LA EVIDENCIA QUE CAMBIA EL ENFOQUE — ejecución `11206`, el turno que dumpea:**
> `Listar stock` ← `tiene_permuta: 1, precio_objetivo: 25000000, usado_marca: "Toyota",
> usado_anio: 2020, usado_km: 110000` → **14 filas**. Con 14 filas en la mano, listó. Y el prompt
> dice **textual** *"NO llamás a Listar stock para listar opciones"* en ese turno. **La prohibición
> de LLAMAR falla igual que la de listar** → la decisión no se toma al redactar, se toma **al llamar
> la herramienta**, que es un evento observable y BLOQUEABLE.
> **`scripts/permuta-mostrar-solo-si-lo-piden.mjs` (v83→v84), 1 nodo.** Parámetro nuevo
> `cliente_pidio_ver` en `Listar stock`; si `tiene_permuta = 1` y vale 0, **la query devuelve CERO
> filas**. Sin filas no hay nada que listar: el enforcement es duro y no depende de arbitrar 64
> condiciones. **Precedente vivo en la MISMA tool**: ya devuelve 0 filas a propósito con
> `precio_objetivo = 0`, y el `toolDescription` explica la señal para que Franco no diga "no hay
> stock". Este gate es su gemelo y se documenta igual.
> **DÓNDE VIVE EL CAMBIO, Y ES EL PUNTO DEL DISEÑO: enteramente dentro de `Listar stock`** (query +
> `toolDescription`). **El `systemMessage` NO se toca** — verificado por aserción, byte a byte.
> Meterle una condición más a una sección con 64 era justo lo que venía fallando. El
> `toolDescription` es otra superficie: es lo que el modelo lee cuando decide **llamar** la tool,
> que es donde el log dice que se toma la decisión.
> **DEBILIDAD, DICHA DERECHO: `cliente_pidio_ver` SIGUE SIENDO UN JUICIO DEL MODELO.** Esto NO es
> determinístico como `ya_derivado` (que se calcula por SQL sobre el historial). Lo que se gana es
> (a) que el error **ya no se puede tapar redactando** —sin filas no hay lista— y (b) que el error
> es **visible en el log como un valor concreto**, no como una redacción a interpretar.
> **SI AL MEDIR SE VE QUE EL MODELO PONE 1 DE MÁS, el paso siguiente ya está identificado:**
> calcularlo por SQL con un patrón sobre el último mensaje del cliente en `mensajes_demo`, validado
> offline como se hizo con `ya_derivado` en v74 (37 burbujas etiquetadas a mano, 37/37).
> **ALCANCE (un cambio por vez):** el gate aplica SOLO a `tiene_permuta = 1`. La financiación tiene
> su propio embudo, que termina en el name-ask (v78) y no en una lista.
> **PRUEBA VINCULANTE OFFLINE** con los parámetros **EXACTOS del log 11206**: con
> `cliente_pidio_ver=0` la query **deja de devolver filas** (antes: 14); con `=1` vuelve a
> devolverlas. **Controles, los 5 pasan:** sin permuta NO bloquea (no rompe "quiero un auto de 20
> millones"), el stock general sin presupuesto NO se bloquea, la financiación sin permuta no se
> toca, y los 3 gates viejos (`tramo='fuera'`, `categoria='fuera'`, `precio_objetivo=0`) siguen
> funcionando igual.
> **Verificado:** **único nodo con diferencias `Listar stock`**, `systemMessage` **idéntico**
> (55.031 chars), trampa 3 comprobada sobre todo el workflow, los 5 invariantes pasan sobre v84.
> **AL PEGAR, MEDIR ASÍ. 2 campos del MISMO nodo:** `Listar stock` → `Query` y → `Description`.
> · **Humo primero:** *"reciben usados? tengo 25 millones"* → *"Toyota Etios 2020"* → *"110000 km"*,
>   y **mirar en el log qué valor mandó en `cliente_pidio_ver`**. Ese valor ES la medición: si manda
>   0 y no hay filas, el mecanismo anda; si manda 1, el fix no alcanza y hay que ir por el camino
>   de SQL.
> · `--case permuta-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000`, el caso SOLO.
>   **Baseline: v82 1/3, v83 2/4 — NO es determinístico**, así que un 4/4 hay que contrastarlo.
> · **CONTROLES obligatorios** (el riesgo es que ahora NO muestre nunca): `permuta-mas-efectivo`,
>   `permuta-una-pregunta-por-vez`, `presupuesto-aproximado`, `rango-14-20` y
>   `stock-general-completo` — los tres últimos porque el gate NO debe tocar los flujos sin permuta.
> · **`search_executions` EN CADA TANDA.**
> **DEUDA DE FONDO ANOTADA (no es un fix, es un proyecto):** `## Permuta` con la mitad del prompt y
> 64 prohibiciones va a hacer caro CADA bug de esa sección. En algún momento conviene rediseñarla
> en vez de seguir parchándola. Planteado a Agustina el 2026-08-05, sin decidir.

> **v83 DESPLEGADO Y MEDIDO: NO FUNCIONA. 0/4, el abanico sigue saliendo. Puntero: v83 vivo (no se
> revirtió: no rompe nada, simplemente no alcanza). Sesión 2026-08-05.**
> **DEPLOY VERIFICADO byte a byte:** 35/35 nodos idénticos a v83, único nodo distinto de v82
> `Franco (AI Agent)`, `systemMessage` **55.031 chars exactos**, 23 expresiones, **cero rastro** de
> la frase que autorizaba el dump, y los fixes de v78/v79/v81/v82 intactos (SQL incluido).
> **MEDICIÓN VÁLIDA — ventana 13:15:04–13:19:00 con `search_executions`: 0 ejecuciones en `error`.**
> `--case permuta-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000` → **0/4**. En el turno 3:
> **corridas 0 y 3 siguen listando autos sin que se los pidan**; corridas 1 y 2 repreguntan datos ya
> dados (el otro bug, abierto #3). Baseline v82: 1/3. v83: 2/4. **Sin mejora.**
> **POR QUÉ FALLÓ — GATEÉ EL GUION EQUIVOCADO, Y ES DIAGNOSTICABLE, NO MISTERIO:** el texto que
> Franco recita en las 4 corridas es *"…estas opciones te pueden servir: … y si querés estirar / de
> gama superior entregando tu usado"*. **Eso NO es el abanico de tramos que bloqueé** (ese dice
> "Intermedio:", "Alto:", y sólo apareció en 1 de 8 turnos): es la narrativa de **"DOS CAMINOS"**
> (`entra` / `estirar`), que vive **más abajo en la misma sección**, tiene su propio guion textual
> (*"tu efectivo cubre el total de estas, y el valor de tu usado te queda a favor"*) y **quedó
> intacta**.
> **LA LECCIÓN, MÁS FILOSA QUE LA TRAMPA 6 GENÉRICA:** el punto 5 nombraba las DOS cosas (*"ni
> tramos ni 'dos caminos'"*), y yo desarmé el guion de una sola. **Cuando una sección tiene DOS
> guiones concretos que listan autos, gatear uno no sirve: el que queda gana.** Es exactamente lo
> que el CLAUDE.md dice del fix de v78 ("arreglar uno solo no sirve porque el que queda gana") y no
> lo apliqué completo. Contarlo así para que el próximo intento no repita el recorte.
> **PRÓXIMO INTENTO (analizado, NO implementado, decisión de Agustina):** reemplazar TAMBIÉN el
> guion de "dos caminos" dentro de los 4 puntos, de modo que ninguno de los dos scripts que listan
> autos sea alcanzable antes del sí. El eval ya está escrito y calibrado; **ojo con el baseline: NO
> es determinístico** (v82 1/3, v83 2/4), así que un 4/4 post-fix hay que contrastarlo con
> controles.
> **NO SE REVIRTIÓ v83:** los controles no se corrieron todavía, pero el cambio sólo agrega el
> guion del ofrecimiento y saca una frase permisiva; no rompe nada medido. Si se decide revertir,
> es un solo campo.
>
> **(entrada previa) EL ABANICO SE OFRECE, NO SE DISPARA SOLO — preparado (v83).**
> Captura: en la progresión de permuta, apenas el cliente contesta los km del usado (*"110000 km"*),
> Franco le dumpea el abanico completo de capacidad de compra (tramos entrada/Intermedio/Alto con
> Amarok, Vento, S10, Hilux, T-Cross) + 4 cards, **sin que el cliente haya pedido ver opciones**.
> **DECISIÓN DE AGUSTINA (2026-08-05), tomada con las opciones a la vista:** tras tomar los datos
> del usado Franco **OFRECE y espera el sí**; si acepta y no hay presupuesto conocido, primero
> pregunta el presupuesto. Y **si el cliente ya mostró interés en un auto puntual, NO se le ofrecen
> alternativas**: se toman los datos y se pregunta si quiere ver más alternativas o derivación
> directa. **Alcance, en sus palabras:** el cliente tiene que PEDIR ver opciones (por un
> requerimiento/filtro, o porque tiene presupuesto y no sabe qué comprar). *"Quiero un auto de 20
> millones"* SÍ es pedir opciones y sigue funcionando como hoy.
> **LO QUE HAY QUE ENTENDER, PORQUE CAMBIA EL FIX: la regla ya existía CUATRO veces** y las cuatro
> se violaron en la misma respuesta: (A) *"si ya venís en la progresión de permuta y tenés el auto y
> los kilómetros del usado, NO corras este punto ni muestres opciones"*; (B) el guion de ofrecer una
> de dos; (C) *"Nunca saltees directo al abanico"*; (D) *"ni le muestres autos que no pidió"*.
> **Agregar una quinta prohibición no iba a servir** — es el patrón que el CLAUDE.md documenta tres
> veces (trampa 6).
> **EL HALLAZGO QUE LO EXPLICA — no faltaba una regla, HABÍA UNA QUE AUTORIZABA EL DUMP:**
> *"OJO: dar un anticipo/efectivo y querer ver qué le entra YA es pedir opciones —no le exijas que
> diga 'mostrame el catálogo' para armar el abanico; con anticipo declarado y sin modelo puntual,
> **el abanico VA**."* Esa frase se escribió a propósito en su momento (el abanico de tramos costó
> ~12 versiones, v40-v52) y le ganaba a las otras cuatro porque **dice lo contrario, en positivo y
> con más detalle**. La decisión de hoy la revierte.
> **Eval nuevo `permuta-no-dumpea-abanico-sin-pedirlo` (`evals/cases.json`, 74→75 casos).**
> **Baseline v82: 0/3 — PERO FALLA POR TRES MOTIVOS DISTINTOS y sólo uno es este bug. No leer el
> 0/3 como si fuera todo lo mismo:**
> · corrida 1: **dumpea el abanico. ES el bug — reproduce 1 de 3, no siempre.**
> · corrida 2: va al name-ask, que es lo que HOY dice el punto 5 → **comportamiento correcto según
>   el prompt viejo**; esta decisión lo reemplaza por el ofrecimiento.
> · corrida 0: **repregunta *"me dejás el modelo y año de tu Toyota Etios?"*** justo después de que
>   se lo dijeron. **ES OTRO BUG** — el abierto #3 de este archivo ("al pedir datos del usado,
>   repregunta los ya dados", 2026-07-22), que sigue vivo y **ahora tiene instrumento que lo caza**.
>   NO se toca en v83: un cambio por vez. En 2 de 3 corridas, además, al pedirle "mostrame
>   alternativas" contesta con otra pregunta en vez de mostrar.
> **`scripts/abanico-solo-si-lo-piden.mjs` (v82→v83), 1 nodo, 2 guiones REEMPLAZADOS:**
> · **(A)** el turno posterior a tener usado + km deja de ser el name-ask y pasa a ser el
>   **OFRECIMIENTO**, con guion textual (*"la tasación final de tu usado la hace un asesor viéndolo
>   en persona. Querés que te muestre alternativas que te entren con eso, o preferís que un asesor
>   te contacte directo?"*), `auto_ids` VACÍO y **frenar hasta que conteste**.
> · **(B)** la frase que autorizaba el abanico se reemplaza por su **opuesta**: va SOLO después del
>   sí, con ejemplos concretos de qué cuenta como sí (*"dale, mostrame"*), y si con el sí no hay
>   presupuesto conocido se pregunta eso primero — **y si ya lo dio, NO se lo repregunta**.
> **SE PRESERVA (asertado):** la rama `INTERÉS PUNTUAL` (que ya decía lo que Agustina quiere), el
> abanico en sí (se **gatea**, no se borra), el gate de `precio_objetivo=0`, y los fixes de v78,
> v79, v81 y v82.
> **Verificado:** **único nodo con diferencias `Franco (AI Agent)`**, `systemMessage` 54.238 →
> 55.031 chars, expresiones `{{ }}` sin cambios, los 5 invariantes pasan sobre v83.
> **AL PEGAR, MEDIR ASÍ. 1 campo:** `Franco (AI Agent)` → `System Message`.
> · `--case permuta-no-dumpea-abanico-sin-pedirlo --repeat 4 --delay 25000`, el caso SOLO.
>   **Ojo al leer:** el baseline 0/3 mezcla tres fallas; lo que este cambio tiene que mover es que
>   el turno 3 **no traiga autos** (`cards_empty` + `images_empty` + sin tramos) y **sí traiga el
>   ofrecimiento**. La repregunta del usado puede seguir apareciendo: **no es de este cambio**.
> · **CONTROLES obligatorios** (el riesgo es que ahora NO muestre nunca, o que rompa el embudo que
>   costó v40-v52): `permuta-mas-efectivo`, `permuta-una-pregunta-por-vez`,
>   `presupuesto-aproximado` y `rango-14-20` — estos dos últimos porque el abanico NO debe verse
>   afectado cuando el cliente sí pide opciones por presupuesto.
> · **`search_executions` EN CADA TANDA.**

> **Sesión 2026-08-05. TRACCIÓN 4x2/4x4. HECHO, DESPLEGADO (v82) Y MEDIDO: 2/3 → 4/4. Puntero: v82
> vivo. Sin pushear a git.**
> **DEPLOY VERIFICADO byte a byte:** 35/35 nodos idénticos a v82, **únicos nodos que difieren de
> v81: `Buscar auto` y `Franco (AI Agent)`**, `connections` idénticas, `active: true`. En el vivo:
> el bloque de tracción con sus dos ramas, **2 ocurrencias de `$fromAI('traccion')` byte-idénticas
> (trampa 3)**, los 8 `translate()` de v80, `systemMessage` de **54.238 chars exactos** arrancando
> con `=`, la línea nueva del prompt presente y el guion de v81 y el piso de v79 intactos.
> **PRUEBA VINCULANTE EN VIVO — el antes/después del mecanismo. Ejecución `11132`** (humo,
> *"busco una pickup 4x2"*):
> · **antes (11127):** `marca_o_modelo: "Amarok 4x2"` → **0 filas** → reintento sin la tracción →
>   **4 pickups, 3 de ellas 4x4**, que es lo que listaba.
> · **ahora (11132):** `marca_o_modelo: "pickup"` **+ `traccion: "4x2"` SEPARADO** → **1 fila**, la
>   S10, `match_tipo: "exacto"`, en 31 ms y **una sola llamada**. Franco separó el parámetro tal
>   como se lo dice la línea nueva del prompt: eso era justo lo que no se podía dar por sentado.
> **MEDICIÓN: `--case traccion-4x2-no-ofrece-4x4 --repeat 4 --delay 25000`, el caso SOLO → 4/4**
> (baseline v81 re-puntuado: 2/3). **Ventana 02:18:55–02:21:25 verificada: 0 ejecuciones en
> `error`.** Las 4 corridas muestran SOLO la S10, cero 4x4.
> **DOS COSAS QUE SALIERON GRATIS** (no eran el objetivo de este cambio, así que no me las anoto
> como resueltas — hay que medirlas aparte si se quieren dar por cerradas): **2 de 4** arrancan con
> *"No tenemos Amarok 4x2, pero sí una Chevrolet S10 4x2…"* (el síntoma 2 de la captura) y **3 de 4**
> incluyen el precio (el síntoma 4). Tiene sentido: con la tool devolviendo la fila correcta, Franco
> deja de improvisar.
> **MEDIA OK, ojo con leer mal el volcado:** en los 4 turnos hay **3 imágenes** (es la rama de 1-2
> autos, que manda fotos en vez de cards). No hay TIPO B acá; mirar sólo `product_cards` engaña.
> **CONTROLES: 8/9**, ventana 02:24:10–02:29:40 con **0 ejecuciones en `error`**.
> `modelo-no-stock-alternativas-carroceria` **3/3** y `buscar-marca-solo-esa-marca` **3/3** — o sea
> que el riesgo del cambio (que el filtro nuevo RESTRINJA de más y deje búsquedas vacías) **no se
> materializó**. La única roja es `carroceria-lista-pura-y-alternativas-con-contexto` por
> `media_si_lista_autos` (TIPO B) **en el mismo caso y el mismo turno 3 donde ya había aparecido
> midiendo v80, antes de que v82 existiera**: es el falso positivo de instrumento ya documentado,
> no el filtro de tracción. **v82 QUEDA CERRADO.**
>
> **(entrada previa, antes de desplegar) TRACCIÓN — preparado (v82).**
> Captura: el cliente dice *"Estoy buscando una 4x2"* y Franco le vuelve a ofrecer la misma
> **Amarok 2018, que es 4x4**, justificándolo con *"si no te molesta que una sea 4x4 y la otra
> 4x2"*.
> **PRUEBA VINCULANTE EN EL LOG — ejecución `11127`, los DOS runIndex del turno:**
> · `Buscar auto` con **`marca_o_modelo: "Amarok 4x2"`** → **`[{"success": true}]`, CERO FILAS.**
>   El `marca_o_modelo` se compara contra `marca || modelo || carroceria || color`, **donde "4x2"
>   no aparece nunca**. Franco SÍ intenta filtrar la tracción: la mete ahí porque no tiene otro
>   lugar donde ponerla.
> · reintento con `marca_o_modelo: "Amarok"` → le vuelven **las 4 pickups** (Amarok exacta +
>   Ranger/S10/Hilux como alternativas por carrocería, el fix de v70), **3 de ellas 4x4**. Eso es
>   lo que termina listando.
> **CONSECUENCIA MÁS ANCHA QUE LO REPORTADO: hoy "busco una Amarok 4x4" TAMBIÉN devuelve 0 filas**,
> por la misma razón. No es sólo el 4x2.
> **ES LA OTRA MITAD DE UN BUG DE v61.** Aquella captura era literalmente *"Amarok 4x2 2022-24"*;
> entonces se arreglaron las alternativas por carrocería (medido, funcionó) y **el filtro de
> tracción nunca se implementó**. Quedó abierto sin figurar como abierto. Anotarlo: arreglar la
> mitad visible de un bug deja la otra esperando una captura nueva.
> **EL DATO EXISTE EN `content`, NO EN `metadata`:** `armar_content()` del .py concatena
> `Versión/Edición`, así que la fila del id 15 arranca con *"Volkswagen Amarok 4x4 2018…"*.
> `armar_metadata()` no lo guarda. Por eso el filtro va contra `content` — **y el mecanismo ya
> existe en el mismo nodo**: `Buscar auto` filtra transmisión con `content ILIKE '%transmisión
> autom%'`. Este cambio es su gemelo, con la misma forma.
> **Eval nuevo `traccion-4x2-no-ofrece-4x4` (`evals/cases.json`, 73→74 casos).**
> **⚠️ MI PRIMER INSTRUMENTO ESTABA MAL Y LO CORREGÍ — vale la pena anotarlo.** Puse el peso
> objetivo en `cards_titles_not_contains`, pero **en las 3 corridas hubo CERO cards** (TIPO B), así
> que ese check no comprobaba nada: la corrida que TENÍA el bug (lista Amarok, Hilux y Ranger)
> **salió en verde**. Corregido a `text_not_matches "(?i)hilux|ranger"` — Hilux y Ranger son 4x4 y
> **nunca se nombraron en la conversación**, así que si aparecen es que dumpeó las pickups sin
> filtrar. La Amarok queda FUERA del check de texto a propósito: mencionarla para **descartarla**
> (*"la que te mostré es 4x4, no 4x2"*) es correcto y una corrida lo hizo bien.
> **Baseline v81, re-puntuado offline sobre las corridas guardadas (sin gastar cuota de nuevo):
> 2/3.** O sea que la CONDUCTA falla ~1 de 3 (con 4 filas en la mano el modelo suele acertar el
> filtro manual), pero **la CAUSA falla siempre**: la llamada con la tracción adentro de
> `marca_o_modelo` devuelve 0 filas el 100% de las veces.
> **`scripts/traccion-4x2-4x4.mjs` (v81→v82), 2 nodos — UN mecanismo en dos lugares (hacer
> alcanzable el filtro), no dos reglas que compiten; mismo criterio que v30 con `anio_min`:**
> · **`Buscar auto`**: bloque `traccion` pegado al de transmisión, con la misma forma.
> · **`Franco`, `## Buscar auto`**: la enumeración de criterios ahora incluye la tracción, **y le
>   dice dónde va**, que es lo que el log muestra que no sabe: *"La tracción va SIEMPRE en el
>   parámetro `traccion`, NUNCA metida adentro de `marca_o_modelo`… Se separa: marca_o_modelo=
>   "Amarok" y traccion="4x2""*. Más la regla de que la otra tracción NO es alternativa válida.
> **TRAMPA 3, CUBIERTA DOBLE** (es la que rompe el workflow entero, no un nodo): las 2 ocurrencias
> de `$fromAI('traccion')` se generan de **una sola constante interpolada** —única forma de
> garantizar que sean byte-idénticas— y además el script **recorre todo el workflow** verificando
> que ninguna key tenga dos firmas distintas.
> **PRUEBA VINCULANTE OFFLINE** sobre los `content` reales de las 4 pickups: `traccion="4x2"` → **id
> 16 y nada más** (la Amarok queda afuera); `traccion="4x4"` → 13, 14, 15; **`traccion=""` → los 6,
> no filtra nada**. Ese último es el control que importa: con el parámetro vacío el `ELSE TRUE`
> deja todo igual que hoy, así que el cambio no puede romper el resto de las búsquedas.
> **Verificado:** 35/35 nodos, **únicos nodos con diferencias `Buscar auto` y `Franco`**,
> `systemMessage` 53.773 → 54.238 chars con las expresiones `{{ }}` sin cambios, el plegado de
> tildes de v80 y el guion de v81 intactos, los 5 invariantes pasan sobre v82.
> **AL PEGAR, MEDIR ASÍ. 2 campos:** `Buscar auto` → `Query` y `Franco (AI Agent)` → `System
> Message`.
> · **Humo primero** (un error de sintaxis deja la tool sin filas): *"busco una pickup 4x2"* y
>   confirmar **en el log** que `Buscar auto` devuelve filas y que Franco mandó
>   `traccion: "4x2"` **separado** de `marca_o_modelo`. Ese parámetro en el log es la medición real.
> · `--case traccion-4x2-no-ofrece-4x4 --repeat 4 --delay 25000`, el caso SOLO. Baseline: **2/3**.
> · **CONTROLES** (el riesgo es que el filtro nuevo restrinja de más y deje búsquedas sin
>   resultados): `modelo-no-stock-alternativas-carroceria`, `buscar-marca-solo-esa-marca`,
>   `carroceria-lista-pura-y-alternativas-con-contexto` y el de transmisión si existe.
> · **`search_executions` EN CADA TANDA**, no una por sesión.
> **LO QUE NO SE TOCA (un cambio por vez):** `Listar stock` NO recibe el parámetro. Si al medir se
> ve que Franco resuelve la tracción por ahí, ese es el paso siguiente — el log lo dice sin
> ambigüedad. Y quedan los otros 3 síntomas de la misma captura (ver abajo).
> **LOS OTROS 3 SÍNTOMAS DE ESA CAPTURA, DIAGNOSTICADOS Y NO TOCADOS:**
> · **"Es ideal para quien necesita tracción real sin pagar una unidad más reciente" — TRAMPA 7:
>   NO la inventó Franco.** Es la `descripcion` curada del id 15, en
>   `scripts/gen-descripcion-sql.mjs:142` y cargada en `metadata` (*"La opción para quien necesita
>   tracción real y no quiere pagar una unidad reciente."*). La parafrasea porque el `## Paso 3` se
>   lo pide. **No se arregla en el prompt: se reescribe la descripción con el generador y sus
>   aserciones**, como el fix de condicionantes de v22. Lo corre Agustina (es un UPDATE a la base).
> · **No avisó que no tiene la Amarok 2023** — la regla YA existe en `## Buscar auto` (*"Si esa
>   variante o año no está pero el MODELO sí está, DECÍLO"*, de v61). Es adherencia.
> · **Precio ausente en la primera respuesta** — la regla YA existe en `## Paso 3` (*"precio, año,
>   km, motor…"*, con el precio primero). Es adherencia.
> Los dos de adherencia van juntos y MEDIDOS al final: son el terreno del yo-yo (reforzar una regla
> afloja otra), así que no se tocan de taquito.

> **Sesión 2026-08-05. El número del asesor. DESPLEGADO (v81) Y MEDIDO: el caso objetivo pasa de
> 0/3 a 4/4. CONTROLES A MEDIO MEDIR — DOS TANDAS CONTAMINADAS POR TPM, NO SE PUEDE CONCLUIR.
> Puntero: v81 vivo. Sin pushear a git.**
> **DEPLOY VERIFICADO byte a byte** (`get_workflow_details` vs `franco-n8n-v81.json`): 35/35 nodos
> idénticos a v81, **único nodo que difiere de v80: `Franco (AI Agent)`**, `connections` idénticas,
> `active: true`. En el vivo: `systemMessage` de **53.773 chars exactos** arrancando con `=`
> (trampa 1), **23 expresiones** `{{ }}`, los dos guiones nuevos presentes, **cero rastro** de la
> regla vieja escrita como condición, y el fix de v78 (2 menciones del name-ask de financiación),
> el piso de v79 y los 8 `translate()` de v80 **intactos**.
> **MEDICIÓN VÁLIDA (ventana 01:15:08–01:16:40 verificada con `search_executions`: 0 errores):**
> `numero-pedido-explicito-se-da-de-una` **0/3 → 4/4**. Las 4 corridas dan la respuesta pedida por
> Agustina, **textual y sin variación**: *"Claro, el WhatsApp de Automotores Tucumán es
> +54 381 555-0134. Y si preferís que un asesor te contacte directamente, decime y lo arreglo."* →
> *"dale, si por favor"* → *"Perfecto, para que un asesor te contacte, me dejás tu nombre y
> apellido?"*. **Ojo con la rigidez:** las 4 usan el guion palabra por palabra. Es trampa 6
> funcionando, pero si el cliente pide el número dos veces va a sonar robótico.
> **CONTROL VÁLIDO (ventana 01:16:47–01:19:10, 0 errores):** `derivacion-aceptada-igual-pide-nombre`
> **3/4**. Baseline v78: 7/8. La falla es la forma ya documentada (cierra mostrando opciones en vez
> de pedir el nombre). **Cae dentro del rango; no hay evidencia de regresión, pero con 4 corridas
> tampoco se puede probar que no la haya.**
> **⚠️ DOS TANDAS DE CONTROL INVÁLIDAS — TRAMPA 5, Y ME LA COMÍ YO EN ESTA MISMA SESIÓN.**
> `cierre-conversacion` + `derivacion-completada-no-reofrece-visita` +
> `derivacion-cierre-no-reofrece-ni-inventa` (8/9) y después
> `derivacion-completada-no-reofrece-visita` solo ×5 (2/5) → en la ventana 01:19:14–01:27:50 hay
> **17 ejecuciones en `error`**. Verifiqué la ventana del caso OBJETIVO (limpia) y después corrí los
> controles uno atrás del otro **sin dejar recuperar la cuota**. Y no es un detalle cosmético:
> **este control depende del estado del lead, que es justo lo que escribe el CRM**; con el CRM
> caído el lead se queda en "En conversación", `estado_cliente` no le dice a Franco que ya derivó,
> y vuelve a ofrecer el asesor — o sea que **esos turnos no pueden testear nada**. Ese 4/8 contra el
> 7/8 de v78 **no es una medición, es ruido**.
> **LA SEÑAL QUE SÍ SOBREVIVE AL RUIDO, Y HAY QUE DESCARTARLA MIDIENDO:** en una corrida Franco
> escribió *"**Querés que te pase el WhatsApp** para que vayas coordinando o preferís que un
> asesor…"*. Ofrecer el WhatsApp por su cuenta está prohibido **incondicionalmente** (no depende de
> si el lead está derivado), así que esa falla **no la explica el CRM caído**, y es vocabulario que
> **v81 introdujo**. Hipótesis: el guion nuevo de `## Paso 4` es un ejemplo CONCRETO de ofrecer
> contacto y por trampa 6 le gana a la prohibición ABSTRACTA que quedó en el bullet de abajo
> ("Lo que NO hacés es ofrecerlo vos"). Si se confirma, el fix es acotar el guion con la condición
> de disparo adentro del propio guion, no en un bullet aparte.
> **RE-MEDICIÓN HECHA — NO HAY REGRESIÓN. `derivacion-completada-no-reofrece-visita` 5/5.**
> Corrido **solo**, `--repeat 5 --delay 25000`, tras esperar 6 minutos a que se recuperara la
> cuota. **Ventana 02:00:24–02:04:20 verificada con `search_executions`: 0 ejecuciones en `error`.**
> Contra el **7/8** de v78: sin evidencia de regresión (5 corridas tampoco alcanzan para probar
> mejora). **El 4/8 anterior era ruido de TPM, confirmado.**
> **Y LA SEÑAL DEL WHATSAPP NO REPRODUCE: 0/5 con el CRM sano.** La explicación que cierra: con el
> CRM caído el lead no se actualizaba, Franco no sabía que ya había derivado, y estaba improvisando
> el cierre entero — en esa improvisación salió el vocabulario nuevo. Con el estado del lead bien
> escrito, no pasa. **Queda dicho igual que apareció una vez en condiciones sucias**, así que si
> reaparece en una demo, el sospechoso es el guion de `## Paso 4` y el fix es meterle la condición
> de disparo adentro del propio guion.
> **LECCIÓN DE MÉTODO, PARA MÍ, DE ESTA MISMA SESIÓN:** verifiqué la ventana del caso OBJETIVO y me
> quedé tranquilo, pero después encadené tres tandas de control sin verificar y sin dejar recuperar
> la cuota. **La verificación de `search_executions` va en CADA tanda, no una vez por sesión.** Y
> `--delay 25000` + esperar entre tandas es lo que hizo la diferencia entre 4/8 y 5/5 sobre el mismo
> workflow.
> **RE-MEDICIÓN DE LOS OTROS DOS: `cierre-conversacion` + `derivacion-cierre-no-reofrece-ni-inventa`
> → 6/6.** Ventana 02:06:17–02:10:25 verificada: **0 ejecuciones en `error`**.
> **v81 QUEDA CERRADO. Ningún control bajó, con todas las ventanas verificadas limpias:**
> objetivo **4/4** (baseline 0/3) · `derivacion-completada-no-reofrece-visita` **5/5** (v78: 7/8) ·
> `derivacion-aceptada-igual-pide-nombre` **3/4** (v78: 7/8, dentro del rango) ·
> `cierre-conversacion` y `derivacion-cierre-no-reofrece-ni-inventa` **6/6**.
>
> **(entrada previa, antes de desplegar) El número del asesor — preparado (v81).**
> Captura de Agustina. El cliente abre con *"me pasarías el número de un asesor directamente?"* y
> Franco (1) le **narra la condición del prompt** (*"el teléfono y WhatsApp te los puedo pasar si me
> los pedís explícitamente"*), (2) **no reconoce que ese primer mensaje YA es el pedido explícito**
> —es **textualmente el ejemplo que trae el prompt**, *"me pasás un número?"*— y condiciona el
> número a que le den nombre y apellido, y (3) cuando el cliente contesta *"pasamelo, te lo pido
> explícitamente"*, le da el número al toque y **ya no pide el nombre** que había dicho que
> necesitaba.
> **TRAMPA 7, DESCARTADA PRIMERO Y CON EL CÓDIGO EN LA MANO:** el guard de cierre de
> `Armar respuesta` sólo corre con `autos.length >= 1` y este turno no tiene autos; además el guard
> no menciona teléfono ni WhatsApp. **Lo escribió Franco** → el fix va al prompt.
> **Eval nuevo `numero-pedido-explicito-se-da-de-una` (`evals/cases.json`, 72→73 casos). FALLA
> PRIMERO: baseline v80 `--repeat 3 --delay 15000` → 0/3**, y **peor que la captura**: 2 de 3 **ni
> siquiera dan el número** y recitan la regla (*"los doy solo si me los pedís explícitamente"* /
> *"te los puedo dar si me los pedís expresamente"*), y **3 de 3** piden nombre y apellido en el
> turno 1. Los checks son objetivos (el número en el texto, la palabra "explícitamente" prohibida,
> "nombre y apellido" prohibido en el turno 1 y EXIGIDO en el turno 2), no de parser.
> **ROOT CAUSE — DOS REGLAS QUE CHOCAN Y NINGUNA DEFINE PRECEDENCIA:** `## Paso 4` dice que el
> teléfono se da *"SOLO si el cliente lo pide EXPLÍCITAMENTE"*; `# Derivación a un asesor` dice que
> si el cliente pide hablar con alguien se le pide nombre y apellido. *"El número de un asesor"*
> dispara **las dos**, y Franco hace una en el turno 1 y la otra en el turno 2. **No falla una
> regla: cumple las dos en orden distinto.**
> **TRAMPA 6 EN SU FORMA MÁS PURA, Y ES LO QUE HAY QUE ANOTAR:** la regla vieja está escrita **como
> una condición** ("lo das SOLO si te lo piden explícitamente"), o sea que le deja al modelo una
> **oración sobre el requisito**. Cuando llega un pedido de número, lo que más se parece a lo que
> tiene que escribir es esa oración, y la recita. **No alcanza con prohibirle que la diga: hay que
> que no exista una oración así para copiar.** Por eso la regla nueva está escrita como una
> **ACCIÓN con guion textual** en vez de como una condición.
> **`scripts/numero-se-da-de-una.mjs` (v80→v81), 1 nodo, 2 guiones — precedente de v23 (la regla va
> en el punto de uso Y en el de disparo; arreglar uno solo no sirve porque el que queda gana):**
> · **`## Paso 4`** — se REEMPLAZA: *"SI EL CLIENTE TE PIDE UN NÚMERO, SE LO DAS EN EL ACTO Y SIN
>   CONDICIONES"*, con guion textual (*"Claro, el WhatsApp de {empresa} es {teléfono}. Y si
>   preferís que un asesor te contacte directamente, decime y lo arreglo."*) y **anti-ejemplo de
>   las dos frases exactas que salieron medidas**.
> · **`# Derivación a un asesor`** — se agrega la precedencia donde hoy se dispara el pedido de
>   nombre: *"pedir un NÚMERO no es aceptar el contacto"*.
> **El guion usa `empresa_nombre` y `empresa_telefono` del Config, no el número hardcodeado** (21→23
> expresiones `{{ }}`): esto es multi-tenant, cablear el teléfono de Tucumán sería deuda nueva.
> **LO QUE SE PRESERVA A PROPÓSITO** (era el riesgo de aflojar de más, y está asertado): Franco
> sigue **sin ofrecer** el teléfono por su cuenta y sigue sin ofrecérselo a quien **ya está
> derivado**; se conserva el guion del pedido de nombre y el fix de v78 (financiación cierra
> pidiendo el nombre).
> **Verificado:** `systemMessage` 52.583 → 53.773 chars, **único nodo con diferencias
> `Franco (AI Agent)`** y dentro de él sólo `systemMessage`; el piso de v79 y el plegado de tildes
> de v80 **intactos**; los 5 invariantes pasan sobre v81.
> **AL PEGAR, MEDIR ASÍ. 1 campo:** `Franco (AI Agent)` → `System Message`.
> · `--case numero-pedido-explicito-se-da-de-una --repeat 4 --delay 15000`, **el caso SOLO**.
>   Baseline a batir: **0/3**.
> · **CONTROLES obligatorios** (el riesgo es que ahora ande repartiendo el teléfono de más, o que
>   deje de pedir el nombre al derivar): `cierre-conversacion`,
>   `derivacion-completada-no-reofrece-visita`, `derivacion-cierre-no-reofrece-ni-inventa` y
>   `derivacion-aceptada-igual-pide-nombre` (el de v78, que es el que puede romperse).
> · **ANTES de creerle al número**, `search_executions` (status `error`, con `startedAfter` Y
>   `startedBefore` cubriendo la ventana exacta).

> **Sesión 2026-08-04. DOS BUGS de una captura de Agustina: (1) Franco baja de gama sin que se lo
> pidan · (2) las listas por carrocería se mezclan. PREPARADOS (v79 y v80), NO DESPLEGADOS.
> Puntero: v78 SIGUE VIVO. Sin pushear a git.**
>
> **BUG 1 — HECHO, DESPLEGADO (v79) Y MEDIDO. FUNCIONA. De 0/3 a 4/4.**
> **DEPLOY VERIFICADO byte a byte** (`get_workflow_details` vs `franco-n8n-v79.json`): 35/35 nodos
> con `parameters` **idénticos a v79**, los **únicos** dos nodos que difieren de v78 son
> `Listar stock` y `Franco (AI Agent)` (los dos del cambio), `connections` idénticas,
> `active: true`. En el vivo: el piso `* 0.90` presente y **cero** `0.60` residual, techo
> `1.25`/`1.40` intactos, `systemMessage` de **52.583 chars exactos** arrancando con `=`
> (trampa 1) y 21 expresiones `{{ }}`, con el guion nuevo y el anti-ejemplo presentes y **cero**
> rastro del guion viejo (`mencionás una sola`).
> **MEDICIÓN: `--case presupuesto-no-baja-de-gama --repeat 4 --delay 20000`, el caso SOLO → 4/4**
> (baseline v78: **0/3**, y 9/9 contando las corridas del bug 2). **Ventana verificada con
> `search_executions` (00:22:40–00:24:30, `startedAfter` Y `startedBefore`): 0 ejecuciones en
> `error`.** Las 4 corridas dan prácticamente la misma respuesta: `entra` = EcoSport + Kangoo,
> `estirar` = 208 + Onix con el gancho de financiación/permuta, cierre ofreciendo el stock
> completo. **Cronos, Etios, Gol Trend y Fiesta desaparecieron de las 4.**
> **UN EFECTO QUE NO PREDIJE, y que es mejor de lo que anuncié:** las **cards también quedaron
> limpias** (4 cards, sólo la banda). Yo había avisado que seguirían trayendo el catálogo entero
> porque el prompt dice *"En 'auto_ids' van TODOS los autos que devolvió la herramienta"*. Franco
> está mandando sólo los de la banda. Bien para la demo, pero **es adherencia del modelo, no una
> garantía**: si en alguna corrida vuelven las 9 cards, no es un bug nuevo.
> **CONTROLES (`--repeat 3 --delay 10000`, tanda aparte, 0 ejecuciones en `error` en la ventana
> 00:24:46–00:28:40): 9/12.** `presupuesto-aproximado` **3/3**, `rango-14-20` **3/3**,
> `km-con-presupuesto` **3/3** — o sea que el riesgo real del cambio (que ahora muestre DE MENOS o
> diga "no hay opciones") **no se materializó**.
> **LA ÚNICA ROJA ES PREEXISTENTE Y ESTÁ PROBADO, NO SUPUESTO:** `permuta-mas-efectivo` 0/3, y la
> falla es **sólo** `text_matches "(?i)asesor|tasa"` en el turno 1 — el contenido del caso (los dos
> caminos: lo que cubre el efectivo + gama superior con la permuta) sale **bien en las 3**.
> **`evals/baseline-v33.json` ya tiene esa falla, con la línea idéntica** (`turno 1 · text_matches:
> no matcheó /(?i)asesor|tasa/`), y en `baseline-v23.json` todavía pasaba. O sea que se rompió
> entre v24 y v33. **El culpable es v25→v29**, que reescribió `## Permuta` e instaló la regla
> *"NO DERIVES TODAVÍA. (...) Ofrecer el asesor en el primer turno le dice que ya no le podés
> aportar nada"*. **El check exige exactamente lo que un cambio posterior sacó a propósito: el
> eval contradice al prompt.** Es deuda de instrumento, no conducta.
> **DECISIÓN PENDIENTE (no la tomé yo, porque tocar un check para que se ponga verde tiene que ser
> explícito):** sacar `text_matches "asesor|tasa"` del turno 1 de `permuta-mas-efectivo`, o moverlo
> a un turno posterior donde derivar SÍ corresponde.
> **HONESTIDAD SOBRE LO QUE NO QUEDÓ CERRADO:** en 1 de las 3 corridas de permuta Franco igual
> mostró el Gol Trend ($9,2M contra 12M de anticipo), que con el piso nuevo está etiquetado
> `economica`. **No es una regresión** (antes de v79 estaba etiquetado `entra` y salía igual), pero
> muestra que el guion nuevo de `# Enfoque comercial` **no alcanza del todo a la narrativa de
> `## Permuta`**, que tiene guion propio. Es la trampa 6 otra vez. Si molesta en la demo, el fix es
> replicar la regla en `## Permuta`; no lo hice para no meter dos cambios en la misma versión.
> **Puntero: v79 vivo.** `state-sync.mjs` pendiente de bumpear a v79. Sin pushear a git.
>
> **(entrada previa, antes de desplegar) BUG 1 — reproduce 3/3, root cause en dos capas.**
> Captura: a *"quiero un auto de 20 millones o menos"* Franco lista EcoSport 19,8M y Kangoo 18,5M
> (bien) y en la MISMA lista mete Cronos 16,8M (84%) y Etios 12,5M (62%), y encima agrega
> *"Además, te menciono una opción económica por debajo del presupuesto: Volkswagen Gol Trend 2018
> — $9.200.000"* (46%). **Eval nuevo `presupuesto-no-baja-de-gama` (`evals/cases.json`, 70→72
> casos). FALLA PRIMERO: baseline v78 `--repeat 3 --delay 20000` → 0/3**, y no es varianza: las 3
> corridas ponen Cronos y Etios como `entra`, 2 de 3 agregan Gol Trend o Fiesta. Reapareció además
> en las 6 corridas del bug 2, o sea **9 de 9**.
> **ROOT CAUSE, DOS CAPAS, Y HAY QUE TOCAR LAS DOS:**
> · **(A) determinística**, en el `CASE` de `Listar stock`: `categoria='entra'` abarca
>   `[0, presupuesto]` **sin piso**, así que el Cronos y el Etios llegan etiquetados igual que la
>   EcoSport. Franco no elige mal: obedece la etiqueta (`- Recomendás 2 a 5 de los "entra"`).
> · **(B) de lenguaje**, en `# Enfoque comercial`: el guion *"Si hay una `economica` que aporta,
>   mencionás una sola"* **es** la burbuja del Gol Trend.
> **ARREGLAR SOLO EL SQL LO EMPEORA** y por eso van juntas: con el piso nuevo hay MÁS autos
> etiquetados `economica` (para 20M: Cronos, Etios, Gol, Fiesta) y ese guion sigue mandando a
> mencionar uno. Es el precedente de v14 (arregló el dato, dejó el lenguaje, y costó v19).
> **`scripts/piso-de-gama-presupuesto.mjs` (v78→v79), 2 nodos.** `Listar stock`: `economica` pasa
> de `<= objetivo*0.60` a `< objetivo*0.90` — una rama del CASE, **ningún WHERE tocado** (aserción:
> sólo reetiqueta, no puede cambiar la cantidad de filas). `Franco`: se **REEMPLAZA** el guion
> (trampa 6, no una prohibición arriba) con anti-ejemplo textual de las dos frases que producen el
> bug, se redefine el vocabulario de la etiqueta, y se agrega la salida para cuando `entra` queda
> vacío (si no, lo más a mano que tiene para improvisar es justamente bajar de gama).
> **El 0.90 sale de los números de Agustina y coincide con su ejemplo:** con un piso de 0.80 el
> Cronos (0.84) seguiría adentro, y ella lo nombró como inadmisible.
> **PRUEBA VINCULANTE OFFLINE** (patrón de TB-3/a2/v74): el script reimplementa el CASE en JS y lo
> corre contra los 17 autos reales con el presupuesto EXACTO de la captura. Con 20M queda
> `entra` = EcoSport + Kangoo; `estirar` = 208, Onix, Duster, Corolla; `economica` = Cronos, Etios,
> Gol, Fiesta. **Controles de la simulación, los 6 pasan:** sin presupuesto siguen saliendo los 17
> como `entra` (gate de v16); con 13M el Etios sigue `entra` (eval `km-con-presupuesto`); con 15M
> el Cronos sigue `estirar` (eval `presupuesto-aproximado`); y los dos bordes exactos del piso.
> **LO QUE NO SE TOCA, A PROPÓSITO:** el **techo sigue en 1.25/1.40** y no se toca el ladder de
> `tramo` (v49/a2).
> **DOS DECISIONES DE AGUSTINA, TOMADAS EL 2026-08-04. NO RE-PROPONER:**
> · **El techo queda en 25%, NO se baja a 20%.** Se le planteó en concreto (*"al que dice 20
>   millones, ¿le mostrás el Corolla de 24,8 como paso arriba con financiación?"*) y dijo que sí.
>   Nota de plomería para el que lo retome: el tope vive en DOS lugares (la receta de `precio_max`
>   del prompt y el multiplicador del `CASE`); tocar uno solo deja filas dentro de
>   `en_presupuesto` etiquetadas `fuera`, que dispara el protocolo de "no hay opciones" para autos
>   que sí entran. O los dos o ninguno.
> · **El piso de 10% aplica también con permuta/financiación**, con la misma regla para todos los
>   casos. Se evaluó relajarlo con `tiene_permuta` (para el argumento *"con tu usado lo cubrís
>   entero y te queda plata a favor"*) y se descartó: una sola regla es más simple de sostener y
>   de medir.
>
> **BUG 2 — HECHO, DESPLEGADO (v80) Y MEDIDO. LA CAUSA ESTÁ MUERTA, PROBADA CON EL MISMO INPUT.**
> **DEPLOY VERIFICADO byte a byte** (`get_workflow_details` vs `franco-n8n-v80.json`): 35/35 nodos
> idénticos a v80, **único nodo que difiere de v79: `Buscar auto`**, `connections` idénticas,
> `active: true`. En el vivo: **8 `translate()`**, cero `unaccent`, paréntesis balanceados, la
> query termina en `;`, el gate de una-sola-carrocería de v70 intacto, y el piso de v79 sigue
> puesto en `Listar stock`.
> **PRUEBA VINCULANTE — el antes/después con el MISMO input, que es lo que cierra el caso.**
> Ejecución **`10819`**, `Buscar auto` con `marca_o_modelo: "sedan"` (sin tilde, **el parámetro
> exacto** del log 10763 del bug):
> · **antes (10763): `response: [{"success": true}]` — CERO filas**, y Franco caía a `Listar stock`
>   dos veces, recibía 6 autos de todas las carrocerías y filtraba de cabeza.
> · **ahora (10819): 4 filas, las 4 con `carroceria: "Sedán"` y `match_tipo: "exacto"`**, en 24 ms,
>   una sola llamada — y **`Listar stock` NO se llamó** (no aparece en el `runData`). El filtro por
>   carrocería dejó de depender del modelo.
> **HUMO (era el riesgo grave: un error de sintaxis acá deja la tool sin filas):** *"pasame los
> sedanes"* → HTTP 200 en 5s, los 4 sedanes exactos con cards, sin burbuja de fallback.
> **CONTROLES (`--repeat 3 --delay 10000`, ventana 00:31:30–00:35:15 con `search_executions` → 0
> ejecuciones en `error`): 9/9.** `carroceria-lista-pura-y-alternativas-con-contexto` **3/3**
> (las 3 dan listas puras y COMPLETAS: los 3 sedanes con <30.000 km incluido el Vento, y los 4
> sedanes en el stock completo; cero colados en texto y en cards);
> `modelo-no-stock-alternativas-carroceria` **3/3** y `buscar-marca-solo-esa-marca` **3/3** — o sea
> que el riesgo del cambio (que plegar tildes **afloje de más** el match y una marca traiga autos
> de otra) **no se materializó**.
> **HONESTIDAD SOBRE QUÉ PRUEBA QUÉ:** ese 3/3 del control **no es evidencia de mejora de
> conducta**, porque el caso tampoco fallaba en v78 (es un control de regresión, está anotado así
> en `cases.json`). **Lo que prueba el fix es el log: 0 filas → 4 filas con el mismo parámetro.**
>
> **(entrada previa, antes de desplegar) BUG 2 — el síntoma no reproduce; la causa está en el log.**
> **PRUEBA VINCULANTE EN VIVO — ejecución `10763`**, turno *"Pasame todas las opciones de sedan con
> menos de 30.000 km"*, los DOS runIndex:
> · `Buscar auto` con `marca_o_modelo: "sedan"` → **`response: [{"success": true}]`, CERO FILAS.**
> · Franco cae entonces a `Listar stock` con `km_max: 30000` y **todo lo demás en 0** → 6 autos de
>   TODAS las carrocerías (Ranger Pickup, T-Cross SUV, Vento Sedán, Onix Sedán, **208 Hatchback**,
>   Cronos Sedán), y **el filtro "sedán" lo termina haciendo el MODELO, de cabeza**.
> · Y ahí `precio_objetivo: 0` y `precio_max: 0`: **se pierde el presupuesto**. Eso es exactamente
>   el punto (c) del reporte — las alternativas no respetan el contexto acumulado porque los
>   parámetros no lo llevan.
> **ROOT CAUSE: en Postgres `ILIKE` NO ignora tildes. `'Sedán' ILIKE '%sedan%'` es FALSO**, y el
> modelo escribe "sedan" sin tilde (2 de 2 en ese log). El CTE `carr_pedida` sale vacío, el ILIKE
> directo tampoco matchea, y la query devuelve 0 filas.
> **POR QUÉ NADIE LO VIO ANTES: `Sedán` es la ÚNICA carrocería del stock con tilde** (las otras son
> Hatchback, SUV, Pickup, Utilitario). Por eso los flujos de pickup y SUV se midieron bien en v61 y
> v70 y el de sedanes nunca funcionó.
> **HONESTIDAD SOBRE EL INSTRUMENTO — el eval de conducta NO falla, lo digo explícito.** Se
> corrieron **8 conversaciones completas** del flujo de sedanes (3 del eval nuevo
> `carroceria-lista-pura-y-alternativas-con-contexto`, 1 sonda con precio, 3 réplica exacta de la
> captura **con el typo "sedanws" incluido**, 1 réplica larga que llena la ventana de memoria) y el
> síntoma **no se reprodujo ni una vez**: con 6 filas en la mano el modelo suele acertar el filtro
> manual. En 1 de 8 se coló el 208 pero **correctamente rotulado** (*"aunque no es sedán"*), que es
> justo lo que Agustina pide. **El síntoma es intermitente porque depende de esa suerte; la causa
> no.** El eval queda como **control de regresión**, no como instrumento de detección. Verificado
> además con `search_executions` que en la ventana de las corridas hubo **0 ejecuciones en
> `error`**, así que las mediciones no están contaminadas por rate limit (la trampa de método de la
> sesión anterior). Las 2 burbujas de fallback de la corrida larga son el parser, no el CRM.
> **`scripts/carroceria-sin-tildes.mjs` (v79→v80), 1 nodo.** Pliega tildes de los DOS lados de las
> 4 comparaciones de `Buscar auto` con `translate()`. **No se usa `unaccent()` a propósito:** es una
> extensión que puede no estar instalada, y si no está la query rompe y `Buscar auto` deja al
> cliente sin respuesta. `translate()` es core de Postgres. Trampa 3: los `$fromAI` quedan
> **byte-idénticos** (el plegado va en SQL, alrededor, nunca adentro). El cambio sólo puede AGREGAR
> filas, nunca sacar.
> **PRUEBA VINCULANTE OFFLINE:** el script reimplementa el predicado en JS y lo corre con el
> término EXACTO del log ("sedan") contra las 5 carrocerías reales: `Sedán` pasa de **no matchear a
> matchear**, y las otras 4 **siguen sin matchear** (no se afloja de más). Controles: con tilde
> sigue andando, y pickup/SUV/hatchback/utilitario dan idéntico antes y después (v61/v70 no
> regresan).
> **LO QUE NO SE TOCA (un cambio por vez):** `Listar stock` **NO** recibe parámetro de carrocería
> en esta versión. Con `Buscar auto` devolviendo las filas correctas, Franco ya no necesita filtrar
> de cabeza. Si después de medir sigue mezclando, el paso siguiente es ese parámetro — y ahí
> también entra el arrastre del presupuesto.
>
> **AL PEGAR, MEDIR ASÍ (sin esto no hay nada probado). Los pega Agustina por UI, nunca por MCP.**
> · **v79 — 2 campos:** `Listar stock` → `Query`, y `Franco (AI Agent)` → `System Message`.
>   Medir `--case presupuesto-no-baja-de-gama --repeat 4 --delay 20000`, **el caso SOLO**. Baseline
>   a batir: **0/3**. Controles obligatorios, en tanda aparte (el riesgo del cambio es que ahora
>   muestre DE MENOS o diga "no hay opciones"): `presupuesto-aproximado`, `rango-14-20`,
>   `km-con-presupuesto` y `permuta-mas-efectivo`.
> · **v80 — 1 campo:** `Buscar auto` → `Query`. **Lo primero es humo**, porque un error de sintaxis
>   acá deja la tool sin filas: mandar *"pasame los sedanes"* y confirmar en el log que
>   `Buscar auto` devuelve **filas** y no `success: true`. Después
>   `--case carroceria-lista-pura-y-alternativas-con-contexto --repeat 3` como control, y
>   `modelo-no-stock-alternativas-carroceria` + `buscar-marca-solo-esa-marca` (los de v61/v70).
> · **ANTES de leerle el número a cualquiera de los dos**, verificar con `search_executions`
>   (status `error`, con `startedAfter` Y `startedBefore` cubriendo la ventana EXACTA) que no haya
>   ejecuciones caídas.

> **SEGUNDO INTENTO DEL BUG A — HECHO, DESPLEGADO (v78) Y MEDIDO. FUNCIONA. Sesión 2026-08-01.**
> **`derivacion-aceptada-igual-pide-nombre`: de 1/7 a 7/8.** (Baseline v74: 1/3 + 0/4. v78: 3/4 + 4/4,
> en dos tandas independientes.) La única falla de la 1ra tanda no reprodujo en la 2da.
> **CONTROLES SIN REGRESIÓN:** `derivacion-cierre-no-reofrece-ni-inventa` **4/4**;
> `derivacion-completada-no-reofrece-visita` **3/4 + 4/4 = 7/8** — la falla de la 1ra tanda se corrió
> sola de nuevo y dio **4/4 limpio**, o sea no reproduce: varianza, no regresión. El riesgo del cambio
> (que ahora pida el nombre dos veces, o se lo pida a quien ya lo dio) **no se materializó**.
> **DEPLOY POR IMPORT DE JSON COMPLETO (primera vez en el proyecto; hasta ahora se pegaban campos
> sueltos).** Se armó `workflows/franco-n8n-v78-deploy.json` (v78 + `name` + `settings`, 129 KB) y
> Agustina lo importó por UI. **VERIFICADO byte a byte contra el vivo:** 35/35 nodos con `parameters`
> idénticos, `connections` idénticas, `settings` y `active: true` intactos, los 6 webhooks con su
> `path` (las URLs del frontend no cambiaron), y el **`systemMessage` de Franco idéntico byte a byte
> (51.791 chars)** — que era el riesgo real, porque un prompt truncado en el paste no se nota.
> **OJO CON UN FALSO POSITIVO DE VERIFICACIÓN QUE ME COMÍ:** `get_workflow_details` **NUNCA devuelve
> las credenciales** (da 0 nodos con `credentials`, también ANTES del import — comprobado contra el
> volcado previo). No se pueden verificar leyendo. Se probaron **ejecutando**: prueba de humo por
> `/webhook/franco-chat` → HTTP 200 con saludo (datos de `Config`, trampa 1 ✓), stock completo desde
> Postgres y respuesta del LLM. Sesión de humo borrada por `/webhook/session-delete`.
> **PROPIEDAD BUENA DEL FIX EN EL PROMPT (vs. el intento por estado de v75):** es **independiente del
> CRM**. La 2da tanda del caso objetivo corrió con **10 ejecuciones caídas por rate limit del CRM** y
> aun así dio 4/4 — porque el guion nuevo se dispara con lo que Franco tiene en la conversación
> (anticipo + cuotas), no con `lead_estado`, que es justo lo que el CRM escribe tarde o no escribe.
> v75 dependía de ese dato y por eso era doblemente frágil. **El check de este caso es sólo de texto y
> el CRM corre DESPUÉS de responder, así que esos errores no invalidan la medición.**
> **Puntero: v78 vivo.** `state-sync.mjs` L24 bumpeada v74 → v78 y corrido sin flags para regenerar el
> header (no a mano). Los 5 invariantes pasan. **Sin pushear a git.**
> **HONESTIDAD SOBRE LO QUE NO SE MIDIÓ:** no clasifiqué la única falla de la 1ra tanda del caso
> objetivo (no capturé la salida completa y no la quise re-correr para no gastar TPM de más); no sé si
> fue burbuja de fallback del parser o una miss real. Con 7/8 no cambia la conclusión, pero queda dicho.
> El caso `lead_checks` de que el nombre llegue efectivamente a `crm_leads` **no se probó**: este eval
> corta en que Franco lo PIDA. Verificar en la próxima demo real que la tarjeta salga con nombre.
>
> **(preparación, antes de desplegar) SEGUNDO INTENTO DEL BUG A (v78).**
> Ahora el fix va **al guion del prompt**, que es donde la evidencia dice que está el problema.
> **ROOT CAUSE REAL, encontrado leyendo el systemMessage (esto es lo que faltaba en el 1er intento):**
> el embudo de financiación **termina explícitamente sin nombre**, en dos lugares que son el mismo
> guion para la misma situación:
> · **(A) `# Financiación`:** *"Recién con el anticipo preguntás las cuotas (12, 24, 36 o 48) si no las
>   dio, **y confirmás que se lo dejás anotado al asesor para la simulación**."* — el embudo termina
>   ahí. No dice "y pedís el nombre". Franco hace **exactamente eso**.
> · **(B) `## Paso 3`, Excepción 2:** *"...consolidá con una AFIRMACIÓN (...) **y cerrá ofreciendo
>   OTRO paso** (verla en persona, o si necesita algo más mientras tanto)."* — ese "OTRO paso" es
>   literalmente el *"Mientras tanto, querés que te muestre algunas opciones de Corolla...?"* que
>   apareció en las corridas fallidas.
> **Trampa 6 aplicada en serio esta vez:** se **REEMPLAZAN los dos guiones** (no se les pone una
> prohibición arriba — eso ya falló tres veces según el CLAUDE.md), y arreglar **uno solo no sirve**
> porque el que queda gana. El nuevo cierre trae guion textual (*"perfecto, le dejo anotado al asesor
> la simulación con $15.000.000 de anticipo en 36 cuotas. Me dejás tu nombre y apellido así te
> contacta?"*) y **anti-ejemplo explícito** de los dos cierres que producen el bug. Se preserva el caso
> "ya tengo el nombre" (no se lo vuelve a pedir), que es lo que sostienen los controles en 5/5.
> **`scripts/financiacion-cierra-pidiendo-nombre.mjs` (v77→v78).** Verificado byte a byte: 35→35 nodos,
> **único nodo con diferencias `Franco (AI Agent)`**, y dentro de él **sólo** `systemMessage`
> (50.714 → 51.791 chars); `connections` y demás top-level idénticos; **`Config.estado_cliente` sin
> cambios** (queda el revert) y **`Query leads` intacto** (el fix medido). Los 5 invariantes pasan.
> **DEPLOY: 2 campos.** `Config` → `estado_cliente` (el revert, si Agustina no lo pegó ya) y
> `Franco (AI Agent)` → `System Message`. Base v77, así que la medición queda contra el baseline v74.
> **CÓMO MEDIRLO (y el error de método de hoy, para no repetirlo):**
> · `--case derivacion-aceptada-igual-pide-nombre --repeat 4 --delay 20000`, **el caso SOLO**. Correrlo
>   junto a otros lo deja último y le toca la cuota de TPM ya gastada: así dio 0/5 por rate limit y no
>   por conducta.
> · **ANTES de leer el número**, verificar con `search_executions` (status `error`, con `startedAfter`
>   Y `startedBefore` cubriendo la ventana EXACTA de la corrida) que no haya ejecuciones caídas. Hoy
>   chequeé una ventana posterior al fin de la corrida y me dio 0 errores falsos.
> · Baseline a batir: **v74 = 1/3 y 0/4**. No es 0/3 determinístico: no leer un 4/4 sin controles.
> · **Controles obligatorios** (el riesgo es que ahora pida el nombre dos veces, o lo pida a quien ya
>   lo dio): `derivacion-completada-no-reofrece-visita` y `derivacion-cierre-no-reofrece-ni-inventa`,
>   **ambos hoy en 5/5** — ese es el número que no puede bajar. Correrlos en una tanda aparte.

> **VEREDICTO FINAL DE LA SESIÓN 2026-08-01 (reemplaza las lecturas parciales de más abajo).**
> **BUG B (orden de la pestaña Leads): ARREGLADO, MEDIDO, CERRADO.** Tarjeta de la posición 12/12 →
> **1/12**, lista en orden cronológico real. Determinístico. Queda vivo.
> **BUG A (Franco no pide el nombre): EL FIX DE v75 NO FUNCIONA. MEDIDO EN CONDICIONES LIMPIAS Y
> DESCARTADO. Se revierte (v77).** El diagnóstico era correcto; la solución no.
> **MEDICIÓN DEFINITIVA (la única de las tres tandas que es válida):** caso corrido **solo**,
> `--repeat 4 --delay 20000`, y **CERO ejecuciones en `error` en toda la ventana** (15:08:30-15:12:00,
> verificado con `search_executions`; las dos tandas anteriores estaban contaminadas por rate limits
> del CRM y NO se usan para concluir). Resultado: **0/4**, contra baseline v74 de 1/3. No mejora.
> **LA PRUEBA QUE CIERRA LA DISCUSIÓN — ejecución `10208`:** `Leer lead (estado)` devolvió
> `lead_estado: "Requiere asesor"` con `lead_nombre: ""` — **la precondición EXACTA del fix** — o sea
> que la línea nueva SÍ le llegó a Franco (mecanismo ya probado aparte en la ejecución 10055, donde
> incluso se vio al cliente respondiendo con su nombre). **Y Franco igual no lo pidió.** No es que el
> fix no se dispare: se dispara y el modelo no lo obedece.
> **POR QUÉ FALLÓ — TRAMPA 6, otra vez, y hay que anotarlo para no repetirlo:** meter la instrucción
> en el **estado inyectado por código** es una REGLA ABSTRACTA, y pierde contra el **guion de cierre
> concreto** que Franco ya tiene en el prompt (el "le dejo anotado al asesor... / mientras tanto,
> querés que te muestre..."). La trampa 6 del CLAUDE.md dice literalmente que si la regla nueva no
> reemplaza al ejemplo viejo, pierde. Yo la apliqué al escribir el texto de la línea (le puse guion
> entre comillas) pero **no al lugar donde la puse**: el ejemplo que gana está en el systemMessage, y
> ahí no lo toqué. **La regla del proyecto ("lo determinístico va a código") decide DÓNDE se calcula
> el dato, no dónde se corrige la conducta.** El dato (falta el nombre) sí es determinístico y el
> cálculo está bien; lo que es lenguaje —qué hace Franco con ese dato— sigue siendo del prompt.
> **PRÓXIMO INTENTO (analizado, NO implementado, decisión de Agustina):** reemplazar el **guion de
> cierre post-derivación** en `# Derivación a un asesor` / `## Paso 3` para que, cuando la derivación
> está aceptada y NO hay nombre, el guion textual sea pedir el nombre en vez de cerrar con "le dejo
> anotado al asesor". Es decir: el mismo fix, pero en el ejemplo del prompt, no en el estado.
> **El eval `derivacion-aceptada-igual-pide-nombre` ya está escrito y ya falla (0/4 en v74/v75), así
> que el instrumento para el próximo intento está listo y calibrado.** Ojo con el baseline: **v74 da
> 1/3-0/4, no 0/3 determinístico** — no leer un 4/4 post-fix sin controles.
> **CONTROLES, sin regresión (medidos con v75 puesto, 5/5 y 5/5):**
> `derivacion-completada-no-reofrece-visita` **5/5** y `derivacion-cierre-no-reofrece-ni-inventa`
> **5/5**. La sospecha de regresión que anoté antes (1 corrida re-ofreciendo el asesor) **queda
> descartada: era ruido de la tanda con rate limits.** O sea que v75 tampoco rompía nada — simplemente
> no servía.
> **REVERT PREPARADO: `scripts/revertir-estado-cliente-nameask.mjs` (v76→v77).** Devuelve
> `Config.estado_cliente` a su valor **exacto de v74** (1404→1154 chars, verificado idéntico) y
> **conserva intacto el fix de `Query leads`**, que está medido y funcionando. Un solo campo. Los 5
> invariantes pasan sobre v77.
> **APRENDIZAJE DE MÉTODO (para la próxima, me pasó a mí en esta sesión):** medí dos veces con el CRM
> rate-limited y casi saco conclusiones de esas tandas. **La corrida de evals no vale nada sin
> verificar antes que no haya ejecuciones en `error` en la ventana exacta de la corrida** — y "la
> ventana exacta" significa `startedBefore` incluido: mi primer chequeo de errores fue posterior al
> fin de la corrida y dio 0 falsos.
>
> **POST-DEPLOY (misma sesión, después de que Agustina pegara los 2 campos). LEER ESTO ANTES QUE LO
> DE ABAJO.**
> **DEPLOY VERIFICADO byte a byte** (`get_workflow_details` vs los archivos): el vivo es **idéntico a
> v76**. `Config.estado_cliente` = v75 exacto (1404 chars), arranca con `={{` (trampa 1 ✓), rama nueva
> por `lead_nombre` presente, las 3 menciones de `ya_derivado` de v74 conservadas; `Query leads` con el
> `ORDER BY` calificado; 35/35 nodos; `systemMessage` de Franco (50.714 chars) y del CRM **idénticos**;
> `Leer lead (estado)` intacto; `queryReplacement` en forma array (trampa 2 ✓). Ningún otro nodo tocado.
> **BUG B — ARREGLADO Y MEDIDO. Determinístico, no hace falta repetir.** `GET /webhook/leads` después
> del deploy: el lead del 01/08 pasó de la **posición 12/12 a la 1/12**, y la lista quedó en orden
> cronológico real (01/08 · 31/07 · 30/07 ×4 · … · 23/07). **Cerrado.**
> **BUG A — EL MECANISMO ESTÁ PROBADO EN VIVO, LA CONDUCTA NO. NO LO DOY POR CERRADO.**
> **PRUEBA VINCULANTE, ejecución `10055`:** `Leer lead (estado)` devolvió `lead_estado: "Requiere
> asesor"` con `lead_nombre: ""` y el `estado_cliente` que recibió Franco contenía **textual** la línea
> nueva: *"- YA ACEPTO que lo contacte un asesor: no se la vuelvas a ofrecer. PERO TODAVIA NO TE DIO SU
> NOMBRE... pediselo, "me dejas tu nombre y apellido?"."*. Y el `mensaje_usuario` de ese turno era
> **"Julio Faena"** — el cliente estaba DANDO el nombre, o sea que en el turno anterior Franco lo pidió.
> El camino código→Franco funciona end-to-end en producción.
> **PERO LA CORRIDA DE EVALS NO SIRVE COMO MEDICIÓN DE CONDUCTA, Y NO LA VOY A REPORTAR COMO SI SIRVIERA.**
> `derivacion-aceptada-igual-pide-nombre` marcó **1/3, igual que el baseline v74** — pero la tanda está
> **contaminada por trampa 5**: **21 ejecuciones terminaron en `error` con `OpenAI: Rate limit reached`
> en `OpenAI Chat Model (CRM)`** (verificado en el log de la ejecución 10049). Con el CRM caído, el lead
> **no se escribe**: `lead_estado` se queda en "En conversación" y `ya_derivado` en `false`, así que
> **la precondición del fix nunca aparece y esos turnos no pueden testear nada**. Encima 1 de las 3
> corridas cayó en la burbuja de fallback del parser. Comparar 1/3 contra 1/3 en esas condiciones sería
> leer ruido. **Lo honesto: el fix no está probado ni refutado.**
> **SEÑAL A VIGILAR (posible regresión, sin confirmar):** en `derivacion-completada-no-reofrece-visita`
> 1 de 3 corridas volvió a re-ofrecer (*"Querés que un asesor te contacte..."*). Ese control tuvo
> `lead TIMEOUT` por el mismo rate limit, así que puede ser ruido — **pero hay un mecanismo plausible y
> hay que descartarlo midiendo**: por la deuda del desfase, hay una ventana en la que el cliente YA dio
> el nombre y `lead_nombre` todavía llega vacío; ahí la línea nueva le afirma a Franco algo FALSO
> ("todavía no te dio su nombre"), y puede desestabilizar el cierre o hacer que pida el nombre dos
> veces. Es exactamente el falso positivo que estos controles existen para cazar.
> **PRÓXIMO PASO (no ejecutado, decisión de Agustina):** re-medir con la ventana de TPM limpia y más
> señal — `--case derivacion-aceptada-igual-pide-nombre,derivacion-completada-no-reofrece-visita,
> derivacion-cierre-no-reofrece-ni-inventa --repeat 5 --delay 8000` (delay alto justamente para no
> volver a chocar el TPM), **verificando en el log que no haya ejecuciones en `error`** antes de creerle
> al número. Si el control sigue re-ofreciendo con el CRM sano, **revertir sólo `Config.estado_cliente`
> a v74** (v76/`Query leads` queda: está probado y es independiente).
> **Puntero: v76 vivo.** `state-sync.mjs` L18 pendiente de bumpear a v76 cuando se cierre el bug A.

> **Sesión 2026-08-01. DOS BUGS de la misma captura: (A) Franco no pide el nombre tras aceptar la
> derivación · (B) la tarjeta del lead "no aparece" en Leads. PREPARADOS (v75 y v76), NO DESPLEGADOS.**
> Captura de Agustina, una sola conversación: sesión `c7339dc4-e293-4136-b111-39c4069ca1e5`,
> ejecuciones **9780-9783** del 2026-08-01. Reportado como un solo síntoma ("no pidió el nombre y
> **nunca generó la tarjeta**, pero sí guardó el historial"). **Son dos bugs independientes, y el
> segundo no era lo que parecía.**
>
> **BUG B — LA TARJETA SÍ EXISTÍA. Estaba ÚLTIMA en la lista, no ausente. MEDIDO contra el endpoint
> real, no razonado.** `GET /webhook/leads` devolvía el lead en la **posición 12 de 12**
> (`is_saved: true`, `estado: "Requiere asesor"`). Root cause en `Query leads`: el SELECT hace
> `to_char(ultima_actualizacion, 'DD/MM/YYYY HH24:MI') AS ultima_actualizacion` y después
> `ORDER BY ultima_actualizacion DESC` **con el nombre PELADO**. En Postgres un ORDER BY con nombre
> pelado se resuelve primero contra las columnas de **salida** (SQL estándar), así que ordenaba el
> **texto** "DD/MM/YYYY", alfabéticamente. Orden observado tal cual volvió del endpoint:
> `31/07 · 30/07 ×4 · 29/07 · 25/07 · 23/07 ×4 · `**`01/08 último`**. Todo agosto se hunde debajo de
> julio; el 1 de cada mes es el peor caso.
> **CONTROL NATURAL que aísla la variable (misma DB, mismo instante, sin escribir nada):**
> `Query sessions` (pestaña Historial) tiene el **mismo `to_char` con el mismo alias**, pero ordena
> por `l.fecha_contacto` — nombre **calificado**, que Postgres sí resuelve contra la columna
> original. **El mismo lead salía PRIMERO en Historial y ÚLTIMO en Leads.** Eso explica exactamente
> la asimetría que reportó Agustina, y prueba que la causa es el ORDER BY y no la escritura del lead.
> **Fix `scripts/leads-orden-por-timestamp.mjs` (v75→v76):** calificar la columna
> (`ORDER BY crm_leads.ultima_actualizacion DESC`), igual que ya hace `Query sessions`. **Un nodo,
> una línea.** No toca el SELECT (el front sigue recibiendo la fecha formateada) ni nada del chat.
> Trampa 2: no se agregan parámetros, `$1` y el `queryReplacement` en forma array quedan intactos
> (verificado por aserción). Trampa 4: no aplica, `Query leads` cuelga del webhook GET, no de la
> cadena principal.
>
> **BUG A — Franco no pide el nombre. TRAMPA 7 RESUELTA PRIMERO, CON LOG: la frase la inyecta el
> CÓDIGO, no el prompt — por eso el fix NO va al prompt.** Cadena completa, leída de los logs:
> · **9780** — Franco ofrece: *"Querés que te pase con un asesor para que te arme esa simulación...?"*
> · el cliente acepta: *"dale si! me interesa la financiacion"*
> · **9781** — el CRM lo registra **BIEN**: `estado: "Requiere asesor"`, `nombre: ""`. **El CRM no es
> el bug**: aplicó literalmente su regla ("cuenta como Requiere asesor que el cliente haya aceptado
> una derivación que le ofreció Franco"). Descartado como causa **con evidencia**, no por intuición.
> · **9782** — en el log del nodo `Config` se lee `estado_cliente` conteniendo
> *"- YA ACEPTO que lo contacte un asesor: la derivacion esta en curso, no se la vuelvas a ofrecer."*
> con `lead_nombre: ""`.
> · **9783** — Franco lee eso como "ya está cerrado" y salta al cierre (*"le dejo anotado al asesor
> que la financiación sería con $15 millones de anticipo y 36 cuotas"*) **sin pedir nunca el nombre**.
> **ROOT CAUSE:** esa línea (v74) se escribió para que Franco **no RE-OFREZCA** el asesor, y de paso
> **apagó el name-ask** — que era lo único que faltaba para COMPLETAR la derivación. No distingue
> "aceptó y ya tengo su nombre" de "aceptó y todavía no me lo dio", que son dos situaciones con
> próximos pasos opuestos. **Consecuencia visible:** el lead queda con el teléfono ficticio de nombre
> (`+54 381 555-9193`) y la tarjeta del CRM sale anónima — que es lo que hizo que el BUG B se
> percibiera como "no se generó la tarjeta".
> **Eval nuevo `derivacion-aceptada-igual-pide-nombre` (`evals/cases.json`, 69→70 casos), replica la
> captura turno por turno. FALLA PRIMERO: baseline v74 `--repeat 3 --delay 3000` → 1/3.** Las 2
> fallas son el check objetivo (`text_matches` del name-ask), no ruido de parser: *"Perfecto, le dejo
> anotado al asesor que el anticipo es de $15.000.000..."* / *"Perfecto, ya dejo anotado que pensás
> financiar con 15 millones..."*, ninguna pide el nombre. La 3ra corrida **sí** lo pidió (*"Me dejás
> tu nombre y apellido para que el asesor te pueda contactar?"*), así que **el bug es de ~2/3, no
> determinístico** — anotado para no leer de más un 3/3 post-fix.
> **Fix `scripts/derivacion-aceptada-igual-pide-nombre.mjs` (v74→v75). Regla del proyecto aplicada:**
> que falte el nombre es **determinístico** (`Leer lead (estado)` ya devuelve `lead_nombre` normalizado
> a `''`, porque su `CASE` ya trata el teléfono ficticio `'+54%'` como vacío) → va a **código, no al
> prompt**. La línea se parte en dos ramas según `l.lead_nombre`, dentro del mismo `Config`. **NO se
> toca el systemMessage de Franco:** el guion del name-ask ya existe en `# Derivación a un asesor`; lo
> único que faltaba era no apagarlo. Trampa 6: la rama nueva no se queda en la regla abstracta, trae
> el **guion textual** entre comillas. Trampa 1: sigue arrancando con `={{`. Trampa 5: cero LLM.
> **PRUEBA VINCULANTE OFFLINE (patrón ya usado en TB-3, a2 y v74):** el script evalúa la expresión
> NUEVA con los datos **exactos** del log 9783 (`lead_estado: "Requiere asesor"`, `lead_nombre: ""`) y
> sale la línea con el pedido de nombre. **Controles de la simulación, los 4 pasan:** con nombre NO
> pide el nombre de nuevo (falso positivo, que es el riesgo del cambio) y conserva la línea original;
> sin derivación NO aparece ninguna línea de derivación; y el camino de `ya_derivado` de v74 sigue
> encendiendo la rama nueva.
> **Verificado byte a byte (v74→v76):** 35→35 nodos, **únicos nodos con diferencias `Config` y
> `Query leads`**; dentro de `Config` **sólo** `estado_cliente` (1154→1404 chars); dentro de
> `Query leads` **sólo** el `ORDER BY`; **`systemMessage` de Franco IDÉNTICO** (50.714 chars) y el del
> **CRM IDÉNTICO**; `connections` y demás top-level idénticos. `state-sync.mjs --file` sobre v75 y
> sobre v76 → **los 5 invariantes pasan en ambos**.
> **Un cambio por vez:** BUG A → v75, BUG B → v76 (encadenado sobre v75), cada uno revertible por
> separado — mismo patrón que v72→v73. Son subsistemas disjuntos: v76 no toca el chat, v75 no toca el
> webhook de leads.
> **PREPARADOS, NO DESPLEGADOS.** Los pega Agustina por UI (memoria del proyecto: nunca vía MCP
> `update_workflow`). **2 campos:** `Config` → `estado_cliente`, y `Query leads` → `query`.
> **AL PEGAR, MEDIR ASÍ (sin esto no hay nada probado):**
> · BUG B — `curl "$FRANCO_URL/webhook/leads?visible_ids="` y confirmar que el lead más reciente
>   (01/08) sale **PRIMERO** y no último. Es determinístico: alcanza una corrida.
> · BUG A — `--case derivacion-aceptada-igual-pide-nombre --repeat 3 --delay 3000`, tiene que subir
>   de 1/3. **Ojo con leer de más:** el baseline no era 0/3, así que un 3/3 hay que contrastarlo con
>   los controles.
> · **CONTROLES obligatorios** (el riesgo del cambio es que Franco vuelva a re-ofrecer el asesor o
>   pida el nombre dos veces): `derivacion-cierre-no-reofrece-ni-inventa` y
>   `derivacion-completada-no-reofrece-visita` — ambos con el cliente YA derivado **y con nombre ya
>   dado**, que es justo la rama que NO debe pedir el nombre otra vez.
> **RIESGO ABIERTO Y HONESTO — el SQL de `Query leads` no se ejecutó nunca contra la base.** No tengo
> acceso directo a Postgres (sólo los webhooks, que son queries fijas). La corrección es de semántica
> estándar de Postgres y tiene **precedente vivo en el mismo workflow** (`Query sessions` ya ordena por
> columna calificada y funciona), pero es SQL sin correr. Al pegar, el `curl` de arriba lo confirma o
> lo tumba en el acto; si erra, revertir esa línea. **`Query leads` NO está en la cadena principal del
> chat**, así que un error ahí rompe la pestaña de Leads, no las respuestas al cliente.
> **Puntero: v74 SIGUE VIVO** hasta que Agustina pegue. Sin pushear a git.

> **Sesión 2026-07-31. `ya_derivado` — flag determinístico por SQL. HECHO, DESPLEGADO (v74) Y MEDIDO.
> NO hay que revertir. Puntero: v74 vivo.**
> **HUMO (lo primero, era el riesgo grave: un error de sintaxis en `Leer lead (estado)` corta la cadena y el
> cliente no recibe NADA):** mensaje simple por el webhook → **HTTP 200, 3,6s, respuesta normal, sin burbuja de
> fallback**. Y encima sobre una sesión nueva sin mensajes previos, que es justo el camino del
> `COALESCE(..., false)`. **La cadena principal no se cortó.**
> **DEPLOY VERIFICADO byte a byte** (`get_workflow_details` vs `franco-n8n-v74.json`): 35/35 nodos; la query de
> `Leer lead (estado)` **idéntica** (1571 chars, con `AS ya_derivado` y conservando `FROM (SELECT 1) d`);
> `queryReplacement` **sin cambios** y en forma array (trampa 2); `Config.estado_cliente` **idéntico** (1154
> chars, arranca con `={{`, 3 menciones de `l.ya_derivado`); **ningún otro campo de Config** cambiado; el
> **`systemMessage` de Franco idéntico a v73 y v74** (no se tocaba); **ningún otro nodo** con parameters
> distintos.
> **PRUEBA VINCULANTE EN VIVO — el mecanismo funciona end-to-end. Evidencia, ejecución `9591`:**
> `Leer lead (estado)` devolvió **1 fila** (trampa 4 ✓) con **`ya_derivado: true`**, y el `Config.estado_cliente`
> que recibió Franco fue: *"- No entrega ningún usado.\n- **YA ACEPTO que lo contacte un asesor: la derivacion
> esta en curso, no se la vuelvas a ofrecer.**"* — la línea que en el log 9327 (el bug original) NO se generaba.
> **EL CASO TRAMPA, VALIDADO EN PRODUCCIÓN (no sólo offline) — ejecución `9586`:** en ese turno el historial ya
> contenía *"con esos datos **ya le puedo pasar** todo a un asesor..."* (un OFRECIMIENTO) y el flag devolvió
> **`ya_derivado: false`**. El falso positivo que era el riesgo del cambio **no ocurre**, medido sobre datos
> vivos. En la misma conversación, tras la confirmación real (*"listo Pedro, **un asesor te contacta**..."*), el
> turno siguiente dio `true` (9587). Flag NO pegado: da `false` en sesiones nuevas (9583, 9586) y `true` sólo
> tras confirmación (9587, 9591).
> **HONESTIDAD SOBRE EL ALCANCE DE LA PRUEBA:** en las corridas de hoy el CRM llegó a tiempo, así que **no
> conseguí exhibir un turno con `lead_estado='En conversación'` Y `ya_derivado=true` a la vez** (la combinación
> exacta del bug 9327, que allá se dio porque el CRM estaba rate-limited). Lo que quedó probado es que el flag
> se calcula bien, no da falso positivo, y llega a `estado_cliente`; el aporte es **estructural** (elimina la
> dependencia del timing del CRM), no algo que hoy se pudiera exhibir. Sí hay evidencia parcial del desfase en
> 9591: `lead_nombre` llegó vacío aunque el cliente ya había dado "Pedro Atenor".
> **CONTROLES (`--repeat 3 --delay 3000`, sólo los 4 necesarios). Leídos separando check objetivo de ruido:**
> - **`control-sin-derivar-si-ofrece-asesor` (el control inverso, la puerta de revert): NO hay falso positivo.**
>   El runner marca 0/3 y **eso asusta, pero el detalle lo desarma**: en las 2 corridas que produjeron respuesta
>   real, Franco **sigue ofreciendo el asesor** (*"...luego te conecto con un asesor para que te prepare esa
>   cotización"* / *"Querés que te pase con un asesor...?"*) → **0 fallas de check objetivo**. La 3ra corrida
>   "falló" el `text_matches asesor` porque la respuesta FUE la burbuja de fallback del parser. El turno 1 de
>   este caso ya venía cayendo en fallback en v73 (2/3): es preexistente, no de v74.
> - `derivacion-turno-siguiente-no-reofrece`: 2/3. **La falla NO es atribuible a v74**, y es demostrable: en esa
>   corrida Franco nunca confirmó derivación en T3 (preguntó por el usado), así que `ya_derivado` fue `false` →
>   `estado_cliente` idéntico al de v73. **v74 es un superset estricto**: sólo puede AGREGAR la línea cuando hay
>   confirmación; sin confirmación el comportamiento es exactamente el de v73. Es varianza conversacional.
> - `derivacion-completada-no-reofrece-visita`: **3/3 en los checks de texto**; la única falla es un
>   `lead TIMEOUT` (el CRM no escribió en 31s) — que es, irónicamente, el desfase que este cambio evita.
> - `derivacion-cierre-no-reofrece-ni-inventa`: 2/3; la falla es `media_si_lista_autos`, el falso positivo de
>   instrumento ya documentado en este archivo (TIPO B en turnos de dedup), no la conducta de derivación.
> **SQL YA EJECUTADO — revisión de comportamiento:** `Leer lead (estado)` tarda **18-19 ms** (en v73, log 9327,
> tardaba 17 ms) → **+1-2 ms, despreciable**; siempre **1 fila**; **cero errores** en las ejecuciones
> 9580-9591; y en esta tanda **no hubo rate limits del CRM** (a diferencia de 9324-9327). El riesgo que quedaba
> abierto de la sesión anterior (SQL nunca ejecutado) **queda cerrado**.
> **Puntero: v74 vivo.** `state-sync.mjs` L18 → v74. Sesiones de prueba borradas por `/webhook/session-delete`
> para no ensuciar el CRM de la demo. Sin pushear a git.

> **(entrada previa de esta misma tarea, antes de desplegar) `ya_derivado` — PREPARADO (v74) sobre v73.**
> Agustina aprobó la recomendación de la sesión anterior: sacar el hecho "ya derivé" del CRM async y calcularlo
> por SQL. **Regla del proyecto aplicada:** el dato es determinístico → va a SQL, no a más reglas de prompt.
> **(1) VALIDACIÓN OFFLINE DEL PATRÓN, ANTES de tocar el workflow (era el riesgo que yo mismo marqué).**
> Bajé las burbujas reales de Franco de `mensajes_demo` de **11 sesiones**: **37 burbujas que mencionan
> "asesor"**, etiquetadas a mano (**11 confirmaciones de derivación / 26 ofrecimientos o menciones**).
> Resultado del patrón: **11/11 verdaderos positivos, 26/26 verdaderos negativos, 0 falsos positivos, 0 falsos
> negativos (37/37)**. El caso trampa discrimina: *"Con eso ya le **puedo pasar** todo a un asesor... me dejás
> tu nombre?"* (ofrecimiento) **NO** activa, *"ya le **paso** todo a un asesor"* (hecho) **SÍ**. Tampoco activa
> con *"para que un asesor te contact**e**, me dejás tu nombre?"* (subjuntivo = pedido, no confirmación).
> **(2) INSTRUMENTO DE MEDICIÓN — el eval NO falló, lo digo explícito y cambié de instrumento.**
> Escribí `derivacion-turno-siguiente-no-reofrece` apuntando al peor momento del desfase (el turno
> INMEDIATAMENTE siguiente a la confirmación, donde la lectura compite con la escritura async del turno
> anterior). **Baseline v73: 3/3 OK — NO falla.** La mitigación por lenguaje de v73 aguanta también ahí. **No
> inventé una falla para justificar el cambio.** Instrumento usado en su lugar: **PRUEBA VINCULANTE** (patrón
> ya usado en TB-3 y a2). La mitad que se puede probar sin desplegar ya está hecha:
> `scratchpad/sim-estado-cliente.mjs` evalúa la expresión NUEVA de `Config.estado_cliente` con los datos
> **exactos** que devolvió `Leer lead (estado)` en el log real **9327** (`lead_estado: "En conversación"`,
> `lead_nombre: ""`): **antes** el `estado_cliente` sale sin la línea de derivación (reproduce el bug exacto),
> **con `ya_derivado=true` sale con la línea** *"- YA ACEPTO que lo contacte un asesor..."*. Controles de la
> simulación: `ya_derivado=false` NO la enciende; `lead_estado='Requiere asesor'` la sigue encendiendo (el
> camino viejo no se rompe); y `'t'`/`'true'` (por si n8n entrega el bool de Postgres como string) también.
> **(3) CONTROL INVERSO** (el riesgo del cambio es apagar el ofrecimiento de más): eval nuevo
> `control-sin-derivar-si-ofrece-asesor` — conversación SIN ninguna derivación que pide una cotización formal,
> donde ofrecer el asesor es lo correcto. **Baseline v73: 3/3 mencionan al asesor** (el runner marca 1/3 sólo
> por la burbuja de fallback del parser en el turno 1, trampa 5 — cero fallas de check objetivo). Tiene que
> seguir en 3/3 después de pegar v74; si baja, el flag está dando falso positivo y se revierte.
> **(4) EL CAMBIO — `scripts/ya-derivado-flag-deterministico.mjs` (v73→v74), 2 nodos:**
> (A) `Leer lead (estado)`: columna nueva `ya_derivado` como **subconsulta ESCALAR** (no puede cambiar la
> cantidad de filas — **trampa 4**; se mantiene `FROM (SELECT 1) d LEFT JOIN` y `COALESCE(..., false)` cubre la
> sesión sin mensajes) con `bool_or(b->>'content' ~* '<patrón>')` sobre las últimas 12 burbujas de Franco de
> `mensajes_demo`, con el mismo `jsonb_typeof(...)='array'` defensivo que ya usa `Autos ya mostrados`.
> (B) `Config.estado_cliente`: la línea de derivación ahora se empuja con
> `lead_estado === 'Requiere asesor' || ya_derivado`.
> **Trampas:** trampa 2 — **no se agregaron parámetros**, se reusa `$1` y el `queryReplacement` sigue en forma
> array (verificado por aserción); trampa 1 — `estado_cliente` sigue arrancando con `={{`; trampa 5 — **cero
> llamadas nuevas a LLM**, es SQL puro (importante porque el CRM en `gpt-4.1` ya viene dando rate limits).
> **Verificado byte a byte (v73→v74):** 35→35 nodos, **únicos nodos con diferencias `Config` y `Leer lead
> (estado)`**; dentro de `Config` **sólo** `estado_cliente`; dentro de `Leer lead` **sólo** `query`; el
> **`systemMessage` de Franco IDÉNTICO** (no se tocó); top-level (`connections`, `settings`) idéntico.
> `state-sync.mjs --file franco-n8n-v74.json` → **los 5 invariantes pasan**.
> **RIESGO ABIERTO Y HONESTO — el SQL NO se ejecutó nunca.** No tengo acceso directo a Postgres (sólo los
> webhooks, que son queries fijas), así que validé el SQL de forma estructural (paréntesis y comillas
> balanceados, termina en `;`, `$1` dos veces) y por analogía con `Autos ya mostrados`, que ya usa en
> producción los mismos constructos (`CROSS JOIN LATERAL jsonb_array_elements`, `jsonb_typeof`, `contenido`
> jsonb) sobre la misma tabla. **Pero un error de sintaxis acá corta la cadena principal y el cliente no
> recibe respuesta.** Al pegar, lo primero es mandar UN mensaje de prueba y confirmar en el log que
> `Leer lead (estado)` devuelve 1 fila con `ya_derivado`; si erra, revertir a v73 en el acto.
> **PREPARADO, NO DESPLEGADO (v74).** Lo pega Agustina por UI (**2 nodos**: la query de `Leer lead (estado)` y
> el campo `estado_cliente` de `Config` — esta vez NO es el systemMessage de Franco).
> **Al pegar, completar la PRUEBA VINCULANTE:** en el log de una conversación con derivación ya confirmada,
> verificar que `Leer lead (estado)` devuelve `ya_derivado: true` y que `Config.estado_cliente` contiene la
> línea "- YA ACEPTO que lo contacte un asesor..." **en el mismo turno**, aun con `lead_estado: "En
> conversación"`. Más: `control-sin-derivar-si-ofrece-asesor` (debe seguir 3/3) y
> `derivacion-completada-no-reofrece-visita` + `derivacion-turno-siguiente-no-reofrece` (deben seguir OK).

> **Sesión 2026-07-31. BUG A (primer auto / usado) + BUG B (re-ofrece asesor en visita/test drive) —
> HECHOS, DESPLEGADOS (v73, acumula v72) Y MEDIDOS.**
> **VERIFICACIÓN DE DEPLOY (antes de medir, no se asumió):** `get_workflow_details` del MCP contra
> `franco-n8n-v73.json` → 35/35 nodos, mismos nombres, `systemMessage` **idéntico byte a byte** (50.714 chars),
> los 3 marcadores de los dos fixes presentes en el vivo (`OJO CON EL USADO`, `VISITA, TEST DRIVE O TRAER UN
> MECÁNICO`, `OJO CON CÓMO SABÉS QUE YA DERIVASTE`), y **ningún otro nodo con `parameters` distintos**.
> **MEDIDO en vivo (`--repeat 3 --delay 3000`, solo los 4 casos necesarios): 0 fallas de check objetivo en las
> 12 corridas.**
> - **`primer-auto-no-pregunta-usado` (BUG A): 3/3 falla → 3/3 OK.** Ninguna de las 3 ofrece usado/permuta.
>   Cierres reales: *"Te interesa saber cómo sería financiarlo, o preferís que te muestre otras opciones
>   similares para comparar?"* / *"...otras opciones similares **para tu primer auto**?"* / *"Lo querés ver en
>   persona o preferís que te muestre algunas opciones similares **para tu primer auto**?"* — incluso engancha
>   el contexto de primer auto.
> - **`derivacion-completada-no-reofrece-visita` (BUG B): 3/3 falla → 3/3 OK en el check objetivo.** Las 3 usan
>   la formulación que pidió Agustina: *"Cuando el asesor te contacte, coordinás con él la visita y el test
>   drive."* El runner marca 2/3 sólo porque una corrida tuvo la burbuja de fallback del parser en el TURNO 1
>   (trampa 5), que no tiene nada que ver con el bug.
> - **Controles, sin regresión:** `permuta-una-pregunta-por-vez` **3/3 OK**;
>   `derivacion-cierre-no-reofrece-ni-inventa` **3/3 OK en el check objetivo** (marca 2/3 por el mismo fallback
>   de parser en el turno 1). Importante porque el fix de BUG A toca el cierre comercial que ambos usan.
> - Las **2 únicas fallas** de las 12 corridas son `no_fallback_bubble` en el turno 1 — el parser fallback
>   intermitente ya documentado, no los bugs. Verificado separando fallas de check objetivo vs fallback.
> **Puntero: v73 vivo** (Agustina pegó por UI). `state-sync.mjs` L18 → v73. Sin pushear a git.
> Dos bugs con captura real de Agustina, misma conversación (lead **Pedro Atenor**, sesión
> `2b363055-1dc3-41eb-839e-0414f1d78e45`). Se traía la conversación entera de la DB (`/webhook/session-messages`)
> y ahí están los dos, textuales. **Un cambio por vez: BUG A → v72, BUG B → v73 (encadenado sobre v72).**
>
> **BUG B — TRAMPA 7 RESUELTA PRIMERO, CON LOG (era la pregunta que definía dónde iba el fix).**
> La frase sale en burbuja separada al final, que es la forma del guard de `Armar respuesta`. **NO es el guard.**
> Evidencia, ejecución n8n **9327** (turno real "donde estan ubicados? puedo ir a verlo con un mecanico..."):
> el texto **ya viene en el output crudo de `Franco (AI Agent)`** (2 burbujas, `auto_ids: []`), y `Armar
> respuesta` lo pasa tal cual (2 entran, 2 salen, `product_cards: []`). Además el guard solo agrega algo si
> `autos.length >= 1` (acá 0) y sus 3 cierres son literales fijos que no incluyen la frase; y la frase **varía
> corrida a corrida**, que es generación del LLM, no inyección de código. **Lo escribe Franco → fix al prompt.**
> **De las tres causas posibles que se plantearon, la evidencia dice (a) — y es más grave de lo que parecía:**
> en esa misma ejecución 9327, `Leer lead (estado)` devolvió `lead_estado: "En conversación"` y
> `lead_nombre: ""`, y el `estado_cliente` que se le arma a Franco **no tenía ninguna marca de derivación**
> (solo presupuesto / vehículo / financiación). O sea: la regla de v68 y la de `# Derivación` ("si figura que ya
> aceptó, está aceptado") **no tenían sobre qué disparar**, porque el CRM escribe async y el estado llega un
> turno tarde (deuda ya conocida). Y se suma (b): la variante VISITA/TEST DRIVE no estaba cubierta — v68 ancla
> en "pregunta la dirección, el horario, o te agradece", y coordinar una visita sí involucra al asesor, así que
> Franco reagarra el guion de "querés que te conecte con un asesor?". El lead final SÍ quedó en
> `estado: "Requiere asesor"` con nombre "Pedro Atenor" en las 3 corridas (los `lead_checks` pasaron): el
> problema es *cuándo* se entera Franco, no si se guarda.
>
> **Evals nuevos (`evals/cases.json`, 65→67 casos), ambos fallan primero:**
> - **`primer-auto-no-pregunta-usado`** — baseline v71: **falla 3/3** (determinístico). Las 3 corridas cierran el
>   detalle del Etios con el guion del bug (2 con "entregando **un** usado", 1 con "entregando **tu** usado").
>   **OJO — el primer check estaba mal y lo corregí:** solo miraba "entregando tu usado", así que reportó 1/3
>   cuando en realidad el bug estaba en las 3. Se amplió el regex (cubre entregando/entregar/entregás +
>   un/tu/el/su, "parte de pago" y "permut"), se validó contra 9 casos (6 que deben detectar, 3 controles que
>   deben pasar) y se **re-scoreó offline** las 3 respuestas ya capturadas: **3/3**. El número bueno es 3/3.
> - **`derivacion-completada-no-reofrece-visita`** — baseline v71: **falla 3/3**. Las 3 re-ofrecen conectar con
>   un asesor ("Si querés, un asesor puede ayudarte a organizar eso" / "Querés que te conecte con un asesor para
>   agendar esa visita..." / "...para que te prepare todo para la visita y la prueba?").
>
> **BUG A — fix `scripts/primer-auto-no-ofrece-usado.mjs` (v71→v72).** Root cause: el cierre comercial de
> `## Paso 3` trae como PRIMER ejemplo, literal, el guion que produce el bug ("te interesa saber cómo sería
> financiarlo o entregando tu usado?"). Trampa 6 pura: se **reemplaza el guion**, no se le pone una prohibición
> arriba. La lista de ejemplos queda sin la permuta, y se agrega la regla condicional (ofrecer el usado SOLO si
> tiene un auto para entregar) + el **anti-ejemplo concreto** del primer auto con el guion correcto de reemplazo.
> Las otras 3 menciones de "entregando tu usado" viven en `## Permuta`, donde SÍ corresponden, y **no se tocan**.
> **BUG B — fix `scripts/derivado-visita-test-drive.mjs` (v72→v73).** Extiende la regla post-derivación de
> `# Derivación` (la de v68, que queda intacta) con: (1) la variante visita/test drive/mecánico y su ejemplo
> concreto —contestar que sí y enmarcar la coordinación en el asesor *que ya lo va a contactar*, con el guion
> textual que pidió Agustina—, y (2) que para saber si ya derivó mire la **conversación reciente** y no solo el
> estado, porque el estado llega un turno tarde. El (2) sale directo del log 9327 y es lo único que puede
> funcionar hoy sin tocar arquitectura.
> **Verificado byte a byte:** v71→v72, v72→v73 y v71→v73: 35→35 nodos, mismos nombres, **único nodo con
> diferencias `Franco (AI Agent)`**, y dentro de él **solo** `systemMessage` (v71 48.878 → v72 49.565 → v73
> 50.714 chars); resto del nodo y todos los campos top-level (`connections`, `settings`) idénticos.
> `state-sync.mjs --file` sobre v72 y sobre v73 → **los 5 invariantes pasan** en ambos.
> **Desplegado por Agustina vía UI** (yo no pego nada: memoria del proyecto, nunca vía MCP `update_workflow`).
> **DEUDA VIVA — el desfase del estado del lead (root cause estructural de BUG B, NO resuelto).**
> Cadena real confirmada leyendo `connections` de v73 + el log 9327:
> `Webhook → Contar mensajes previos → Leer lead (estado) → Config → Franco → Hidratar autos → Autos ya
> mostrados → Armar respuesta → Responder a Render →` *(recién acá)* `→ Leer conversación (CRM) → CRM (AI Agent)
> → [tool] Guardar lead`. O sea: **Franco lee el lead en el paso 3, y el CRM lo escribe después de que el
> usuario ya recibió la respuesta** → lo que Franco ve en el turno N lo escribió el CRM en el turno N-1.
> El mecanismo del prompt existe y está bien hecho (`Config.estado_cliente` empuja *"- YA ACEPTO que lo contacte
> un asesor..."* cuando `lead_estado === 'Requiere asesor'`), pero en el log 9327 llegó `lead_estado: "En
> conversación"` y `lead_nombre: ""`, así que esa línea nunca se generó. **v73 lo mitiga por lenguaje** (le dice
> a Franco que mire la conversación reciente y no espere el estado) y **eso quedó medido 3/3**, pero el dato
> sigue llegando tarde y va a volver a morder en otras variantes.
> **RECOMENDACIÓN (analizada esta sesión, NO implementada, decisión de Agustina):** derivar el hecho por
> **código/SQL** (regla del proyecto), extendiendo la query de `Leer lead (estado)` con un flag `ya_derivado`
> calculado sobre los últimos mensajes de la sesión, y que `Config.estado_cliente` empuje la línea de derivación
> con `lead_estado='Requiere asesor' OR ya_derivado`. Hay precedente exacto y funcionando en el mismo workflow:
> `Autos ya mostrados` ya extrae hechos determinísticos de los últimos 8 mensajes de `mensajes_demo` por SQL
> puro, con `alwaysOutputData: true` (trampa 4). Costo: 2 nodos tocados, **sin columna nueva, sin nodo nuevo,
> cero tokens de LLM** (importante: el CRM en `gpt-4.1` ya viene dando `Rate limit ... TPM: Limit 30000`,
> ejecuciones 9324-9327 de hoy — trampa 5). **Descartadas:** hacer el CRM síncrono antes de Franco (metería una
> llamada `gpt-4.1` en el camino crítico: duplica la latencia y convierte un rate-limit de fondo en que el
> cliente no reciba NINGUNA respuesta — inaceptable en la demo; y ni siquiera arregla el caso, porque el CRM del
> turno N no puede ver la derivación que Franco hace *en* el turno N) y mover/duplicar la lectura del estado
> (no sirve: para que ayude, la escritura tiene que pasar antes de que Franco lea). **Riesgo principal del fix
> recomendado:** falsos positivos si el patrón matchea un *ofrecimiento* ("un asesor te puede orientar") en vez
> de una *confirmación* — hay que matchear confirmación, y validarlo offline contra filas reales de
> `mensajes_demo` antes de tocar nada, con su propio eval y un control de que Franco SIGA ofreciendo el asesor
> cuando todavía no derivó. **No es urgente:** con v73 medido 3/3, esto va como próximo cambio planificado, no
> como hotfix.

> **Sesión 2026-07-30. PERMUTA "todo junto" sin presupuesto — CHECK RECALIBRADO Y MEDIDO. NO SE HIZO FIX: EL BUG
> NO REPRODUCE (0/8). No generó versión nueva; producción seguía en v71.**
> (Nota 2026-07-31: el `v72` que existe hoy en el repo es de la sesión de arriba, BUG A "primer auto", no de esto.)
> Pedido de Agustina: atacar el hallazgo abierto (Franco repregunta el km cuando el cliente da auto+km todo junto
> y NO declara presupuesto; medido 1/3 contra v70 la sesión anterior).
> **(1) Primero se arregló el CHECK, antes de medir nada.** El caso `permuta-todo-junto` estaba mal calibrado por
> mí: exigía `text_matches "nombre"`, o sea que Franco pidiera el nombre específicamente. Eso contradice la
> DECISIÓN 2026-07-23 de Agustina (ver `permuta-una-pregunta-por-vez`): con el usado ya identificado, cualquier
> próximo paso razonable vale (abanico, nombre, asesor, o preguntar qué busca). Con ese check, 2 de las 3 corridas
> "fallaban" haciendo algo correcto. **Recalibrado:** se sacó el `text_matches "nombre"` y quedan dos
> `text_not_matches` que miden EL BUG REAL y nada más — que no repregunte marca/modelo/año, y que no repregunte
> km/kilometraje (incluye la forma exacta observada, "me faltaría saber cuántos kilómetros"). Validado contra las
> 3 respuestas reales ya capturadas: las 2 razonables PASAN, la repregunta del km FALLA. El check ahora discrimina.
> **(2) BASELINE con señal suficiente (`--repeat 8 --delay 3000`, el `--delay` para aislar contención, trampa 5):**
> **repregunta 0/8.** Leí las 8 respuestas completas una por una, no solo el veredicto del regex: **ninguna**
> repregunta marca/modelo/año/km. Las 8 reconocen el Gol Trend 2015 / 87.000 km y avanzan al embudo correcto
> ("con cuánto más contás", anticipo/presupuesto) o piden el nombre — que es exactamente lo que manda la rama "SIN
> PRESUPUESTO DECLARADO" del prompt. **El bug no reproduce → NO se tocó el prompt** (regla del proyecto: nunca
> "arreglar" algo sin haber reproducido el fallo). **No hay v72.**
> **Honestidad estadística (no redondear a "está arreglado"):** 0/8 NO prueba que el bug no exista. Por la regla
> de tres, 0 eventos en 8 corridas es compatible con una tasa real de hasta ~37%. Sumando la observación previa:
> **1/11 en total (~9%)** — es un flake de baja frecuencia, no el ~33% que sugería el 1/3 inicial (n=3 era muy
> chico). Tampoco lo arregló v71: v71 está verificado byte a byte como que NO toca ni una línea de `## Permuta`.
> **HIPÓTESIS para quien lo retome (no confirmada, es lo que sugiere el dato):** la única corrida que falló fue la
> 3ra de 3 consecutivas **sin `--delay`**, y estas 8 corrieron **con `--delay 3000`. Puede ser contención (trampa
> 5), el mismo patrón que ya mordió con el parser fallback. **Control barato para confirmarlo o descartarlo:**
> correr `--case permuta-todo-junto --repeat 8` SIN `--delay` y comparar contra este 0/8. No lo corrí yo para no
> gastar créditos de más sin que Agustina lo pida (y por el incidente de créditos de esta misma sesión).
> **Efecto colateral medido (hallazgo menor, distinto del bug objetivo):** 1/8 (corrida 5) falló por
> `max_preguntas: 3 preguntas en el turno` — "Qué más podés contarme sobre el auto que entregás? Por ejemplo,
> querés contarme si vas a financiar o si tenés un monto para dar de anticipo?". No repregunta un dato ya dado,
> pero apila 3 preguntas (tendencia a formulario, lo que `max_preguntas` justamente vigila). Queda anotado, sin
> fix — es otro tema y sería otro cambio.
> **Estado:** `evals/cases.json` con el check de `permuta-todo-junto` recalibrado (65 casos, sin casos nuevos).
> Ningún workflow tocado, ningún archivo `franco-n8n-*.json` nuevo. Invariantes ✅. **Producción sigue en v71.**

> **Sesión 2026-07-30. CONSIGNACIÓN "todo junto" — HECHO, DESPLEGADO (v71) Y MEDIDO.**
> **Bug (continuación de sesión previa):** cuando el cliente da marca+modelo+año (o también los km) TODO JUNTO en
> un solo mensaje, en CONSIGNACIÓN Franco repregunta un dato que ya le dieron ("qué modelo y año es?" / "qué año
> tiene y cuántos km?"), confirmado con log real de n8n (ejecución 8548, texto sale de Franco, no del guard de
> "Armar respuesta" — trampa 7 descartada).
> **Root cause (releído del prompt v70 esta sesión):** `## Permuta` tiene un bloque condicional de 3 estados con
> su propio ejemplo concreto ("Cierre de este caso": no sabés el auto → preguntás eso; sabés el auto pero no los
> km → preguntás los km; YA TENÉS AUTO Y KM → pedís el nombre, con guion literal). `# Consignación` (v67) NUNCA
> copió ese bloque: solo tenía el ejemplo del PRIMER turno cuando no se sabe nada del auto. Sin bloque condicional
> propio con su propio ejemplo (trampa 6: el ejemplo concreto le gana a la regla abstracta), el modelo no tenía
> guion para "ya me lo diste todo junto" y volvía a preguntar marca/modelo/año.
> **Evals nuevos (`evals/cases.json`, 63→65 casos):** `consignacion-todo-junto` (2 turnos: auto+año todo junto →
> debe ir directo a km; después da los km → debe pedir nombre) y `permuta-todo-junto` (1 turno control: auto+km
> todo junto, SIN presupuesto declarado → se esperaba que fuera directo a pedir nombre).
> **INCIDENTE (ya resuelto):** la primera corrida de este baseline (antes de este párrafo) coincidió con que la
> cuenta de OpenAI se quedó sin crédito a mitad de sesión — confirmado con el log real de n8n (ejecuciones 8554 y
> 8951: "You have no credits remaining"), con el corte exacto en 2026-07-30T21:54:46Z. La causa más probable fue
> una corrida de la suite completa (63 casos, sin `--delay`) que yo mismo lancé en background, contra la norma del
> proyecto de correr solo lo necesario — error propio, anotado para no repetirlo. Agustina recargó créditos y este
> párrafo reemplaza esa medición descartada por la real de abajo.
> **BASELINE REAL (créditos restaurados, `--repeat 3`, sin errores de OpenAI, log limpio):**
> - **`consignacion-todo-junto`: 0/3 (falla las 3 veces), reproducción LIMPIA y determinística del bug objetivo.**
>   Turno 1, las 3 corridas devuelven el mismo texto EXACTO, carácter por carácter: *"dale, tu auto lo podemos
>   vender en consignación: lo publicamos y lo vendemos por vos, y cobramos una comisión del 5% cuando se
>   concreta. Vos seguís siendo el titular hasta la venta. Qué auto es, marca, modelo y año?"* — es literalmente
>   el ejemplo del PRIMER turno del prompt viejo, recitado tal cual, ignorando que el cliente ya dijo "Es un ford
>   ka 2017" en el mismo mensaje. Confirmación textual de trampa 6. Turno 2 (dar los km) funciona bien las 3
>   veces — pide nombre correctamente, sin repreguntar nada — así que el bug está acotado exactamente a donde se
>   pensaba: el primer turno cuando todo llega junto.
> - **`permuta-todo-junto`: 0/3 contra mi check, pero NO es la misma clase de hallazgo — matizado abajo, no se
>   reporta como "pasa" sin más.** Ninguna de las 3 corridas pidió el nombre explícitamente, pero el detalle
>   turno a turno importa: 2/3 (runs 1 y 2) pasan a una pregunta de calificación distinta ("qué consumo buscás
>   para el próximo auto" / "qué tipo de auto buscás") para armar el abanico — no repiten ningún dato ya dado, y
>   encajan con la DECISIÓN YA TOMADA por el proyecto el 2026-07-23 ("con el usado ya identificado, cualquier
>   próximo paso razonable vale: abanico, nombre, o asesor" — ver `permuta-una-pregunta-por-vez` en
>   `evals/cases.json`). Mi check exigía únicamente "nombre", más estricto que esa decisión, así que estos 2
>   fallos son en parte un defecto de mi check, no necesariamente del prompt. La corrida 3 sí repite un dato ya
>   dado: *"me faltaría saber cuántos kilómetros tiene tu Gol Trend 2015"* pese a que el mensaje inicial ya traía
>   "87 mil km" — la MISMA clase de bug que consignación, pero en un escenario distinto al "0/6" de la sesión
>   previa: acá el cliente NO declaró presupuesto/anticipo, y el prompt tiene una rama "SIN PRESUPUESTO
>   DECLARADO" que compite con el bloque "Cierre de este caso" (que manda ir directo al nombre cuando ya hay
>   auto+km) — parece que sin presupuesto esa rama alternativa gana a veces. (Nota aparte: el run 2 también repite
>   "tu Gol Trend 2015 con 87.000 km" en el encabezado — es el eco ya documentado como flaky, `permuta-sin-eco-
>   datos`, no algo nuevo.) **Conclusión:** mi caso de control estaba calibrado para un escenario ("sin
>   presupuesto") distinto al que se probó en la sesión anterior; es un hallazgo real y separado, pero NO es el
>   bug que este fix toca ni algo que v71 pueda empeorar o arreglar (v71 no modifica ni una línea de `## Permuta`,
>   verificado byte a byte en la sesión previa). Queda anotado como pendiente/deuda nueva, sin tocar ahora — una
>   cosa por vez, y decidir si ese matiz de "sin presupuesto" necesita su propio fix es de Agustina, no algo que
>   se resuelva de rebote acá.
> **Fix (no depende de evals en vivo, ya escrito antes del baseline):** `scripts/consignacion-todo-junto.mjs`
> (v70→v71), UN cambio, solo dentro de `# Consignación`, solo lenguaje (NLU de texto libre → prompt, no SQL/
> código). Reemplaza el párrafo único "Después derivás, con la MISMA progresión..." por un bloque condicional de
> 3 estados —mismo patrón estructural que `## Permuta`, con el guion y tono propios de consignación (comisión 5%,
> sigue siendo titular, "asesor coordina la inspección y arma el contrato" — nunca "tasación", que es lenguaje de
> permuta)—, con ejemplo concreto explícito para el caso "todo junto" (Ford Ka 2017 dado de una, salta directo a
> pedir km). NO toca `## Permuta` (ya andaba, "un cambio por vez"), ni el FAQ, ni CRM, ni ningún nodo Postgres.
> **Verificado byte a byte (estático):** 35→35 nodos, mismos nombres; el único nodo con diferencias es `Franco
> (AI Agent)`, y dentro de ese nodo el único campo que cambió es `systemMessage` (47.574 → 48.878 chars, +1.304);
> todo lo demás del nodo y todos los campos de nivel de workflow son idénticos byte a byte. `node
> scripts/state-sync.mjs --file franco-n8n-v71.json` → los 5 invariantes pasan (trampa 1: sigue arrancando con `=`).
> **PREPARADO (v71) sobre v70**, verificado byte a byte como arriba. **Yo NO lo desplegué** (regla del proyecto /
> memoria: nunca vía MCP `update_workflow`/`create_workflow_from_code` sobre producción) — lo pegó **Agustina por
> UI** en el nodo `Franco (AI Agent)` → campo `systemMessage`.
> **VERIFICACIÓN DE DEPLOY (antes de medir, no se asumió):** comparé el `systemMessage` vivo en n8n (vía MCP
> `get_workflow_details`, no por UI) contra `franco-n8n-v71.json` — **idénticos byte a byte** (48.878 caracteres
> los dos). El paste salió bien.
> **MEDIDO en vivo post-deploy (`--repeat 3`, solo los 3 casos necesarios — no la suite completa):**
> - **`consignacion-todo-junto`: 3/3 — el fix funciona.** Turno 1 ("Es un ford ka 2017" todo junto): las 3 corridas
>   explican la consignación y van DIRECTO a pedir los km, sin repreguntar marca/modelo/año (antes recitaba el
>   guion del primer turno igual, 0/3). Turno 2 (dar los km): pide nombre y apellido, sin repreguntar nada.
> - **`consignacion-vende-su-auto`: 3/3 — sin regresión** en el flujo de consignación de 4 turnos ya existente
>   (auto → km → nombre → cierre), mismo comportamiento que antes del fix.
> - **`permuta-una-pregunta-por-vez`: 2/3.** El 1/3 que falló es una burbuja de fallback aislada del parser
>   ("Uy, se me trabó el sistema...") en el turno 2 de una corrida (16,8s de respuesta, contra 2-8s del resto) —
>   NO un cambio de lógica: las corridas 2 y 3 completan los 3 turnos correctamente (piden km, arman el abanico,
>   piden nombre — conforme a la DECISIÓN 2026-07-23 ya vigente). Como v71 está verificado byte a byte para no
>   tocar ni una línea de `## Permuta`, esta falla no puede venir del fix desplegado; encaja con el patrón de
>   parser-fallback intermitente ya documentado varias veces en este archivo (trampa 5, TPM/carga) — no se cuenta
>   como regresión, siguiendo la misma convención que sesiones anteriores (ej. v47: "0/5 — NO es regresión, el
>   1/4 es ruido del parser").
> **Puntero de producción: v71 vivo** (Agustina pegó por UI). `scripts/state-sync.mjs` línea 18 (default sin
> `--file`) bumpeada de v70 → v71 y corrido sin flags para regenerar el header (no a mano); los 5 invariantes
> pasan. **Sin pushear a git** (branch `fixes/historial-color-fotos`).
> **Sigue abierto, sin fix, fuera de alcance de este cambio:** el hallazgo de `permuta-todo-junto` (repregunta de
> km 1/3 cuando el cliente da auto+km todo junto SIN presupuesto/anticipo declarado) — decisión de Agustina si se
> aborda y cuándo; no se tocó `## Permuta` para no romper "un cambio por vez".

> **Sesión 2026-07-29. CARDS de otra marca en consulta por MARCA — HECHO, DESPLEGADO (v70) Y MEDIDO.**
> Captura Agustina: "algo de Volkswagen?" → el texto lista bien las 4 VW pero las CARDS traían Ranger/S10/Hilux/
> Renegade (Ford/Chevrolet/Toyota/Jeep), y Franco los llamaba "pickups Volkswagen". Root: Buscar auto devuelve el
> match exacto + alternativas de la MISMA carrocería; VW abarca 4 carrocerías (SUV/pickup/sedán/hatchback), así que
> las alternativas se vuelven casi todo el stock de otras marcas. Bug FLAKY (Franco a veces mete esas alternativas en
> auto_ids → cards): baseline ~2/6. `scripts/buscar-auto-alternativas-una-carroceria.mjs` (v69→v70): las alternativas
> por carrocería salen SOLO cuando `carr_pedida` tiene 1 fila (la consulta apunta a UNA carrocería = un modelo/tipo);
> una marca que abarca varias carrocerías devuelve SOLO esa marca. SQL puro en Buscar auto (`(SELECT count(*) FROM
> carr_pedida) = 1`); Franco systemMessage y todo lo demás byte-idéntico. Invariantes ✅. Check nuevo en run.mjs:
> `cards_titles_not_contains` (mira las marcas de las product_cards; los checks de texto no ven las cards). **Eval
> `buscar-marca-solo-esa-marca`**: baseline v69 ~2/6 (cards Ford/Toyota/Jeep). **Medido v70: 5/5** (cards solo VW,
> determinístico). **Control `modelo-no-stock-alternativas-carroceria` 5/5** (Amarok → Ranger/S10/Hilux sigue saliendo:
> es 1 carrocería). **Puntero: v70 vivo** (Agustina pegó por UI). state-sync L18 → v70. Sin pushear a git.

> **Sesión 2026-07-29. FILTRO DE TRANSMISIÓN (automáticos determinístico) — HECHO, DESPLEGADO (v69) Y MEDIDO.**
> Captura Agustina: "qué automáticos tenés?" → Franco listaba de MEMORIA e incluía MANUALES como automáticos (S10 y
> Hilux son Manual en stock.csv) o curaba 3 "por ejemplo". Root MEDIDO (stock.csv + stock-update-metadata.sql): la
> transmisión NO está en metadata (solo se cargan año/km/precio/condicion), solo vive en el texto `content`
> ("transmisión manual/automática/cvt"), así que no había filtro determinístico y Franco adivinaba. Automáticos reales
> (incluye CVT) = 5: Vento, T-Cross, Renegade, Ranger, Corolla. `scripts/buscar-auto-filtro-transmision.mjs` (v68→v69):
> (A) Buscar auto — param `transmision` + filtro determinístico sobre `content` (automatica matchea "transmisión
> autom%" OR "cvt"; manual matchea "transmisión manual"); (B) prompt ## Buscar auto — routing: para consultas por
> transmisión usar esta tool con transmision=..., y mostrar TODOS sin curar (la data sale de la ficha, no de la
> memoria). Toca 2 nodos (Buscar auto query + Franco systemMessage); Config/Listar stock/Detalle/CRM/Armar respuesta/
> Leer lead byte-idénticos. Invariantes ✅ (trampa 3: `$fromAI('transmision')` 2x byte-idénticas). **Eval
> `stock-automaticos-todos`**: baseline v68 **0/3** (metía S10/Hilux manuales, o curaba). **Medido v69: 3/3** (los 5
> automáticos reales, sin manuales, ofrece más detalle/stock completo). **Control `modelo-no-stock-alternativas-
> carroceria` 3/3** (la lógica de carrocería/alternativas de Buscar auto no regresó). **Puntero: v69 vivo** (Agustina
> pegó por UI). state-sync L18 → v69. Sin pushear a git. NOTA: la transmisión sigue solo en `content`; si a futuro se
> quiere como campo estructurado (mostrarla, o filtrar en Listar stock), sumar 'transmision' a metadata (una SQL como
> stock-update-metadata.sql). Combustible tiene el mismo estado (está en metadata pero ninguna tool lo filtra aún).

> **Sesión 2026-07-29. BUG post-derivación (cierre que re-ofrece / inventa acciones) — HECHO, DESPLEGADO (v68) Y MEDIDO.**
> Captura Agustina: tras derivar (implícito vía financiación + nombre, estado='Requiere asesor'), el cliente pregunta
> la dirección; Franco da la dirección PERO re-ofrece el asesor y/o inventa acciones que no puede hacer ("te reservo la
> S10", "te preparo un turno", ofrece el teléfono). MEDIDO (`scratchpad/repro-postderivacion.mjs` + eval): estado YA
> estaba en 'Requiere asesor' → NO es lag, y la frase la genera FRANCO, no el guard de Armar respuesta (trampa 7
> descartada por medición). Root cause: la regla de cierre comercial (## Paso 4 "ofrecés que un asesor lo contacte" +
> cierre obligatorio) le gana a "LA DERIVACIÓN MANDA". Es lenguaje → prompt. `scripts/derivacion-cierre-windown.mjs`
> (v67→v68), 2 ediciones (trampa 6, reemplazan los guiones que enseñan el bug + ejemplo concreto): (A) ## Paso 4: si
> ya está derivado, cierre SECO (dirección + "quedo a disposición"), sin re-ofrecer; (B) # Derivación: dos reglas nuevas
> — wind-down tras derivar + NO simular acciones (reservar/preparar/agendar/pasar teléfono), con los mismos
> anti-ejemplos que Franco produjo. Solo toca el systemMessage (+1681). Verificado byte a byte (35 nodos, solo Franco;
> Config/tools/CRM/Armar respuesta/Leer lead idénticos). Invariantes ✅ sobre v68. **Eval
> `derivacion-cierre-no-reofrece-ni-inventa`** (5 turnos, deriva por financiación): baseline **0/4** (re-ofrece/inventa
> las 4 veces, incluso "pasar el teléfono" y "preparar un turno"). **Medido v68: texto limpio 4/4** (el 1/4 "FAIL" es
> lead_check timeout del CRM async, no el bug — el fix ancla al hecho conversacional, no solo al estado). **Controles
> 4/4** (derivacion-completada-nueva-pregunta, no-repite-asesor, pide-datos-del-usado, comparacion-incluye-descriptivo)
> — sin regresión, y comparacion confirma que el cierre comercial legítimo SIGUE disparando cuando NO hay derivación.
> **Puntero: v68 vivo** (Agustina pegó por UI). state-sync.mjs L18 → v68. Sin pushear a git.

> **Sesión 2026-07-24. CONSIGNACIÓN Fase 1 (FAQ + prompt) — HECHA, DESPLEGADA (v67) Y MEDIDA.**
> Pedido de Agustina: sumar el mecanismo de venta por CONSIGNACIÓN (el cliente quiere que la agencia le VENDA
> su auto — distinto de permuta, donde compra y entrega el usado como parte de pago). Decisiones: comisión 5%
> FIJA (Franco la dice), SOLO consignación (sin compra directa), captura en CRM = **Fase 2 aparte**.
> `scripts/consignacion-faq-y-prompt.mjs` (v66→v67), 2 cambios determinísticos (regla del proyecto: dato→FAQ,
> lenguaje→prompt): (A) `Config.empresa_faq` += bloque consignación (comisión 5%, sigue siendo titular,
> requisitos, plazos/cobro); (B) systemMessage: sección nueva `# Consignación (vender tu auto)` entre Cotización
> y Alcance — separa consignación de permuta con señales explícitas ("quiero vender mi auto", "me lo venden?"),
> prohíbe abrir presupuesto/anticipo y mostrar stock (auto_ids VACÍO), reusa la derivación existente
> (auto→km→nombre, de a uno) + ejemplo concreto de la 1ra respuesta (trampa 6). NO toca CRM ni ningún nodo
> Postgres. **Verificado byte a byte:** 35→35 nodos, solo cambian Config (solo `empresa_faq`) y Franco
> systemMessage (+1707, sigue con `=` → trampa 1); prefijo/sufijo idénticos; Listar stock / Guardar lead / CRM /
> Armar respuesta / Leer lead byte-idénticos. Invariantes ✅ los 5 (verificados sobre v67 con `--file`).
> **Eval nuevo `consignacion-vende-su-auto`** (4 turnos): baseline v66 FALLA (turno 1 no matchea
> consigna|comisión → v66 lo mandaba a "tasación" genérica; el resto del flujo de derivación ya andaba).
> **Medido v67 vivo: 3/3 estable + 1 = 4/4.** Transcript limpio: T1 explica consignación+5%+titular y pide el
> auto (sin stock/presupuesto), T2 km, T3 nombre "para inspección y contrato", T4 confirma + nombre de pila +
> cierra. **Controles:** `permuta-una-pregunta-por-vez` OK; `permuta-mas-efectivo` **3/5** con --delay 6000
> (dentro de su banda flaky histórica 2/4–4/4; el 1/4 previo fue contención de correr evals en ráfaga, trampa 5)
> — sin regresión atribuible (path byte-idéntico, sin mecanismo; consignación solo dispara con señal de vender).
> **Puntero: v67 vivo.** Agustina lo pegó por la UI de n8n sobre "Franco Master - Demo Render (Fase 2)"
> (`Khct6BjiMNXZK5Oi`). **NO por MCP:** `update_workflow` solo acepta código SDK = regenerar los 35 nodos, riesgo
> de romper las trampas → se descartó a conciencia. state-sync.mjs L18 → v67. **Sin pushear a git** (branch
> `fixes/historial-color-fotos`). **SIGUE: Fase 2** — captura de consignación en el CRM: columna nueva
> `quiere_vender` + toques en Guardar lead / prompt CRM (gpt-4.1, trampa 5) / Leer lead (estado) / estado_cliente
> (6 lugares + la DB). Su propio eval que falla primero y medición del parser-fallback del CRM.

> **Sesión 2026-07-24. BUG-A.1 (mostrar TODAS las alternativas) — HECHO Y MEDIDO. v64. + TB-3 PENDIENTE (no-op).**
> BUG-A.1 (captura): Franco mostraba 3 pickups y ofrecía "más", omitiendo la Ranger. FIX (prompt ## Buscar auto):
> mostrar TODAS las de la carrocería (match_tipo='alternativa'), cerrar con detalle/stock completo. `scripts/
> buga-mostrar-todas-las-alternativas.mjs`. **Medido:** repro 3/3 con las 4 pickups (Amarok/S10/Hilux/Ranger)
> nombradas + como cards [15,14,16,13]. Verificado byte a byte. **Puntero: v64.**
> **TB-3 (encabezado del abanico por código) — HECHO Y MEDIDO. v63→v65→v66.**
> `scripts/tb3-encabezado-abanico-por-codigo.mjs` (v63: SQL echo + composición), `tb3-fix-acceso-listar-stock.mjs`
> (v65: acceso `.response[0]` — el tool envuelve en `{response:[...]}` — + fallback a Leer lead estado),
> `tb3-encabezado-burbujas.mjs` (v66: robusto a header en burbuja separada). Listar stock echoa eco_permuta/
> financia/presu; Armar respuesta compone el encabezado SOLO con lo que hay (no inventa usado/anticipo/efectivo).
> **PRUEBA VINCULANTE (log 7759):** eco flags echoados; msg[0] reemplazado por "Con tu usado como parte de pago y
> tu efectivo, estas opciones te pueden servir:" (caso burbuja separada). **Medido v66:** eco 1/9 (era ~50%);
> code header fira siempre que el abanico emite auto_ids (autos>=3). **Residual:** cuando Franco NO emite auto_ids
> (cards flaky, TB-2) el header no se compone → el eco de Franco queda. El gate autos>=3 es a propósito (no
> disparar en fichas). **Puntero: v66.** Queda TB-2 (que el abanico emita auto_ids siempre) como lo único abierto
> de target-b.

> **Sesión 2026-07-24. BUG-B (descriptivo en comparaciones) — HECHO Y MEDIDO. v62.**
> `scripts/comparacion-incluye-descriptivo.mjs`. BUG (captura): al comparar 2+ vehículos Franco daba solo ficha
> técnica; falta el ángulo de `descripcion` ("la opción de quien quiere 0 km sin esperar"). Data disponible
> (Detalle auto ya devuelve descripcion). FIX (prompt, Paso 3): regla de COMPARACIÓN — por cada auto el porqué de
> `descripcion` va sí o sí, técnica breve. **Medido:** `comparacion-incluye-descriptivo` descriptivo 3/4 (era
> ~1/3). Residual 1/4 se va a lo técnico (prompt, sin lever determinístico limpio). Verificado byte a byte.
> **Puntero: v62. Sigue TB-3** (eco del encabezado del abanico) — decisión de Agustina: encabezado por código vs
> limpiar el eco.

> **Sesión 2026-07-24. BUG-A (alternativas por carrocería) — HECHO Y MEDIDO. v61.**
> `scripts/buscar-alternativas-por-carroceria.mjs`. BUG (captura): pidió "Amarok 4x2 2022-24"; Franco pasó
> `anio_min=2022` a Buscar auto (5 veces, log 7661) → la Amarok 2018 filtrada por el año → 0 filas → cayó a
> buscar "Volkswagen" (marca) → mostró T-Cross/Vento, ocultando la Amarok y sin ofrecer pickups. FIX
> (determinístico): Buscar auto **ya no filtra por año** (rangos año/precio son de Listar stock) y devuelve el
> modelo/tipo pedido (`match_tipo='exacto'`, cualquier año) + alternativas de la MISMA CARROCERÍA
> (`match_tipo='alternativa'`), vía CTE `carr_pedida`. Se cae el param `anio_min` de Buscar auto. Prompt
> ## Buscar auto reescrito (no ocultar el modelo, alternativas por carrocería, ofrecer stock/detalle).
> **OJO — bug propio corregido:** la 1ra versión de v61 referenciaba el alias `match_tipo` en el ORDER BY →
> Postgres error "column match_tipo does not exist" (log 7664, la query erroraba). Fix: ORDER BY con la condición
> cruda, no el alias. **Medido (v61 corregido):** repro `modelo-no-stock-alternativas-carroceria` 3/3 — menciona
> la Amarok 2018 en stock + ofrece pickups (Ranger/S10). Verificado byte a byte. **Puntero: v61.**
> **Sigue:** BUG-B (descriptivo en comparación de 2+ vehículos, tarea #7) y TB-3 (eco del encabezado).

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
