# 이미지 관리

이미지 폴더: `C:\LuckyMate\public\images` (웹 경로 `/images/`).

## S02 항목 아이콘

아래 이름의 PNG를 추가하거나 덮어쓰면 S02 아이콘을 교체합니다. 금전·학업·일·행운에는 피그마 원본 PNG를 넣었습니다. 연애는 `figma/category-love.svg` 원본 하트를 기본으로 표시하며, `icon-love.png`를 추가하면 이 이미지를 우선 사용합니다. 이미지가 모두 읽히지 않으면 기존 이모지를 표시합니다.

| 항목    | 파일명           |
| ------- | ---------------- |
| 금전    | `icon-money.png` |
| 연애    | `icon-love.png`  |
| 학업·일 | `icon-work.png`  |
| 행운    | `icon-luck.png`  |

소문자 파일명을 그대로 사용하세요. 투명 배경의 정사각형 PNG(예: 128×128px)를 권장합니다. 화면에는 피그마의 슬롯에 맞춰 34~40px 크기로 비율을 유지해 표시합니다. 로컬에서는 파일 추가 후 새로고침하고, 운영 사이트에는 Vercel 재배포 후 반영됩니다.

## 기존 이미지

- `figma/`: Lucky Mate_design 피그마 파일에서 받은 원본 PNG·SVG. 클로버·이용 안내·화면 장식·공유 버튼에 사용합니다. 각 SVG의 원래 크기를 유지합니다.
- `figma/clover.png`: 다섯 화면의 원본 클로버가 동일한 파일임을 확인해 공유합니다. 화면별 크기와 잘림 방식은 CSS로 유지하며, 공유 이미지 저장에도 이 파일을 사용합니다.
- `figma/category-love.svg`: 직접 내려받은 `heart-dynamic-color.svg`의 이름을 정리한 S02 연애 하트 원본. 원본 1000×1000 크기를 유지한 채 34px 슬롯에 축소 표시합니다.
- `figma/mission-flag.svg`: 직접 내려받은 `flag-dynamic-clay.svg`의 이름을 정리한 S04 행운 미션 깃발 원본. 제목 앞 24px 슬롯에 표시합니다.
- `design-reference.png`: 이전 디자인 참고용 복사본이며, 현재 화면과 이미지 저장 기능에는 사용하지 않습니다.
- `clover.svg`: 기존 프로젝트의 클로버. 이 폴더로 이동했으며 favicon에 사용합니다.
- 실제 키캡 이미지는 제공되지 않았으므로 원본 디자인의 안내 문구를 유지합니다.

키캡 사진을 추가할 때 `keycap.png` 또는 `keycap.webp`를 여기에 넣고, `components/experience.tsx`의 `hero-art` 내부 문구를 `<img src="/images/keycap.webp" alt="럭키메이트 키캡" />`로 바꾸세요. `.hero-art img`에 `width: 100%; height: 100%; object-fit: cover`를 적용하면 됩니다.

날짜·점수·운세·확인 개수는 실제 데이터로 표시합니다. S02는 초기 미선택이며, 항목을 선택해야 확인 버튼이 나타납니다. 모바일 상태 표시줄은 운영체제가 표시하므로 가짜 시각이나 배터리 상태를 넣지 않습니다.

원본 디자인: https://www.figma.com/design/OT0UjZ5Wy4rpWiEw34EROS/Lucky-Mate_design
S00 3:6751 · S01 3:6826 · S02 3:6856 · S03 3:6933 · S04 3:6974 · S05 3:7060.
S02 하트와 S04 깃발은 Figma MCP 호출 한도로 자동 다운로드가 차단되어 사용자가 직접 제공한 원본 SVG를 적용했습니다.
