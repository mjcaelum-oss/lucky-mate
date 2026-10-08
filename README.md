# Lucky Mate

NFC 키링으로 만나는 모바일 운세 서비스. [개발계획](docs/DEVELOPMENT_PLAN.md).

## 로컬 실행

```powershell
rtk proxy npm install
rtk proxy npm run dev
```

이 실행 환경에서 `next dev`가 `spawn EPERM`으로 중단되면 `rtk proxy npm run dev:local`을 실행하고 `http://localhost:3000`으로 접속한다. 이 명령은 Next.js를 직접 시작하고 플러그인을 워커 스레드로 실행한다. 일반 `dev`와 운영 빌드의 실행 방식은 유지한다. Node 24의 알려진 워커 종료 오류로 이 로컬 모드가 종료될 수 있으며, 종료되면 같은 명령으로 재시작한다.

`.env.example`을 `.env.local`로 복사한다. `LOCAL_DEMO_MODE=true`는 명시적 로컬 전용 모드이며 결과·공유·이벤트를 `.local/store.json`에 저장한다. 키링의 활성/비활성 변경은 Supabase 연결 모드에서 검증한다. 운영에서는 Supabase 설정이 없으면 오류 화면을 표시하며 가짜 결과를 생성하지 않는다.

- `/`: 서비스 소개 (운세 생성 없음)
- `/n/FC001`: NFC 진입
- `/fortune/FC001`: 일반 진입
- `/fortune/FC001/LOVE`: 결과 직접 진입
- `/share/{token}`: 당시 결과

## 새 Supabase 프로젝트

1. Supabase에서 새 `lucky-mate` 프로젝트 생성 (가까운 서울 리전 권장).
2. SQL Editor에서 `supabase/migrations/001_initial.sql` 실행.
3. 아래 서버 환경변수를 설정한 뒤 `rtk proxy npm run content:sync`로 CSV 콘텐츠 등록. 또는 `rtk proxy npm run seed` 후 SQL Editor에서 생성된 `supabase/seed.sql` 실행.
4. 서버 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 설정. 기존 프로젝트의 `SUPABASE_SERVICE_ROLE_KEY` JWT도 지원한다. `NEXT_PUBLIC_` 접두사를 사용하지 않는다.
5. `LOCAL_DEMO_MODE=false`로 바꾸고 NFC·공유 경로 테스트.

Auth 활성화는 필요 없다. 모든 테이블은 RLS 활성화, anon/authenticated 권한 없음. get_fortune은 service_role만 실행 가능하다. 운영 콘텐츠는 Dashboard에서 id를 유지하여 수정하고 신규 배정 제외는 is_active=false로 처리한다. 참조 중인 콘텐츠는 삭제하지 않는다.

## Vercel

Next.js 자동 설정(`vercel.json`). Vercel CLI로 이 폴더 배포 또는 Git 저장소를 연결한다.

```powershell
rtk proxy npx vercel login
rtk proxy npx vercel
rtk proxy npx vercel --prod
```

Vercel Project Settings → Environment Variables에 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LOCAL_DEMO_MODE=false`를 등록한다. Preview에도 같은 값을 등록하면 미리보기 배포를 검증할 수 있다. 선택적으로 `NEXT_PUBLIC_PURCHASE_URL`에 HTTPS 구매 URL을 설정한다. production에 로컬 모드를 설정해도 활성화되지 않는다. 비밀키와 `.env.local`은 Git에 포함하지 않는다.

새 `sb_secret_` 키는 서버의 `apikey` 헤더로만 전달하며, 기존 service_role JWT에는 `Authorization: Bearer`도 전달한다. [Supabase 키 전환 안내](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

실제 배포 후 API 검증 (FC098 키링에 운세 및 검증 로그를 생성한다):

```powershell
$env:SMOKE_ORIGIN = 'https://실제배포주소.vercel.app'
$env:SMOKE_EXPECT_DEMO = 'false'
rtk proxy npm run test:api
```

배포 후 `/n/FC001`, 반복 조회, 다른 기기, `/share/{token}`을 검증한 뒤 100개 NFC에 `https://실제도메인/n/FC001` 형식으로 기록한다.

## 검증 및 콘텐츠

```powershell
rtk proxy npm run test
rtk proxy npm run typecheck
rtk proxy npm run build
rtk proxy npm run seed
```

운영 콘텐츠는 `supabase/seed/fortune_contents.csv`에서 관리한다. 120개 예시를 편집하고 `rtk proxy npm run content:check`로 검증한 뒤 `rtk proxy npm run content:sync`로 Supabase에 반영한다. [작성 예시 및 반영 안내](supabase/seed/README.md). `seed` 명령은 CSV를 읽어 SQL만 생성하며 CSV를 덮어쓰지 않는다. 로컬 데모는 `lib/content.ts` 초안을 사용한다. DB 정책 검증은 `supabase/qa.sql`, KPI 쿼리는 `supabase/analytics.sql`을 참고한다.

이미지는 `public/images`에서 관리한다. [이미지 교체 안내](public/images/README.md). 피그마 S00~S05의 원본 PNG·SVG를 `public/images/figma`에 저장해 사용하며 미제공 키캡 사진은 안내 문구로 유지한다. S02 아이콘은 `icon-money.png`, `icon-love.png`, `icon-work.png`, `icon-luck.png`로 교체할 수 있다. 초기 선택은 없으며 항목 선택 후 확인 버튼을 표시한다. S03에서 돌아가면 진행 중인 조회를 취소하고 늦은 응답을 무시한다.

공유는 전체 화면으로 표시하며 링크와 이미지를 먼저 준비한 뒤 버튼을 활성화한다. 카카오톡은 공식 SDK로 운세·클로버 이미지·결과 링크를 보낸다. `.env.local`과 Vercel Production/Preview에 `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 설정하고, 카카오 Developers 앱의 JavaScript SDK 도메인 및 제품 링크 웹 도메인에 운영 주소를 등록한다. 이 값은 브라우저용 JavaScript 키이며 Vercel에서는 공개 Config 유형으로 등록한다. Admin 키나 REST API 키를 입력하지 않는다. 로컬에서 전용 공유창을 테스트하려면 로컬 주소도 카카오 앱에 등록해야 한다. [카카오톡 공유 설정 문서](https://developers.kakao.com/docs/ko/kakaotalk-share/js-link).

카카오 SDK가 없거나 로드되지 않으면 기기 공유 메뉴를 열고, 공유 메뉴 미지원 기기에서는 링크를 복사한다. 인스타그램에는 1080×1920 PNG 운세 카드를 기기 이미지 공유 메뉴로 전달하며 사용자가 Instagram을 선택한다. 웹에서는 Instagram 스토리 작성 화면을 강제로 지정할 수 없다. 앱이 목록에 없거나 파일 공유를 지원하지 않는 경우 이미지 저장 후 직접 스토리에 추가하고, 결과 URL은 링크 스티커에 붙여넣는다. 복사가 차단돼도 선택 가능한 결과 URL을 표시한다. [Web Share 지원 및 제약](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share). 로그 저장 실패는 핵심 화면 조회를 차단하지 않도록 운영에서 모니터링한다.
