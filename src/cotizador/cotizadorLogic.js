/* Lógica del Cotizador A&D: configuración, cálculo, lectura y escritura del machote Excel. */
var CotLogic = (function () {
  var LIM = { roles: 18, cr: 8, ca: 8, renta: 7, mats: 290 };
  var seq = 0;
  function uid(p) { seq += 1; return (p || 'x') + Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
  function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function r2(v, d) { var p = Math.pow(10, d == null ? 6 : d); return Math.round(v * p) / p; }

  /* ---------- lectura del machote ---------- */
  function parseMachote(XLSX, buf) {
    var wb = XLSX.read(buf, { type: 'array', cellFormula: true, sheetStubs: true });
    var sh = function (name) { var w = wb.Sheets[name]; if (!w) throw new Error('El archivo no tiene la hoja «' + name + '». Use el machote de cotización.'); return w; };
    var simple = function (f) { if (!f || !/^[0-9.+\-*\/()% ]+$/.test(f)) return undefined; try { var r = Function('return (' + f.replace(/([0-9.]+)%/g, '($1/100)') + ')')(); return isFinite(r) ? r : undefined; } catch (e) { return undefined; } };
    var val = function (w, a) { var c = w && w[a]; if (!c) return undefined; if (c.t !== 'z' && c.v != null && c.v !== '') return c.v; return simple(c.f); };
    var num = function (w, a) { var v = val(w, a); return typeof v === 'number' ? v : (v != null && v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null); };
    var txt = function (w, a) { var v = val(w, a); return v == null ? '' : String(v).trim(); };
    var fdiv = function (w, a) { var c = w && w[a]; if (!c || !c.f) return null; var m = /[\/*]\s*\+?\s*([0-9.]+)/.exec(c.f.replace(/^[^\/*]*?C\d+/, '')); return m ? parseFloat(m[1]) : null; };
    var S = sh('Salarios'), E = sh('Estimacion Horas'), M = wb.Sheets['Materiales'];
    var cfg = { tc: num(S, 'K3'), cs: num(S, 'F4'), fa: num(S, 'G4'), au: num(S, 'H4') || 0,
      margin: num(E, 'B1'), matMargin: null, rend: { tub: 20, disp: 15, hDia: 10, dSem: 5 },
      roles: [], cr: [], ca: [], renta: [], mats: [] };
    var q = { roles: {}, cr: {}, ca: {}, renta: {}, mats: {}, eq: {}, hasQty: false };
    var roleBySalRow = {};
    for (var r = 6; r <= 60; r++) {
      var nm = txt(S, 'C' + r), sal = num(S, 'D' + r);
      if (!nm || !sal) continue;
      var dup = cfg.roles.filter(function (x) { return x.base === nm; }).length;
      var role = { id: uid('r'), name: dup ? nm + ' (' + (dup + 1) + ')' : nm, base: nm, sal: sal };
      cfg.roles.push(role); roleBySalRow[r] = role;
    }
    cfg.roles.forEach(function (x) { delete x.base; });
    // horas por puesto: Estimacion E{r} = Salarios!K{fila}
    for (var er = 3; er <= 40; er++) {
      var ce = E['E' + er]; if (!ce || !ce.f) continue;
      var mm = /Salarios!\$?K\$?(\d+)/i.exec(ce.f); if (!mm) continue;
      var rl = roleBySalRow[parseInt(mm[1], 10)]; if (!rl) continue;
      var p = num(E, 'H' + er), h = num(E, 'I' + er), w = num(E, 'J' + er);
      if ((p || 0) * (h || 0) * (w || 0) > 0) { q.roles[rl.id] = { on: true, p: String(p), h: String(h), w: String(w) }; q.hasQty = true; }
    }
    var block = function (r1, r2, key, noWFirst) {
      for (var k = r1; k <= r2; k++) {
        var n2 = txt(E, 'L' + k); if (!n2 || /error|total/i.test(n2)) continue;
        var item = { id: uid(key), n: n2, um: txt(E, 'N' + k), pu: num(E, 'O' + k) || 0 };
        if (noWFirst && k === r1) item.noW = true;
        cfg[key].push(item);
        if (key === 'renta') { var qq = num(E, 'M' + k) || 0; if (qq) { q.renta[item.id] = { q: String(qq) }; q.hasQty = true; } }
        else { var c = num(E, 'R' + k) || 0, d = num(E, 'S' + k) || 0, ww = num(E, 'T' + k); if (c && d) { q[key][item.id] = { c: String(c), d: String(d), w: String(ww == null ? 1 : ww) }; q.hasQty = true; } }
      }
    };
    block(3, 10, 'cr', true); block(14, 21, 'ca', false); block(25, 31, 'renta', false);
    q.eq = { tub: String(num(E, 'C26') || 0), disp: String(num(E, 'C27') || 0), extra: String(num(E, 'E25') == null ? 3 : num(E, 'E25')) };
    var rt = fdiv(E, 'D26'), rd = fdiv(E, 'D27');
    if (rt) cfg.rend.tub = rt; if (rd) cfg.rend.disp = rd;
    var f28 = E.F28 && E.F28.f && /\*\s*([0-9.]+)/.exec(E.F28.f); if (f28) cfg.rend.hDia = parseFloat(f28[1]);
    var e29 = E.E29 && E.E29.f && /\/\s*([0-9.]+)/.exec(E.E29.f); if (e29) cfg.rend.dSem = parseFloat(e29[1]);
    if (M) {
      cfg.matMargin = num(M, 'H2');
      for (var r3 = 4; r3 <= 300; r3++) {
        var d3 = txt(M, 'C' + r3); if (!d3) continue;
        var f = M['F' + r3], list = num(M, 'I' + r3);
        if (f && typeof f.v === 'number' && !f.f && f.t !== 'z') list = f.v * (1 - (cfg.matMargin || 0));
        if (list == null) continue;
        var mt = { id: uid('m'), n: d3, um: txt(M, 'D' + r3), list: r2(list, 6) };
        cfg.mats.push(mt);
        var mq = num(M, 'E' + r3); if (mq) { q.mats[mt.id] = { q: String(mq) }; q.hasQty = true; }
      }
    }
    if (!cfg.tc || cfg.cs == null || cfg.fa == null) throw new Error('Faltan tipo de cambio (K3), cargas sociales (F4) o factor administrativo (G4) en la hoja Salarios.');
    if (!cfg.roles.length) throw new Error('No se encontraron salarios en la hoja Salarios (columnas C y D).');
    if (cfg.margin == null) cfg.margin = 0.3;
    if (cfg.matMargin == null) cfg.matMargin = 0.2;
    return { cfg: cfg, qty: q };
  }

  /* ---------- cálculo ---------- */
  function rates(cfg) {
    var TC = n(cfg.tc) || 1, CS = n(cfg.cs), FA = n(cfg.fa), AU = n(cfg.au);
    return {
      base: function (sal) { return n(sal) / 4.33 / 48 * (1 + CS); },
      rate: function (sal) { return n(sal) / 4.33 / 48 * (1 + CS) * (1 + FA + AU) / TC; },
      oh: function (sal) { return n(sal) / 4.33 / 48 * (1 + CS) * FA / TC; }
    };
  }
  function lineQty(it, l) { if (!l) return 0; return it.noW ? n(l.c) * n(l.d) : n(l.c) * n(l.d) * n(l.w == null ? 1 : l.w); }
  function puOf(it, l) { return l && l.pu != null && l.pu !== '' ? n(l.pu) : n(it.pu); }

  function compute(cfg, q) {
    var R = rates(cfg), out = { mo: 0, adm: 0, roles: [], cr: 0, ca: 0, renta: 0, matCost: 0, matVenta: 0 };
    cfg.roles.forEach(function (r) {
      var l = q.roles[r.id]; if (!l || !l.on) return;
      var hrs = n(l.p) * n(l.h) * n(l.w), rate = R.rate(r.sal);
      out.mo += hrs * rate; out.adm += hrs * R.oh(r.sal);
      out.roles.push({ id: r.id, name: r.name, hrs: hrs, rate: rate, total: hrs * rate });
    });
    ['cr', 'ca'].forEach(function (k) { cfg[k].forEach(function (it) { out[k] += lineQty(it, q[k][it.id]) * puOf(it, q[k][it.id]); }); });
    cfg.renta.forEach(function (it) { var l = q.renta[it.id]; out.renta += n(l && l.q) * puOf(it, l); });
    var mm = Math.min(n(q.matMargin) / 100, 0.95);
    cfg.mats.forEach(function (m) { var l = q.mats[m.id], qq = n(l && l.q); out.matCost += qq * m.list; out.matVenta += qq * m.list / (1 - mm); });
    var ex = n(q.eq.extra), rd = cfg.rend;
    out.dias = Math.ceil(n(q.eq.tub) / (n(rd.tub) || 1)) + ex + Math.ceil(n(q.eq.disp) / (n(rd.disp) || 1)) + ex;
    out.horas = out.dias * n(rd.hDia); out.semanas = out.dias / (n(rd.dSem) || 1);
    out.costo = out.mo + out.cr + out.ca + out.renta;
    out.m = Math.min(n(q.margin) / 100, 0.95);
    out.precio = out.costo / (1 - out.m);
    out.ganancia = out.precio - out.costo;
    out.oferta = out.precio + out.matVenta;
    out.directo = out.costo - out.adm;
    return out;
  }

  /* ---------- escritura del Excel ---------- */
  function buildWorkbook(XLSX, cfg, q, info) {
    var wb = XLSX.utils.book_new();
    var mk = function () { return {}; };
    var put = function (ws, a, v) { if (v === undefined || v === null || v === '') return; if (typeof v === 'object') { ws[a] = v; return; } ws[a] = typeof v === 'number' ? { t: 'n', v: v } : { t: 's', v: String(v) }; };
    var F = function (f, z) { var o = { t: 'n', f: f }; if (z) o.z = z; return o; };
    var N = function (v, z) { var o = { t: 'n', v: n(v) }; if (z) o.z = z; return o; };
    var USD = '"USD "#,##0.00', CRC = '"₡"#,##0.00', PCT = '0.00%';
    var info0 = info || {};

    // Salarios
    var S = mk();
    put(S, 'C3', 'Desglose de Salarios y Cargas Sociales'); put(S, 'K2', 'Compra'); put(S, 'L2', 'Venta');
    put(S, 'J3', 'USD / CR ¢'); put(S, 'K3', N(cfg.tc, CRC)); put(S, 'L3', F('K3+10', CRC));
    put(S, 'E4', F('K7', CRC)); put(S, 'F4', N(cfg.cs, PCT)); put(S, 'G4', N(cfg.fa, PCT)); put(S, 'H4', N(cfg.au || 0, PCT)); put(S, 'I4', 'Precio en Colones');
    ['Categoria', 'Salario Mensual', 'Salario Hora', 'Cargas Sociales', 'Factor Administrativo', 'Factor Aumento', 'Total Hora', 'Total Mensual', 'Total Hora', 'Total Mensual'].forEach(function (h, i) { put(S, String.fromCharCode(67 + i) + '5', h); });
    var nR = Math.max(cfg.roles.length, 1);
    cfg.roles.forEach(function (r, i) {
      var row = 7 + i;
      put(S, 'A' + row, i + 1); put(S, 'C' + row, r.name); put(S, 'D' + row, N(r.sal, CRC));
      put(S, 'E' + row, F('D' + row + '/4.33/48', CRC)); put(S, 'F' + row, F('E' + row + '*$F$4', CRC));
      put(S, 'G' + row, F('(F' + row + '+E' + row + ')*$G$4', CRC)); put(S, 'H' + row, F('(E' + row + '+F' + row + ')*$H$4', CRC));
      put(S, 'I' + row, F('SUM(E' + row + ':H' + row + ')', CRC)); put(S, 'J' + row, F('I' + row + '*48*4.33', CRC));
      put(S, 'K' + row, F('I' + row + '/$K$3', USD)); put(S, 'L' + row, F('J' + row + '/$K$3', USD));
    });
    put(S, 'D' + (8 + nR), 'Generado por Cotizador A&D · ' + new Date().toLocaleDateString('es-CR'));
    S['!ref'] = 'A1:L' + (9 + nR);
    S['!cols'] = [{ wch: 4 }, { wch: 2 }, { wch: 26 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 13 }];

    // Estimacion Horas
    var E = mk(), mg = Math.min(n(q.margin) / 100, 0.95);
    put(E, 'B1', N(mg, '0%')); put(E, 'C1', 'Margen de utilidad');
    ['M.O. Construccion', 'Cantidad', 'U/M', 'P/U', 'Total'].forEach(function (h, i) { put(E, String.fromCharCode(66 + i) + '2', h); });
    ['Personas', 'Horas', 'Semanas'].forEach(function (h, i) { put(E, String.fromCharCode(72 + i) + '2', h); });
    for (var rr = 3; rr <= 21; rr++) { put(E, 'C' + rr, F('H' + rr + '*I' + rr + '*J' + rr)); put(E, 'F' + rr, F('E' + rr + '*C' + rr, USD)); }
    cfg.roles.slice(0, LIM.roles).forEach(function (r, i) {
      var row = 4 + i, l = q.roles[r.id] || {};
      put(E, 'A' + row, i + 1); put(E, 'B' + row, r.name); put(E, 'D' + row, 'Hr');
      put(E, 'E' + row, F('Salarios!K' + (7 + i), USD));
      var on = l.on;
      put(E, 'H' + row, N(on ? l.p : 0)); put(E, 'I' + row, N(on ? l.h : 0)); put(E, 'J' + row, N(on ? l.w : 1));
    });
    put(E, 'E22', 'TOTAL'); put(E, 'F22', F('SUM(F3:F21)', USD));
    var viat = function (key, hdrRow, r1, maxRows, totRow, title) {
      put(E, 'L' + hdrRow, title); ['Cantidad', 'U/M', 'P/U', 'Total'].forEach(function (h, i) { put(E, String.fromCharCode(77 + i) + hdrRow, h); });
      ['Cantidad', 'Días/Unid.', 'Semanas'].forEach(function (h, i) { put(E, String.fromCharCode(82 + i) + hdrRow, h); });
      cfg[key].slice(0, maxRows).forEach(function (it, i) {
        var row = r1 + i, l = q[key][it.id] || {};
        put(E, 'L' + row, it.n); put(E, 'N' + row, it.um); put(E, 'O' + row, N(puOf(it, l), USD));
        put(E, 'M' + row, F(it.noW ? 'R' + row + '*S' + row : 'R' + row + '*S' + row + '*T' + row));
        put(E, 'P' + row, F('O' + row + '*M' + row, USD));
        put(E, 'R' + row, N(l.c || 0)); put(E, 'S' + row, N(l.d || 0)); put(E, 'T' + row, N(l.w == null ? 1 : l.w));
      });
      put(E, 'O' + totRow, 'TOTAL'); put(E, 'P' + totRow, F('SUM(P' + r1 + ':P' + (r1 + maxRows - 1) + ')', USD));
    };
    viat('cr', 2, 3, LIM.cr, 11, 'Viáticos C.R.');
    viat('ca', 13, 14, LIM.ca, 22, 'Viáticos Centroamérica');
    put(E, 'B24', 'Equipos'); put(E, 'D24', 'Días'); put(E, 'E24', 'Aumento días'); put(E, 'E25', N(q.eq.extra));
    put(E, 'B26', 'Tubería Total'); put(E, 'C26', N(q.eq.tub)); put(E, 'D26', F('ROUNDUP(C26/' + n(cfg.rend.tub) + ',0)')); put(E, 'E26', F('D26+E25'));
    put(E, 'B27', 'Dispositivos Totales'); put(E, 'C27', N(q.eq.disp)); put(E, 'D27', F('ROUNDUP(C27/' + n(cfg.rend.disp) + ',0)')); put(E, 'E27', F('D27+E25'));
    put(E, 'D28', 'Total días'); put(E, 'E28', F('E26+E27')); put(E, 'F27', 'Horas'); put(E, 'F28', F('E28*' + n(cfg.rend.hDia)));
    put(E, 'E29', F('E28/' + n(cfg.rend.dSem), '0.0')); put(E, 'F29', 'Semanas');
    put(E, 'L24', 'Renta Equipos'); ['Cantidad', 'U/M', 'P/U', 'Total'].forEach(function (h, i) { put(E, String.fromCharCode(77 + i) + '24', h); });
    cfg.renta.slice(0, LIM.renta).forEach(function (it, i) {
      var row = 25 + i, l = q.renta[it.id] || {};
      put(E, 'L' + row, it.n); put(E, 'M' + row, N(l.q || 0)); put(E, 'N' + row, it.um); put(E, 'O' + row, N(puOf(it, l), USD)); put(E, 'P' + row, F('O' + row + '*M' + row, USD));
    });
    put(E, 'O32', 'TOTAL'); put(E, 'P32', F('SUM(P25:P31)', USD));
    E['!ref'] = 'A1:T32';
    E['!cols'] = [{ wch: 4 }, { wch: 24 }, { wch: 9 }, { wch: 7 }, { wch: 12 }, { wch: 13 }, { wch: 2 }, { wch: 9 }, { wch: 8 }, { wch: 9 }, { wch: 2 }, { wch: 24 }, { wch: 10 }, { wch: 7 }, { wch: 11 }, { wch: 12 }, { wch: 2 }, { wch: 9 }, { wch: 10 }, { wch: 9 }];

    // Materiales
    var M = mk(), mm = Math.min(n(q.matMargin) / 100, 0.95);
    put(M, 'H1', 'Margen de Ganancia'); put(M, 'H2', N(mm, '0%'));
    ['Número de parte', 'Descripción', 'Unidad', 'Cantidad', 'Precio Unitario', 'Precio Total', 'Margen', 'Precio de lista'].forEach(function (h, i) { put(M, String.fromCharCode(66 + i) + '3', h); });
    var mr = 4;
    cfg.mats.slice(0, LIM.mats).forEach(function (m) {
      var l = q.mats[m.id] || {};
      put(M, 'C' + mr, m.n); put(M, 'D' + mr, m.um); put(M, 'E' + mr, N(l.q || 0));
      put(M, 'F' + mr, F('I' + mr + '/(1-H' + mr + ')', USD)); put(M, 'G' + mr, F('F' + mr + '*E' + mr, USD));
      put(M, 'H' + mr, F('$H$2', '0%')); put(M, 'I' + mr, N(m.list, USD)); mr++;
    });
    var mTot = mr;
    put(M, 'F' + mTot, 'Total'); put(M, 'G' + mTot, F('SUM(G4:G' + (mTot - 1) + ')', USD));
    M['!ref'] = 'A1:I' + mTot;
    M['!cols'] = [{ wch: 2 }, { wch: 14 }, { wch: 46 }, { wch: 9 }, { wch: 10 }, { wch: 15 }, { wch: 14 }, { wch: 9 }, { wch: 14 }];

    // Resumen General
    var G = mk(), RS = "'Estimacion Horas'!";
    put(G, 'B1', 'INFORMACIÓN DEL PROYECTO');
    [['Proyecto', info0.proyecto], ['Area', info0.area], ['Cliente', info0.cliente], ['Fecha', info0.fecha]].forEach(function (p, i) { put(G, 'B' + (2 + i), p[0]); put(G, 'C' + (2 + i), p[1] || ''); });
    put(G, 'B6', 'DETALLE DE COSTOS');
    ['Item', 'Descripción', 'Cantidad', 'U/M', 'P/U', 'Total'].forEach(function (h, i) { put(G, String.fromCharCode(66 + i) + '7', h); put(G, String.fromCharCode(66 + i) + '19', h); });
    var items = [['M.O. Construccion', RS + 'F22'], ['Viáticos C.R.', RS + 'P11'], ['Viáticos Centroamérica', RS + 'P22'], ['Renta Equipos', RS + 'P32']];
    items.forEach(function (it, i) {
      var a = 8 + i, b = 20 + i;
      put(G, 'B' + a, i + 1); put(G, 'C' + a, it[0]); put(G, 'D' + a, 1); put(G, 'E' + a, 'Gbl'); put(G, 'F' + a, F(it[1], USD)); put(G, 'G' + a, F('D' + a + '*F' + a, USD));
      put(G, 'B' + b, i + 1); put(G, 'C' + b, it[0]); put(G, 'D' + b, 1); put(G, 'E' + b, 'Gbl'); put(G, 'F' + b, F('F' + a + '/(1-' + RS + 'B1)', USD)); put(G, 'G' + b, F('D' + b + '*F' + b, USD));
    });
    put(G, 'B13', 'COSTO TOTAL'); put(G, 'G13', F('SUM(G8:G12)', USD));
    put(G, 'B14', 'MARGEN DE UTILIDAD');
    put(G, 'B15', 'Margen'); put(G, 'B16', 'Precio Venta'); put(G, 'B17', 'Ganancia');
    (q.cmp || ['25', '27.5', '30', '32.5', '35']).slice(0, 5).forEach(function (raw, i) {
      var c = String.fromCharCode(67 + i), v = Math.min(n(raw) / 100, 0.95);
      put(G, c + '15', Math.abs(v - mg) < 1e-9 ? F(RS + 'B1', '0.00%') : N(v, '0.00%'));
      put(G, c + '16', F('$G$13/(1-' + c + '15)', USD)); put(G, c + '17', F(c + '16-$G$13', USD));
    });
    put(G, 'B18', 'PRECIO DE VENTA POR ÍTEM (con margen)');
    put(G, 'B26', 'PRECIO DE VENTA TOTAL'); put(G, 'G26', F('SUM(G20:G25)', USD));
    put(G, 'B28', 'CÁLCULO DE OVERHEAD'); put(G, 'G28', 'Total');
    put(G, 'B29', 'Overhead administrativo incluido en M.O. (Factor Adm. Salarios)'); put(G, 'F29', F('Salarios!G4', PCT));
    put(G, 'G29', F('SUMPRODUCT(' + RS + 'C4:C21,Salarios!G7:G24)/Salarios!K3', USD));
    put(G, 'B30', 'Costo directo sin overhead'); put(G, 'G30', F('G13-G29', USD));
    put(G, 'B31', '% Overhead sobre costo directo'); put(G, 'G31', F('IF(G30=0,0,G29/G30)', PCT));
    put(G, 'B32', '% Overhead sobre precio de venta'); put(G, 'G32', F('IF(G26=0,0,G29/G26)', PCT));
    put(G, 'B34', 'Materiales (precio de venta)'); put(G, 'G34', F('Materiales!G' + mTot, USD));
    put(G, 'B35', 'TOTAL OFERTA (servicios + materiales)'); put(G, 'G35', F('G26+G34', USD));
    G['!ref'] = 'A1:G35';
    G['!cols'] = [{ wch: 2 }, { wch: 14 }, { wch: 30 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 16 }];
    G['!merges'] = [{ s: { r: 0, c: 1 }, e: { r: 0, c: 6 } }];

    XLSX.utils.book_append_sheet(wb, G, 'Resumen General - INFORMACION');
    XLSX.utils.book_append_sheet(wb, E, 'Estimacion Horas');
    XLSX.utils.book_append_sheet(wb, S, 'Salarios');
    XLSX.utils.book_append_sheet(wb, M, 'Materiales');
    wb.Workbook = { CalcPr: { fullCalcOnLoad: true } };
    return wb;
  }

  return { LIM: LIM, uid: uid, n: n, norm: norm, parseMachote: parseMachote, compute: compute, rates: rates, lineQty: lineQty, puOf: puOf, buildWorkbook: buildWorkbook };
})();
export default CotLogic;
