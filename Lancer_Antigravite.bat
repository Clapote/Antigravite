@echo off
rem ==========================================================
rem   Antigravite - Diagnostic et Lancement Desktop
rem ==========================================================

set "APP_DIR=%~dp0"
set "HTML_FILE=%APP_DIR%index.html"
set "HTML_URL=file:///%HTML_FILE:\=/%"
set "ELECTRON_EXE=%APP_DIR%node_modules\electron\dist\electron.exe"

echo ==========================================================
echo        Antigravite - Diagnostic et Lancement
echo ==========================================================
echo [1] Dossier de travail (APP_DIR) :
echo     "%APP_DIR%"
echo.
echo [2] Fichier cible (HTML_FILE) :
echo     "%HTML_FILE%"
echo.

if not exist "%HTML_FILE%" (
    echo [ERREUR] Le fichier index.html est INTROUVABLE dans le dossier !
    echo Verifiez que index.html et Lancer_Antigravite.bat sont dans le meme dossier.
    echo.
    echo Appuyez sur une touche pour quitter...
    pause >nul
    exit /b 1
)

echo [3] Verification d'existence :
echo     [OK] index.html a bien ete detecte.
echo.

if exist "%ELECTRON_EXE%" (
    echo [4] Moteur Desktop Electron detecte :
    echo     "%ELECTRON_EXE%"
    echo.
    echo [5] Lancement de l'application dans sa fenetre native Electron...
    echo.
    start "" "%ELECTRON_EXE%" "%APP_DIR%."
    goto :fin
)

echo [4] Electron n'a pas ete trouve dans node_modules.
echo     Passage en mode de secours navigateur web.
echo.

set "EDGE_EXE="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE_EXE if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE_EXE (
    echo [5] Navigateur utilise (Mode secours Edge) :
    echo     "%EDGE_EXE%"
    echo.
    echo [6] Commande de lancement executee :
    echo     start "" "%EDGE_EXE%" --app="%HTML_URL%"
    echo.
    start "" "%EDGE_EXE%" --app="%HTML_URL%"
) else (
    echo [5] Microsoft Edge introuvable dans les chemins standards.
    echo [6] Ouverture via l'association Windows par defaut :
    echo     start "" "%HTML_FILE%"
    echo.
    start "" "%HTML_FILE%"
)

:fin
echo ==========================================================
echo Lancement effectue !
echo - Si l'application s'est ouverte dans sa fenetre, tout fonctionne.
echo - Vous pouvez appuyer sur une touche pour fermer ce terminal.
echo ==========================================================
pause >nul
