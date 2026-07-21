-- Agrega `color` al metadata de autos_disponibles (2026-07-21).
-- Generado por scripts/gen-color-sql.mjs desde stock.csv. No editar a mano.
--
-- Idempotente: se puede correr las veces que haga falta.
-- Aditivo: sólo suma la clave `color` al jsonb. NO toca `content` ni `embedding`,
-- así que no hay que revectorizar ni regenerar embeddings.

UPDATE autos_disponibles a
SET metadata = a.metadata || jsonb_build_object('color', v.color)
FROM (VALUES
  (1, 'Gris'),
  (2, 'Blanco'),
  (3, 'Azul'),
  (4, 'Gris'),
  (5, 'Gris'),
  (6, 'Blanco'),
  (7, 'Rojo'),
  (8, 'Azul'),
  (9, 'Negro'),
  (10, 'Blanco'),
  (11, 'Gris'),
  (12, 'Verde'),
  (13, 'Blanco'),
  (14, 'Gris'),
  (15, 'Negro'),
  (16, 'Blanco'),
  (17, 'Blanco')
) AS v(id, color)
WHERE (a.metadata->>'id')::int = v.id;

-- Verificación: 17 filas, ninguna con color NULL.
SELECT (metadata->>'id')::int AS id,
       metadata->>'marca' || ' ' || (metadata->>'modelo') AS auto,
       metadata->>'color' AS color
FROM autos_disponibles
ORDER BY 1;
