import test from 'node:test';
import assert from 'node:assert/strict';
import { brandingContrast, brandingTextColor, getBrandingTokens, applyBrandingTheme, saveBrandingSettings, loadBrandingSettings } from './brandingTheme.js';

test('arbitrary saved colours drive all headers, footers and actions from the same source', () => {
  for (const accent of ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#FFFFFF', '#000000', '#FFFF00', '#12102B', '#777777']) {
    const tokens = getBrandingTokens({ brandingAccentColor: accent });
    assert.equal(tokens['--color-primary'], accent);
    assert.equal(tokens['--brand-header-bg'], accent);
    for (const key of ['--skuas-header', '--skuas-header-secondary']) assert.equal(tokens[key], accent);
    assert.equal(tokens['--table-header-bg'], 'var(--brand-header-bg)');
    assert.equal(tokens['--table-footer-bg'], 'var(--brand-header-bg)');
    assert.equal(tokens['--card-header-bg'], 'var(--brand-header-bg)');
    assert.ok(brandingContrast(tokens['--brand-on-primary'], accent) >= 4.5);
    assert.ok(brandingContrast(tokens['--brand-on-hover'], tokens['--color-primary-dark']) >= 4.5);
    assert.ok(brandingContrast(tokens['--brand-ink-light'], '#FFFFFF') >= 4.5);
    assert.ok(brandingContrast(tokens['--brand-ink-dark'], '#151A33') >= 4.5);
    assert.ok(brandingContrast(tokens['--brand-ink-light'], tokens['--brand-soft-light']) >= 4.5);
    assert.ok(brandingContrast(tokens['--brand-ink-dark'], tokens['--brand-soft-dark']) >= 4.5);
  }
});

test('text remains readable through the colour spectrum, including midtone colours', () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const hex = '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
    assert.ok(brandingContrast(brandingTextColor(hex), hex) >= 4.5, hex);
  }
});

test('short custom colours normalize and invalid/missing colours use the existing default', () => {
  assert.equal(getBrandingTokens({brandingAccentColor:' #abc '})['--color-primary'], '#AABBCC');
  for (const value of [undefined, '', 'red', 'url(unsafe)', '#12']) assert.equal(getBrandingTokens({brandingAccentColor:value})['--color-primary'], '#EF4444');
});

test('cached settings and theme toggling preserve the chosen brand across reloads', () => {
  const values = new Map();
  const styles = new Map();
  globalThis.localStorage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  globalThis.document = {documentElement:{dataset:{},style:{setProperty:(key,value)=>styles.set(key,value)}}};
  try {
    saveBrandingSettings({brandingAccentColor:'#abc',companyName:'Local fixture'});
    const cached = loadBrandingSettings();
    assert.equal(cached.brandingAccentColor, '#AABBCC');
    for (const theme of ['dark','light']) {
      values.set('skuas-theme', theme);
      applyBrandingTheme({...cached,brandingAppearance:theme==='dark'?'light':'dark'});
      assert.equal(document.documentElement.dataset.theme,theme);
      assert.equal(document.documentElement.dataset.branding,'true');
      assert.equal(styles.get('--brand-header-bg'),'#AABBCC');
      assert.equal(styles.get('--color-primary'),'#AABBCC');
      assert.equal(styles.get('--table-footer-text'),'var(--brand-header-text)');
    }
  } finally { delete globalThis.localStorage;delete globalThis.document; }
});
