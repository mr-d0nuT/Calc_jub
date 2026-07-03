import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVidaLaboral, reconstruirLineas } from '../js/parser.js';

const lineas = JSON.parse(readFileSync(new URL('./fixtures/vida_laboral_lineas.json', import.meta.url)));
const iso = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

test('extrae los datos identificativos y las fechas', () => {
  const r = parseVidaLaboral(lineas);
  assert.equal(r.nombre, 'NOMBRE APELLIDO EJEMPLO');
  assert.equal(iso(r.nacimiento), '1948-08-18');
  assert.equal(iso(r.fechaInforme), '2026-07-03');
});

test('extrae los totales de días en alta y computables', () => {
  const r = parseVidaLaboral(lineas);
  assert.equal(r.totalAlta.dias, 8676);
  assert.deepEqual(r.totalAlta.desglose, { anos: 23, meses: 9, dias: 3 });
  assert.equal(r.totalComputable.dias, 8408);
  assert.equal(r.diasPluriempleo, 268);
});

test('extrae las situaciones de la tabla', () => {
  const r = parseVidaLaboral(lineas);
  assert.equal(r.situaciones.length, 8);
  const autonomo = r.situaciones[0];
  assert.equal(autonomo.regimen, 'AUTONOMO');
  assert.equal(autonomo.empresa, 'BARCELONA');
  assert.equal(iso(autonomo.fechaAlta), '2000-05-01');
  assert.equal(iso(autonomo.fechaBaja), '2011-06-30');
  assert.equal(autonomo.dias, 4078);
  const abierta = r.situaciones[7];
  assert.equal(abierta.fechaBaja, null);
  assert.equal(abierta.dias, null);
});

test('rechaza un PDF que no es vida laboral', () => {
  assert.throws(() => parseVidaLaboral(['CERTIFICADO CATASTRAL TELEMÁTICO']), /no parece un Informe de Vida Laboral/);
});

test('reconstruirLineas ordena por Y descendente y X ascendente', () => {
  const items = [
    { str: 'mundo', transform: [1, 0, 0, 1, 50, 100] },
    { str: 'hola', transform: [1, 0, 0, 1, 10, 101] },
    { str: 'abajo', transform: [1, 0, 0, 1, 10, 50] },
  ];
  assert.deepEqual(reconstruirLineas(items), ['hola mundo', 'abajo']);
});
