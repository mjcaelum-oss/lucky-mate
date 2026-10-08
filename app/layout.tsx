import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Lucky Mate · 오늘의 작은 행운',
  description:
    '네잎클로버 키링과 함께 만나는 오늘의 작은 행운. 금전, 연애, 학업·일, 행운을 만나보세요.',
  icons: { icon: '/images/clover.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6fbf8' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
