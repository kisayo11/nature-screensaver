$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$client = Join-Path $root "client\NatureScreensaver.csproj"
dotnet publish $client -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
$out = Join-Path $root "client\bin\Release\net8.0-windows\win-x64\publish"
Copy-Item (Join-Path $out "NatureScreensaver.exe") (Join-Path $out "NatureScreensaver.scr") -Force
Write-Host "Published self-contained build to $out"

$isccCandidates = @(
    (Get-Command iscc.exe -ErrorAction SilentlyContinue)?.Source,
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe",
    "${env:LOCALAPPDATA}\Programs\Antigravity IDE\resources\app\node_modules\innosetup\bin\ISCC.exe"
)

$iscc = $isccCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($iscc) {
    Write-Host "Compiling Inno Setup installer using: $iscc"
    & $iscc (Join-Path $root "installer\NatureScreensaver.iss")
    Write-Host "Installer built successfully in installer\Output\NatureScreensaverSetup.exe"
} else {
    Write-Warning "Inno Setup compiler (ISCC.exe) not found. Skipped installer packaging. The binary is ready at $out"
}

