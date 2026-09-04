$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$client = Join-Path $root "client\NatureScreensaver.csproj"
dotnet publish $client -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
$out = Join-Path $root "client\bin\Release\net8.0-windows\win-x64\publish"
Copy-Item (Join-Path $out "NatureScreensaver.exe") (Join-Path $out "NatureScreensaver.scr") -Force
Write-Host "Published self-contained build to $out"

$iscc = "C:\Users\원무과장\AppData\Local\Programs\Antigravity IDE\resources\app\node_modules\innosetup\bin\ISCC.exe"
if (Test-Path $iscc) {
    Write-Host "Compiling Inno Setup installer..."
    & $iscc (Join-Path $root "installer\NatureScreensaver.iss")
    Write-Host "Installer built successfully in installer\Output\NatureScreensaverSetup.exe"
}

