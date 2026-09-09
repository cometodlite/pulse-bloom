# 음원 정규화 + 오프셋 정리 — 2026-09-09 (Claude 후속)

Astra의 `af824ba` 이후, 검증 리뷰 1번(음원 클리핑/음량)·4번(offset) 처리.

## 1. 음원 정규화 (Why We Still Live / 사랑하는 그대에게)

리뷰가 지적한 두 곡만 EBU R128 2-pass loudnorm 적용. 나머지 3곡(Miss Master / Want You / Cut Your String)은
이미 -13.5~-14.6 LUFS로 일관돼 있고 소스 마스터와 바이트 동일하므로 **건드리지 않음**.

| 곡 | 정규화 전 | 정규화 후 |
|---|---|---|
| Why We Still Live | -5.1 LUFS · TP +7.63 dBFS | -13.9 LUFS · TP -1.1 dBTP |
| 사랑하는 그대에게 | -11.0 LUFS · TP +2.75 dBFS | -14.0 LUFS · TP -1.2 dBTP |

- 브라우저 `decodeAudioData` 실측 피크: WWSL -1.27 / Dear -1.50 dBFS (정규화 전 둘 다 0.00 = 클리핑)
- 5곡 RMS 범위: 정규화 전 -8.4~-17.1 → 후 -15.1~-17.1 (WWSL 아웃라이어 해소)
- 재인코딩: `libmp3lame -q:a 0` (V0). 길이 오차 0.0ms, 원본 대비 싱크 0.0ms (교차상관 확인). `songs.js`의 duration·채보 시각 영향 없음
- `assets/*_audio.js` 2개 + `assets/{why-we-still-live,dear-to-my-love}.mp3` 갱신, `manifest.json` 해시 재생성
- 잔여: 부동소수 디코드 시 +1.3 dBFS 인터샘플 오버슈트 — MP3 고유 특성이며 Miss Master(리뷰 미지적)와 동급.
  게임 `musicGain=0.8`(-1.94 dB) 적용 시 출력 여유 있음
- **소스 마스터**(`source/*.mp3`)는 원본 그대로 유지. 임베디드 음원과 더 이상 바이트 동일하지 않음(정규화 반영분) — 정상

## 4. 오프셋 의미 정리 (문서화만, 동작 변경 없음)

- **게임 런타임** (`app-game.js` `buildObjects`): 노트 `t` = 절대 초. 유일한 시프트는 `chart.offset`(밀리초, 더함).
  현재 모든 채보가 `chart.offset` 미설정 → 시프트 0.
- **`song.offset`** (초): 노트 타이밍에 **적용 안 됨**. `app-dev.js`의 BPM 그리드 앵커로만 쓰임. Miss Master의 `song.offset=0.206`은 dev 그리드용.
- 에디터 `effT`는 `offsetMs`(입력 지연 보정, 초 환산)를 빼고 0으로 clamp — 이건 편집 중 미리보기용이고 export 시 이미 반영됨.
- 결론: 부호·단위·적용 위치가 세 군데(chart.offset ms / song.offset s / editor offsetMs)에서 다르므로 채보 편집 시 주의.
  `app-game.js:18-20`에 주석 추가함.
