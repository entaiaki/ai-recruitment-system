@echo off
chcp 65001 >nul
title AI 招聘系统 - 启动中...

echo ========================================
echo   🤖 AI 智能招聘系统
echo ========================================
echo.

cd /d "%~dp0"

:: ── 启动后端 ──
echo [1/2] 启动后端 (FastAPI :8000)...
start "AI招聘-后端" cmd /c "cd /d backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo       后端已启动，监听 http://localhost:8000

:: ── 种子 LLM 配置 ──
echo [2/3] 初始化 LLM 配置...
ping -n 4 127.0.0.1 >nul
cd /d backend && python seed_llm.py

:: ── 启动前端 ──
echo [3/3] 启动前端 (Vite :3000)...
start "AI招聘-前端" cmd /c "cd /d frontend && npm run dev"
echo       前端已启动，访问 http://localhost:3000

echo.
echo ========================================
echo   全部启动完成！
echo   打开浏览器 → http://localhost:3000
echo   登录凭据: admin@test.com / admin123
echo ========================================
echo.
echo   按任意键退出此窗口（不会关闭服务）
pause >nul
