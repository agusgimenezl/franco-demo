// v94 -> v95 · NO OFRECER LO QUE NO EXISTE (y no ponerle a una lista una carrocería que no es)
//
// EL BUG, DOS SÍNTOMAS DEL MISMO AGUJERO, los dos medidos sobre v94 (2026-08-06):
//   (1) "Querés que te muestre las pickups 4x2 que te entran con ese presupuesto?" — con techo
//       $10.000.000 no entra NI UNA pickup (la más accesible es la Amarok a $32.000.000).
//       3 de 4 corridas de `entregar-plata-no-es-permuta`.
//   (2) "tenés este abanico de opciones de pickup 4x2" seguido de Gol Trend, Etios, EcoSport y
//       Kangoo — hatchback, hatchback, SUV y utilitario. Ejecución 12047.
//   El caso `no-ofrecer-lo-que-no-existe` mide 0/3 sobre v94: FALLA PRIMERO, como manda la regla.
//
// LAS TRES PRUEBAS VINCULANTES, LEÍDAS DEL LOG (no del volcado del eval, que trunca):
//   · `12019`: la frase sale TEXTUAL de `Franco (AI Agent)`. NO la agrega `Armar respuesta`
//     (trampa 7 descartada).
//   · `12019`: **`Listar stock` no aparece en el runData: no la llamó.** 17.904 tokens de entrada,
//     109 de salida, cero tools. POR ESO EL FIX NO PUEDE VIVIR EN LA TOOL — ese fue el error de
//     v93, que se revirtió. El dato tiene que llegar por el prompt, todos los turnos.
//   · `12047`: la tool SÍ se llamó y devolvió 6 filas CON su `carroceria` (SUV, Utilitario, Sedán,
//     3 Hatchback; cero pickups). Con esa tabla delante escribió "opciones de pickup 4x2".
//     Tener el dato no alcanza si está lejos del guion (lección de v87 -> v88).
//
// POR QUÉ SE CAEN LAS PICKUPS SIN QUE NADIE LO DIGA: con precio_objetivo=10.000.000 y
// con_financiacion=1 las 4 quedan `tramo='fuera'` y las borra el filtro final
// `NOT (con_financiacion = 1 AND tramo = 'fuera')`. El prompt YA tiene el mecanismo de escape
// ("Sobre 'fuera': que aparezcan significa que SÍ EXISTEN opciones que cumplen") pero **sólo
// para `categoria`, no para `tramo`**: por la rama de financiación se caen en silencio.
//
// EL CAMBIO — DOS CAPAS, como en v79. Con una sola no alcanza:
//
//   (A) DETERMINÍSTICA, en `Leer lead (estado)`: una subconsulta ESCALAR más que devuelve el piso
//       de cada carrocería del stock REAL y su anticipo mínimo (la mitad: se financia hasta el
//       50%). Va ahí y no en la tool porque ese nodo corre en TODOS los turnos, antes de Config y
//       de Franco, se llame o no una herramienta. Escalar = no cambia la cantidad de filas
//       (trampa 4); el nodo ya usa `FROM (SELECT 1) d LEFT JOIN` y queryReplacement array
//       (trampa 2). Sale de la base: cambia el stock y cambia sola, y sirve en otra concesionaria.
//       PROBADA CONTRA LA BASE REAL (Supabase por MCP) ANTES DE ESCRIBIR ESTO:
//       "Hatchback desde $8.200.000 (anticipo mínimo $4.100.000) · Sedán desde $16.800.000
//        ($8.400.000) · Utilitario desde $18.500.000 ($9.250.000) · SUV desde $19.800.000
//        ($9.900.000) · Pickup desde $32.000.000 ($16.000.000)"
//
//   (B) DE LENGUAJE, con GUION LITERAL y ANTI-EJEMPLO textual (trampa 6: el ejemplo le gana a la
//       regla, así que el guion viejo se REEMPLAZA, no se le pone una prohibición arriba):
//       · sección nueva `## Antes de ofrecer una carrocería`, pegada a `## Enfoque comercial`,
//         con la línea de pisos, la regla y el guion textual aprobado por Agustina;
//       · el encabezado del abanico se reescribe: NO lleva nombre de carrocería, con el
//         anti-ejemplo exacto de `12047`;
//       · la inyección de `entrega_plata` (v87, la que corre JUSTO en el turno de `12019`) manda
//         a mirar la línea de pisos antes de cerrar.
//
// LO QUE NO SE TOCA: el gate de v89. El turno donde el cliente DA plata sigue sin mostrar autos;
// ahí va el número. Se muestra en el turno siguiente, cuando pide.
//
// 3 NODOS: `Leer lead (estado)` -> Query · `Config` -> un campo nuevo · `Franco (AI Agent)` -> SM.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v94.json'
const DESTINO = 'workflows/franco-n8n-v95.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL determinístico
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const q = lead.parameters.query

const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (q.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT de Leer lead (estado)')

const COLUMNA = `,
  -- pisos_carroceria: el precio del MÁS ACCESIBLE de cada carrocería del stock, con el anticipo
  -- mínimo que haría falta (la mitad: financiamos hasta el 50%). Es el dato que a Franco le
  -- faltaba para no ofrecer lo que no existe, y llega TODOS los turnos —se llame o no una
  -- herramienta—: la invención también pasa sin llamar a Listar stock (ejecución 12019).
  -- Sale del stock vivo, no de una lista escrita a mano: no se desactualiza y sirve para
  -- cualquier concesionaria. Subconsulta ESCALAR, igual que las dos de arriba: no puede cambiar
  -- la cantidad de filas (trampa 4).
  COALESCE((
    SELECT string_agg(x.linea, ' · ' ORDER BY g.piso)
    FROM (
      SELECT metadata->>'carroceria' AS carr,
             min((metadata->>'precio')::bigint) AS piso
      FROM autos_disponibles
      WHERE metadata->>'carroceria' IS NOT NULL
      GROUP BY 1
    ) g
    CROSS JOIN LATERAL (
      SELECT g.carr || ' desde $' || replace(to_char(g.piso, 'FM999G999G999'), ',', '.')
          || ' (anticipo mínimo $' || replace(to_char((g.piso / 2)::bigint, 'FM999G999G999'), ',', '.') || ')' AS linea
    ) x
  ), '')                                                   AS pisos_carroceria
`
lead.parameters.query = q.replace(ANCLA_SQL, () => COLUMNA + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (A bis) Config lo pasa al prompt
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
ok(!asg.some((a) => a.name === 'pisos_carroceria'), 'ya existía el campo pisos_carroceria en Config')
asg.push({
  id: 'a27-pisos-carroceria',
  name: 'pisos_carroceria',
  value: "={{ $('Leer lead (estado)').item.json.pisos_carroceria }}",
  type: 'string',
})

// ─────────────────────────────────────────────────────────── (B) el lenguaje
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

// B1 · sección nueva, PEGADA a ## Enfoque comercial (el hecho tiene que vivir donde vive el guion)
const ANCLA_SECCION = '## Recomendación por criterio (tamaño, uso, consumo)'
if (sm.split(ANCLA_SECCION).length !== 2) throw new Error('no encontré (una sola vez) ## Recomendación por criterio')

const SECCION = `## Antes de ofrecer una carrocería: fijate si existe a ese precio
PISOS DE STOCK (el más accesible de cada carrocería, ya calculado del stock real; el anticipo mínimo es la mitad del precio porque financiamos hasta el 50%): {{ $node["Config"].json.pisos_carroceria }}
Esa línea es la verdad del stock y se actualiza sola. Mirala ANTES de ofrecer una carrocería y ANTES de ponerle nombre a una lista. Los números salen de ahí, nunca de tu memoria.
- NUNCA ofrezcas mostrar una carrocería cuyo piso esté por encima del techo del cliente. Preguntar "querés que te muestre las pickups que te entran con ese presupuesto?" cuando la pickup más accesible sale el triple es ofrecer algo que no existe: el cliente dice que sí y no hay nada que mostrarle.
- NUNCA le pongas a una lista el nombre de la carrocería que pidió el cliente si los autos de la lista NO son de esa carrocería. Un Gol Trend y un Etios no son "opciones de pickup 4x2" por más que el cliente haya pedido una pickup: son hatchbacks. La carrocería de cada auto sale del campo \`carroceria\` de la ficha, jamás de lo que pidió el cliente.
- Cuando lo que pidió NO le entra, no se lo escondas ni se lo maquilles: decile el número y mostrale igual lo que SÍ le entra. Guion, TEXTUAL, con los dos números de la línea de arriba (el piso de esa carrocería y su mitad): "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Y seguís con lo que sí le entra, llamándolo por su carrocería REAL: "con tu anticipo te entran estos hatchbacks: ...".
- Si insiste con esa carrocería, la salida es el número (cuánto anticipo hace falta), no una lista de otra cosa disfrazada del nombre que él usó.

`
franco.parameters.options.systemMessage = sm.replace(ANCLA_SECCION, () => SECCION + ANCLA_SECCION)

// B2 · el encabezado del abanico deja de poder llevar carrocería (es el que copió en 12047)
const VIEJO_ABANICO =
  'Encabezás explicando la capacidad sin prometer nada ("teniendo en cuenta tu anticipo, una estimación preliminar de tu usado y la posibilidad de financiar hasta el 50%, tenés este abanico").'
const NUEVO_ABANICO =
  VIEJO_ABANICO +
  ' EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA: el abanico mezcla carrocerías a propósito (dos por bloque, de carrocerías distintas), así que ponerle la etiqueta de lo que pidió el cliente es mentirle. NUNCA escribas "tenés este abanico de opciones de pickup 4x2" y abajo listes un Gol Trend, un Etios y una EcoSport —que son hatchback, hatchback y SUV—: el encabezado va sin carrocería ("tenés este abanico"), y la carrocería real de cada auto va en su renglón, sacada de la ficha. Si de la carrocería que pidió no entra ninguna, eso se dice con el número (ver "## Antes de ofrecer una carrocería").'

let smx = franco.parameters.options.systemMessage
if (smx.split(VIEJO_ABANICO).length !== 2) throw new Error('no encontré (una sola vez) el encabezado del abanico')
franco.parameters.options.systemMessage = smx.replace(VIEJO_ABANICO, () => NUEVO_ABANICO)

// B3 · la inyección de entrega_plata (v87) es la que corre JUSTO en el turno de 12019.
// OJO: esto entra DENTRO de un string JS entre comillas simples de la expresión -> nada de "'".
const VIEJO_ENTREGA = 'Si más adelante ÉL nombra un usado, ahí sí corre la permuta normalmente.'
const NUEVO_ENTREGA =
  'ANTES DE CERRAR ESE TURNO MIRÁ LA LÍNEA "PISOS DE STOCK": con ese anticipo el techo es el doble, y si de la carrocería que pidió el cliente no entra NINGUNA, NO le ofrezcas mostrársela — decile el piso de esa carrocería y el anticipo mínimo que haría falta, con el guion textual de "## Antes de ofrecer una carrocería". ' +
  VIEJO_ENTREGA
smx = franco.parameters.options.systemMessage
if (smx.split(VIEJO_ENTREGA).length !== 2) throw new Error('no encontré (una sola vez) el cierre de la inyección de entrega_plata')
franco.parameters.options.systemMessage = smx.replace(VIEJO_ENTREGA, () => NUEVO_ENTREGA)

const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name)
ok(JSON.stringify(distintos.sort()) === JSON.stringify(['Config', 'Franco (AI Agent)', 'Leer lead (estado)']),
  `esperaba exactamente esos 3 nodos con diferencias; hay: ${JSON.stringify(distintos)}`)

// TRAMPA 1 · el systemMessage sigue siendo expresión
ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
// TRAMPA 2 · el queryReplacement de Leer lead sigue en forma array
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement de Leer lead (estado) dejó de estar en forma array')
// TRAMPA 3 · no se agregó ni se tocó ningún $fromAI
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
// TRAMPA 4 · la columna nueva es ESCALAR y el patrón de la fila garantizada sigue ahí
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN de Leer lead (estado)')
ok((lead.parameters.query.match(/^\s*SELECT\b/gm) || []).length ===
   (antes.nodes.find((n) => n.name === 'Leer lead (estado)').parameters.query.match(/^\s*SELECT\b/gm) || []).length + 3,
  'la subconsulta nueva no tiene la forma esperada (3 SELECT: agregado, lateral y el string_agg)')

// LO QUE NO SE TOCA
for (const nm of ['Listar stock', 'Buscar auto', 'Armar respuesta', 'Guardar mensajes (historial)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
// El gate de v89 sigue entero (el turno del dato de plata NO muestra autos)
ok(wf.nodes.find((n) => n.name === 'Listar stock').parameters.query.includes(
  "AND NOT ((" + "{{ $('Config').item.json.monto_financiar }} > 0 OR {{ $('Config').item.json.entrega_plata }} > 0) AND {{ $('Config').item.json.pidio_ver }} = 0)"),
  'se perdió el gate de v89')
// Los fixes de prompt previos, intactos
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO',                       // v88
  'está hablando de PLATA',                                    // v87
  'MONTO A FINANCIAR',                                         // v86
  'El abanico va SOLO después de que el cliente diga que SÍ',  // v85
  'Tené en cuenta que financiamos hasta el 50% del valor del vehículo', // v92
  'Las "economica" NO se ofrecen',                             // v79
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)

// Los tres pedazos nuevos están, y una sola vez cada uno
for (const frag of [
  '## Antes de ofrecer una carrocería: fijate si existe a ese precio',
  'EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA',
  'ANTES DE CERRAR ESE TURNO MIRÁ LA LÍNEA "PISOS DE STOCK"',
  'Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo.',
]) ok(smNuevo.split(frag).length === 2, `falta o está duplicado: ${JSON.stringify(frag)}`)

// La inyección de entrega_plata sigue COMPILANDO después de meterle texto adentro,
// y el texto nuevo quedó DENTRO de la rama que se renderiza (no en el else vacío).
{
  const i = smNuevo.indexOf('entrega_plata > 0')
  const ini = smNuevo.lastIndexOf('{{', i), fin = smNuevo.indexOf('}}', smNuevo.indexOf(": '' ", i))
  try {
    const f = new Function('$node', `return (${smNuevo.slice(ini + 2, fin)})`)
    const con = f({ Config: { json: { entrega_plata: 5000000, empresa_moneda_simbolo: '$' } } })
    const vacio = f({ Config: { json: { entrega_plata: 0, empresa_moneda_simbolo: '$' } } })
    ok(con.includes('PISOS DE STOCK'), 'el texto nuevo no aparece en la inyección renderizada')
    ok(con.includes('$5.000.000'), 'la inyección perdió el monto (v87)')
    ok(vacio === '', 'con entrega_plata 0 la inyección no queda vacía')
  } catch (e) {
    fallas.push(`la inyección de entrega_plata NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log('  nodos con diferencias: Config · Franco (AI Agent) · Leer lead (estado)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  Leer lead (estado) query: ${q.length} -> ${lead.parameters.query.length} chars`)
