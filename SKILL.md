---
name: franco-backend
description: Contexto del BACKEND (n8n + Supabase) del proyecto Franco, el asistente de ventas de autos. Usá esta skill SIEMPRE que trabajes en el frontend de Franco (el React en Render: chat, tabs de Leads/Historial, product cards, imágenes) y necesites saber qué manda el backend, qué campos vienen en cada endpoint, cómo son las URLs de imágenes, o cuando un bug parezca de datos que llegan mal. También cuando debas decidir si un bug es del frontend o del backend, o cuando el pedido toque el contrato de datos entre n8n y la UI. Invocala al inicio de cualquier tarea del frontend de Franco para no trabajar a ciegas sobre lo que pasa del otro lado de la frontera y para respetar el contrato de datos.
---

# Franco — Backend (n8n + Supabase): contrato y criterio para el frontend

Esta skill le da al frontend (vos, trabajando en el React de la demo de Franco) la **perspectiva del backend** que normalmente no ves. La construyó "el lado de n8n" del equipo. Leerla al empezar evita el error más caro del proyecto: **tocar el frontend para arreglar un bug cuya causa raíz está en los datos que manda n8n.**

Franco es un asistente de ventas de autos usados (concesionaria ficticia "Automotores Tucumán"). El sistema tiene tres capas: **prompt del agente (n8n) → parser/estructura → frontend (React en Render)**. Vos trabajás la tercera. Esta skill te cuenta las dos primeras lo suficiente para que colabores sin romper la frontera.

---

## REGLA BASE (la que evita el 90% de los bugs)

> **El backend produce el dato. El frontend lo muestra tal cual. El frontend NUNCA reconstruye, adivina ni completa un dato que debería venir del backend.**

Si un dato llega mal a la pantalla, lo primero NO es tocar el frontend: es mirar qué mandó el backend (ver "Protocolo de diagnóstico"). El síntoma aparece en la UI, pero la causa suele estar upstream.

---

## Contrato de datos (los campos EXACTOS que manda el backend)

Todos los endpoints cuelgan del **mismo dominio base** que el webhook de chat. Derivá las URLs de esa base; NO hardcodees un dominio nuevo.

### Chat: `POST /webhook/franco-chat`
Request: `{ session_id, type: "text", content, config_overrides? }`
Response:
```json
{
  "session_id": "string",
  "messages": [ { "type": "text", "content": "..." } ],
  "images":   [ { "url": "https://...supabase.../foto-N-M.webp", "after_message_index": 1 } ],
  "product_cards": [
    { "id": 6, "titulo": "Volkswagen Vento 2024", "precio": "$29.500.000",
      "foto_principal": "https://...supabase.../foto-6-1.webp", "es_detalle": false }
  ],
  "error": null
}
```

### Leads (CRM): `GET /webhook/leads?visible_ids=id1,id2`
Array de: `session_id, nombre, telefono, vehiculo_interes, entrega, descripcion_usado, presupuesto, financia, temperatura, estado, resumen, fecha_contacto, ultima_actualizacion, is_saved`.
- `temperatura`: "Frío" | "Intermedio" | "Caliente"
- `estado`: "Nuevo" | "En conversación" | "Requiere asesor"
- `entrega` / `financia`: "Sí" | "No" | "No mencionado"

### Sesiones (Historial): `GET /webhook/sessions?visible_ids=id1,id2`
Array de: `session_id, nombre, temperatura, estado, is_saved, fecha_contacto, primer_mensaje`.

### Mensajes de una sesión: `GET /webhook/session-messages?session_id=X`
Array de: `tipo` ("human" | "ai"), `contenido`.

### Guardar sesión: `POST /webhook/session-save`
Body `{ session_id }`. Responde `{ session_id, is_saved: true }`.

---

## REGLA DE ORO DE LAS IMÁGENES (causó 4 bugs — nunca más)

- `foto_principal` (en cada card) y `url` (en cada item de `images`) vienen SIEMPRE como **URL completa de Supabase**:
  `https://qfmsdgjtlduravrtqrif.supabase.co/storage/v1/object/public/fotos-vehiculos-stock/foto-{id}-{n}.webp`
- El frontend las usa **tal cual, directo en el `src`**:
  ```jsx
  <img src={card.foto_principal} alt={card.titulo} />
  {images.map((img,i) => <img key={i} src={img.url} alt="Foto del vehículo" />)}
  ```
- **PROHIBIDO:**
  - Construir el nombre de archivo desde marca/modelo (ej. `toyota_corolla.jpg`) ❌
  - Usar placeholders de ejemplo hardcodeados (ej. `url_to_vento_photo_2`) ❌
  - Recortar/transformar el dominio (el dominio real es `qfmsdgjtlduravrtqrif`, con las letras `avrt` en el medio; cualquier versión sin ellas está corrupta) ❌
  - Agregar o cambiar la extensión (son `.webp`, no `.jpg`) ❌
- **Único procesamiento permitido:** un `onError` que muestre un placeholder gris SI la URL viniera vacía o la imagen realmente fallara. Nada más.
- **Esta lógica está CONGELADA:** no la refactorices ni la toques salvo que este contrato cambie. Cada vez que se tocó, se rompió.

---

## Protocolo de diagnóstico (seguí el dato hasta la fuente)

Cuando algo se ve mal en pantalla, NO asumas la capa por dónde aparece el síntoma. Antes de tocar código:

1. **Mirá el dato crudo en la frontera.** Abrí el JSON que devuelve el endpoint de n8n (consola → Network, o probando el webhook). ¿El dato ya viene mal de n8n, o viene bien?
2. **Si viene mal de n8n** → es del backend. NO toques el frontend. Reportalo (ver abajo).
3. **Si viene bien de n8n pero se ve mal** → ahí sí es del frontend, arreglalo.
4. Solo después de ubicar la capa, escribí el fix.

**Caso real (imágenes):** el `<img>` mostraba `src="url_to_vento_photo_2"`. El síntoma estaba en el frontend, pero el JSON de n8n YA traía esa URL alucinada (el agente la inventaba). Se perdieron 4 intentos de fix de frontend por no mirar el JSON primero. La causa era backend. **El síntoma en el `<img>` NO significa que el bug sea del frontend.**

---

## Cómo colaborar con el lado de n8n (rebotar cuando corresponde)

Sos un especialista del frontend. El backend es otro especialista. Se supervisan mutuamente:

> **Si al investigar un bug encontrás que la causa raíz NO está en el frontend sino en el dato que llega del backend, NO lo parchees ni lo disimules.** Frená y reportá con evidencia concreta: qué campo llega mal, qué valor trae, y qué debería traer. Ese reporte va al lado de n8n para arreglarlo en la fuente. Un placeholder de degradación con gracia está bien como red TEMPORAL, pero avisá explícitamente que es un parche, no la solución.

Ejemplo de un buen reporte de rebote:
> "El campo `foto_principal` llega como `toyota_corolla.jpg` en vez de una URL de Supabase. Yo puedo degradar a placeholder, pero la causa está en el backend (el agente no está copiando la URL real). Necesita fix del lado de n8n, no del frontend."

Ese tipo de reporte destraba el bug en vez de acumular parches.

---

## Reglas de higiene

- Antes de tocar cualquier cosa cercana a imágenes o al contrato de datos, releé la "Regla de oro de las imágenes".
- Después de un cambio que toque imágenes o el contrato, verificá en Network que las URLs sean las reales de Supabase (`foto-N-M.webp`), no placeholders ni nombres construidos.
- Reutilizá el sistema de estilos y componentes que ya usa la app; no metas componentes genéricos que rompan la consistencia visual.
- Todos los fetch con try/catch y estados de carga/error visibles.
- Si un cambio requeriría modificar el contrato de datos (nombres de campos, estructura), avisá antes de implementar: eso se coordina con el backend, no se resuelve compensando en la UI.
