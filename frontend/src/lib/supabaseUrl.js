// El webhook arma product_cards e images con un AI Agent (structured output),
// no con un passthrough directo de datos. Confirmado con requests directos a
// n8n: el dominio de Supabase que devuelve suele venir completo, pero a veces
// el modelo "tipea mal" un fragmento del subdominio (ej. pierde "avrt" de
// qfmsdgjtlduravrtqrif), lo que deja una URL con un host que no resuelve. No
// hay ninguna manipulación de string en el cliente que cause esto — se
// verificó contra el código fuente y el historial completo de git.
//
// Como mitigación, reconstruimos la URL con un origen canónico fijo: todas
// las fotos del stock viven en el mismo bucket público, así que solo
// confiamos en el path después de STORAGE_PATH_ANCHOR (el nombre de archivo,
// que el modelo no suele corromper) y descartamos el dominio que haya venido.
const CANONICAL_SUPABASE_ORIGIN = 'https://qfmsdgjtlduravrtqrif.supabase.co'
const STORAGE_PATH_ANCHOR = '/storage/v1/object/public/'

export function normalizeSupabaseUrl(url) {
  if (typeof url !== 'string' || !url) return url

  const anchorIndex = url.indexOf(STORAGE_PATH_ANCHOR)
  if (anchorIndex === -1) return url // no es una URL de Supabase Storage reconocible

  const pathAfterAnchor = url.slice(anchorIndex + STORAGE_PATH_ANCHOR.length)
  return `${CANONICAL_SUPABASE_ORIGIN}${STORAGE_PATH_ANCHOR}${pathAfterAnchor}`
}
