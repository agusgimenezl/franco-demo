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
const STOCK_BUCKET_PATH = `${STORAGE_PATH_ANCHOR}fotos-vehiculos-stock/`

export function normalizeSupabaseUrl(url) {
  if (typeof url !== 'string' || !url) return url

  const anchorIndex = url.indexOf(STORAGE_PATH_ANCHOR)
  if (anchorIndex === -1) return url // no es una URL de Supabase Storage reconocible

  const pathAfterAnchor = url.slice(anchorIndex + STORAGE_PATH_ANCHOR.length)
  return `${CANONICAL_SUPABASE_ORIGIN}${STORAGE_PATH_ANCHOR}${pathAfterAnchor}`
}

// Caso más extremo que el de arriba: en vez de corromper el dominio, el
// modelo a veces inventa una URL entera sin relación con el bucket real (ej.
// "https://example.com/etios2019.jpg" para un Toyota Etios). Ahí no hay
// ningún ancla que reconstruir. Como cada product_card trae el id numérico
// del auto (dato de baja entropía, el modelo prácticamente no lo confunde),
// si la URL no matchea el bucket real la reconstruimos directo desde el id
// con el patrón confirmado: foto-{id}-1.webp.
export function resolveProductCardPhoto(url, id) {
  if (typeof url === 'string' && url.includes(STOCK_BUCKET_PATH)) {
    return normalizeSupabaseUrl(url)
  }
  if (id == null) return url
  return `${CANONICAL_SUPABASE_ORIGIN}${STOCK_BUCKET_PATH}foto-${id}-1.webp`
}
