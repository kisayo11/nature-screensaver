#define AppName "Nature Screensaver"
#define AppVersion "0.1.0"

[Setup]
AppId={{B50E2B50-D500-4DA9-A0D0-52E4C8E2C1AE}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\NatureScreensaver
DefaultGroupName=NatureScreensaver
OutputDir=Output
OutputBaseFilename=NatureScreensaverSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
UninstallDisplayName={#AppName}

[Files]
Source: "..\client\bin\Release\net8.0-windows\win-x64\publish\NatureScreensaver.exe"; DestDir: "{app}"; Flags: ignoreversion; AfterInstall: CopyScrFile
Source: "..\sample-content\settings.sample.json"; DestDir: "{localappdata}\NatureScreensaver"; DestName: "settings.json"; Flags: ignoreversion
Source: "..\Set-Screensaver-Timeout.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\화면보호기_시간설정.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\set-screensaver.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[InstallDelete]
Type: files; Name: "{app}\NatureScreensaver.scr"

[Registry]
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "SCRNSAVE.EXE"; ValueData: "{app}\NatureScreensaver.scr"
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveActive"; ValueData: "1"
Root: HKCU; Subkey: "Control Panel\Desktop"; ValueType: string; ValueName: "ScreenSaveTimeOut"; ValueData: "180"

[Icons]
Name: "{group}\Nature Screensaver Settings"; Filename: "{app}\NatureScreensaver.exe"; Parameters: "/c"
Name: "{group}\화면보호기 시간 설정 (3분·5분 원클릭)"; Filename: "{app}\화면보호기_시간설정.cmd"; IconFilename: "{app}\NatureScreensaver.exe"
Name: "{group}\Uninstall Nature Screensaver"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\NatureScreensaver.exe"; Parameters: "/c"; Description: "Open settings notice"; Flags: postinstall skipifsilent nowait

[Code]
procedure CopyScrFile;
begin
  FileCopy(ExpandConstant('{app}\NatureScreensaver.exe'), ExpandConstant('{app}\NatureScreensaver.scr'), False);
end;
