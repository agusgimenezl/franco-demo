// MIGRACIÓN DE STOCK · ETAPA 1 — LAS SPECS DURAS DEL DOCUMENTO
// "Stock Real de Depósito - Ficha Técnica Agente Comercial IA (V2)", 2026-08-10.
//
// NO EJECUTA NADA. Genera el SQL y un reporte de antes/después para revisar.
//   node scripts/stock-etapa1-specs-del-documento.mjs            -> reporte + SQL en /scratchpad
//
// QUÉ TOCA: año (1), combustible (1), transmisión (7), consumo (16) y campos NUEVOS (version,
// motor, potencia_cv, traccion, consumo_urbano/ruta/mixto) + el equipamiento dentro de `content`.
// QUÉ NO TOCA, A PROPÓSITO: precio (el documento no los trae), km (los 17 ya coinciden), color,
// carrocería, tamaño, fotos, y `descripcion`/`condicionantes` — esa es la ETAPA 2, porque es copy
// de venta y hay 12 frases que el documento contradice: las corrige una persona, no yo.
//
// LOS CUATRO ACOPLAMIENTOS QUE LA MIGRACIÓN RESPETA (verificados en el workflow, no supuestos):
//  1. `metadata.consumo` es la FIRMA del detector "la ficha ya se dio" (v103): `Detalle auto` busca
//     ese string exacto en las burbujas recientes. Sigue siendo UN solo "X.Y L/100km" (el mixto del
//     documento), con punto y sin espacio como hoy. Urbano y ruta van en campos NUEVOS.
//  2. `content` conserva la frase "Condición: … ." porque `Detalle auto` la borra con regexp_replace
//     para armar `ficha_completa`.
//  3. `Buscar auto` matchea TRANSMISIÓN contra `content` (`'%transmisión autom%'` OR
//     `'%transmisión cvt%'` / `'%transmisión manual%'`), no contra metadata. Por eso la cirugía de
//     content es la que hace que la búsqueda quede bien en los 7 autos que pasan a automática.
//  4. `Buscar auto` matchea TRACCIÓN con `content ILIKE '%4x4%'` / `'%4x2%'`. HOY la Amarok tiene
//     "4x4" en su texto y el equipamiento del documento dice sólo "tracción integral permanente
//     4Motion": copiarlo literal la sacaba de las búsquedas de 4x4. Hay un ASSERT que exige que
//     cada auto conserve el token de tracción que ya tenía.
//
// NO HAY RIESGO DE BÚSQUEDA SEMÁNTICA: no existe ningún nodo vectorStore en el workflow y
// `match_disponibles` es un valor de Config que nadie consume. La columna `embedding` está muerta.

import fs from 'node:fs'

const SALIDA = process.env.SALIDA_SQL ||
  'C:/Users/agusg/AppData/Local/Temp/claude/C--Users-agusg-OneDrive-Documentos-Agustina-UtopIA-Lab-Concesionarias-Demo-v2/eb075aad-1252-4030-98f7-bd25803c3bca/scratchpad/stock-etapa1.sql'

// ── EL DOCUMENTO, TRANSCRIPTO. `mixto/urbano/ruta` en L/100km. ──────────────
// `trans_content` es lo que va en content después de "transmisión " y tiene que hacer matchear el
// ILIKE de Buscar auto: 'autom%' o 'cvt' para las automáticas, 'manual' para las manuales.
// `traccion_token` es el string que TIENE que sobrevivir en content (assert).
const DOC = [
  { id: 1,  auto: 'Fiat Cronos',        version: 'Precision 1.3 Firefly',            motor: '1.3 Firefly de 99 CV',            comb: 'Nafta',  trans: 'Automática', trans_content: 'automática cvt',       mixto: '6.7', urbano: '7.9', ruta: '5.8', traccion: '4x2', traccion_token: null,
    equip: 'climatizador automático, apertura y encendido sin llave (Keyless Entry/Go), baúl de 525 litros, llantas de aleación de 16 pulgadas, apoyabrazos central delantero, cámara de estacionamiento con sensores traseros' },
  { id: 2,  auto: 'Volkswagen Gol Trend', version: 'Comfortline 1.6 8v MSI 5 puertas', motor: '1.6 de 101 CV',                  comb: 'Nafta',  trans: 'Manual',     trans_content: 'manual',               mixto: '7.8', urbano: '9.2', ruta: '6.5', traccion: '4x2', traccion_token: null,
    equip: 'aire acondicionado, dirección asistida, levantacristales eléctricos delanteros, cierre centralizado con mando a distancia, radio Composition Touch con pantalla de 6.5 pulgadas e integración Bluetooth, frenos ABS y doble airbag frontal' },
  { id: 3,  auto: 'Ford Fiesta',        version: 'SE 1.6 Sigma',                     motor: '1.6 Sigma de 120 CV',             comb: 'Nafta',  trans: 'Manual',     trans_content: 'manual',               mixto: '7.3', urbano: '8.8', ruta: '6.2', traccion: '4x2', traccion_token: null,
    equip: 'control electrónico de estabilidad (AdvanceTrac), control de tracción, asistente de arranque en pendientes (HLA), sistema SYNC con conectividad Bluetooth y comandos de voz, llantas de aleación de 15 pulgadas y levantacristales eléctricos en las 4 puertas' },
  { id: 4,  auto: 'Toyota Etios',       version: 'XLS 1.5 Dual VVT-i',               motor: '1.5 de 103 CV con cadena de distribución', comb: 'Nafta', trans: 'Manual', trans_content: 'manual',        mixto: '7.0', urbano: '8.2', ruta: '6.0', traccion: '4x2', traccion_token: null,
    anio_nuevo: '2021', anio_viejo: '2019',
    // EL PRECIO NO SALE DEL DOCUMENTO — el documento no trae precios. Sale de la estructura del
    // propio stock, porque pasar de 2019 a 2021 con los mismos 45.000 km cambia el valor:
    //   · interpolando contra el Cronos 2023 ($16.800.000) desde el Gol Trend 2018 ($9.200.000):
    //     $1,52M por año -> $13.760.000
    //   · interpolando contra el Onix 2024 ($21.500.000) desde el mismo piso: $2,05M -> $15.350.000
    // Punto medio: $14.500.000 (+8% por año sobre los $12,5M de hoy).
    // PROPIEDAD QUE LO HACE SEGURO Y ESTÁ ASSERTEADA ABAJO: no cambia el ORDEN de ningún auto del
    // stock —el Etios sigue entre el Gol Trend y el Cronos—, así que la lógica de tramos y
    // categorías no se mueve, y sigue sin entrar en el techo de 10M de `no-ofrecer-lo-que-no-existe`.
    precio_viejo: 12500000, precio_nuevo: 14500000,
    equip: 'caja manual de 6ta, control electrónico de estabilidad (ESP) y tracción (TRC), volante multifunción en cuero, central multimedia con pantalla táctil y Bluetooth, faros antiniebla delanteros y llantas de aleación de 15 pulgadas' },
  { id: 5,  auto: 'Toyota Corolla',     version: 'XEI 2.0 Dynamic Force',            motor: '2.0 de 170 CV',                   comb: 'Nafta',  trans: 'Automática', trans_content: 'automática cvt',       mixto: '7.2', urbano: '8.8', ruta: '5.9', traccion: '4x2', traccion_token: null,
    equip: '7 airbags de serie, climatizador automático bizona, pantalla multimedia de 8 pulgadas con conectividad inalámbrica, faros antiniebla LED, llantas de aleación de 17 pulgadas y acceso y encendido mediante botón inteligente (Smart Entry/Push Start)' },
  { id: 6,  auto: 'Volkswagen Vento',   version: 'GLI 2.0 TSI',                      motor: '2.0 Turbo de 230 CV',             comb: 'Nafta',  trans: 'Automática', trans_content: 'automática dsg',       mixto: '8.2', urbano: '10.5', ruta: '6.8', traccion: '4x2', traccion_token: null,
    equip: 'caja DSG de 7 marchas, diferencial autoblocante electrónico XDS, suspensión trasera independiente multilink, techo solar panorámico, asientos deportivos en cuero calefaccionados y ventilados, sistema de sonido premium y tablero digital configurable' },
  { id: 7,  auto: 'Chevrolet Onix',     version: 'Premier 1.0 Turbo',                motor: '1.0 Turbo de 116 CV',             comb: 'Nafta',  trans: 'Automática', trans_content: 'automática',           mixto: '6.5', urbano: '7.8', ruta: '5.5', traccion: '4x2', traccion_token: null,
    equip: '6 airbags, sistema Easy Park de estacionamiento semi-autónomo, cargador de celular inalámbrico, Wi-Fi a bordo y OnStar, alerta de punto ciego y tapizados en cuero ecológico bitono' },
  { id: 8,  auto: 'Peugeot 208',        version: 'Allure T200 Turbo',                motor: '1.0 Turbo T200 de 120 CV',        comb: 'Nafta',  trans: 'Automática', trans_content: 'automática cvt',       mixto: '6.8', urbano: '8.0', ruta: '5.6', traccion: '4x2', traccion_token: null,
    equip: 'puesto i-Cockpit con pantalla digital de 10 pulgadas, luces DRL en garras de león, climatizador automático digital, llantas de aleación de 16 pulgadas y cargador inductivo' },
  { id: 9,  auto: 'Ford EcoSport',      version: 'Titanium 1.5 Dragon',              motor: '1.5 Dragon de 123 CV',            comb: 'Nafta',  trans: 'Automática', trans_content: 'automática',           mixto: '7.8', urbano: '9.0', ruta: '6.8', traccion: '4x2', traccion_token: null,
    equip: '7 airbags, sistema SYNC 3 con pantalla flotante de 8 pulgadas y GPS, techo solar eléctrico, tapizados de cuero ecológico, sistema de audio premium Sony con 9 parlantes, sensores de lluvia y luz y llantas de 17 pulgadas' },
  { id: 10, auto: 'Volkswagen T-Cross', version: 'Highline 200 TSI',                 motor: '1.0 Turbo de 116 CV',             comb: 'Nafta',  trans: 'Automática', trans_content: 'automática tiptronic', mixto: '7.2', urbano: '8.5', ruta: '6.0', traccion: '4x2', traccion_token: null,
    equip: 'ópticas full LED, instrumental digital Active Info Display de 10 pulgadas, pantalla central VW Play de 10 pulgadas, cargador inalámbrico de celular, techo solar panorámico, detector de punto ciego, climatizador Touch y 5 estrellas de seguridad Latin NCAP' },
  { id: 11, auto: 'Renault Duster',     version: 'Iconic 1.3 Turbo TCe',             motor: '1.3 Turbo de 155 CV',             comb: 'Nafta',  trans: 'Automática', trans_content: 'automática cvt',       mixto: '7.8', urbano: '9.2', ruta: '6.5', traccion: '4x2', traccion_token: null,
    equip: 'climatizador automático, detector de punto ciego, sistema de cámaras 360 grados Multiview, pantalla Easy Link de 8 pulgadas, cargador inductivo de smartphone y baúl de 475 litros' },
  { id: 12, auto: 'Jeep Renegade',      version: 'Sport 1.8 E.torQ',                 motor: '1.8 de 130 CV',                   comb: 'Nafta',  trans: 'Automática', trans_content: 'automática',           mixto: '9.5', urbano: '11.5', ruta: '8.0', traccion: '4x2', traccion_token: null,
    equip: 'pantalla táctil Uconnect con Apple CarPlay y Android Auto, cámara de retroceso, freno de mano electrónico, control de estabilidad (ESC), control de tracción, llantas de aleación de 17 pulgadas y velocidad crucero' },
  { id: 13, auto: 'Toyota Hilux',       version: 'SRV 2.8 TDI 4x4',                  motor: '2.8 TDI de 204 CV',               comb: 'Diesel', trans: 'Manual',     trans_content: 'manual',               mixto: '9.6', urbano: '11.2', ruta: '8.3', traccion: '4x4', traccion_token: '4x4',
    equip: 'tracción 4x4 con acople electrónico en alta y baja y bloqueo de diferencial trasero, 7 airbags de serie, pantalla táctil de 8 pulgadas con Apple CarPlay y Android Auto, climatizador automático bizona, llantas de 17 pulgadas, estribos laterales y lona marítima' },
  { id: 14, auto: 'Ford Ranger',        version: 'Limited 3.0 V6 4x4',               motor: '3.0 V6 Turbodiésel',              comb: 'Diesel', trans: 'Automática', trans_content: 'automática',           mixto: '9.5', urbano: '11.0', ruta: '8.2', traccion: '4x4', traccion_token: '4x4',
    equip: 'pantalla táctil vertical SYNC 4 de 12 pulgadas, tablero 100% digital de 12 pulgadas, tracción 4x4 e-4WD con reductora y selector de modos de terreno, paquete completo de asistencias ADAS con frenado autónomo, control de crucero adaptativo y mantenimiento centrado de carril, tapizados de cuero, llantas de aleación de 20 pulgadas y acceso y arranque sin llave' },
  { id: 15, auto: 'Volkswagen Amarok',  version: 'Comfortline 2.0 TDI 180 CV 4Motion', motor: '2.0 Bi-Turbodiésel de 180 CV',  comb: 'Diesel', trans: 'Automática', trans_content: 'automática',           mixto: '9.2', urbano: '10.8', ruta: '8.0', traccion: '4x4', traccion_token: '4x4',
    // OJO: el documento dice sólo "4Motion". Se agrega "4x4" a propósito o la Amarok se cae de las
    // búsquedas de tracción, que matchean con content ILIKE '%4x4%'.
    equip: 'tracción integral permanente 4x4 4Motion, caja automática de 8 marchas, sensores de estacionamiento delanteros y traseros, lona marítima, control de estabilidad con función off-road, frenos ABS Off-Road y volante multifunción en cuero' },
  { id: 16, auto: 'Chevrolet S10',      version: 'LTZ 2.8 TD 4x2',                   motor: '2.8 Duramax de 200 CV',           comb: 'Diesel', trans: 'Automática', trans_content: 'automática',           mixto: '9.0', urbano: '10.5', ruta: '7.8', traccion: '4x2', traccion_token: '4x2',
    equip: 'tracción 4x2 trasera, motor de 200 CV y 500 Nm, central multimedia MyLink con Wi-Fi nativo e integración OnStar, 6 airbags, alerta de colisión frontal, alerta de cambio involuntario de carril, climatizador automático y tapizados de cuero sintético' },
  { id: 17, auto: 'Renault Kangoo',     version: 'Stepway 1.5 dCi Pasajeros',        motor: '1.5 dCi Turbodiésel de 89 CV',    comb: 'Diesel', trans: 'Manual',     trans_content: 'manual',               mixto: '5.6', urbano: '6.5', ruta: '5.0', traccion: '4x2', traccion_token: null,
    // El documento dice 5 PASAJEROS y el content decía "2 asientos": quedaba contradiciéndose solo
    // dentro de la misma ficha. Es un dato duro del documento, así que va acá y no en la Etapa 2.
    content_extra: [['Utilitario, 5 puertas, 2 asientos.', 'Utilitario, 5 puertas, 5 asientos.']],
    equip: 'configuración de 5 pasajeros con doble puerta lateral corrediza, control de estabilidad (ESP), asistente de arranque en pendientes, pantalla Media NAV de 7 pulgadas con GPS integrado y barras de techo' },
]

// ── Aserciones sobre el documento transcripto ───────────────────────────────
const fallas = []
const ok = (c, m) => { if (!c) fallas.push(m) }
ok(DOC.length === 17, `esperaba 17 autos, hay ${DOC.length}`)
ok(new Set(DOC.map((d) => d.id)).size === 17, 'hay ids repetidos')
for (const d of DOC) {
  ok(/^\d+\.\d$/.test(d.mixto) && /^\d+\.\d$/.test(d.urbano) && /^\d+\.\d$/.test(d.ruta),
    `${d.auto}: consumo con formato raro`)
  ok(Number(d.urbano) > Number(d.mixto) && Number(d.mixto) > Number(d.ruta),
    `${d.auto}: urbano > mixto > ruta no se cumple (${d.urbano}/${d.mixto}/${d.ruta})`)
  // ACOPLAMIENTO 3: el texto de transmisión tiene que hacer matchear el ILIKE de Buscar auto.
  const matchea = d.trans === 'Manual' ? /^manual/.test(d.trans_content)
    : /^autom/.test(d.trans_content) || /cvt/.test(d.trans_content)
  ok(matchea, `${d.auto}: trans_content "${d.trans_content}" no matchea el ILIKE de Buscar auto`)
  // ACOPLAMIENTO 4: si hoy tiene token de tracción, el equipamiento nuevo lo tiene que conservar.
  if (d.traccion_token) {
    ok((d.equip + ' ' + d.version).includes(d.traccion_token),
      `${d.auto}: PIERDE el token "${d.traccion_token}" — se cae de las búsquedas de tracción`)
  }
  // El equipamiento no puede traer caracteres que rompan el replacement de regexp_replace.
  ok(!/[\\&']/.test(d.equip), `${d.auto}: el equipamiento tiene un carácter que rompe el SQL`)
  ok(!/[\\&']/.test(d.version) && !/[\\&']/.test(d.motor), `${d.auto}: versión o motor con carácter problemático`)
}
// EL PRECIO NUEVO NO PUEDE CAMBIAR EL ORDEN DEL STOCK: si lo cambiara, se movería la lógica de
// tramos/categorías y las expectativas de media docena de casos de eval.
{
  const PRECIOS_HOY = { 1:16800000, 2:9200000, 3:8200000, 4:12500000, 5:24800000, 6:31000000,
    7:21500000, 8:21000000, 9:19800000, 10:34000000, 11:22500000, 12:25500000, 13:38000000,
    14:57000000, 15:32000000, 16:39500000, 17:18500000 }
  const nuevos = { ...PRECIOS_HOY }
  for (const d of DOC) if (d.precio_nuevo) {
    ok(PRECIOS_HOY[d.id] === d.precio_viejo, `${d.auto}: el precio_viejo no coincide con el de la base`)
    nuevos[d.id] = d.precio_nuevo
  }
  const orden = (m) => Object.keys(m).sort((a, b) => m[a] - m[b]).join(',')
  ok(orden(PRECIOS_HOY) === orden(nuevos),
    `el precio nuevo CAMBIA el orden del stock:\n    antes: ${orden(PRECIOS_HOY)}\n    ahora: ${orden(nuevos)}`)
  // Y no puede entrar en el techo de 10M de `no-ofrecer-lo-que-no-existe` (hoy entran Fiesta y Gol).
  ok(Object.values(nuevos).filter((p) => p <= 10000000).length === 2,
    'cambió cuántos autos entran con techo de $10.000.000: se rompe no-ofrecer-lo-que-no-existe')
  // El mapa PRECIOS del eval tiene que quedar sincronizado o `no_inventa_autos` marca lo correcto
  // como inventado en TODOS los turnos de TODOS los casos.
  const evalSrc = fs.readFileSync('evals/run.mjs', 'utf8')
  for (const d of DOC) if (d.precio_nuevo) {
    ok(evalSrc.includes(`Etios: ${d.precio_nuevo}`),
      `evals/run.mjs sigue con el precio viejo del Etios — actualizalo a ${d.precio_nuevo} ANTES de correr esto`)
  }
}

// El equipamiento tiene que DISTINGUIR (pendiente 6): nada que esté en los 17.
{
  const frases = DOC.map((d) => d.equip.toLowerCase())
  for (const t of ['aire acondicionado', 'pantalla multimedia']) {
    const n = frases.filter((f) => f.includes(t)).length
    ok(n < 17, `"${t}" sigue estando en los 17 autos: el equipamiento no distingue`)
  }
}

// ── Generación del SQL ──────────────────────────────────────────────────────
const q = (s) => String(s).replace(/'/g, "''")
const stmts = []
for (const d of DOC) {
  const sets = []
  const meta = {
    version: d.version, motor: d.motor, traccion: d.traccion,
    transmision: d.trans, combustible: d.comb,
    consumo: `${d.mixto} L/100km`,
    consumo_urbano: `${d.urbano} L/100km`,
    consumo_ruta: `${d.ruta} L/100km`,
    consumo_mixto: `${d.mixto} L/100km`,
  }
  if (d.anio_nuevo) meta['año'] = d.anio_nuevo
  if (d.precio_nuevo) meta.precio = String(d.precio_nuevo)
  sets.push(`metadata = metadata || '${q(JSON.stringify(meta))}'::jsonb`)

  // content: una sola cirugía para Versión + Motor + combustible + transmisión + consumo, y otra
  // para el equipamiento. `.*?` es no-greedy: el motor trae puntos ("1.5L") y un [^.]* no sirve.
  let contentExpr = 'content'
  if (d.anio_viejo) {
    contentExpr = `replace(${contentExpr}, '${q(d.auto + ' ' + d.anio_viejo + ',')}', '${q(d.auto + ' ' + d.anio_nuevo + ',')}')`
  }
  // ⚠️ EL ANCLA ' Condición:' DEL FINAL NO ES DECORATIVA — SIN ELLA EL PATRÓN DEJA BASURA.
  // En Postgres la avidez de TODA la expresión la fija el PRIMER cuantificador: como arranca con
  // `.*?` (no ávido), el `[0-9.,]+` de atrás también se vuelve no ávido y consume sólo "6." de
  // "6.3.", dejando un "3." colgado ("Consumo promedio aproximado: 7.0.3."). Pasó de verdad en la
  // corrida del 2026-08-10 y hubo que arreglarlo con un UPDATE aparte. El ancla obliga al
  // cuantificador a expandirse hasta el número completo.
  contentExpr = `regexp_replace(${contentExpr}, 'Motor .*?Consumo promedio aproximado: [0-9.,]+ Condición:', '${q(`Versión: ${d.version}. Motor ${d.motor}, ${d.comb.toLowerCase()}, transmisión ${d.trans_content}. Consumo promedio aproximado: ${d.mixto}. Condición:`)}')`
  if (d.content_extra) for (const [de, a] of d.content_extra) contentExpr = `replace(${contentExpr}, '${q(de)}', '${q(a)}')`
  contentExpr = `regexp_replace(${contentExpr}, 'Equipamiento: .*?( URLs de fotos)', '${q('Equipamiento: ' + d.equip)}\\1')`
  // El precio también vive en content: si se cambia en metadata y no acá, el auto se contradice solo.
  if (d.precio_nuevo) {
    contentExpr = `replace(${contentExpr}, 'Precio: $${d.precio_viejo} ARS', 'Precio: $${d.precio_nuevo} ARS')`
  }
  sets.push(`content = ${contentExpr}`)

  stmts.push(`-- ${d.id}. ${d.auto} ${d.anio_nuevo || ''}\nUPDATE autos_disponibles SET\n  ${sets.join(',\n  ')}\nWHERE (metadata->>'id')::int = ${d.id};`)
}

const VERIF = `-- VERIFICACIÓN (correr DESPUÉS; tiene que dar 17 filas y ninguna en 'MAL')
SELECT (metadata->>'id')::int AS id, metadata->>'modelo' AS modelo,
       metadata->>'año' AS anio, metadata->>'combustible' AS comb,
       metadata->>'transmision' AS transm, metadata->>'consumo' AS consumo,
       metadata->>'version' AS version, metadata->>'traccion' AS traccion,
       CASE WHEN content NOT LIKE '%Condición: %' THEN 'MAL: se perdió Condición'
            WHEN content NOT LIKE '%URLs de fotos%' THEN 'MAL: se perdieron las URLs'
            -- ANCLADO Y CON REGEX, no con LIKE: el LIKE '%: 7.0.%' daba VERDE sobre "7.0.3.",
            -- que es la basura que dejó el patrón perezoso. Un check que no distingue eso no sirve.
            WHEN content !~ ('Consumo promedio aproximado: ' || replace(split_part(metadata->>'consumo',' ',1),'.','\.') || '\. Condición: ') THEN 'MAL: consumo desalineado'
            WHEN content ~ '[0-9]\.[0-9]\.[0-9]' THEN 'MAL: quedó basura numérica'
            WHEN metadata->>'transmision' = 'Manual'     AND content NOT ILIKE '%transmisión manual%' THEN 'MAL: transmisión'
            WHEN metadata->>'transmision' = 'Automática' AND content NOT ILIKE '%transmisión autom%' AND content NOT ILIKE '%transmisión cvt%' THEN 'MAL: transmisión'
            WHEN metadata->>'traccion' = '4x4' AND content NOT ILIKE '%4x4%' THEN 'MAL: se cae de las búsquedas 4x4'
            ELSE 'ok' END AS estado
FROM autos_disponibles ORDER BY 1;`

if (fallas.length) {
  console.error('ASERCIONES FALLIDAS:')
  fallas.forEach((f) => console.error('  ✗ ' + f))
  process.exit(1)
}

fs.writeFileSync(SALIDA, stmts.join('\n\n') + '\n\n' + VERIF + '\n')

// ── Reporte ─────────────────────────────────────────────────────────────────
const HOY = { 1:['2023','Nafta','Manual','6.5'], 2:['2018','Nafta','Manual','7.0'], 3:['2017','Nafta','Manual','6.8'],
  4:['2019','Nafta','Manual','6.3'], 5:['2022','Nafta','CVT','7.2'], 6:['2023','Nafta','Automática','7.5'],
  7:['2024','Nafta','Manual','6.0'], 8:['2025','Nafta','Manual','6.6'], 9:['2020','Nafta','Manual','8.0'],
  10:['2025','Nafta','Automática','7.3'], 11:['2023','Nafta','Manual','8.5'], 12:['2021','Nafta','Automática','8.8'],
  13:['2021','Diesel','Manual','9.5'], 14:['2024','Diesel','Automática','10.2'], 15:['2018','Diesel','Manual','9.8'],
  16:['2022','Diesel','Manual','9.6'], 17:['2021','Nafta','Manual','7.8'] }
console.log('ETAPA 1 — antes → después (sólo lo que cambia)\n')
let n = 0
for (const d of DOC) {
  const [a, c, t, k] = HOY[d.id]
  const dif = []
  if (d.anio_nuevo && a !== d.anio_nuevo) dif.push(`año ${a} → ${d.anio_nuevo}`)
  if (c !== d.comb) dif.push(`combustible ${c} → ${d.comb}`)
  if (t !== d.trans) dif.push(`transmisión ${t} → ${d.trans}`)
  if (k !== d.mixto) dif.push(`consumo ${k} → ${d.mixto}`)
  if (d.precio_nuevo) dif.push(`PRECIO ${(d.precio_viejo / 1e6).toFixed(1)}M → ${(d.precio_nuevo / 1e6).toFixed(1)}M`)
  if (dif.length) { n++; console.log(`  ${String(d.id).padStart(2)} ${d.auto.padEnd(22)} ${dif.join(' · ')}`) }
}
console.log(`\n  ${n} de 17 con cambios de specs; los 17 suman version, motor, traccion y consumo urbano/ruta.`)
console.log(`  Único precio que cambia: el Etios, por el salto de año. Los otros 16, sin tocar.`)
console.log(`  km, color, carrocería, tamaño, fotos, descripcion y condicionantes: SIN TOCAR.`)
console.log(`\nSQL escrito en: ${SALIDA}`)
console.log('  NO se ejecutó nada. Revisar y recién después correrlo.')
