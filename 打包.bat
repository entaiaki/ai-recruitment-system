@echo off
chcp 65001 >nul
title AI 招聘系统 - 生产构建

echo ========================================
echo   🔨 AI 招聘系统 — 生产环境打包构建
echo ========================================
echo.

cd /d "%~dp0"

:: ── 1. 构建 React 前端 ──
echo [1/2] 构建 React 前端...
cd /d "%cd%\frontend"
call npm run build
if %errorlevel% neq 0 (
    echo ❌ React 构建失败！
    pause
    exit /b 1
)

:: ── 2. 复制到后端静态目录 ──
echo [2/2] 复制到部署目录...
cd /d "%~dp0"
if not exist "%~dp0deploy" mkdir "%~dp0deploy"
xcopy /e /y "%~dp0backend\*" "%~dp0deploy\" 2>nul
del /q "%~dp0deploy\static\*.html" 2>nul
del /q "%~dp0deploy\static\*.css" 2>nul
del /q "%~dp0deploy\static\*.js" 2>nul
xcopy /e /y "%~dp0frontend\dist\*" "%~dp0deploy\static\" 2>nul
copy /y "%~dp0Dockerfile" "%~dp0deploy\" 2>nul
copy /y "%~dp0docker-compose.yml" "%~dp0deploy\" 2>nul

echo.
echo ========================================
echo   ✅ 构建完成！输出目录: deploy/
echo.
echo   🐳 Docker 部署（推荐）:
echo      cd deploy ^&^& docker-compose up -d
echo.
echo   🐍 直接运行:
echo      cd deploy ^&^& pip install -r requirements.txt
echo      python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
echo ========================================
pause
