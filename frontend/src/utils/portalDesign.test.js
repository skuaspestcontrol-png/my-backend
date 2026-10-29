import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { brandingContrast } from './brandingTheme.js';
const css = fs.readFileSync(new URL('../styles/portalDesign.css', import.meta.url), 'utf8');
const palette = (section) => Object.fromEntries([...section.matchAll(/(--[\w-]+):\s*(#[a-f0-9]{6})\s*;/gi)].map((match) => [match[1], match[2]]));
const light = palette(css.slice(css.indexOf(':root {'), css.indexOf('html[data-theme="dark"]')));
const dark = { ...light, ...palette(css.slice(css.indexOf('html[data-theme="dark"]'), css.indexOf('/* Saved branding'))) };
for (const [mode, colors] of Object.entries({ light, dark })) {
  test(`${mode} body, secondary text, actions and status badges meet normal-text contrast`, () => {
    for (const [fg,bg] of [[colors['--ui-text'],colors['--ui-card']],[colors['--ui-muted'],colors['--ui-card']],['#ffffff',colors['--ui-action']]]) assert.ok(brandingContrast(fg,bg)>=4.5, `${fg} on ${bg}`);
    for (const status of ['active','pending','danger','info']) assert.ok(brandingContrast(colors[`--status-${status}-text`],colors[`--status-${status}-bg`])>=4.5,status);
  });
}
test('portal width is fluid and exact logo artwork is not cropped or recoloured', () => {
  assert.match(css, /\.dashboard-container\s*\{[^}]*max-width:\s*none !important/s);
  assert.match(css, /\.portal-brand-logo\s*\{[^}]*filter:\s*none !important;[^}]*object-fit:\s*contain !important/s);
});
