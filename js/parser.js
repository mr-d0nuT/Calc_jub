// Parser del "Informe de Vida Laboral" de la TGSS a partir del texto
// extraído con pdf.js.

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// Reconstruye líneas de texto a partir de los items de pdf.js (que llegan
// desordenados), agrupando por coordenada Y y ordenando por X.
export function reconstruirLineas(items) {
  const puntos = items
    .filter((it) => it.str && it.str.trim())
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
    .sort((a, b) => b.y - a.y);
  const filas = [];
  for (const p of puntos) {
    const fila = filas.length ? filas[filas.length - 1] : null;
    if (fila && Math.abs(fila.y - p.y) <= 2) fila.items.push(p);
    else filas.push({ y: p.y, items: [p] });
  }
  return filas.map((f) =>
    f.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()
  );
}

function parseFechaLarga(texto, patron) {
  const m = texto.match(patron);
  if (!m) return null;
  const mes = MESES[m[2].toLowerCase()];
  if (mes === undefined) return null;
  return new Date(Number(m[3]), mes, Number(m[1]));
}

function parseFechaPunto(s) {
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseNumero(s) {
  return Number(s.replace(/\./g, ''));
}

const REGIMENES = /^(GENERAL|AUTONOMOS?|AUTÓNOMOS?|AUTONOMO|AGRARIO|MAR|CARBON|CARBÓN|HOGAR|REPRESENTANTES(?: DE COMERCIO)?|ARTISTAS)\b/;

/**
 * @param {string[]} lineas Líneas de todas las páginas, en orden.
 * @returns Datos del informe o lanza Error si no parece una vida laboral.
 */
export function parseVidaLaboral(lineas) {
  const texto = lineas.join('\n');

  if (!/INFORME DE VIDA LABORAL/i.test(texto)) {
    throw new Error('El PDF no parece un Informe de Vida Laboral de la Seguridad Social.');
  }

  const nombreM = texto.match(/resulta que D\/Dª\s*\n?\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]+?)\s*,\s*nacido/);
  const nacimiento = parseFechaLarga(texto, /nacido\/?a? el (\d{1,2}) de ([a-záéíóúñ]+) de (\d{4})/i);
  const fechaInforme = parseFechaLarga(texto, /al día (\d{1,2}) de ([a-záéíóúñ]+) de (\d{4})/i);

  // Bloques "N Años X días M meses D días": el primero es el total en alta y
  // el último, si hay pluriempleo, el total efectivamente computable.
  const bloques = [...texto.matchAll(/(\d{1,3}) Años\s*\n?\s*([\d.]+) días (\d{1,2}) meses\s*\n?\s*(\d{1,3}) días/g)]
    .map((m) => ({
      dias: parseNumero(m[2]),
      desglose: { anos: Number(m[1]), meses: Number(m[3]), dias: Number(m[4]) },
    }));

  const pluriM = texto.match(/pluriactividad-?, durante un total de ([\d.]+) días/);

  const situaciones = [];
  for (const linea of lineas) {
    if (!REGIMENES.test(linea)) continue;
    const fechas = [...linea.matchAll(/\d{2}\.\d{2}\.\d{4}/g)].map((m) => m[0]);
    if (fechas.length < 2) continue;
    const idxPrimera = linea.indexOf(fechas[0]);
    const cabecera = linea.slice(0, idxPrimera).trim();
    const regimen = cabecera.match(REGIMENES)[0];
    const empresa = cabecera.slice(regimen.length).replace(/^[\s-]*[\d-]*\s*/, '').trim();
    const resto = linea.slice(idxPrimera).split(/\s+/);
    const ultimo = resto[resto.length - 1];
    situaciones.push({
      regimen,
      empresa,
      fechaAlta: parseFechaPunto(fechas[0]),
      fechaEfecto: parseFechaPunto(fechas[1]) || parseFechaPunto(fechas[0]),
      fechaBaja: fechas[2] ? parseFechaPunto(fechas[2]) : null,
      dias: /^[\d.]+$/.test(ultimo) ? parseNumero(ultimo) : null,
    });
  }

  return {
    nombre: nombreM ? nombreM[1].trim() : null,
    nacimiento,
    fechaInforme,
    totalAlta: bloques[0] || null,
    totalComputable: bloques.length > 1 ? bloques[bloques.length - 1] : bloques[0] || null,
    diasPluriempleo: pluriM ? parseNumero(pluriM[1]) : 0,
    situaciones,
  };
}
