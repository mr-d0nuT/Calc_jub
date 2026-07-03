# Diseño: Calc_jub — calculadora de fecha de jubilación

**Fecha:** 2026-07-03

## Objetivo

App web que recibe el PDF del *Informe de Vida Laboral* de la TGSS y calcula la **fecha exacta de jubilación**, con opción de **policía local** (jubilación anticipada, RD 1449/2018).

## Decisiones

- **Web estática (HTML/CSS/JS) publicada en GitHub Pages.** El PDF se procesa íntegramente en el navegador con pdf.js (vendorizado en `vendor/`): privacidad total y cero infraestructura.
- **Sin frameworks ni build.** Módulos ES nativos.
- Los datos extraídos del PDF **se pueden corregir a mano**; la app también funciona sin PDF (entrada manual).

## Componentes

| Módulo | Responsabilidad |
|---|---|
| `js/parser.js` | Reconstruir líneas del texto de pdf.js (agrupación por Y) y extraer: nombre, nacimiento, fecha del informe, días totales/computables, pluriempleo, tabla de situaciones. Puro, testeable en Node. |
| `js/calc.js` | Motor normativo: tabla transitoria de edad ordinaria (2013–2027), búsqueda diaria de la primera fecha que cumple la edad exigida, reducción policía local (0,20 × años, topes 5/6, mínimo 15 años). Puro, testeable en Node. |
| `js/app.js` | UI: subida/drag-drop del PDF, formulario editable, render de resultados. |

## Reglas implementadas

1. **Edad ordinaria** (art. 205 + DT 7.ª LGSS): 65 años si se acredita la carrera larga del año (2026: 38 a 3 m; 2027+: 38 a 6 m); si no, la edad general del año (2026: 66 a 10 m; 2027+: 67).
2. **Policía local** (RD 1449/2018): reducción = 0,20 × años completos de servicio efectivo; tope 5 años (6 si se acredita la escala transitoria: 36,5 años en 2023–2026, 37 desde 2027); requisito de 15 años cotizados como policía local; el período reducido computa como cotizado solo para el porcentaje (art. 4).
3. **Proyección**: si el usuario sigue de alta, los días entre la fecha del informe y la fecha candidata se suman a la cotización.
4. **Conversión**: umbrales años/meses → días con año medio de 365,25 días.
5. La fecha se obtiene por **búsqueda diaria** (primera fecha en que la edad —real o reducida— alcanza la exigida ese día con la cotización de ese momento), lo que resuelve la circularidad edad↔año↔cotización.

## Errores

- PDF que no es una vida laboral → mensaje claro (se valida el título del informe).
- Campos no extraíbles → aviso y entrada manual.
- Carencia < 15 años → aviso normativo.

## Tests

`node --test`: 18 tests sobre `calc.js` (tabla, topes, casos policía, carencia, fin de mes) y `parser.js` (fixture anonimizado con la estructura real del informe).
