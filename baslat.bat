@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden kur.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Kurulum yapiliyor, ilk seferde birkac dakika surebilir...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node server.js --open
if errorlevel 1 pause
