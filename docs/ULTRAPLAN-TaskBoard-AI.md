# ULTRAPLAN — TaskBoard AI
## Sistema de Gestión de Proyectos tipo Trello/Jira/Linear con IA integrada

---

## 1. VISIÓN DEL PRODUCTO

**Nombre clave:** TaskBoard AI (o el nombre que elijas para tu producto)

**Pitch:** Un tablero de gestión de proyectos multi-tenant con metodología Scrumban, plantillas prearmadas, sistema de roles granular, etiquetas, prioridades, workflows configurables, y una capa de IA que asiste en la creación, priorización, estimación y automatización de tareas — todo con la velocidad y UX minimalista de Linear, la flexibilidad visual de Trello, y la potencia estructural de Jira.

**Stack recomendado (alineado a tu ecosistema):**
- **Frontend:** Vue 3 + Vite + Vue Router + Pinia + Tailwind CSS + GSAP
- **Backend:** Node.js (Express/Fastify) o Laravel (PHP) + MySQL/PostgreSQL
- **Real-time:** WebSockets (Socket.io o Laravel Echo + Pusher)
- **IA:** Ollama (local) + Qwen 3.5 (9B/27B/35B) — self-hosted, cero costos de API
- **Auth:** JWT + refresh tokens + RBAC middleware
- **Deploy:** VPS + PM2 + Nginx (tu workflow actual)

---

## 2. ANÁLISIS COMPETITIVO — Qué tomar de cada herramienta

### 2.1 Trello
- ✅ Simplicidad del Kanban board con drag & drop
- ✅ Power-Ups como concepto de extensibilidad
- ✅ Cards con checklists, attachments, due dates
- ❌ Se queda corto en reportes, resource planning, portfolio views
- ❌ Comunicación solo a nivel de card, no de proyecto

### 2.2 Jira
- ✅ Workflows personalizables por equipo
- ✅ Sprint planning + backlog management
- ✅ Campos customizables, filtros avanzados, JQL
- ✅ Roles y permisos granulares por proyecto
- ❌ UX compleja, curva de aprendizaje alta
- ❌ Overhead para equipos pequeños

### 2.3 Linear
- ✅ Velocidad brutal — keyboard-first, offline-first
- ✅ Modelo conceptual limpio: Workspace → Teams → Projects → Issues
- ✅ Cycles (sprints) + Triage + Initiatives
- ✅ Views dinámicas basadas en filtros
- ✅ AI agents para automatización y generación
- ✅ WebSocket sync en tiempo real
- ❌ Poco flexible para equipos no-dev

### 2.4 ClickUp
- ✅ Custom statuses reutilizables como templates
- ✅ Bulk actions en board view
- ✅ AI Brain para chat-driven workspace control
- ❌ Feature bloat, UX inconsistente

### 2.5 Monday.com
- ✅ Visual boards con color-coding intuitivo
- ✅ Automations builder no-code (if-then)
- ✅ AI Digital Workforce (agentes autónomos)
- ❌ Pricing agresivo para equipos grandes

### 2.6 Asana
- ✅ AI teammates en beta
- ✅ Smart status y Smart goals
- ✅ Portfolio views + workload management
- ❌ Menos flexible que Linear para dev teams

---

## 3. ARQUITECTURA DE DATOS — Modelo de Base de Datos

### 3.1 Entidades Core

```
┌─────────────────────────────────────────────────────┐
│                    WORKSPACE                         │
│  id, name, slug, logo, plan, settings(JSON),        │
│  created_at, updated_at                             │
└──────────────────┬──────────────────────────────────┘
                   │ 1:N
┌──────────────────▼──────────────────────────────────┐
│                    TEAM                              │
│  id, workspace_id, name, slug, icon, description,   │
│  workflow_template_id, cycle_duration, settings,     │
│  created_at                                         │
└──────────────────┬──────────────────────────────────┘
                   │ 1:N
┌──────────────────▼──────────────────────────────────┐
│                   PROJECT                            │
│  id, team_id, name, slug, description, status,      │
│  icon, color, lead_user_id, start_date, end_date,   │
│  target_date, progress(computed), sort_order,        │
│  created_at, updated_at                             │
└──────────────────┬──────────────────────────────────┘
                   │ N:M (via project_issues)
┌──────────────────▼──────────────────────────────────┐
│                    ISSUE (Task/Card)                  │
│  id, team_id, project_id, parent_id(self-ref),      │
│  identifier (e.g. "FE-142"), title, description,     │
│  description_html, status_id, priority, type,        │
│  assignee_id, reporter_id, estimate(story points),   │
│  due_date, start_date, sort_order, position,         │
│  cycle_id, is_archived, completed_at,               │
│  created_at, updated_at                             │
└─────────────────────────────────────────────────────┘
```

### 3.2 Entidades de Soporte

```
WORKFLOW_STATUS
  id, team_id, name, color, type(enum: backlog|unstarted|started|completed|cancelled),
  position, description

LABEL
  id, workspace_id, team_id(nullable), name, color, description

ISSUE_LABEL (pivot)
  issue_id, label_id

CYCLE (Sprint)
  id, team_id, number, name, start_date, end_date,
  status(enum: upcoming|active|completed), created_at

COMMENT
  id, issue_id, user_id, body, body_html, is_ai_generated,
  parent_id(self-ref for threads), created_at, updated_at, edited_at

ATTACHMENT
  id, issue_id, user_id, filename, url, mime_type, size, created_at

ACTIVITY_LOG
  id, issue_id, user_id, action(enum), field_changed,
  old_value, new_value, created_at

ISSUE_RELATION
  id, issue_id, related_issue_id,
  type(enum: blocks|blocked_by|relates_to|duplicate_of)

CUSTOM_FIELD_DEFINITION
  id, workspace_id, name, type(text|number|date|select|multi_select|url),
  options(JSON for select types), is_required

CUSTOM_FIELD_VALUE
  id, issue_id, field_id, value(TEXT)

VIEW (Saved filters)
  id, workspace_id, team_id(nullable), user_id(nullable),
  name, filters(JSON), sort(JSON), group_by, is_shared, icon

NOTIFICATION
  id, user_id, issue_id, type, title, body, is_read, created_at

TEMPLATE
  id, workspace_id, name, type(enum: board|issue|project|workflow),
  config(JSON), is_system, category, description
```

### 3.3 Entidades de Auth & RBAC

```
USER
  id, email, name, avatar_url, timezone, locale,
  last_active_at, onboarding_completed, created_at

WORKSPACE_MEMBER
  id, workspace_id, user_id, role(enum: owner|admin|member|guest),
  joined_at, status(active|invited|deactivated)

TEAM_MEMBER
  id, team_id, user_id, role(enum: lead|member|viewer)

PERMISSION (granular)
  id, code(string unique: "issue.create", "issue.delete", "project.settings", etc.)

ROLE_PERMISSION (pivot)
  role(string), permission_id

INVITATION
  id, workspace_id, email, role, token, invited_by, expires_at, accepted_at
```

### 3.4 Entidades de IA

```
AI_CONVERSATION
  id, workspace_id, user_id, issue_id(nullable),
  project_id(nullable), context_type(enum), created_at

AI_MESSAGE
  id, conversation_id, role(user|assistant), content,
  tokens_used, model(e.g. "qwen3.5:9b"), created_at

AI_ACTION_LOG
  id, workspace_id, user_id, action_type(enum:
    task_generation|priority_suggestion|description_enhancement|
    sprint_planning|risk_detection|status_summary|
    label_suggestion|estimate_suggestion|duplicate_detection),
  input_context(JSON), output(JSON), accepted_by_user(boolean),
  created_at

AI_AUTOMATION_RULE
  id, workspace_id, team_id, name, trigger(JSON),
  action(JSON), is_active, last_triggered_at, created_at
```

---

## 4. SISTEMA DE ROLES Y PERMISOS (RBAC)

### 4.1 Jerarquía de Roles

```
WORKSPACE LEVEL:
  ├── Owner     → Control total, billing, danger zone
  ├── Admin     → Gestión de miembros, settings, integraciones
  ├── Member    → CRUD issues, proyectos, comentarios
  └── Guest     → Solo lectura + comentar en issues asignados

TEAM LEVEL:
  ├── Lead      → Workflow settings, cycles, triage
  ├── Member    → CRUD issues del team
  └── Viewer    → Solo lectura

PROJECT LEVEL:
  ├── Manager   → Settings del proyecto, asignar miembros
  ├── Contributor → Crear/editar issues dentro del proyecto
  └── Observer  → Solo lectura del proyecto
```

### 4.2 Matriz de Permisos Detallada

| Permiso                    | Owner | Admin | Member | Guest | Lead | Viewer |
|----------------------------|-------|-------|--------|-------|------|--------|
| workspace.settings         | ✅    | ✅    | ❌     | ❌    | —    | —      |
| workspace.billing          | ✅    | ❌    | ❌     | ❌    | —    | —      |
| workspace.members.manage   | ✅    | ✅    | ❌     | ❌    | —    | —      |
| workspace.members.invite   | ✅    | ✅    | ✅     | ❌    | —    | —      |
| team.create                | ✅    | ✅    | ❌     | ❌    | —    | —      |
| team.settings              | ✅    | ✅    | —      | ❌    | ✅   | ❌     |
| team.workflow.edit         | ✅    | ✅    | —      | ❌    | ✅   | ❌     |
| project.create             | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| project.delete             | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| project.settings           | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| issue.create               | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| issue.edit                 | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| issue.delete               | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| issue.assign               | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| issue.move_status          | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| issue.comment              | ✅    | ✅    | ✅     | ✅    | ✅   | ❌     |
| cycle.manage               | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| label.manage               | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| view.create_shared         | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| ai.use                     | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |
| ai.automation.manage       | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| template.manage            | ✅    | ✅    | ❌     | ❌    | ✅   | ❌     |
| export.data                | ✅    | ✅    | ✅     | ❌    | ✅   | ❌     |

---

## 5. WORKFLOWS Y METODOLOGÍAS — Templates Prearmados

### 5.1 Template: Scrumban (Default)

```
Columnas del Board:
┌──────────┬───────────┬──────────────┬───────────┬──────────┬────────┐
│ BACKLOG  │   READY   │ IN PROGRESS  │  REVIEW   │  TESTING │  DONE  │
│ (no WIP) │  WIP: 5   │   WIP: 3     │  WIP: 2   │  WIP: 2  │(no WIP)│
└──────────┴───────────┴──────────────┴───────────┴──────────┴────────┘

Swimlanes opcionales:
  → Por tipo: Feature | Bug | Improvement | Chore
  → Por prioridad: Urgent | High | Normal | Low
  → Por assignee

Ceremonies incluidas:
  → Planning on-demand (trigger cuando Backlog < threshold)
  → Daily standup (opcional, async via AI summary)
  → Review al cerrar cycle
  → Retrospective template
```

### 5.2 Template: Kanban Puro

```
┌──────────┬──────────────┬───────────┬────────┐
│   TODO   │ IN PROGRESS  │  REVIEW   │  DONE  │
│          │   WIP: 4     │  WIP: 2   │        │
└──────────┴──────────────┴───────────┴────────┘
Sin cycles. Flujo continuo. Métricas: lead time, cycle time, throughput.
```

### 5.3 Template: Scrum Clásico

```
┌──────────┬───────────┬──────────────┬───────────┬────────┐
│ BACKLOG  │ SPRINT    │ IN PROGRESS  │  REVIEW   │  DONE  │
│(separate)│ BACKLOG   │              │           │        │
└──────────┴───────────┴──────────────┴───────────┴────────┘
Cycles obligatorios (1-4 semanas). Sprint planning. Velocity tracking.
Story points. Burndown chart.
```

### 5.4 Template: Bug Tracking

```
┌──────────┬──────────┬──────────────┬───────────┬──────────┬────────┐
│ REPORTED │ TRIAGED  │ IN PROGRESS  │  IN QA    │ VERIFIED │ CLOSED │
└──────────┴──────────┴──────────────┴───────────┴──────────┴────────┘
Campos extra: severity, environment, steps to reproduce, affected version.
```

### 5.5 Template: Marketing / Contenido

```
┌──────────┬──────────┬──────────────┬───────────┬──────────┬────────────┐
│  IDEAS   │ PLANNED  │   CREATING   │  EDITING  │ APPROVED │ PUBLISHED  │
└──────────┴──────────┴──────────────┴───────────┴──────────┴────────────┘
```

### 5.6 Template: Freelance / Cliente

```
┌──────────┬──────────────┬─────────────┬───────────┬────────┐
│ BRIEFING │ IN PROGRESS  │  FEEDBACK   │ REVISION  │  DONE  │
└──────────┴──────────────┴─────────────┴───────────┴────────┘
```

---

## 6. SISTEMA DE ETIQUETAS Y PRIORIDADES

### 6.1 Prioridades (Built-in, inmutables)

| Nivel | Nombre   | Color    | Icono | Descripción                    |
|-------|----------|----------|-------|--------------------------------|
| 0     | Urgent   | #EF4444  | 🔴    | Requiere acción inmediata       |
| 1     | High     | #F97316  | 🟠    | Impacto significativo           |
| 2     | Medium   | #EAB308  | 🟡    | Prioridad normal                |
| 3     | Low      | #3B82F6  | 🔵    | Nice to have                    |
| 4     | None     | #6B7280  | ⚪    | Sin prioridad asignada          |

### 6.2 Labels (Customizables por workspace/team)

**Labels de Sistema (sugeridos al crear workspace):**
- `type:feature` — Nueva funcionalidad
- `type:bug` — Error o defecto
- `type:improvement` — Mejora de lo existente
- `type:chore` — Tarea técnica / mantenimiento
- `type:docs` — Documentación
- `scope:frontend` — Trabajo de frontend
- `scope:backend` — Trabajo de backend
- `scope:design` — Trabajo de diseño
- `scope:infra` — Infraestructura / DevOps
- `effort:xs` / `effort:s` / `effort:m` / `effort:l` / `effort:xl`
- `blocked` — Bloqueada por dependencia
- `needs-review` — Requiere revisión
- `ai-generated` — Creada o modificada por IA

**Reglas de Labels:**
- Max 10 labels por issue
- Labels heredan del workspace, teams pueden crear adicionales
- Color picker libre (hex) + palette sugerida
- Agrupación por prefijo (type:, scope:, effort:)

### 6.3 Tipos de Issue (Built-in, extensibles)

| Tipo        | Icono | Descripción                  | Puede tener sub-issues |
|-------------|-------|------------------------------|------------------------|
| Epic        | ⚡    | Iniciativa grande            | ✅                     |
| Story       | 📖    | User story                   | ✅                     |
| Task        | ✅    | Tarea atómica                | ✅ (subtasks)          |
| Bug         | 🐛    | Defecto                      | ✅                     |
| Sub-task    | 📎    | Hijo de otro issue           | ❌                     |

---

## 7. CAPA DE IA — Features y Arquitectura

### 7.1 Funcionalidades de IA

#### A. Generación de Tareas
```
Input:  "Necesito hacer un landing page para el restaurante LaRucula"
Output: Lista de issues generadas con:
  → Títulos descriptivos
  → Descripciones con acceptance criteria
  → Estimaciones sugeridas (story points)
  → Labels sugeridos
  → Prioridades sugeridas
  → Dependencias detectadas entre tareas
  → Asignación sugerida (si hay historial)
```

#### B. Asistente de Descripción
- Mejorar/expandir descripción de issue
- Generar acceptance criteria desde un título
- Convertir notas sueltas en issue estructurado
- Traducir issues entre idiomas

#### C. Priorización Inteligente
- Analizar backlog completo y sugerir orden
- Detectar issues bloqueadas o en riesgo
- Sugerir qué issues meter en el próximo cycle
- Identificar duplicados potenciales

#### D. Sprint/Cycle Planning Asistido
```
Input:  Backlog actual + velocidad del equipo + disponibilidad
Output: Sprint plan sugerido con:
  → Issues seleccionados por prioridad y capacidad
  → Carga estimada por miembro
  → Alertas de sobre-asignación
  → Riesgos identificados
```

#### E. Resúmenes y Reportes
- Daily digest: qué se hizo ayer, qué está en progreso, qué está bloqueado
- Sprint summary: resumen automático al cerrar cycle
- Project health: análisis del estado general del proyecto
- Standup async: resumen generado como comentario o mensaje

#### F. Automatizaciones con IA
```yaml
Regla ejemplo:
  trigger: "issue movida a DONE"
  action: "IA genera resumen del issue y lo postea como comentario final"

Regla ejemplo:
  trigger: "issue sin actividad por 5 días"
  action: "IA notifica al assignee con sugerencia"

Regla ejemplo:
  trigger: "nuevo issue creado con label type:bug"
  action: "IA sugiere severity y prioridad basándose en la descripción"
```

#### G. Detección de Riesgos
- Issues que llevan mucho tiempo en "In Progress"
- Cycles con más issues de lo que la velocidad permite
- Miembros con carga excesiva
- Deadlines en riesgo

### 7.2 Arquitectura Técnica de IA — Ollama + Qwen 3.5

#### Stack de IA
```
Motor:     Ollama (self-hosted en tu VPS o máquina dedicada)
Modelo:    Qwen 3.5 — familia MoE con Gated DeltaNet
  → qwen3.5:9b   (6.6GB)  — Rápido, ideal para sugerencias en tiempo real
  → qwen3.5:27b  (17GB)   — Balance potencia/velocidad para generación
  → qwen3.5:35b  (24GB)   — Máxima calidad, para planificación compleja
Contexto:  256K tokens (nativo en todos los tamaños)
Idiomas:   201 idiomas (español nativo incluido)
Features:  Thinking mode, tool calling, structured JSON output, streaming
Licencia:  Apache 2.0 — uso comercial libre
```

#### Selección de Modelo por Caso de Uso
```
┌────────────────────────────┬──────────────┬──────────────────────────┐
│ CASO DE USO                │ MODELO       │ POR QUÉ                  │
├────────────────────────────┼──────────────┼──────────────────────────┤
│ Autocomplete de títulos    │ qwen3.5:9b   │ Latencia mínima (<500ms) │
│ Sugerir prioridad/labels   │ qwen3.5:9b   │ Contexto pequeño, rápido │
│ Mejorar descripción        │ qwen3.5:9b   │ Tarea simple, velocidad  │
│ Generar lista de tareas    │ qwen3.5:27b  │ Razonamiento + estructura│
│ Sprint planning asistido   │ qwen3.5:27b  │ Análisis de backlog      │
│ Resumen de proyecto/sprint │ qwen3.5:27b  │ Comprensión de contexto  │
│ Detección de duplicados    │ qwen3.5:9b   │ Comparación rápida       │
│ Chat libre contextual      │ qwen3.5:27b  │ Conversación compleja    │
│ Análisis de riesgo         │ qwen3.5:35b  │ Máxima calidad de análisis│
│ Planificación estratégica  │ qwen3.5:35b  │ Razonamiento profundo    │
└────────────────────────────┴──────────────┴──────────────────────────┘
```

#### Arquitectura del Sistema
```
┌────────────────────────────────────────────┐
│            FRONTEND (Vue 3)                │
│  ┌──────────────────────────────────────┐  │
│  │  AI Assistant Panel (sidebar)        │  │
│  │  → Chat interface con streaming      │  │
│  │  → Suggestion cards                  │  │
│  │  → Accept/reject/edit buttons        │  │
│  │  → Inline AI actions (en cada issue) │  │
│  └──────────────────────────────────────┘  │
└─────────────────┬──────────────────────────┘
                  │ HTTP / WebSocket
┌─────────────────▼──────────────────────────┐
│         BACKEND (Express/Laravel)           │
│  ┌──────────────────────────────────────┐  │
│  │   AI Service (ai.service.js)          │  │
│  │   → Context builder (workspace data) │  │
│  │   → Prompt templates por acción      │  │
│  │   → Model router (9b/27b/35b)        │  │
│  │   → Response parser + validator      │  │
│  │   → Action executor                  │  │
│  └──────────────────┬───────────────────┘  │
│                     │                      │
│  ┌──────────────────▼───────────────────┐  │
│  │   Queue (Bull/Redis) — OPCIONAL       │  │
│  │   → Async AI jobs (planificación)     │  │
│  │   → Rate limiting interno             │  │
│  │   → Retry logic                       │  │
│  └──────────────────┬───────────────────┘  │
└──────────────────────┼─────────────────────┘
                       │ HTTP :11434
┌──────────────────────▼─────────────────────┐
│         OLLAMA SERVER (mismo VPS o dedicado)│
│                                             │
│  Modelos cargados:                          │
│  ├── qwen3.5:9b   (siempre en memoria)     │
│  ├── qwen3.5:27b  (on-demand, keep_alive)  │
│  └── qwen3.5:35b  (on-demand, si hay RAM)  │
│                                             │
│  API: http://localhost:11434                │
│  Structured output: JSON Schema (Zod)       │
│  Streaming: Server-Sent Events              │
│  Tool calling: Nativo en Qwen 3.5           │
└─────────────────────────────────────────────┘
```

#### Instalación de Ollama en VPS
```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Descargar modelos
ollama pull qwen3.5:9b      # 6.6GB — modelo principal
ollama pull qwen3.5:27b     # 17GB  — modelo avanzado (si hay RAM)

# Verificar que corre
curl http://localhost:11434/api/tags

# Ollama corre como servicio systemd automáticamente
# Para exponer solo internamente (seguridad):
# OLLAMA_HOST=127.0.0.1:11434 (default, solo localhost)
```

#### Tu Hardware — Análisis de Capacidad
```
TU MÁQUINA:
  CPU:  AMD Ryzen 7 5700X — 8c/16t @ 4.12 GHz
  RAM:  32 GB DDR4 2666 MHz (3/4 slots, 1 slot libre)
  GPU:  NVIDIA GeForce RTX 3080 — 10 GB VRAM dedicada
  SSD:  Force MP510 NVMe
  OS:   Windows 11 Pro (Hyper-V habilitado)

CONFIGURACIÓN ÓPTIMA:

  qwen3.5:9b (6.6 GB) — MODELO PRINCIPAL
    → Entra completo en GPU (10 GB VRAM)
    → Inferencia CUDA full-speed: ~30-50 tokens/s
    → Latencia: ~0.5-2s por respuesta típica
    → keep_alive: "24h" (siempre cargado)
    → Para: sugerencias rápidas, prioridad, labels,
      descripciones, duplicados

  qwen3.5:27b (17 GB) — MODELO AVANZADO
    → Split GPU+RAM: ~10 GB VRAM + ~7 GB RAM (auto offload)
    → Inferencia: ~10-20 tokens/s (GPU-assisted)
    → Latencia: ~3-8s por respuesta
    → keep_alive: "10m" (on-demand)
    → Para: generar tareas, sprint planning, resúmenes, chat

  qwen3.5:35b (24 GB) — OPCIONAL
    → Mayormente RAM con GPU assist
    → ~5-10 tokens/s, 8-15s latencia
    → Solo para análisis de riesgo profundo

MEMORIA: 32 GB - ~13 GB en uso = ~19 GB libres
  → 9b full GPU: ✅ sobran 3.4 GB VRAM
  → 27b split: ✅ ~12 GB RAM libres post-carga
  → Ambos simultáneos: ❌ (Ollama alterna automáticamente)

UPGRADE OPCIONAL (1 slot DIMM libre):
  → +8 GB → 40 GB (más headroom para 27b)
  → 4x16 GB → 64 GB (35b cómodo)
  → Nota: 3 DIMMs = memoria asimétrica, agregar 1 más
    iguala dual channel

DISCO: ~24 GB para 9b + 27b en tu NVMe ✅
```

#### Instalación en Windows + Setup
```bash
# 1. Descargar desde https://ollama.com/download (detecta CUDA auto)

# 2. Descargar modelos
ollama pull qwen3.5:9b      # 6.6 GB
ollama pull qwen3.5:27b     # 17 GB

# 3. Test rápido
ollama run qwen3.5:9b "Generá 3 tareas para un landing page"

# 4. Verificar GPU
nvidia-smi

# 5. API disponible en http://localhost:11434
curl http://localhost:11434/api/tags

# ENV vars (System Properties → Environment Variables):
#   OLLAMA_HOST=127.0.0.1:11434  (solo localhost)
#   OLLAMA_MAX_LOADED_MODELS=1   (1 modelo a la vez)

# Warmup del modelo principal:
curl http://localhost:11434/api/generate -d '{
  "model": "qwen3.5:9b",
  "keep_alive": "24h",
  "prompt": "warmup"
}'
```

#### Integración Node.js con Ollama
```javascript
// ai.service.js — Capa de abstracción sobre Ollama
import ollama from 'ollama';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Schema de respuesta para generación de tareas
const TaskListSchema = z.object({
  issues: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['task', 'bug', 'story', 'epic']),
    priority: z.number().min(0).max(4),
    estimate: z.number().optional(),
    labels: z.array(z.string()),
    acceptance_criteria: z.array(z.string()),
  }))
});

// Router de modelos por complejidad
const MODEL_MAP = {
  quick: 'qwen3.5:9b',    // Sugerencias rápidas
  standard: 'qwen3.5:27b', // Generación y análisis
  deep: 'qwen3.5:35b',     // Planificación compleja
};

class AIService {
  
  // Generar tareas desde descripción
  async generateTasks(description, context) {
    const response = await ollama.chat({
      model: MODEL_MAP.standard,
      messages: [
        { role: 'system', content: this.buildSystemPrompt(context) },
        { role: 'user', content: `Generá una lista de tareas para: ${description}` }
      ],
      format: zodToJsonSchema(TaskListSchema),
      stream: false,
      options: { temperature: 0.3 }
    });
    
    return TaskListSchema.parse(JSON.parse(response.message.content));
  }

  // Sugerir prioridad (modelo rápido)
  async suggestPriority(title, description) {
    const PrioritySchema = z.object({
      priority: z.number().min(0).max(4),
      reasoning: z.string()
    });

    const response = await ollama.chat({
      model: MODEL_MAP.quick,
      messages: [
        { role: 'system', content: 'Sos un PM. Asigná prioridad: 0=Urgent, 1=High, 2=Medium, 3=Low, 4=None. Respondé en JSON.' },
        { role: 'user', content: `Título: ${title}\nDescripción: ${description}` }
      ],
      format: zodToJsonSchema(PrioritySchema),
      stream: false,
      options: { temperature: 0.1 }
    });

    return PrioritySchema.parse(JSON.parse(response.message.content));
  }

  // Chat con streaming (para el sidebar)
  async *chatStream(messages, context) {
    const response = await ollama.chat({
      model: MODEL_MAP.standard,
      messages: [
        { role: 'system', content: this.buildSystemPrompt(context) },
        ...messages
      ],
      stream: true,
      options: { temperature: 0.5 }
    });

    for await (const part of response) {
      yield part.message.content;
    }
  }

  // Mejorar descripción de issue
  async enhanceDescription(title, currentDescription) {
    const response = await ollama.chat({
      model: MODEL_MAP.quick,
      messages: [
        { role: 'system', content: 'Mejorá la descripción de este issue. Agregá acceptance criteria si faltan. Respondé en markdown.' },
        { role: 'user', content: `Título: ${title}\nDescripción actual: ${currentDescription || '(vacía)'}` }
      ],
      stream: false,
      options: { temperature: 0.4 }
    });

    return response.message.content;
  }

  // Sprint planning asistido
  async planSprint(backlog, velocity, teamCapacity) {
    const SprintPlanSchema = z.object({
      selected_issues: z.array(z.object({
        issue_id: z.string(),
        reason: z.string()
      })),
      total_points: z.number(),
      risks: z.array(z.string()),
      recommendations: z.array(z.string())
    });

    const response = await ollama.chat({
      model: MODEL_MAP.deep, // Usa el modelo más potente
      messages: [
        { role: 'system', content: 'Sos un PM experto. Planificá el próximo sprint.' },
        { role: 'user', content: `
          Velocidad del equipo: ${velocity} pts/sprint
          Capacidad: ${JSON.stringify(teamCapacity)}
          Backlog priorizado:
          ${backlog.map(i => `- [${i.id}] ${i.title} (${i.estimate}pts, P${i.priority})`).join('\n')}
        `}
      ],
      format: zodToJsonSchema(SprintPlanSchema),
      stream: false,
      options: { temperature: 0.2 }
    });

    return SprintPlanSchema.parse(JSON.parse(response.message.content));
  }

  // Construir system prompt con contexto del workspace
  buildSystemPrompt(context) {
    return `
Sos un asistente PM integrado en un sistema de gestión de proyectos.
Contexto:
- Workspace: ${context.workspace?.name || 'N/A'}
- Equipo: ${context.team?.name || 'N/A'} (${context.members?.length || 0} miembros)
- Proyecto: ${context.project?.name || 'N/A'}
- Workflow: ${context.statuses?.map(s => s.name).join(' → ') || 'N/A'}
- Labels disponibles: ${context.labels?.map(l => l.name).join(', ') || 'N/A'}

Reglas:
- Respondé siempre en español
- Sé conciso y accionable
- Cuando generes tareas, hacelas específicas y atómicas
- Priorizá basándote en impacto y urgencia
`.trim();
  }
}

export default new AIService();
```

#### Endpoint API para AI (Express)
```javascript
// routes/ai.routes.js
import { Router } from 'express';
import aiService from '../services/ai.service.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

// Generar tareas desde descripción
router.post('/generate-tasks', 
  requireAuth, 
  requirePermission('ai.use'),
  async (req, res) => {
    try {
      const { description, project_id } = req.body;
      const context = await buildContext(req.user, project_id);
      const result = await aiService.generateTasks(description, context);
      
      // Log de acción AI
      await AIActionLog.create({
        workspace_id: context.workspace.id,
        user_id: req.user.id,
        action_type: 'task_generation',
        input_context: { description },
        output: result,
        accepted_by_user: null // Pendiente de aceptación
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'AI generation failed' });
    }
  }
);

// Chat con streaming
router.post('/chat',
  requireAuth,
  requirePermission('ai.use'),
  async (req, res) => {
    const { messages, project_id } = req.body;
    const context = await buildContext(req.user, project_id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    for await (const chunk of aiService.chatStream(messages, context)) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }
);

export default router;
```

#### Ventajas de Ollama + Qwen 3.5 vs API externa
```
✅ Cero costos de API — corré cuántas queries quieras sin límite
✅ Privacidad total — los datos nunca salen de tu VPS
✅ Sin rate limits — velocidad limitada solo por tu hardware
✅ Latencia predecible — sin network hops a APIs externas
✅ Control total — podés fine-tunear, cambiar modelos, ajustar params
✅ Offline capable — funciona sin internet
✅ Apache 2.0 — uso comercial sin restricciones
✅ 256K context window — backlog enteros caben en un prompt
✅ Structured JSON output — Ollama fuerza schema con Zod
✅ Streaming nativo — respuestas progresivas al frontend
✅ Tool calling — Qwen 3.5 soporta function calling nativo
✅ Español nativo — 201 idiomas, sin degradación en español
```

---

## 8. VISTAS Y INTERFAZ

### 8.1 Vistas del Board

| Vista      | Descripción                                      | Uso principal                  |
|------------|--------------------------------------------------|--------------------------------|
| Board      | Kanban con columnas de status, drag & drop        | Día a día del equipo           |
| List       | Vista tabular con sorting y filtros              | Gestión de backlog             |
| Calendar   | Issues en calendario por due date                | Planificación temporal         |
| Timeline   | Gantt simplificado con dependencias              | Roadmap y deadlines            |
| My Issues  | Issues asignadas al usuario logueado             | Foco personal                  |
| Cycle View | Issues del cycle activo con progreso             | Sprint management              |
| Dashboard  | Métricas: velocity, burndown, distribución       | Reportes y health checks       |

### 8.2 Filtros y Agrupación

**Filtros disponibles:**
- Status (multi-select)
- Priority (multi-select)
- Assignee (multi-select)
- Label (multi-select, con operador AND/OR)
- Type (multi-select)
- Due date (range, overdue, no date)
- Created date (range)
- Cycle (current, specific, none)
- Project (multi-select)
- Estimate (range)
- Custom fields

**Agrupación (group_by):**
- Status, Priority, Assignee, Label, Type, Project, Cycle, No grouping

**Ordenamiento:**
- Priority, Created date, Updated date, Due date, Manual, Estimate

### 8.3 Componentes UI Clave

```
Issue Card (Board view):
┌─────────────────────────────────────┐
│ FE-142                    🟠 High   │
│ ─────────────────────────────────── │
│ Implementar hero section con        │
│ parallax y video background         │
│ ─────────────────────────────────── │
│ 👤 Mateo    📎 2    💬 5    ⏱️ 3pts │
│ 🏷️ frontend  design                │
│ 📅 Abr 20                          │
└─────────────────────────────────────┘

Issue Detail (Panel lateral o página):
┌─────────────────────────────────────────────────────┐
│ FE-142 — Implementar hero section                   │
│ ──────────────────────────────────────────────────── │
│ Status: [In Progress ▼]   Priority: [High ▼]        │
│ Assignee: [Mateo ▼]       Estimate: [3 pts ▼]       │
│ Labels: [frontend] [design]                         │
│ Project: Pegasuz Website V2                         │
│ Cycle: Sprint 14 (activo)                           │
│ Due: 20 Abr 2026                                    │
│ ──────────────────────────────────────────────────── │
│ DESCRIPTION (rich text editor)                      │
│ ...                                                  │
│ ──────────────────────────────────────────────────── │
│ SUB-ISSUES (3)                                      │
│  ☐ FE-143 Diseñar mockup del hero                   │
│  ☑ FE-144 Grabar video de fondo                     │
│  ☐ FE-145 Implementar parallax con GSAP             │
│ ──────────────────────────────────────────────────── │
│ RELATIONS                                           │
│  🔗 Blocks: FE-150 (Deploy landing page)            │
│ ──────────────────────────────────────────────────── │
│ ACTIVITY & COMMENTS                                 │
│  Mateo: "Ya tengo el diseño aprobado" — hace 2h     │
│  🤖 AI: Suggested priority change to High — hace 1d │
│ ──────────────────────────────────────────────────── │
│ 🤖 [Ask AI]  📎 [Attach]  🔗 [Link]                │
└─────────────────────────────────────────────────────┘
```

---

## 9. REAL-TIME Y OPTIMISTIC UPDATES

### 9.1 Estrategia de Sync

```
OPTIMISTIC UPDATE FLOW:
1. User drag-drops card → UI actualiza inmediatamente
2. Request POST /api/issues/:id/move → backend
3. Backend valida permisos + WIP limits
4. Si OK → broadcast via WebSocket a todos los conectados
5. Si FAIL → UI reverte al estado anterior + toast de error

WEBSOCKET EVENTS:
  issue.created    → Agregar card al board
  issue.updated    → Actualizar card in-place
  issue.deleted    → Remover card con animación
  issue.moved      → Mover card entre columnas
  comment.created  → Badge de notificación
  cycle.started    → Refresh del cycle view
  member.joined    → Actualizar sidebar
  ai.suggestion    → Mostrar suggestion card
```

### 9.2 Offline Support (opcional, fase futura)

- IndexedDB para cache local de issues
- Queue de acciones pendientes
- Sync al reconectar
- Indicador visual de estado offline

---

## 10. API DESIGN

### 10.1 Endpoints Principales

```
AUTH
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/refresh
  POST   /api/auth/forgot-password
  GET    /api/auth/me

WORKSPACE
  GET    /api/workspaces
  POST   /api/workspaces
  PATCH  /api/workspaces/:id
  DELETE /api/workspaces/:id
  GET    /api/workspaces/:id/members
  POST   /api/workspaces/:id/invite
  PATCH  /api/workspaces/:id/members/:userId
  DELETE /api/workspaces/:id/members/:userId

TEAMS
  GET    /api/workspaces/:wid/teams
  POST   /api/workspaces/:wid/teams
  PATCH  /api/teams/:id
  DELETE /api/teams/:id
  GET    /api/teams/:id/members

PROJECTS
  GET    /api/teams/:tid/projects
  POST   /api/teams/:tid/projects
  PATCH  /api/projects/:id
  DELETE /api/projects/:id

ISSUES
  GET    /api/teams/:tid/issues          (con filtros query params)
  POST   /api/teams/:tid/issues
  GET    /api/issues/:id
  PATCH  /api/issues/:id
  DELETE /api/issues/:id
  POST   /api/issues/:id/move            (cambiar status/position)
  GET    /api/issues/:id/sub-issues
  POST   /api/issues/:id/sub-issues
  GET    /api/issues/:id/comments
  POST   /api/issues/:id/comments
  GET    /api/issues/:id/activity
  POST   /api/issues/:id/relations
  DELETE /api/issues/:id/relations/:rid

CYCLES
  GET    /api/teams/:tid/cycles
  POST   /api/teams/:tid/cycles
  PATCH  /api/cycles/:id
  POST   /api/cycles/:id/start
  POST   /api/cycles/:id/complete

LABELS
  GET    /api/workspaces/:wid/labels
  POST   /api/workspaces/:wid/labels
  PATCH  /api/labels/:id
  DELETE /api/labels/:id

VIEWS
  GET    /api/workspaces/:wid/views
  POST   /api/workspaces/:wid/views
  PATCH  /api/views/:id
  DELETE /api/views/:id

TEMPLATES
  GET    /api/workspaces/:wid/templates
  POST   /api/workspaces/:wid/templates
  POST   /api/workspaces/:wid/templates/:id/apply

AI
  POST   /api/ai/generate-tasks          (genera issues desde descripción)
  POST   /api/ai/enhance-description     (mejora descripción de issue)
  POST   /api/ai/suggest-priority        (sugiere prioridad)
  POST   /api/ai/sprint-plan             (planifica sprint)
  POST   /api/ai/summarize               (resumen de proyecto/sprint)
  POST   /api/ai/detect-duplicates       (detecta duplicados)
  POST   /api/ai/chat                    (chat contextual libre)

NOTIFICATIONS
  GET    /api/notifications
  PATCH  /api/notifications/:id/read
  POST   /api/notifications/read-all

DASHBOARD / ANALYTICS
  GET    /api/teams/:tid/analytics/velocity
  GET    /api/teams/:tid/analytics/burndown
  GET    /api/teams/:tid/analytics/distribution
  GET    /api/projects/:pid/analytics/progress
```

---

## 11. ROADMAP DE DESARROLLO — Fases

### FASE 1 — MVP Core (6-8 semanas)
```
☐ Auth (register, login, JWT, refresh)
☐ Workspace CRUD + settings básicos
☐ Team CRUD + members management
☐ Project CRUD
☐ Issue CRUD con status, priority, assignee
☐ Board view con drag & drop (Kanban)
☐ List view con filtros básicos
☐ Comments en issues
☐ Labels CRUD + asignación a issues
☐ Activity log automático
☐ Roles básicos (Owner, Admin, Member)
☐ Template: Kanban (default)
☐ Responsive layout
```

### FASE 2 — Workflows & Cycles (4-6 semanas)
```
☐ Workflow customizable (statuses por team)
☐ WIP limits por columna
☐ Cycles (Sprints) CRUD + start/complete
☐ Cycle view con progreso
☐ Sub-issues (parent-child)
☐ Issue relations (blocks, relates_to, duplicate)
☐ Template: Scrumban
☐ Template: Scrum Clásico
☐ Saved views (personal + shared)
☐ Bulk actions (multi-select issues)
☐ Keyboard shortcuts (C=create, /=search)
```

### FASE 3 — IA Integration (4-6 semanas)
```
☐ AI Service layer + Anthropic API integration
☐ Generate tasks from description
☐ Enhance issue description
☐ Priority suggestion
☐ Sprint planning assistant
☐ AI chat sidebar (contextual)
☐ Duplicate detection
☐ AI action log (tracking de sugerencias)
☐ Label: ai-generated automática
```

### FASE 4 — Analytics & Polish (3-4 semanas)
```
☐ Dashboard con métricas
☐ Velocity chart
☐ Burndown chart
☐ Distribution charts (por status, priority, assignee)
☐ Calendar view
☐ Timeline view (Gantt simplificado)
☐ Notifications system (in-app + email)
☐ My Issues view
☐ Search global (cmd+K)
```

### FASE 5 — Advanced Features (4-6 semanas)
```
☐ Custom fields
☐ Issue templates
☐ AI automation rules
☐ Real-time WebSocket sync
☐ Optimistic updates
☐ Guest role + sharing público de boards
☐ Export (CSV, JSON)
☐ Templates adicionales (Bug Tracking, Marketing, Freelance)
☐ Attachments (files + images)
☐ Mentions (@user) en comments
☐ Rich text editor (Tiptap/ProseMirror)
```

### FASE 6 — Multi-tenant & Scale (ongoing)
```
☐ Multi-workspace por usuario
☐ Billing / Plans
☐ Audit log completo
☐ API pública documentada
☐ Webhooks para integraciones
☐ Integración GitHub/GitLab
☐ Integración Slack
☐ Mobile responsive avanzado / PWA
☐ Offline support con IndexedDB
☐ Performance optimization (virtual scrolling, lazy load)
```

---

## 12. MÉTRICAS CLAVE DEL PRODUCTO

### Métricas de Equipo
- **Velocity:** Story points completados por cycle
- **Cycle Time:** Tiempo promedio de "In Progress" a "Done"
- **Lead Time:** Tiempo promedio de "Created" a "Done"
- **Throughput:** Issues completados por semana
- **WIP Age:** Tiempo que llevan los issues en progreso
- **Burndown:** Story points restantes vs tiempo en el cycle

### Métricas de Proyecto
- **Progress:** % de issues completados
- **Scope Creep:** Issues agregados después de iniciar
- **Blocked Rate:** % de issues bloqueados
- **Overdue Rate:** % de issues pasados de deadline

### Métricas de IA
- **AI Adoption Rate:** % de usuarios que usan features de IA
- **Suggestion Acceptance:** % de sugerencias aceptadas
- **Time Saved:** Estimación de tiempo ahorrado por IA
- **Token Usage:** Consumo mensual de API

---

## 13. PRINCIPIOS DE DISEÑO UI/UX

### Inspirados en Linear + tu sensibilidad Pegasuz:

1. **Velocidad primero** — Toda acción debe sentirse instantánea. Optimistic updates. No spinners donde no sean necesarios.

2. **Keyboard-first** — `C` para crear, `/` para buscar, `←→` para navegar, `1-4` para prioridad. Power users deben poder vivir sin mouse.

3. **Densidad informativa** — Mostrar el máximo de info relevante sin sentir clutter. Cards compactas pero legibles.

4. **Dark mode default** — Background oscuro, acento de color por proyecto/team. Consistente con tu design system.

5. **Animaciones con propósito** — Drag & drop fluido, transiciones de panel, reveals al crear issues. GSAP donde sea necesario. No animaciones decorativas vacías.

6. **Jerarquía tipográfica clara** — Headings fuertes para títulos de issue, body legible para descripciones, monospace para identifiers (FE-142).

7. **Contextual, no modal** — Preferir paneles laterales sobre modales. Inline editing sobre formularios completos.

8. **IA como asistente, no como protagonista** — La IA sugiere, el humano decide. Siempre con opción de aceptar/rechazar/editar.

---

## 14. CONSIDERACIONES TÉCNICAS

### 14.1 Ordering de Issues (Position)
```
Usar sistema lexicográfico (como Linear usa LexoRank):
  - Permite insertar entre dos items sin reordenar todo
  - "a" < "b" → insertar entre = "an" 
  - Librerías: lexorank (npm)
```

### 14.2 Identifiers
```
Cada team tiene un prefix (e.g. "FE", "BE", "DES")
Cada issue se auto-numera: FE-1, FE-2, FE-3...
Counter atómico por team en la DB (team.issue_counter)
El identifier es inmutable una vez creado
```

### 14.3 Search
```
Implementar búsqueda con:
  - Full-text search en MySQL/PostgreSQL
  - Filtrado por identifier (FE-142)
  - Filtrado por título parcial
  - Cmd+K / Ctrl+K global shortcut
  - Resultados agrupados por tipo (Issues, Projects, Members)
```

### 14.4 Performance
```
  - Virtual scrolling para boards con muchos issues (>100)
  - Paginación cursor-based para list view
  - Lazy load de comments y activity
  - Debounce en drag & drop events
  - Redis cache para views frecuentes
  - WebSocket rooms por team (no broadcast global)
```

---

## 15. SECURITY CHECKLIST

```
☐ Rate limiting en todos los endpoints (express-rate-limit)
☐ Input validation + sanitización (Joi/Zod + DOMPurify)
☐ CORS configurado para dominio específico
☐ Helmet.js para headers de seguridad
☐ JWT con expiry corto (15min) + refresh token (7d)
☐ RBAC middleware que valida permisos por endpoint
☐ Workspace isolation (tenant_id en todas las queries)
☐ SQL injection prevention (parameterized queries / ORM)
☐ XSS prevention en rich text (sanitizar HTML en backend)
☐ CSRF protection
☐ Audit log de acciones sensibles
☐ Encriptación de passwords (bcrypt, cost factor 12)
☐ Ollama bind solo a 127.0.0.1 (nunca exponer al público)
☐ Proxy reverso (Nginx) para /api/ai con auth middleware
☐ File upload validation (tipo, tamaño, contenido)
```

---

*Documento generado como research & plan completo. Cada fase es implementable de forma independiente. El modelo de datos soporta extensibilidad sin breaking changes.*
