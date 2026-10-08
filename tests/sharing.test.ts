import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import Experience from '../components/experience';

test('S05 prepares separate link and image actions, calls sharing before any async work, and handles failures', async (t) => {
  const fortune = {
    id: 'result',
    category: 'LOVE',
    fortune_date: '2026-10-09',
    lucky_number: 7,
    lucky_color: 'GREEN',
    content: { score: 92, message: '작은 행운이 찾아옵니다.' },
  };
  const file = new File(['png'], 'fortune.png', { type: 'image/png' });
  const states: unknown[] = [
    'result',
    'FC001',
    '2026-10-09',
    [],
    'LOVE',
    fortune,
    '',
    '',
    false,
    true,
    'token',
    false,
    false,
    null,
    null,
    '',
    '',
    0,
  ];
  let hook = 0;
  t.mock.method(React, 'useState', () => {
    const i = hook++;
    return [
      states[i],
      (value: unknown) => {
        states[i] = typeof value === 'function' ? value(states[i]) : value;
      },
    ];
  });
  t.mock.method(React, 'useEffect', () => {});
  t.mock.method(React, 'useRef', (current: unknown) => ({ current }));
  t.mock.method(React, 'useCallback', (callback: unknown) => callback);
  const restore: (() => void)[] = [];
  const global = (name: string, value: unknown) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    restore.push(() =>
      previous
        ? Object.defineProperty(globalThis, name, previous)
        : Reflect.deleteProperty(globalThis, name),
    );
  };
  t.after(() => restore.reverse().forEach((fn) => fn()));
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = 'test-key';
  t.after(() => {
    if (key === undefined) delete process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    else process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY = key;
  });
  let kakaodata: any,
    shared: ShareData | undefined,
    rejectShare = '';
  let initialized = false;
  global('location', { origin: 'https://lucky-mate.vercel.app' });
  global('window', {
    Kakao: {
      init: () => {
        initialized = true;
      },
      isInitialized: () => initialized,
      Share: {
        sendDefault: (data: unknown) => {
          kakaodata = data;
        },
      },
    },
  });
  global('navigator', {
    share: (data: ShareData) => {
      shared = data;
      return rejectShare
        ? Promise.reject(new DOMException('test', rejectShare))
        : Promise.resolve();
    },
    canShare: (data: ShareData) => data.files?.[0] === file,
    clipboard: {
      writeText: async () => {
        throw new Error('Denied');
      },
    },
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Sharing must not request a link from the click handler');
  });
  function find(node: unknown, label: string): React.ReactElement<any> | undefined {
    if (Array.isArray(node)) return node.map((child) => find(child, label)).find(Boolean);
    if (!React.isValidElement(node)) return;
    const element = node as React.ReactElement<any>;
    if (
      element.type === 'button' &&
      Array.isArray(element.props.children) &&
      element.props.children.includes(label)
    )
      return element;
    return find(element.props.children, label);
  }
  const button = (label: string) => {
    hook = 0;
    return find(Experience({ path: [], localDemo: false }), label)!;
  };
  assert.equal(button('카카오톡').props.disabled, true);
  assert.equal(button('인스타그램').props.disabled, true);
  states[13] = { resultId: 'other-result', url: 'https://wrong.example' };
  assert.equal(button('카카오톡').props.disabled, true);
  states[13] = { resultId: 'result', url: 'https://lucky-mate.vercel.app/share/token' };
  states[14] = { resultId: 'result', file };
  button('카카오톡').props.onClick();
  assert.equal(initialized, true);
  assert.equal(kakaodata.content.link.mobileWebUrl, 'https://lucky-mate.vercel.app/share/token');
  assert.equal(kakaodata.buttons[0].link.webUrl, kakaodata.content.link.webUrl);
  assert.equal(kakaodata.content.imageUrl, 'https://lucky-mate.vercel.app/images/figma/clover.png');
  button('인스타그램').props.onClick();
  assert.deepEqual(shared, { files: [file] });
  await new Promise(setImmediate);
  assert.equal(states[11], false);
  rejectShare = 'AbortError';
  states[7] = '';
  button('인스타그램').props.onClick();
  await new Promise(setImmediate);
  assert.equal(states[7], '');
  assert.equal(states[11], false);
  rejectShare = 'NotAllowedError';
  button('인스타그램').props.onClick();
  await new Promise(setImmediate);
  assert.match(states[7] as string, /이미지 공유를 열지 못했어요/);
  button('링크 복사').props.onClick();
  await new Promise(setImmediate);
  assert.match(states[7] as string, /아래 공유 링크를 길게 눌러/);
});
