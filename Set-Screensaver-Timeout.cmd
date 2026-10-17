@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "PS1_PATH=%SCRIPT_DIR%scripts\set-screensaver.ps1"

if not exist "%PS1_PATH%" set "PS1_PATH=%SCRIPT_DIR%set-screensaver.ps1"
if not exist "%PS1_PATH%" set "PS1_PATH=%LOCALAPPDATA%\Programs\NatureScreensaver\scripts\set-screensaver.ps1"

if exist "%PS1_PATH%" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1_PATH%" %*
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$reg='HKCU:\Control Panel\Desktop'; $scr=Join-Path $env:LOCALAPPDATA 'Programs\NatureScreensaver\NatureScreensaver.scr'; Set-ItemProperty -Path $reg -Name 'SCRNSAVE.EXE' -Value $scr; Set-ItemProperty -Path $reg -Name 'ScreenSaveActive' -Value '1'; Set-ItemProperty -Path $reg -Name 'ScreenSaveTimeOut' -Value '180'; Write-Host 'Screensaver set to 3 minutes (180s) successfully!' -ForegroundColor Green;"
    pause
)
endlocal
