// Documentación del Gerente — archivos privados en Supabase Storage.
// Solo el usuario marcado como gerente (usuarios.es_gerente) y con su contraseña puede
// listar, subir, descargar o borrar. La llave secreta de Supabase vive SOLO aquí, en el
// servidor de Vercel; nunca va al navegador, a la APK ni al firmware.
//
// Variables en Vercel (Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY = llave secreta (service_role / sb_secret_...) de Supabase
//   SUPABASE_URL               = (opcional) si no está, se usa VITE_SUPABASE_URL
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'documentos_gerente';
const MAX_BYTES = 50 * 1024 * 1024; // límite por archivo del plan gratuito de Supabase
const CATEGORIAS = ['Proyecto completo', 'App (web)', 'Firmware (INO)', 'Placa PCB', 'Carcasa 3D', 'Otros'];
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function cliente() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const limpiarNombre = (n) => String(n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').slice(-120) || 'archivo';
const carpeta = (c) => limpiarNombre(c).toLowerCase();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const sb = cliente();
  if (!sb) return res.status(500).json({ error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { accion, usuario_id, pin } = body || {};

  // --- verificar que sea el gerente, con su contraseña ---
  if (!usuario_id || !pin) return res.status(401).json({ error: 'Falta la contraseña.' });
  const { data: u, error: eU } = await sb.from('usuarios').select('id, name, pin, es_gerente').eq('id', usuario_id).maybeSingle();
  if (eU) return res.status(500).json({ error: /es_gerente/.test(eU.message) ? 'Falta correr el SQL SQL_documentacion_gerente.sql.' : eU.message });
  if (!u || !u.es_gerente || String(u.pin) !== String(pin)) { await espera(800); return res.status(403).json({ error: 'Contraseña incorrecta o usuario sin permiso.' }); }

  try {
    if (accion === 'listar') {
      const { data, error } = await sb.from('documentos_gerente').select('*').order('subido_en', { ascending: false });
      if (error) throw error;
      return res.json({ ok: true, documentos: data || [], categorias: CATEGORIAS, maxBytes: MAX_BYTES });
    }

    if (accion === 'preparar') {
      const { nombre, tamano, categoria } = body;
      if (!nombre) return res.status(400).json({ error: 'Falta el nombre del archivo.' });
      if (Number(tamano) > MAX_BYTES) return res.status(400).json({ error: `El archivo pasa de ${MAX_BYTES / 1048576} MB.` });
      const cat = CATEGORIAS.includes(categoria) ? categoria : 'Otros';
      const d = new Date(), z = (n) => String(n).padStart(2, '0');
      const sello = `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
      const ruta = `${carpeta(cat)}/${sello}_${limpiarNombre(nombre)}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(ruta);
      if (error) throw error;
      return res.json({ ok: true, ruta, token: data.token });
    }

    if (accion === 'registrar') {
      const { ruta, nombre, tamano, categoria, version, descripcion } = body;
      if (!ruta || !String(ruta).includes('/')) return res.status(400).json({ error: 'Ruta inválida.' });
      const [dir, archivo] = [ruta.slice(0, ruta.lastIndexOf('/')), ruta.slice(ruta.lastIndexOf('/') + 1)];
      const { data: hay, error: eL } = await sb.storage.from(BUCKET).list(dir, { search: archivo, limit: 5 });
      if (eL) throw eL;
      if (!(hay || []).some((f) => f.name === archivo)) return res.status(400).json({ error: 'El archivo no terminó de subir.' });
      const fila = {
        ruta, nombre: String(nombre || archivo).slice(0, 200), tamano: Number(tamano) || null,
        categoria: CATEGORIAS.includes(categoria) ? categoria : 'Otros',
        version: (version || '').trim().slice(0, 40) || null, descripcion: (descripcion || '').trim().slice(0, 1000) || null, subido_por: u.name,
      };
      const { data, error } = await sb.from('documentos_gerente').upsert(fila, { onConflict: 'ruta' }).select().single();
      if (error) throw error;
      return res.json({ ok: true, documento: data });
    }

    if (accion === 'descargar') {
      const { data: doc } = await sb.from('documentos_gerente').select('ruta, nombre').eq('id', body.id).maybeSingle();
      if (!doc) return res.status(404).json({ error: 'No existe.' });
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(doc.ruta, 300, { download: doc.nombre });
      if (error) throw error;
      return res.json({ ok: true, url: data.signedUrl });
    }

    if (accion === 'editar') {
      const cambios = {};
      if (body.version !== undefined) cambios.version = String(body.version || '').trim().slice(0, 40) || null;
      if (body.descripcion !== undefined) cambios.descripcion = String(body.descripcion || '').trim().slice(0, 1000) || null;
      if (body.categoria !== undefined && CATEGORIAS.includes(body.categoria)) cambios.categoria = body.categoria;
      const { data, error } = await sb.from('documentos_gerente').update(cambios).eq('id', body.id).select().single();
      if (error) throw error;
      return res.json({ ok: true, documento: data });
    }

    if (accion === 'borrar') {
      const { data: doc } = await sb.from('documentos_gerente').select('ruta').eq('id', body.id).maybeSingle();
      if (!doc) return res.status(404).json({ error: 'No existe.' });
      const { error: eS } = await sb.storage.from(BUCKET).remove([doc.ruta]);
      if (eS) throw eS;
      const { error } = await sb.from('documentos_gerente').delete().eq('id', body.id);
      if (error) throw error;
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción desconocida.' });
  } catch (e) {
    const m = e?.message || String(e);
    return res.status(500).json({ error: /bucket|documentos_gerente/i.test(m) ? `${m} — corra el SQL SQL_documentacion_gerente.sql.` : m });
  }
}
