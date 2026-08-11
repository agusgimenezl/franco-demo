# Prompt de arranque — próxima sesión

Pegar tal cual al abrir la sesión nueva.

---

Proyecto Franco (agente vendedor de autos, n8n + Supabase + React).

Antes de proponer nada: leé `CLAUDE.md` y después `docs/franco/STATE.md`. Las entradas de arriba de
todo son de la sesión del **2026-08-10/11** (v118 → v127). **Hay varias entradas viejas marcadas con
❌ o ⚠️ porque quedaron corregidas: no las leas como verdad.**

## ESTADO ACTUAL

- **En producción: v127** (`workflows/franco-n8n-v127.json`), 35 nodos, los 5 invariantes pasan.
  El puntero de `scripts/state-sync.mjs` dice v127 y el encabezado de STATE está regenerado y visto.
- **✅ v127 DESPLEGADO Y MEDIDO: 12/12** (ventana 05:31:59–05:44:10Z del 2026-08-11).
  `anticipo-minimo-es-la-mitad` **0/3 → 3/3**, y los 3 controles siguen 3/3. Ver la entrada de arriba
  de todo en STATE. **No queda nada de v127 a medio terminar.**
- **Evals: 91 casos.** Branch `fixes/historial-color-fotos`. **NADA COMMITEADO NI PUSHEADO.**
- **SUPABASE POR MCP** (project `qfmsdgjtlduravrtqrif`). Usalo siempre.
- **El deploy lo hace Agustina por UI.** Nunca por MCP `update_workflow`.
- **`--delay 45000`.** El eval sale con exit code != 0 en Windows por un assert de libuv al cerrar:
  **no encadenes dos corridas con `&&`**, usá `;`.
- **Respaldo del stock: `autos_disponibles_backup_20260810`** (17 filas, previo a la migración).

## LO PRIMERO: AVISAR ANTES DE DESPLEGAR, Y USAR EL GUARDIA

El 2026-08-10 entraron **tres deploys en mitad de una tanda** y cada vez costó lo mismo: el "antes"
deja de valer y hay que reconstruirlo a mano cruzando `updatedAt` del workflow contra los timestamps
de sesión de `mensajes_demo`.

Ya existe el guardia en `evals/run.mjs`: pregunta la versión **antes y después de cada corrida**,
marca las que quedaron a caballo y, si hubo cambio, imprime el desglose **por versión** en vez de un
promedio que mezcla builds. **Es opt-in por `N8N_API_KEY`** (más `N8N_WORKFLOW_ID`, con el de
producción por defecto). Sin la key no corre **y lo avisa en el encabezado**.

> **PENDIENTE CONCRETO: el camino CON key nunca se ejercitó**, porque la credencial no está en el
> repo. La primera tanda que corra con `N8N_API_KEY` puesta lo estrena. La lógica del veredicto sí
> está probada: `scripts/el-guardia-de-deploy-avisa.mjs`, **12/12**, incluido el escenario exacto
> de ese día y el de deploy+rollback dentro de la misma tanda.

## LO QUE SE CERRÓ, TODO MEDIDO

| versión | qué arregló | evidencia |
|---|---|---|
| v118 | el chico que entra dejó de estar silenciado por la etiqueta `economica` | ejecución `14658`: el Etios LLEGÓ (`tamano: chico`, $14.500.000, `categoria: economica`) y lo excluyó la línea 125, no el tamaño. Caso 1/3 → **3/3** |
| v119 | la firma del detector "la ficha ya se dio" no era única | ejecución `14788`: `Detalle auto` devolvió `ficha_completa: "YA LE DISTE LA FICHA…"` para el Corolla porque comparte `7.2 L/100km` con la T-Cross. **3/3** |
| v120+v121 | el piso de carrocería sin presupuesto · las fotos no exigen ir al local | ejecución `14830`: contestó "qué pickups tenés" **sin llamar a ninguna herramienta**, recitando la línea 147. `no-ofrecer` 1/3 → **3/3** |
| v122 | ❌ **SE DESPLEGÓ ROTA** — ver abajo | `stock-general-completo` 3/3 → **0/3** |
| v123 | arregló v122 | `stock-general-completo` **3/3** |
| v124 | **cerró el bug del piso de verdad** | caso 1/3 → **3/3**, y `no-ofrecer` siguió 3/3 |
| v125 | el gemelo del bug del Etios, en carrocería | base **0/3** sobre v124 → **3/3** sobre v125. `chico-no-es-utilitario` siguió **3/3** (control: v125 reordenó el mismo `CASE` de v118) |
| v126 | el anticipo mínimo sale calculado de `Detalle auto` | **el fix ANDA** (ejec. `15225`: el campo llega y el modelo lo usa) pero el caso da **0/3** porque el corrector de precios lo pisa aguas abajo. Los 3 controles de `Detalle auto`: **3/3** |
| **v127** | que el corrector de precios no pise el anticipo | caso **0/3 → 3/3** y los 3 controles con montos en renglones con nombre de auto siguen 3/3 (12/12). En `mensajes_demo` las 3 corridas entregaron **$10.500.000**, cada una con otra redacción; **ni un `$21.000.000` como anticipo** |

## OJO CON ESTO ANTES DE CONFIAR EN UNA TANDA

**El 2026-08-11 n8n se cayó ~4 horas en mitad de una medición y el eval no lo dijo claro.** La tanda
quedó viva desde las 00:42 hasta las 04:41 con un hueco de 3h50 en `mensajes_demo`, tirando
`fetch failed` y `operation aborted due to timeout`. Se descartó entera y se repitió.

- **YA ARREGLADO:** el runner ahora separa una falla de RED de un rojo de contenido (`esFallaDeRed`
  + `veredictoRed`), probado 26/26 con los mensajes literales de esa caída.
- **El eval no imprime nada mientras corre** (la salida va bufereada por el pipe), así que una tanda
  colgada parece una lenta. **Mirar el reloj**: 3 casos × 3 repeats con `--delay 45000` son ~12 min.
- **NO usar `head -N` en el pipe del eval:** trunca justo el detalle de las fallas.
- Para diagnosticar, `--no-cleanup`, o las sesiones se borran y no queda nada que mirar.

## LAS LECCIONES QUE COSTARON VERSIONES

**1. QUITAR EL INSUMO GANA; AGREGAR UNA PROHIBICIÓN PIERDE.** Es la más importante y es un
refinamiento de la trampa 6. v120 atacó el guion del piso **agregando una inyección determinística
que decía "PROHIBIDO EN ESTE TURNO"**. No alcanzó: seguía saliendo en 2 de 3, y el log (`15019`)
mostró que la inyección **sí se había producido** —`carroceria_pedida: "pickup"`,
`entrega_plata: 0`— y Franco la ignoró. v124 lo cerró **sacando la línea `PISOS DE STOCK` cuando no
hay techo declarado**: sin el dato, no hay número que recitar. Contra una sección entera de prosa
que empuja para el otro lado, un párrafo pierde.

**2. UN ASSERT QUE MIRA EL TEXTO Y NO EL SIGNIFICADO NO ES UN ASSERT.** v122 se desplegó rota: se
agregó `traccion` al CTE `base` y al SELECT final, pero el CTE intermedio `con_categoria` tiene
**lista explícita de columnas** y la tiraba. Postgres devolvía `ERROR 42703`, **el agente se comía
el error de la tool** y Franco inventaba el texto. El assert `q.split('tamano, traccion,').length
=== 2` pasó porque el string estaba; nadie verificó que la columna resolviera.
→ **Ahora hay un assert que verifica que toda columna que el SELECT final le pide a `u` exista en
`con_categoria`** (en los scripts de v123 y v125). Corrido contra v122 devuelve `["traccion"]`.
→ **Y la regla: antes de desplegar un cambio de SQL, renderizar la query y CORRERLA contra la base.**

**3. SI LAS CARDS ESTÁN BIEN Y EL TEXTO ESTÁ MAL, EL TEXTO NO VINO DE LA HERRAMIENTA.** Es la firma
que diagnosticó v122 en un minuto: las cards las arma `Hidratar autos`, que lee la base por otro
lado. Precios y cards correctos + kilómetros inventados = la tool falló.

**4. `search_executions` CON STATUS ERROR NO ALCANZA.** Un error de una tool **no** marca la
ejecución como fallida: devuelve vacío aunque todo esté roto. Hay que mirar el contenido.

**5. UNA FIRMA QUE NO ES ÚNICA NO ES UNA FIRMA.** `metadata.consumo` se usaba como prueba de "esta
ficha ya se dio" y hay tres grupos que lo comparten. Se cuidó el FORMATO y nunca la UNICIDAD.

**6. CUIDADO CON LAS TILDES AL COMPARAR CONTRA `Config`.** `metadata.carroceria` guarda **"Sedán"**
y el detector emite **"sedan"**. Un `lower()` directo **nunca** habría matcheado sedán —una de las
cinco— en silencio. Probado: sin `translate` el match da 0, con `translate` da 4.

**7. PARA DIAGNOSTICAR, CORRER CON `--no-cleanup`.** Si no, las sesiones se borran y no se puede
mirar nada después.

**8. UN CORRECTOR DETERMINÍSTICO ES UN ARMA CARGADA APUNTANDO AL FUTURO.** `Armar respuesta` tiene
dos: el de PRECIOS (v105) y el de AÑOS (v109). Los dos pisan lo que escribe el modelo, y los dos
funcionan. Pero **cada campo NUEVO que meta un número en el texto entra en su rango de tiro**: v126
agregó el anticipo mínimo y el corrector de precios lo reescribió al precio del auto (ejecución
`15225`: el modelo dijo $10.500.000 y al cliente le llegó $21.000.000). **Antes de agregar un dato
numérico a una respuesta, preguntarse qué corrector lo va a tocar.**
→ Y el corolario de diagnóstico: **si el modelo dijo bien y el cliente recibió mal, es un corrector.**
Comparar `Franco (AI Agent)` contra `mensajes_demo` en la MISMA ejecución lo resuelve en un minuto.

## MAPA DE ACOPLAMIENTOS — LEER ANTES DE TOCAR DATOS, SQL O EL EVAL

Lo de la sesión anterior sigue vigente (el mapa `PRECIOS` hardcodeado en `evals/run.mjs`, la frase
`"Condición: … ."` que `Detalle auto` borra, `Buscar auto` matcheando transmisión y tracción contra
`content`, `tiene_permuta` como `$fromAI` y no SQL, y que **no hay búsqueda vectorial**). Se suman:

- **`con_categoria` tiene LISTA EXPLÍCITA de columnas.** Cualquier columna nueva en `base` tiene que
  agregarse ahí también o desaparece. Es lo que rompió v122.
- **`metadata.consumo` sigue siendo la firma de la ficha, pero ahora exige TAMBIÉN el modelo**
  (v119). Si cambian los consumos, revisar colisiones.
- **`Detalle auto` devuelve `version` como campo propio** desde v119, para que sobreviva a la
  supresión de la ficha.
- **`Listar stock` devuelve `traccion` SÓLO para Pickup** (v122/v123). Los 13 restantes vienen NULL.
- **La línea `PISOS DE STOCK` ya NO se inyecta siempre** (v124): sólo si hay anticipo (en el mensaje,
  en la respuesta o en el historial), monto a financiar, o presupuesto en el lead. **`no-ofrecer-lo-
  que-no-existe` depende de que aparezca** — su señal es `monto_financiar_hist = 30.000.000`.
- **El eval espeja DOS dedup distintos y hay que respetar la diferencia:** las cards se suprimen por
  `cards_recientes`, las fotos sólo por `ids_recientes`, y *"haber aparecido como card NO cuenta"*.
  Por eso `mediaPorTurno` e `imagenesPorTurno` van separados en `run.mjs`.
- **El mapa `id → modelo` del eval se aprende SÓLO de las cards.** Si un auto llega únicamente como
  foto, no se acredita y el check queda conservador (falso rojo, nunca falso verde). **Si alguna vez
  hace falta cerrarlo, la forma sana es agregarle el id al `PRECIOS` que YA existe y extender el
  assert que ya lo valida contra la base — un mapa, no dos.**

## LOS PENDIENTES, EN ORDEN

### 0. ✅ CERRADO — v127 pegado y medido (12/12). No arranques por acá.
Queda **una** cosa anotada, y es a conciencia: la guarda aritmética de v127 no corrige un precio
inventado que caiga **exactamente** en la mitad del precio real. Es el sesgo elegido (igual que
v116), **no tiene caso de eval** y no vale la pena abrirlo salvo que aparezca en producción.

### 1. 🟡 La fuga de vocabulario interno — CENTINELA ARMADO, BUG SIN REPRODUCIR
**Ya tiene check general y caso**, así que el primer paso está hecho: `no_vocabulario_interno` en
`ALWAYS` (corre en los 92 casos), probado 32/32 en
`scripts/el-vocabulario-interno-no-sale-al-cliente.mjs`, más el caso `no-fugar-vocabulario-interno`.
El check de `otro_tamano` que estaba suelto en el turno 2 de `chico-no-es-utilitario` queda cubierto.

**PERO NO SE REPRODUJO: 0 de 18 sobre v127, así que NO se intentó ningún fix** (la regla: si no falla
primero, no se entendió). Caracterizada contra 2701 sesiones: 19 fugas, 3 firmas, la última del
2026-08-10. Hipótesis de por qué se apagó: **la fuga necesita el bloque `entra` VACÍO**, y v118 —al
dejar de silenciar el Etios— sacó al guion original de ese estado.

**No arranques por acá salvo que el centinela se ponga rojo en alguna tanda.** Cuando lo haga vas a
tener el texto exacto y el estado, que es justo lo que faltaba. **0 de 18 no prueba ausencia:** a la
tasa histórica del guion (~12%) ver cero en 12 pasa 1 de cada 5 veces.
⚠️ **Los otros 90 casos no se corrieron con el check nuevo.** El respaldo es offline (2701 sesiones,
0 falsos positivos), que es más grande que una pasada de la suite pero no es lo mismo.

### 2. "Cómo sería con 24 cuotas" no lo entiende
Quedó afuera de v126 a propósito: el anticipo era aritmética y fue a SQL, pero esto es guion
(trampa 6) y necesita su propio caso. **El CUIL NO existe en `crm_leads`**: es función nueva, no
regresión.

### 3. ETAPA 2 de la migración — la copy (NECESITA CRITERIO COMERCIAL DE AGUSTINA, no corrección)
El documento contradice **12 de las 34 frases** de `descripcion`/`condicionantes`. Las peores: el
Kangoo dice *"sólo dos asientos"* (son 5), el Onix y la EcoSport dicen *"caja manual"* (son
automáticas), el Vento dice *"150 HP"* (son 230 CV), el Etios dice *"no trae pantalla"* (trae), y el
Duster dice *"la potencia es justa"* — **y esa palabra la chequea `descripcion-que-aporta`**.

### 4. `detalle-un-auto-fotos` es flaky ~1 de 7
Medido: 4/4 en una tanda, 2/3 en otra. El disparador **no es el check**: el turno 1 a veces lista tan
pocos autos que `Armar respuesta` toma el camino de imágenes en vez de cards, y eso arrastra el turno
2. Es conducta de producto.

### 5. El gate de km — abierto desde v45. No es regresión de nada.

### 6. v112 y v114: desplegados y SIN EJERCITAR. Ninguno disparó nunca en producción.

### 7. Deuda anotada: leer la salida de un nodo TOOL desde `Armar respuesta` NO funciona
(`$('Listar stock').first().json` no devuelve `{response:[...]}`). Por eso el centinela de v102 es
código inerte. **Si tocás ese nodo, no confíes en esa lectura.**

## REGLAS DEL PROYECTO QUE NO SE NEGOCIAN

- Un bug nuevo se convierte en caso de eval ANTES de arreglarlo, **y tiene que fallar primero**. Si
  no falla, no entendiste el bug — **decilo en vez de inventar una falla**.
- Un cambio por vez. Correr evals antes y después. **Nunca correr evals mientras se toca la base o
  `cases.json`/`run.mjs`.**
- **Antes de desplegar SQL: renderizar la query y correrla contra la base.** No alcanza con asserts
  de string ni con probar el `CASE` por separado. Es la lección de v122.
- Nunca dar algo por resuelto sin haberlo medido, **y decir explícitamente qué quedó sin medir**.
- **LEER EL LOG DE n8n ANTES DE TEORIZAR**, y comparar `Franco (AI Agent)` contra `Armar respuesta`
  en la MISMA ejecución. **Y mirar si `metadata` lista subruns de herramientas**: si no hay ninguno,
  Franco contestó de memoria.
- No pisar el workflow de producción: copia nueva en `workflows/`, con un script en `scripts/` que
  aplique el cambio **con aserciones** (incluida una que verifique que el texto viejo YA NO ESTÁ).
- El deploy lo hace Agustina por UI. **Avisar antes de desplegar si hay una tanda corriendo.**
- `search_executions` (status error, con la ventana EXACTA) en CADA TANDA — **sabiendo que no caza
  los errores de tool**.
- Actualizar `docs/franco/STATE.md` como parte del cambio, no después.
- **Verificar el puntero DESPUÉS de cada deploy**: editar la línea de `state-sync.mjs` y **mirar el
  encabezado regenerado**, no sólo correr el script.
- **Si te equivocaste y quedó escrito en STATE, corregilo ahí mismo y dejá marcada la entrada vieja.**
