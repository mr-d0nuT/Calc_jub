// Motor de cálculo de la fecha de jubilación (Seguridad Social española).
//
// Normativa implementada:
//  - Edad ordinaria: art. 205.1.a) y disp. trans. 7.ª LGSS (redacción Ley 27/2011).
//  - Policía local: Real Decreto 1449/2018 (coeficiente reductor 0,20).

export const DIA_MS = 86400000;

// Umbrales expresados en (años, meses) de cotización. Para comparar con los
// días del informe de vida laboral se convierten con año medio de 365,25 días.
export function umbralDias(anos, meses = 0) {
  return Math.round((anos + meses / 12) * 365.25);
}

// Disp. trans. 7.ª LGSS: por año natural, cotización mínima (años, meses) para
// jubilarse a los 65 y edad exigida (años, meses) si no se alcanza.
const TABLA_EDAD_ORDINARIA = {
  2013: { carrera: [35, 3], edad: [65, 1] },
  2014: { carrera: [35, 6], edad: [65, 2] },
  2015: { carrera: [35, 9], edad: [65, 3] },
  2016: { carrera: [36, 0], edad: [65, 4] },
  2017: { carrera: [36, 3], edad: [65, 5] },
  2018: { carrera: [36, 6], edad: [65, 6] },
  2019: { carrera: [36, 9], edad: [65, 8] },
  2020: { carrera: [37, 0], edad: [65, 10] },
  2021: { carrera: [37, 3], edad: [66, 0] },
  2022: { carrera: [37, 6], edad: [66, 2] },
  2023: { carrera: [37, 9], edad: [66, 4] },
  2024: { carrera: [38, 0], edad: [66, 6] },
  2025: { carrera: [38, 3], edad: [66, 8] },
  2026: { carrera: [38, 3], edad: [66, 10] },
};

export function entradaTabla(ano) {
  if (ano <= 2013) return TABLA_EDAD_ORDINARIA[2013];
  if (ano >= 2027) return { carrera: [38, 6], edad: [67, 0] };
  return TABLA_EDAD_ORDINARIA[ano];
}

// Disp. trans. 1.ª RD 1449/2018: años de actividad efectiva y cotización
// exigidos para ampliar la anticipación de 5 a 6 años.
export function escalaPolicia6(ano) {
  if (ano <= 2019) return 35.5;
  if (ano <= 2022) return 36;
  if (ano <= 2026) return 36.5;
  return 37;
}

export function addAnosMeses(fecha, anos, meses = 0) {
  const totalMeses = fecha.getMonth() + meses;
  const d = new Date(fecha.getFullYear() + anos, totalMeses, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(fecha.getDate(), ultimoDia));
  return d;
}

export function diasEntre(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DIA_MS);
}

export function addDias(fecha, dias) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

// Edad en años cumplidos + meses en una fecha dada.
export function edadEn(nacimiento, fecha) {
  let anos = fecha.getFullYear() - nacimiento.getFullYear();
  let meses = fecha.getMonth() - nacimiento.getMonth();
  if (fecha.getDate() < nacimiento.getDate()) meses -= 1;
  if (meses < 0) { anos -= 1; meses += 12; }
  return { anos, meses };
}

function edadMayorOIgual(edad, [anos, meses]) {
  return edad.anos > anos || (edad.anos === anos && edad.meses >= meses);
}

// Resta N días laborables (lunes a viernes; no se descuentan festivos) a una
// fecha. Devuelve el primer día del tramo cubierto: desde ese día ya no habría
// que ir a trabajar si la bolsa cubre todos los laborables hasta `fecha`.
export function restarDiasLaborables(fecha, dias) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  let restantes = dias;
  while (restantes > 0) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) restantes -= 1;
  }
  return d;
}

/**
 * Calcula la fecha de jubilación.
 *
 * @param {Object} p
 * @param {Date}   p.nacimiento        Fecha de nacimiento.
 * @param {number} p.diasCotizados     Días computables según el informe.
 * @param {Date}   p.fechaInforme      Fecha de emisión del informe.
 * @param {boolean} p.sigueCotizando   Si sigue de alta hasta la jubilación.
 * @param {Object} [p.policia]         { inicio: Date, fin: Date|null } período
 *                                     de servicio (continuado) como policía local.
 */
export function calcularJubilacion(p) {
  const { nacimiento, diasCotizados, fechaInforme, sigueCotizando } = p;

  const cotizadosEn = (fecha) => {
    const extra = sigueCotizando ? Math.max(0, diasEntre(fechaInforme, fecha)) : 0;
    return diasCotizados + extra;
  };

  // Primera fecha (búsqueda diaria) en que la edad alcanza la edad ordinaria
  // exigida ese día según la cotización acreditada en ese momento. Una
  // reducción de edad (policía local) actúa como edad "virtual" mayor;
  // `reduccionEn(fecha, cotizados)` devuelve los meses de reducción vigentes
  // ese día, ya topados.
  const buscarFecha = (reduccionEn = null) => {
    let fecha = addAnosMeses(nacimiento, 59, 0); // antes de 59 nunca procede
    const limite = addAnosMeses(nacimiento, 68, 0);
    while (fecha <= limite) {
      const entrada = entradaTabla(fecha.getFullYear());
      const cot = cotizadosEn(fecha);
      const exigida = cot >= umbralDias(...entrada.carrera) ? [65, 0] : entrada.edad;
      const edad = edadEn(nacimiento, fecha);
      const detalle = reduccionEn ? reduccionEn(fecha, cot) : { meses: 0 };
      const red = detalle.meses;
      const virtual = { anos: edad.anos + Math.floor((edad.meses + red) / 12), meses: (edad.meses + red) % 12 };
      if (edadMayorOIgual(virtual, exigida)) {
        return { fecha, edad, exigida, cotizados: cot, reduccionAplicada: red, detalle, carreraLarga: cot >= umbralDias(...entrada.carrera) };
      }
      fecha = addDias(fecha, 1);
    }
    return null;
  };

  const resultado = { avisos: [] };

  const carenciaOk = cotizadosEn(addAnosMeses(nacimiento, 67, 0)) >= umbralDias(15);
  if (!carenciaOk) {
    resultado.avisos.push('No se alcanza el período mínimo de cotización de 15 años exigido para la pensión contributiva de jubilación.');
  }

  resultado.ordinaria = buscarFecha(0);

  if (p.policia) {
    const { inicio, fin } = p.policia;
    const pol = { elegible: true, motivos: [] };

    // Años completos de servicio como policía local acreditados en una fecha
    // dada. Se asume servicio continuado y cotizado desde `inicio` hasta `fin`
    // (o hasta la propia fecha si sigue en activo; si no sigue cotizando, se
    // congela en la fecha del informe).
    const anosPoliciaEn = (fecha) => {
      const topes = [fecha.getTime()];
      if (fin) topes.push(fin.getTime());
      if (!fin && !sigueCotizando) topes.push(fechaInforme.getTime());
      const hasta = new Date(Math.min(...topes));
      return hasta <= inicio ? 0 : edadEn(inicio, hasta).anos;
    };

    const maxAnos = anosPoliciaEn(addAnosMeses(nacimiento, 68, 0));
    if (maxAnos < 15) {
      pol.elegible = false;
      pol.motivos.push(`El RD 1449/2018 exige un mínimo de 15 años cotizados como policía local para aplicar el coeficiente reductor (con las fechas indicadas se acreditan como máximo ${maxAnos}).`);
    }

    if (pol.elegible) {
      // Art. 2.1 RD 1449/2018: reducción = 0,20 × años completos efectivamente
      // trabajados como policía local, evaluados en la propia fecha candidata
      // de jubilación (en meses completos, redondeo a la baja). Tope del
      // art. 2.2: 5 años, o 6 si se acredita la escala transitoria.
      const reduccionEn = (fecha, cot) => {
        const anos = anosPoliciaEn(fecha);
        if (anos < 15) return { meses: 0, anosServicio: anos, mesesTeoricos: 0 };
        const mesesTeoricos = Math.floor(0.20 * anos * 12);
        const capAnos = cot >= umbralDias(escalaPolicia6(fecha.getFullYear()), 0) ? 6 : 5;
        return { meses: Math.min(mesesTeoricos, capAnos * 12), anosServicio: anos, mesesTeoricos, capAnos };
      };
      pol.resultado = buscarFecha(reduccionEn);
      if (pol.resultado) {
        const det = pol.resultado.detalle;
        pol.anosServicio = det.anosServicio;
        pol.reduccionTeoricaMeses = det.mesesTeoricos;
        pol.reduccionAplicadaMeses = pol.resultado.reduccionAplicada;
        if (det.mesesTeoricos > pol.resultado.reduccionAplicada) {
          pol.motivos.push(`La reducción teórica de ${Math.floor(det.mesesTeoricos / 12)} años y ${det.mesesTeoricos % 12} meses (0,20 × ${det.anosServicio} años de servicio) supera el tope legal: se aplica el máximo de ${det.capAnos} años (art. 2.2 RD 1449/2018).`);
        }
        // Art. 4: el período reducido cuenta como cotizado para el porcentaje.
        pol.diasBonificados = pol.resultado.reduccionAplicada > 0
          ? diasEntre(pol.resultado.fecha, resultado.ordinaria.fecha)
          : 0;
      }
    }
    resultado.policia = pol;
  }

  return resultado;
}
