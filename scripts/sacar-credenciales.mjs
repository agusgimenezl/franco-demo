#!/usr/bin/env node
// Saca las credenciales en texto plano de los scripts de revectorización y las pasa a
// variables de entorno (2026-07-21).
//
//   node scripts/sacar-credenciales.mjs --check    # dice qué haría, no escribe
//   node scripts/sacar-credenciales.mjs            # reescribe los .py
//
// QUÉ HABÍA: `revectorizar_con_consumo.py` y `_v2.py` tenían hardcodeadas la API key de
// OpenAI y la **service_role** de Supabase. La service_role saltea RLS: es acceso total de
// lectura y escritura a todas las tablas. Los archivos están en .gitignore y nunca entraron
// al repo — que siga así.
//
// ESTE SCRIPT NO ROTA NADA. Sacarlas del archivo no las desactiva: las claves que estuvieron
// ahí siguen siendo válidas hasta que se roten a mano en los dashboards de OpenAI y Supabase.
// Rotar es un paso aparte y obligatorio.
//
// No imprime ningún valor de credencial, ni siquiera parcial.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const ARCHIVOS = ['revectorizar_con_consumo.py', 'revectorizar_con_consumo_v2.py']

// El dominio de Supabase NO es secreto: ya viaja en cada URL de foto del stock. Se deja como
// default para no romper el script, pero overrideable por entorno.
const SUPABASE_URL_PUB = 'https://qfmsdgjtlduravrtqrif.supabase.co'

const REEMPLAZOS = [
  [/^OPENAI_API_KEY\s*=\s*".*?".*$/m, 'OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]'],
  [/^SUPABASE_SERVICE_KEY\s*=\s*".*?".*$/m, 'SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]'],
  [
    /^SUPABASE_URL\s*=\s*".*?".*$/m,
    `SUPABASE_URL = os.environ.get("SUPABASE_URL", "${SUPABASE_URL_PUB}")`,
  ],
]

// Cualquier cosa con pinta de credencial que quede después del reemplazo es un fallo.
const SOSPECHOSOS = [
  [/sk-[A-Za-z0-9_-]{20,}/, 'una API key de OpenAI'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'un JWT de Supabase'],
]

const AVISO = `
# ============================================================
# CREDENCIALES — por variables de entorno, NUNCA hardcodeadas
# ============================================================
# La service_role de Supabase saltea RLS: es acceso total. No la pegues acá.
#
#   PowerShell:  $env:OPENAI_API_KEY="..."; $env:SUPABASE_SERVICE_KEY="..."
#   bash:        export OPENAI_API_KEY=...  SUPABASE_SERVICE_KEY=...
#
# Si falta alguna, el script corta con KeyError antes de tocar la base.
`.trimStart()

let cambiados = 0
let problemas = 0

for (const nombre of ARCHIVOS) {
  const ruta = join(ROOT, nombre)
  if (!existsSync(ruta)) {
    console.log(`· ${nombre}: no existe, salteado`)
    continue
  }

  const antes = readFileSync(ruta, 'utf8')
  let despues = antes
  const aplicados = []

  for (const [re, nuevo] of REEMPLAZOS) {
    if (re.test(despues)) {
      despues = despues.replace(re, nuevo)
      aplicados.push(nuevo.split(' =')[0])
    }
  }

  // `import os` sólo si hace falta y sólo una vez.
  if (!/^import os$/m.test(despues)) {
    despues = despues.replace(/^import csv$/m, 'import csv\nimport os')
    if (!/^import os$/m.test(despues)) {
      console.error(`✗ ${nombre}: no pude insertar "import os" (no encontré "import csv")`)
      problemas++
      continue
    }
  }

  // El bloque de aviso reemplaza al viejo encabezado de "CREDENCIALES — completar".
  despues = despues.replace(
    /^# =+\n# CREDENCIALES.*\n# =+\n/m,
    AVISO,
  )

  for (const [re, qué] of SOSPECHOSOS) {
    if (re.test(despues)) {
      console.error(`✗ ${nombre}: quedó ${qué} en el archivo — NO se escribió`)
      problemas++
      despues = antes
      break
    }
  }

  if (despues === antes) {
    console.log(`· ${nombre}: sin cambios (¿ya estaba limpio?)`)
    continue
  }

  console.log(`✓ ${nombre}: ${aplicados.join(', ')} -> os.environ`)
  if (!checkOnly) writeFileSync(ruta, despues)
  cambiados++
}

console.log(
  problemas
    ? `\n✗ ${problemas} archivo(s) con problemas`
    : checkOnly
      ? `\n(--check: no se escribió nada; ${cambiados} archivo(s) se cambiarían)`
      : `\n${cambiados} archivo(s) reescritos`,
)
console.log(
  '\nFALTA ROTAR. Sacarlas del código no las desactiva:\n' +
    '  · OpenAI  -> platform.openai.com/api-keys : revocar la vieja y crear una nueva\n' +
    '  · Supabase -> Settings > API : rotar la service_role\n' +
    '  Las claves que estuvieron en texto plano siguen siendo válidas hasta que se roten.',
)

process.exit(problemas ? 1 : 0)
