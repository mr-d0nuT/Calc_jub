import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularJubilacion, umbralDias, entradaTabla, escalaPolicia6, addAnosMeses, edadEn } from '../js/calc.js';

const d = (s) => new Date(s + 'T00:00:00');
const iso = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

test('umbralDias convierte años y meses a días', () => {
  assert.equal(umbralDias(15), Math.round(15 * 365.25));
  assert.equal(umbralDias(38, 6), Math.round(38.5 * 365.25));
});

test('tabla de edad ordinaria: valores clave', () => {
  assert.deepEqual(entradaTabla(2026), { carrera: [38, 3], edad: [66, 10] });
  assert.deepEqual(entradaTabla(2027), { carrera: [38, 6], edad: [67, 0] });
  assert.deepEqual(entradaTabla(2030), { carrera: [38, 6], edad: [67, 0] });
});

test('escala transitoria policía local para 6.º año', () => {
  assert.equal(escalaPolicia6(2026), 36.5);
  assert.equal(escalaPolicia6(2027), 37);
});

test('addAnosMeses ajusta fin de mes', () => {
  assert.equal(iso(addAnosMeses(d('1960-01-31'), 0, 1)), '1960-02-29');
});

test('edadEn calcula años y meses cumplidos', () => {
  assert.deepEqual(edadEn(d('1960-06-15'), d('2026-06-14')), { anos: 65, meses: 11 });
  assert.deepEqual(edadEn(d('1960-06-15'), d('2026-06-15')), { anos: 66, meses: 0 });
});

test('carrera larga: se jubila a los 65', () => {
  const r = calcularJubilacion({
    nacimiento: d('1962-03-10'),
    diasCotizados: 15000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
  });
  assert.equal(iso(r.ordinaria.fecha), '2027-03-10');
  assert.deepEqual(r.ordinaria.exigida, [65, 0]);
  assert.equal(r.ordinaria.carreraLarga, true);
});

test('carrera corta: 67 años a partir de 2027', () => {
  const r = calcularJubilacion({
    nacimiento: d('1962-03-10'),
    diasCotizados: 10000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
  });
  assert.equal(iso(r.ordinaria.fecha), '2029-03-10');
  assert.deepEqual(r.ordinaria.exigida, [67, 0]);
});

test('sigue cotizando: los días futuros cuentan para el umbral', () => {
  // A fecha del informe le faltan pocos días para la carrera larga de 2027;
  // si sigue cotizando los alcanza antes de cumplir 65.
  const r = calcularJubilacion({
    nacimiento: d('1962-03-10'),
    diasCotizados: 14000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: true,
  });
  assert.equal(iso(r.ordinaria.fecha), '2027-03-10');
  assert.deepEqual(r.ordinaria.exigida, [65, 0]);
});

test('informe real de ejemplo: 23 años cotizados, nacida en 1948', () => {
  const r = calcularJubilacion({
    nacimiento: d('1948-08-18'),
    diasCotizados: 8408,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
  });
  // En 2013 la edad exigida sin carrera larga era 65 años y 1 mes.
  assert.equal(iso(r.ordinaria.fecha), '2013-09-18');
  assert.equal(r.avisos.length, 0);
});

test('carencia insuficiente genera aviso', () => {
  const r = calcularJubilacion({
    nacimiento: d('1962-03-10'),
    diasCotizados: 2000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
  });
  assert.ok(r.avisos.some((a) => a.includes('15 años')));
});

test('policía local: 25 años → 5 años de anticipación', () => {
  const r = calcularJubilacion({
    nacimiento: d('1966-01-15'),
    diasCotizados: 15000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { anosTrabajados: 25, anosCotizados: 25 },
  });
  assert.equal(r.policia.elegible, true);
  assert.equal(r.policia.reduccionMeses, 60);
  assert.equal(iso(r.policia.resultado.fecha), '2026-01-15'); // 60 años
});

test('policía local: tope de anticipación de 6 años con carrera larga', () => {
  const r = calcularJubilacion({
    nacimiento: d('1968-05-20'),
    diasCotizados: 15500,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { anosTrabajados: 35, anosCotizados: 35 },
  });
  assert.equal(r.policia.reduccionMeses, 84); // 0,20 × 35 = 7 años
  assert.equal(r.policia.reduccionAplicadaMeses, 72); // tope 6 años
  assert.equal(iso(r.policia.resultado.fecha), '2027-05-20'); // 59 años
  assert.ok(r.policia.motivos.some((m) => m.includes('tope')));
});

test('policía local: sin 15 años cotizados no es elegible', () => {
  const r = calcularJubilacion({
    nacimiento: d('1966-01-15'),
    diasCotizados: 15000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { anosTrabajados: 12, anosCotizados: 12 },
  });
  assert.equal(r.policia.elegible, false);
});
