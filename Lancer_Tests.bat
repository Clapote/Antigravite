@echo off
rem ==========================================================
rem   Antigravite - Execution des tests unitaires
rem ==========================================================
echo Execution des tests unitaires...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content '%~dp0tests\run_tests.ps1' -Raw | Invoke-Expression"
echo.
pause