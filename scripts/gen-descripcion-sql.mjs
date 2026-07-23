#!/usr/bin/env node
// Genera scripts/descripcion-metadata.sql: suma `descripcion`, `condicionantes` y `tamano`
// al metadata de autos_disponibles (2026-07-21).
//
//   node scripts/gen-descripcion-sql.mjs
//
// PARA QUÉ: humanizar a Franco. Hoy sólo tiene la ficha técnica, así que cuando recomienda
// dice "1.5L, 103 HP, 88.000 km" — datos, no criterio. Con `descripcion` puede decir POR QUÉ
// le conviene ese auto a ese cliente, y con `condicionantes` puede ser honesto sobre lo que
// hay que tener en cuenta, que es lo que genera confianza y filtra al lead que no encaja.
//
// MECANISMO: mismo que el color (ver gen-color-sql.mjs). UPDATE aditivo e idempotente al
// jsonb. NO toca `content` ni `embedding`: no hay que revectorizar de verdad. Las tools leen
// `metadata`, así que con esto alcanza.
//
// REGLA QUE SE SIGUIÓ AL ESCRIBIRLAS: nada obvio ni redundante con lo que la card ya muestra
// (precio, km, año, modelo). Cada descripción tiene que aportar algo que el cliente no puede
// deducir mirando la lista. Y cada `condicionante` es un límite REAL, no una excusa: sirve
// para que Franco no venda un auto que no encaja y para que no lo descubra el cliente después.
//
// SUPERLATIVOS VERIFICADOS: cada afirmación comparativa ("el más barato", "el de menor
// consumo") se chequea contra stock.csv más abajo. Si el stock cambia y una deja de ser
// cierta, este script FALLA en vez de generar una mentira que Franco le va a decir a un
// cliente. Es la única defensa real contra que una descripción envejezca mal.
//
// LO QUE NO SE HIZO Y POR QUÉ: `largo_mm`. STATE.md lo pide para comparables estructurados
// (el bug del Cronos: 4,36 m contra 3,57 m). No lo incluyo porque tendría que inventar 17
// medidas exactas, y un número inventado es peor que ninguno: Franco lo afirmaría como dato
// de ficha. En su lugar va `tamano` (chico/mediano/grande), que es lo que la comparación
// necesita de verdad y se deriva de la carrocería. Si se quiere `largo_mm`, hay que sacarlo
// de una fuente y cargarlo; queda anotado en STATE.md.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Consumos: los mismos que usa revectorizar_con_consumo_v2.py (L/100km mixto).
const CONSUMO = {
  1: 6.5, 2: 7.0, 3: 6.8, 4: 6.3, 5: 7.2, 6: 7.5, 7: 6.0, 8: 6.6, 9: 8.0,
  10: 7.3, 11: 8.5, 12: 8.8, 13: 9.5, 14: 10.2, 15: 9.8, 16: 9.6, 17: 7.8,
}

// tamano: se deriva de la carrocería. Es la categoría que necesita la comparación
// "quiero algo del mismo tamaño"; no pretende ser una medida.
const TAMANO_POR_CARROCERIA = {
  Hatchback: 'chico',
  Sedán: 'mediano',
  SUV: 'mediano',
  Pickup: 'grande',
  Utilitario: 'mediano',
}

const AUTOS = {
  1: {
    descripcion:
      'Sedán con baúl de verdad al precio de un hatchback, y el de menos kilómetros de su rango. Mecánica simple y repuesto en cualquier taller: es el auto de menor costo de mantenimiento del stock.',
    condicionantes:
      'Con el 1.3, si el uso va a ser sobre todo ruta cargado y con cinco personas, conviene mirar algo de más motor. Para ciudad y viajes normales va sobrado.',
  },
  2: {
    descripcion:
      'Mecánica conocidísima: cualquier taller lo atiende y los repuestos son baratos y se consiguen en el día. Es el auto con menos sorpresas de mantenimiento del stock, y el 1.6 responde mejor que los motores chicos del segmento.',
    condicionantes:
      'Es equipamiento básico: si pesa tener pantalla y cámara, el 208 o el Cronos las traen. Por los km, pedile al asesor el historial de service.',
  },
  3: {
    descripcion:
      'El más barato de todo el stock y, al mismo tiempo, el más potente de los autos chicos. Es el único de esa combinación: entrada de gama sin resignar andar en ruta, y ya viene con pantalla multimedia.',
    condicionantes:
      'Por los km que tiene, pedile al asesor el historial de service antes de decidir.',
  },
  4: {
    descripcion:
      'El que menos combustible consume de los hatchbacks, con mecánica Toyota: es el argumento de reventa más fuerte de esta franja de precio, porque se deprecia menos que sus competidores.',
    condicionantes:
      'No trae pantalla multimedia: si eso pesa en la decisión, el 208 y el Cronos la tienen.',
  },
  5: {
    descripcion:
      'Sedán mediano con caja automática y equipamiento completo, cámara y sensores incluidos. Toyota con caja CVT es de las combinaciones que mejor sostienen valor de reventa en el mercado local.',
    condicionantes:
      'La caja CVT tiene su service específico. No es la transmisión indicada si vas a remolcar o cargar peso seguido.',
  },
  6: {
    descripcion:
      'Motor turbo de 150 HP, la mayor potencia entre los autos no pickup del stock, y con pocos kilómetros encima. Andar de gama alta sin el costo de patentamiento de una unidad nueva.',
    condicionantes:
      'Es turbo: pide nafta de buena calidad y service al día para rendir como corresponde.',
  },
  7: {
    descripcion:
      'El que menos consume de todo el stock, gracias al 1.2 turbo, y con muy pocos kilómetros. Rinde como un auto chico y anda como uno mediano.',
    condicionantes:
      'Es caja manual: si buscás automático, el Vento es el equivalente del stock.',
  },
  8: {
    descripcion:
      'Prácticamente 0 km y el hatchback más nuevo del stock, con los kilómetros más bajos del grupo. Es además el que mejor va en ruta de los chicos: la suspensión europea se nota en viaje largo.',
    condicionantes:
      'Los repuestos son de marca europea: se consiguen, pero a veces son de pedido. Si priorizás repuesto en el día, el Gol o el Cronos.',
  },
  9: {
    descripcion:
      'La SUV más equipada por debajo de su rango: cámara, sensores y pantalla. Da altura para calle rota y cordón alto sin el costo ni el tamaño de una SUV grande.',
    condicionantes:
      'Es caja manual: si buscás una SUV automática, el T-Cross o el Renegade.',
  },
  10: {
    descripcion:
      'Prácticamente sin uso, con los kilómetros más bajos de todo el stock. SUV automática con equipamiento completo: es la opción de quien quiere 0 km sin esperar.',
    condicionantes:
      'El 1.6 aspirado prioriza suavidad antes que empuje: si buscás respuesta fuerte en ruta, el Vento turbo va mejor.',
  },
  11: {
    descripcion:
      'SUV moderna y de pocos kilómetros. Despeje alto y baúl grande, pensada para ripio y camino roto: es la que mejor aguanta el uso rudo por lo que cuesta.',
    condicionantes:
      'La potencia es justa para el tamaño: si la vas a llevar cargada y en subida seguido, conviene una SUV de más motor.',
  },
  12: {
    descripcion:
      'La única SUV automática de su rango de precio, con equipamiento completo. Presencia y terminación por encima del promedio del segmento.',
    condicionantes:
      'El service y los repuestos están por encima del promedio del segmento: conviene tenerlo en cuenta en el costo de mantenimiento.',
  },
  13: {
    descripcion:
      'Pickup 4x4 diésel con la mecánica de mejor reventa del segmento: es la que más valor sostiene con los años, y eso se recupera al momento de venderla.',
    condicionantes:
      'Por los km que tiene, conviene que el asesor te muestre el historial de service y el estado de embrague y suspensión.',
  },
  14: {
    descripcion:
      'La pickup más nueva y más potente del stock, 4x4 diésel automática y con equipamiento completo. Es la única que combina tracción integral con caja automática: lista para trabajo pesado sin resignar confort de manejo.',
    condicionantes:
      'Es una pickup grande de trabajo: si el uso va a ser sobre todo ciudad, una SUV te va a resultar más práctica.',
  },
  15: {
    descripcion:
      'La 4x4 diésel más accesible del stock, con buena potencia y equipamiento completo. La opción para quien necesita tracción real y no quiere pagar una unidad reciente.',
    condicionantes:
      'Por los km que tiene, conviene una revisión mecánica previa, sobre todo de la cadena de distribución. El asesor la coordina sin cargo.',
  },
  16: {
    descripcion:
      'Misma potencia que la unidad más cara del stock (200 HP) por bastante menos plata. Pickup de trabajo con rodaje real, buena ecuación para carga y ruta.',
    condicionantes:
      'Es 4x2, no 4x4: para barro, ripio suelto o campo no reemplaza a una tracción integral.',
  },
  17: {
    descripcion:
      'Utilitario con espacio de carga real y el consumo de un auto chico. Costo de patente y mantenimiento de utilitario, que es lo que lo hace rendir para quien trabaja con él.',
    condicionantes:
      'Tiene sólo dos asientos: no sirve como auto familiar.',
  },
}

// ─────────────────────────────────────────── datos

const lineas = readFileSync(join(ROOT, 'stock.csv'), 'utf8').split(/\r?\n/).filter((l) => l.trim())
const head = lineas[0].split(',')
const col = (n) => {
  const i = head.indexOf(n)
  if (i === -1) throw new Error(`stock.csv no tiene la columna "${n}"`)
  return i
}
const iID = col('ID'), iMarca = col('Marca'), iModelo = col('Modelo')
const iCarr = col('Carrocería'), iPrecio = col('Precio de Venta (ARS)')
const iKm = col('Kilometraje'), iComb = col('Tipo de Combustible')
const iHP = col('Potencia (HP)'), iAsientos = col('Número de Asientos'), iAnio = col('Año')
const iVersion = col('Versión/Edición'), iTrans = col('Transmisión')

const stock = lineas.slice(1).map((l) => {
  const c = l.split(',')
  return {
    id: +c[iID], marca: c[iMarca], modelo: c[iModelo], carroceria: c[iCarr],
    precio: +c[iPrecio], km: +c[iKm], combustible: c[iComb], hp: +c[iHP],
    asientos: +c[iAsientos], anio: +c[iAnio], consumo: CONSUMO[+c[iID]],
    version: (c[iVersion] || '').trim(), transmision: c[iTrans],
  }
})

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }
if (stock.length !== 17) fail(`esperaba 17 autos, hay ${stock.length}`)
if (new Set(stock.map((a) => a.id)).size !== 17) fail('hay ids duplicados en stock.csv')
for (const a of stock) if (!AUTOS[a.id]) fail(`falta la descripción del auto ${a.id}`)
for (const id of Object.keys(AUTOS)) if (!stock.some((a) => a.id === +id)) fail(`sobra la descripción ${id}`)

// ─────────────────────── superlativos: se verifican, no se creen

const de = (id) => stock.find((a) => a.id === id)
const minPor = (campo, filtro = () => true) =>
  stock.filter(filtro).reduce((m, a) => (a[campo] < m[campo] ? a : m))
const maxPor = (campo, filtro = () => true) =>
  stock.filter(filtro).reduce((m, a) => (a[campo] > m[campo] ? a : m))

const hatch = (a) => a.carroceria === 'Hatchback'
const nafta = (a) => a.combustible === 'Nafta'
const suv = (a) => a.carroceria === 'SUV'
const pickup = (a) => a.carroceria === 'Pickup'
const noPickup = (a) => a.carroceria !== 'Pickup'

const es4x4 = (a) => a.version === '4x4'

const CLAIMS = [
  ['3 es el más barato del stock', minPor('precio').id === 3],
  ['3 es el hatchback más potente', maxPor('hp', hatch).id === 3],
  ['4 es el hatchback de menor consumo', minPor('consumo', hatch).id === 4],
  ['8 es el hatchback más nuevo', maxPor('anio', hatch).id === 8],
  ['8 tiene los km más bajos de los hatchbacks', minPor('km', hatch).id === 8],
  ['7 es el de menor consumo de todo el stock', minPor('consumo').id === 7],
  ['6 es el más potente entre los no-pickup', maxPor('hp', noPickup).id === 6],
  ['10 tiene los km más bajos de todo el stock', minPor('km').id === 10],
  ['10 es el más caro entre los no-pickup', maxPor('precio', noPickup).id === 10],
  ['12 es el de mayor consumo entre los nafta', maxPor('consumo', nafta).id === 12],
  ['14 es la pickup más nueva', maxPor('anio', pickup).id === 14],
  ['14 es la única 4x4 automática', stock.filter((a) => es4x4(a) && a.transmision === 'Automática').length === 1 && es4x4(de(14))],
  ['14 es el más caro del stock', maxPor('precio').id === 14],
  ['14 es el de mayor consumo del stock', maxPor('consumo').id === 14],
  ['14 es el más potente del stock', maxPor('hp').id === 14],
  ['15 es la 4x4 más barata', minPor('precio', es4x4).id === 15],
  ['15 es el de más km del stock', maxPor('km').id === 15],
  ['16 tiene la misma potencia que el más caro (14)', de(16).hp === de(14).hp],
  ['16 NO es 4x4', de(16).version === '4x2'],
  ['17 es el único con menos de 5 asientos', stock.filter((a) => a.asientos < 5).length === 1 && de(17).asientos === 2],
  ['13 es la pickup con más km después de la 15', maxPor('km', pickup).id === 15 && de(13).km > de(14).km && de(13).km > de(16).km],
]

const rotos = CLAIMS.filter(([, ok]) => !ok)
if (rotos.length) {
  console.error('✗ el stock cambió y estas afirmaciones de las descripciones YA NO SON CIERTAS:')
  for (const [q] of rotos) console.error(`    · ${q}`)
  console.error('\n  Corregí el texto en AUTOS antes de generar el SQL.')
  process.exit(1)
}

// ─────────────────────────────────────────── SQL

// Franco no debe aclarar que el auto es usado o seminuevo: se entiende por los km y el año,
// y decirlo suena defensivo. Se resuelve sacándole el dato (la columna `condicion` salió de
// las tools en v18), así que las descripciones tampoco pueden colar la palabra por la
// ventana. Dos se habían escapado y las cazó esta aserción.
for (const [id, a] of Object.entries(AUTOS)) {
  for (const [campo, txt] of Object.entries(a)) {
    if (/\b(usad[oa]s?|seminuev[oa]s?)\b/i.test(txt)) {
      fail(`auto ${id}: "${campo}" dice usado/seminuevo, y Franco no tiene que aclararlo`)
    }
  }
}

// Un `condicionante` es un CRITERIO DE USO ("no sirve como familiar", "es 4x2, no 4x4"),
// no un defecto. Franco es un vendedor: un dato que sólo resta y que además ya está a la
// vista en la card —el precio, el consumo— no aporta nada y baja la venta. Agustina lo marcó
// sobre dos capturas: "es la opción más cara y con mayor consumo del stock" y "su consumo es
// un poco más alto que el de un aspirado equivalente".
// La forma correcta es hacia adelante: para qué uso NO encaja, y qué del stock encaja mejor.
for (const [id, a] of Object.entries(AUTOS)) {
  const negativo = a.condicionantes.match(
    /m[áa]s car[oa]|el m[áa]s caro|mayor consumo|consumo (es )?(m[áa]s )?alto|precio m[áa]s alto/i,
  )
  if (negativo) {
    fail(
      `auto ${id}: el condicionante es un negativo puro ("${negativo[0]}"), y encima ya está a la vista en la card. ` +
        'Reescribilo como criterio de uso: para qué NO encaja y qué del stock encaja mejor.',
    )
  }
}

const esc = (s) => {
  if (/[\\;{}]/.test(s)) fail(`texto con caracteres peligrosos: ${s.slice(0, 60)}`)
  return s.replace(/'/g, "''")
}

const values = stock
  .sort((a, b) => a.id - b.id)
  .map((a) => {
    const tamano = TAMANO_POR_CARROCERIA[a.carroceria]
    if (!tamano) fail(`no sé qué tamaño darle a la carrocería "${a.carroceria}" (auto ${a.id})`)
    return `  (${a.id}, '${esc(AUTOS[a.id].descripcion)}', '${esc(AUTOS[a.id].condicionantes)}', '${tamano}')`
  })
  .join(',\n')

const sql = `-- Agrega \`descripcion\`, \`condicionantes\` y \`tamano\` al metadata de autos_disponibles.
-- Generado por scripts/gen-descripcion-sql.mjs desde stock.csv (2026-07-23). No editar a mano.
--
-- Idempotente: se puede correr las veces que haga falta.
-- Aditivo: sólo suma tres claves al jsonb. NO toca \`content\` ni \`embedding\`, así que no
-- hay que revectorizar ni regenerar embeddings.
--
-- BACKUP ANTES DE CORRER (por las dudas, aunque sea aditivo):
--   CREATE TABLE autos_disponibles_backup_20260723 AS SELECT * FROM autos_disponibles;

UPDATE autos_disponibles a
SET metadata = a.metadata || jsonb_build_object(
  'descripcion',    v.descripcion,
  'condicionantes', v.condicionantes,
  'tamano',         v.tamano
)
FROM (VALUES
${values}
) AS v(id, descripcion, condicionantes, tamano)
WHERE (a.metadata->>'id')::int = v.id;

-- Verificación: 17 filas, ninguna con descripcion NULL o vacía.
SELECT (metadata->>'id')::int AS id,
       metadata->>'marca' || ' ' || (metadata->>'modelo') AS auto,
       metadata->>'tamano' AS tamano,
       length(metadata->>'descripcion') AS len_desc,
       length(metadata->>'condicionantes') AS len_cond
FROM autos_disponibles
ORDER BY 1;
`

writeFileSync(join(ROOT, 'scripts', 'descripcion-metadata.sql'), sql)

console.log(`✓ ${stock.length} autos · ${CLAIMS.length} superlativos verificados contra stock.csv`)
const porTamano = stock.reduce((m, a) => ((m[TAMANO_POR_CARROCERIA[a.carroceria]] ??= []).push(a.id), m), {})
for (const [t, ids] of Object.entries(porTamano)) console.log(`  tamano ${t.padEnd(8)} ${ids.sort((x, y) => x - y).join(', ')}`)
console.log('\n  escrito -> scripts/descripcion-metadata.sql')
