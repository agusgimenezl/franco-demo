// v119 -> v120 · SIN TECHO DECLARADO NO HAY NADA QUE "NO ENTRE"
//
// BUG REPORTADO POR AGUSTINA (charla real, 2026-08-10, sesión 19:41–19:45Z, captura).
// Pregunta "y que pickups tenes?" —sin haber dado NUNCA un presupuesto ni un anticipo— y Franco
// contesta: "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de
// anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." + "Con tu presupuesto,
// con tu anticipo sí te entran hatchbacks y sedanes...". No hay presupuesto ni anticipo en esa
// conversación: los dos "tu" son inventados. Y nunca le mostró las pickups, que son CUATRO.
//
// LA PRUEBA, EJECUCIÓN 14830 — Y ES LA MÁS LIMPIA QUE DIO ESTE PROYECTO PARA LA TRAMPA 6:
// el `metadata` de esa ejecución NO LISTA NI UN SUBRUN DE HERRAMIENTA. No hay `Listar stock`, no
// hay `Buscar auto`, no hay `Detalle auto`. Franco contestó una pregunta de stock SIN CONSULTAR EL
// STOCK, con auto_ids: []. Recitó el prompt.
//
// DE DÓNDE LO RECITÓ: la línea 147 tiene el guion COMPLETO Y CON LOS NÚMEROS DE ESTE STOCK:
//   "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo,
//    ya que el máximo a financiar es el 50% del valor del vehículo."
//   "con tu anticipo sí te entran hatchbacks, querés que te los muestre?"
// Franco lo devolvió carácter por carácter. Le preguntaron por pickups y la única oración con forma
// de pickup en las 333 líneas del prompt era ésa.
//
// LO IMPORTANTE, Y ES LO QUE DEFINE EL FIX: LA PARTE DETERMINÍSTICA FUNCIONÓ BIEN.
// El bloque inyectado de la línea 132 tiene la guarda `if (!carr || !piso || !techo || piso <= techo)
// return ''`. Sin anticipo, techo = 0, así que NO INYECTÓ NADA. Hizo exactamente lo que debía.
// Lo que no tiene guarda es el EJEMPLO EN PROSA, porque es prosa y está siempre presente.
// Por eso este fix NO agrega más prosa: extiende el mecanismo que YA demostró ser confiable.
//
// CAMBIO A — LA RAMA QUE FALTABA. Cuando hay carrocería pedida y NO hay techo, el bloque deja de
// devolver '' y pasa a inyectar la instrucción correcta: es una pregunta de STOCK, se contesta
// llamando a la herramienta. Determinístico, dispara exactamente cuando corresponde.
//
// CAMBIO B — EL GUION EN PROSA PIERDE LOS NÚMEROS RECITABLES. Pasan a marcadores <ASÍ>, que no se
// pueden copiar tal cual sin que se note. La versión con números REALES sigue existiendo, pero sólo
// dentro de la inyección condicional — o sea, disponible exactamente cuando la precondición se
// cumple, que es la arquitectura que corresponde.
//   Y ARREGLA UN SEGUNDO DEFECTO, ÉSTE COMERCIAL: $32.000.000 y $16.000.000 son de Automotores
//   Tucumán. En otra concesionaria Franco recitaría el piso de un stock que no es el suyo, y la
//   configurabilidad es requisito de negocio. Peor: esos números YA los calcula
//   `Config.pisos_carroceria` del stock real, así que el ejemplo era una SEGUNDA FUENTE DE VERDAD
//   duplicando un valor computado.
//
// VAN JUNTOS PORQUE SON EL MISMO BUG POR LOS DOS LADOS: A le da al modelo la conducta correcta
// cuando no hay techo, B le saca la frase que lo tentaba. Con A solo, el guion recitable sigue ahí
// para cualquier turno parecido; con B solo, no queda dicho qué hacer en su lugar.
//
// NO TOCA: la rama que YA funciona (carrocería pedida + techo + no entra), que es la que mide
// `no-ofrecer-lo-que-no-existe` en su turno 3. Ese caso es el control.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v119.json'
const DESTINO = 'workflows/franco-n8n-v120.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

const ag = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const smAntes = ag.parameters.options.systemMessage

// ── CAMBIO A · la rama que faltaba, dentro del bloque determinístico ────────────────────────
// `nombre` y `m` se suben ANTES de las guardas porque la rama nueva los necesita.
const A_VIEJO = `  const techo = Number(cfg.entrega_plata || 0) * 2;
  if (!carr || !piso || !techo || piso <= techo) return '';
  const nombre = { pickup: 'pickup', suv: 'SUV', sedan: 'sedán', hatchback: 'hatchback', utilitario: 'utilitario' }[carr] || carr;
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');`

const A_NUEVO = `  const techo = Number(cfg.entrega_plata || 0) * 2;
  const nombre = { pickup: 'pickup', suv: 'SUV', sedan: 'sedán', hatchback: 'hatchback', utilitario: 'utilitario' }[carr] || carr;
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  // v120 · SIN TECHO NO HAY NADA QUE "NO ENTRE". Esto antes devolvía '' y el modelo llenaba el
  // hueco recitando el guion del piso que estaba más abajo en prosa (ejecución 14830: contestó
  // "qué pickups tenés" SIN llamar a ninguna herramienta). La pregunta es de stock, no de plata.
  if (carr && !techo) return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente preguntó por ' + nombre + 's y NO declaró presupuesto ni anticipo — no te dio ningún número. ESO NO ES UNA PREGUNTA DE PLATA, ES UNA PREGUNTA DE STOCK: llamá a la herramienta y mostrale las ' + nombre + 's que hay, con su precio. PROHIBIDO EN ESTE TURNO, y manda sobre cualquier guion de más abajo: decir el piso de esa carrocería, decir cuánto anticipo haría falta, o hablar de "tu presupuesto" o "tu anticipo" — no existen en esta conversación. Ya pasó y es el bug: a "y qué pickups tenés?" saliste con "la más accesible es de tal precio, necesitarías tanto de anticipo" sin que el cliente hubiera dicho un solo número, y encima no le mostraste ninguna. Sin techo declarado no hay nada que no entre.\\n';
  if (!carr || !piso || !techo || piso <= techo) return '';`

ok(smAntes.split(A_VIEJO).length === 2, 'no encontré (1 vez) el cuerpo del bloque de pisos')
let sm = smAntes.replace(A_VIEJO, () => A_NUEVO)

// ── CAMBIO B · el guion en prosa pierde los números recitables ──────────────────────────────
const B_VIEJO = 'Guion, TEXTUAL, con los dos números de la línea de arriba (el piso de esa carrocería y su mitad): "La pickup más accesible que tengo es de $32.000.000. Necesitarías $16.000.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Y después le OFRECÉS lo que sí le entra, llamándolo por su carrocería REAL y SIN listar todavía: "con tu anticipo sí te entran hatchbacks, querés que te los muestre?".'

const B_NUEVO = 'Guion, con los dos números sacados de "PISOS DE STOCK" (el piso de esa carrocería y su mitad) — los marcadores se reemplazan por los números REALES de esa línea, nunca se escriben así: "La <CARROCERÍA QUE PIDIÓ> más accesible que tengo es de <PISO DE ESA CARROCERÍA>. Necesitarías <LA MITAD DE ESE PISO> de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Y después le OFRECÉS lo que sí le entra, llamándolo por su carrocería REAL y SIN listar todavía: "con tu anticipo sí te entran <LA CARROCERÍA QUE SÍ ENTRA>, querés que te los muestre?". ESTE GUION CORRE SÓLO SI EL CLIENTE DECLARÓ PRESUPUESTO O ANTICIPO: sin un número suyo no hay techo, y sin techo no hay nada que no entre — ahí la respuesta es mostrarle lo que hay.'

ok(sm.split(B_VIEJO).length === 2, 'no encontré (1 vez) el guion en prosa de la línea 147')
sm = sm.replace(B_VIEJO, () => B_NUEVO)

ag.parameters.options.systemMessage = sm

// ── Aserciones ──────────────────────────────────────────────────────────────────────────────
ok(smAntes.startsWith('='), 'TRAMPA 1: el origen ya no arrancaba con "="')
ok(sm.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok((smAntes.match(/\{\{/g) || []).length === (sm.match(/\{\{/g) || []).length,
  'cambió la cantidad de expresiones {{ }} del prompt')

ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Franco (AI Agent)']),
  `esperaba SÓLO Franco (AI Agent); hay: ${JSON.stringify(distintos)}`)
for (const nm of ['Config', 'Listar stock', 'Detalle auto', 'Armar respuesta', 'Leer lead (estado)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}

// EL TEXTO VIEJO YA NO ESTÁ — y esto es lo que de verdad importa acá.
ok(!sm.includes(B_VIEJO), 'el guion viejo sigue en el prompt')
ok(!/"La pickup más accesible que tengo es de \$32\.000\.000/.test(sm),
  'LA FRASE RECITABLE CON LOS NÚMEROS DE ESTE STOCK SIGUE EN EL PROMPT')
ok(!/Necesitarías \$16\.000\.000 de anticipo/.test(sm),
  'el anticipo hardcodeado de este stock sigue en el prompt')

// La rama nueva y la vieja conviven, en el orden correcto.
const iNueva = sm.indexOf("if (carr && !techo)")
const iVieja = sm.indexOf("if (!carr || !piso || !techo || piso <= techo)")
ok(iNueva !== -1, 'no quedó la rama nueva')
ok(iVieja !== -1, 'se perdió la guarda original')
ok(iNueva < iVieja, 'la rama nueva quedó DESPUÉS de la guarda: nunca dispararía')
ok(sm.indexOf('const nombre = {') < iNueva, '`nombre` se usa antes de declararse')

// La rama que ya funcionaba sigue intacta (es la que mide `no-ofrecer-lo-que-no-existe`).
ok(/NO HAY NINGUNA' \+ nombre\.toUpperCase\(\) \+ ' EN ESE RANGO/.test(sm) ||
   sm.includes("NO HAY NINGUNA ' + nombre.toUpperCase() + ' EN ESE RANGO"),
  'se rompió la rama del piso que sí funciona')

// ── Revisión del texto, contra el fallo medido ──────────────────────────────────────────────
const casos = []
const chk = (n, c) => { casos.push(n); if (!c) fallas.push(`texto · ${n}`) }
chk('la rama nueva manda a llamar la herramienta', /llamá a la herramienta y mostrale/.test(A_NUEVO))
chk('prohíbe hablar de un presupuesto que no existe', /no existen en esta conversación/.test(A_NUEVO))
chk('trae el EJEMPLO CONCRETO del fallo (trampa 6)', /Ya pasó y es el bug/.test(A_NUEVO) && /qué pickups tenés/.test(A_NUEVO))
chk('cierra con la regla en una línea memorable', /Sin techo declarado no hay nada que no entre/.test(A_NUEVO))
chk('la rama nueva NO hardcodea números de este stock', !/32\.000\.000|16\.000\.000/.test(A_NUEVO))
chk('el guion en prosa quedó con marcadores, no con cifras', /<PISO DE ESA CARROCERÍA>/.test(B_NUEVO) && !/\$32/.test(B_NUEVO))
chk('el guion en prosa declara su propia precondición', /CORRE SÓLO SI EL CLIENTE DECLARÓ PRESUPUESTO O ANTICIPO/.test(B_NUEVO))
chk('sigue apuntando a PISOS DE STOCK como fuente', /"PISOS DE STOCK"/.test(B_NUEVO))
chk('no hardcodea modelos ni carrocerías de este stock en la rama nueva',
  !/(Onix|Kangoo|Cronos|Amarok|Hilux|Ranger)/.test(A_NUEVO))

const malas = fallas.filter((f) => f.startsWith('texto ·')).length
console.log(`  sin techo no hay nada que no entre: ${casos.length - malas}/${casos.length}`)

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Franco (AI Agent)')
console.log(`  systemMessage: ${smAntes.length} -> ${sm.length} chars`)
