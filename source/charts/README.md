# 버전 관리되는 편집용 채보

이 폴더는 현재 `assets/songs.js`에서 손실 없이 추출한 5곡·10개 채보의 스냅샷입니다. 예전 `source/*_timing.json` 및 `source/backups`는 과거 자료이며 최신 배포본이 아닙니다.

각 `곡ID_난이도.json`은 에디터가 직접 가져올 수 있는 objects 배열입니다. `manifest.json`은 곡 정보, 난이도 정보(레벨·approach·offset·captions 등), 노트 수, 디코딩 전 MP3 바이트의 SHA-256을 보관합니다. 스키마 이름의 v1과 revision은 이 최초 스냅샷의 형식/개정 번호입니다.

시간 t와 dur은 초, chart.offset은 밀리초입니다. 배열은 런타임 원본 t를 보존하며 chart.offset은 합산하지 않습니다. 현재 10개 채보는 별도 chart.offset이 없습니다. 에디터에서 음원을 먼저 불러오고 입력 오프셋을 0ms로 설정한 뒤 배열 JSON을 가져오세요. 배열 가져오기는 제목/BPM/난이도 메타데이터를 자동 복원하지 않으므로 manifest를 참고하세요. 기존 notesAdjusted 형식은 좌표·오프셋 처리 방식이 달라 사용하지 않습니다.

저장소 루트에서 다음 명령으로 배포본과 편집본의 완전한 데이터 일치 및 음원 해시를 확인합니다.

```sh
python3 scripts/sync-charts.py
```

songs.js 또는 임베디드 음원을 수정한 담당자가 최신 스냅샷을 다시 만들 때만 다음을 실행합니다. 기존 편집용 JSON을 덮어쓰므로 미반영 편집이 있으면 먼저 보존하세요.

```sh
python3 scripts/sync-charts.py --export
```

이 도구는 songs.js를 쓰지 않습니다. 편집용 JSON을 변경한 것만으로 게임에 반영되지는 않습니다. 배포 파일 반영은 단독 담당자가 수행하고 스냅샷을 재추출합니다. 한 줄짜리 songs.js는 동시에 수정하거나 텍스트 충돌을 자동 병합하지 마세요. 음원 정규화 후에는 음원 해시가 바뀌므로 재추출이 필요합니다.
