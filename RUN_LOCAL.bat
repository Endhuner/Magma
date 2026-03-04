@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo RUN_LOCAL
echo Mappa: %CD%
echo ========================================
echo.

if not exist package.json (
  echo [HIBA] Nincs package.json ebben a mappaban. Rossz helyre tetted a bat-okat.
  goto END
)

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [HIBA] Node.js nincs telepitve / nincs PATH-ban.
  goto END
)

echo [INFO] Node:
node -v
echo.

echo [INFO] Tiszta ujratelepites...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

npm cache clean --force

echo [INFO] npm install...
npm install
if %errorlevel% neq 0 (
  echo [HIBA] npm install sikertelen.
  goto END
)

echo.
echo [INFO] Inditas: npm run dev
echo [INFO] Bongeszot megnyitom: http://localhost:5173/
start "" cmd /c "timeout /t 2 >nul && start http://localhost:5173/"

npm run dev

:END
echo.
echo ========================================
echo VEGE - EZT LÁTNOD KELL. (Ablak nyitva marad.)
echo ========================================
echo Nyomj egy billentyut a kilepeshez...
pause >nul
endlocal