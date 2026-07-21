-- ============================================================
-- Tabla CRM de leads para la demo de Franco.
-- Vive en la misma Postgres de Supabase que la memoria del chat.
-- La clave real es session_id (un session_id = un lead).
-- Correr una vez en el SQL Editor de Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_leads (
  -- Identificador real del lead. Un session_id = una fila.
  session_id            TEXT PRIMARY KEY,

  -- Campos visibles (de la spec)
  nombre                TEXT NOT NULL DEFAULT 'Lead',
  telefono              TEXT,                       -- ficticio, +54 381 555-XXXX
  vehiculo_interes      TEXT NOT NULL DEFAULT 'No mencionado',
  entrega               TEXT NOT NULL DEFAULT 'No mencionado',   -- Sí / No / No mencionado
  descripcion_usado     TEXT NOT NULL DEFAULT 'No mencionado',
  presupuesto           TEXT NOT NULL DEFAULT 'No mencionado',
  financia              TEXT NOT NULL DEFAULT 'No mencionado',    -- Sí / No / No mencionado
  temperatura           TEXT NOT NULL DEFAULT 'Frío',             -- Frío / Intermedio / Caliente
  estado                TEXT NOT NULL DEFAULT 'Nuevo',            -- Nuevo / En conversación / Requiere asesor
  resumen               TEXT NOT NULL DEFAULT 'Lead nuevo sin información adicional',

  -- Campos técnicos / de gestión
  fecha_contacto        TIMESTAMPTZ NOT NULL DEFAULT now(),       -- no cambia después de creado
  ultima_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now(),       -- se actualiza en cada cambio
  is_saved              BOOLEAN NOT NULL DEFAULT false,           -- true = guardado manual, sobrevive al TTL
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now()        -- para el cron de limpieza por TTL
);

-- Índice para el filtrado por sesiones visibles (tab de Leads) y el cron de limpieza.
CREATE INDEX IF NOT EXISTS idx_crm_leads_is_saved       ON crm_leads (is_saved);
CREATE INDEX IF NOT EXISTS idx_crm_leads_last_activity  ON crm_leads (last_activity_at);

-- ============================================================
-- Notas:
-- - session_id es PRIMARY KEY: garantiza "un session_id = un lead" a nivel base.
--   El UPSERT (INSERT ... ON CONFLICT (session_id) DO UPDATE) usa esta clave.
-- - Los DEFAULT replican el "registro inicial" de la spec: así el primer UPSERT
--   ya crea la fila con los valores por defecto correctos sin lógica extra.
-- - nombre arranca en 'Lead' y el agente lo completa a 'Lead XXXX' (derivado del
--   session_id) o al nombre real si el usuario lo dice.
-- - fecha_contacto NO se toca en updates (solo en el insert inicial).
-- ============================================================
