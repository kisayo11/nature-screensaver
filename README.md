# Nature Screensaver

Lightweight Windows screensaver project for hospital accreditation reminder slides.

## MVP scope

- Windows screensaver client
- Public Google Drive config.json URL
- PNG download and local cache
- Continue playing cached slides when internet is unavailable
- Static admin web page to generate config.json
- Inno Setup installer draft

## Workflow

1. Export PPT slides as PNG.
2. Upload PNG files to Google Drive with link sharing enabled.
3. Use admin-web to enter slide order, file names, Google Drive download URLs, duration, and update interval.
4. Upload generated config.json to Google Drive with link sharing enabled.
5. Each PC downloads config.json, downloads changed PNG files, caches them locally, and plays cached slides.

## Recommended slide file names

```text
01_patient_rights.png
02_patient_identification.png
03_fire_response.png
```

## Local cache

```text
%LOCALAPPDATA%\\NatureScreensaver\\cache
```

## Build requirement

This PC currently has .NET Runtime only, not .NET SDK. Install .NET 8 SDK to build.

```powershell
.\\scripts\\build.ps1
```

For a smaller installer, use framework-dependent publish. Target PCs need .NET Desktop Runtime 8.


## GitHub Actions

This project includes two starter workflows.

- `.github/workflows/deploy-admin-web.yml`: deploys `admin-web` to GitHub Pages.
- `.github/workflows/validate-config.yml`: validates `config.sample.json` and `published-config.json`.

See `docs/github-actions-setup.md` for setup steps.
