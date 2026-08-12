// v140 -> v141 · LOS DATOS DE UN USADO QUE NO EXISTE DEJAN DE SER OBLIGATORIOS, Y LA VALIDACIÓN
// QUE ESO PIERDE SE MUEVE A LA SQL
//
// EL BUG (reportado por Agustina el 2026-08-12: "Franco me responde el fallback a TODO"):
// al mensaje "Hola! busco un auto de 20M aprox, que tenes disonible?" contesta *"Uy, se me trabó el
// sistema un segundo"*. **Reproducido 3/3 contra producción, determinístico.**
//
// LA CAUSA, LEÍDA DEL LOG DE n8n (ejecuciones 16613 y 16614) ANTES DE TEORIZAR — `Franco (AI Agent)`
// devuelve `error` en vez de `output`:
//     Received tool input did not match expected schema
//     ✖ Required → con_financiacion, usado_anio, usado_marca, usado_modelo, usado_categoria, usado_km
// El cliente pide por presupuesto y NO nombra ningún usado: el modelo no tiene qué poner en los
// cinco `usado_*`, los omite, n8n **rechaza la llamada entera** y `Armar respuesta` cae al fallback.
//
// AISLADO CON UN CONTROL, NO SUPUESTO: pasa igual en v140 y en v137 (se revirtió a v137 y se volvió
// a medir: 3/3 en las dos). **No lo causó el guion del año.** Los nodos `Listar stock`,
// `Buscar auto`, `Armar respuesta`, `Config` y `Leer lead (estado)` son byte-idénticos entre las dos
// versiones: lo único que cambiaba era el prompt.
//
// 🔑 EL DATO QUE HACE EL FIX PRECISO Y QUE v139 NO VIO: `tiene_permuta` **NO** está entre los
// rechazados — el modelo SÍ lo mandó, en 0. O sea: el modelo declara "no hay permuta" y aun así se
// le exigen los datos de un usado que no existe. Y la propia SQL ya los ignora en ese caso: en
// `usado_val` los usa sólo dentro de `CASE WHEN tiene_permuta = 1 AND usado_anio > 0 ...`.
//
// POR QUÉ ESTO NO ES v139 OTRA VEZ. v139 le puso `defaultValue` a estos mismos parámetros y
// `capacidad-de-compra-financiada` cayó a 2/9, porque los `required` **eran una validación real**:
// obligaban al modelo a juntar marca/modelo/año del usado antes de poder llamar a la tool. v139 los
// aflojó y no puso NADA en su lugar — "el error ruidoso tapaba uno silencioso peor".
// **Acá la validación no se pierde: se muda a la SQL, que es donde el proyecto manda ponerla.**
// Cuando `tiene_permuta = 1` pero falta marca, modelo o año, la query no devuelve autos: devuelve
// **una fila centinela** que le dice a Franco qué preguntar. El fallo deja de ser fatal (mata el
// turno) y pasa a ser recuperable (Franco pide el dato), sin volverse silencioso.
//
// QUÉ NO LLEVA DEFAULT, A PROPÓSITO: `tiene_permuta`. Es el discriminador del que cuelga todo lo
// demás, el modelo lo viene mandando siempre, y un default de 0 podría tragarse una permuta real en
// silencio. Un cambio por vez y sobre la superficie mínima.
//
// LOS CONSUMIDORES SE ENUMERARON, NO SE ESTIMARON (`scripts/quien-depende-de-los-usado-required.mjs`):
// **40 casos** pasan por el camino A (plata sin usado, lo que hoy revienta) y **14** por el camino B
// (permuta, lo que v139 rompió y hay que proteger).

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v140.json'
const DESTINO = 'workflows/franco-n8n-v141.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Listar stock')
ok(!!nodo, 'no está el nodo "Listar stock"')

let q = String(nodo.parameters.query)

// ── 1) DEFAULTS: los 6 parámetros que el log mostró rechazados ────────────────────────────────
// Se reemplazan TODAS las ocurrencias de cada key por la MISMA cadena + el 4º argumento, para que
// las descripciones y los tipos queden byte-idénticos entre sí (trampa 3 de CLAUDE.md).
const DEFAULTS = {
  con_financiacion: '0',
  usado_anio: '0',
  usado_km: '0',
  usado_marca: "''",
  usado_modelo: "''",
  usado_categoria: "''",
}
const ESPERADAS = { con_financiacion: 8, usado_anio: 3, usado_km: 2, usado_marca: 1, usado_modelo: 1, usado_categoria: 1 }

for (const [key, def] of Object.entries(DEFAULTS)) {
  // La forma actual: $fromAI('key', 'descripcion', 'tipo')  — sin 4º argumento.
  const re = new RegExp("\\$fromAI\\('" + key + "', '([^']*)', '([a-z]+)'\\)", 'g')
  const encontradas = [...q.matchAll(re)]
  ok(encontradas.length === ESPERADAS[key], `${key}: esperaba ${ESPERADAS[key]} ocurrencias sin default, encontré ${encontradas.length}`)
  const descs = new Set(encontradas.map((m) => m[1]))
  const tipos = new Set(encontradas.map((m) => m[2]))
  ok(descs.size === 1, `${key}: ${descs.size} descripciones distintas ANTES del cambio (trampa 3 ya rota)`)
  ok(tipos.size === 1, `${key}: ${tipos.size} tipos distintos ANTES del cambio (trampa 3 ya rota)`)
  q = q.replace(re, (m0, desc, tipo) => `$fromAI('${key}', '${desc}', '${tipo}', ${def})`)
  // El texto viejo YA NO ESTÁ (aserción que pide el proyecto).
  ok(!new RegExp("\\$fromAI\\('" + key + "', '[^']*', '[a-z]+'\\)").test(q), `${key}: quedó alguna ocurrencia SIN default`)
}

// ── 2) LA VALIDACIÓN QUE SE MUDA A LA SQL ─────────────────────────────────────────────────────
// Se arma reutilizando las MISMAS expresiones $fromAI que ya usa la query (con su default nuevo),
// para no introducir una variante de descripción y volver a pisar la trampa 3.
const F = (key) => {
  // `tiene_permuta` sigue SIN default a propósito, así que el 4º argumento es opcional acá.
  const m = q.match(new RegExp("\\$fromAI\\('" + key + "', '[^']*', '[a-z]+'(, [^)]*)?\\)"))
  ok(!!m, `no pude reusar la expresión de ${key}`)
  return m ? m[0] : ''
}
const CENTINELA =
  'ESTE TURNO NO ES PARA MOSTRAR AUTOS: falta un dato del usado que entrega el cliente. ' +
  'Preguntale el que falte (marca, modelo o anio), de a UNA pregunta por turno, y no listes ningun auto hasta tenerlos.'

const CTE_VIEJO = 'base AS (\n'
const CTE_NUEVO =
  `falta_usado AS (
  -- v141 · LA VALIDACIÓN QUE PERDIERON LOS \`required\`, AHORA EN CÓDIGO Y NO EN EL SCHEMA.
  -- Con permuta declarada pero sin marca / modelo / año, la capacidad de compra sale mal y el
  -- turno se degrada en silencio: es EXACTAMENTE lo que pasó con v139 (capacidad-de-compra-
  -- financiada 2/9). El km NO entra acá: su propia descripción declara el neutro ("Poner 0 si no
  -- los sabes") y la valuación ya lo contempla con factor 1. La categoría tampoco: es el fallback
  -- de la valuación, no un dato del cliente.
  SELECT (
    {{ ${F('tiene_permuta')} }} = 1
    AND (
      trim('{{ ${F('usado_marca')}.replace(/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \\-]/g, '').trim() }}') = ''
      OR trim('{{ ${F('usado_modelo')}.replace(/[^A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ \\-]/g, '').trim() }}') = ''
      OR {{ ${F('usado_anio')} }} <= 0
    )
  ) AS si
),
base AS (\n`

ok(q.split(CTE_VIEJO).length - 1 === 1, 'no encontré el CTE `base AS (` una sola vez')
q = q.replace(CTE_VIEJO, CTE_NUEVO)

// La fila centinela, como tercera rama del UNION de `u`. Mismas 15 columnas y en el mismo orden
// que `con_categoria`, con id NULL: `Armar respuesta` filtra las filas sin id
// (`.filter(r => r && r.id != null)`), así que NO puede convertirse en card ni en foto.
const UNION_VIEJO = `  SELECT * FROM con_categoria WHERE NOT EXISTS (SELECT 1 FROM en_presupuesto)
) u`
const UNION_NUEVO = `  SELECT * FROM con_categoria WHERE NOT EXISTS (SELECT 1 FROM en_presupuesto)
  UNION ALL
  -- v141 · UNA FILA EN VEZ DE CERO (trampa 4 aplicada a una tool, igual que el centinela de v93):
  -- el conjunto vacío se confunde con "no hay stock" y el modelo llena el hueco inventando.
  SELECT NULL::int, '${CENTINELA}'::text, NULL::text, NULL::text, NULL::text, NULL::text,
         NULL::text, NULL::int, NULL::text, NULL::text, NULL::text, NULL::text,
         'no_mostrar'::text, 'no_mostrar'::text, 0
  WHERE (SELECT si FROM falta_usado)
) u`
ok(q.split(UNION_VIEJO).length - 1 === 1, 'no encontré el UNION final una sola vez')
q = q.replace(UNION_VIEJO, UNION_NUEVO)

// Y los autos reales se suprimen cuando falta el dato — pero NO la centinela (id IS NULL).
const WHERE_VIEJO = `  AND NOT (({{ $('Config').item.json.monto_financiar }} > 0 OR {{ $('Config').item.json.entrega_plata }} > 0) AND {{ $('Config').item.json.pidio_ver }} = 0)`
const WHERE_NUEVO = WHERE_VIEJO + `
  -- v141 · Sin los datos del usado no se listan autos: sale sólo la centinela, que le dice a Franco
  -- qué preguntar. La condición excluye a la propia centinela por su id NULL.
  AND (u.id IS NULL OR NOT (SELECT si FROM falta_usado))`
ok(q.split(WHERE_VIEJO).length - 1 === 1, 'no encontré el gate de monto_financiar una sola vez')
q = q.replace(WHERE_VIEJO, WHERE_NUEVO)

nodo.parameters.query = q

// ── 2-bis) `Buscar auto`: el MISMO bug, en la otra tool ───────────────────────────────────────
// Lo encontró el invariante 7 nuevo, no yo: `marca_o_modelo` es REQUIRED y su descripción dice
// "Poner vacio si el cliente no nombro ninguno". O sea, la misma contradicción: cualquier llamada
// en la que el cliente no nombre un modelo (buscar por color, por transmisión, por tracción — todos
// usos que la tool declara soportar) muere igual, con el mismo fallback.
// El vacío acá es un estado REAL y la SQL ya lo trata: `WHERE '...' = '' OR ...` y
// `CASE WHEN '...' = '' THEN 'exacto'`. No hay dato faltante disfrazado.
const buscar = wf.nodes.find((n) => n.name === 'Buscar auto')
ok(!!buscar, 'no está el nodo "Buscar auto"')
let qb = String(buscar.parameters.query)
const reMM = /\$fromAI\('marca_o_modelo', '([^']*)', '([a-z]+)'\)/g
const mmAntes = [...qb.matchAll(reMM)]
ok(mmAntes.length === 8, `marca_o_modelo: esperaba 8 ocurrencias sin default, encontré ${mmAntes.length}`)
ok(new Set(mmAntes.map((m) => m[1] + '|' + m[2])).size === 1, 'marca_o_modelo ya tenía firmas distintas (trampa 3)')
qb = qb.replace(reMM, (m0, desc, tipo) => `$fromAI('marca_o_modelo', '${desc}', '${tipo}', '')`)
ok(!/\$fromAI\('marca_o_modelo', '[^']*', '[a-z]+'\)/.test(qb), 'quedó alguna ocurrencia de marca_o_modelo SIN default')
buscar.parameters.query = qb

// ── 3) La descripción de la tool documenta la centinela ───────────────────────────────────────
const DESC_VIEJO = 'Si no devuelve NINGUNA fila'
const desc = String(nodo.parameters.toolDescription)
const DESC_EXTRA =
  ' SI UNA FILA VIENE CON categoria="no_mostrar", ESA FILA NO ES UN AUTO: es un aviso de que falta ' +
  'un dato del usado (marca, modelo o anio). En ese turno no listes ningun auto, no inventes ninguno ' +
  'y no digas que no hay stock: pedile al cliente el dato que falta, de a UNA pregunta. Nunca le ' +
  'copies ese texto al cliente.'
ok(!desc.includes('no_mostrar'), 'la descripción ya mencionaba no_mostrar')
nodo.parameters.toolDescription = desc + DESC_EXTRA

// ── 4) TRAMPA 3, VERIFICADA SOBRE EL WORKFLOW ENTERO ──────────────────────────────────────────
// Cada key de $fromAI tiene que tener descripción y tipo idénticos en TODAS sus ocurrencias, en
// todos los nodos. Es la trampa que hace fallar a n8n con "Duplicate key found".
// OJO: en el JSON las comillas SIMPLES no van escapadas, así que el patrón es el mismo que en el
// texto plano. Escaparlas fue el primer intento y no matcheaba nada — y "no matchea nada" habría
// dado la trampa 3 por verificada sin verificar una sola key.
const todo = JSON.stringify(wf)
const porKey = new Map()
for (const m of todo.matchAll(/\$fromAI\('([a-z_]+)', '((?:[^']|\\.)*?)', '([a-z]+)'/g)) {
  const [, key, d, t] = m
  if (!porKey.has(key)) porKey.set(key, new Set())
  porKey.get(key).add(d + '|' + t)
}
for (const [key, variantes] of porKey) {
  ok(variantes.size === 1, `TRAMPA 3: la key "${key}" tiene ${variantes.size} combinaciones distintas de descripción/tipo`)
}
ok(porKey.size > 0, 'no pude leer ninguna key de $fromAI para verificar la trampa 3')

// ── 5) Nada más se movió ──────────────────────────────────────────────────────────────────────
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 2 && distintos.includes('Listar stock') && distintos.includes('Buscar auto'), `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

// v141 LLEVA EL GUION DE v140: se arma encima, así que el fix del año viaja con este deploy.
const sm = String(wf.nodes.find((n) => n.name === 'Franco (AI Agent)').parameters.options.systemMessage)
ok(sm[0] === '=', 'el systemMessage perdió el "=" inicial (trampa 1)')
ok(sm.includes('La Amarok 2023 no la tengo. La única Amarok que tengo es la 2018:'), 'se perdió el guion de v140')

// Los gates que ya existían siguen enteros: son los que evitan el dump de pickups.
for (const frag of ['pidio_ver', 'monto_financiar', 'entrega_plata', "u.tramo = 'fuera'"]) {
  ok(q.includes(frag), `se perdió el gate que usa ${frag}`)
}
ok((q.match(/no_mostrar/g) || []).length === 2, 'la centinela no quedó con categoria y tramo en no_mostrar')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  query: ${String(antesWf.nodes.find((n) => n.name === 'Listar stock').parameters.query).length} -> ${q.length} chars`)
console.log(`  defaults puestos: ${Object.keys(DEFAULTS).join(', ')} · tiene_permuta sigue REQUIRED a propósito`)
console.log('  FALTA EJECUTAR LA SQL CONTRA LA BASE ANTES DE DESPLEGAR (regla del proyecto)')
