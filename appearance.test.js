import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for (const selector of [':root', '[data-theme=dark]']) {
  test(`${selector} text and semantic colors have readable contrast`, () => {
    const body = css.slice(css.indexOf(selector)).split('}')[0];
    const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):(#[a-f0-9]{6})(?=;)/g)].map(m=>[m[1],m[2]]));
    for (const [fg,bg] of [['text','surface'],['muted','surface'],['muted','soft'],['on-accent','accent'],['self','self-bg'],['deputy','deputy-bg'],['future','future-bg'],['red','red-bg']]) {
      assert.ok(contrast(tokens[fg],tokens[bg]) >= 4.5, `${selector} ${fg}/${bg}`);
    }
  });
}
test('Light surfaces are warm and subdued; variable Persian fonts are shipped offline', async () => {
  assert.ok(css.includes('--surface:#eeece1'));
  assert.ok(css.includes('Estedad,Tahoma,sans-serif'));
  assert.ok(css.includes('font-weight:100 900'));
  for (const file of ['estedad-arabic.woff2','estedad-latin.woff2','estedad-LICENSE.txt']) await access(new URL('../assets/'+file, import.meta.url));
});
