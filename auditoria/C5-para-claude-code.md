# Tarea para Claude Code — cerrar los webhooks del backend (C5)

Contexto: los webhooks de n8n y el proxy de Express están abiertos a cualquiera con la URL.
Hoy esto funciona y borra leads reales:

```bash
curl -X POST https://<la-app>.onrender.com/api/session-delete \
     -H 'Content-Type: application/json' -d '{"session_id":"cualquiera"}'
```

El PIN de borrado (`src/components/common/PinModal.jsx`, `DELETE_PIN = '1234'`) es validación
de UI: vive en el bundle del cliente y `src/lib/crm.js:deleteSession` postea sin él.

Hay dos cambios independientes. El backend de n8n ya está preparado para el primero.

---

## Cambio 1 — Mandar un header de auth a n8n

Nueva variable de entorno: **`N8N_AUTH_TOKEN`**. El valor lo tiene Nicolás (va también en la
credencial Header Auth de n8n). **Nunca hardcodearlo ni ponerlo en `.env.example`** — ahí va
vacío con un comentario.

Header: `X-Franco-Auth: <N8N_AUTH_TOKEN>`

Hay que mandarlo en **las tres** rutas que hablan con n8n:

1. **`server/n8n.js`** → `forwardToN8n`.
   ⚠️ Ojo con esto: hoy los headers solo se construyen cuando hay body —
   `headers: body !== undefined ? { 'Content-Type': ... } : undefined`. O sea que **los GET
   no mandan ningún header**. Hay que armar el objeto siempre y agregar `Content-Type` solo
   cuando hay body. Si se pasa por alto, Leads e Historial se caen y el chat sigue andando,
   que es un síntoma confuso de debuggear.
2. **`server.js`** → el `fetch` upstream de `POST /api/franco`.
3. **`vite.config.js`** → el proxy de desarrollo, o dev deja de funcionar contra un n8n ya
   protegido.

Si `N8N_AUTH_TOKEN` no está definida, logueá un warning claro al arrancar el server. Un 403
silencioso es horrible de diagnosticar.

### Orden de despliegue (importante)

n8n **ignora headers desconocidos**, así que mandarlo de más es inofensivo. Exigirlo antes
de mandarlo tira la demo.

> **Este cambio va a producción PRIMERO. Recién después Nicolás activa el auth en n8n.**

---

## Cambio 2 — Mover el PIN de borrado al servidor

Hoy el PIN vive en el bundle y no se valida en ningún lado del backend.

- Nueva env var **`CRM_PIN`** en Render (no en el bundle, no en `.env.example` con valor).
- `src/lib/crm.js` → `deleteSession(sessionId, pin)` manda el PIN en el body.
- `server.js` → `POST /api/session-delete` compara contra `process.env.CRM_PIN` y responde
  **403 sin llamar a n8n** si no coincide.
- `PinModal.jsx` → deja de comparar contra la constante local. Manda el PIN y muestra el
  error que devuelva el server. Hoy valida localmente y solo entonces llama a `onConfirm`.

Sigue sin ser autenticación real (el PIN viaja desde un cliente público), pero un `curl` a
ciegas deja de borrar datos. Para una demo comercial alcanza.

### Opcional
Aplicar lo mismo a `POST /api/session-save`. Menos grave — marca `is_saved = true`, no
destruye nada — pero deja que cualquiera publique sesiones ajenas en la vista de Leads.

---

## Qué NO hay que cerrar

`GET /api/leads` y `GET /api/sessions` quedan abiertos **a propósito**: el dueño de la
concesionaria tiene que ver el CRM llenándose en vivo durante la demo. `visible_ids` desde
localStorage ya limita a cada visitante a sus propias sesiones más las que tengan
`is_saved = true`.

Si en algún momento entran datos de clientes reales, eso pasa a necesitar login de verdad.

---

## Verificación

```bash
# sin token -> 403
curl -i https://n8n.utopiaflow.tech/webhook/leads
# con token -> 200
curl -i -H 'X-Franco-Auth: <token>' https://n8n.utopiaflow.tech/webhook/leads
# sin PIN -> 403, sin tocar n8n
curl -i -X POST https://<la-app>.onrender.com/api/session-delete \
     -H 'Content-Type: application/json' -d '{"session_id":"test"}'
```

Y a mano: chat, Leads e Historial tienen que seguir funcionando igual que antes.
