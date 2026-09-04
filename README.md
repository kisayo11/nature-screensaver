# 네이처 인증 화면보호기 (Nature Screensaver)

네이처 요양병원 4주기 의료기관 인증평가 대비 원내 공지 및 교육용 윈도우 화면보호기 시스템입니다.

---

## 🌟 주요 특징

* **원클릭 웹 관리자:** 구글 드라이브 링크 복사/붙여넣기 없이, 사진 파일을 드래그앤드롭하고 [배포하기] 버튼만 누르면 전 병원 PC에 자동 배포됩니다.
* **초고속 CDN & 4중 데이터 보존:** Vercel 글로벌 엣지 네트워크를 통한 실시간 동기화 + GitHub 영구 형상 관리 + 구글 드라이브 자동 백업.
* **듀얼 / 다중 모니터 완벽 지원:** 진료실, 원무과, 간호스테이션 등 다중 모니터 환경에서 모든 모니터의 환자 정보(EMR)를 완벽히 가려 의료정보 보호를 준수합니다.
* **자급형 단일 파일 설치 (Single-File):** .NET 8 런타임이 통째로 내장되어 대상 PC에 추가 프로그램 설치 없이 `NatureScreensaverSetup.exe` 하나로 설치 완료.
* **오프라인 안정성:** 인터넷이 일시 중단되어도 PC 로컬 캐시를 통해 중단 없이 화면보호기가 연속 재생됩니다.

---

## 🚀 빠른 시작

### 1. 관리자 웹 실행 (슬라이드 등록 및 배포)
```bash
npm run dev
```
브라우저에서 `http://localhost:3000` 접속 후 사진을 올리고 **[배포하기]** 클릭.

### 2. 병원 PC 설치
* 설치 파일 위치: `installer\Output\NatureScreensaverSetup.exe`
* 대상 PC에서 실행하여 1회 설치 (설정 불필요, 자동 10분 대기시간 적용).

---

## 📚 상세 문서

* [운영 및 세팅 가이드 (docs/operation-and-setup-guide.md)](docs/operation-and-setup-guide.md)
* [구글 앱스 스크립트 백업 연동 가이드 (docs/google-apps-script-setup.md)](docs/google-apps-script-setup.md)
* [워크플로우 개선 보고서 (docs/workflow-improvement-report.md)](docs/workflow-improvement-report.md)
