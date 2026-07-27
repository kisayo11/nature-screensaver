$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$client = Join-Path $root "client\NatureScreensaver.csproj"
dotnet publish $client -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true
$out = Join-Path $root "client\bin\Release
et8.0-windows\win-x64\publish"
Copy-Item (Join-Path $out "NatureScreensaver.exe") (Join-Path $out "NatureScreensaver.scr") -Force
Write-Host "Published to $out"
