# 📅 Calc_jub

Calculadora de la **fecha exacta de jubilación** a partir del **informe de vida laboral** de la Seguridad Social española, con soporte para la **jubilación anticipada de la policía local** (RD 1449/2018).

**➡️ Úsala online: https://mr-d0nut.github.io/Calc_jub/**

## Qué hace

1. Subes el PDF del *Informe de Vida Laboral* (se descarga desde [Import@ss](https://portal.seg-social.gob.es/wps/portal/importass)).
2. La app extrae automáticamente la fecha de nacimiento, los días cotizados computables (descontando pluriempleo/pluriactividad) y la tabla de situaciones.
3. Calcula la fecha exacta en la que puedes jubilarte:
   - **Jubilación ordinaria** según el art. 205 y la disp. trans. 7.ª de la LGSS (tabla transitoria 2013→2027: 65 años con carrera larga o hasta 67 años).
   - **Policía local**: reducción de edad de 0,20 × años completos de servicio efectivo, con tope de 5 años (6 con carrera larga según la escala transitoria), exigiendo 15 años cotizados como policía local (RD 1449/2018).

## Privacidad

**El PDF nunca sale de tu navegador.** Todo el procesamiento (lectura del PDF con [pdf.js](https://mozilla.github.io/pdf.js/) y cálculos) se hace en local, sin servidor ni envío de datos.

## Normativa implementada

| Concepto | Norma |
|---|---|
| Edad ordinaria de jubilación (tabla 2013–2027) | Art. 205.1.a) y disp. trans. 7.ª LGSS (Ley 27/2011) |
| Coeficiente reductor policía local (0,20) | [RD 1449/2018](https://www.boe.es/buscar/doc.php?id=BOE-A-2018-17135), art. 2.1 |
| Tope de anticipación (5/6 años) y escala transitoria | RD 1449/2018, art. 2.2 y disp. trans. 1.ª |
| Mínimo de 15 años cotizados como policía local | RD 1449/2018, art. 2.3 |
| Cómputo del período reducido para el porcentaje | RD 1449/2018, art. 4 |

**Supuestos de cálculo:** los umbrales expresados en años/meses se comparan con los días del informe usando un año medio de 365,25 días. Si marcas «sigo cotizando», se proyectan los días desde la fecha del informe hasta la fecha candidata de jubilación.

## Desarrollo

Sin dependencias de ejecución externas (pdf.js va incluido en `vendor/`). Para probar en local:

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

Tests (motor de cálculo y parser):

```bash
node --test
```

## Aviso legal

Esta herramienta ofrece una **estimación orientativa** sin validez oficial. La fecha y condiciones definitivas de jubilación las determina el INSS al resolver cada solicitud. Consulta siempre con la Seguridad Social o un profesional.
