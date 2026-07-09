import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { reconstruirLineas, parseVidaLaboral } from './parser.js';
import { calcularJubilacion, edadEn, restarHorasBolsa, acumularBolsa } from './calc.js';
import { vizHero, vizKpis, vizMeter, vizCalendario, vizTimeline, activarTooltips, fraseCuentaAtras } from './viz.js';

let ultimasSituaciones = [];

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

const $ = (id) => document.getElementById(id);

const fmtFecha = (f) =>
  f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtCorta = (f) =>
  f.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const aInputDate = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const deInputDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
const fmtEdad = ({ anos, meses }) => (meses ? `${anos} años y ${meses} meses` : `${anos} años`);

function mostrarError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.hidden = !msg;
}

async function procesarPdf(file) {
  mostrarError('');
  $('aviso-parser').hidden = true;
  $('dropzone-texto').textContent = `Procesando «${file.name}»…`;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const lineas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      lineas.push(...reconstruirLineas(tc.items));
    }
    const datos = parseVidaLaboral(lineas);
    rellenarFormulario(datos);
    $('dropzone-texto').textContent = `✅ «${file.name}» leído correctamente. Puedes subir otro PDF si lo deseas.`;
  } catch (e) {
    $('dropzone-texto').innerHTML = 'Arrastra aquí el PDF o <u>haz clic para seleccionarlo</u>';
    mostrarError(e.message || 'No se ha podido leer el PDF.');
  }
}

function rellenarFormulario(datos) {
  const faltan = [];
  if (datos.nacimiento) $('nacimiento').value = aInputDate(datos.nacimiento);
  else faltan.push('fecha de nacimiento');
  if (datos.totalComputable) $('dias-cotizados').value = datos.totalComputable.dias;
  else faltan.push('días cotizados');
  if (datos.fechaInforme) $('fecha-informe').value = aInputDate(datos.fechaInforme);

  const resumen = $('resumen-persona');
  const partes = [];
  if (datos.nombre) partes.push(`<strong>${datos.nombre}</strong>`);
  if (datos.totalComputable) {
    const d = datos.totalComputable.desglose;
    partes.push(`${datos.totalComputable.dias.toLocaleString('es-ES')} días computables (${d.anos} años, ${d.meses} meses y ${d.dias} días)`);
  }
  if (datos.diasPluriempleo) partes.push(`pluriempleo/pluriactividad descontado: ${datos.diasPluriempleo} días`);
  resumen.innerHTML = partes.join(' · ');
  resumen.hidden = partes.length === 0;

  ultimasSituaciones = datos.situaciones;
  if (datos.situaciones.length) {
    const cont = $('viz-vida-laboral');
    cont.innerHTML = vizTimeline(datos.situaciones, new Date());
    cont.hidden = false;
    activarTooltips(cont);
    const tbody = $('tabla-situaciones').querySelector('tbody');
    tbody.innerHTML = '';
    for (const s of datos.situaciones) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.regimen}</td><td>${s.empresa || '—'}</td>` +
        `<td>${s.fechaAlta ? fmtCorta(s.fechaAlta) : '—'}</td>` +
        `<td>${s.fechaBaja ? fmtCorta(s.fechaBaja) : 'en alta'}</td>` +
        `<td class="num">${s.dias != null ? s.dias.toLocaleString('es-ES') : '—'}</td>`;
      tbody.appendChild(tr);
    }
    $('detalle-situaciones').hidden = false;
  }

  if (faltan.length) {
    const aviso = $('aviso-parser');
    aviso.textContent = `No se ha podido extraer del PDF: ${faltan.join(', ')}. Complétalo a mano en el paso 2.`;
    aviso.hidden = false;
  }
}

function calcular() {
  mostrarError('');
  const nacimiento = deInputDate($('nacimiento').value);
  const dias = Number($('dias-cotizados').value);
  const fechaInforme = deInputDate($('fecha-informe').value) || new Date();

  if (!nacimiento) return mostrarError('Falta la fecha de nacimiento (paso 2).');
  if (!dias && dias !== 0) return mostrarError('Faltan los días cotizados (paso 2).');

  const entrada = {
    nacimiento,
    diasCotizados: dias,
    fechaInforme,
    sigueCotizando: $('sigue-cotizando').checked,
  };
  if ($('es-policia').checked) {
    const inicio = deInputDate($('policia-inicio').value);
    if (!inicio) return mostrarError('Indica desde cuándo trabajas como policía local (paso 3).');
    const fin = deInputDate($('policia-fin').value);
    if (fin && fin <= inicio) return mostrarError('La fecha de fin como policía local debe ser posterior a la de inicio.');
    entrada.policia = { inicio, fin };
  }

  const gub = !$('bloque-gub').hidden
    ? {
        horas: Number($('gub-horas').value) || 0,
        horasAnuales: Number($('gub-horas-anuales').value) || 1519,
        antiguedad: deInputDate($('gub-antiguedad').value),
      }
    : null;

  const r = calcularJubilacion(entrada);
  renderResultado(r, nacimiento, gub);
}

function renderResultado(r, nacimiento, gub = null) {
  const hoy = new Date();
  const trozos = [];

  for (const aviso of r.avisos) {
    trozos.push(`<p class="aviso">⚠️ ${aviso}</p>`);
  }

  const conPolicia = r.policia?.elegible && r.policia.resultado;
  const principal = conPolicia ? r.policia.resultado : r.ordinaria;
  const tituloHero = conPolicia
    ? 'Como policía local, te podrás jubilar el'
    : 'Te podrás jubilar el';

  if (principal) {
    trozos.push(`<div class="hero">${vizHero(tituloHero, principal.fecha, hoy)}</div>`);

    const tiles = [
      { label: 'Edad en esa fecha', valor: fmtEdad(edadEn(nacimiento, principal.fecha)) },
      { label: 'Cotización acreditada', valor: `${principal.cotizados.toLocaleString('es-ES')} días`, detalle: `≈ ${(principal.cotizados / 365.25).toFixed(1)} años` },
    ];
    if (conPolicia) {
      const p = r.policia;
      tiles.push({ label: 'Años de servicio policial', valor: `${p.anosServicio} años`, detalle: 'en la fecha de jubilación' });
      tiles.push({ label: 'Reducción aplicada', valor: fmtEdad({ anos: Math.floor(p.reduccionAplicadaMeses / 12), meses: p.reduccionAplicadaMeses % 12 }), detalle: `0,20 × ${p.anosServicio} años (RD 1449/2018)` });
    } else if (r.ordinaria) {
      tiles.push({ label: 'Edad ordinaria exigida', valor: fmtEdad({ anos: principal.exigida[0], meses: principal.exigida[1] }), detalle: principal.carreraLarga ? 'carrera larga acreditada' : 'edad general del año' });
    }
    trozos.push(vizKpis(tiles));

    const inicioVida = ultimasSituaciones.length
      ? new Date(Math.min(...ultimasSituaciones.filter((s) => s.fechaAlta).map((s) => s.fechaAlta.getTime())))
      : new Date(nacimiento.getFullYear() + 16, nacimiento.getMonth(), nacimiento.getDate());
    trozos.push(`<div class="viz-grid">
      <div class="viz-panel">${vizCalendario(principal.fecha)}</div>
      <div class="viz-panel">${vizMeter(inicioVida, hoy, principal.fecha)}</div>
    </div>`);

    if (gub) {
      trozos.push(renderGub(gub, principal.fecha, hoy));
    }
  }

  if (conPolicia) {
    const p = r.policia;
    trozos.push(`<div class="resultado-bloque">
      <p class="resultado-detalle">El período anticipado (${p.diasBonificados.toLocaleString('es-ES')} días) cuenta como cotizado para el porcentaje de la pensión (art. 4 RD 1449/2018).</p>
      ${p.motivos.map((m) => `<p class="resultado-detalle">ℹ️ ${m}</p>`).join('')}
    </div>`);
    if (r.ordinaria) {
      const adelanto = desgloseAnticipo(r.policia.resultado.fecha, r.ordinaria.fecha);
      const adelantoMeses = adelanto.anos * 12 + adelanto.meses;
      const notaAdelanto = adelantoMeses < r.policia.reduccionAplicadaMeses
        ? `<p class="resultado-detalle">ℹ️ El adelanto (${fmtEdad(adelanto)}) es menor que la reducción (${fmtEdad({ anos: Math.floor(r.policia.reduccionAplicadaMeses / 12), meses: r.policia.reduccionAplicadaMeses % 12 })}) porque la reducción se aplica sobre la edad ordinaria exigida <em>en el momento de jubilarte</em> (${fmtEdad({ anos: r.policia.resultado.exigida[0], meses: r.policia.resultado.exigida[1] })}, al no acreditar aún la carrera larga entonces), mientras que tu fecha ordinaria de referencia sí se beneficia de la carrera larga.</p>`
        : '';
      trozos.push(`<div class="resultado-bloque secundario">
        <p><strong>Sin la reducción de policía local</strong> (jubilación ordinaria): <strong>${fmtFecha(r.ordinaria.fecha)}</strong>, al cumplir ${fmtEdad({ anos: r.ordinaria.exigida[0], meses: r.ordinaria.exigida[1] })}. Te adelantas <strong>${fmtEdad(adelanto)}</strong>.</p>
        ${notaAdelanto}
        <p class="resultado-detalle">${explicacionEdadOrdinaria(r.ordinaria)}</p>
      </div>`);
    }
  } else if (r.policia && !r.policia.elegible) {
    trozos.push(`<div class="resultado-bloque secundario">
      <p><strong>Jubilación anticipada como policía local</strong></p>
      ${r.policia.motivos.map((m) => `<p class="aviso">⚠️ ${m}</p>`).join('')}
    </div>`);
  }

  if (r.ordinaria && !conPolicia) {
    trozos.push(`<div class="resultado-bloque secundario">
      <p class="resultado-detalle">${explicacionEdadOrdinaria(r.ordinaria)}</p>
    </div>`);
  }

  if (!principal) {
    trozos.push('<p class="aviso">No se ha podido determinar la fecha de jubilación con los datos introducidos.</p>');
  }

  $('resultado').innerHTML = trozos.join('');
  $('zona-resultado').hidden = false;
  $('zona-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Bloque GUB: bolsa actual + lo que se acumulará cada año hasta la jubilación
// (15 min/jornada, Indispuesto, AP por trienios y VA por antigüedad) → fecha
// en la que se puede dejar de ir a trabajar.
function renderGub(gub, fechaJubilacion, hoy) {
  const fmtH = (h) => h.toLocaleString('es-ES', { maximumFractionDigits: 0 });
  const fmtD = (d) => d.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const acum = acumularBolsa({
    desde: hoy,
    hasta: fechaJubilacion,
    antiguedadInicio: gub.antiguedad,
    horasAnuales: gub.horasAnuales,
  });
  const total = gub.horas + acum.horasTotales;
  if (total <= 0) return '';
  const b = restarHorasBolsa(fechaJubilacion, total, gub.horasAnuales);

  const conceptos = [
    ['Bolsa acumulada hoy', gub.horas, null],
    [`15 min × jornada trabajada (≈ ${fmtH(acum.extra15.jornadasAno)} jornadas/año → ${fmtD(gub.horasAnuales / 32)} h/año)`, acum.extra15.horas, null],
    ['Indispuesto (2 días/año)', acum.indispuesto.horas, acum.indispuesto.dias],
    ['Asuntos personales por trienios (EBEP)', acum.ap.horas, acum.ap.dias],
    ['Vacaciones adicionales por antigüedad', acum.va.horas, acum.va.dias],
  ];
  const filasConceptos = conceptos
    .filter(([, horas]) => horas > 0)
    .map(([nombre, horas, dias]) =>
      `<tr><td>${nombre}</td><td class="num">${dias != null ? `${fmtD(dias)} días` : '—'}</td><td class="num"><strong>${fmtH(horas)} h</strong></td></tr>`)
    .join('');

  const filasAno = acum.porAno.map((a) =>
    `<tr><td>${a.ano}${a.frac < 0.995 ? ' (parcial)' : ''}</td>` +
    `<td class="num">${gub.antiguedad ? `${a.anosServicio} años (${a.trienios} trienios)` : '—'}</td>` +
    `<td class="num">${a.apDias}</td><td class="num">${a.vaDias}</td>` +
    `<td class="num">${fmtH(a.horas)} h</td></tr>`).join('');

  const avisoAntiguedad = !gub.antiguedad
    ? '<p class="aviso">⚠️ Sin la fecha de antigüedad no se incluyen los días de asuntos personales por trienios ni las vacaciones adicionales: indícala en el paso 3 para el cálculo completo.</p>'
    : '';

  return `<div class="gub">
    <p class="gub-titulo">🕒 Con tu bolsa de horas (GUB) y lo que acumularás hasta la jubilación, podrías dejar de ir a trabajar el</p>
    <p class="gub-fecha">${fmtFecha(b.fecha)}</p>
    <p class="hero-countdown ${b.fecha <= hoy ? 'pasada' : ''}">${b.fecha <= hoy ? '✅ ' : '⏳ '}${fraseCuentaAtras(hoy, b.fecha)}</p>
    ${avisoAntiguedad}
    <div class="tabla-scroll">
      <table>
        <thead><tr><th>Concepto</th><th>Días de fiesta</th><th>Horas</th></tr></thead>
        <tbody>${filasConceptos}
          <tr><td><strong>Total en la bolsa al jubilarte</strong></td><td class="num"></td><td class="num"><strong>${fmtH(total)} h</strong></td></tr>
        </tbody>
      </table>
    </div>
    <p class="resultado-detalle">${fmtH(total)} h = <strong>${b.turnos.toLocaleString('es-ES')} turnos de 8 h</strong> ≈ <strong>${b.diasNaturales.toLocaleString('es-ES')} días naturales</strong> con el calendario de convenio de ${gub.horasAnuales.toLocaleString('es-ES')} h/año (cada turno cubre ≈ ${b.diasPorTurno.toFixed(1)} días naturales). La bolsa cubriría desde el ${fmtCorta(b.fecha)} hasta tu jubilación el ${fmtCorta(fechaJubilacion)}.</p>
    <details>
      <summary>Ver acumulación año a año</summary>
      <div class="tabla-scroll">
        <table>
          <thead><tr><th>Año</th><th>Antigüedad</th><th>Días AP</th><th>Días VA</th><th>Horas del año</th></tr></thead>
          <tbody>${filasAno}</tbody>
        </table>
      </div>
      <p class="nota">Se supone que sigues generando todos los conceptos hasta la fecha de jubilación (mientras gastas la bolsa sigues de alta) y que guardas íntegros en la bolsa los días de AP, VA e Indispuesto de cada año.</p>
    </details>
  </div>`;
}

// Explica por qué se aplica 65 (carrera larga) o la edad general (67 desde
// 2027) — es la duda más habitual al ver el resultado.
function explicacionEdadOrdinaria(o) {
  const ano = o.fecha.getFullYear();
  const umbral = ano >= 2027 ? '38 años y 6 meses' : '38 años y 3 meses';
  const general = ano >= 2027 ? '67 años' : '66 años y 10 meses';
  const cotizAnos = (o.cotizados / 365.25).toFixed(1);
  return o.carreraLarga
    ? `¿Por qué 65 años y no ${general}? Porque en esa fecha acreditarás ${o.cotizados.toLocaleString('es-ES')} días cotizados (≈ ${cotizAnos} años), por encima del umbral de ${umbral} de «carrera larga»: la ley fija entonces la edad ordinaria en 65 años (art. 205.1.a LGSS). La edad general de ${general} solo se aplica a quien no alcanza esa cotización.`
    : `Se aplica la edad general de ${general} porque en esa fecha no se alcanza el umbral de ${umbral} cotizados que permitiría jubilarse a los 65 (art. 205.1.a LGSS): acreditarías ${o.cotizados.toLocaleString('es-ES')} días (≈ ${cotizAnos} años).`;
}

function desgloseAnticipo(antes, despues) {
  let anos = despues.getFullYear() - antes.getFullYear();
  let meses = despues.getMonth() - antes.getMonth();
  if (despues.getDate() < antes.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }
  return { anos, meses };
}

// --- Eventos ---
const dropzone = $('dropzone');
dropzone.addEventListener('click', () => $('input-pdf').click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') $('input-pdf').click();
});
$('input-pdf').addEventListener('change', (e) => {
  if (e.target.files[0]) procesarPdf(e.target.files[0]);
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('arrastrando');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('arrastrando'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('arrastrando');
  if (e.dataTransfer.files[0]) procesarPdf(e.dataTransfer.files[0]);
});

$('es-policia').addEventListener('change', (e) => {
  $('bloque-policia').hidden = !e.target.checked;
});
// La fecha de inicio como policía suele coincidir con la antigüedad: se copia
// al campo del bloque GUB si aún está vacío.
$('policia-inicio').addEventListener('change', (e) => {
  if (!$('gub-antiguedad').value) $('gub-antiguedad').value = e.target.value;
});
$('btn-gub').addEventListener('click', () => {
  const abierto = $('bloque-gub').hidden;
  $('bloque-gub').hidden = !abierto;
  $('btn-gub').setAttribute('aria-expanded', String(abierto));
});
$('btn-calcular').addEventListener('click', calcular);
