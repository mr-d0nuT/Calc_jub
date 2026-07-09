import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularJubilacion, umbralDias, entradaTabla, escalaPolicia6, addAnosMeses, edadEn, restarHorasBolsa, diasAsuntosPropios, diasVacacionesAntiguedad, acumularBolsa } from '../js/calc.js';

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

test('restarHorasBolsa con calendario de convenio GUB (1.519 h/año)', () => {
  // Un año completo de bolsa: 1.519 h → 365 días naturales atrás.
  const anual = restarHorasBolsa(d('2038-09-15'), 1519, 1519);
  assert.equal(anual.diasNaturales, 365);
  assert.equal(iso(anual.fecha), '2037-09-15');
  // 480 h = 60 turnos de 8 h ≈ 115 días naturales (cada turno ≈ 1,9 días).
  const b = restarHorasBolsa(d('2038-09-15'), 480, 1519);
  assert.equal(b.turnos, 60);
  assert.equal(b.diasNaturales, 115);
  assert.equal(iso(b.fecha), '2038-05-23');
  assert.ok(Math.abs(b.diasPorTurno - 1.92) < 0.01);
  // 0 horas: la propia fecha.
  assert.equal(iso(restarHorasBolsa(d('2038-09-15'), 0).fecha), '2038-09-15');
});

test('diasAsuntosPropios: 2 al 6.º trienio, +1 por trienio desde el 8.º', () => {
  assert.equal(diasAsuntosPropios(5), 0);
  assert.equal(diasAsuntosPropios(6), 2);
  assert.equal(diasAsuntosPropios(7), 2);
  assert.equal(diasAsuntosPropios(8), 3);
  assert.equal(diasAsuntosPropios(10), 5);
});

test('diasVacacionesAntiguedad según años de servicio', () => {
  assert.equal(diasVacacionesAntiguedad(9), 0);
  assert.equal(diasVacacionesAntiguedad(10), 1);
  assert.equal(diasVacacionesAntiguedad(14), 1);
  assert.equal(diasVacacionesAntiguedad(15), 2);
  assert.equal(diasVacacionesAntiguedad(20), 3);
  assert.equal(diasVacacionesAntiguedad(25), 4);
  assert.equal(diasVacacionesAntiguedad(40), 4);
});

test('acumularBolsa: un año completo sin antigüedad (15 min + Indispuesto)', () => {
  const a = acumularBolsa({ desde: d('2027-01-01'), hasta: d('2028-01-01'), horasAnuales: 1519 });
  // 15 min × (1.519/8 = 189,9 jornadas) = 1.519/32 ≈ 47,5 h; Indispuesto 2 días = 16 h.
  assert.ok(Math.abs(a.extra15.horas - 1519 / 32) < 0.01);
  assert.ok(Math.abs(a.indispuesto.horas - 16) < 0.01);
  assert.equal(a.ap.horas, 0);
  assert.equal(a.va.horas, 0);
  assert.ok(Math.abs(a.horasTotales - (1519 / 32 + 16)) < 0.01);
});

test('acumularBolsa: la antigüedad genera días de AP y VA', () => {
  // En 2027 acredita 30 años de servicio → 10 trienios → 5 días de AP y 4 de VA.
  const a = acumularBolsa({ desde: d('2027-01-01'), hasta: d('2028-01-01'), antiguedadInicio: d('1997-01-01'), horasAnuales: 1519 });
  assert.equal(a.porAno.length, 1);
  assert.equal(a.porAno[0].trienios, 10);
  assert.equal(a.porAno[0].apDias, 5);
  assert.equal(a.porAno[0].vaDias, 4);
  assert.ok(Math.abs(a.ap.horas - 40) < 0.01);
  assert.ok(Math.abs(a.va.horas - 32) < 0.01);
  assert.ok(Math.abs(a.horasTotales - (1519 / 32 + 16 + 40 + 32)) < 0.01);
});

test('acumularBolsa: prorratea los años parciales', () => {
  // Un año repartido entre 2027 y 2028: mismo total que un año completo (±redondeo bisiesto).
  const a = acumularBolsa({ desde: d('2027-07-01'), hasta: d('2028-07-01'), horasAnuales: 1519 });
  assert.equal(a.porAno.length, 2);
  assert.ok(Math.abs(a.horasTotales - (1519 / 32 + 16)) < 0.5);
});

test('acumularBolsa: sin período no acumula nada', () => {
  const a = acumularBolsa({ desde: d('2028-01-01'), hasta: d('2027-01-01') });
  assert.equal(a.horasTotales, 0);
  assert.equal(a.porAno.length, 0);
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

test('desde 2027: 65 años con carrera larga proyectada, 67 sin ella', () => {
  // Nacido en 1977: cumplirá 65 en 2042. Si sigue cotizando y en esa fecha
  // supera los 38a6m (14.062 días), la edad ordinaria es 65, no 67.
  const conCarrera = calcularJubilacion({
    nacimiento: d('1977-08-28'),
    diasCotizados: 8500,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: true,
  });
  assert.equal(iso(conCarrera.ordinaria.fecha), '2042-08-28');
  assert.deepEqual(conCarrera.ordinaria.exigida, [65, 0]);
  assert.equal(conCarrera.ordinaria.carreraLarga, true);

  // Con pocos días acumulados no se llega al umbral: edad general de 67.
  const sinCarrera = calcularJubilacion({
    nacimiento: d('1977-08-28'),
    diasCotizados: 5000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: true,
  });
  assert.equal(iso(sinCarrera.ordinaria.fecha), '2044-08-28');
  assert.deepEqual(sinCarrera.ordinaria.exigida, [67, 0]);
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

test('policía local: 25 años de servicio (con fecha de fin) → 5 años de anticipación', () => {
  const r = calcularJubilacion({
    nacimiento: d('1968-05-20'),
    diasCotizados: 15500,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { inicio: d('1995-01-01'), fin: d('2020-01-01') }, // 25 años justos
  });
  assert.equal(r.policia.elegible, true);
  assert.equal(r.policia.anosServicio, 25);
  assert.equal(r.policia.reduccionAplicadaMeses, 60); // 0,20 × 25 = 5 años
  assert.equal(iso(r.policia.resultado.fecha), '2028-05-20'); // 60 años (65 − 5)
});

test('policía local: tope de anticipación de 6 años con carrera larga', () => {
  const r = calcularJubilacion({
    nacimiento: d('1969-03-15'),
    diasCotizados: 16000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { inicio: d('1988-01-01'), fin: d('2024-01-01') }, // 36 años
  });
  assert.equal(r.policia.reduccionTeoricaMeses, 86); // 0,20 × 36 = 7,2 años
  assert.equal(r.policia.reduccionAplicadaMeses, 72); // tope 6 años
  assert.equal(iso(r.policia.resultado.fecha), '2028-03-15'); // 59 años (65 − 6)
  assert.ok(r.policia.motivos.some((m) => m.includes('tope')));
});

test('policía local en activo: los años de servicio se computan en la fecha de jubilación', () => {
  const r = calcularJubilacion({
    nacimiento: d('1972-01-01'),
    diasCotizados: 13000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: true,
    policia: { inicio: d('2005-01-01'), fin: null }, // sigue en activo
  });
  // A fecha del informe lleva 21 años (reducción 4a2m), pero al seguir en
  // activo la reducción crece: la primera fecha válida es con 26 años de
  // servicio (reducción 62 meses) a los 59 años y 10 meses de edad.
  assert.equal(r.policia.anosServicio, 26);
  assert.equal(r.policia.reduccionAplicadaMeses, 62);
  assert.equal(iso(r.policia.resultado.fecha), '2031-11-01');
});

test('policía local: sin 15 años cotizados no es elegible', () => {
  const r = calcularJubilacion({
    nacimiento: d('1966-01-15'),
    diasCotizados: 15000,
    fechaInforme: d('2026-07-03'),
    sigueCotizando: false,
    policia: { inicio: d('2010-01-01'), fin: d('2022-01-01') }, // 12 años
  });
  assert.equal(r.policia.elegible, false);
  assert.ok(r.policia.motivos.some((m) => m.includes('15 años')));
});
