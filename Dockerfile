# ── AI 智能招聘系统 Docker 镜像（多阶段构建）──

# ── 阶段 1：构建 React 前端 ──
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── 阶段 2：运行时 ──
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# ── 复制 React 构建产物到静态目录 ──
COPY --from=frontend-builder /frontend/dist/ ./backend/static/

RUN mkdir -p /app/backend/uploads/resumes /app/backend/data

WORKDIR /app/backend

EXPOSE 8000

ENV DATABASE_URL=sqlite:///./data/ai_recruitment.db
ENV SECRET_KEY=change-me-in-production
ENV DEBUG=false

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
