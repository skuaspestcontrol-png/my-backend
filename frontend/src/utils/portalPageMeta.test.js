import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPortalBreadcrumbs, portalPages } from './portalPageMeta.js';

test('breadcrumb metadata covers existing rendering paths without registering routes', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  const paths = [...app.matchAll(/<Route path="([^"]+)" element=\{(?!<Navigate)/g)].map(match => match[1]);
  assert.equal(paths.length, 54);
  assert.deepEqual(new Set(portalPages.map(page => page.path)), new Set(paths));
});
test('static and parameterized job paths keep their display context', () => {
  assert.equal(getPortalBreadcrumbs('/tasks/detail/index').at(-1).label, 'Assigned Jobs');
  assert.equal(getPortalBreadcrumbs('/tasks/detail/index/test-job').at(-1).label, 'Job Details');
  assert.equal(getPortalBreadcrumbs('/tasks/detail/test-job').at(-1).label, 'Job Details');
});
test('query strings, login and dashboard do not create spurious breadcrumb links', () => {
  assert.equal(getPortalBreadcrumbs('/sales/invoices/?fromContract=1').at(-1).label, 'All Invoices');
  assert.deepEqual(getPortalBreadcrumbs('/'), []);
  assert.deepEqual(getPortalBreadcrumbs('/dashboard'), [{ label: 'Dashboard' }]);
  assert.equal(getPortalBreadcrumbs('/not-a-route').at(-1).label, 'Workspace');
});
