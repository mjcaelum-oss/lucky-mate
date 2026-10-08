'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import {
  categories,
  colors,
  labels,
  kstDate,
  validCategory,
  type Category,
  type Fortune,
} from '@/lib/domain';
type Screen = 'intro' | 'checking' | 'entry' | 'home' | 'loading' | 'result' | 'shared' | 'error';
const emoji = { MONEY: '🪙', LOVE: '❤️', WORK: '✏️', LUCK: '🌟' };
export function CategoryIcon({ category }: { category: Category }) {
  return (
    <span className="category-emoji" data-category={category} aria-hidden="true">
      <img
        src={`/images/icon-${category.toLowerCase()}.png`}
        alt=""
        width={34}
        height={34}
        onError={(event) => {
          event.currentTarget.hidden = true;
          (event.currentTarget.nextElementSibling as HTMLElement).hidden = false;
        }}
      />
      <span hidden>{emoji[category]}</span>
    </span>
  );
}
const hints = {
  MONEY: '기회와 흐름',
  LOVE: '설렘과 관계',
  WORK: '성장과 집중',
  LUCK: '우연과 발견',
};
async function api(action: string, body: object, signal?: AbortSignal) {
  const res = await fetch(`/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'SYSTEM_ERROR');
  return data;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function Clover({ className = '' }: { className?: string }) {
  return (
    <img
      src="/images/figma/clover.png"
      alt="네잎클로버"
      className={`clover clover-${className || 'home'}`}
    />
  );
}
function readViewed(id: string, date: string): Category[] {
  try {
    const value = JSON.parse(localStorage.getItem(`fortune_viewed_${id}_${date}`) || '[]');
    return Array.isArray(value) ? value.filter(validCategory) : [];
  } catch {
    return [];
  }
}
export default function Experience({ path, localDemo }: { path: string[]; localDemo: boolean }) {
  const initial = path.length ? 'checking' : 'intro';
  const [screen, setScreen] = useState<Screen>(initial),
    [id, setId] = useState(path[1] || ''),
    [date, setDate] = useState(kstDate()),
    [viewed, setViewed] = useState<Category[]>([]),
    [selected, setSelected] = useState<Category | null>(null),
    [result, setResult] = useState<Fortune | null>(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [help, setHelp] = useState(false),
    [shareOpen, setShareOpen] = useState(false),
    [shareToken, setShareToken] = useState(path[0] === 'share' ? path[1] : ''),
    [busy, setBusy] = useState(false),
    [demo, setDemo] = useState(localDemo);
  const started = useRef(false),
    fortuneRequest = useRef<AbortController | null>(null),
    retry = useRef<() => void>(() => location.reload()),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, shareOpen]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.querySelector<HTMLElement>('button, a, input')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHelp(false);
        setShareOpen(false);
      }
      if (event.key !== 'Tab' || !dialog) return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a, input'),
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [help]);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }, []);
  const track = useCallback(
    (event_type: string, extra: object = {}) => {
      void api('events', { event_type, keyring_id: id, ...extra }).catch(() => {});
    },
    [id],
  );
  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'SYSTEM_ERROR');
    setScreen('error');
  }, []);
  const mark = (r: Fortune) => {
    const next = Array.from(new Set([...readViewed(r.keyring_id, r.fortune_date), r.category]));
    try {
      localStorage.setItem(
        `fortune_viewed_${r.keyring_id}_${r.fortune_date}`,
        JSON.stringify(next),
      );
    } catch {}
    setViewed(next);
    setDate(r.fortune_date);
  };
  const openFortune = async (category: Category, keyring = id) => {
    if (busy) return;
    setBusy(true);
    setSelected(category);
    setScreen('loading');
    const request = new AbortController();
    fortuneRequest.current = request;
    retry.current = () => void openFortune(category, keyring);
    try {
      const r: Fortune = await api('fortune', { keyring_id: keyring, category }, request.signal);
      if (request.signal.aborted) return;
      setResult(r);
      setShareToken('');
      mark(r);
      setScreen('result');
      void api('events', {
        event_type: 'FORTUNE_VIEW',
        keyring_id: keyring,
        category,
        daily_result_id: r.id,
      }).catch(() => {});
    } catch (e) {
      if (!request.signal.aborted) fail(e);
    } finally {
      if (fortuneRequest.current === request) {
        fortuneRequest.current = null;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!path.length) return;
    const run = async () => {
      try {
        if (path[0] === 'share' && path.length === 2) {
          const r: Fortune = await api('shared', { token: path[1] });
          setResult(r);
          setId(r.keyring_id);
          setDate(r.fortune_date);
          setScreen('shared');
          return;
        }
        if (
          !['n', 'fortune'].includes(path[0]) ||
          path.length < 2 ||
          path.length > 3 ||
          (path[0] === 'n' && path.length !== 2)
        )
          throw new Error('INVALID_KEYRING');
        const data = await api('entry', { keyring_id: path[1], nfc: path[0] === 'n' });
        setDemo(data.demo);
        setDate(data.date);
        setViewed(readViewed(path[1], data.date));
        setScreen('entry');
        await wait(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200);
        if (path[2]) {
          const category = path[2].toUpperCase();
          if (!validCategory(category)) throw new Error('INVALID_CATEGORY');
          await openFortune(category, path[1]);
        } else setScreen('home');
      } catch (e) {
        fail(e);
      }
    };
    retry.current = () => void run();
    void run();
    // Initial URL is intentionally captured once; navigation occurs through location links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (screen !== 'home') return;
    const timer = setInterval(() => {
      const today = kstDate();
      if (today !== date) {
        setDate(today);
        setViewed(readViewed(id, today));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, date, id]);
  const purchase = () => {
    if (result) track('PURCHASE_CTA_CLICK', { share_token: shareToken || null });
    const url = process.env.NEXT_PUBLIC_PURCHASE_URL;
    if (url && /^https:\/\//.test(url)) location.assign(url);
    else notify('구매 링크를 준비하고 있어요. 조금만 기다려주세요.');
  };
  const createShare = async () => {
    if (!result) return '';
    const data = await api('share', { result_id: result.id });
    setShareToken(data.token);
    return `${location.origin}/share/${data.token}`;
  };
  const shareResult = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = await createShare();
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: `오늘의 ${labels[result!.category]}운 · Lucky Mate`,
            text: result!.content.message,
            url,
          });
        } catch (e) {
          if (e instanceof Error && e.name !== 'AbortError') setShareOpen(true);
        }
      } else await copy();
    } catch {
      notify('공유 링크를 만들지 못했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      const url = await createShare();
      await navigator.clipboard.writeText(url);
      notify('행운 링크를 복사했어요.');
    } catch {
      notify('링크를 복사할 수 없어요. 브라우저 권한을 확인해주세요.');
    }
  };
  const saveImage = async () => {
    if (!result) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1100;
    const c = canvas.getContext('2d');
    if (!c) return;
    const gradient = c.createLinearGradient(0, 0, 900, 1100);
    gradient.addColorStop(0, '#058745');
    gradient.addColorStop(1, '#13c86b');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 900, 1100);
    c.fillStyle = '#dbffe9';
    c.font = '28px sans-serif';
    c.fillText(`LUCKY MATE  ·  ${result.fortune_date}`, 70, 90);
    c.fillStyle = 'white';
    c.font = 'bold 45px sans-serif';
    c.fillText(`${labels[result.category]}운 · ${result.content.score}점`, 70, 175);
    const chars = [...result.content.message];
    c.font = 'bold 36px sans-serif';
    let line = '',
      y = 260;
    for (const ch of chars) {
      if (c.measureText(line + ch).width > 750) {
        c.fillText(line, 70, y);
        y += 60;
        line = '';
      }
      line += ch;
    }
    c.fillText(line, 70, y);
    const image = new Image();
    image.src = '/images/figma/clover.png';
    await image.decode();
    c.drawImage(image, 240, 500, 396, 420);
    c.font = '28px sans-serif';
    c.fillText(
      `행운 숫자 ${result.lucky_number}  ·  ${colors.find((x) => x[0] === result.lucky_color)?.[1]}`,
      70,
      1020,
    );
    const a = document.createElement('a');
    a.download = `lucky-mate-${result.fortune_date}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    notify('행운 카드를 저장했어요.');
  };
  const backHome = () => {
    fortuneRequest.current?.abort();
    fortuneRequest.current = null;
    setBusy(false);
    track('BACK_TO_HOME');
    const today = kstDate();
    setDate(today);
    setViewed(readViewed(id, today));
    setScreen('home');
    setShareOpen(false);
  };
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(date + 'T12:00:00+09:00'));
  const color = colors.find((c) => c[0] === result?.lucky_color) || colors[6];
  const button = (text: string, onClick: () => void, secondary = false, icon?: React.ReactNode) => (
    <button className={`button ${secondary ? 'secondary' : ''}`} onClick={onClick} disabled={busy}>
      {icon}
      {text}
    </button>
  );
  const shareOptions = (
    <div className="share-options">
      <button onClick={() => void shareResult()} title="기기 공유 메뉴에서 카카오톡을 선택하세요">
        <span className="yellow">
          <img src="/images/figma/kakao.svg" alt="" />
        </span>
        카카오톡
      </button>
      <button
        onClick={() => void shareResult()}
        title="기기 공유 메뉴를 열어요. 미지원 기기에서는 링크를 복사해요"
      >
        <span className="pink">
          <img src="/images/figma/story.svg" alt="" />
        </span>
        스토리
      </button>
      <button onClick={() => void copy()}>
        <span className="mint">
          <img src="/images/figma/link.svg" alt="" />
        </span>
        링크 복사
      </button>
      <button onClick={() => void saveImage().catch(() => notify('이미지를 저장하지 못했어요.'))}>
        <span className="blue">
          <img src="/images/figma/download.svg" alt="" />
        </span>
        이미지 저장
      </button>
    </div>
  );
  const resultCards = result && (
    <>
      <div className="score-card">
        <div className="row">
          <span className={`pill ${result.category === 'LOVE' ? 'pink' : ''}`}>
            {result.category === 'LOVE' ? (
              <span className="pill-art">
                <img src="/images/figma/result-heart.svg" alt="" />
              </span>
            ) : (
              emoji[result.category]
            )}{' '}
            {labels[result.category]}운
          </span>
          <span className="tiny">{result.fortune_date.replaceAll('-', '. ')}</span>
        </div>
        <div className="score-body">
          <div>
            <p className="eyebrow">오늘의 행운지수</p>
            <div className="score">
              {result.content.score}
              <small>점</small>
            </div>
            <p className="score-note">
              {result.content.score >= 90 ? '마음을 표현하기에' : '나만의 속도로 움직이기'}
              <br />
              좋은 날이에요
            </p>
          </div>
          <div
            className="score-ring"
            style={{ background: `conic-gradient(#16b85a ${result.content.score}%,#e1eae4 0)` }}
          >
            <div>
              <Clover className="result" />
            </div>
          </div>
        </div>
        <p className="tiny bottom-note">오늘도 당신에게 작은 행운이 닿기를</p>
      </div>
      <article className="message-card">
        <h3>
          <img src="/images/figma/message.png" alt="" /> 오늘의 메시지
        </h3>
        <h2>{result.content.message.split('. ')[0]}</h2>
        <p>{result.content.message.split('. ').slice(1).join('. ')}</p>
      </article>
      <article className="mission-card">
        <h3>오늘의 행운 미션</h3>
        <p>{result.content.mission}</p>
      </article>
      <article className="detail-card">
        <div>
          <h3>행운 숫자</h3>
          <p>약속 시간이나 좌석에서 찾아보세요</p>
        </div>
        <span className="number">{result.lucky_number}</span>
      </article>
      <article className="detail-card">
        <div>
          <h3>행운 컬러</h3>
          <strong>{color[1]}</strong>
          <p>작은 소품으로 포인트를 줘보세요</p>
        </div>
        <span className="swatch" style={{ background: color[2] }} />
      </article>
    </>
  );
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => event.currentTarget.setAttribute('data-keyboard', 'true')}
      onPointerDown={(event) => event.currentTarget.removeAttribute('data-keyboard')}
    >
      <main className={`phone ${screen === 'entry' ? 'entry-screen' : ''}`}>
        {demo && <div className="demo-banner">로컬 미리보기 · Supabase 연결 전</div>}
        {screen === 'checking' && (
          <div className="checking screen">
            <span className="wordmark">Lucky Mate</span>
            <div>
              <span className="pill">잠시만 기다려주세요</span>
              <h1>
                {path[0] === 'share' ? '친구가 보낸 행운을' : '키링을'}
                <br />
                확인하고 있어요
              </h1>
              <p className="subtitle">좋은 하루의 시작을 준비해요.</p>
            </div>
          </div>
        )}
        {screen === 'intro' && (
          <div className="intro screen">
            <h1>
              매일, 당신에게 필요한
              <br />
              행운을 만나보세요
            </h1>
            <p className="subtitle">
              키링을 톡 태그하면 네잎클로버가
              <br />
              오늘의 행운을 알려드려요.
            </p>
            <div className="hero-art">
              <span className="keycap-placeholder">
                4조의 멋있는
                <br />
                키캡 이미지
              </span>
            </div>
            <section className="howto">
              <h2>이용 방법</h2>
              {[
                ['step-tag', '키링을 태그해요', '휴대폰 뒷면에 키링을 가까이 대주세요.'],
                ['step-select', '네잎 중 하나를 골라요', '나에게 지금 필요한 잎을 선택해요.'],
                [
                  'step-result',
                  '오늘의 결과를 확인해요',
                  '메시지와 작은 행운 미션을 확인해 주세요.',
                ],
              ].map(([icon, title, desc], i) => (
                <div className="step" key={title}>
                  <span className="step-icon">
                    <img src={`/images/figma/${icon}.png`} alt="" />
                  </span>
                  <div>
                    <span className="eyebrow">STEP {i + 1}</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </section>
            <div className="nfc-tip">
              <span className="nfc-icon">
                <img src="/images/figma/nfc.svg" alt="" />
              </span>
              <div>
                <strong>NFC가 켜져 있는지 확인해주세요</strong>
                <p>
                  아이폰은 상단, 안드로이드는 뒷면 중앙에
                  <br />
                  키링을 1~2초 가까이 대면 돼요.
                </p>
              </div>
            </div>
            {button(
              '럭키메이트 키링 구매하기',
              purchase,
              false,
              <img src="/images/figma/purchase.svg" alt="" />,
            )}
          </div>
        )}
        {screen === 'entry' && (
          <div className="entry screen">
            <span className="pill">
              <img src="/images/figma/entry-check.svg" alt="" /> NFC 연결 완료
            </span>
            <h1>
              키링에서 행운이
              <br />
              깨어나고 있어요
            </h1>
            <p>반짝임이 모두 모이면 오늘의 행운을 만나요!</p>
            <div className="entry-orbit">
              <img className="entry-outer" src="/images/figma/entry-outer.svg" alt="" />
              <img className="entry-middle" src="/images/figma/entry-middle.svg" alt="" />
              <img className="entry-core" src="/images/figma/entry-core.svg" alt="" />
              <Clover className="entry" />
              <img className="orbit-star" src="/images/figma/entry-sparkles.svg" alt="" />
              <img className="orbit-sparkle" src="/images/figma/entry-sparkle.svg" alt="" />
              <img className="orbit-small-star" src="/images/figma/entry-star.svg" alt="" />
            </div>
            <div className="entry-bottom">
              <div className="progress">
                <span />
              </div>
              <p>행운을 불러오는 중</p>
            </div>
          </div>
        )}
        {screen === 'home' && (
          <div className="home screen">
            <header className="home-header">
              <a className="wordmark" href="/">
                Lucky Mate
              </a>
              <button className="icon-button" aria-label="이용 방법" onClick={() => setHelp(true)}>
                <img src="/images/figma/help.svg" alt="" />
              </button>
            </header>
            <div className="home-title">
              <p className="eyebrow">{formattedDate}</p>
              <div className="row">
                <h1>
                  오늘 필요한 행운의
                  <br />
                  잎을 골라보세요
                </h1>
                <span className="pill">{viewed.length} / 4 확인</span>
              </div>
            </div>
            <div className="today-clover">
              <Clover />
              <div>
                <span>TODAY’S CLOVER</span>
                <p>
                  마음이 끌리는 잎이
                  <br />
                  오늘의 답일지도 몰라요.
                </p>
              </div>
            </div>
            <div className="leaves">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`leaf-card ${selected === category ? 'selected' : ''} ${viewed.includes(category) ? 'viewed' : ''}`}
                  onClick={() => setSelected(category)}
                  aria-pressed={selected === category}
                >
                  <div className="row">
                    <CategoryIcon category={category} />
                    {viewed.includes(category) ? (
                      <span className="checked">
                        <img src="/images/figma/complete.svg" alt="" /> 확인 완료
                      </span>
                    ) : selected === category ? (
                      <img className="select-dot" src="/images/figma/selected.svg" alt="" />
                    ) : null}
                  </div>
                  <div>
                    <h2>{labels[category]}</h2>
                    <p>{hints[category]}</p>
                  </div>
                </button>
              ))}
            </div>
            {selected && (
              <div className="home-bottom">
                {button(
                  `${labels[selected]}운 확인하기`,
                  () => void openFortune(selected),
                  false,
                  <img src="/images/figma/next.svg" alt="" />,
                )}
              </div>
            )}
          </div>
        )}
        {screen === 'loading' && selected && (
          <div className="loading screen">
            <header className="topbar">
              <button className="icon-button" aria-label="다른 잎 보기" onClick={backHome}>
                <img src="/images/figma/back.svg" alt="" />
              </button>
              <strong>오늘의 {labels[selected]}운</strong>
              <span />
            </header>
            <div className="loading-title">
              <span className="pill pink">
                {selected === 'LOVE' ? (
                  <span className="pill-art">
                    <img src="/images/figma/loading-heart.svg" alt="" />
                  </span>
                ) : (
                  emoji[selected]
                )}{' '}
                행운 신호 분석 중!
              </span>
              <h1>
                오늘의 행운을
                <br />
                찾고 있어요
              </h1>
              <p className="subtitle">
                네잎 사이 숨은 좋은 기운을 모으는 중이에요.
                <br />
                조금만 기다려주세요.
              </p>
            </div>
            <div className="reveal-orbit">
              <img className="dashed-orbit" src="/images/figma/loading-orbit.png" alt="" />
              <img className="loading-glow" src="/images/figma/loading-glow.svg" alt="" />
              <Clover className="loading" />
              <img className="orbit-star" src="/images/figma/entry-sparkles.svg" alt="" />
              <img className="orbit-sparkle" src="/images/figma/entry-sparkle.svg" alt="" />
              <img className="orbit-small-star" src="/images/figma/entry-star.svg" alt="" />
              <span className="floating-heart">
                <img src="/images/figma/orbit-heart.svg" alt="" />
              </span>
              <span className="floating-star">
                <img src="/images/figma/orbit-star.svg" alt="" />
              </span>
            </div>
            <div className="loading-bottom">
              <div className="progress">
                <span />
              </div>
              <p className="row">
                <span>좋은 타이밍을 살펴보는 중</span>
                <span className="eyebrow">곧 만나요</span>
              </p>
              <p className="footer-note">개인정보를 수집하거나 저장하지 않아요</p>
            </div>
          </div>
        )}
        {screen === 'result' && !shareOpen && result && (
          <div className="result screen">
            <header className="topbar">
              <button className="icon-button" aria-label="다른 잎 보기" onClick={backHome}>
                <img src="/images/figma/back.svg" alt="" />
              </button>
              <strong>오늘의 {labels[result.category]}운</strong>
              <button
                className="icon-button"
                aria-label="공유 메뉴"
                onClick={() => setShareOpen(true)}
              >
                <img src="/images/figma/more.svg" alt="" />
              </button>
            </header>
            {resultCards}
            <div className="result-actions">
              {button(
                '결과 공유하기',
                () => setShareOpen(true),
                false,
                <img src="/images/figma/share.svg" alt="" />,
              )}
              {button('다른 행운도 보기', backHome, true)}
            </div>
          </div>
        )}
        {(screen === 'shared' || shareOpen) && result && (
          <div className="shared screen">
            <header className="topbar">
              <button
                onClick={() => (shareOpen ? setShareOpen(false) : backHome())}
                className="icon-button"
                aria-label="뒤로 가기"
              >
                <img src="/images/figma/back.svg" alt="" />
              </button>
              <strong>행운 공유하기</strong>
              <button
                onClick={() => (shareOpen ? setShareOpen(false) : location.assign('/'))}
                className="icon-button"
                aria-label="닫기"
              >
                <img src="/images/figma/close.svg" alt="" />
              </button>
            </header>
            <div className="share-hero">
              <span className="pill pink">
                {labels[result.category]}운 · {result.content.score}점
              </span>
              <p className="eyebrow">TODAY’S FORTUNE</p>
              <h1>{result.content.message.split('. ')[0]}</h1>
              <div className="share-visual">
                <Clover className="share" />
                <div className="share-stats">
                  <span>
                    행운 숫자 <b>{result.lucky_number}</b>
                  </span>
                  <span>
                    행운 컬러 <b>{color[1]}</b>
                  </span>
                </div>
              </div>
            </div>
            <h3 className="shared-heading">친구에게 행운 보내기</h3>
            {shareOptions}
            <div className="result-actions">
              {button(
                '나도 럭키메이트 갖기',
                purchase,
                false,
                <img src="/images/figma/share-purchase.svg" alt="" />,
              )}
              {button('다른 행운도 구경하기', backHome, true)}
            </div>
          </div>
        )}
        {screen === 'error' && (
          <div className="error screen">
            <a href="/" className="wordmark">
              Lucky Mate
            </a>
            <div>
              <Clover />
              <span className="pill">
                {error === 'INVALID_KEYRING'
                  ? '키링 확인 필요'
                  : error === 'SHARE_NOT_FOUND'
                    ? '공유 링크 확인 필요'
                    : '잠시 쉬어가는 중'}
              </span>
              <h1>
                {error === 'INVALID_KEYRING'
                  ? '유효하지 않은\n포춘클로버예요'
                  : error === 'SHARE_NOT_FOUND'
                    ? '공유된 행운을\n찾을 수 없어요'
                    : '운세를 불러오지\n못했어요'}
              </h1>
              <p>
                {error === 'INVALID_KEYRING'
                  ? '키링을 다시 태그해주세요.'
                  : error === 'NOT_CONFIGURED'
                    ? '서비스 연결을 준비하고 있어요. 잠시 후 다시 방문해주세요.'
                    : '잠시 후 다시 시도해주세요.'}
              </p>
            </div>
            {button('다시 시도하기', () => retry.current())}
            <a className="button secondary" href="/">
              키링 이용 방법 보기
            </a>
          </div>
        )}
      </main>
      <div className="modal-backdrop" hidden={!help} onClick={() => setHelp(false)}>
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="키링 이용 방법"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="modal-close icon-button"
            aria-label="닫기"
            onClick={() => setHelp(false)}
          >
            <X />
          </button>
          <Clover />
          <h2>오늘의 행운을 만나는 방법</h2>
          <p>
            네 잎 중 마음이 끌리는 분야를 고른 뒤<br />
            확인 버튼을 눌러주세요.
          </p>
          <p>
            하루에 네 분야를 모두 볼 수 있고,
            <br />
            같은 날 같은 키링의 결과는 유지돼요.
          </p>
          {button('알겠어요', () => setHelp(false))}
        </section>
      </div>
      <div className="toast" role="status" hidden={!toast}>
        <Check size={17} />
        {toast}
      </div>
    </div>
  );
}
