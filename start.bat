@echo off
setlocal EnableExtensions
title AUTO START (find package.json)

set "ROOT="

for /f "delims=" %%F in ('dir /s /b "%~dp0package.json" 2^>nul') do (
  set "ROOT=%%~dpF"
  goto FOUND
)

:FOUND
if "%ROOT%"=="" (
  echo [HIBA] Nem talalok package.json-t C:\Projects alatt.
  echo Ellenorizd, hogy a projekt tenyleg ide van kicsomagolva.
  goto END
)

echo [OK] Projekt gyoker:
echo %ROOT%
echo.

start "RUN" cmd /k "cd /d "%ROOT%" && npm install && npm run dev"

:END
echo.
echo Nyomj ENTER-t a bezarashoz...
pause >nul
endlocal