# PULSE BLOOM

웹 리듬 게임 — *치는 게임이 아니라, 피우는 게임.*

화면 고정 위치에 노트가 나타나고 바깥 링이 줄어듭니다. 링이 노트에 딱 맞는 순간 그 자리를 누르세요. 잘 누를수록 음악에 맞춰 꽃(블룸)이 핍니다. 모바일 멀티터치 지원.

## 플레이

- **게임:** [`index.html`](index.html) — 브라우저에서 열면 곡 선택부터 시작
- 곡 → 난이도 선택 → 시작
- **PC:** 마우스(또는 호버 모드) · **모바일:** 터치(멀티터치)
- **입력 오프셋 보정** 내장 — 블루투스 이어폰 지연은 `🎯 보정` 또는 결과 화면의 `📡 이 결과로 보정`으로 맞춤

## 수록곡

| 곡 | 난이도 | 비고 |
|---|---|---|
| ALICE IS — Miss Master | NORMAL (Lv.1) | 튜토리얼 (125 BPM) |
| ALICE IS — Want You | CHAOTIC (Lv.8) | 셋잇단 스트림 (125 BPM) |

난이도 체계: **Normal / Chaotic / End / Torment / ???** (튜토리얼은 Normal만)

## 구조

```
index.html              게임 (단일 파일, 빌드 불필요)
editor.html             채보 에디터 (개발자용 — 키보드로 타이밍 기록 → JSON)
assets/
  songs.js              곡 매니페스트 + 채보 데이터
  missmaster_audio.js   음원 (base64, 곡 선택 시 지연 로드)
  wantyou_audio.js
source/                 재채보용 원본 (배포에 불필요)
  *.mp3, *_timing.json
```

음원은 `<script>` 태그로 불러와서 별도 서버 API 없이 정적 호스팅·로컬 파일 모두에서 동작합니다.

## 배포 (모바일 접속용)

빌드 과정이 없는 정적 사이트입니다. 아래 중 아무거나:

- **Cloudflare Pages** — 이 레포 연결, 빌드 명령 없음, 출력 디렉터리 `/`
- **GitHub Pages** — Settings → Pages → 브랜치 `main` / `/ (root)`
- **로컬 테스트** — `npx serve .` 후 같은 와이파이의 폰에서 `http://<PC-IP>:3000`

## 채보 만들기

`editor.html`에서 음악을 불러와 키보드로 박자를 치면 타이밍이 `pulsebloom-timing-v1` JSON으로 기록됩니다. 그 JSON과 음원으로 위치·난이도를 붙여 완성 채보를 만듭니다.
