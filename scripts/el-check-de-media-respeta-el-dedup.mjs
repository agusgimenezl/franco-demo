// Prueba el check REAL de evals/run.mjs, no una copia: extrae las definiciones del archivo
// y las evalúa. Si el check se edita, esta prueba corre sobre el texto editado.
import fs from 'node:fs'

const src = fs.readFileSync('evals/run.mjs', 'utf8')
const lines = src.split('\n')
const cut = (desde, hasta) => lines.slice(desde - 1, hasta).join('\n')

const iCatalogo = lines.findIndex((l) => l.startsWith('const CATALOGO =')) + 1
const iEspejoFin = lines.findIndex((l) => l.startsWith('const PRECIOS ='))
const iAllText = lines.findIndex((l) => l.startsWith('const allText =')) + 1
const iChecks = lines.findIndex((l) => l.startsWith('const CHECKS =')) + 1
const iAlways = lines.findIndex((l) => l.startsWith('const ALWAYS ='))

const codigo = [
  cut(iCatalogo, iEspejoFin),   // CATALOGO + el bloque espejo del dedup
  cut(iAllText, iAllText),      // allText
  cut(iChecks, iAlways - 1),    // el objeto CHECKS entero
  'export { CHECKS, registrarMedia, mediaPorTurno, imagenesPorTurno, modeloPorId }',
].join('\n')

const mod = await import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'))
const { CHECKS, registrarMedia, mediaPorTurno, imagenesPorTurno, modeloPorId } = mod
const reset = () => { mediaPorTurno.length = 0; imagenesPorTurno.length = 0; modeloPorId.clear() }

const card = (id, titulo) => ({ id, titulo, precio: '$1', foto_principal: `https://x/foto-${id}-1.webp` })
const bub = (c) => ({ messages: [{ type: 'text', content: c }], product_cards: [], images: [] })

let malos = 0
const t = (nombre, esperado, fn) => {
  reset()
  const got = fn()
  const ok = esperado === 'verde' ? got === null : got !== null
  if (!ok) malos++
  console.log(`  ${ok ? 'ok  ' : 'MAL '} [${esperado}] ${nombre}${ok ? '' : `\n        -> ${got}`}`)
}

// ── EL CASO MEDIDO CON v118 (turno 2 de chico-no-es-utilitario) ────────────────────────────
t('turno 2 renombra los 3 chicos que el turno 1 ya mostró como cards', 'verde', () => {
  const turno1 = { ...bub('Mirá, estas te pueden servir:'), product_cards: [card(4, 'Toyota Etios 2021'), card(7, 'Chevrolet Onix 2024'), card(8, 'Peugeot 208 2025')] }
  registrarMedia(turno1)
  const turno2 = bub('la opción que entra justo es:\n- Toyota Etios 2021\nEl Chevrolet Onix 2024 y el Peugeot 208 2025 quedan por encima.')
  return CHECKS.media_si_lista_autos(turno2)
})

// ── EL BUG QUE EL CHECK TIENE QUE SEGUIR CAZANDO ───────────────────────────────────────────
t('nombra 3 autos NUEVOS sin media (el bug original, TIPO B)', 'rojo', () => {
  const turno2 = bub('Mirá:\n- Ford Ranger 2024\n- Toyota Hilux 2021\n- Chevrolet S10 2022')
  return CHECKS.media_si_lista_autos(turno2)
})

t('nombra 3 nuevos sin media DESPUÉS de haber mostrado otros 3', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(4, 'Toyota Etios 2021'), card(7, 'Chevrolet Onix 2024'), card(8, 'Peugeot 208 2025')] })
  return CHECKS.media_si_lista_autos(bub('- Ford Ranger 2024\n- Toyota Hilux 2021\n- Chevrolet S10 2022'))
})

t('2 ya vistos + 3 nuevos sin media sigue siendo rojo', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(4, 'Toyota Etios 2021'), card(7, 'Chevrolet Onix 2024')] })
  return CHECKS.media_si_lista_autos(bub('- Etios\n- Onix\n- Ford Ranger 2024\n- Toyota Hilux 2021\n- Chevrolet S10 2022'))
})

// ── LO QUE YA ANDABA NO PUEDE CAMBIAR ──────────────────────────────────────────────────────
t('menos de 3 autos nombrados sin media', 'verde', () => CHECKS.media_si_lista_autos(bub('- Ford Ranger 2024\n- Toyota Hilux 2021')))
t('3 autos nuevos CON cards', 'verde', () =>
  CHECKS.media_si_lista_autos({ ...bub('- Ranger\n- Hilux\n- S10'), product_cards: [card(14, 'Ford Ranger 2024')] }))

// ── LA VENTANA (4 turnos) Y EL SESGO CONSERVADOR ───────────────────────────────────────────
t('lo mostrado hace 5 turnos ya NO cuenta como visto', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(4, 'Toyota Etios 2021'), card(7, 'Chevrolet Onix 2024'), card(8, 'Peugeot 208 2025')] })
  for (let i = 0; i < 4; i++) registrarMedia(bub('turno sin media'))
  return CHECKS.media_si_lista_autos(bub('- Toyota Etios 2021\n- Chevrolet Onix 2024\n- Peugeot 208 2025'))
})

t('fotos cuentan como visto si el id se aprendió de una card', 'verde', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(4, 'Toyota Etios 2021'), card(7, 'Chevrolet Onix 2024'), card(8, 'Peugeot 208 2025')] })
  registrarMedia({ ...bub('y'), images: [{ url: 'https://x/foto-4-1.webp' }] })
  return CHECKS.media_si_lista_autos(bub('- Etios\n- Onix\n- 208'))
})

t('un auto que llegó SÓLO como foto, sin card previa, no se acredita (falso rojo a propósito)', 'rojo', () => {
  registrarMedia({ ...bub('x'), images: [{ url: 'https://x/foto-14-1.webp' }, { url: 'https://x/foto-13-1.webp' }, { url: 'https://x/foto-16-1.webp' }] })
  return CHECKS.media_si_lista_autos(bub('- Ford Ranger 2024\n- Toyota Hilux 2021\n- Chevrolet S10 2022'))
})

t('la media del turno actual no se autoacredita', 'rojo', () => {
  const r = bub('- Ford Ranger 2024\n- Toyota Hilux 2021\n- Chevrolet S10 2022')
  const out = CHECKS.media_si_lista_autos(r)
  registrarMedia(r)
  return out
})

// ── images_min · MISMO CHOQUE, DEL LADO DE LAS FOTOS ───────────────────────────────────────
// OJO CON LA DIFERENCIA, QUE ES LO QUE HACE CORRECTO A ESTE CHECK: en `Armar respuesta` las fotos
// sólo se suprimen si ya salieron FOTOS de ese auto. Haber salido como CARD no cuenta.
const img = (id) => ({ url: `https://x/foto-${id}-1.webp` })

t('el caso medido f0c23a2f: turno 1 mandó fotos del 9, turno 2 pregunta por el 9', 'verde', () => {
  // el mapa id->modelo lo aprenden las cards; acá el turno 1 manda cards Y fotos, como en la sesión real
  registrarMedia({ ...bub('x'), product_cards: [card(17, 'Renault Kangoo 2021'), card(9, 'Ford EcoSport 2020')], images: [img(17), img(9)] })
  return CHECKS.images_min(bub('El Ford EcoSport 2020 es la versión Titanium 1.5 Dragon y sale $19.800.000.'), 1)
})

t('pide fotos de un auto que NUNCA las mandó -> sigue rojo', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(9, 'Ford EcoSport 2020')], images: [img(9)] })
  return CHECKS.images_min(bub('El Toyota Corolla 2022 tiene 35.000 km.'), 1)
})

t('LA DISTINCIÓN CLAVE: salió como CARD pero sin fotos -> sigue rojo', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(9, 'Ford EcoSport 2020')] })  // card, sin images
  return CHECKS.images_min(bub('El Ford EcoSport 2020 es una SUV mediana.'), 1)
})

t('si manda las fotos, verde sin mirar el dedup', 'verde', () =>
  CHECKS.images_min({ ...bub('El Ford EcoSport 2020'), images: [img(9)] }, 1))

t('no nombra ningún auto del catálogo y no manda fotos -> rojo', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(9, 'Ford EcoSport 2020')], images: [img(9)] })
  return CHECKS.images_min(bub('Querés que te conecte con un asesor?'), 1)
})

t('fotos dadas hace 5 turnos ya no cuentan', 'rojo', () => {
  registrarMedia({ ...bub('x'), product_cards: [card(9, 'Ford EcoSport 2020')], images: [img(9)] })
  for (let i = 0; i < 4; i++) registrarMedia(bub('turno sin media'))
  return CHECKS.images_min(bub('El Ford EcoSport 2020 es una SUV mediana.'), 1)
})

console.log(`\n${malos === 0 ? 'TODO OK' : malos + ' FALLA(S)'}`)
process.exit(malos ? 1 : 0)
