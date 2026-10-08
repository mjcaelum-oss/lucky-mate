import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Experience, { CategoryIcon } from '../components/experience';
import type { Category } from '../lib/domain';

test('animated help and toast remain hidden until opened', (t) => {
  const useState = React.useState;
  let hook = 0;
  let open = false;
  t.mock.method(React, 'useState', (initial: unknown) => {
    const index = hook++;
    return useState(
      index === 8 ? open : index === 7 ? (open ? '행운 링크를 복사했어요.' : '') : initial,
    );
  });
  const render = () => {
    hook = 0;
    return renderToStaticMarkup(createElement(Experience, { path: [], localDemo: false }));
  };
  const closed = render();
  assert.match(closed, /class="modal-backdrop" hidden=""/);
  assert.match(closed, /class="toast" role="status" hidden=""/);
  open = true;
  const visible = render();
  assert.doesNotMatch(visible, /class="modal-backdrop" hidden|class="toast" role="status" hidden/);
  assert.match(visible, /role="dialog" aria-modal="true"/);
  assert.match(visible, /행운 링크를 복사했어요\./);
});

test('S02 starts unselected and shows the fortune button only after selecting a category', (t) => {
  const useState = React.useState;
  let hook = 0;
  let selection: Category | undefined;
  t.mock.method(React, 'useState', (initial: unknown) => {
    const index = hook++;
    // Render S02 without running browser effects; otherwise preserve initial state.
    return useState(index === 0 ? 'home' : index === 4 && selection ? selection : initial);
  });
  const render = () => {
    hook = 0;
    return renderToStaticMarkup(
      createElement(Experience, { path: ['n', 'FC001'], localDemo: false }),
    );
  };
  const initial = render();
  assert.match(initial, /오늘 필요한 행운의/);
  assert.equal((initial.match(/aria-pressed="false"/g) || []).length, 4);
  assert.doesNotMatch(initial, /home-bottom|운 확인하기/);
  for (const [category, label] of [
    ['MONEY', '금전'],
    ['LOVE', '연애'],
    ['WORK', '학업·일'],
    ['LUCK', '행운'],
  ] as const) {
    selection = category;
    const selected = render();
    assert.equal((selected.match(/aria-pressed="true"/g) || []).length, 1);
    assert.ok(selected.includes(`${label}운 확인하기`));
  }
});

test('S02 icons use the documented PNG names and fall back when the image fails', () => {
  const icons: [Category, string, string][] = [
    ['MONEY', 'icon-money.png', '🪙'],
    ['LOVE', 'icon-love.png', '❤️'],
    ['WORK', 'icon-work.png', '✏️'],
    ['LUCK', 'icon-luck.png', '🌟'],
  ];
  for (const [category, filename, emoji] of icons) {
    const icon = CategoryIcon({ category });
    const [image, fallback] = icon.props.children;
    assert.equal(image.props.src, `/images/${filename}`);
    if (category === 'LOVE') {
      const [image, emojiFallback] = fallback.props.children.props.children;
      assert.equal(image.props.src, '/images/figma/category-love.svg');
      assert.equal(emojiFallback.props.children, emoji);
      const sibling = { hidden: true };
      const target = { hidden: false, nextElementSibling: sibling };
      image.props.onError({ currentTarget: target });
      assert.equal(target.hidden, true);
      assert.equal(sibling.hidden, false);
    } else assert.equal(fallback.props.children, emoji);
    assert.equal(fallback.props.hidden, true);
    const sibling = { hidden: true };
    const target = { hidden: false, nextElementSibling: sibling };
    image.props.onError({ currentTarget: target });
    assert.equal(target.hidden, true);
    assert.equal(sibling.hidden, false);
  }
});

test('S03 back cancels the request and a late response cannot replace the next fortune', async (t) => {
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  let hook = 0,
    ref = 0;
  t.mock.method(React, 'useState', (initial: unknown) => {
    const index = hook++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (value: unknown) => {
        states[index] = value;
      },
    ];
  });
  t.mock.method(React, 'useRef', (initial: unknown) => {
    const index = ref++;
    return (refs[index] ||= { current: initial });
  });
  t.mock.method(React, 'useEffect', () => {});
  t.mock.method(React, 'useCallback', (callback: unknown) => callback);
  const requests: { signal: AbortSignal; resolve: (response: unknown) => void }[] = [];
  t.mock.method(globalThis, 'fetch', (url: string, options: RequestInit) => {
    if (url !== '/api/fortune') return Promise.resolve({ ok: true, json: async () => ({}) });
    return new Promise((resolve) => requests.push({ signal: options.signal!, resolve }));
  });
  function render() {
    hook = ref = 0;
    return Experience({ path: ['fortune', 'FC001'], localDemo: false });
  }
  function button(
    node: unknown,
    label: string,
  ): React.ReactElement<{ onClick: () => void }> | undefined {
    if (Array.isArray(node)) return node.map((child) => button(child, label)).find(Boolean);
    if (!React.isValidElement(node)) return;
    const element = node as React.ReactElement<{
      children?: unknown;
      'aria-label'?: string;
      onClick: () => void;
    }>;
    if (
      element.type === 'button' &&
      (element.props['aria-label'] === label ||
        (Array.isArray(element.props.children) && element.props.children.includes(label)))
    )
      return element;
    return button(element.props.children, label);
  }
  render();
  states[0] = 'home';
  states[4] = 'LOVE';
  button(render(), '연애운 확인하기')!.props.onClick();
  assert.equal(states[0], 'loading');
  button(render(), '다른 잎 보기')!.props.onClick();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(states[0], 'home');
  assert.equal(states[11], false);
  states[4] = 'MONEY';
  button(render(), '금전운 확인하기')!.props.onClick();
  const fortune = { id: 'new', keyring_id: 'FC001', fortune_date: '2026-10-01', category: 'MONEY' };
  requests[0].resolve({ ok: true, json: async () => ({ ...fortune, id: 'old' }) });
  await new Promise(setImmediate);
  assert.equal(states[0], 'loading');
  assert.equal(states[5], null);
  assert.equal(states[11], true);
  requests[1].resolve({ ok: true, json: async () => fortune });
  await new Promise(setImmediate);
  assert.equal(states[0], 'result');
  assert.equal(states[5], fortune);
  assert.equal(states[11], false);
});

test('Figma assets are local and the supplied keycap placeholder remains intact', () => {
  const markup = renderToStaticMarkup(createElement(Experience, { path: [], localDemo: false }));
  assert.match(markup, /4조의 멋있는<br\/>키캡 이미지/);
  assert.match(markup, /이용 방법/);
  assert.doesNotMatch(markup, /desktop-brand|hero-glow|\/clover.svg/);
  assert.match(markup, /\/images\/figma\/step-tag.png/);
  assert.match(markup, /\/images\/figma\/clover.png/);
  assert.doesNotMatch(
    readFileSync('components/experience.tsx', 'utf8'),
    /design-reference|figma.com\/api/,
  );
  assert.doesNotMatch(readFileSync('app/globals.css', 'utf8'), /design-reference/);
  for (const filename of readdirSync('public/images/figma')) {
    const asset = readFileSync(`public/images/figma/${filename}`);
    assert.ok(asset.length > 0, filename);
    if (filename.endsWith('.svg'))
      assert.match(asset.toString(), /<svg[^>]+width="\d+"[^>]+height="\d+"/);
    else {
      assert.ok(asset.readUInt32BE(16) > 0, filename);
      assert.ok(asset.readUInt32BE(20) > 0, filename);
    }
  }
  assert.match(readFileSync('public/images/clover.svg', 'utf8'), /<svg/);
});
