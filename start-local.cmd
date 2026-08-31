@echo off
rem Lanzador local de LibreSesh (demo). Doble clic y abre http://localhost:3000/e/democonf-2026
cd /d "%~dp0"
set DATABASE_PATH=%~dp0data\app.db
for /f "usebackq tokens=2 delims==" %%a in ("%~dp0data\.env.local") do set COOKIE_SECRET=%%a
set SERVE_STATIC=1
set PORT=3000
set DEMO_MODE=1
start "" http://localhost:3000/e/democonf-2026
node server\dist\index.js
