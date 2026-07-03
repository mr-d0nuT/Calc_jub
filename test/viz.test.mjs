import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desglose, fraseCuentaAtras, vizTimeline, vizMeter, vizCalendario } from '../js/viz.js';

const d = (s) => new Date(s + 'T00:00:00');

test('desglose calcula años, meses y días de calendario', () => {
  assert.deepEqual(desglose(d('2026-07-03'), d('2029-09-18')), { anos: 3, meses: 2, dias: 15 });
  assert.deepEqual(desglose(d('2026-01-31'), d('2026-03-01')), { anos: 0, meses: 1, dias: 1 });
});

test('fraseCuentaAtras distingue futuro y pasado', () => {
  assert.match(fraseCuentaAtras(d('2026-07-03'), d('2029-09-18')), /^Faltan 3 años, 2 meses y 15 días$/);
  assert.match(fraseCuentaAtras(d('2026-07-03'), d('2013-09-18')), /^Cumpliste las condiciones hace/);
});

test('vizTimeline genera una barra por situación y leyenda por régimen', () => {
  const svg = vizTimeline([
    { regimen: 'GENERAL', empresa: 'ACME', fechaAlta: d('1990-01-01'), fechaBaja: d('2000-01-01'), dias: 3652 },
    { regimen: 'AUTONOMO', empresa: '', fechaAlta: d('2001-01-01'), fechaBaja: null, dias: null },
  ], d('2026-07-03'));
  assert.equal((svg.match(/class="tl-fila"/g) || []).length, 2);
  assert.ok(svg.includes('GENERAL') && svg.includes('AUTONOMO'));
  assert.ok(svg.includes('var(--chart-1)') && svg.includes('var(--chart-2)'));
  assert.ok(svg.includes('en alta')); // tooltip de la situación abierta
});

test('vizMeter limita el porcentaje a [0,100]', () => {
  assert.ok(vizMeter(d('1990-01-01'), d('2026-07-03'), d('2013-09-18')).includes('100%'));
  const m = vizMeter(d('1990-01-01'), d('2026-07-03'), d('2030-01-01'));
  assert.match(m, /width:9[0-9]\.\d%/);
});

test('vizCalendario marca el día y arranca en lunes', () => {
  const cal = vizCalendario(d('2013-09-18'));
  assert.ok(cal.includes('Septiembre 2013'));
  assert.equal((cal.match(/cal-marcado/g) || []).length, 1);
  // El 1 de septiembre de 2013 fue domingo: 6 huecos antes del día 1.
  assert.ok(cal.includes('<span></span><span></span><span></span><span></span><span></span><span></span><span class="cal-dia'));
});
