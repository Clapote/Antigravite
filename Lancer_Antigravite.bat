@echo off
chcp 65001 >nul
rem ==========================================================
rem   Antigravite - Lancement Desktop
rem ==========================================================

cd /d "%~dp0"
set "APP_DIR=%~dp0"
set "HTML_FILE=%APP_DIR%index.html"
set "HTML_URL=file:///%HTML_FILE:\=/%"
set "ELECTRON_EXE=node_modules\electron\dist\electron.exe"

if not exist "%HTML_FILE%" (
    echo [ERREUR] Le fichier index.html est INTROUVABLE dans le dossier !
    pause >nul
    exit /b 1
)

if exist "%ELECTRON_EXE%" (
    start "" /d "%~dp0" "%ELECTRON_EXE%" main.js
    exit /b 0
)

rem Mode de secours Edge / navigateur web
set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE_EXE (
    start "" "%EDGE_EXE%" --app="%HTML_URL%"
) else (
    start "" "%HTML_FILE%"
)
exit /b 0
