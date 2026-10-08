import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../styles/admin-fresh-clinical.css',import.meta.url),'utf8');

describe('Clinic Admin Fresh Clinical visual contract',()=>{
 it('keeps the redesign scoped to Clinic Admin',()=>{
  expect(css).toContain('.workspace-shell.admin-workspace');
  expect(css).not.toMatch(/^\.workspace-shell\s*\{/m);
 });
 it('uses Fresh Clinical navigation and workspace geometry',()=>{
  expect(css).toContain('--sidebar:220px');
  expect(css).toContain('--sidebar:72px');
  expect(css).toContain('height:64px');
  expect(css).toContain('background:var(--brand-lime-50)');
  expect(css).toContain('box-shadow:inset 3px 0 0 var(--brand-lime-500)');
  expect(css).toContain('color:var(--forest-950)');
 });
 it('normalizes controls, tables and semantic state presentation',()=>{
  expect(css).toContain('--admin-control-height:44px');
  expect(css).toContain('height:46px');
  expect(css).toContain('min-height:60px');
  expect(css).toContain('[data-state=ACTIVE]');
  expect(css).toContain('[data-state=WAITING]');
  expect(css).toContain('[data-state=FAILED]');
 });
 it('contains desktop responsive contracts without whole-page overflow',()=>{
  for(const width of ['1280','1100','1024'])expect(css).toContain(`@media(max-width:${width}px)`);
  expect(css).toContain('overflow-x:hidden');
  expect(css).toContain('overflow-x:auto');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
 });
 it('does not introduce generic blue admin palette in the scoped stylesheet',()=>{
  for(const blue of ['#176f91','#174e6a','#2385a6','#155a79'])expect(css.toLowerCase()).not.toContain(blue);
 });
});
