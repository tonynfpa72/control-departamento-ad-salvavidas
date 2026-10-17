// Voz de la "clase guiada" de Entrenamiento (Microsoft Azure, voces neurales).
// GET /api/voz?v=es-CR-JuanNeural&t=texto  →  audio MP3
//
// Configurar en Vercel (Settings → Environment Variables):
//   AZURE_SPEECH_KEY    = clave del recurso "Speech" de Azure
//   AZURE_SPEECH_REGION = región del recurso (por ejemplo eastus)
// La clave queda solo en el servidor: nunca llega al navegador ni a la APK.
//
// Cada frase se genera una sola vez: la respuesta queda guardada en el CDN de
// Vercel y en el celular (Cache-Control de un año), así casi no se gasta del
// plan gratuito de Azure.

const VOCES = new Set(['es-CR-MariaNeural', 'es-CR-JuanNeural', 'es-MX-DaliaNeural', 'es-US-PalomaNeural']);
const MAX = 1500;

const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const voz = VOCES.has(String(q.v || '')) ? String(q.v) : 'es-CR-JuanNeural';
    const texto = String(q.t || '').trim();
    if (!texto) return res.status(400).json({ error: 'Falta el texto' });
    if (texto.length > MAX) return res.status(413).json({ error: 'Texto muy largo' });
    const llave = process.env.AZURE_SPEECH_KEY, region = process.env.AZURE_SPEECH_REGION;
    if (!llave || !region) return res.status(503).json({ error: 'Falta configurar AZURE_SPEECH_KEY y AZURE_SPEECH_REGION en Vercel' });

    // Ritmo normal de conversación, con pausas naturales entre frases
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voz.slice(0, 5)}">` +
      `<voice name="${voz}"><prosody rate="-3%">${escXml(texto)}</prosody></voice></speak>`;
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': llave,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'salvavidas-entrenamiento',
      },
      body: ssml,
    });
    if (!r.ok) return res.status(502).json({ error: 'Azure respondió ' + r.status + ': ' + (await r.text()).slice(0, 200) });
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(audio);
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
