@echo off
rem Lanzador local de LibreSesh (demo). Doble clic y abre http://localhost:3000/e/democonf-2026
cd /d "%~dp0"
set DATABASE_PATH=%~dp0data\app.db
rem Secretos SIEMPRE en data\.env.local (fuera de git), una linea KEY=VALOR cada uno
rem tokens=1* keeps everything after the first "=", so a base64 secret ending in "==" survives
for /f "usebackq tokens=1* delims==" %%a in (`findstr /b COOKIE_SECRET= "%~dp0data\.env.local"`) do set COOKIE_SECRET=%%b
for /f "usebackq tokens=1* delims==" %%a in (`findstr /b INSTANCE_ADMIN_PASSWORD= "%~dp0data\.env.local"`) do set INSTANCE_ADMIN_PASSWORD=%%b
set SERVE_STATIC=1
set PORT=3000
set DEMO_MODE=1
start "" http://localhost:3000/e/democonf-2026
node server\dist\index.js
