-- Agrega `descripcion`, `condicionantes` y `tamano` al metadata de autos_disponibles.
-- Generado por scripts/gen-descripcion-sql.mjs desde stock.csv (2026-07-23). No editar a mano.
--
-- Idempotente: se puede correr las veces que haga falta.
-- Aditivo: sólo suma tres claves al jsonb. NO toca `content` ni `embedding`, así que no
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
  (1, 'Sedán con baúl de verdad al precio de un hatchback, y el de menos kilómetros de su rango. Mecánica simple y repuesto en cualquier taller: es el auto de menor costo de mantenimiento del stock.', 'Con el 1.3, si el uso va a ser sobre todo ruta cargado y con cinco personas, conviene mirar algo de más motor. Para ciudad y viajes normales va sobrado.', 'mediano'),
  (2, 'Mecánica conocidísima: cualquier taller lo atiende y los repuestos son baratos y se consiguen en el día. Es el auto con menos sorpresas de mantenimiento del stock, y el 1.6 responde mejor que los motores chicos del segmento.', 'Es equipamiento básico: si pesa tener pantalla y cámara, el 208 o el Cronos las traen. Por los km, pedile al asesor el historial de service.', 'chico'),
  (3, 'El más barato de todo el stock y, al mismo tiempo, el más potente de los autos chicos. Es el único de esa combinación: entrada de gama sin resignar andar en ruta, y ya viene con pantalla multimedia.', 'Por los km que tiene, pedile al asesor el historial de service antes de decidir.', 'chico'),
  (4, 'El que menos combustible consume de los hatchbacks, con mecánica Toyota: es el argumento de reventa más fuerte de esta franja de precio, porque se deprecia menos que sus competidores.', 'No trae pantalla multimedia: si eso pesa en la decisión, el 208 y el Cronos la tienen.', 'chico'),
  (5, 'Sedán mediano con caja automática y equipamiento completo, cámara y sensores incluidos. Toyota con caja CVT es de las combinaciones que mejor sostienen valor de reventa en el mercado local.', 'La caja CVT tiene su service específico. No es la transmisión indicada si vas a remolcar o cargar peso seguido.', 'mediano'),
  (6, 'Motor turbo de 150 HP, la mayor potencia entre los autos no pickup del stock, y con pocos kilómetros encima. Andar de gama alta sin el costo de patentamiento de una unidad nueva.', 'Es turbo: pide nafta de buena calidad y service al día para rendir como corresponde.', 'mediano'),
  (7, 'El que menos consume de todo el stock, gracias al 1.2 turbo, y con muy pocos kilómetros. Rinde como un auto chico y anda como uno mediano.', 'Es caja manual: si buscás automático, el Vento es el equivalente del stock.', 'mediano'),
  (8, 'Prácticamente 0 km y el hatchback más nuevo del stock, con los kilómetros más bajos del grupo. Es además el que mejor va en ruta de los chicos: la suspensión europea se nota en viaje largo.', 'Los repuestos son de marca europea: se consiguen, pero a veces son de pedido. Si priorizás repuesto en el día, el Gol o el Cronos.', 'chico'),
  (9, 'La SUV más equipada por debajo de su rango: cámara, sensores y pantalla. Da altura para calle rota y cordón alto sin el costo ni el tamaño de una SUV grande.', 'Es caja manual: si buscás una SUV automática, el T-Cross o el Renegade.', 'mediano'),
  (10, 'Prácticamente sin uso, con los kilómetros más bajos de todo el stock. SUV automática con equipamiento completo: es la opción de quien quiere 0 km sin esperar.', 'El 1.6 aspirado prioriza suavidad antes que empuje: si buscás respuesta fuerte en ruta, el Vento turbo va mejor.', 'mediano'),
  (11, 'SUV moderna y de pocos kilómetros. Despeje alto y baúl grande, pensada para ripio y camino roto: es la que mejor aguanta el uso rudo por lo que cuesta.', 'La potencia es justa para el tamaño: si la vas a llevar cargada y en subida seguido, conviene una SUV de más motor.', 'mediano'),
  (12, 'La única SUV automática de su rango de precio, con equipamiento completo. Presencia y terminación por encima del promedio del segmento.', 'El service y los repuestos están por encima del promedio del segmento: conviene tenerlo en cuenta en el costo de mantenimiento.', 'mediano'),
  (13, 'Pickup 4x4 diésel con la mecánica de mejor reventa del segmento: es la que más valor sostiene con los años, y eso se recupera al momento de venderla.', 'Por los km que tiene, conviene que el asesor te muestre el historial de service y el estado de embrague y suspensión.', 'grande'),
  (14, 'La pickup más nueva y más potente del stock, 4x4 diésel automática y con equipamiento completo. Es la única que combina tracción integral con caja automática: lista para trabajo pesado sin resignar confort de manejo.', 'Es una pickup grande de trabajo: si el uso va a ser sobre todo ciudad, una SUV te va a resultar más práctica.', 'grande'),
  (15, 'La 4x4 diésel más accesible del stock, con buena potencia y equipamiento completo. La opción para quien necesita tracción real y no quiere pagar una unidad reciente.', 'Por los km que tiene, conviene una revisión mecánica previa, sobre todo de la cadena de distribución. El asesor la coordina sin cargo.', 'grande'),
  (16, 'Misma potencia que la unidad más cara del stock (200 HP) por bastante menos plata. Pickup de trabajo con rodaje real, buena ecuación para carga y ruta.', 'Es 4x2, no 4x4: para barro, ripio suelto o campo no reemplaza a una tracción integral.', 'grande'),
  (17, 'Utilitario con espacio de carga real y el consumo de un auto chico. Costo de patente y mantenimiento de utilitario, que es lo que lo hace rendir para quien trabaja con él.', 'Tiene sólo dos asientos: no sirve como auto familiar.', 'mediano')
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
