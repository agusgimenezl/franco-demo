# Requerimiento n8n — El webhook de Franco ahora recibe SOLO texto

## Qué cambió

La transcripción de audio se movió al frontend (server-side, con Whisper de OpenAI).
**El webhook de n8n ya no recibe audio nunca más.** Todo lo que llega es texto.

- Cuando el usuario manda un audio, el frontend lo transcribe **antes** de llamar al
  webhook y manda el texto resultante.
- Cuando el usuario manda varias burbujas seguidas (texto y/o audio), el frontend las
  agrupa (debounce de 5s), transcribe los audios, une todo con saltos de línea `\n` y
  manda **una sola** request de texto.

## Contrato actual (único formato que llega)

```json
{
  "session_id": "abc",
  "type": "text",
  "content": "hola\nme interesa el ranger\ncuánto sale?",
  "timestamp": "2026-07-04T16:00:00.000Z"
}
```

- `type` es **siempre** `"text"`. Ya no llega `"audio"` ni `"batch"`, ni el campo `parts`,
  ni base64.
- `content` puede ser multilínea (`\n`) cuando el usuario mandó una ráfaga. Tratalo como
  **un único turno** del usuario (es lo que venís haciendo con el texto normal).
- La respuesta NO cambia: mismo schema de siempre (`messages` / `images` / `product_cards`
  / `error`), una sola respuesta por request.

## Acción en n8n: eliminar la rama de audio (queda muerta)

Como ya nunca llega audio, se puede sacar del flujo (o dejar, pero sería código muerto):

- El **Switch/If** que ruteaba por `type` entre `text` y `audio`.
- El nodo de **Base64 → binario** (el que convertía el `content` del audio a archivo).
- El nodo de **Whisper / transcripción**.

Debería quedar solo el camino de texto: recibir `content` y pasárselo al AI Agent.

Si querés dejar una red de seguridad, un check tolerante (`if type !== 'text' → responder
"reenviame el mensaje"`) no molesta, pero no es necesario: el frontend garantiza texto.

## Checklist

- [ ] Sacar Switch de `type`, nodo Base64→binario y nodo Whisper.
- [ ] Verificar que el camino de texto siga funcionando con `content` de una sola línea.
- [ ] Verificar con `content` multilínea (`\n`): Franco responde una sola vez al conjunto.
- [ ] La respuesta mantiene el schema (`messages` / `images` / `product_cards` / `error`).
