# 개발 검증 기록

2026-10-08. 사용자 지시에 따라 Supabase/Vercel 연결은 후속 작업으로 보류했다. 운영 배포 완료를 의미하지 않는다.

- Next.js 16.4.0 production build 통과.
- TypeScript typecheck 통과.
- Node 테스트 4개 통과: 한국시간 경계, 키링 범위, 콘텐츠 개수/범위, PostgreSQL 정책 통합 검증.
- PGlite PostgreSQL에서 실제 마이그레이션/시드/qa.sql 실행. 기존 결과 고정, 본문 수정 반영, 전날 콘텐츠 제외, 비활성 키링 차단, 비활성 콘텐츠의 기존 결과 조회, 공유 날짜 유지, anon 읽기/RPC 권한 거부 확인.
- 로컬 HTTP API: 동일 키링/분야에 12개 동시 요청, 같은 결과 ID/전체 데이터 확인. 4개 분야, 공유 토큰 재사용, 공유 결과 일치, 잘못된 입력, 조회 로그 검증.
- 브라우저 390×844 화면에서 조회, 재조회, 확인 완료 유지, 공유 메뉴와 공유 페이지 진입 확인.

PGlite는 단일 엔진에서 쿼리를 처리한다. 실제 Supabase의 여러 DB 세션 간 잠금 검증 및 서버 장애/자정 경계는 연결 후 추가 검증해야 한다. 로컬 저장소는 단일 개발 서버 검증용이며 운영 서버리스 저장소로 사용하지 않는다.

재현:

```powershell
rtk proxy npm run test
rtk proxy npm run typecheck
rtk proxy npm run build
# .env.local LOCAL_DEMO_MODE=true, npm run dev 실행 후
rtk proxy npx tsx scripts/api-smoke.ts
```

Windows 제한 환경에서 Next.js native compiler의 경로 canonicalization과 localhost fetch는 권한이 필요했다. 패키지 설치/빌드/개발 서버/API 검증은 승인된 실행으로 진행했다.

## 디자인 변경 후 실제 브라우저 검증 (2026-10-08)

브라우저 도구 연결은 정상이다. 이전 접속 실패는 서버 미실행과 `next dev`의 자식 프로세스 생성 제한(`spawn EPERM`) 때문이었다. `rtk proxy npm run dev:local`로 직접 서버를 실행하고 `http://localhost:3000`에서 확인했다. 이 실행 경로는 `scripts/dev-local.cjs`와 해당 모드에만 적용하는 Next.js 워커 스레드 설정을 사용한다. 일반 개발/운영 빌드 설정은 유지한다. Next.js 설정 파일을 수정해 서버가 종료되면 같은 명령으로 다시 실행한다. Node 24의 알려진 워커 종료 문제 때문에 이 로컬 모드는 종료 시 충돌할 수 있다.

- 실제 소개, NFC 연결, 운세 선택, 로딩, 결과, 공유 화면 캡처 및 디자인 원본과 육안 비교.
- 314×680, 390×844 모바일 및 1280×900 데스크톱에서 가로 넘침 없음. 한글 폰트와 디자인 원본 이미지 로딩 확인.
- 공유 카드의 클로버 주변 배경 차이 보정, Next.js 개발 아이콘 숨김, 모바일 스크롤바로 인한 화면 폭 감소 보정. 스크롤은 유지한다.
- 운세 조회, 확인 완료 유지, 공유 화면 열기/닫기, 링크 복사, 실제 PNG 다운로드, 복사한 공유 링크 재접속, 다른 운세로 돌아가기 확인.
- 도움말 열기, Escape 닫기, 스크롤 잠금 해제 확인.
- 유효하지 않은 `FC999`는 API 404와 키링 오류 화면 표시. 검증 중 정상 경로의 HTTP 오류 및 브라우저 런타임 예외 없음.
- 타입 검사 및 테스트 5개 통과. 자식 프로세스를 만들지 않는 기존 `.local/run-design-check.cjs` 경로로 테스트 실행.

캡처는 `.local/screenshots/`에 저장했다: `intro.png`, `entry.png`, `home.png`, `loading.png`, `result.png`, `share.png`. 폭별 결과는 `result-314.png`, `result-390.png`, `result-1280.png`, 데스크톱 소개는 `intro-desktop.png`, 오류는 `error.png`.

짧게 표시되는 NFC/로딩 화면을 캡처할 때만 브라우저 테스트에서 전환 타이머를 늘렸다. 앱의 전환 시간은 수정하지 않았다. 날짜·점수·문구·색상·확인 개수는 실제 로컬 데이터이므로 디자인 예시 값과 다르다. 미제공 키캡 사진은 안내 문구를 유지하고 상태 표시줄은 기기에 맡긴다. 전용 카카오톡/스토리 SDK와 운영 Supabase 연결은 이번 검증 범위에 포함하지 않았다. 전체 production build 완료는 이번 기록의 범위가 아니다.

## Supabase/Vercel 연동 준비 (2026-10-08)

- `SUPABASE_SECRET_KEY`를 우선 사용하고 기존 `SUPABASE_SERVICE_ROLE_KEY`도 지원한다. 새 비밀키는 apikey에만, 기존 JWT는 apikey와 Authorization에 전달한다. 모의 HTTP 응답으로 두 유형과 자격 증명 누락 처리를 확인했다.
- API 검증에 `SMOKE_ORIGIN`, `SMOKE_EXPECT_DEMO`를 추가했다. 실제 배포 후 같은 검증을 실행할 수 있다. Origin 헤더를 보내 동일 출처 검사도 포함한다.
- 타입 검사, 기존 테스트 5개, 로컬 API 동시 요청 12개/4분야/결과 고정/공유 재사용/오류 입력/이벤트 검증 통과.
- 아직 Supabase/Vercel 계정 연결 및 대상 프로젝트가 없다. 실제 마이그레이션 적용, 클라우드 환경변수 등록 및 production 배포는 완료되지 않았다.
