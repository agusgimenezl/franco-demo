# Prompt de arranque — próxima sesión

Pegar tal cual al abrir la sesión nueva.

---

Proyecto Franco (agente vendedor de autos, n8n + Supabase + React).

Antes de proponer nada: leé `CLAUDE.md` y después `docs/franco/STATE.md`. Las entradas de arriba de
todo son de la sesión del **2026-08-12**. **Hay entradas marcadas con ❌ porque quedaron corregidas
—incluso algunas corregidas el mismo día que se escribieron—: no las leas como verdad.**

## ESTADO ACTUAL

- **En producción: v137** (`workflows/franco-n8n-v137.json`), 35 nodos, **6** invariantes.
  El puntero es la constante `PRODUCCION` en `scripts/state-sync.mjs`.
- **v138 y v139 SE DESPLEGARON Y SE REVIRTIERON EL MISMO DÍA. No los reintentes como estaban**
  (abajo está el porqué de cada uno).
- **Evals: 102 casos.** Línea de base viva: `evals/baseline-v137.json`, **14 casos, 25/42**.
- **SUPABASE POR MCP** (project `qfmsdgjtlduravrtqrif`). **n8n también tiene MCP** y sirve para leer
  logs de ejecución: `search_executions` + `get_execution` con `nodeNames`. Se usó todo el día y fue
  lo que encontró las causas raíz.
- **El deploy lo hace Agustina por UI.** Nunca por MCP `update_workflow`.
- **`--delay 45000`.** El eval sale con exit code != 0 en Windows: **no encadenes dos corridas con
  `&&`**, usá `;`. Con `> archivo.log` la salida se ve mientras corre.
- **13 commits sin pushear.**

## LO QUE ESTÁ VIVO Y MEDIDO (no lo rompas)

| versión | qué hace | evidencia |
|---|---|---|
| v134 | el guion del anticipo mira el auto de interés | caso **0/3 → 3/3** |
| v135 | 8 filtros de las tools dejan de ser obligatorios | controles 3/3, sin regresión |
| v136 | el parser entiende *"un anticipo de 10M"* | caso **0/3 → 2/3** |
| v137 | las URLs de las fotos salen del texto | centinela **3 disparos → 0** |

## LAS DOS LECCIONES QUE COSTARON UN REVERT CADA UNA

**1. ANTES DE SACARLE UN INSUMO AL PROMPT, ENUMERÁ QUIÉN LO CONSUME.** v138 suprimía `PISOS DE
STOCK` en los turnos de "dar un dato". Cerró sus dos objetivos y rompió `capacidad-de-compra-financiada`
(2/3 → 0/3): Franco volvió a pedir el usado que el cliente ya había dado. Se había verificado contra
**5 escenarios inventados**, no contra los casos que la suite ejercita. Existe
`scripts/quien-depende-de-los-pisos.mjs`, que los enumera: **da 16, yo había medido 3.**

**2. "AGREGAR ES SEGURO, SACAR ES PELIGROSO" ES FALSO.** Esa regla se escribió tras revertir v138 y
se desmintió tres horas después con v139, que sólo agregaba `defaultValue` a 8 parámetros: bajó
`capacidad-de-compra-financiada` a **2/9**. **Los `required` de `usado_marca`/`usado_modelo`/
`usado_anio` no eran un descuido: eran una validación que funcionaba**, obligaban al modelo a
completar los datos del usado. El error ruidoso tapaba uno silencioso peor.

> **La pregunta correcta antes de poner un default: ¿ESE VALOR NEUTRO EXISTE?**
> "Sin permuta" existe. "Un usado sin marca" **no**: es un dato faltante disfrazado de dato.
> Ningún assert puede cazar esto — verifican mecánica, no si el neutro existe conceptualmente.

**Y una de método que vale para las dos:** cuando varios controles bajan, **desglosá por TIPO de
check antes de acusar al fix**. En v138 dos de los tres controles bajaron sólo por el fallback, una
causa preexistente e independiente. Sin ese desglose se revertía por los motivos equivocados.

## LOS PENDIENTES, EN ORDEN

### 1. `modelo-inexistente-se-avisa-y-se-ofrece` — 1/3. EMPEZAR POR ACÁ.
**Captura de Agustina.** El cliente escribe *"Estoy buscando una Amarok 2023."* y Franco arranca con
*"La Volkswagen Amarok … 2018 es la 4x4 diésel más accesible del stock"*: **le presenta la 2018 como
si fuera lo que pidió, sin aclarar nunca que la 2023 no existe.**

**La regla que fijó Agustina:** (1) se dice que ese modelo/año no lo tenemos, (2) se ofrece la o las
opciones más similares, (3) se cierra con la pregunta comercial.

**Ya está el caso y ya falla.** Es de guion, así que **no toca tools ni parsers** —que es donde se
rompieron v138 y v139—. **Antes de tocar el prompt, releé la trampa 6 de CLAUDE.md:** el ejemplo
concreto le gana a la regla abstracta, así que hay que **reemplazar el guion**, no agregar una
prohibición arriba.
**Dato del agujero que lo dejó pasar:** `no-repite-la-ficha` arranca con EXACTAMENTE ese mensaje,
pero todos sus checks están en el turno 2. El bug ocurría en un turno que ya estaba en la suite y
que nadie miraba. **No toques ese caso: tiene medición abierta.**

### 2. `no-repreguntar-asesor` — 0/3. LA RAÍZ DOCUMENTADA ES FALSA.
Le vuelve a ofrecer un asesor a quien ya lo aceptó. **STATE decía que `Leer lead (estado)` no trae
la columna `estado`, y SÍ la trae** (`COALESCE(l.estado, 'Nuevo') AS lead_estado`, y `Armar
respuesta` la usa). **Hay que rediagnosticar desde cero, y el primer paso es leer el log de n8n de
una corrida que falle**, no teorizar. Tiene línea de base vieja (`baseline-v131.json`).

### 3. Diagnosticados, SIN CASO QUE FALLE (el caso va primero)
- **Las guardas mudas con *"no tengo"***. Produjo un **"$70.000.000"** inventado que contradecía el
  $60.000.000 que Franco había dicho dos turnos antes. **Verificado ejecutando:** con *"no tengo"*
  ninguna de las tres guardas de plata dispara; con *"no tengo usado"* sí. **Y el caso de eval
  `financiacion-techo-por-anticipo` está escrito con la redacción que el regex entiende**, por eso
  está verde mientras el bug vive en producción.
- **El fallback (*"Uy, se me trabó el sistema"*).** Causa conocida (el schema rechaza la llamada),
  **pero v139 probó que NO se arregla con defaults**. El camino es el otro lado: que Franco pida los
  datos que le faltan ANTES de llamar a la tool.

### 4. Reportados por Agustina y SIN REPRODUCIR (no están arreglados: no fallan)
- **Niega stock que existe** (el Corolla): 3/3 verde en 11 corridas. Del log: **no llamó a ninguna
  herramienta**, leyó su propio contexto como si fuera el inventario.
- **El usado inventado**: el CRM copió `vehiculo_interes` en `descripcion_usado` (quedaron idénticos)
  y Franco lo repitió. **El fix está diseñado y sin aplicar** —si son iguales, es error de copia—
  porque el caso no falla. Ya se le agregó un turno intermedio y aun así no reproduce.

### 5. Sin diagnosticar
***"No entendí bien, podés reformular tu mensaje"*** ante un nombre (*"Valen uria"*). **Ese texto no
está en el workflow: lo escribe el modelo.** Nadie lo miró todavía.

### 6. Rotos en producción, descubiertos midiendo y NO investigados
`km-con-presupuesto` **0/3** · `permuta-mas-efectivo` **0/3** · `financiacion-no-re-ofrece` **0/3**.
Los tres sobre v137, o sea que vienen de antes. **No se sabe si son bugs reales o checks
desactualizados.** Aparecieron sólo porque se enumeró a quién podía tocar un fix.

### 7. Lo que sigue abierto de antes
- `no-repite-la-ficha` (0/3) y `la-ficha-que-no-se-dio-no-esta-dada` (1/3), sin atribuir.
- `condicionante-si-preguntan`: **dio 3/3, no se reproduce.** Igual quedó un hallazgo sin usar: la
  frase *"la potencia es justa"* **está escrita dos veces en el prompt** (línea 211 como ejemplo y
  línea 214 como **plantilla de salida pegada al Duster**), y los otros dos ejemplos de esa línea
  coinciden textualmente con condicionantes reales del stock.
- La compuerta de pre-deploy **no cubre cambios de datos**, y tampoco verifica que la línea de base
  contenga los casos que el candidato toca (se tapó a mano dos veces).
- La línea 9 del prompt tiene el bug que cerró v128, en otra rama, sin caso.
- Fuga de vocabulario interno: centinela puesto, **sin reproducir**.
- Los de siempre: `detalle-un-auto-fotos` flaky · el gate de km · **v112 y v114 desplegados y nunca
  ejercitados** · el guardia de deploy nunca corrió con `N8N_API_KEY`.

## REGLAS QUE NO SE NEGOCIAN

- Un bug nuevo se convierte en caso de eval ANTES de arreglarlo, **y tiene que fallar primero**. Si
  no falla, **decilo en vez de inventar una falla**. Hoy pasó tres veces y las tres se dijeron.
- **Escribí el caso con la frase del CLIENTE, no con la que el parser entiende.** Es lo que mantuvo
  a `financiacion-techo-por-anticipo` en verde mientras el bug vivía en producción.
- **Línea de base del caso Y DE LOS CONTROLES, sobre la versión viva, antes de desplegar** — y
  **enumerá los controles, no los estimes**. Medir 3 de 16 fue lo que costó el revert de v138.
- Un cambio por vez. **Nunca correr evals mientras se toca la base, `cases.json` o `run.mjs`.**
- **Antes de desplegar SQL o una expresión: renderizarla y EJECUTARLA.** Y que los escenarios
  ejecutados salgan de los CASOS REALES, no de los que se te ocurran.
- **Declarar la señal ANTES de medir**, incluido el criterio de revert. Se cumplió con v137 y v139 y
  fue lo que permitió decidir sin acomodar la lectura.
- **LEER EL LOG DE n8n ANTES DE TEORIZAR.** Hoy encontró tres causas raíz que ninguna lectura de
  código habría dado.
- **Trampa 7: descartarla es grepear la frase contra el WORKFLOW ENTERO**, no revisar un solo nodo.
  Se dio por descartada mirando `Armar respuesta` y la frase estaba en el systemMessage.
- No pisar el workflow de producción: copia nueva en `workflows/`, con un script en `scripts/` que
  aplique el cambio **con aserciones** (incluida una que verifique que el texto viejo YA NO ESTÁ).
- Actualizar `docs/franco/STATE.md` como parte del cambio, y **verificar el puntero DESPUÉS de cada
  deploy**.
- **Si te equivocaste y quedó escrito en STATE, corregilo ahí mismo y dejá marcada la entrada vieja.**
