@echo off
cd /d "%~dp0"
echo.
echo === NAPETSCHNIG. Git Push ===
echo.
echo Pruefe auf nicht-committete Aenderungen...
git add -A
git diff --cached --quiet
if errorlevel 1 (
    echo Neue Aenderungen gefunden - committe...
    git commit -m "Update %date% %time:~0,5%"
) else (
    echo Keine neuen Aenderungen - nur Push.
)
echo.
echo Pushe nach GitHub...
git push origin master
echo.
if errorlevel 1 (
    echo === FEHLER beim Push! ===
) else (
    echo === Erfolgreich gepusht! Vercel deployt automatisch. ===
)
pause
