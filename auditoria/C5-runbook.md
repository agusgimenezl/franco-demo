# C5 — Cerrar los webhooks. Runbook

## El problema, en dos partes

**(a) n8n está abierto al mundo.** Cualquiera con la URL puede leer todos los leads o
borrarlos:
```bash
curl https://n8n.utopiaflow.tech/webhook/leads
curl -X POST https://n8n.utopiaflow.tech/webhook/session-delete \
     -H 'Content-Type: application/json' -d '{"session_id":"..."}'
```

**(b) El proxy de Render también.** El PIN de borrado (`PinModal.jsx`, `DELETE_PIN = '1234'`)
es validación de UI: vive en el bundle del cliente y `crm.js:85` postea sin él. Entonces:
```bash
curl -X POST https://<tu-app>.onrender.com/api/session-delete \
     -H 'Content-Type: application/json' -d '{"session_id":"..."}'
```
borra igual, sin PIN.

El header auth cierra **(a)** por completo. **(b)** necesita validar el PIN en Express,
porque el server pone el header en nombre de quien sea que llame.

---

## ⚠️ Orden de ejecución — importante

El header auth rompe la demo si n8n lo exige antes de que el frontend lo mande.
n8n **ignora headers desconocidos**, así que mandarlo de más es inofensivo.

> **Frontend primero. n8n después.**

### Paso 1 — Frontend (Claude Code)
Deployá el cambio que manda el header. Con n8n todavía sin auth, no pasa nada.

### Paso 2 — n8n: crear la credencial
`Credentials → New → Header Auth`
- Name: `Franco webhook auth`
- Header Name: `X-Franco-Auth`
- Header Value: *(el token que te pasé — el mismo que pusiste en Render)*

### Paso 3 — Importar `franco-n8n-v6.json`
Los 6 webhooks vienen con `authentication: headerAuth` y una credencial placeholder
(`REEMPLAZAR_EN_N8N`). No puedo referenciar la credencial real: el id lo genera n8n al
crearla.

### Paso 4 — Re-seleccionar la credencial en los 6 nodos
`Webhook Render`, `Webhook GET leads`, `Webhook GET sessions`, `Webhook GET messages`,
`Webhook POST save`, `Webhook POST delete`.

> **Ventana de caída:** entre el paso 3 y el 4 los webhooks rechazan todo. Son un par de
> minutos. No lo hagas con un cliente mirando.

### Paso 5 — Verificar
```bash
curl -i https://n8n.utopiaflow.tech/webhook/leads                      # espero 403
curl -i -H 'X-Franco-Auth: <token>' https://n8n.utopiaflow.tech/webhook/leads   # espero 200
```
Y abrí la demo: chat, Leads e Historial tienen que seguir andando.

---

## Spec para Claude Code (frontend)

### 1. Mandar el header en las dos rutas de proxy

Ambas usan `N8N_WEBHOOK_URL`; ahora suman `N8N_AUTH_TOKEN`.

- **`server/n8n.js`** → en `forwardToN8n`, agregar `X-Franco-Auth` a `headers`. Ojo: hoy
  `headers` solo se setea cuando hay body (`body !== undefined ? {...} : undefined`), así
  que los GET no mandan ninguno. Hay que construir el objeto siempre y sumarle
  `Content-Type` solo si hay body.
- **`server.js`** → en `POST /api/franco`, sumar el header al `fetch` upstream.
- **`vite.config.js`** → el proxy de dev tiene que mandarlo igual, o dev deja de andar
  contra un n8n ya protegido.
- **`.env.example`** → agregar `N8N_AUTH_TOKEN=` (vacío, con comentario). **Nunca el valor
  real.**

Si `N8N_AUTH_TOKEN` no está seteada, mandá el header vacío o no lo mandes — pero logueá un
warning al arrancar. Un 403 silencioso es horrible de debuggear.

### 2. Mover el PIN de borrado al server

Hoy `DELETE_PIN = '1234'` está en el bundle. Mínimo viable:

- `CRM_PIN` como env var en Render (no en el bundle).
- `crm.js:deleteSession(sessionId, pin)` manda el PIN en el body.
- `POST /api/session-delete` en `server.js` compara contra `process.env.CRM_PIN` y responde
  **403 sin llamar a n8n** si no coincide.
- `PinModal` deja de validar localmente: manda el PIN y muestra el error que devuelva el
  server. Hoy compara contra la constante y solo entonces llama a `onConfirm`.

Sigue sin ser auth de verdad (el PIN viaja desde un cliente público), pero un `curl` a
ciegas deja de borrar datos. Para una demo comercial alcanza.

### 3. Aplicar lo mismo a `/api/session-save` (opcional)
Menos grave — marca `is_saved = true`, no destruye nada. Pero deja que cualquiera publique
sesiones ajenas en la vista de Leads.

---

## Qué NO cierra esto

- `/api/leads` y `/api/sessions` siguen abiertos a cualquiera que abra la demo. Es
  **por diseño**: el dueño de la concesionaria tiene que ver el CRM llenándose en vivo.
  `visible_ids` desde localStorage limita a cada visitante a sus propias sesiones más las
  que tengan `is_saved = true`. Si en algún momento hay datos reales de clientes reales,
  esto pasa a necesitar login de verdad.
- El token es compartido y estático. Para una demo está bien. Para producción multi-cliente,
  no.
