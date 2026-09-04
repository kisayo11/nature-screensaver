# Google Apps Script (GAS) Setup Guide for config.json Auto-Upload (English)

This is a one-time setup guide to enable automatic overwriting and uploading of the `config.json` file in Google Drive with a single click from the Admin Web App.

---

## Step 1: Create Google Apps Script (Takes about 1 minute)

1. Sign in to Google Drive and open [Google Apps Script (script.google.com)](https://script.google.com).
2. Click the **[New project]** button in the top left.
3. Delete all existing code and paste the following code:

```javascript
function doPost(e) {
  try {
    // Enter the file ID of config.json on Google Drive below.
    // e.g., if https://drive.google.com/file/d/1A2B3C4D5E.../view, 1A2B3C4D5E... is the FILE_ID.
    var TARGET_FILE_ID = "YOUR_GOOGLE_DRIVE_CONFIG_JSON_FILE_ID_HERE";
    
    var jsonString = e.postData.contents;
    var file = DriveApp.getFileById(TARGET_FILE_ID);
    file.setContent(jsonString);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "config.json updated successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

> **TIP (How to find File ID):**
> If your Google Drive `config.json` link is `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view`, the string `1AbCdEfGhIjKlMnOp` between `/d/` and `/view` is the **FILE_ID**.

---

## Step 2: Deploy as a Web App

1. Click **[Deploy]** -> **[New deployment]** at the top right.
2. Click the gear icon (Select type) and select **[Web app]**.
3. Configure the following options:
   - **Description**: `Nature Screensaver Config Uploader`
   - **Execute as**: `Me (your email)`
   - **Who has access**: **`Anyone`**
4. Click the **[Deploy]** button at the bottom. When the Google permission authorization window appears, proceed with **[Review permissions]** -> **[Advanced]** -> **[Go to ... (unsafe)]** -> **[Allow]**.
5. Once deployment is complete, copy the generated **Web app URL** (e.g., `https://script.google.com/macros/s/.../exec`).

---

## Step 3: Register URL in Admin Web

1. Access the `Nature Screensaver Admin Web` and paste the copied **Web app URL** into the **[Google Drive Sync Settings]** field at the top.
2. Now, after configuring slides, simply click **[Upload config.json to Google Drive]** to automatically update `config.json` in Google Drive!

---

# Google Apps Script(GAS)를 이용한 config.json 자동 업로드 세팅 가이드 (한국어)

관리자 웹앱에서 버튼 클릭 한 번으로 구글 드라이브의 `config.json` 파일을 자동으로 덮어쓰기 업로드하기 위한 원타임(1회) 세팅 가이드입니다.

---

## 1단계: Google Apps Script 생성 (약 1분 소요)

1. 구글 드라이브에 로그인 후 [Google Apps Script (script.google.com)](https://script.google.com)에 접속합니다.
2. 좌측 상단의 **[새 프로젝트]** 버튼을 클릭합니다.
3. 기존 코드를 모두 지우고 아래의 코드를 붙여넣습니다:

```javascript
function doPost(e) {
  try {
    // 구글 드라이브의 config.json 파일 ID를 아래 입력하세요.
    // 예: https://drive.google.com/file/d/1A2B3C4D5E.../view 이라면 1A2B3C4D5E... 가 FILE_ID입니다.
    var TARGET_FILE_ID = "여기에_구글드라이브_CONFIG_JSON_파일ID_입력";
    
    var jsonString = e.postData.contents;
    var file = DriveApp.getFileById(TARGET_FILE_ID);
    file.setContent(jsonString);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "config.json updated successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

> **TIP (파일 ID 확인 방법):**
> 구글 드라이브의 `config.json` 링크가 `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view` 일 경우, `/d/`와 `/view` 사이의 `1AbCdEfGhIjKlMnOp` 문자가 **FILE_ID**입니다.

---

## 2단계: 웹앱으로 배포하기

1. 우측 상단의 **[배포]** -> **[새 배포]**를 클릭합니다.
2. 톱니바퀴 아이콘(유형 선택)을 누르고 **[웹 앱]**을 선택합니다.
3. 다음 옵션을 설정합니다:
   - **설명**: `Nature Screensaver Config Uploader`
   - **다음 사용자 권한으로 실행**: `나(사용자 이메일)`
   - **액세스 권한 있는 사용자**: **`모든 사용자`** (Anyone)
4. 하단의 **[배포]** 버튼을 누르고, 구글 권한 승인 창이 뜨면 **[권한 검토]** -> **[고급]** -> **[안전하지 않음으로 이동]** -> **[허용]**을 진행합니다.
5. 배포가 완료되면 생성된 **웹 앱 URL** (예: `https://script.google.com/macros/s/.../exec`)을 복사합니다.

---

## 3단계: 어드민 웹에 URL 등록하기

1. `Nature Screensaver 관리자 웹` 접속 후 상단의 **[구글드라이브 연동 설정]** 란에 복사한 **웹 앱 URL**을 붙여넣습니다.
2. 이제 슬라이드 설정 후 **[구글 드라이브에 config.json 업로드]** 버튼을 누르면 구글 드라이브의 `config.json`이 자동으로 업데이트됩니다!
