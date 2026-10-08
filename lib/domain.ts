export const categories = ['MONEY', 'LOVE', 'WORK', 'LUCK'] as const;
export type Category = (typeof categories)[number];
export const labels: Record<Category, string> = {
  MONEY: '금전',
  LOVE: '연애',
  WORK: '학업·일',
  LUCK: '행운',
};
export const colors = [
  ['RED', '빨강', '#ec5b61'],
  ['ORANGE', '주황', '#ffac63'],
  ['YELLOW', '노랑', '#ffe36f'],
  ['GREEN', '초록', '#18ba69'],
  ['BLUE', '파랑', '#578cde'],
  ['PURPLE', '보라', '#a788cf'],
  ['PINK', '로지 핑크', '#ee88ac'],
  ['WHITE', '흰색', '#fff'],
  ['BLACK', '검정', '#253b30'],
  ['BEIGE', '베이지', '#e7d3b1'],
  ['SKY_BLUE', '하늘', '#a0d8f0'],
  ['LIGHT_GREEN', '연두', '#b4e975'],
] as const;
export function kstDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function previousDate(date: string) {
  return new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
}
export function validKeyring(id: unknown): id is string {
  return typeof id === 'string' && /^FC(00[1-9]|0[1-9]\d|100)$/.test(id);
}
export function validCategory(value: unknown): value is Category {
  return categories.includes(value as Category);
}
export type Content = {
  id: string;
  category: Category;
  message: string;
  mission: string;
  score: number;
  is_active: boolean;
};
export type Fortune = {
  id: string;
  keyring_id: string;
  fortune_date: string;
  category: Category;
  content_id: string;
  lucky_number: number;
  lucky_color: string;
  content: Content;
};
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const eventTypes = [
  'NFC_ENTRY',
  'DIRECT_ENTRY',
  'FORTUNE_SELECT',
  'FORTUNE_VIEW',
  'SHARE_CLICK',
  'SHARE_VISIT',
  'PURCHASE_CTA_CLICK',
  'BACK_TO_HOME',
  'INVALID_ID',
  'SYSTEM_ERROR',
] as const;
