/*
 * Módulo Cotizador A&D
 * Uso:  <Cotizador supabase={supabase} isAdmin={esAdmin} />
 *  - supabase: el cliente que ya usa la app (createClient(...)).
 *  - isAdmin:  true si el usuario puede cambiar la configuración (salarios, overhead, catálogos).
 * Requiere: npm install xlsx   y la tabla "cotizador_config" (ver cotizador_supabase.sql).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import L from './cotizadorLogic';
import DEFAULT_CFG from './defaultConfig';
import './cotizador.css';

const n = L.n, norm = L.norm;
const QKEY = 'cotAD.quote.v1', CKEY = 'cotAD.cfgLocal.v1';
const TABLE = 'cotizador_config';

function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
const clone = (o) => JSON.parse(JSON.stringify(o));
const usd = (v) => 'USD ' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const crc = (v) => '₡' + (v || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v) => (Math.round(v * 10000) / 100).toLocaleString('es-CR') + ' %';
const s = (v, d = 4) => { const p = Math.pow(10, d); return String(Math.round(n(v) * p) / p); };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };

/* ---------- íconos ---------- */
const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const Icon = {
  gear: <svg width="22" height="22" viewBox="0 0 24 24" {...sv}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  down: <svg width="18" height="18" viewBox="0 0 24 24" {...sv}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>,
  up: <svg width="18" height="18" viewBox="0 0 24 24" {...sv}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>,
  x: <svg width="18" height="18" viewBox="0 0 24 24" {...sv}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" {...sv}><path d="M12 5v14M5 12h14" /></svg>,
  file: <svg width="18" height="18" viewBox="0 0 24 24" {...sv}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>,
};

/* ---------- cotización ---------- */
function blankQuote(cfg) {
  return {
    info: { proyecto: '', cliente: '', area: 'Proyectos', fecha: new Date().toISOString().slice(0, 10), contacto: '', presupuestista: '', numero: '' },
    roles: {}, cr: {}, ca: {}, renta: {}, mats: {}, eq: { tub: '0', disp: '0', extra: '3' },
    margin: s(n(cfg.margin) * 100, 2), matMargin: s(n(cfg.matMargin) * 100, 2), cmp: ['25', '27.5', '30', '32.5', '35'], example: false,
  };
}
function exampleQuote(cfg) {
  const q = blankQuote(cfg); q.example = true;
  q.info = { ...q.info, proyecto: 'Ejemplo · Sistema de detección bodega', cliente: 'Cliente de ejemplo', numero: 'COT-EJEMPLO' };
  const byName = (list, name, key = 'n') => list.find((x) => norm(x[key]) === norm(name));
  [['Jefatura Proyectos', '1', '8', '2'], ['Técnico Senior', '2', '48', '2'], ['Ayudante Senior', '2', '48', '2'], ['Supervisor', '1', '16', '2']]
    .forEach(([nm, p, h, w]) => { const r = byName(cfg.roles, nm, 'name'); if (r) q.roles[r.id] = { on: true, p, h, w }; });
  [['Alimentación', '5', '5', '2'], ['Carro', '1', '120', '2'], ['Celular', '1', '1', '2'], ['Combustible', '1', '1', '2']]
    .forEach(([nm, c, d, w]) => { const it = byName(cfg.cr, nm); if (it) q.cr[it.id] = { c, d, w }; });
  [0, 2, 4, 6].forEach((i) => { if (cfg.renta[i]) q.renta[cfg.renta[i].id] = { q: '1' }; });
  [['Tubo EMT 3/4" USA (3m)', '40'], ['Conector EMT presión 3/4" USA', '80'], ['Gaza EMT 3/4" USA', '120'], ['Unión EMT presión 3/4" USA', '80'], ['Caja octogonal', '30'], ['Caja cuadrada, con tapa', '10'], ['Caja rectangular', '15'], ['Cable sin Shield #16 /2 (Carrucha de 305m)', '2']]
    .forEach(([nm, qq]) => { const m = byName(cfg.mats, nm); if (m) q.mats[m.id] = { q: qq }; });
  q.eq = { tub: '120', disp: '45', extra: '3' };
  return q;
}
// Reasigna las líneas de la cotización cuando cambian los ids de la configuración (por nombre)
function remapQuote(oldCfg, newCfg, q) {
  const out = clone(q);
  const map = (key, nameKey) => {
    const res = {}; const oldList = oldCfg[key] || [];
    newCfg[key].forEach((it) => {
      if (q[key][it.id]) { res[it.id] = q[key][it.id]; return; }
      const old = oldList.find((o) => norm(o[nameKey]) === norm(it[nameKey]) && q[key][o.id]);
      if (old) res[it.id] = q[key][old.id];
    });
    out[key] = res;
  };
  map('roles', 'name'); map('cr', 'n'); map('ca', 'n'); map('renta', 'n'); map('mats', 'n');
  return out;
}

/* ---------- borrador de configuración (texto editable) ---------- */
function toDraft(c) {
  return {
    tc: s(c.tc, 2), cs: s(n(c.cs) * 100), fa: s(n(c.fa) * 100), au: s(n(c.au) * 100), margin: s(n(c.margin) * 100, 3), matMargin: s(n(c.matMargin) * 100, 3),
    tub: s(c.rend.tub), disp: s(c.rend.disp), hDia: s(c.rend.hDia), dSem: s(c.rend.dSem),
    roles: c.roles.map((r) => ({ id: r.id, name: r.name, sal: s(r.sal, 2) })),
    cr: c.cr.map((x) => ({ id: x.id, n: x.n, um: x.um, pu: s(x.pu), noW: !!x.noW })),
    ca: c.ca.map((x) => ({ id: x.id, n: x.n, um: x.um, pu: s(x.pu) })),
    renta: c.renta.map((x) => ({ id: x.id, n: x.n, um: x.um, pu: s(x.pu) })),
    mats: c.mats.map((x) => ({ id: x.id, n: x.n, um: x.um, list: s(x.list, 6) })),
  };
}
function fromDraft(d) {
  const errs = [];
  if (!(n(d.tc) > 0)) errs.push('El tipo de cambio debe ser mayor que 0.');
  if (n(d.margin) >= 95 || n(d.matMargin) >= 95) errs.push('Los márgenes deben ser menores a 95 %.');
  if (['tub', 'disp', 'hDia', 'dSem'].some((k) => !(n(d[k]) > 0))) errs.push('Los rendimientos deben ser mayores que 0.');
  const named = (list, key) => list.filter((x) => String(x[key] || '').trim() !== '');
  const c = {
    tc: n(d.tc), cs: n(d.cs) / 100, fa: n(d.fa) / 100, au: n(d.au) / 100, margin: n(d.margin) / 100, matMargin: n(d.matMargin) / 100,
    rend: { tub: n(d.tub), disp: n(d.disp), hDia: n(d.hDia), dSem: n(d.dSem) },
    roles: named(d.roles, 'name').map((r) => ({ id: r.id, name: r.name.trim(), sal: n(r.sal) })),
    cr: named(d.cr, 'n').map((x) => { const o = { id: x.id, n: x.n.trim(), um: x.um || '', pu: n(x.pu) }; if (x.noW) o.noW = true; return o; }),
    ca: named(d.ca, 'n').map((x) => ({ id: x.id, n: x.n.trim(), um: x.um || '', pu: n(x.pu) })),
    renta: named(d.renta, 'n').map((x) => ({ id: x.id, n: x.n.trim(), um: x.um || '', pu: n(x.pu) })),
    mats: named(d.mats, 'n').map((x) => ({ id: x.id, n: x.n.trim(), um: x.um || '', list: n(x.list) })),
  };
  if (!c.roles.length) errs.push('Debe existir al menos un puesto con salario.');
  return { cfg: c, errs };
}

function NumIn({ value, onChange, label, cls, step, min, disabled, id }) {
  return (
    <input className={'num' + (cls ? ' ' + cls : '')} type="number" inputMode="decimal" min={min == null ? 0 : min} step={step || 'any'}
      value={value == null ? '' : value} disabled={disabled} aria-label={label} id={id} onChange={(e) => onChange(e.target.value)} />
  );
}

/* ====================================================================== */
export default function Cotizador({ supabase, isAdmin = false }) {
  const initCfg = lsGet(CKEY) || { cfg: DEFAULT_CFG, updatedAt: null, source: 'Machote original (incluido en la app)' };
  const [cfgDoc, setCfgDoc] = useState(initCfg);
  const cfg = cfgDoc.cfg;
  const [q, setQRaw] = useState(() => lsGet(QKEY) || exampleQuote(initCfg.cfg));
  const [step, setStep] = useState(1);
  const [viaTab, setViaTab] = useState('cr');
  const [search, setSearch] = useState('');
  const [showCfg, setShowCfg] = useState(false);
  const [online, setOnline] = useState(null); // null = conectando
  const [toast, setToast] = useState('');
  const [confirmNew, setConfirmNew] = useState(false);
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const toastT = useRef(null);

  const setQ = (fn) => setQRaw((prev) => { const next = fn(clone(prev)); lsSet(QKEY, next); return next; });
  const flash = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 4200); };

  const receiveCfg = (row) => {
    if (!row || !row.data || !row.data.cfg) return;
    const oldCfg = cfgRef.current;
    const doc = { cfg: row.data.cfg, updatedAt: row.updated_at || row.data.updatedAt || null, source: row.data.source || '' };
    setCfgDoc(doc); lsSet(CKEY, doc);
    setQRaw((prev) => { const next = remapQuote(oldCfg, doc.cfg, prev); lsSet(QKEY, next); return next; });
  };

  // Configuración compartida en Supabase (+ actualización en vivo)
  useEffect(() => {
    if (!supabase) { setOnline(false); return undefined; }
    let alive = true;
    supabase.from(TABLE).select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setOnline(false); return; }
      setOnline(true);
      if (data) receiveCfg(data);
    });
    const ch = supabase.channel('cotizador_config_cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (p) => { if (p.new) receiveCfg(p.new); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const c = useMemo(() => L.compute(cfg, q), [cfg, q]);
  const line = (key, id) => q[key][id] || {};
  const setLine = (key, id, field, v) => setQ((x) => { x[key][id] = { ...(x[key][id] || {}), [field]: v }; return x; });

  function downloadExcel() {
    try {
      const wb = L.buildWorkbook(XLSX, cfg, q, q.info);
      const slug = (q.info.numero || q.info.proyecto || 'cotizacion').replace(/[^A-Za-z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'cotizacion';
      const name = 'Machote_' + slug + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
      XLSX.writeFile(wb, name);
      flash('Excel descargado: ' + name);
    } catch (err) { flash('No se pudo generar el Excel: ' + (err.message || err)); }
  }

  async function applyConfig(newCfg, source, alsoQty) {
    const oldCfg = cfg;
    const doc = { cfg: newCfg, updatedAt: new Date().toISOString(), source: source || 'Edición manual' };
    let nextQ = remapQuote(oldCfg, newCfg, q);
    if (alsoQty) {
      nextQ = { ...nextQ, roles: alsoQty.roles, cr: alsoQty.cr, ca: alsoQty.ca, renta: alsoQty.renta, mats: alsoQty.mats, eq: alsoQty.eq,
        margin: s(n(newCfg.margin) * 100, 3), matMargin: s(n(newCfg.matMargin) * 100, 3), example: false };
    }
    setQRaw(nextQ); lsSet(QKEY, nextQ);
    setCfgDoc(doc); lsSet(CKEY, doc);
    if (!supabase) return 'local';
    const { error } = await supabase.from(TABLE).upsert({ id: 1, data: doc, updated_at: doc.updatedAt });
    return error ? (error.message || 'error') : 'ok';
  }

  const names = ['Proyecto', 'Mano de obra', 'Viáticos', 'Equipos y renta', 'Materiales', 'Resumen'];
  const subs = ['Datos generales', usd(c.mo), usd(c.cr + c.ca), usd(c.renta), usd(c.matVenta), usd(c.oferta)];
  const hints = ['Información general de la cotización', 'Agregue solo los puestos que participan', 'Complete solo los conceptos que apliquen', 'Tiempo estimado y equipos de apoyo', 'Catálogo con precio de lista y margen', 'Revise márgenes y descargue el Excel'];
  const R = L.rates(cfg);
  const activeRoles = cfg.roles.filter((r) => line('roles', r.id).on);
  const freeRoles = cfg.roles.filter((r) => !line('roles', r.id).on);
  const matList = cfg.mats.filter((m) => !search || norm(m.n).includes(norm(search)));
  const m = c.m;
  const isOn = (raw) => Math.abs(Math.min(n(raw) / 100, 0.95) - m) < 1e-9;
  const statusTxt = online === null ? 'Conectando…' : online ? 'Configuración en línea' : 'Configuración local (sin conexión)';
  const setInfo = (k) => (e) => { const v = e.target.value; setQ((x) => { x.info[k] = v; return x; }); };

  let body;
  if (step === 0) {
    body = (
      <div>
        {q.example && <div className="banner b-warn">Está viendo una <strong>cotización de ejemplo</strong>. Use «Nueva cotización» para empezar en blanco.</div>}
        <div className="grid2">
          {[['numero', 'N.º de cotización'], ['proyecto', 'Proyecto'], ['cliente', 'Cliente'], ['contacto', 'Contacto'], ['presupuestista', 'Presupuestista']].map(([k, lab]) => (
            <label className="field" key={k}>{lab}<input className="txt" id={'info-' + k} type="text" value={q.info[k] || ''} onChange={setInfo(k)} /></label>
          ))}
          <label className="field">Área<select className="sel" id="info-area" value={q.info.area} onChange={setInfo('area')}><option>Proyectos</option><option>Inspecciones</option></select></label>
          <label className="field">Fecha<input className="txt" id="info-fecha" type="date" value={q.info.fecha} onChange={setInfo('fecha')} /></label>
        </div>
        <p className="note">Salarios, tipo de cambio, overhead y catálogos se administran en <strong>Configuración</strong> (botón del engranaje). Esta cotización se guarda en este navegador mientras trabaja.</p>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div>
        <div className="tblbox"><table>
          <thead><tr><th>Puesto</th><th className="r">Personas</th><th className="r">Horas / sem.</th><th className="r">Semanas</th><th className="r">Horas totales</th><th className="r">Tarifa USD/h</th><th className="r">Total</th><th><span className="sr">Quitar</span></th></tr></thead>
          <tbody>
            {activeRoles.length ? activeRoles.map((r) => {
              const l = line('roles', r.id), hrs = n(l.p) * n(l.h) * n(l.w), rate = R.rate(r.sal);
              return (
                <tr key={r.id}>
                  <td className="strong">{r.name}</td>
                  <td className="r"><NumIn value={l.p} label={'Personas ' + r.name} onChange={(v) => setLine('roles', r.id, 'p', v)} /></td>
                  <td className="r"><NumIn value={l.h} label={'Horas por semana ' + r.name} onChange={(v) => setLine('roles', r.id, 'h', v)} /></td>
                  <td className="r"><NumIn value={l.w} label={'Semanas ' + r.name} onChange={(v) => setLine('roles', r.id, 'w', v)} /></td>
                  <td className="r">{hrs.toLocaleString('es-CR')}</td><td className="r">{rate.toFixed(2)}</td><td className="r strong">{usd(hrs * rate)}</td>
                  <td><button className="rm" type="button" aria-label={'Quitar ' + r.name} onClick={() => setLine('roles', r.id, 'on', false)}>{Icon.x}</button></td>
                </tr>
              );
            }) : <tr><td colSpan={8} style={{ padding: 18, color: 'var(--muted)' }}>Todavía no hay puestos. Agregue el primero con la lista de abajo.</td></tr>}
          </tbody>
        </table></div>
        <div className="addrow">
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>Agregar puesto
            <select className="sel" id="add-role" value="" onChange={(e) => { const id = e.target.value; if (!id) return; setQ((x) => { x.roles[id] = { p: '1', h: '40', w: '1', ...(x.roles[id] || {}), on: true }; return x; }); }}>
              <option value="">Seleccione…</option>
              {freeRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <div style={{ fontSize: 16 }}>Total mano de obra: <strong style={{ color: 'var(--red-text)', fontSize: 20 }}>{usd(c.mo)}</strong></div>
        </div>
        <p className="note">Horas sugeridas por el metrado (Equipos y renta): <strong>{c.horas.toLocaleString('es-CR')} h</strong> en {c.semanas.toLocaleString('es-CR', { maximumFractionDigits: 1 })} semanas.</p>
      </div>
    );
  } else if (step === 2) {
    body = (
      <div>
        <div className="tabs" role="tablist" aria-label="Región">
          <button type="button" role="tab" aria-selected={viaTab === 'cr'} className={'tab' + (viaTab === 'cr' ? ' on' : '')} onClick={() => setViaTab('cr')}>Costa Rica · {usd(c.cr)}</button>
          <button type="button" role="tab" aria-selected={viaTab === 'ca'} className={'tab' + (viaTab === 'ca' ? ' on' : '')} onClick={() => setViaTab('ca')}>Centroamérica · {usd(c.ca)}</button>
        </div>
        <div className="tblbox"><table>
          <thead><tr><th>Concepto</th><th>U/M</th><th className="r">Cantidad</th><th className="r">Días / unid.</th><th className="r">Semanas</th><th className="r">P/U (USD)</th><th className="r">Total</th></tr></thead>
          <tbody>
            {cfg[viaTab].map((it) => {
              const l = line(viaTab, it.id), qty = L.lineQty(it, l), pu = L.puOf(it, l);
              return (
                <tr key={it.id}>
                  <td className="strong">{it.n}</td><td>{it.um}</td>
                  <td className="r"><NumIn value={l.c || ''} label={'Cantidad ' + it.n} onChange={(v) => setLine(viaTab, it.id, 'c', v)} /></td>
                  <td className="r"><NumIn value={l.d || ''} label={'Días ' + it.n} onChange={(v) => setLine(viaTab, it.id, 'd', v)} /></td>
                  <td className="r">{it.noW ? <span style={{ color: 'var(--muted)' }}>—</span> : <NumIn value={l.w == null ? '1' : l.w} label={'Semanas ' + it.n} onChange={(v) => setLine(viaTab, it.id, 'w', v)} />}</td>
                  <td className="r"><NumIn value={l.pu != null && l.pu !== '' ? l.pu : s(it.pu, 2)} label={'Precio unitario ' + it.n} onChange={(v) => setLine(viaTab, it.id, 'pu', v)} /></td>
                  <td className="r strong">{usd(qty * pu)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="note">El P/U viene de Configuración; si lo cambia aquí, solo afecta esta cotización.{viaTab === 'cr' && cfg.cr.some((x) => x.noW) ? ' Hospedaje = cantidad × noches, igual que en el machote.' : ''}</p>
      </div>
    );
  } else if (step === 3) {
    const setEq = (k) => (v) => setQ((x) => { x.eq[k] = v; return x; });
    body = (
      <div>
        <h2 className="sec">Metrado para estimar tiempo</h2>
        <div className="grid3">
          <label className="field">Tubería total ({s(cfg.rend.tub)} por día)<NumIn cls="full" id="eq-tub" value={q.eq.tub} onChange={setEq('tub')} /></label>
          <label className="field">Dispositivos totales ({s(cfg.rend.disp)} por día)<NumIn cls="full" id="eq-disp" value={q.eq.disp} onChange={setEq('disp')} /></label>
          <label className="field">Aumento de días<NumIn cls="full" id="eq-extra" value={q.eq.extra} onChange={setEq('extra')} /></label>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          <div className="tile"><div className="kicker">Total días</div><div className="bignum">{c.dias}</div></div>
          <div className="tile"><div className="kicker">Horas ({s(cfg.rend.hDia)} h/día)</div><div className="bignum">{c.horas.toLocaleString('es-CR')}</div></div>
          <div className="tile"><div className="kicker">Semanas ({s(cfg.rend.dSem)} días)</div><div className="bignum">{c.semanas.toLocaleString('es-CR', { maximumFractionDigits: 1 })}</div></div>
        </div>
        <h2 className="sec">Renta de equipos y otros</h2>
        <div className="tblbox"><table>
          <thead><tr><th>Concepto</th><th>U/M</th><th className="r">Cantidad</th><th className="r">P/U (USD)</th><th className="r">Total</th></tr></thead>
          <tbody>
            {cfg.renta.map((it) => {
              const l = line('renta', it.id), pu = L.puOf(it, l);
              return (
                <tr key={it.id}>
                  <td className="strong">{it.n}</td><td>{it.um}</td>
                  <td className="r"><NumIn value={l.q || ''} label={'Cantidad ' + it.n} onChange={(v) => setLine('renta', it.id, 'q', v)} /></td>
                  <td className="r"><NumIn value={l.pu != null && l.pu !== '' ? l.pu : s(it.pu, 2)} label={'Precio unitario ' + it.n} onChange={(v) => setLine('renta', it.id, 'pu', v)} /></td>
                  <td className="r strong">{usd(n(l.q) * pu)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    );
  } else if (step === 4) {
    const mm = Math.min(n(q.matMargin) / 100, 0.95);
    body = (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 14 }}>
          <label className="field" style={{ flex: '1 1 260px' }}>Buscar en catálogo<input className="txt" id="mat-search" type="search" placeholder="Ej. EMT, cable, caja…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ background: 'var(--surface)' }} /></label>
          <label className="field">Margen materiales (%)<NumIn id="mat-margin" step="0.5" value={q.matMargin} onChange={(v) => setQ((x) => { x.matMargin = v; return x; })} /></label>
        </div>
        <div className="tblbox"><table>
          <thead><tr><th>Descripción</th><th>U/M</th><th className="r">Cantidad</th><th className="r">Precio lista</th><th className="r">Precio venta</th><th className="r">Total</th></tr></thead>
          <tbody>
            {matList.length ? matList.map((mt) => {
              const l = line('mats', mt.id), pv = mt.list / (1 - mm);
              return (
                <tr key={mt.id}>
                  <td className="strong" style={{ whiteSpace: 'normal', minWidth: 220 }}>{mt.n}</td><td>{mt.um}</td>
                  <td className="r"><NumIn value={l.q || ''} label={'Cantidad ' + mt.n} onChange={(v) => setLine('mats', mt.id, 'q', v)} /></td>
                  <td className="r">{usd(mt.list)}</td><td className="r">{usd(pv)}</td><td className="r strong">{usd(n(l.q) * pv)}</td>
                </tr>
              );
            }) : <tr><td colSpan={6} style={{ padding: 18, color: 'var(--muted)' }}>Ningún material coincide con «{search}».</td></tr>}
          </tbody>
        </table></div>
        <div className="total">Total materiales (venta): <strong>{usd(c.matVenta)}</strong></div>
      </div>
    );
  } else {
    const rows = [['1', 'Mano de obra construcción', c.mo, c.mo / (1 - m)], ['2', 'Viáticos Costa Rica', c.cr, c.cr / (1 - m)], ['3', 'Viáticos Centroamérica', c.ca, c.ca / (1 - m)], ['4', 'Renta de equipos', c.renta, c.renta / (1 - m)], ['5', 'Materiales (margen propio)', c.matCost, c.matVenta]];
    body = (
      <div>
        <div className="tblbox"><table>
          <thead><tr><th>Ítem</th><th>Descripción</th><th className="r">Costo</th><th className="r">Precio venta</th></tr></thead>
          <tbody>
            {rows.map((z) => <tr key={z[0]}><td>{z[0]}</td><td className="strong">{z[1]}</td><td className="r">{usd(z[2])}</td><td className="r strong">{usd(z[3])}</td></tr>)}
            <tr><td /><td className="strong">Total oferta</td><td className="r strong">{usd(c.costo + c.matCost)}</td><td className="r strong" style={{ color: 'var(--red-text)' }}>{usd(c.oferta)}</td></tr>
          </tbody>
        </table></div>
        <h2 className="sec">Comparativo de márgenes (servicios)</h2>
        <p className="note" style={{ margin: '0 0 10px' }}>Escriba cualquier margen en las casillas para comparar; «Usar» lo aplica a la cotización.</p>
        <div style={{ overflowX: 'auto' }}><div className="cmp">
          <div className="mc lab">Margen (%)</div>
          {q.cmp.map((raw, i) => <div key={'a' + i} className={'mc' + (isOn(raw) ? ' on' : '')}><NumIn step="0.5" value={raw} label={'Margen de comparación ' + (i + 1)} onChange={(v) => setQ((x) => { x.cmp[i] = v; return x; })} /></div>)}
          <div className="mc lab">Precio venta</div>
          {q.cmp.map((raw, i) => { const mg = Math.min(n(raw) / 100, 0.95); return <div key={'b' + i} className={'mc' + (isOn(raw) ? ' on' : '')}>{usd(c.costo / (1 - mg))}</div>; })}
          <div className="mc lab">Ganancia</div>
          {q.cmp.map((raw, i) => { const mg = Math.min(n(raw) / 100, 0.95); return <div key={'c' + i} className={'mc' + (isOn(raw) ? ' on' : '')}>{usd(c.costo / (1 - mg) - c.costo)}</div>; })}
          <div className="mc lab" />
          {q.cmp.map((raw, i) => <div key={'d' + i} className={'mc' + (isOn(raw) ? ' on' : '')}><button type="button" className="use" onClick={() => setQ((x) => { x.margin = raw; return x; })}>{isOn(raw) ? 'En uso' : 'Usar'}</button></div>)}
        </div></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button type="button" className="btn btn-red" onClick={downloadExcel}>{Icon.down} Descargar Excel de esta cotización</button>
        </div>
      </div>
    );
  }

  return (
    <div className="cotz">
      <div className="topinfo"><div className="wrap">
        <span><span className="dot" style={{ background: online ? '#2E9B57' : '#C98A00' }} />{statusTxt}{cfgDoc.updatedAt ? ' · actualizada ' + fmtDate(cfgDoc.updatedAt) : ''}</span>
        <span>Tipo de cambio <strong>{crc(n(cfg.tc))}</strong> · Cargas sociales <strong>{pct(n(cfg.cs))}</strong> · Overhead <strong>{pct(n(cfg.fa))}</strong></span>
      </div></div>
      <div className="brand"><div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div className="logo" aria-label="A y D">A<span>&amp;</span>D</div>
          <div style={{ minWidth: 0 }}>
            <div className="btitle">{q.info.numero ? 'COTIZACIÓN ' + q.info.numero : 'COTIZACIÓN'}</div>
            <div className="bsub">{q.info.proyecto || 'Sin nombre de proyecto'}{q.info.cliente ? ' · ' + q.info.cliente : ''}</div>
          </div>
        </div>
        <div className="hbtns">
          {confirmNew ? (
            <>
              <span style={{ fontSize: 14 }}>¿Borrar la cotización actual?</span>
              <button type="button" className="btn btn-dark" onClick={() => { const b = blankQuote(cfg); setQRaw(b); lsSet(QKEY, b); setConfirmNew(false); setStep(0); flash('Cotización nueva en blanco.'); }}>Sí, empezar de cero</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmNew(false)}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmNew(true)}>{Icon.file} Nueva cotización</button>
              <button type="button" className="btn btn-dark" onClick={downloadExcel}>{Icon.down} Descargar Excel</button>
              <button type="button" className="btn btn-ghost gear" aria-label="Configuración" title="Configuración" onClick={() => setShowCfg(true)}>{Icon.gear}</button>
            </>
          )}
        </div>
      </div></div>

      <div className="wrap main">
        <nav className="nav" aria-label="Pasos de la cotización">
          {names.map((nm, i) => (
            <button type="button" key={nm} className={'navbtn' + (step === i ? ' on' : '')} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>
              <span className="badge">{i + 1}</span><span><span className="navname">{nm}</span><span className="navsub">{subs[i]}</span></span>
            </button>
          ))}
        </nav>
        <section className="work" aria-labelledby="cotz-step-title">
          <div className="workhead"><h1 id="cotz-step-title">{names[step]}</h1><span className="hint">{hints[step]}</span></div>
          <div className="workbody">
            {body}
            <div className="foot">
              <button type="button" className="btn btn-line" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>← Anterior</button>
              {step < 5
                ? <button type="button" className="btn btn-dark" onClick={() => setStep(step + 1)}>Siguiente →</button>
                : <button type="button" className="btn btn-dark" onClick={downloadExcel}>{Icon.down} Descargar Excel</button>}
            </div>
          </div>
        </section>
        <aside className="side" aria-label="Resumen de la cotización">
          <div className="dark">
            <div className="kicker" style={{ color: '#C9D3DA' }}>Precio de venta servicios</div>
            <div className="bignum" style={{ fontSize: 36, marginTop: 2, whiteSpace: 'nowrap' }}>{usd(c.precio)}</div>
            <div className="kv" style={{ border: 0, color: '#E3ECF1' }}><span style={{ color: '#C9D3DA' }}>Ganancia</span><strong>{usd(c.ganancia)}</strong></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
              <label htmlFor="cotz-margin" style={{ fontSize: 14 }}>Margen de utilidad (%)</label>
              <NumIn id="cotz-margin" step="0.5" value={q.margin} label="Margen de utilidad" onChange={(v) => setQ((x) => { x.margin = v; return x; })} />
            </div>
            <input type="range" min="10" max="50" step="0.5" value={n(q.margin)} aria-label="Margen de utilidad" style={{ marginTop: 12 }} onChange={(e) => { const v = e.target.value; setQ((x) => { x.margin = v; return x; }); }} />
          </div>
          <div className="card">
            <h2 className="ctitle">Detalle de costos</h2>
            <div className="kv"><span>Mano de obra</span><span>{usd(c.mo)}</span></div>
            <div className="kv"><span>Viáticos C.R.</span><span>{usd(c.cr)}</span></div>
            <div className="kv"><span>Viáticos C.A.</span><span>{usd(c.ca)}</span></div>
            <div className="kv"><span>Renta de equipos</span><span>{usd(c.renta)}</span></div>
            <div className="kv" style={{ fontWeight: 700, fontSize: 16 }}><span style={{ color: 'var(--fg)' }}>Costo total</span><span style={{ color: 'var(--red-text)' }}>{usd(c.costo)}</span></div>
          </div>
          <div className="card" style={{ borderTop: '4px solid var(--red)' }}>
            <h2 className="ctitle">Overhead administrativo</h2>
            <div className="kv"><span>Incluido en M.O. ({pct(n(cfg.fa))})</span><strong>{usd(c.adm)}</strong></div>
            <div className="kv"><span>% sobre costo directo</span><strong>{pct(c.directo > 0 ? c.adm / c.directo : 0)}</strong></div>
            <div className="kv"><span>% sobre precio de venta</span><strong>{pct(c.precio > 0 ? c.adm / c.precio : 0)}</strong></div>
          </div>
          <div className="redcard">
            <div className="kicker" style={{ color: '#F6D7D8' }}>Total oferta (servicios + materiales)</div>
            <div className="bignum" style={{ fontSize: 32, marginTop: 2, whiteSpace: 'nowrap' }}>{usd(c.oferta)}</div>
          </div>
        </aside>
      </div>

      {showCfg && <Config cfg={cfg} cfgDoc={cfgDoc} online={online} canEdit={isAdmin} onClose={() => setShowCfg(false)} onApply={applyConfig} onDownload={downloadExcel} flash={flash} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* ====================== Configuración (engranaje) ====================== */
function Config({ cfg, cfgDoc, online, canEdit, onClose, onApply, onDownload, flash }) {
  const [d, setD] = useState(() => toDraft(cfg));
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('general');
  const [msg, setMsg] = useState(null);
  const [withQty, setWithQty] = useState(false);
  const [pendingQty, setPendingQty] = useState(null);
  const [source, setSource] = useState('Edición manual');
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const ro = !canEdit;
  const R = L.rates(fromDraft(d).cfg);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !dirty) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, onClose]);

  const upd = (fn) => { setD((prev) => { const nx = clone(prev); fn(nx); return nx; }); setDirty(true); };
  const setG = (k) => (v) => upd((x) => { x[k] = v; });
  const setRow = (list, i, k) => (v) => upd((x) => { x[list][i][k] = v; });
  const delRow = (list, i) => upd((x) => { x[list].splice(i, 1); });
  const addRow = (list) => upd((x) => {
    const id = L.uid(list === 'roles' ? 'r' : list.slice(0, 2));
    x[list].push(list === 'roles' ? { id, name: '', sal: '0' } : list === 'mats' ? { id, n: '', um: 'Ea', list: '0' } : { id, n: '', um: 'Gbl', pu: '0' });
  });

  function onFile(e) {
    const file = e.target.files && e.target.files[0]; const input = e.target;
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const res = L.parseMachote(XLSX, new Uint8Array(rd.result));
        setD(toDraft(res.cfg)); setDirty(true); setPendingQty(res.qty); setSource('Excel: ' + file.name);
        const over = res.cfg.roles.length > L.LIM.roles ? ' Atención: trae ' + res.cfg.roles.length + ' puestos y el formato del machote admite ' + L.LIM.roles + '.' : '';
        setMsg({ ok: true, t: 'Se leyó «' + file.name + '»: ' + res.cfg.roles.length + ' puestos, ' + res.cfg.cr.length + ' viáticos C.R., ' + res.cfg.ca.length + ' viáticos C.A., ' + res.cfg.renta.length + ' rentas y ' + res.cfg.mats.length + ' materiales. Tipo de cambio ' + crc(res.cfg.tc) + ', cargas ' + pct(res.cfg.cs) + ', overhead ' + pct(res.cfg.fa) + '. Revise las pestañas y pulse «Guardar configuración».' + over });
      } catch (err) { setMsg({ ok: false, t: 'No se pudo leer «' + file.name + '»: ' + (err && err.message ? err.message : err) }); }
      input.value = '';
    };
    rd.onerror = () => setMsg({ ok: false, t: 'No se pudo abrir el archivo.' });
    rd.readAsArrayBuffer(file);
  }

  async function save() {
    const r = fromDraft(d);
    if (r.errs.length) { setMsg({ ok: false, t: r.errs.join(' ') }); return; }
    setSaving(true);
    const res = await onApply(r.cfg, source, withQty && pendingQty ? pendingQty : null);
    setSaving(false);
    if (res === 'ok' || res === 'local') {
      setDirty(false); setPendingQty(null); setMsg(null);
      flash(res === 'ok' ? 'Configuración guardada. Todos los usuarios verán los nuevos valores.' : 'Configuración aplicada en este navegador (sin conexión a Supabase).');
      onClose();
    } else {
      setMsg({ ok: false, t: 'No se pudo guardar en Supabase (' + res + '). Los cambios se aplicaron solo en este navegador.' });
    }
  }

  const tabs = [['general', 'General'], ['roles', 'Personal y salarios'], ['cr', 'Viáticos C.R.'], ['ca', 'Viáticos C.A.'], ['renta', 'Renta de equipos'], ['mats', 'Materiales'], ['excel', 'Importar / exportar Excel']];

  const listTable = (key, title) => {
    const rows = d[key], lim = L.LIM[key];
    return (
      <div>
        <h3>{title}</h3>
        <p className="note" style={{ marginTop: 0 }}>{rows.length} de {lim} filas (límite del formato del machote). Los cambios aplican a la cotización actual y a las nuevas.</p>
        <div className="tblbox" style={{ marginTop: 12 }}><table>
          <thead><tr><th>Concepto</th><th>U/M</th><th className="r">P/U (USD)</th>{key === 'cr' && <th>Sin semanas</th>}<th><span className="sr">Eliminar</span></th></tr></thead>
          <tbody>
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td><input className="txt cell" type="text" value={x.n} disabled={ro} aria-label="Concepto" onChange={(e) => setRow(key, i, 'n')(e.target.value)} /></td>
                <td><input className="txt cell short" type="text" value={x.um} disabled={ro} aria-label="Unidad" onChange={(e) => setRow(key, i, 'um')(e.target.value)} /></td>
                <td className="r"><NumIn cls="wide" value={x.pu} disabled={ro} label={'P/U ' + x.n} onChange={setRow(key, i, 'pu')} /></td>
                {key === 'cr' && <td><input type="checkbox" style={{ width: 20, height: 20, accentColor: '#A50F14' }} checked={!!x.noW} disabled={ro} aria-label={'Cobrar sin semanas ' + x.n} onChange={(e) => setRow(key, i, 'noW')(e.target.checked)} /></td>}
                <td><button type="button" className="rm" disabled={ro} aria-label={'Eliminar ' + (x.n || 'fila')} onClick={() => delRow(key, i)}>{Icon.x}</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="addrow"><button type="button" className="btn btn-line" disabled={ro || rows.length >= lim} onClick={() => addRow(key)}>{Icon.plus} Agregar fila</button></div>
      </div>
    );
  };

  let body;
  if (tab === 'general') {
    body = (
      <div>
        <h3>Parámetros generales</h3>
        <p className="note" style={{ marginTop: 0 }}>Equivalen a la hoja Salarios (tipo de cambio, cargas, factor administrativo) y a los márgenes del machote.</p>
        <h4 className="sec">Costos de personal</h4>
        <div className="grid3">
          <label className="field">Tipo de cambio (₡ por USD)<NumIn cls="full" id="g-tc" value={d.tc} disabled={ro} onChange={setG('tc')} /></label>
          <label className="field">Cargas sociales (%)<NumIn cls="full" id="g-cs" value={d.cs} disabled={ro} onChange={setG('cs')} /></label>
          <label className="field">Overhead · factor administrativo (%)<NumIn cls="full" id="g-fa" value={d.fa} disabled={ro} onChange={setG('fa')} /></label>
          <label className="field">Factor de aumento (%)<NumIn cls="full" id="g-au" value={d.au} disabled={ro} onChange={setG('au')} /></label>
        </div>
        <h4 className="sec">Márgenes por defecto</h4>
        <div className="grid3">
          <label className="field">Margen de utilidad servicios (%)<NumIn cls="full" id="g-m" value={d.margin} disabled={ro} onChange={setG('margin')} /></label>
          <label className="field">Margen de materiales (%)<NumIn cls="full" id="g-mm" value={d.matMargin} disabled={ro} onChange={setG('matMargin')} /></label>
        </div>
        <h4 className="sec">Rendimientos para estimar tiempo</h4>
        <div className="grid3">
          <label className="field">Tubería por día<NumIn cls="full" id="g-tub" value={d.tub} disabled={ro} onChange={setG('tub')} /></label>
          <label className="field">Dispositivos por día<NumIn cls="full" id="g-disp" value={d.disp} disabled={ro} onChange={setG('disp')} /></label>
          <label className="field">Horas por día<NumIn cls="full" id="g-hdia" value={d.hDia} disabled={ro} onChange={setG('hDia')} /></label>
          <label className="field">Días por semana<NumIn cls="full" id="g-dsem" value={d.dSem} disabled={ro} onChange={setG('dSem')} /></label>
        </div>
      </div>
    );
  } else if (tab === 'roles') {
    body = (
      <div>
        <h3>Personal y salarios</h3>
        <p className="note" style={{ marginTop: 0 }}>Tarifa = salario ÷ 4,33 ÷ 48 × (1 + cargas) × (1 + overhead + aumento) ÷ tipo de cambio, igual que la hoja Salarios. {d.roles.length} de {L.LIM.roles} puestos.</p>
        <div className="tblbox" style={{ marginTop: 12 }}><table>
          <thead><tr><th>Puesto</th><th className="r">Salario mensual (₡)</th><th className="r">Tarifa USD/h</th><th className="r">Overhead USD/h</th><th><span className="sr">Eliminar</span></th></tr></thead>
          <tbody>
            {d.roles.map((r, i) => (
              <tr key={r.id}>
                <td><input className="txt cell" type="text" value={r.name} disabled={ro} aria-label="Nombre del puesto" onChange={(e) => setRow('roles', i, 'name')(e.target.value)} /></td>
                <td className="r"><NumIn cls="wide" step="1000" value={r.sal} disabled={ro} label={'Salario mensual ' + r.name} onChange={setRow('roles', i, 'sal')} /></td>
                <td className="r">{usd(R.rate(r.sal))}</td><td className="r">{usd(R.oh(r.sal))}</td>
                <td><button type="button" className="rm" disabled={ro} aria-label={'Eliminar ' + (r.name || 'puesto')} onClick={() => delRow('roles', i)}>{Icon.x}</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="addrow"><button type="button" className="btn btn-line" disabled={ro || d.roles.length >= L.LIM.roles} onClick={() => addRow('roles')}>{Icon.plus} Agregar puesto</button></div>
      </div>
    );
  } else if (tab === 'cr') body = listTable('cr', 'Viáticos Costa Rica');
  else if (tab === 'ca') body = listTable('ca', 'Viáticos Centroamérica');
  else if (tab === 'renta') body = listTable('renta', 'Renta de equipos y otros');
  else if (tab === 'mats') {
    body = (
      <div>
        <h3>Catálogo de materiales</h3>
        <p className="note" style={{ marginTop: 0 }}>{d.mats.length} materiales. Precio de lista en USD; el precio de venta aplica el margen de materiales.</p>
        <div className="tblbox" style={{ marginTop: 12 }}><table>
          <thead><tr><th>Descripción</th><th>U/M</th><th className="r">Precio lista (USD)</th><th><span className="sr">Eliminar</span></th></tr></thead>
          <tbody>
            {d.mats.map((x, i) => (
              <tr key={x.id}>
                <td><input className="txt cell" style={{ minWidth: 300 }} type="text" value={x.n} disabled={ro} aria-label="Descripción" onChange={(e) => setRow('mats', i, 'n')(e.target.value)} /></td>
                <td><input className="txt cell short" type="text" value={x.um} disabled={ro} aria-label="Unidad" onChange={(e) => setRow('mats', i, 'um')(e.target.value)} /></td>
                <td className="r"><NumIn cls="wide" value={x.list} disabled={ro} label={'Precio lista ' + x.n} onChange={setRow('mats', i, 'list')} /></td>
                <td><button type="button" className="rm" disabled={ro} aria-label={'Eliminar ' + (x.n || 'material')} onClick={() => delRow('mats', i)}>{Icon.x}</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="addrow"><button type="button" className="btn btn-line" disabled={ro || d.mats.length >= L.LIM.mats} onClick={() => addRow('mats')}>{Icon.plus} Agregar material</button></div>
      </div>
    );
  } else {
    body = (
      <div>
        <h3>Importar / exportar Excel</h3>
        <h4 className="sec">Cargar un machote actualizado</h4>
        <div className="drop">
          <div style={{ flex: '1 1 300px', fontSize: 14, lineHeight: 1.5, color: 'var(--muted)' }}>Lee las hojas <strong style={{ color: 'var(--fg)' }}>Salarios</strong>, <strong style={{ color: 'var(--fg)' }}>Estimacion Horas</strong> y <strong style={{ color: 'var(--fg)' }}>Materiales</strong>: puestos y salarios, tipo de cambio, cargas sociales, overhead, factor de aumento, márgenes, rendimientos, precios de viáticos, renta y catálogo de materiales.</div>
          <label className="btn btn-red" style={{ position: 'relative', opacity: ro ? 0.45 : 1 }}>{Icon.up} Cargar Excel (.xlsm / .xlsx)
            <input className="hidefile" type="file" accept=".xlsm,.xlsx,.xls" disabled={ro} onChange={onFile} />
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={withQty} disabled={ro} onChange={(e) => setWithQty(e.target.checked)} />
          <span>También cargar las <strong>cantidades</strong> del archivo en la cotización actual (personas, horas, semanas, viáticos, renta, metrado y materiales). Reemplaza lo que ya está digitado.</span>
        </label>
        <h4 className="sec">Descargar</h4>
        <p className="note" style={{ marginTop: 0 }}>Genera un Excel en formato machote con la configuración y la cotización actuales: Resumen General (con overhead y total de oferta), Estimacion Horas, Salarios y Materiales, todo con fórmulas.{dirty ? ' Guarde primero los cambios para incluirlos.' : ''}</p>
        <button type="button" className="btn btn-dark" onClick={onDownload}>{Icon.down} Descargar Excel actual</button>
        <h4 className="sec">Restaurar</h4>
        <p className="note" style={{ marginTop: 0 }}>Vuelve a los valores del machote original (octubre 2025). Se aplica al pulsar «Guardar configuración».</p>
        <button type="button" className="btn btn-line" disabled={ro} onClick={() => { setD(toDraft(DEFAULT_CFG)); setDirty(true); setSource('Machote original'); setPendingQty(null); setMsg({ ok: true, t: 'Valores del machote original cargados. Pulse «Guardar configuración» para aplicarlos.' }); }}>Restaurar machote original</button>
      </div>
    );
  }

  return (
    <div className="ovl" role="dialog" aria-modal="true" aria-labelledby="cotz-cfg-title">
      <div className="ovlhead"><div className="wrap">
        <h2 id="cotz-cfg-title">{Icon.gear} Configuración</h2>
        <span style={{ fontSize: 13, color: '#C9D3DA' }}>{online ? 'En línea' : 'Local'} · {cfgDoc.source || ''}{cfgDoc.updatedAt ? ' · ' + fmtDate(cfgDoc.updatedAt) : ''}</span>
        <button type="button" className="btn btn-ghost" onClick={() => (dirty ? setConfirmClose(true) : onClose())}>{Icon.x} Cerrar</button>
      </div></div>
      <div className="wrap cfgmain">
        <nav className="cfgnav" aria-label="Secciones de configuración">
          {tabs.map(([k, lab]) => <button type="button" key={k} className={'navbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><span className="navname">{lab}</span></button>)}
        </nav>
        <div className="cfgbody">
          {ro && <div className="banner b-info">Modo consulta: solo los administradores pueden cambiar la configuración. Puede descargar el Excel actual.</div>}
          {msg && <div className={'banner ' + (msg.ok ? 'b-ok' : 'b-err')} role="status">{msg.t}</div>}
          {body}
        </div>
      </div>
      <div className="savebar"><div className="wrap">
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{confirmClose ? 'Hay cambios sin guardar. ¿Cerrar y descartarlos?' : dirty ? 'Cambios sin guardar' + (pendingQty && withQty ? ' · se cargarán también las cantidades' : '') : 'Sin cambios'}</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {confirmClose ? (
            <>
              <button type="button" className="btn btn-line" onClick={() => setConfirmClose(false)}>Seguir editando</button>
              <button type="button" className="btn btn-dark" onClick={onClose}>Descartar y cerrar</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-line" disabled={!dirty} onClick={() => { setD(toDraft(cfg)); setDirty(false); setPendingQty(null); setMsg(null); setSource('Edición manual'); }}>Descartar cambios</button>
              <button type="button" className="btn btn-red" disabled={!dirty || ro || saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
            </>
          )}
        </div>
      </div></div>
    </div>
  );
}
