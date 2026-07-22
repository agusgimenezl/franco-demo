# Franco

Agente vendedor de autos para concesionarias, en fase demo. Se vende e implementa en varias
concesionarias, así que **la configurabilidad es requisito de negocio, no nice-to-have**. Un
bug en vivo tiene costo comercial: la demo se muestra en reuniones con dueños.

- **Backend:** n8n. Producción en `franco-n8n-v6.json` (35 nodos). Dos agentes: `Franco` en
  `gpt-4.1-mini` y `CRM` en `gpt-4.1`.
- **Frontend:** `frontend/` — React + Vite servido por Express, en Render. Proxy server-side a
  n8n (el navegador nunca ve la URL de n8n ni ninguna key).
- **Datos:** Supabase/Postgres — `autos_disponibles` (stock vectorizado, datos en `metadata`
  jsonb), `crm_leads` (PK `session_id`), `n8n_chat_histories` (memoria), `mensajes_demo`
  (historial del front).

**Antes de proponer cualquier cosa, leé `docs/franco/STATE.md`.** Tiene qué está desplegado,
qué está abierto, qué se decidió a conciencia y qué deuda es intencional.

---

## Las trampas

Las 5 primeras son de n8n y cada una costó semanas de diagnóstico equivocado. La 6 y la 7
son del prompt y costaron tres intentos fallidos en un día. No las redescubras.

1. **Un campo solo se evalúa como expresión si arranca con `=`.** El `systemMessage` de
   Franco no lo tenía: sus 18 expresiones `{{ }}` eran texto literal y el agente nunca
   recibió los datos de empresa ni la FAQ. Se atribuyó a "alucinación" durante meses.
2. **`queryReplacement` parte el string por comas.** Un mensaje de usuario con una coma
   corría `$1,$2,$3` y rompía el INSERT: se perdían leads. Usar **siempre** la forma array
   `={{ [ v1, v2 ] }}`.
3. **`$fromAI` con la misma key necesita descripción y tipo byte-idénticos** en todas sus
   ocurrencias, o n8n falla con `Duplicate key found with different description or type`.
4. **Todo nodo Postgres de la cadena principal debe devolver ≥1 fila**, o corta el flujo y
   el usuario no recibe respuesta. Patrón: `FROM (SELECT 1) d LEFT JOIN`, o
   `alwaysOutputData: true`.
5. **`gpt-4.1` tiene 30.000 TPM en esta organización.** Mandarle JSON crudo con URLs al
   agente CRM lo reventaba y se perdían leads al azar. Cuidar el volumen de tokens y dejar
   `retryOnFail` puesto.

6. **En un prompt, el EJEMPLO CONCRETO le gana a la regla abstracta.** Si querés que Franco
   deje de decir algo, no alcanza con prohibirlo: hay que **reemplazar el guion que se lo
   enseña**. Pasó tres veces en un día, siempre igual — el modelo copia lo que más se parece
   a lo que está por escribir, no arbitra entre "regla" y "ejemplo".

   | Bug | Lo que había en el prompt | Lo que Franco hacía |
   |---|---|---|
   | "efectivo" (v16) | `"tu efectivo cubre el total de estas"` como guion | Lo recitaba aunque no hubiera presupuesto |
   | condicionantes (v18→v20→v23) | `"tené en cuenta que la potencia es justa"` como ejemplo | Abría tres de tres respuestas con esa frase |
   | permuta (v25→v26) | `"Me dejás tu nombre y apellido, y qué auto entregarías: marca, modelo, año y km?"` | El formulario de 6 campos, textual |

   En los tres casos se intentó primero una **prohibición arriba del guion** y no funcionó.
   Lo que sí funcionó fue reescribir el guion. Corolario para escribir el fix: si la regla
   nueva no tiene un ejemplo, va a perder contra el ejemplo viejo que quedó abajo.

7. **Antes de culpar al prompt, fijate si la frase la inyecta el código.** El guard de cierre
   de `Armar respuesta` agrega una pregunta comercial y una de sus variantes ofrece un
   asesor. Más de una vez se atribuyó a Franco algo que escribía ese nodo.

```bash
node scripts/state-sync.mjs --check    # verifica las 5 automáticamente
```

---

## La regla del proyecto

> **Todo lo que se pueda calcular determinísticamente va a SQL o código. Solo lo que es
> lenguaje va al prompt.**

Cada vez que se aplicó, el bug murió y no volvió: filtro de precio, categorización
entra/estirar/económica, teléfono con `hashtext`, saludo inicial, cierre comercial, strip de
`¿`/`¡`. Cada vez que se intentó arreglar algo mecánico editando el prompt, apareció el
patrón yo-yo: reforzar una regla aflojaba otra.

**Ante un bug, la primera pregunta no es "cómo reescribo el prompt" sino "¿esto es
determinístico?".**

---

## El método de diagnóstico

En este proyecto, razonar sobre el código produjo **tres hipótesis seguidas equivocadas**
(comillas simples, degradación de temperatura, tamaño de contexto). Las tres cayeron
midiendo. Los cuatro bugs graves eran invisibles leyendo código.

1. Leé el log de ejecución de n8n (`Executions` → el nodo que escribe) antes de teorizar.
2. Escribí un control que aísle **una** variable. Ej: mismo caso con y sin apóstrofe; mismo
   caso aislado y bajo carga.
3. **Nunca "arregles" algo sin haber reproducido el fallo.**
4. Si un síntoma se mueve o es intermitente, sospechá de límites de recursos (TPM,
   conexiones, concurrencia) antes que de lógica.

---

## Cómo se valida

22 evals, línea de base **22/22** (`evals/baseline-v6.json`).

```bash
FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs
```

Opciones: `--case a,b` · `--repeat N` (mide flakiness) · `--delay N` (aísla contención) ·
`--no-cleanup` (deja sesiones para inspeccionar en n8n).

**Reglas, no negociables:**
- Correr antes y después de cada cambio. Sin la corrida previa no hay línea de base.
- **Un cambio por vez.** Si tocás dos cosas y algo se rompe, no sabés cuál fue.
- Un bug nuevo se convierte en caso de eval **antes** de arreglarlo, y **tiene que fallar
  primero**. Si no falla, no entendiste el bug.
- Los checks `manual` no cuentan como falla: imprimen la respuesta para revisión humana.
- Actualizá `docs/franco/STATE.md` como parte del cambio, no después.

---

## Qué no hacer

- No editar el prompt para arreglar algo mecánico (ver la regla del proyecto).
- No activar el header auth de los webhooks sin coordinar: rompe la demo si el frontend no
  manda el header primero. Está desactivado a conciencia — ver `STATE.md`.
- No pisar `franco-n8n-v6.json` (producción) sin avisar. Trabajar sobre una copia versionada.
- No dar algo por resuelto sin haberlo medido.
- No "arreglar" la deuda listada en `STATE.md` sin preguntar: es intencional.
