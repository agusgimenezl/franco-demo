# Base de Airtable "Concesionaria" — demo del CRM

Base de ejemplo para mostrar en reuniones **cómo la información que capta Franco aterriza en el
CRM de la concesionaria**. Replica la base de referencia (7 tablas) y se llena con datos reales
de la demo donde los hay.

> **YA ESTÁ CREADA EN AIRTABLE: `Concesionaria — Demo Franco`, base `appPKHNCaN57zAN7S`**
> (workspace *Impulso AI*) — https://airtable.com/appPKHNCaN57zAN7S
>
> Se armó por API replicando el esquema real de la base de referencia `Concesionaria`
> (`appnZGwLtcAnJMHtU`), que **no se tocó**. La base viva es la fuente de verdad; el esquema de
> los CSV de esta carpeta es anterior y **no coincide campo por campo** con ella (se diseñó antes
> de poder leer la referencia). Los CSV siguen sirviendo como respaldo de los datos y como camino
> de import manual si hiciera falta rehacerla sin acceso a la API.

## De dónde salió cada dato

| Origen | Qué aporta |
|---|---|
| `GET /webhook/leads` (CRM vivo de la demo, 15 tarjetas al 03/08/2026) | Las 15 primeras filas de **Leads**: nombre, teléfono, vehículo de interés, fecha, resumen, estado, temperatura, presupuesto, financia, usado en parte de pago. **Textual, sin editar.** |
| `stock.csv` (las 17 unidades de `autos_disponibles`) | La tabla **Vehículos** completa. |
| Inventado | Todo lo demás: Vendedores, Clientes, Ventas, Financiamiento, Visitas coordinadas, y 4 leads captados por vendedor (Diego Sosa, Carla Ibarra, Martín Alcaraz, Sofía Nieva). |

Lo ficticio está armado para ser **coherente entre tablas**: los 3 vehículos marcados `Vendido`
son exactamente los 3 de la tabla Ventas, y los leads con "Visita coordinada" tildada son
exactamente los que tienen fila en Visitas coordinadas. Está verificado, no supuesto.

## Decisiones que conviene saber antes de mostrarla

- **"Sin nombre (555-XXXX)"** — 4 tarjetas reales tienen el teléfono en el campo nombre porque el
  cliente nunca lo dio (Franco usa el teléfono ficticio como placeholder). En la tarjeta de la demo
  se ven así; acá se renombran para que se lea "lead anónimo" y para que el campo primario sea único
  (Airtable linkea por campo primario: dos "Sin nombre" iguales colapsarían en un solo registro).
- **Dos columnas de vehículo en Leads.** `Interés declarado` guarda el texto crudo que captó Franco
  ("Autos blancos (S10, Hilux, T-Cross, Vento)"); `ID vehículo de interés` es el link a las unidades
  concretas del stock que matchean. Sin la primera se perdía lo que dijo el cliente; sin la segunda
  no había link. Los casos donde el interés es genérico ("autos usados de los últimos 3 años") tienen
  link a las unidades que cumplen el criterio — eso es interpretación mía, no dato del agente.
- **Estado del cliente** mezcla los dos valores reales de Franco (`Requiere asesor`, `En conversación`)
  con los de la base de referencia (`Cliente cerrado`, `Financiación solicitada`, `Cliente gestionado`,
  `Solicita más información`), que quedan para los leads captados por vendedor. El agente hoy solo
  escribe los dos primeros.
- **Un lead puede seguir en "Requiere asesor" y tener una venta.** Es a propósito: la tarjeta es la
  foto del momento en que el agente derivó, y la venta pasó días después (Lucia Gomez, Julio Rodriguez).
- **`Temperatura`, `Presupuesto declarado`, `Financia` y `Descripción del usado`** no están en la base
  de referencia pero sí en las tarjetas. Los dejé porque son justamente lo que diferencia al agente de
  un formulario web. Si querés la base idéntica a la referencia, ocultá esas columnas en la vista.

## Cómo importarla

1. En Airtable: **Add a base → Start from scratch**, nombrala `Concesionaria`.
2. Importá los 7 CSV **en orden numérico**, cada uno como tabla nueva:
   `Add or import → CSV file → Insert as new table`. Renombrá la tabla si Airtable le pone el nombre
   del archivo (ej. `1-Vehiculos` → `Vehículos`, `7-Visitas-coordinadas` → `Visitas coordinadas`).
   Borrá la tabla vacía `Table 1` que crea Airtable al abrir la base.
3. **Recién después** convertí los campos de link (los valores ya existen todos, así que Airtable no
   va a crear registros huérfanos). En cada uno: click en el header → *Edit field* → `Link to another
   record` → tabla destino → dejar activado *Allow linking to multiple records*.

   | Tabla | Campo | Apunta a |
   |---|---|---|
   | Leads | ID vehículo de interés | Vehículos |
   | Clientes | Lead de origen · Vehículo de interés · Vendedor asignado | Leads · Vehículos · Vendedores |
   | Ventas | Cliente · Vehículo vendido · Vendedor | Clientes · Vehículos · Vendedores |
   | Financiamiento | Lead · Vehículo | Leads · Vehículos |
   | Visitas coordinadas | Lead · Vehículo · Vendedor asignado | Leads · Vehículos · Vendedores |

4. Convertí a **Checkbox**: `Leads → Visita coordinada`, `Visitas coordinadas → Test drive`,
   `Vendedores → Activo`. Las celdas traen `true` o vacío, así que la conversión es limpia.
5. Convertí a **Single select** (Airtable te ofrece crear las opciones solas):
   `Leads → Captado por, Estado del cliente, Temperatura`, `Vehículos → Estado, Condición, Transmisión`,
   `Financiamiento → Estado de la solicitud, Entidad`, `Visitas coordinadas → Estado`,
   `Clientes → Estado`. Colores sugeridos para que se lea como la referencia: verde `Cliente cerrado`,
   azul `Financiación solicitada`, rosa `Cliente gestionado`, gris `Solicita más información`,
   naranja `Requiere asesor`, amarillo `En conversación`.
6. Convertí a **Date** con formato `DD/MM/YYYY` y hora incluida: `Leads → Fecha de contacto,
   Última actualización`, `Visitas coordinadas → Fecha y hora`, y sin hora en `Ventas → Fecha de venta`,
   `Financiamiento → Fecha de solicitud`, `Clientes → Fecha de alta`.
7. Convertí a **Currency (ARS)** las columnas de precios y montos, y a **Number** kilometraje, año,
   potencia y cuotas.

## Volver a generarla con datos frescos

Las 15 filas reales de Leads salen de un solo llamado:

```bash
curl "https://n8n.utopiaflow.tech/webhook/leads?visible_ids="
```

Cada tarjeta trae `nombre, telefono, vehiculo_interes, entrega, descripcion_usado, presupuesto,
financia, temperatura, estado, resumen, fecha_contacto, ultima_actualizacion`. Es el mismo endpoint
que alimenta la pestaña **Leads** del front, así que lo que se ve en la demo y lo que está acá es
el mismo dato.
