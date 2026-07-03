import * as pdfjsLib from '../vendor/pdf.min.mjs';
import { reconstruirLineas, parseVidaLaboral } from './parser.js';
import { calcularJubilacion, edadEn } from './calc.js';

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

  if (datos.situaciones.length) {
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

  const r = calcularJubilacion(entrada);
  renderResultado(r, nacimiento);
}

function renderResultado(r, nacimiento) {
  const hoy = new Date();
  const trozos = [];

  for (const aviso of r.avisos) {
    trozos.push(`<p class="aviso">⚠️ ${aviso}</p>`);
  }

  if (r.policia) {
    const p = r.policia;
    if (p.elegible && p.resultado) {
      const pasada = p.resultado.fecha <= hoy;
      trozos.push(`<div class="resultado-bloque">
        <p><strong>Jubilación anticipada como policía local</strong> (RD 1449/2018)</p>
        <p class="resultado-fecha">${fmtFecha(p.resultado.fecha)}</p>
        <p class="resultado-detalle">${pasada ? 'Ya cumples las condiciones desde esa fecha.' : `Con ${fmtEdad(edadEn(nacimiento, p.resultado.fecha))} de edad.`}</p>
        <p class="resultado-detalle">En esa fecha acreditarás <strong>${p.anosServicio} años completos de servicio</strong> como policía local → reducción aplicada: ${Math.floor(p.reduccionAplicadaMeses / 12)} años y ${p.reduccionAplicadaMeses % 12} meses (0,20 × ${p.anosServicio} años, art. 2.1).</p>
        <p class="resultado-detalle">Cotización estimada en esa fecha: ${p.resultado.cotizados.toLocaleString('es-ES')} días. El período anticipado (${p.diasBonificados.toLocaleString('es-ES')} días) cuenta como cotizado para el porcentaje de la pensión (art. 4).</p>
        ${p.motivos.map((m) => `<p class="resultado-detalle">ℹ️ ${m}</p>`).join('')}
      </div>`);
    } else {
      trozos.push(`<div class="resultado-bloque secundario">
        <p><strong>Jubilación anticipada como policía local</strong></p>
        ${p.motivos.map((m) => `<p class="aviso">⚠️ ${m}</p>`).join('')}
      </div>`);
    }
  }

  if (r.ordinaria) {
    const o = r.ordinaria;
    const pasada = o.fecha <= hoy;
    trozos.push(`<div class="resultado-bloque ${r.policia?.elegible ? 'secundario' : ''}">
      <p><strong>Jubilación ordinaria</strong></p>
      <p class="resultado-fecha">${fmtFecha(o.fecha)}</p>
      <p class="resultado-detalle">${pasada ? 'Ya has alcanzado la edad ordinaria de jubilación.' : `Al cumplir ${fmtEdad({ anos: o.exigida[0], meses: o.exigida[1] })}.`}</p>
      <p class="resultado-detalle">${o.carreraLarga
        ? 'Acreditas la cotización mínima para jubilarte a los 65 años (carrera larga).'
        : 'No se alcanza la cotización mínima de carrera larga, se aplica la edad ordinaria general de ese año.'}</p>
      <p class="resultado-detalle">Cotización estimada en esa fecha: ${o.cotizados.toLocaleString('es-ES')} días.</p>
    </div>`);
  } else {
    trozos.push('<p class="aviso">No se ha podido determinar la fecha de jubilación con los datos introducidos.</p>');
  }

  $('resultado').innerHTML = trozos.join('');
  $('zona-resultado').hidden = false;
  $('zona-resultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
$('btn-calcular').addEventListener('click', calcular);
