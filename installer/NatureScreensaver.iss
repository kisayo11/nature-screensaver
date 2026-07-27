#define AppName "Nature Screensaver"
#define AppExe "NatureScreensaver.exe"

[Setup]
AppId={{B50E2B50-D500-4DA9-A0D0-52E4C8E2C1AE}
AppName={#AppName}
AppVersion=0.1.0
DefaultDirName={autopf}\NatureScreensaver
DefaultGroupName=NatureScreensaver
OutputBaseFilename=NatureScreensaverSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
Source: "..\client\bin\Release
et8.0-windows\win-x64\publish\NatureScreensaver.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\client\bin\Release
et8.0-windows\win-x64\publish\NatureScreensaver.scr"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\sample-content\settings.sample.json"; DestDir: "{localappdata}\NatureScreensaver"; DestName: "settings.json"; Flags: onlyifdoesntexist

[Registry]
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "SCRNSAVE.EXE"; ValueData: "{app}\NatureScreensaver.scr"
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveActive"; ValueData: "1"
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveTimeOut"; ValueData: "600"

[Icons]
Name: "{group}\Nature Screensaver Settings"; Filename: "{app}\NatureScreensaver.exe"; Parameters: "/c"
