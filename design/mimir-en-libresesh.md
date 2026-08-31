# Mímir en LibreSesh — spec de diseño

> **Estatus:** `candidato` — arquitectura propuesta por Mímir (v3) a partir de los
> requisitos volcados por el facilitador el 2026-08-31/09-01. Nada de esto está
> practicado en campo. La última palabra de diseño es del facilitador.
>
> **Regla de contenido (dura):** la doctrina de facilitación que este sistema sirve
> proviene del corpus del facilitador (núcleo v3 de Mímir). Los HUECOS se declaran,
> no se rellenan con facilitación genérica. Marcados abajo como 🔴 HUECO.

## Visión

LibreSesh es la capa **ejecutiva** (agenda, salas, roles, propuestas). Mímir añade la
capa de **oficio**: conciencia de proceso, voces, decisiones, ritmo. La partición
doctrinal: LibreSesh = estructura · Mímir = servicio al campo. Mímir **señala, nunca
decide**; la conducción en directo jamás se delega (D12).

## 1 · El área Mímir en el frontend (por usuario)

Nueva sección `/e/:slug/mimir` — visible para todos los roles, con contenido
**recortado por permiso** (la matriz del §2). Contiene:

- **Mis procesos** — lista de procesos/sesiones que el usuario tiene abiertos con
  Mímir, cada uno con su chat propio (§4) y su estado visible (✅ respondido /
  ⏳ pendiente — regla E: el instrumento muestra su estado).
- **Menú de herramientas** (según rol):
  - 🎤 **Entrevista de prediseño** (§3) — la pieza central.
  - 🧩 **"¿Sesión o proceso de evento?"** — bifurcación de entrada: una sesión
    puntual (proponente) o el proceso completo del evento (organizador). El permiso
    decide qué rama se ofrece.
  - 🎲 **Catálogo visual de dinámicas** (§5) — abanico, elige el humano.
  - ⚖️ **Sistemas de toma de decisión** (§6).
  - ⏱️ **Chequeo de horarios y ritmo** (§7).
  - 🗺️ **Infografías del proceso** (§8).

## 2 · Matriz de permisos (rol × capacidad)

| Capacidad | Viewer | Asistente | Proponente* | Organizador |
|---|---|---|---|---|
| Ayuda de lectura / señalización | ✅ | ✅ | ✅ | ✅ |
| Wizard "diseña tu sesión" | — | ✅ (al proponer) | ✅ | ✅ |
| Entrevista de prediseño del EVENTO | — | — | — | ✅ |
| Catálogo de dinámicas (ver) | — | ✅ | ✅ | ✅ |
| Abanicos de dinámicas con descarte | — | — | su sesión | ✅ |
| Sistemas de decisión (configurar) | — | — | — | ✅ |
| Chequeo de ritmo sobre agenda | — | — | su sesión | ✅ |
| Espejo despersonalizado / cosecha | — | — | — | ✅ |
| Chat Mímir por proceso | — | ✅ (acotado) | ✅ | ✅ completo |

\* Proponente = asistente que tiene una sesión propuesta (dueño de su tramo).

**Reglas transversales del chat, cualquier rol:**
- **Deflexión F13**: si la conversación deriva a confidencia o conflicto entre
  personas → Mímir nombra que eso va a un humano, no lo trabaja, no lo almacena.
- **Ética de memoria**: memoria de proceso, no de personas. «N. dijo X» es dato;
  «N. es dominante» no se guarda.
- **Modo sesión-en-curso**: durante el horario de una sesión, su chat difiere las
  peticiones de conducción («esto se trabaja después del cierre») — D12, no
  feedback en caliente.
- **Firma**: toda salida de Mímir va marcada como propuesta (`candidato`), con la
  decisión humana visible como tal.

## 3 · La entrevista — la pieza que hay que hacer BIEN

Dos ramas, mismo motor:

**Entrada común (decisión del facilitador, 2026-09-01): entrevista ADAPTATIVA.**
Paso 0: "Cuéntame en resumen qué quieres hacer" (texto libre) + opción de
adjuntar documentación. Mímir extrae lo que ya está (✓ propósito, ✓ contexto…)
y genera preguntas SOLO para lo que falta — regla "lo ya sabido no se
re-pregunta". El material adjunto entra con las reglas anti-ancla (§Entrada de
material preparado del corpus).

**Rama sesión (proponente)** — los 4 elementos a cubrir (preguntados solo si
no salieron del resumen):
1. **Propósito** (A2): *«si no puedes definir el propósito, cancélala»* — filtro 1.
2. **El movimiento** (B1): qué tiene que pasar, en una frase, sin nombrar técnica.
3. **Formato** (B2): ¿cómo participa quien no habla fácil? — abanico con descarte.
4. **Tiempo y límites** (B4): duración real, corte a los 90, hora de fin escrita.

**Rama evento (organizador)** — Loop A completo:
A1 contratar (¿quién encarga, qué persigue, qué queda fuera?) · A2 propósito ·
A3 voces y rol fantasma · A4 cinco áreas (¿cuál falla, cuál queda vacía?) ·
A5 situar · A6 meta-decisión (¿quién decide que se ha decidido?) · A7 regla de
parada · A8 puerta · A9 devolver → produce la **carta de proceso** del evento.

**Reglas de instrumento (Clase E/F — de obligado cumplimiento en la UI):**
- Escenarios concretos, nunca taxonomías (a)/(b)/(c).
- Cada pregunta a su dueño; lo ya sabido no se re-pregunta.
- Estado visible ✅/⏳ y **el ENVÍO inconfundible** de la revisión.
- Ninguna suposición incrustada (fechas/disponibilidad: verificadas o marcadas).
- Opciones mutuamente excluyentes; «todas a la vez» = pregunta mal hecha.
- Lengua llana del destinatario; la jerga del oficio queda en material interno.

## 4 · Chat por proceso

Un chat **por proceso abierto** (no un chat global): cada sesión o evento en diseño
tiene su hilo, con su contexto y su estado. Ventajas: el contexto no se cruza entre
procesos (ética de cruce: un patrón de un grupo solo viaja anonimizado y al nivel de
principio) y el usuario ve claramente en qué proceso está hablando.

## 5 · Catálogo visual de dinámicas

Vista tipo tarjetas/galería: cada dinámica con **su fin** (se usa cuando su fin
coincide con el movimiento), tamaño de grupo, energía (activa/profunda), duración,
y **advertencia de seguridad pegada al nombre**. Filtros por movimiento, tamaño,
momento de la curva.

- La elección es SIEMPRE del humano (D8); Mímir compone abanicos con condición de
  descarte, no recomienda "la mejor".
- 🔴 **HUECO — el contenido del catálogo lo vuelca el facilitador** (su pool de
  dinámicas, fuentes IIFACe/Briggs/Mindell de su corpus). Mímir NO rellena el
  catálogo con dinámicas genéricas de internet. Hasta el volcado, el catálogo
  nace vacío con esta nota visible.

## 6 · Sistemas de toma de decisión

Módulo que implementa la **secuencia de decisión del corpus** (separada, fases):
**0 asumir la inquietud → 1 indagación → 2 propuesta → 3 decisión.**

- Los pitches de LibreSesh adquieren campo «fase»; visualmente distinguibles.
- Formato Briggs para propuestas: **título sin promotor** · 3 pros y 3 contras ·
  alternativas (incluida no hacer nada) · **fecha y criterios de revisión dentro**.
- Métodos de decisión configurables por el organizador (consenso, consentimiento,
  votación…) con sus condiciones; 🔴 falso consenso por agotamiento invalida — el
  sistema avisa si la decisión cae en franja de agotamiento (cruce con §7).
- En agenda e infografías, **una elección nunca se dibuja como paso de secuencia**:
  se dibuja el momento en que se pone sobre la mesa y sus salidas posibles.

## 7 · Horarios, tiempos y ritmo (chequeo B4/B5)

Corre sobre los datos que LibreSesh ya tiene. **Avisa, nunca bloquea.**

- Bloques >90 min sin corte real.
- Decisiones colocadas al final del agotamiento.
- Sin hora de final escrita.
- Curva de agenda (Briggs §12.5): corto y exitoso primero · lo difícil segundo ·
  pausa cada 90 · evaluación dentro de la agenda.
- Curva de energía: transición cabeza → corazón → pies gradual, no brusca.
- Prerrequisitos: no se decide sin indagación previa en agenda; no se abre lo
  delicado sin acuerdos de comunicación puestos antes.

## 8 · Infografías del proceso

Generación de vistas visuales del proceso (mapa de fases, flujo de decisión,
semana visual) desde los datos del evento. Reglas:
- Lengua llana para lo que ve el grupo; jerga solo en material interno.
- Las elecciones dibujadas como bifurcación con salidas, no como casilla.
- Todo material que "sale" pasa la puerta P6 (limpio de personas / anonimizado).

## Lo que NO se construye

- IA facilitadora de cara al grupo en vivo — Mímir no recibe el rol de facilitador.
- Auto-selección de dinámicas — abanico sí, elección humana siempre (D8).
- Analítica de participación por persona — memoria de proceso, no de personas.
- Percepción entregada hecha («el grupo está X») — Mímir no está en la sala (F15).
- Motor de recomendación entrenado con datos de los grupos.

## Fases propuestas

1. **v1 — sin IA:** wizard de sesión (4 preguntas) + chequeo de ritmo + campo
   «fase» en pitches. Todo determinista, ya mete doctrina en el flujo.
2. **v2 — Mímir para el organizador:** chat del organizador (API Claude con el
   PROMPT.md v3 como system prompt) + entrevista de evento + espejo/cosecha.
3. **v3 — chat por rol:** matriz completa del §2, deflexión F13, modo
   sesión-en-curso, catálogo de dinámicas ya volcado.

## Dependencias declaradas

- 🔴 Volcado del pool de dinámicas del facilitador (§5) — sin él, catálogo vacío.
- 🔴 Volcado de los métodos de decisión que el facilitador practica (§6) — la
  secuencia es corpus; los métodos concretos configurables los valida él.
- Clave API Claude en el servicio Easypanel para v2+ (no viaja al frontend).
