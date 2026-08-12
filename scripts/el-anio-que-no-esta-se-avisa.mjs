// v137 -> v140 · EL AÑO QUE EL CLIENTE PIDIÓ Y NO ESTÁ SE AVISA, NO SE DISIMULA
//
// EL BUG (captura de Agustina, 2026-08-12, caso `modelo-inexistente-se-avisa-y-se-ofrece`, 1/3):
// el cliente escribe "Estoy buscando una Amarok 2023." y Franco arranca con "La Volkswagen Amarok
// 2018 es la 4x4 diésel más accesible del stock...": le presenta la 2018 como si fuera lo que
// pidió, sin aclarar NUNCA que la 2023 no existe.
//
// POR QUÉ NO SE ARREGLA CON MÁS CÓDIGO (la regla del proyecto, aplicada y NO salteada): la
// comparación de años sí es determinística, pero el DISPARADOR no lo es. Para calcularlo en Config
// habría que decidir, con un regex, si el año que el cliente nombró es del auto que QUIERE COMPRAR
// o del auto que ENTREGA/VENDE. Eso es lenguaje, no aritmética, y falla en casos que la suite ya
// ejercita: `consignacion-vende-su-auto` dice "es un corolla 2018" —su propio auto— y el Corolla
// del stock es 2022; un disparador determinístico avisaría "no tengo el Corolla 2018" en medio de
// una consignación. Los datos para comparar (el año pedido y el `anio` de la ficha) YA están los
// dos en el contexto del modelo: lo que falta no es el dato, es el guion.
//
// LA REGLA QUE FIJÓ AGUSTINA: (1) se dice que ese modelo/año no lo tenemos, (2) se ofrece la o las
// opciones más similares, (3) se cierra con la pregunta comercial.
//
// TRAMPA 6 DE CLAUDE.md, APLICADA: el ejemplo concreto le gana a la regla abstracta. La regla ya
// existía —está en la descripción de "Buscar auto", punto 2: "Si esa variante o año no está pero
// el MODELO sí está en otro año, DECÍLO"— y NO alcanzó. Compite contra dos cosas más fuertes:
//   · el guion de "## Paso 3", que manda ARRANCAR por el porqué de `descripcion` (y "la 4x4 diésel
//     más accesible del stock" es, palabra por palabra, el campo `descripcion` de la Amarok), y
//   · la propia herramienta, que devuelve el auto con match_tipo="exacto" AUNQUE EL AÑO SEA OTRO
//     ("exacto" es del modelo, no del año). El modelo lee "exacto" y muestra.
// Por eso el fix NO agrega una prohibición arriba: REEMPLAZA el guion de apertura del detalle y
// trae su propio EJEMPLO TEXTUAL —el del bug— más el contraejemplo que evita el falso positivo.
//
// LO QUE NO TOCA, A PROPÓSITO: ninguna tool, ningún parser, ninguna SQL. Ahí se rompieron v138 y
// v139. Es un solo nodo y un solo bloque de texto.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v137.json'
const DESTINO = 'workflows/franco-n8n-v140.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const nodo = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
ok(!!nodo, 'no está el nodo "Franco (AI Agent)"')

const VIEJO =
  '- Una burbuja que ARRANCA por el porqué, no por el motor: una frase corta sacada del campo `descripcion` de la ficha,'

const NUEVO =
  '- SI EL CLIENTE PIDIÓ UN AÑO (O UNA VERSIÓN) QUE NO TENÉS, ESO ES LO PRIMERO QUE SALE, ANTES DEL PORQUÉ Y ANTES DE CUALQUIER DATO. Compará el año que dijo el cliente contra el `anio` de la ficha. Si no nombró ningún año, no hay nada que comparar y seguís normal. OJO CON LA HERRAMIENTA, QUE ACÁ TE ENGAÑA: "Buscar auto" te devuelve el auto con match_tipo="exacto" AUNQUE EL AÑO SEA OTRO — "exacto" es del MODELO, nunca del año —, así que el único que puede notar la diferencia sos vos. Guion, TEXTUAL, reemplazando los marcadores por los datos reales de la ficha: "La <MODELO> <AÑO QUE PIDIÓ> no la tengo. La única <MODELO> que tengo es la <AÑO REAL>:" y ahí seguís con el detalle de siempre. Después del detalle, si en el stock hay otros autos de la MISMA carrocería que se acerquen más a lo que pidió (más nuevos, si pidió un año más nuevo), se los ofrecés en UNA línea: "y si buscás algo más nuevo, tengo <los que sean>". Y cerrás con la pregunta comercial de siempre.\n' +
  '   ESTE ES EL BUG, TEXTUAL, Y ES EXACTAMENTE LO QUE NO HAY QUE HACER: a "Estoy buscando una Amarok 2023." contestaste "La Volkswagen Amarok 2018 es la 4x4 diésel más accesible del stock, con buena potencia y equipamiento completo." Le presentaste la 2018 como si fuera la que pidió y nunca le dijiste que la 2023 no existe. Lo correcto arranca así: "La Amarok 2023 no la tengo. La única Amarok que tengo es la 2018:" y recién ahí va el detalle.\n' +
  '   NO LO HAGAS AL REVÉS: si el año que pidió ES el de la ficha, no aclarás nada. A "me interesa la renault duster 2023" —y la Duster del stock es 2023— se le contesta el detalle derecho, sin ningún "no tengo": no hay nada que aclarar y aclararlo suena a que no la tenés.\n' +
  '   Y ESTO CORRE SÓLO SOBRE EL AUTO QUE EL CLIENTE QUIERE COMPRAR. Si el año que nombró es el de SU auto —el que entrega, permuta, vende o consigna— no se compara con nada del stock: ese auto es de él, no nuestro. A "es un corolla 2018" dicho de su propio auto NO se le contesta que el Corolla que tenemos es 2022.\n' +
  '- Una burbuja que ARRANCA por el porqué (o por el aviso del año, si el que pidió no está), no por el motor: una frase corta sacada del campo `descripcion` de la ficha,'

const antesTxt = String(nodo.parameters.options.systemMessage)
const veces = antesTxt.split(VIEJO).length - 1
ok(veces === 1, `el guion de apertura del detalle tenía que estar 1 vez; está ${veces}`)

if (veces === 1) {
  nodo.parameters.options.systemMessage = antesTxt.split(VIEJO).join(NUEVO)
}

const despuesTxt = String(nodo.parameters.options.systemMessage)

// ── El texto viejo YA NO ESTÁ (la aserción que pide el proyecto) ──────────────────────────────
ok(!despuesTxt.includes(VIEJO), 'quedó el guion viejo de apertura del detalle')
ok(
  despuesTxt.includes('ARRANCA por el porqué (o por el aviso del año, si el que pidió no está)'),
  'el guion de apertura no quedó condicionado al aviso del año',
)

// ── El guion nuevo está, con su ejemplo y sus dos contraejemplos ──────────────────────────────
ok(despuesTxt.includes('SI EL CLIENTE PIDIÓ UN AÑO (O UNA VERSIÓN) QUE NO TENÉS'), 'no quedó la regla nueva')
ok(despuesTxt.includes('La Amarok 2023 no la tengo. La única Amarok que tengo es la 2018:'), 'no quedó el guion textual')
ok(despuesTxt.includes('Estoy buscando una Amarok 2023.'), 'no quedó el ejemplo del bug (trampa 6)')
ok(despuesTxt.includes('me interesa la renault duster 2023'), 'no quedó el contraejemplo del año que SÍ está')
ok(despuesTxt.includes('es un corolla 2018'), 'no quedó el contraejemplo del auto del cliente')
ok(despuesTxt.split('SI EL CLIENTE PIDIÓ UN AÑO').length - 1 === 1, 'la regla nueva quedó duplicada')

// ── EL GUION NUEVO, EJECUTADO CONTRA EL CHECK DEL CASO ────────────────────────────────────────
// No alcanza con que el texto esté: la frase que le pedimos a Franco tiene que pasar el
// text_matches del caso `modelo-inexistente-se-avisa-y-se-ofrece`. Si no, el fix puede "funcionar"
// y el eval seguir rojo.
const { cases } = JSON.parse(fs.readFileSync('evals/cases.json', 'utf8'))
const caso = cases.find((c) => c.id === 'modelo-inexistente-se-avisa-y-se-ofrece')
ok(!!caso, 'no está el caso modelo-inexistente-se-avisa-y-se-ofrece en cases.json')
if (caso) {
  const regexes = (caso.turns[0].checks || []).filter((c) => c[0] === 'text_matches').map((c) => c[1])
  ok(regexes.length === 2, `el caso tenía 2 text_matches en T1; tiene ${regexes.length}`)
  // La respuesta que produce el guion nuevo, escrita como la escribiría Franco.
  const respuesta =
    'La Amarok 2023 no la tengo. La única Amarok que tengo es la 2018: es la 4x4 diésel más accesible ' +
    'del stock, con 135.000 km y un precio de $32.000.000. Y si buscás algo más nuevo, tengo la Chevrolet ' +
    'S10 2022, la Toyota Hilux 2021 y la Ford Ranger 2024. Querés que te pase el detalle de alguna?'
  for (const r of regexes) {
    const flags = r.startsWith('(?i)') ? 'i' : ''
    const re = new RegExp(r.replace(/^\(\?i\)/, ''), flags)
    ok(re.test(respuesta), `el guion nuevo NO pasa el check del caso: ${r.slice(0, 60)}`)
  }
  // Y el contraejemplo NO tiene que pasarlo: si lo pasara, el check estaría verde por cualquier cosa.
  const sana = 'La Renault Duster 2023 es una SUV moderna y de pocos kilómetros, con despeje alto. El precio es de $22.500.000.'
  const reAviso = new RegExp(String(regexes[0]).replace(/^\(\?i\)/, ''), 'i')
  ok(!reAviso.test(sana), 'el check del aviso da verde con una respuesta que NO avisa nada')
}

// ── Las trampas de n8n, verificadas ───────────────────────────────────────────────────────────
ok(despuesTxt[0] === '=', 'el systemMessage perdió el "=" inicial (trampa 1: sin él las 32 expresiones son texto literal)')
const bloquesAntes = (antesTxt.match(/\{\{/g) || []).length
const bloquesDespues = (despuesTxt.match(/\{\{/g) || []).length
ok(bloquesAntes === bloquesDespues, `cambió la cantidad de bloques {{ }}: ${bloquesAntes} -> ${bloquesDespues}`)
ok(!/\{\{|\}\}/.test(NUEVO), 'el texto nuevo mete llaves de expresión donde no van')

const antesWf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fromAIAntes = (JSON.stringify(antesWf).match(/fromAI\(/g) || []).length
const fromAIDespues = (JSON.stringify(wf).match(/fromAI\(/g) || []).length
ok(fromAIAntes === fromAIDespues, `cambió la cantidad de $fromAI: ${fromAIAntes} -> ${fromAIDespues} (trampa 3)`)

// ── Nada más se movió ─────────────────────────────────────────────────────────────────────────
const distintos = wf.nodes.filter((n, i) => JSON.stringify(n) !== JSON.stringify(antesWf.nodes[i])).map((n) => n.name)
ok(distintos.length === 1 && distintos[0] === 'Franco (AI Agent)', `tocó ${distintos.length} nodos (${distintos.join(', ')})`)
ok(wf.nodes.length === 35, `quedaron ${wf.nodes.length} nodos, tenían que ser 35`)

// Los guiones vecinos que ya costaron un fix siguen enteros.
ok(despuesTxt.includes('PISOS DE STOCK'), 'se perdió el bloque PISOS DE STOCK (lo que rompió v138)')
ok(despuesTxt.includes('SIEMPRE cerrás con una pregunta comercial en una burbuja SEPARADA'), 'se perdió el cierre comercial de Paso 3')
ok(despuesTxt.includes('El contenido del campo `condicionantes` NO se cuenta solo'), 'se perdió la regla de condicionantes')

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`OK: ${DESTINO}`)
console.log(`  nodos: ${wf.nodes.length} · con diferencias: ${distintos.join(', ')}`)
console.log(`  systemMessage: ${antesTxt.length} -> ${despuesTxt.length} chars · bloques {{ }}: ${bloquesDespues} (sin cambios)`)
console.log('  el guion nuevo pasa los 2 text_matches del caso, y el contraejemplo NO los pasa')
