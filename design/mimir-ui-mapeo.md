# Mímir en LibreSesh — mapeo UI/UX

> **Estatus:** `candidato` · Compañero de `mimir-en-libresesh.md` (el QUÉ) — este
> documento es el CÓMO se muestra. Antes de escribir código.
> Sistema existente: React 18 + Tailwind, paleta `stone` oscura, acento ámbar
> (= "ahora"/tiempo), mobile-first, primitivos en `web/src/components/ui.tsx`.

## 0 · Fundamento — la identidad visual de Mímir ES una regla ética

**Arquetipo: Sabio + Ermitaño** (el consejero con linterna: ilumina, no deslumbra;
aconseja, no conduce). De ahí las tres decisiones raíz:

1. **Color propio e inconfundible.** Todo lo que emite Mímir usa una familia de color
   que NADA más usa en la app: **índigo/violeta** (`indigo-400/500` sobre stone).
   No es estética: es la transparencia A1a hecha token — el usuario sabe *siempre*,
   con visión periférica, cuándo habla con la IA y cuándo con la herramienta.
   - Ámbar = tiempo/ahora (ya establecido). Índigo = Mímir. No se mezclan jamás.
2. **Mímir nunca ocupa el centro.** Vive en superficies laterales/inferiores
   (drawer, bottom-sheet, badges) — la agenda del grupo es la protagonista.
   Rams: *tan poco diseño como sea posible*; doctrinal: el asistente no recibe el rol.
3. **Firma visible en cada emisión**: chip `◆ Mímir · propuesta` en cada mensaje,
   tarjeta o aviso. Lo que decide el humano se muestra sin chip. La atribución
   nunca es ambigua.

## 0b · Regla de integración: COMPLEMENTAR, NO MODIFICAR
*(Decisión del facilitador, 2026-09-01: LibreSesh es el proyecto de otros —
se respeta su organización.)*

Todo lo de Mímir es **aditivo y auto-contenido**: pestaña propia, badges que
solo aparecen si se usan, capas activables (ritmo) apagadas por defecto para
quien no las quiere. **El orden del frontend original no se toca**: ninguna
vista existente se reestructura, ningún flujo actual cambia de sitio. Un
usuario que ignore a Mímir ve el LibreSesh de siempre. Esto además facilita
convivir con el upstream y devolverles algo si algún día lo quieren.

## 1 · Doctrina → leyes de UX (el mapeo que lo ordena todo)

| Regla del corpus | Ley de UX en LibreSesh |
|---|---|
| Señalar, no decidir | **Avisa, nunca bloquea**: ningún aviso de Mímir impide guardar/enviar. Severidad = color+icono, no modales |
| El instrumento muestra su estado | Todo wizard con progreso ✅/⏳ persistente; se retoma donde se dejó |
| El ENVÍO inconfundible | El paso final del wizard tiene botón único de alto contraste + aviso "sin enviar" si se abandona |
| Escenarios, no taxonomías | Las preguntas del wizard son concretas ("¿quién abre tu sesión ese día?"), nunca (a)/(b)/(c) abstractas |
| Una elección no se dibuja como paso | En el grid, los momentos de decisión llevan glifo ◇ de bifurcación con sus salidas — nunca casilla normal de agenda |
| Abanico con condición de descarte | Las opciones de Mímir se presentan en cartas comparables, cada una con su línea "descarta si…" visible sin interacción |
| Lengua del destinatario | Microcopy en llano; la jerga (campo, rango, B2…) solo en tooltips "¿por qué?" opcionales |
| Advertencia pegada al nombre | En el catálogo, el aviso de seguridad va DENTRO de la tarjeta, junto al título — no en detalle |

## 2 · Mapa de integración por superficie

### 2.1 Punto de entrada — pestaña propia
*(Decisión del facilitador, 2026-09-01: Mímir tiene su pestaña, el resto del
frontend no cambia.)*
- **`◆ Mímir` es una pestaña más** junto a Grid · List · Pitches — mismo patrón
  de chips que ya existe. En índigo, para que se distinga de las vistas de agenda.
- **Móvil:** la misma pestaña; nunca FAB flotante sobre la agenda.

### 2.2 La pestaña Mímir (hub, contenido según rol)
Dos columnas (una en móvil):
1. **Empezar algo nuevo** — bifurcación explícita con dos tarjetas grandes:
   🎤 **Diseñar una sesión** (asistente/proponente/admin) · 🗺 **Proceso del
   evento** (solo admin). La tarjeta que el rol no tiene NO se muestra
   (no disabled: lo que no puedes usar no existe — menos ruido).
2. **Herramientas** — grid según permiso: Catálogo · Decisiones · Ritmo · Cosecha.
3. **Mis procesos** — tarjetas de procesos abiertos con estado ⏳/✅ y su chat.
   Cada tarjeta lleva **botón Compartir** (enlace/código de invitación) y, si es
   compartido, los **chips de participantes** + el **chip del acuerdo de
   trabajo** elegido ("acuerdo: consenso a dos ✓"), clicable para renegociar.
   Al unirse alguien, el primer mensaje de Mímir en el chat compartido es el
   contrato de colaboración (cómo os organizáis → abanico de acuerdos → eligen
   los humanos). Las decisiones registradas muestran SIEMPRE quién las tomó.
4. **Fuentes del proceso** — zona de soltar/subir + botón 🎙 grabar (clave en
   móvil: la conversación de pasillo se captura donde ocurre). Tarjetas de
   fuente con estado (⏳ transcribiendo → ✓ analizada) y tipo de análisis:
   audio → transcripción con hablantes INFERIDOS marcados visualmente;
   acta → espejo despersonalizado; propuesta → lista de supuestos. El análisis
   siempre enlaza a su fuente y lleva etiqueta de estatus.
5. **Estado del evento** (solo organizador): avisos de ritmo + espejo/cosecha.

### 2.3 La entrevista — ADAPTATIVA, no cuestionario fijo
*(Decisión del facilitador, 2026-09-01.)*
- **Arranca en abierto**: "Cuéntame en resumen qué quieres hacer en tu sesión"
  (textarea libre) + opción de **adjuntar documentación** (notas, doc, enlace).
- **Mímir genera las preguntas desde el resumen y los documentos**: marca lo que
  ya detectó (✓ propósito, ✓ contexto…) y pregunta SOLO lo que falta — es la
  regla de instrumento "lo ya sabido no se re-pregunta" hecha flujo.
- Se presenta **como chat guiado**, no como form: una pregunta por pantalla,
  respuesta abajo (input o cartas de opción). Misma superficie que el chat
  Mímir → un solo modelo mental que aprender.
- Barra de progreso ("Resumen → Preguntas → Formato → Tiempo"), clicable hacia
  atrás, estado persistente.
- **Filtro A2 con dignidad**: si el propósito no sale, la salida no es error rojo;
  es Mímir diciendo "sin propósito claro, la doctrina sugiere no reservar sala aún
  — ¿lo aparcamos como inquietud en Pitches?" → convierte el fallo en acción.
- Resultado: **borrador de sesión** precargado en el SessionModal existente
  (el wizard desemboca en el flujo que ya existe, no lo duplica).

### 2.4 Chequeo de ritmo — capa sobre el grid existente
- **Chip toggle "Ritmo ◆"** junto a Rooms/Tracks/Pitches. Apagado por defecto
  para asistentes; encendido por defecto para organizador.
- Encendido, pinta **debajo** de las sesiones (underlay, no encima):
  - Bloque >90 sin pausa → borde inferior ondulado índigo + icono ⏸ sutil.
  - Decisión en franja de agotamiento → glifo ◇ con halo de aviso.
  - Cambio brusco cabeza→corazón→pies → junta entre sesiones marcada.
- Tap en cualquier marca → popover: **qué + por qué (una frase) + fuente de la
  regla** + botón "ignorar este aviso" (señalar, no decidir: se puede descartar,
  y el descarte queda visible solo para el organizador).

### 2.5 Fases de decisión — en Pitches y en el grid
- **ProposalBoard** gana columnas/filtro por fase: Inquietud → Indagación →
  Propuesta → Decisión. Mover de fase = drag (móvil: menú). Cada fase con icono
  propio (💭 🔍 📋 ◇) y color de intensidad creciente dentro de stone.
- Al pasar a **Propuesta**, el modal exige formato Briggs (título sin promotor,
  3 pros / 3 contras, alternativas, fecha de revisión) — campos con placeholder
  educativo, no validación agresiva.
- En el **grid**, una sesión de tipo decisión se dibuja con el glifo ◇ y muestra
  sus salidas posibles en el DetailSheet ("puede salir: aprobada / aparcada /
  a más indagación / nada").

### 2.6 Catálogo de dinámicas — galería con cuerpo
- Tarjetas: **nombre + advertencia de seguridad juntos** (regla), fin en una
  frase, chips de metadatos: 👥 tamaño · ⚡/🌊 energía (activa/profunda) ·
  ⏱ duración · momento de curva.
- Filtros arriba como chips (mismo patrón que Rooms/Tracks): por movimiento,
  tamaño del grupo, energía, duración.
- Desde una sesión en diseño, Mímir ofrece **abanico**: 3-4 tarjetas en fila
  comparable, cada una con su "descarta si…" en la base de la tarjeta.
- **Estado vacío = hueco declarado, diseñado**: ilustración de linterna apagada +
  "El catálogo se llena con las dinámicas que vuelca el facilitador. Mímir no lo
  rellena con genéricas." — el principio ético como copy de empty state.

### 2.7 Chat por proceso
- Burbujas de Mímir SIEMPRE con chip `◆ Mímir · propuesta`; acciones sugeridas
  como cartas dentro del chat (aplicar → abre el modal correspondiente
  precargado; nunca se aplica solo).
- **Modo sesión-en-curso**: si el proceso está en su franja horaria, el input
  se sustituye por banner: "Sesión en curso — la conducción no se asiste en
  directo. Esto se retoma al cierre." (D12 hecho interfaz).
- **Deflexión F13**: cuando Mímir deflecta, el mensaje lleva estilo propio
  (borde cálido, no error): "esto merece un humano" + a quién acudir según el
  evento. Nada de esa conversación se guarda — y el chat LO DICE.

## 3 · Jerarquía y tokens

- **Base:** todo hereda de `ui.tsx` — no se inventan primitivos nuevos si existe
  uno (Button, Sheet, Chip, Modal). Mímir es una *voz* dentro del sistema, no
  otro sistema.
- **Tokens nuevos (únicos):**
  - `mimir` (índigo): `text-indigo-300/400`, `border-indigo-500/30`,
    `bg-indigo-950/40` — siempre translúcido sobre stone, nunca planos saturados.
  - Glifo ◆ (Mímir) y ◇ (decisión) como iconografía propia, 2 símbolos, no más.
- **Tipografía:** la escala existente. Mímir no habla en mayúsculas ni en negrita:
  peso normal, tamaño base — el consejero no alza la voz.
- **Movimiento:** entradas de drawer/sheet con transición corta (150-200ms);
  `prefers-reduced-motion` respetado; ninguna animación en avisos de ritmo
  (un aviso que parpadea es un aviso que decide por ti).

## 4 · Accesibilidad (no negociable)

- Contraste AA mínimo en índigo sobre stone (verificar `indigo-300` sobre
  `stone-900` ≈ 8:1 ✅; nunca `indigo-500` como color de texto).
- Wizard y chat 100% teclado; foco gestionado al abrir drawer (trap + retorno).
- Avisos de ritmo: `aria-describedby` en la sesión, no solo color (glifo + texto).
- Chat: `aria-live="polite"` para mensajes de Mímir; roles de landmark en drawer.
- Estados solo-color prohibidos: fase, energía y avisos llevan siempre icono+texto.

## 5 · Móvil primero (donde vive el grupo)

- Drawer → bottom-sheet a media altura, expandible; se cierra con gesto.
- Wizard: una pregunta por pantalla es AÚN más importante aquí.
- Avisos de ritmo en móvil: colapsados a un contador en el chip "Ritmo ◆ (3)";
  el underlay detallado es de desktop/tablet.
- Tarjetas de catálogo: carrusel horizontal con snap, no grid apretado.

## 6 · Orden de construcción (cruza con fases del spec QUÉ)

| Pieza | Toca | Nuevo |
|---|---|---|
| v1a Fases en pitches | ProposalBoard, ProposalModal | iconos fase, campo `phase` |
| v1b Chequeo de ritmo | SchedulePage/Calendar | chip toggle, underlays, popover |
| v1c Wizard sesión (sin IA) | + SessionModal (desemboca) | pantalla conversacional |
| v2 Drawer + chat organizador | DetailSheet como base | MimirDrawer, MimirChat |
| v3 Matriz por rol + catálogo | Gate/permisos existentes | galería dinámicas |

Cada pieza es útil sola; ninguna depende de la siguiente (complejidad progresiva).
