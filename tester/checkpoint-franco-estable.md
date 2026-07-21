# Checkpoint — Estado estable de Franco (antes del CRM)

Fecha de corte: esta sesión. Este es el estado "que funciona y está probado en vivo" de Franco. Si algo del CRM (o de cualquier cambio futuro) rompe algo, este es el punto al que volver.

---

## 1. Capa de datos (Supabase — tabla `autos_disponibles`)

- **17 autos** vectorizados con el script `revectorizar_con_consumo.py` (versión con fotos en metadata).
- Cada fila tiene:
  - `content`: texto para búsqueda semántica. Incluye el consumo. **NO incluye URLs de fotos** (se sacaron para no ensuciar el embedding).
  - `metadata` (JSON estructurado): id, marca, modelo, año, carroceria, precio, condicion, combustible, transmision, km, consumo, **foto_principal**, **fotos[]** (array de 3).
  - `embedding`: vector de `text-embedding-3-small`.
- Fuente de verdad del stock: `stock.csv` (generado del Excel `Stock_vehículos.xlsx`), con los seminuevos actualizados (Vento 2024, Onix 2024, T-Cross 2025, Ranger 2025, S10 2024).
- **Para actualizar stock:** editar el Excel/CSV → correr `revectorizar_con_consumo.py` (borra y recarga la tabla). El diccionario `CONSUMOS` del script está indexado por ID (1-17); si cambian los IDs, revisar ese diccionario.

## 2. Tool "Listar stock" (nodo Postgres, n8n)

- Operación: Execute Query. Devuelve id, titulo, precio (formateado), foto_principal, carroceria, condicion, anio, km, combustible, consumo.
- **foto_principal sale de `metadata->>'foto_principal'`** (NO del content con split_part — eso era el bug de la foto cruzada).
- Acepta dos parámetros vía `$fromAI`: **precio_min** y **precio_max** (0 = sin límite en ese extremo).
- Ordena por precio ascendente.
- Se usa para: ver todo el stock (min=0, max=0) y para cualquier filtro por precio.

## 3. Tool "Buscar auto" (vector store)

- Búsqueda semántica por características/uso. NO se usa para filtros de precio (eso es "Listar stock").

## 4. Prompt de Franco (`prompt-franco-v3.md`)

Comportamientos clave implementados y probados:
- **Anti-invención** como regla suprema. El consumo SÍ se puede dar (viene en la ficha); otras specs no.
- **Interpretación de presupuesto:** rango centrado (~20% abajo, ~15-20% arriba) para montos aproximados; rango cerrado y techo se traducen a precio_min/precio_max.
- **Filtro de precio:** siempre estira el precio_max +25% para poder ver y ofrecer opciones de arriba.
- **Enfoque comercial (MEDIO), obligatorio al filtrar por precio:** muestra lo que entra → tienta con 1-2 de arriba → gancho de pago OBLIGATORIO (financiación/permuta aplica a CUALQUIER auto, no solo los caros) → ofrece ver todo el stock. Excepción: si el cliente dice que el precio es límite firme, no ofrece de arriba.
- **Saludo:** siempre en la primera respuesta de la conversación, aunque el primer mensaje ya traiga consulta. No vuelve a saludar después.
- **Burbujas:** hasta 5 (subido de 3 para no comprimir la estructura comercial).
- **Fotos/cards:** URLs solo en images (detalle) o foto_principal (card), nunca en content.
- **Cierre:** sin agenda de turnos; deriva a asesor por WhatsApp + da dirección y horario.

## 5. Frontend (React en Render)

- **Cards con placeholder prolijo** en vez de ícono roto (fix aplicado por Claude Code).
- **Renderiza más de 3 burbujas** sin problema (confirmado en vivo con respuestas de 5 burbujas).
- **Pendiente / a confirmar:** el fix del lazy-load en carrusel horizontal (`prompt-claude-code-fix-lazyload.md`) para que las cards fuera del viewport inicial carguen su foto. Estado: en verificación.

## 6. Bugs resueltos esta sesión (para no repisarlos)

1. Franco decía "lo más accesible arranca en 18M" ignorando autos más baratos → arreglado (interpretación de presupuesto).
2. Franco negaba tener autos en un rango que sí existía → arreglado (filtro SQL por precio en vez de vectorial).
3. Card de la T-Cross mostraba foto de otro auto → arreglado (foto desde metadata).
4. Contradicción: anti-invención prohibía dar "consumo" pero el flujo lo pedía → arreglado.
5. Franco mostraba opciones de arriba sin gancho de pago → arreglado (burbuja B obligatoria).
6. Gancho de pago parecía aplicar solo a los autos caros → arreglado (aplica a todos).
7. Fotos de cards fuera del viewport no cargaban → fix de lazy-load en verificación.

## 7. Frente siguiente: CRM (no empezado)

Lo que sigue. Arquitectura objetivo (del contexto del proyecto): detector de info nueva (LLM chico) → agente CRM condicional → Google Sheets, con estados de temperatura reversibles, filtrado por sesiones visibles. Se aborda desde cero en la próxima etapa.
