@echo off
rem Lanzador local de LibreSesh (demo). Doble clic y abre http://localhost:3000/e/democonf-2026
cd /d "%~dp0"
set DATABASE_PATH=%~dp0data\app.db
rem Secretos SIEMPRE en data\.env.local (fuera de git), una linea KEY=VALOR cada uno
for /f "usebackq tokens=2 delims==" %%a in (`findstr /b COOKIE_SECRET= "%~dp0data\.env.local"`) do set COOKIE_SECRET=%%a
for /f "usebackq tokens=2 delims==" %%a in (`findstr /b INSTANCE_ADMIN_PASSWORD= "%~dp0data\.env.local"`) do set INSTANCE_ADMIN_PASSWORD=%%a
set SERVE_STATIC=1
set PORT=3000
set DEMO_MODE=1
start "" http://localhost:3000/e/democonf-2026
node server\dist\index.js
