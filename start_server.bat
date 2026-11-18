@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3010
set SEARCH_API_ONLY=1
set "PY=C:\Users\29531\AppData\Local\Doubao\User Data\sandbox_runtime\bases\772984f6fd3a8ae0ae7d2422cd7c2bfa\python\python.exe"
if not exist "%PY%" (
  for /d %%D in ("%LOCALAPPDATA%\Doubao\User Data\sandbox_runtime\bases\*") do (
    if exist "%%~fD\python\python.exe" set "PY=%%~fD\python\python.exe"
  )
)
if not exist "%PY%" (
  echo Python runtime not found.
  echo Please tell the assistant; do not close this window yet.
  pause
  exit /b 1
)
"%PY%" server.py
echo.
echo Search service stopped. Press any key to close.
pause >nul
