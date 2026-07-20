# Prompt para Claude Code — montar el sistema de contexto permanente de Franco

> Copiá todo lo que sigue y pasáselo a Claude Code.

---

Quiero que cualquier sesión de Claude Code sobre este proyecto arranque sabiendo
exactamente en qué estado está la demo de Franco, sin que yo tenga que explicárselo.
Necesito que montes ese sistema.

## Lo que hay que entender primero

Un subagente **no** se carga solo: se invoca explícitamente. Lo que sí se lee en **cada**
sesión, automáticamente, es `CLAUDE.md`. Así que la solución no es solo un agente — son
tres piezas que trabajan juntas:

| pieza | cuándo actúa | para qué |
|---|---|---|
| `CLAUDE.md` | **siempre**, cada sesión | contexto mínimo + las trampas que no se pueden redescubrir |
| `docs/franco/STATE.md` | leído a demanda | qué está desplegado hoy, qué falta, qué se decidió |
| `.claude/agents/franco-engineer.md` | invocado para tareas de backend | el especialista en n8n/SQL/prompt |

Y una disciplina: **el estado se actualiza como parte del cambio, no después.** Un
documento de estado que se actualiza "cuando me acuerdo" miente, y mentir sobre el estado es
peor que no tenerlo — ya pasó en este proyecto y costó un diagnóstico equivocado.

## Fuentes

Leé todo esto antes de escribir nada:

- `auditoria/AUDITORIA-FRANCO.md` — 21 hallazgos, IDs C1–C5 / A1–A4 / M1–M7
- `auditoria/CHANGELOG-v6.md` — qué se arregló y por qué
- `auditoria/C5-runbook.md` y `auditoria/C5-para-claude-code.md` — seguridad
- `evals/README.md` y `evals/cases.json` — los 22 tests
- `franco-n8n-v6.json` — el workflow en producción (35 nodos)
- `frontend/` — React + Express en Render

---

## 1. `CLAUDE.md` en la raíz

Corto y de alta densidad. Es lo único garantizado en cada sesión, así que no lo llenes de
relleno. Tiene que cubrir:

**Qué es Franco.** Agente vendedor de autos para concesionarias, en demo. Se vende e
implementa en varias concesionarias, así que la configurabilidad es requisito de negocio.
Backend n8n, frontend React/Express en Render, datos en Supabase/Postgres
(`autos_disponibles`, `crm_leads`, `n8n_chat_histories`, `mensajes_demo`).

**Las cinco trampas de n8n.** Cada una costó semanas de diagnóstico equivocado:

1. Un campo solo se evalúa como expresión si arranca con `=`. El `systemMessage` no lo
   tenía y sus 18 expresiones eran texto literal: el agente nunca recibió los datos de
   empresa ni la FAQ. Se atribuyó a "alucinación" durante meses.
2. `queryReplacement` parte el string por comas. Usar **siempre** la forma array
   `={{ [ v1, v2 ] }}`. Un mensaje con coma rompía el INSERT y se perdían leads.
3. `$fromAI` con la misma key necesita descripción y tipo byte-idénticos en todas sus
   ocurrencias.
4. Todo nodo Postgres en la cadena principal debe devolver ≥1 fila o corta el flujo
   (`FROM (SELECT 1) LEFT JOIN`, o `alwaysOutputData`).
5. `gpt-4.1` tiene 30.000 TPM. Mandarle JSON crudo con URLs al agente CRM lo reventaba y se
   perdían leads al azar.

**La regla del proyecto.** Todo lo determinístico va a SQL o código; solo el lenguaje va al
prompt. Cada vez que se aplicó, el bug murió. Cada vez que se intentó arreglar algo mecánico
con el prompt, apareció el patrón yo-yo.

**Cómo se valida.** 22 evals, línea de base 22/22:
```bash
FRANCO_URL=https://n8n.utopiaflow.tech node evals/run.mjs
```
Reglas: correr antes y después de cada cambio; un cambio por vez; un bug nuevo se convierte
en caso de eval **antes** de arreglarlo, y tiene que fallar primero.

**El método de diagnóstico.** En este proyecto, razonar sobre el código produjo tres
hipótesis seguidas equivocadas (comillas simples, degradación de temperatura, tamaño de
contexto). Las tres cayeron midiendo. Ante un síntoma: leé el log de ejecución de n8n,
escribí un control que aísle una variable, y recién después teorizá. **Nunca "arreglar" algo
sin haber reproducido el fallo.**

---

## 2. `docs/franco/STATE.md`

El estado real, siempre actualizado. Secciones:

- **Desplegado hoy** — archivo de workflow en producción, cantidad de nodos, última
  importación, resultado de la última corrida de evals con fecha
- **Cerrado** — hallazgos resueltos por ID, con una línea de qué se hizo
- **Abierto** — por prioridad, con por qué importa
- **Decisiones tomadas** — con fecha y motivo, para que nadie las re-proponga como
  pendientes. Ej: *"header auth desactivado a conciencia el 2026-07-19; revisar cuando entre
  el primer dato de un cliente real"*
- **Deuda conocida** — cosas que se rompieron a propósito y no hay que "arreglar" sin
  avisar. Ej: el guard de cierre comercial gana piso y pierde techo
- **Incertidumbres** — cosas que no se pudieron verificar. Ej: si `metadata->'fotos'` existe
  como array

Poblalo con el estado real de hoy, sacándolo de los archivos de `auditoria/`.

---

## 3. `.claude/agents/franco-engineer.md`

Subagente para trabajo de backend (n8n, SQL, prompt). En el frontmatter, una `description`
que dispare cuando la tarea toque el workflow, las queries, el prompt de Franco o el CRM.

Su procedimiento:
1. Leer `docs/franco/STATE.md` antes de proponer nada
2. Correr los evals para tener línea de base
3. Si es un bug: reproducirlo con un caso de eval **antes** de tocar código
4. Un cambio por vez, evals entre cada uno
5. Verificar las 5 trampas cuando corresponda (¿el campo arranca con `=`? ¿queryReplacement
   en forma array? ¿el nodo devuelve siempre una fila?)
6. Actualizar `STATE.md` como parte del cambio
7. Reportar qué se midió, no qué se supone

Debe tener explícito qué **no** hacer: no editar el prompt para arreglar algo mecánico, no
activar el header auth sin coordinar, no pisar `franco-n8n-v6.json` sin avisar, no dar por
resuelto algo sin haberlo medido.

---

## 4. Que el estado no se desactualice

El riesgo real es que `STATE.md` quede viejo. Proponé el mecanismo más simple que funcione y
explicame el trade-off — puede ser un hook de Claude Code que recuerde actualizarlo al
terminar una tarea, un ítem en el procedimiento del agente, o un script que lea el JSON del
workflow y regenere la sección de "desplegado hoy" automáticamente.

**Preferí lo que se automatice sobre lo que dependa de acordarse.** En este proyecto ya hubo
drift entre los `.md` del prompt y el `systemMessage` real del workflow, y llevó a
diagnosticar sobre un estado que no era el de producción.

---

## Al terminar

Mostrame los archivos creados y explicame en tres líneas cómo debería usarlos en el día a
día: qué se carga solo, qué tengo que invocar, y qué tengo que actualizar yo.
