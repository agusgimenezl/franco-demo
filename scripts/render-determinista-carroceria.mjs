// v96 -> v97 · la frase de "no hay de eso a ese precio" se RENDERIZA, no se le pide al modelo
//
// QUÉ MIDIÓ v96 (6 corridas, dos tandas, ventanas verificadas): `no-ofrecer-lo-que-no-existe`
// **3/6**. Lo bueno quedó: `no_inventa_autos` **0 de 6** (la regresión de v95 está cerrada) y la
// etiqueta falsa de carrocería no volvió. **EL RESTO ES EL BUG ORIGINAL EN LA MITAD DE LAS
// CORRIDAS:** en 3 de 6 turnos 3 Franco cierra con *"Querés que te muestre las pickups que entran
// con ese presupuesto?"* y **no dice ninguno de los tres números**.
//
// EL DIAGNÓSTICO ES EL MISMO QUE EL DEL "50%" EN v90 -> v92, Y YA ESTÁ PROBADO EN ESTE PROYECTO:
// pedirle al modelo que TOME dos números de una línea de contexto y arme la frase no adhiere.
// Lo que adhiere es la frase YA ARMADA, renderizada desde `Config` (v90 llevó el "50%" de 1/3 a
// 3/3 así, y v86 hizo lo mismo con el anticipo). Es además la regla del proyecto: lo que se puede
// calcular determinísticamente NO va al prompt como instrucción, va calculado.
//
// LO QUE FALTABA PARA PODER RENDERIZARLA: saber, sin preguntarle al modelo, QUÉ CARROCERÍA PIDIÓ
// el cliente. Se calcula en tres capas, todas determinísticas y sin tocar ningún `$fromAI`:
//   1. el mensaje de ESTE turno (regex en `Config`, como `pidio_ver`);
//   2. `lead_vehiculo` del CRM (en la ejecución 12073 ya decía "Pickup 4x2");
//   3. los mensajes anteriores del cliente en `mensajes_demo` (regex en SQL) — porque el pedido
//      ("hola, busco una pickup 4x2") suele estar 2 turnos atrás.
// UN SOLO PATRÓN LÉXICO EN CADA LADO Y NO SE PISAN: el de SQL sólo mira el historial, el de JS
// sólo mira el mensaje del turno y el lead. El de JS gana; el de SQL es el fallback.
//
// EL CAMBIO:
//   (A) `Leer lead (estado)`: DOS subconsultas ESCALARES más (trampa 4 intacta):
//       · `pisos_map` — jsonb {carroceria normalizada -> precio del más accesible}. Es la misma
//         verdad que `pisos_carroceria` de v95 pero en forma de MAPA, para poder buscar un número
//         exacto en vez de leerlo de una oración.
//       · `carroceria_pedida_hist` — la última carrocería que nombró el CLIENTE (rol 'user').
//       LAS DOS PROBADAS CONTRA LA BASE REAL (Supabase por MCP) ANTES DE ESCRIBIR ESTO:
//         pisos_map -> {"suv":19800000,"sedan":16800000,"pickup":32000000,"hatchback":8200000,
//                       "utilitario":18500000}
//         carroceria_pedida_hist -> "pickup" sobre una sesión real que pidió una pickup.
//   (B) `Config`: UN campo nuevo, `carroceria_pedida`, con las capas 1 y 2 y el fallback a la 3.
//   (C) `Franco (AI Agent)`: la inyección RENDERIZADA arriba de todo de
//       `## Antes de ofrecer una carrocería`, con la frase ya armada y la PROHIBICIÓN explícita de
//       ofrecer esa carrocería en ese turno; y una línea en `# Regla base: no inventar` —la
//       primera sección del prompt— que dice que ofrecer algo que no existe ES inventar stock.
//
// CUÁNDO DISPARA (y por qué no más ancho): sólo cuando el techo es CALCULABLE sin ambigüedad, o
// sea `entrega_plata > 0` -> techo = anticipo x 2 (el 50% financiable). `monto_financiar` NO da un
// techo (da un PISO: el auto tiene que valer al menos el doble) y `lead_presupuesto` es un string
// que escribe el CRM. Preferí que dispare siempre-bien en el camino medido antes que a veces-mal
// en todos. Lo que queda afuera lo cubren las reglas de texto de v95/v96.
//
// 3 NODOS: `Leer lead (estado)` -> Query · `Config` -> campo nuevo · `Franco (AI Agent)` -> SM.

import fs from 'node:fs'

const ORIGEN = 'workflows/franco-n8n-v96.json'
const DESTINO = 'workflows/franco-n8n-v97.json'

const wf = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const antes = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }

// ─────────────────────────────────────────────────────────── (A) SQL
const lead = wf.nodes.find((n) => n.name === 'Leer lead (estado)')
const qAntes = lead.parameters.query

const ANCLA_SQL = 'FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'
if (qAntes.split(ANCLA_SQL).length !== 2) throw new Error('no encontré (una sola vez) el cierre del SELECT')

const COLUMNAS = `,
  -- pisos_map: la misma verdad que pisos_carroceria pero como MAPA {carroceria -> piso}, para que
  -- Config pueda buscar el número exacto en vez de pedirle al modelo que lo lea de una oración.
  -- Las claves van normalizadas (minúsculas y sin tildes) para que matcheen con el regex de JS.
  -- Subconsulta ESCALAR: no cambia la cantidad de filas (trampa 4).
  COALESCE((
    SELECT jsonb_object_agg(g.carr, g.piso)
    FROM (
      SELECT lower(translate(metadata->>'carroceria', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) AS carr,
             min((metadata->>'precio')::bigint) AS piso
      FROM autos_disponibles
      WHERE metadata->>'carroceria' IS NOT NULL
      GROUP BY 1
    ) g
  ), '{}'::jsonb)                                          AS pisos_map,
  -- carroceria_pedida_hist: la última carrocería que nombró EL CLIENTE en turnos anteriores.
  -- Hace falta porque el pedido ("hola, busco una pickup 4x2") suele estar 2 turnos atrás, y
  -- Config sólo ve el mensaje de ESTE turno. El mensaje actual NO está todavía en mensajes_demo
  -- (se guarda después de responder): por eso esto es el FALLBACK y no la fuente principal.
  -- Subconsulta ESCALAR, igual que las demás.
  COALESCE((
    SELECT CASE
             WHEN t.txt ~* '(pick[ -]?up|camioneta|chata)' THEN 'pickup'
             WHEN t.txt ~* '\\msuvs?\\M|todo ?terreno'      THEN 'suv'
             WHEN t.txt ~* 'sed[aá]n'                      THEN 'sedan'
             WHEN t.txt ~* 'hatch'                         THEN 'hatchback'
             WHEN t.txt ~* 'utilitari|furg[oó]n'           THEN 'utilitario'
           END
    FROM (
      SELECT contenido->>'text' AS txt
      FROM mensajes_demo
      WHERE session_id = $1 AND rol = 'user'
        AND contenido->>'text' ~* '(pick[ -]?up|camioneta|chata|\\msuvs?\\M|todo ?terreno|sed[aá]n|hatch|utilitari|furg[oó]n)'
      ORDER BY id DESC
      LIMIT 1
    ) t
  ), '')                                                   AS carroceria_pedida_hist
`
lead.parameters.query = qAntes.replace(ANCLA_SQL, () => COLUMNAS + ANCLA_SQL)

// ─────────────────────────────────────────────────────────── (B) Config
const cfg = wf.nodes.find((n) => n.name === 'Config')
const asg = cfg.parameters.assignments.assignments
ok(!asg.some((a) => a.name === 'carroceria_pedida'), 'ya existía el campo carroceria_pedida')

// El MISMO orden de ramas que el CASE de SQL, para que no se desincronicen.
const DETECT = `(() => {
  const detect = (s) => {
    const t = String(s || '').toLowerCase();
    if (/pick ?-?up|camioneta|chata/.test(t)) return 'pickup';
    if (/\\bsuvs?\\b|todo ?terreno/.test(t)) return 'suv';
    if (/sed[aá]n/.test(t)) return 'sedan';
    if (/hatch/.test(t)) return 'hatchback';
    if (/utilitari|furg[oó]n/.test(t)) return 'utilitario';
    return '';
  };
  const lead = $('Leer lead (estado)').item.json;
  return detect($('Webhook Render').item.json.body.content)
      || detect(lead.lead_vehiculo)
      || String(lead.carroceria_pedida_hist || '');
})()`
asg.push({
  id: 'a28-carroceria-pedida',
  name: 'carroceria_pedida',
  value: `={{ ${DETECT} }}`,
  type: 'string',
})

// ─────────────────────────────────────────────────────────── (C) prompt
const franco = wf.nodes.find((n) => n.name === 'Franco (AI Agent)')
const sm = franco.parameters.options.systemMessage
if (!sm.startsWith('=')) throw new Error('TRAMPA 1: el systemMessage no arranca con "="')

// C1 · la inyección renderizada, arriba de todo de la sección (donde vive el guion)
const ANCLA_SEC = '## Antes de ofrecer una carrocería: fijate si existe a ese precio\n'
if (sm.split(ANCLA_SEC).length !== 2) throw new Error('no encontré (una sola vez) la sección de v95')

const INYECCION = `{{ (() => {
  const cfg = $node["Config"].json;
  const carr = String(cfg.carroceria_pedida || '');
  const mapa = $('Leer lead (estado)').item.json.pisos_map || {};
  const piso = Number(mapa[carr] || 0);
  const techo = Number(cfg.entrega_plata || 0) * 2;
  if (!carr || !piso || !techo || piso <= techo) return '';
  const nombre = { pickup: 'pickup', suv: 'SUV', sedan: 'sedán', hatchback: 'hatchback', utilitario: 'utilitario' }[carr] || carr;
  const m = (n) => cfg.empresa_moneda_simbolo + String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  return 'DATO YA CALCULADO DE ESTA CONVERSACIÓN, ES VERDAD Y NO SE DISCUTE: el cliente pidió una ' + nombre.toUpperCase() + ', y con el anticipo que dio el techo es ' + m(techo) + '. NO HAY NINGUNA ' + nombre.toUpperCase() + ' EN ESE RANGO: la más accesible del stock sale ' + m(piso) + '. PROHIBIDO EN ESTE TURNO, y es la regla que manda sobre cualquier otra: ofrecerle mostrar ' + nombre + 's, preguntarle si quiere ver ' + nombre + 's, o llamar ' + nombre + ' a un auto que no lo es. Ofrecer algo que no existe es inventar stock. Decí TEXTUAL esta frase, que YA ESTÁ CALCULADA —no la recalcules, no la resumas y no le saques el porcentaje—: "La ' + nombre + ' más accesible que tengo es de ' + m(piso) + '. Necesitarías ' + m(Math.round(piso / 2)) + ' de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo." Recién después de esa frase le ofrecés ver lo que SÍ le entra, llamándolo por su carrocería REAL.\\n';
})() }}`

franco.parameters.options.systemMessage = sm.replace(ANCLA_SEC, () => ANCLA_SEC + INYECCION + '\n')

// C2 · la regla, en la PRIMERA sección del prompt (es donde manda)
const VIEJO_REGLA = '- Precios: solo el de la ficha. No calculás descuentos ni ofrecés precios distintos; si piden rebaja, "las condiciones las arma un asesor".'
const NUEVO_REGLA = VIEJO_REGLA + '\n' +
  '- OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR, y es la peor forma porque el cliente dice que sí y ahí no hay nada. No ofrezcas mostrar una carrocería, una marca o un modelo que no esté en el stock DENTRO de lo que el cliente puede pagar, y no le pongas a una lista el nombre de lo que él pidió si los autos de la lista no son eso. Si no entra ninguno, se lo decís con el número (ver "## Antes de ofrecer una carrocería").'

let smx = franco.parameters.options.systemMessage
if (smx.split(VIEJO_REGLA).length !== 2) throw new Error('no encontré (una sola vez) la línea de Precios de # Regla base')
franco.parameters.options.systemMessage = smx.replace(VIEJO_REGLA, () => NUEVO_REGLA)

const smNuevo = franco.parameters.options.systemMessage

// ── Aserciones ──────────────────────────────────────────────────────────────
ok(wf.nodes.length === 35, `esperaba 35 nodos, hay ${wf.nodes.length}`)
ok(JSON.stringify(wf.connections) === JSON.stringify(antes.connections), 'cambiaron las connections')
const distintos = wf.nodes
  .filter((n, i) => JSON.stringify(n) !== JSON.stringify(antes.nodes[i])).map((n) => n.name).sort()
ok(JSON.stringify(distintos) === JSON.stringify(['Config', 'Franco (AI Agent)', 'Leer lead (estado)']),
  `esperaba exactamente esos 3 nodos; hay: ${JSON.stringify(distintos)}`)

ok(smNuevo.startsWith('='), 'TRAMPA 1: el systemMessage dejó de arrancar con "="')
ok(String(lead.parameters.options.queryReplacement).trim().startsWith('={{ ['),
  'TRAMPA 2: el queryReplacement de Leer lead (estado) dejó de estar en forma array')
const fromAI = (o) => (JSON.stringify(o).match(/fromAI\(/g) || []).length
ok(fromAI(wf) === fromAI(antes), `cambió la cantidad de $fromAI: ${fromAI(antes)} -> ${fromAI(wf)}`)
ok(lead.parameters.query.includes('FROM (SELECT 1) d\nLEFT JOIN crm_leads l ON l.session_id = $1;'),
  'TRAMPA 4: se rompió el patrón FROM (SELECT 1) d LEFT JOIN')
ok(lead.parameters.query.includes('AS pisos_carroceria'), 'se perdió la columna pisos_carroceria de v95')

// Lo que no se toca
for (const nm of ['Listar stock', 'Buscar auto', 'Armar respuesta', 'Guardar mensajes (historial)']) {
  ok(JSON.stringify(wf.nodes.find((n) => n.name === nm)) ===
     JSON.stringify(antes.nodes.find((n) => n.name === nm)), `se tocó ${nm} y no debe`)
}
for (const frag of [
  'ESTA SECCIÓN NO CORRE EN ESTE TURNO', 'está hablando de PLATA', 'MONTO A FINANCIAR',
  'El abanico va SOLO después de que el cliente diga que SÍ',
  'Tené en cuenta que financiamos hasta el 50% del valor del vehículo',
  'Las "economica" NO se ofrecen',
  'LOS MONTOS DE "PISOS DE STOCK" NO SON EL PRECIO DE NINGÚN AUTO',   // v96
  'EL ENCABEZADO NO LLEVA NOMBRE DE CARROCERÍA',                       // v95
]) ok(smNuevo.includes(frag), `se perdió un fix previo: ${JSON.stringify(frag)}`)
ok(smNuevo.split('OFRECER ALGO QUE NO EXISTE TAMBIÉN ES INVENTAR').length === 2,
  'la regla nueva falta o está duplicada')

// PRUEBA VINCULANTE: la inyección COMPILA y renderiza los números correctos.
{
  const i = smNuevo.indexOf('DATO YA CALCULADO DE ESTA CONVERSACIÓN')
  const ini = smNuevo.lastIndexOf('{{', i)
  const fin = smNuevo.indexOf('})() }}', i)
  const MAPA = { suv: 19800000, sedan: 16800000, pickup: 32000000, hatchback: 8200000, utilitario: 18500000 }
  try {
    const src = smNuevo.slice(ini + 2, fin + 5)
    const f = new Function('$node', '$', `return (${src})`)
    const run = (carroceria_pedida, entrega_plata) => f(
      { Config: { json: { carroceria_pedida, entrega_plata, empresa_moneda_simbolo: '$' } } },
      () => ({ item: { json: { pisos_map: MAPA } } }),
    )
    // el caso medido: pickup con $5.000.000 de anticipo -> techo $10.000.000
    const con = run('pickup', 5000000)
    ok(con.includes('$32.000.000'), 'la frase no trae el piso de la pickup')
    ok(con.includes('$16.000.000'), 'la frase no trae el anticipo mínimo')
    ok(con.includes('50%'), 'la frase no trae el porqué (el 50%)')
    ok(con.includes('$10.000.000'), 'la frase no trae el techo calculado')
    ok(/"La pickup más accesible que tengo es de \$32\.000\.000\. Necesitarías \$16\.000\.000 de anticipo, ya que el máximo a financiar es el 50% del valor del vehículo\."/.test(con),
      'el guion entrecomillado no quedó textual')
    // NO dispara cuando sí entra, cuando no hay carrocería, o cuando no hay anticipo
    ok(run('hatchback', 5000000) === '', 'dispara con hatchback, que SÍ entra en $10.000.000')
    ok(run('pickup', 20000000) === '', 'dispara con anticipo $20.000.000, donde la pickup SÍ entra')
    ok(run('', 5000000) === '', 'dispara sin carrocería pedida')
    ok(run('pickup', 0) === '', 'dispara sin anticipo (techo no calculable)')
    ok(run('sedan', 5000000).includes('$16.800.000') && run('sedan', 5000000).includes('$8.400.000'),
      'no renderiza bien otra carrocería (sedán)')
    console.log('\n  frase renderizada (pickup, anticipo $5.000.000):')
    console.log('  ' + con.trim().slice(con.indexOf('Decí TEXTUAL') - con.length))
  } catch (e) {
    fallas.push(`la inyección NO COMPILA: ${e.message}`)
  }
}

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(DESTINO, JSON.stringify(wf, null, 2) + '\n')
console.log(`\nOK: ${DESTINO}`)
console.log('  nodos con diferencias: Config · Franco (AI Agent) · Leer lead (estado)')
console.log(`  systemMessage: ${sm.length} -> ${smNuevo.length} chars`)
console.log(`  Leer lead (estado) query: ${qAntes.length} -> ${lead.parameters.query.length} chars`)
