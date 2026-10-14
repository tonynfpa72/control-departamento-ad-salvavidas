// Tipo de cambio del dólar — Banco Central de Costa Rica (BCCR)
// Tipo de cambio de REFERENCIA del BCCR: indicador 318 = venta, 317 = compra.
//
// 1) Fuente principal: servicio web oficial del BCCR (Indicadores Económicos).
//    Necesita en Vercel (Settings → Environment Variables):
//       BCCR_CORREO = correo con el que se registró en el BCCR
//       BCCR_TOKEN  = token que el BCCR envía a ese correo
//    (Registro gratuito: https://www.bccr.fi.cr/indicadores-economicos/servicio-web)
// 2) Respaldo: API del Ministerio de Hacienda, que publica el mismo tipo de
//    cambio de referencia del BCCR (se usa si faltan las variables o el BCCR no responde).
// El token queda solo en el servidor; nunca va al navegador ni a la APK.

const fechaCR = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return { dmy: g('day') + '/' + g('month') + '/' + g('year'), iso: g('year') + '-' + g('month') + '-' + g('day') };
};

async function indicadorBCCR(cod, desde, hasta, correo, token) {
  const url = 'https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML'
    + '?Indicador=' + cod + '&FechaInicio=' + encodeURIComponent(desde) + '&FechaFinal=' + encodeURIComponent(hasta)
    + '&Nombre=' + encodeURIComponent('AppAD') + '&SubNiveles=N&CorreoElectronico=' + encodeURIComponent(correo) + '&Token=' + encodeURIComponent(token);
  const r = await fetch(url);
  if (!r.ok) throw new Error('BCCR respondió ' + r.status);
  // La respuesta viene como XML dentro de XML (escapado): se desescapa y se leen los valores
  const txt = (await r.text()).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const filas = [...txt.matchAll(/<DES_FECHA>([^<]+)<\/DES_FECHA>\s*<NUM_VALOR>([^<]+)<\/NUM_VALOR>/g)]
    .map((m) => ({ fecha: m[1].slice(0, 10), valor: Number(m[2]) })).filter((x) => x.valor > 0);
  if (!filas.length) throw new Error('BCCR sin datos para el indicador ' + cod);
  return filas[filas.length - 1]; // el más reciente
}

export default async function handler(req, res) {
  const hoy = fechaCR();
  const correo = process.env.BCCR_CORREO, token = process.env.BCCR_TOKEN;
  const errores = [];
  if (correo && token) {
    try {
      // Se piden los últimos 7 días por si hoy aún no se publica (fines de semana / feriados)
      const d = new Date(Date.now() - 7 * 864e5);
      const desde = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
      const [v, c] = await Promise.all([indicadorBCCR(318, desde, hoy.dmy, correo, token), indicadorBCCR(317, desde, hoy.dmy, correo, token).catch(() => null)]);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ venta: v.valor, compra: c ? c.valor : null, fecha: v.fecha, fuente: 'Banco Central de Costa Rica (referencia, venta)' });
    } catch (e) { errores.push(String((e && e.message) || e)); }
  } else errores.push('Faltan BCCR_CORREO / BCCR_TOKEN en Vercel');
  try {
    const r = await fetch('https://api.hacienda.go.cr/indicadores/tc/dolar', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Hacienda respondió ' + r.status);
    const j = await r.json();
    const venta = Number(j && j.venta && j.venta.valor), compra = Number(j && j.compra && j.compra.valor);
    if (!(venta > 0)) throw new Error('Respuesta sin tipo de cambio');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ venta, compra, fecha: (j.venta && j.venta.fecha) || hoy.iso, fuente: 'BCCR (referencia, venta) vía Hacienda', avisos: errores });
  } catch (e) { errores.push(String((e && e.message) || e)); }
  res.status(502).json({ error: errores.join(' · ') });
}
