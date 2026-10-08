# 이미지 관리

이미지 폴더: `C:\LuckyMate\public\images` (웹 경로 `/images/`).

- `design-reference.png`: 제공받은 `Lucky Mate_design.png`의 원본 복사본. 새로 생성한 그림이 아닙니다. 클로버는 CSS 배경 위치로 이 원본의 해당 영역만 표시합니다.
- `clover.svg`: 기존 프로젝트의 클로버. 이 폴더로 이동했으며 favicon에 사용합니다.
- 실제 키캡 이미지는 제공되지 않았으므로 원본 디자인의 안내 문구를 유지합니다.

키캡 사진을 추가할 때 `keycap.png` 또는 `keycap.webp`를 여기에 넣고, `components/experience.tsx`의 `hero-art` 내부 문구를 `<img src="/images/keycap.webp" alt="럭키메이트 키캡" />`로 바꾸세요. `.hero-art img`에 `width: 100%; height: 100%; object-fit: cover`를 적용하면 됩니다.

독립적인 투명 클로버 원본을 받으면 `clover.png`로 저장한 뒤 `components/experience.tsx`의 `Clover`를 해당 이미지로 교체하고, `app/globals.css`의 `.clover`와 각 화면별 클로버 배경 위치를 제거하세요. 이미지 저장 기능의 `saveImage`도 같은 파일로 바꾸세요. 원본은 2540×1262이며 CSS와 Canvas 위치는 2048×1018 표시 좌표로 환산합니다.

원본 디자인 자체를 다른 크기로 교체하면 배경 위치도 조정해야 합니다. 날짜·점수·운세·확인 개수는 실제 데이터로 표시합니다. 모바일 상태 표시줄은 운영체제가 표시하므로 가짜 시각이나 배터리 상태를 넣지 않습니다.
