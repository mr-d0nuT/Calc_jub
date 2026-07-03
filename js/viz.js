// Componentes visuales: cuenta atrás, stat tiles, meter de progreso,
// mini-calendario y línea temporal de la vida laboral (SVG, sin librerías).

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// Orden fijo de colores por régimen (paleta categórica validada; los regímenes
// no listados toman los siguientes huecos y, a partir del 4.º, gris "otros").
const SLOTS_CHART = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Desglose calendario entre dos fechas (a < b): años, meses, días.
// Se calculan los meses completos desde `a` y se cuentan los días restantes,
// robusto frente a meses de distinta longitud (31 ene → 1 mar = 1 mes y 1 día).
export function desglose(a, b) {
  const addMeses = (f, n) => {
    const d = new Date(f.getFullYear(), f.getMonth() + n, 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(f.getDate(), ultimo));
    return d;
  };
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (addMeses(a, meses) > b) meses -= 1;
  const resto = addMeses(a, meses);
  const dias = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(resto.getFullYear(), resto.getMonth(), resto.getDate())) / 86400000);
  return { anos: Math.floor(meses / 12), meses: meses % 12, dias };
}

function listaEs(partes) {
  if (partes.length <= 1) return partes.join('');
  return partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];
}

export function fraseCuentaAtras(hoy, fecha) {
  const futuro = fecha > hoy;
  const d = futuro ? desglose(hoy, fecha) : desglose(fecha, hoy);
  const partes = [];
  if (d.anos) partes.push(`${d.anos} ${d.anos === 1 ? 'año' : 'años'}`);
  if (d.meses) partes.push(`${d.meses} ${d.meses === 1 ? 'mes' : 'meses'}`);
  if (d.dias || partes.length === 0) partes.push(`${d.dias} ${d.dias === 1 ? 'día' : 'días'}`);
  return futuro ? `Faltan ${listaEs(partes)}` : `Cumpliste las condiciones hace ${listaEs(partes)}`;
}

export function vizHero(titulo, fecha, hoy) {
  const fechaLarga = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const pasada = fecha <= hoy;
  return `
    <p class="hero-etiqueta">${esc(titulo)}</p>
    <p class="hero-fecha">${esc(fechaLarga)}</p>
    <p class="hero-countdown ${pasada ? 'pasada' : ''}">${pasada ? '✅ ' : '⏳ '}${esc(fraseCuentaAtras(hoy, fecha))}</p>`;
}

export function vizKpis(tiles) {
  return `<div class="kpis">${tiles.map((t) => `
    <div class="kpi">
      <span class="kpi-label">${esc(t.label)}</span>
      <span class="kpi-valor">${esc(t.valor)}</span>
      ${t.detalle ? `<span class="kpi-detalle">${esc(t.detalle)}</span>` : ''}
    </div>`).join('')}</div>`;
}

// Meter: recorrido desde el inicio de la vida laboral hasta la jubilación.
export function vizMeter(inicio, hoy, fin) {
  const total = fin - inicio;
  const pct = total <= 0 ? 100 : Math.min(100, Math.max(0, ((hoy - inicio) / total) * 100));
  const pctTxt = pct >= 99.95 ? '100' : pct.toFixed(1);
  return `
    <p class="viz-titulo">Tu recorrido hasta la jubilación</p>
    <div class="meter" role="img" aria-label="Recorrido completado: ${pctTxt}%">
      <div class="meter-fill" style="width:${pctTxt}%"></div>
      <div class="meter-marca" style="left:${pctTxt}%"><span class="meter-pct">${pctTxt}%</span></div>
    </div>
    <div class="meter-extremos">
      <span>${inicio.getFullYear()} · inicio vida laboral</span>
      <span>${fin.getFullYear()} · jubilación</span>
    </div>`;
}

// Mini-calendario del mes de jubilación con el día señalado.
export function vizCalendario(fecha) {
  const ano = fecha.getFullYear();
  const mes = fecha.getMonth();
  const primerDia = (new Date(ano, mes, 1).getDay() + 6) % 7; // lunes = 0
  const diasMes = new Date(ano, mes + 1, 0).getDate();
  let celdas = DIAS_SEMANA.map((d) => `<span class="cal-cab">${d}</span>`).join('');
  for (let i = 0; i < primerDia; i++) celdas += '<span></span>';
  for (let d = 1; d <= diasMes; d++) {
    celdas += `<span class="cal-dia ${d === fecha.getDate() ? 'cal-marcado' : ''}">${d}</span>`;
  }
  return `
    <p class="viz-titulo">${MESES_LARGOS[mes][0].toUpperCase() + MESES_LARGOS[mes].slice(1)} ${ano}</p>
    <div class="calendario">${celdas}</div>`;
}

// Línea temporal (Gantt) de las situaciones del informe.
export function vizTimeline(situaciones, hoy) {
  const filas = situaciones
    .filter((s) => s.fechaAlta)
    .sort((a, b) => a.fechaAlta - b.fechaAlta);
  if (!filas.length) return '';

  const regimenes = [...new Set(filas.map((s) => s.regimen))];
  const colorDe = (r) => {
    const i = regimenes.indexOf(r);
    return i < SLOTS_CHART.length ? SLOTS_CHART[i] : 'var(--chart-otros)';
  };

  const t0 = Math.min(...filas.map((s) => s.fechaAlta.getTime()));
  const t1 = Math.max(hoy.getTime(), ...filas.map((s) => (s.fechaBaja || hoy).getTime()));
  const a0 = new Date(t0).getFullYear();
  const a1 = new Date(t1).getFullYear() + 1;

  const W = 800, ML = 8, MR = 8, MT = 6, ALTO_FILA = 22, ALTO_BARRA = 14, MB = 26;
  const H = MT + filas.length * ALTO_FILA + MB;
  const x = (t) => ML + ((t - t0) / (t1 - t0)) * (W - ML - MR);

  // Ticks de año: paso redondo para no pasar de ~8 etiquetas.
  const span = a1 - a0;
  const paso = span <= 8 ? 1 : span <= 16 ? 2 : span <= 40 ? 5 : 10;
  let ejes = '';
  for (let a = Math.ceil(a0 / paso) * paso; a <= a1; a += paso) {
    const xa = x(new Date(a, 0, 1).getTime());
    if (xa < ML || xa > W - MR) continue;
    ejes += `<line x1="${xa}" y1="${MT}" x2="${xa}" y2="${H - MB + 4}" class="tl-grid"/>` +
      `<text x="${xa}" y="${H - 8}" class="tl-tick" text-anchor="middle">${a}</text>`;
  }

  let barras = '';
  filas.forEach((s, i) => {
    const y = MT + i * ALTO_FILA + (ALTO_FILA - ALTO_BARRA) / 2;
    const xi = x(s.fechaAlta.getTime());
    const xf = x((s.fechaBaja || hoy).getTime());
    const w = Math.max(xf - xi, 3);
    const fmt = (f) => f.toLocaleDateString('es-ES');
    const tip = `${s.regimen} · ${s.empresa || '—'}\n${fmt(s.fechaAlta)} → ${s.fechaBaja ? fmt(s.fechaBaja) : 'en alta'}${s.dias != null ? `\n${s.dias.toLocaleString('es-ES')} días` : ''}`;
    barras += `<g class="tl-fila" data-tip="${esc(tip)}">
      <rect x="${ML}" y="${MT + i * ALTO_FILA}" width="${W - ML - MR}" height="${ALTO_FILA}" fill="transparent"/>
      <rect x="${xi}" y="${y}" width="${w}" height="${ALTO_BARRA}" rx="4" fill="${colorDe(s.regimen)}"/>
    </g>`;
  });

  // Marcador "hoy" si queda dentro del rango dibujado.
  const xHoy = x(hoy.getTime());
  const marcaHoy = `<line x1="${xHoy}" y1="${MT}" x2="${xHoy}" y2="${H - MB + 4}" class="tl-hoy"/>` +
    `<text x="${Math.min(xHoy, W - 30)}" y="${MT + 10}" class="tl-hoy-txt" text-anchor="${xHoy > W - 60 ? 'end' : 'start'}" dx="${xHoy > W - 60 ? -4 : 4}">hoy</text>`;

  const leyenda = regimenes.map((r) => `<span class="leyenda-item"><span class="leyenda-dot" style="background:${colorDe(r)}"></span>${esc(r)}</span>`).join('');

  return `
    <p class="viz-titulo">Tu vida laboral de un vistazo</p>
    <div class="leyenda">${leyenda}</div>
    <div class="tl-scroll">
      <svg viewBox="0 0 ${W} ${H}" class="timeline" role="img" aria-label="Línea temporal de las situaciones de alta">
        ${ejes}${barras}${marcaHoy}
      </svg>
    </div>`;
}

// Tooltip compartido para la línea temporal.
export function activarTooltips(contenedor) {
  let tip = document.getElementById('viz-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'viz-tooltip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  contenedor.querySelectorAll('.tl-fila').forEach((fila) => {
    fila.addEventListener('mouseenter', () => {
      tip.textContent = fila.dataset.tip;
      tip.hidden = false;
    });
    fila.addEventListener('mousemove', (e) => {
      const margen = 14;
      tip.style.left = Math.min(e.clientX + margen, window.innerWidth - tip.offsetWidth - 8) + 'px';
      tip.style.top = Math.min(e.clientY + margen, window.innerHeight - tip.offsetHeight - 8) + 'px';
    });
    fila.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}
