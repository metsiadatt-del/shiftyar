import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for (const selector of [':root']) {
  test(`${selector} text and semantic colors have readable contrast`, () => {
    const body = css.slice(css.indexOf(selector)).split('}')[0];
    const tokens = Object.fromEntries([...body.matchAll(/--([\w-]+):(#[a-f0-9]{6})(?=;)/gi)].map(m=>[m[1],m[2]]));
    for (const [fg,bg] of [['text','surface'],['muted','surface'],['muted','soft'],['on-accent','accent'],['self','self-bg'],['deputy','deputy-bg'],['future','future-bg'],['red','red-bg']]) {
      assert.ok(contrast(tokens[fg],tokens[bg]) >= 4.5, `${selector} ${fg}/${bg}`);
    }
  });
}
test('Cool tinted surfaces and alternate Persian font are shipped offline', async () => {
  for (const color of ['003e1f','ef233c','d5f2e3','73ba9b','d90429','cad2c5','84a98c','52796f','354f52']) assert.ok(css.includes('#'+color));
  assert.ok(css.includes("url('./assets/mrt-khodkar.woff')"));
  await access(new URL('../assets/mrt-khodkar.woff',import.meta.url));
  assert.ok(css.includes('MRT_Khodkar_,NotoArabic,Tahoma,sans-serif'));
  assert.ok(css.includes('font-weight:100 900'));
  for (const file of ['noto-arabic.woff2','noto-latin.woff2','noto-LICENSE.txt']) await access(new URL('../assets/'+file, import.meta.url));
});
