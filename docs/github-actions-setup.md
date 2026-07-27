# GitHub Actions setup

## Recommended repository flow

1. Create a GitHub repository, for example `nature-screensaver`.
2. Push this project to the repository.
3. In GitHub, open `Settings > Pages`.
4. Set `Build and deployment` to `GitHub Actions`.
5. Push to `main`; `deploy-admin-web.yml` publishes the `admin-web` folder as GitHub Pages.

## Admin web role

The admin web is a static page. It generates `config.json` text.

For MVP operation:

1. Upload PNG slides to Google Drive with link sharing enabled.
2. Enter each direct download URL in the admin web.
3. Generate JSON.
4. Save it as `published-config.json` or `config.json`.
5. Upload the config JSON to Google Drive with link sharing enabled.
6. Put the Google Drive config download URL into each PC's `%LOCALAPPDATA%\NatureScreensaver\settings.json`.

## Why GitHub Actions

- No separate web server is needed.
- Admin web is version-controlled.
- JSON config can be validated before deployment.
- Later, we can add release builds for the Windows screensaver and installer.

## Next possible workflow

A later workflow can build the Windows client on GitHub Actions and attach installer artifacts to GitHub Releases.

## Vercel deployment status

GitHub Pages deployment was replaced with Vercel because private repository Pages is not supported on the current GitHub plan.

Production admin web:

```text
https://nature-screensaver.vercel.app
```

Future pushes to the connected GitHub repository can be deployed through the Vercel Git integration.
