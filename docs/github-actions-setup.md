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

---

# GitHub Actions 설정 가이드 (한국어)

## 권장 저장소 워크플로우

1. `nature-screensaver`와 같은 GitHub 저장소를 생성합니다.
2. 이 프로젝트를 저장소에 푸시합니다.
3. GitHub에서 `Settings > Pages`로 이동합니다.
4. `Build and deployment` 항목을 `GitHub Actions`로 설정합니다.
5. `main` 브랜치로 푸시하면 `deploy-admin-web.yml` 액션이 `admin-web` 폴더를 GitHub Pages로 배포합니다.

## 관리자 웹의 역할

관리자 웹은 정적 페이지입니다. `config.json` 텍스트를 생성하는 역할을 합니다.

MVP 운영 방식:

1. 링크 공유가 활성화된 상태로 구글 드라이브에 PNG 슬라이드 이미지를 업로드합니다.
2. 각 이미지의 직접 다운로드 URL을 관리자 웹에 입력합니다.
3. JSON을 생성합니다.
4. 이를 `published-config.json` 또는 `config.json` 파일로 저장합니다.
5. 링크 공유가 활성화된 상태로 설정 JSON을 구글 드라이브에 업로드합니다.
6. 구글 드라이브의 설정 다운로드 URL을 각 PC의 `%LOCALAPPDATA%\NatureScreensaver\settings.json`에 입력합니다.

## GitHub Actions 사용 이유

- 별도의 웹 서버 구축이 필요 없습니다.
- 관리자 웹이 버전 관리됩니다.
- 배포 전에 JSON 설정의 유효성을 검증할 수 있습니다.
- 향후 Windows 화면보호기 빌드 및 설치 파일 릴리즈 배포를 추가할 수 있습니다.

## 향후 워크플로우 확장

향후 GitHub Actions에서 Windows 클라이언트를 빌드하고 생성된 설치 프로그램(Installer)을 GitHub Releases에 자동 첨부하도록 구성할 수 있습니다.

## Vercel 배포 현황

현재 GitHub 플랜에서 비공개 저장소(Private Repo)의 GitHub Pages가 지원되지 않기 때문에 GitHub Pages 배포 대신 Vercel 배포로 전환되었습니다.

운영 중인 관리자 웹 주소:

```text
https://nature-screensaver.vercel.app
```

연결된 GitHub 저장소에 푸시하면 Vercel Git 연동을 통해 자동으로 배포됩니다.
