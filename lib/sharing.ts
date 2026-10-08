import { colors, labels, type Fortune } from './domain';

export type KakaoSDK = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (options: {
      objectType: 'feed';
      content: {
        title: string;
        description: string;
        imageUrl: string;
        link: { mobileWebUrl: string; webUrl: string };
      };
      buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
    }) => void;
  };
};
declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

export async function fortuneImage(result: Fortune): Promise<File> {
  await document.fonts.ready;
  const image = new Image();
  image.src = '/images/figma/clover.png';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('IMAGE_UNAVAILABLE');
  const gradient = c.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, '#058745');
  gradient.addColorStop(1, '#13c86b');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1080, 1920);
  c.fillStyle = '#dbffe9';
  c.font = '32px "Noto Sans KR", sans-serif';
  c.fillText(`LUCKY MATE  ·  ${result.fortune_date}`, 80, 200);
  c.fillStyle = 'white';
  c.font = 'bold 60px "Noto Sans KR", sans-serif';
  c.fillText(`${labels[result.category]}운 · ${result.content.score}점`, 80, 310);
  let lines: string[] = [],
    size = 52;
  do {
    c.font = `bold ${size}px "Noto Sans KR", sans-serif`;
    lines = [''];
    for (const ch of result.content.message) {
      if (ch === '\n' || c.measureText(lines.at(-1)! + ch).width > 920) lines.push('');
      if (ch !== '\n') lines[lines.length - 1] += ch;
    }
    if (lines.length * size * 1.5 <= 520) break;
    size -= 2;
  } while (size > 12);
  lines.forEach((line, i) => c.fillText(line, 80, 420 + i * size * 1.5));
  c.drawImage(image, 300, 1000, 480, 510);
  c.font = '36px "Noto Sans KR", sans-serif';
  c.fillText(
    `행운 숫자 ${result.lucky_number}  ·  ${colors.find((x) => x[0] === result.lucky_color)?.[1]}`,
    80,
    1660,
  );
  c.fillStyle = '#dbffe9';
  c.font = '30px "Noto Sans KR", sans-serif';
  c.fillText('당신에게 작은 행운이 닿기를', 80, 1730);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('IMAGE_UNAVAILABLE'))),
      'image/png',
    );
  });
  return new File([blob], `lucky-mate-${result.fortune_date}.png`, { type: 'image/png' });
}

export function downloadImage(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
