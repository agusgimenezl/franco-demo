# Prompt de arranque — próxima sesión

Pegar tal cual al abrir la sesión nueva.

---

Proyecto Franco (agente vendedor de autos, n8n + Supabase + React).

Antes de proponer nada: leé `CLAUDE.md` y después `docs/franco/STATE.md`. Las entradas de arriba de
todo son de la sesión del **2026-08-11** (v127 → v133 + la copy). **Hay entradas viejas marcadas con
❌ o ⚠️ porque quedaron corregidas: no las leas como verdad.**

## ESTADO ACTUAL

- **En producción: v133** (`workflows/franco-n8n-v133.json`), 35 nodos, **6** invariantes.
  El puntero es la constante `PRODUCCION` en `scripts/state-sync.mjs`, en una línea propia.
- **Evals: 93 casos.** Branch `fixes/historial-color-fotos`, **~58 commits SIN PUSHEAR**.
- **SUPABASE POR MCP** (project `qfmsdgjtlduravrtqrif`). Usalo siempre.
- **El deploy lo hace Agustina por UI.** Nunca por MCP `update_workflow`.
- **`--delay 45000`.** El eval sale con exit code != 0 en Windows por un assert de libuv:
  **no encadenes dos corridas con `&&`**, usá `;`.
- **Backups de stock:** `autos_disponibles_backup_20260811` (previo a la copy de hoy) y
  `autos_disponibles_backup_20260810` (previo a la migración).
- **Líneas de base guardadas:** `evals/baseline-v131.json`, `-v132.json`, `-v133.json`,
  `evals/copy-postcambio.json`.

## LO QUE SE CONSTRUYÓ HOY Y HAY QUE USAR (no volver a inventarlo)

1. **COMPUERTA DE PRE-DEPLOY** (`state-sync.mjs`): con `--file`, si el candidato es una versión
   mayor que producción, **exige `evals/baseline-<produccion>.json` con AL MENOS 2 casos**. Sin eso
   no aprueba. Nació porque la regla escrita falló dos veces el mismo día.
2. **INVARIANTE 6**: verifica que las inyecciones determinísticas ya medidas sigan en el workflow.
   Nació porque el fix de v75 **se perdió en v77 y nadie lo notó durante 53 versiones**.
3. **`no_vocabulario_interno`** en `ALWAYS`: caza etiquetas internas (`entra`/`estirar`/`economica`,
   `tamano` crudo) filtradas al cliente. Probado 32/32 contra 2701 sesiones, 0 falsos positivos.
4. **`no_nombre_inventado`** en `ALWAYS`: caza que Franco nombre a un cliente que nunca se presentó.
   Usa `dichoPorCliente`, que `run.mjs` acumula por corrida. Probado 15/15. **Cazó un bug real en
   producción una hora después de escribirse.**
5. **Dato operativo:** con `> archivo.log` la salida del eval **se ve mientras corre**; lo que
   buferea es el pipe (`| head`). Sirve para distinguir una tanda colgada de una lenta.

## LO QUE SE CERRÓ, TODO MEDIDO

| versión | qué cerró | evidencia |
|---|---|---|
| v127 | el corrector de precios ya no pisa el anticipo mínimo | caso **0/3 → 3/3**, 3 controles 3/3 |
| v128 | las cuotas se contestan con el PORQUÉ | caso **0/5 → 5/5** (y rompió un control, ver v129) |
| v129 | el porqué no se come el pedido de anticipo | `financiacion-pide-anticipo` **0/3 → 3/3** |
| v130 | el guion de derivación no lleva nombre propio literal | **0 nombres inventados en 12 corridas** |
| v131 | **restaura el name-ask determinístico perdido en v77** | el caso deja de estar ciego |
| v132 | ninguna plantilla de SALIDA lleva nombre propio | nombres en el prompt **5 → 2**, 0 plantillas |
| v133 | el guion del techo no re-ofrece un asesor ya aceptado | `derivacion-aceptada` **1/3 → 3/3** tras 5 versiones en rojo; el check de re-ofrecer pasó de **3 → 0** |
| copy | 12 frases amoldadas a la ficha | verificado clave por clave contra el backup: 12 diferencias, `content` intacto |

## LAS LECCIONES QUE COSTARON VERSIONES (leer antes de tocar el prompt)

1. **UN EJEMPLO NUEVO LE GANA A UNA REGLA VIEJA QUE ESTÁ TRES RENGLONES ABAJO.** v128 metió "si
   preguntó por un plazo, contestá antes de pedir nada" dentro del guion del name-ask y se comió la
   regla de DATO INCOMPLETO. **Cuando agregues un ejemplo, preguntate a qué regla le gana.**
2. **Y TAMBIÉN: A QUÉ OTRO EJEMPLO SE LO HACÉS PARECER.** El guion con el nombre de ejemplo existía
   hace meses y nunca se copiaba; v128 le agregó el porqué, lo volvió más atractivo para el tema
   "cuotas", y el modelo empezó a elegir **esa rama** con el nombre puesto. **Mejorar un guion es
   hacerlo más elegible.**
3. **EJEMPLO DE ENTRADA ≠ EJEMPLO DE SALIDA.** *"Si te dice X"* es información; *"le contestás X"*
   es una **plantilla**, y el modelo copia plantillas. Borrá las de salida, conservá las de entrada.
4. **UN FIX QUE SE PUEDE PERDER EN SILENCIO SE VA A PERDER.** El de v75 estuvo ausente 53 versiones
   y el caso se trató como "flaky" todo ese tiempo. Por eso existe el invariante 6.
5. **EL PRIOR DEL MODELO LE GANA AL DATO.** Se borró *"la potencia es justa"* de la base y Franco la
   sigue diciendo del Duster (que tiene 155 CV y es la SUV más potente del stock). Sacar el insumo
   (v124) funciona contra un guion del prompt; **no contra lo que el modelo ya cree.**
6. **TRAMPA 7, TRES VECES EN UN DÍA.** Antes de culpar al modelo, fijate si la frase la escribe el
   código. v133 salió de encontrar la respuesta que fallaba **escrita textual** en una inyección.
7. **UNA FIRMA QUE NO ES ÚNICA NO ES UNA FIRMA** — ahora también para la copy: el condicionante
   nuevo del Duster salió casi calcado del Corolla y hubo que diferenciarlo.
8. **`UPDATE ... FROM` APLICA UNA SOLA FILA DE ORIGEN** cuando varias matchean el mismo destino.
   12 intentos → 10 filas. Se cazó **porque el script comparaba el conteo esperado contra el real**.
9. **ANTES DE TOCAR UN DATO, MIRAR SI LOS CHECKS LO EXIGEN**, no sólo si lo mencionan. Se dijo que
   `justa` estaba "siempre como prohibición" y en un caso era un `text_matches`: se rompió.

## LOS PENDIENTES, EN ORDEN

### 0. `condicionante-si-preguntan` — 1/3. Es el único con cara de cliente.
De 3 corridas: 1 da el condicionante real, 1 **inventa** *"la potencia es justa"* (contradice la
ficha) y 1 **esquiva** (*"eso te lo confirma un asesor"*), que es justo lo que el caso existe para
impedir. **Diagnóstico ya hecho: el dato LE LLEGA** (`condicionantes` está fuera del bloque de
supresión de v119, y una corrida lo reprodujo casi textual). **Es adherencia, no disponibilidad.**
**Fix propuesto:** inyección determinística con el condicionante real como texto a decir cuando
preguntan por los contras — mismo patrón que resolvió v133. Sería **v134**.

### 1. Extender la compuerta de pre-deploy a CAMBIOS DE DATOS
Hoy sólo cubre versiones del workflow. La copy se aplicó sin línea de base previa y por eso dos
casos quedaron sin atribuir. **Es el hueco que este episodio dejó a la vista.**

### 2. Dos casos sin atribuir
`no-repite-la-ficha` **0/3** (pide `2018`) y `la-ficha-que-no-se-dio-no-esta-dada` **1/3** (pide
`116`). Estaban **3/3 sobre v126** esta mañana, pero entre medio pasaron 7 versiones de prompt Y la
copy. **Franco contesta bien en los dos**; son checks que exigen un token puntual. Para atribuir:
restaurar la copy vieja desde `autos_disponibles_backup_20260811` unos minutos y repetir.

### 3. `no-repreguntar-asesor` — 0/3, con raíz propia ya documentada
`Leer lead (estado)` **no trae la columna `estado`**, así que `estado_cliente` nunca le dice a Franco
que el lead ya está en "Requiere asesor". Además falla el consumo (`6,8`) en el turno 2. Tiene línea
de base (`baseline-v131.json`, 1/3; v132/v133 0/3). **Va aparte y el fix es en `Config`.**

### 4. `descripcion-que-aporta` perdió el filo
Su check `text_not_matches \bjusta\b` se diseñó alrededor de la frase del Duster, que ya no existe:
ahora pasa trivialmente. **Darle un objetivo nuevo o sacarlo.**

### 5. La línea 9 del prompt
Cuando el cliente YA dio su nombre corre un guion propio que declara mandar sobre todos los de abajo
y **no lleva el porqué de las cuotas**. Mismo bug que cerró v128, otra rama. **Sin caso de eval.**

### 6. Fuga de vocabulario interno — centinela armado, bug SIN REPRODUCIR
0 en 18 corridas. **No está cerrado: está sin reproducir.** El check en `ALWAYS` lo va a cazar
cuando aparezca. No arranques por acá salvo que se ponga rojo.

### 7. Los de siempre, que siguen abiertos
`detalle-un-auto-fotos` flaky ~1 de 7 · el gate de km (desde v45) · **v112 y v114 desplegados y
nunca ejercitados** · la deuda de leer la salida de un nodo TOOL desde `Armar respuesta` (el
centinela de v102 es código inerte) · **el guardia de deploy nunca corrió con `N8N_API_KEY`**.

### 8. Chip pendiente y push
Validar los patrones de `cases.json` al arrancar la tanda (un regex roto se lee como bug de Franco;
hoy los 249 están sanos). Y **~58 commits sin pushear**.

## REGLAS QUE NO SE NEGOCIAN

- Un bug nuevo se convierte en caso de eval ANTES de arreglarlo, **y tiene que fallar primero**. Si
  no falla, **decilo en vez de inventar una falla**.
- **Línea de base del caso Y DE LOS CONTROLES**, sobre la versión viva, antes de desplegar. La
  compuerta lo exige, pero entenderlo importa: sin "antes" no se puede atribuir nada.
- Un cambio por vez. **Nunca correr evals mientras se toca la base, `cases.json` o `run.mjs`.**
- **Antes de desplegar SQL o una expresión: renderizarla y EJECUTARLA.** No alcanza con asserts de
  string. Los scripts de v131/v133 evalúan las ramas de verdad; copiá ese patrón.
- **Declarar la señal ANTES de medir**, no después. En v130 y v133 eso fue lo que permitió leer el
  resultado sin acomodarlo.
- Nunca dar algo por resuelto sin haberlo medido, **y decir explícitamente qué quedó sin medir**.
- **LEER EL LOG DE n8n ANTES DE TEORIZAR**, y comparar `Franco (AI Agent)` contra `Armar respuesta`
  en la MISMA ejecución.
- No pisar el workflow de producción: copia nueva en `workflows/`, con un script en `scripts/` que
  aplique el cambio **con aserciones** (incluida una que verifique que el texto viejo YA NO ESTÁ).
- Actualizar `docs/franco/STATE.md` como parte del cambio, no después.
- **Verificar el puntero DESPUÉS de cada deploy** y mirar el encabezado regenerado.
- **Si te equivocaste y quedó escrito en STATE, corregilo ahí mismo y dejá marcada la entrada vieja.**
