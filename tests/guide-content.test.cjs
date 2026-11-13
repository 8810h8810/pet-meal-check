'use strict';
// Offline content regression. No browser, Firebase, analytics or production writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('guide/index.html');
const context = { window: {} };
vm.createContext(context);
for (const file of ['i18n-data.js', 'i18n-pages.js', 'guide/translations.js']) {
  vm.runInContext(read(file), context, { filename: file });
}
const rows = context.window.petMealTranslations;
const guideContext = { window: { petMealTranslations: [] } };
vm.createContext(guideContext);
vm.runInContext(read('guide/translations.js'), guideContext);
const guideRows = guideContext.window.petMealTranslations;
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
const texts = [...body.matchAll(/>([^<>]+)</g)].map(m => m[1].trim()).filter(t => t && t !== '·');
test('all guide text has four nonempty translations', () => {
  for (const text of texts) {
    const row = rows.find(r => r[0] === text);
    assert.ok(row, `Missing dictionary entry: ${text}`);
    assert.equal(row.length, 4);
    for (const value of row) assert.ok(typeof value === 'string' && value.trim());
  }
});
for (const [index, lang] of [[1,'en'],[2,'es'],[3,'nl']]) {
  test(`${lang}: guide body and headings have no untranslated Japanese`, () => {
    for (const text of texts) {
      const value = rows.find(r => r[0] === text)?.[index];
      assert.ok(value, text);
      assert.doesNotMatch(value, /[ぁ-んァ-ヶ一-龯]/, text);
    }
  });
}
test('guide-specific entries have no conflicting dictionary translations', () => {
  for (const row of guideRows) for (const other of rows.filter(r => r[0] === row[0])) {
    assert.equal(JSON.stringify(other), JSON.stringify(row), row[0]);
  }
});
test('translation scripts load in dependency order and are deferred', () => {
  const scripts = [...html.matchAll(/<script([^>]*)src="([^"]+)"([^>]*)>/g)];
  const expected = ['../i18n-data.js','../i18n-pages.js','translations.js','../i18n.js'];
  assert.deepEqual(scripts.map(m => m[2]), expected);
  for (const match of scripts) assert.match(match[1]+match[3], /\bdefer\b/);
});
test('guide links retain app and policy routes on root and project hosting', () => {
  const links = [...body.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(links, ['../','../cat/','../about/','../privacy/']);
  for (const base of ['https://example.test/','https://example.test/pet-meal-check/']) {
    const resolved = links.map(link => new URL(link, `${base}guide/`).href);
    assert.deepEqual(resolved, ['', 'cat/', 'about/', 'privacy/'].map(p => base+p));
  }
});
test('guide remains read-only and does not load chart or analytics engines', () => {
  assert.doesNotMatch(html, /check-sync\.js|analytics-consent\.js|firebase|googletagmanager/i);
  assert.doesNotMatch(body, /<(form|input|textarea)\b/i);
});
test('guide title is translated and page has one main heading', () => {
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.ok(guideRows.find(row => row[0] === title));
  assert.equal((body.match(/<h1>/g)||[]).length, 1);
  assert.match(html, /name="viewport"/);
});
