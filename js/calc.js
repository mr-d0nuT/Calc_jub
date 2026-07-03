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

/**
 * Calcula la fecha de jubilación.
 *
 * @param {Object} p
 * @param {Date}   p.nacimiento        Fecha de nacimiento.
 * @param {number} p.diasCotizados     Días computables según el informe.
 * @param {Date}   p.fechaInforme      Fecha de emisión del informe.
 * @param {boolean} p.sigueCotizando   Si sigue de alta hasta la jubilación.
 * @param {Object} [p.policia]         { anosTrabajados, anosCotizados }
 */
export function calcularJubilacion(p) {
  const { nacimiento, diasCotizados, fechaInforme, sigueCotizando } = p;

  const cotizadosEn = (fecha) => {
    const extra = sigueCotizando ? Math.max(0, diasEntre(fechaInforme, fecha)) : 0;
    return diasCotizados + extra;
  };

  // Primera fecha (búsqueda diaria) en que la edad alcanza la edad ordinaria
  // exigida ese día según la cotización acreditada en ese momento. Una
  // reducción de edad (policía local) actúa como edad "virtual" mayor.
  const buscarFecha = (reduccionMeses = 0, cap6 = null) => {
    let fecha = addAnosMeses(nacimiento, 59, 0); // antes de 60 nunca procede
    const limite = addAnosMeses(nacimiento, 68, 0);
    while (fecha <= limite) {
      const entrada = entradaTabla(fecha.getFullYear());
      const cot = cotizadosEn(fecha);
      const exigida = cot >= umbralDias(...entrada.carrera) ? [65, 0] : entrada.edad;
      const edad = edadEn(nacimiento, fecha);
      let red = reduccionMeses;
      if (red > 0) {
        // Tope de anticipación: 5 años, o 6 si se acredita la escala transitoria.
        const capAnos = cap6 && cot >= umbralDias(escalaPolicia6(fecha.getFullYear()), 0) ? 6 : 5;
        red = Math.min(red, capAnos * 12);
      }
      const virtual = { anos: edad.anos + Math.floor((edad.meses + red) / 12), meses: (edad.meses + red) % 12 };
      if (edadMayorOIgual(virtual, exigida)) {
        return { fecha, edad, exigida, cotizados: cot, reduccionAplicada: red, carreraLarga: cot >= umbralDias(...entrada.carrera) };
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
    const { anosTrabajados, anosCotizados } = p.policia;
    const pol = { anosTrabajados, anosCotizados, elegible: true, motivos: [] };
    if (anosCotizados < 15) {
      pol.elegible = false;
      pol.motivos.push('El RD 1449/2018 exige un mínimo de 15 años cotizados como policía local para aplicar el coeficiente reductor.');
    }
    if (pol.elegible) {
      // Art. 2.1 RD 1449/2018: reducción = 0,20 × años completos efectivamente
      // trabajados como policía local (en meses completos, redondeo a la baja).
      const reduccionMeses = Math.floor(0.20 * Math.floor(anosTrabajados) * 12);
      pol.reduccionMeses = reduccionMeses;
      pol.resultado = buscarFecha(reduccionMeses, true);
      if (pol.resultado) {
        pol.reduccionAplicadaMeses = pol.resultado.reduccionAplicada;
        if (pol.resultado.reduccionAplicada < reduccionMeses) {
          const capAnos = pol.resultado.reduccionAplicada / 12;
          pol.motivos.push(`La reducción de ${Math.floor(reduccionMeses / 12)} años y ${reduccionMeses % 12} meses supera el tope legal: se aplica el máximo de ${capAnos} años (art. 2.2 RD 1449/2018).`);
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
