# TaskBoard AI

Sistema de gestión de proyectos multi-tenant con capa de IA local (Ollama + Qwen 3.5).
Inspirado en Linear, Jira y Trello — estructura Scrumban por defecto, workflows configurables.

> **Nota:** el nombre es provisional. Un rebranding es probable antes del launch.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue 3 (`<script setup>`) + Vite + Vue Router + Pinia + GSAP |
| Backend | Node.js + Fastify + Zod |
| DB | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Auth | JWT (access + refresh) + bcrypt + RBAC |
| Real-time | WebSockets (fastify-websocket) |
| IA | Ollama + Qwen 3.5 (self-hosted, zero-cost) |

## Estructura

```
taskboard-ai/
  backend/        Fastify API
  frontend/       Vue 3 SPA
  docs/           Plan y decisiones de diseño
  docker-compose.yml
```

## Setup local

**Requisitos:** Node 20+, Docker Desktop, npm 10+.

```bash
# 1. Levantar Postgres + Redis
npm run db:up

# 2. Instalar dependencias
npm install

# 3. Configurar env del backend
cp backend/.env.example backend/.env

# 4. Correr migraciones
npm run db:migrate

# 5. Dev servers (backend :3000, frontend :5173)
npm run dev
```

## IA local (Ollama + Qwen 3.5)

La capa de IA es **opcional** — si Ollama no está corriendo, la app funciona normalmente y los botones de IA quedan ocultos.

```bash
# 1. Instalar Ollama (https://ollama.com/download)

# 2. Descargar modelos
ollama pull qwen3.5:9b      # 6.6 GB — modelo principal (rápido)
ollama pull qwen3.5:27b     # 17 GB  — opcional (planning, generate)

# 3. Verificar
curl http://localhost:11434/api/tags

# 4. Warmup del modelo principal
curl http://localhost:11434/api/generate -d '{
  "model": "qwen3.5:9b",
  "keep_alive": "24h",
  "prompt": "warmup"
}'
```

Override de modelos en `backend/.env`:
```
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL_QUICK=qwen3.5:9b      # enhance, suggest, duplicates, chat
OLLAMA_MODEL_STANDARD=qwen3.5:27b  # generate-tasks, sprint-plan
```

**Features de IA disponibles:**
- ✦ Generar issues desde un objetivo en lenguaje natural (sidebar)
- ✦ Mejorar descripciones de issue inline
- ✦ Sugerir prioridad basada en título + descripción
- ✦ Detectar duplicados al crear (próximamente surface en UI)
- ✦ Planificar cycle priorizando backlog y respetando capacidad
- ✦ Chat contextual con streaming SSE (atajo `G`)

Todo persistido en `ai_action_logs` (auditable) y `ai_conversations`.

## Roadmap

Plan completo en `docs/ULTRAPLAN-TaskBoard-AI.md`.

- **Fase 1 — MVP Core:** auth, workspace, team, project, issue, board view, labels
- **Fase 2 — Workflows & Cycles:** workflows custom, WIP limits, cycles, sub-issues
- **Fase 3 — IA:** generación de tareas, sprint planning, duplicados, chat contextual
- **Fase 4 — Analytics:** velocity, burndown, dashboards
- **Fase 5 — Advanced:** custom fields, automation rules, real-time, attachments
- **Fase 6 — Scale:** billing, webhooks, integraciones, mobile

## Decisiones tomadas

- **Backend:** Fastify sobre Express — schema validation nativa, mejor perf, ecosistema plugin limpio.
- **DB:** PostgreSQL — JSONB para `settings`/`filters`, full-text search nativo.
- **IA:** Ollama local, zero API cost, 256K context en Qwen 3.5.
- **Monorepo:** npm workspaces — simple, sin overhead de turborepo.
