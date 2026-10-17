[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [int]$Minutes = 0,
    [switch]$Test
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$regPath = "HKCU:\Control Panel\Desktop"

function Get-CurrentSettings {
    $curScr = (Get-ItemProperty -Path $regPath -Name "SCRNSAVE.EXE" -ErrorAction SilentlyContinue).'SCRNSAVE.EXE'
    $curActive = (Get-ItemProperty -Path $regPath -Name "ScreenSaveActive" -ErrorAction SilentlyContinue).'ScreenSaveActive'
    $curTimeout = (Get-ItemProperty -Path $regPath -Name "ScreenSaveTimeOut" -ErrorAction SilentlyContinue).'ScreenSaveTimeOut'

    return [PSCustomObject]@{
        ScrPath = $curScr
        IsActive = ($curActive -eq "1")
        TimeoutSec = [int]$curTimeout
        TimeoutMin = [math]::Round(([double]$curTimeout / 60), 1)
    }
}

function Find-NatureScr {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\NatureScreensaver\NatureScreensaver.scr",
        "$env:LOCALAPPDATA\Programs\NatureScreensaver\NatureScreensaver.exe",
        "$PSScriptRoot\NatureScreensaver.scr",
        "$PSScriptRoot\NatureScreensaver.exe",
        "$PSScriptRoot\..\client\bin\Release\net8.0-windows\win-x64\publish\NatureScreensaver.scr",
        "$PSScriptRoot\..\client\bin\Release\net8.0-windows\win-x64\publish\NatureScreensaver.exe"
    )

    foreach ($p in $candidates) {
        if (Test-Path $p) {
            return (Resolve-Path $p).Path
        }
    }
    return "$env:LOCALAPPDATA\Programs\NatureScreensaver\NatureScreensaver.scr"
}

function Apply-ScreensaverSetting ([int]$targetMin) {
    if ($targetMin -le 0) {
        Write-Host "대기 시간은 1분 이상이어야 합니다." -ForegroundColor Red
        return $false
    }

    $timeoutSec = [uint32]($targetMin * 60)
    $scrPath = Find-NatureScr

    Write-Host ""
    Write-Host "설정을 적용하고 있습니다..." -ForegroundColor Cyan

    Set-ItemProperty -Path $regPath -Name "SCRNSAVE.EXE" -Value $scrPath -Type String
    Set-ItemProperty -Path $regPath -Name "ScreenSaveActive" -Value "1" -Type String
    Set-ItemProperty -Path $regPath -Name "ScreenSaveTimeOut" -Value "$timeoutSec" -Type String

    $sig = '[DllImport("user32.dll", SetLastError = true)] public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);'

    try {
        Add-Type -MemberDefinition $sig -Name "ScreenSaverApi" -Namespace "NativeWin32" -ErrorAction SilentlyContinue
    } catch {}

    try {
        [NativeWin32.ScreenSaverApi]::SystemParametersInfo(0x000F, $timeoutSec, [IntPtr]::Zero, 3) | Out-Null
        [NativeWin32.ScreenSaverApi]::SystemParametersInfo(0x0011, 1, [IntPtr]::Zero, 3) | Out-Null
    } catch {
        Write-Warning "Windows API 호출 경고: $_"
    }

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  [설정 완료!] 윈도우 설정창에 들어갈 필요 없이 즉시 적용되었습니다." -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  * 적용된 화면보호기 : $scrPath"
    Write-Host "  * 화면보호기 상태   : 활성화됨 (Active: ON)" -ForegroundColor Green
    Write-Host "  * 대기 시간         : $targetMin 분 ($timeoutSec 초)" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Green
    Write-Host "  이제 $targetMin 분 동안 마우스/키보드 입력이 없으면 화면보호기가 자동 실행됩니다." -ForegroundColor Cyan
    Write-Host ""
    return $true
}

function Run-ScreensaverTest {
    $scrPath = Find-NatureScr
    if (Test-Path $scrPath) {
        Write-Host ""
        Write-Host "화면보호기를 즉시 실행합니다..." -ForegroundColor Cyan
        Write-Host "(마우스를 움직이거나 키보드를 누르면 종료됩니다)" -ForegroundColor Gray
        Start-Process -FilePath $scrPath -ArgumentList "/s"
    } else {
        Write-Host "화면보호기 실행 파일을 찾을 수 없습니다: $scrPath" -ForegroundColor Red
    }
}

if ($Test) {
    Run-ScreensaverTest
    return
}

if ($Minutes -gt 0) {
    Apply-ScreensaverSetting -targetMin $Minutes | Out-Null
    return
}

while ($true) {
    Clear-Host
    $cur = Get-CurrentSettings

    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "    [네이처 요양병원] 화면보호기 & 대기시간 원클릭 자동 설정 도구     " -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [현재 시스템 상태]" -ForegroundColor White
    Write-Host "  - 등록 파일 : $($cur.ScrPath)"
    Write-Host "  - 사용 여부 : $(if ($cur.IsActive) { '켜짐 (ON)' } else { '꺼짐 (OFF)' })"
    Write-Host "  - 대기 시간 : $($cur.TimeoutMin)분 ($($cur.TimeoutSec)초)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] 3분 (180초) - 병원 평가인증 및 개인정보보호 기본 권장 [추천]" -ForegroundColor Green
    Write-Host "  [2] 5분 (300초) - 일반 업무용 표준 대기시간"
    Write-Host "  [3] 1분 (60초)  - 정상 작동 테스트용"
    Write-Host "  [4] 직접 입력 (원하는 분 단위 정수)"
    Write-Host "  [5] 화면보호기 지금 즉시 실행해보기"
    Write-Host "  [0] 닫기 (종료)"
    Write-Host "======================================================================" -ForegroundColor Cyan

    $choice = Read-Host "  원하시는 번호를 선택하세요 [기본값: 1 (3분)]"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

    switch ($choice) {
        "1" {
            Apply-ScreensaverSetting -targetMin 3 | Out-Null
            Read-Host "  종료하려면 Enter 키를 누르세요..."
            return
        }
        "2" {
            Apply-ScreensaverSetting -targetMin 5 | Out-Null
            Read-Host "  종료하려면 Enter 키를 누르세요..."
            return
        }
        "3" {
            Apply-ScreensaverSetting -targetMin 1 | Out-Null
            Read-Host "  종료하려면 Enter 키를 누르세요..."
            return
        }
        "4" {
            Write-Host ""
            $custom = Read-Host "  원하시는 대기 시간(분 단위 정수)을 입력하세요"
            if ($custom -match '^\d+$' -and [int]$custom -gt 0) {
                Apply-ScreensaverSetting -targetMin ([int]$custom) | Out-Null
                Read-Host "  종료하려면 Enter 키를 누르세요..."
                return
            } else {
                Write-Host "  올바른 숫자를 입력해주세요." -ForegroundColor Red
                Start-Sleep -Seconds 2
            }
        }
        "5" {
            Run-ScreensaverTest
            Start-Sleep -Seconds 2
        }
        "0" {
            return
        }
        default {
            Write-Host "  잘못된 선택입니다. 다시 선택해주세요." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}