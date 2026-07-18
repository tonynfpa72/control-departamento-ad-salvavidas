import React, { useState, useMemo, useEffect, useContext, createContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine, LineChart, Line, LabelList
} from "recharts";
import * as XLSX from "xlsx";
import {
  LogOut, Plus, Download, Check, X, Clock, ClipboardList,
  CalendarDays, FileText, HardHat, LayoutDashboard, Building2,
  ChevronLeft, ChevronRight, AlertCircle, Upload, Flame, Wallet
} from "lucide-react";
import { supabase } from "./supabaseClient";


/* ---------------------------------------------------------
   TOKENS
   Paleta: azul acero (identidad técnica/industrial) + naranja
   seguridad como acento de acción/alerta. Fondo casi-blanco
   frío, no el crema genérico.
   --------------------------------------------------------- */
const T = {
  bg: "#F3F5F7",
  panel: "#FFFFFF",
  ink: "#101826",
  inkSoft: "#5B6572",
  line: "#E1E6EB",
  steel: "#1F3A5F",
  steelSoft: "#2E5482",
  accent: "#E86A2C", // naranja seguridad
  accentSoft: "#FFE4D3",
  green: "#2E7D5B",
  greenSoft: "#DEF2E8",
  amber: "#C98A12",
  amberSoft: "#FBEBCB",
  blue: "#2563EB",
  blueSoft: "#DCE7FD",
  red: "#C13E3E",
  redSoft: "#FBE4E4",
  gray: "#6B7280",
  graySoft: "#EDEFF2",
  turquoise: "#4CA6A8", // turquesa suave, menos fuerte que el azul
  turquoiseSoft: "#DCF0EF",
};

/* Contexto simple para compartir el logo subido entre Login, Sidebar y PDF */
const LogoContext = createContext({ logo: null, setLogo: () => {} });

/* Contexto de usuarios del sistema (gestionado por Administrativo) */
const UsersContext = createContext({ users: [], refetchUsers: () => {} });

/* Contexto del usuario actualmente autenticado, para controlar permisos
   (solo la categoría "admin" puede editar/borrar datos ingresados a mano) */
const CurrentUserContext = createContext(null);

/* Confirmación de borrado propia de la app (NO usa window.confirm, que
   queda bloqueado en entornos de vista previa dentro de un iframe). */
const ConfirmContext = createContext(() => Promise.resolve(true));

function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null); // { mensaje, resolve, confirmLabel, variant }

  const confirmar = (
    mensaje = "¿Está seguro que desea eliminar este registro? Esta acción no se puede deshacer.",
    opciones = {}
  ) => new Promise((resolve) => setPending({ mensaje, resolve, ...opciones }));

  const responder = (ok) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const esDestructivo = (pending?.variant || "danger") === "danger";

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pending && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(16,24,38,0.55)", zIndex: 2000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 380, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 18 }}>
              {esDestructivo
                ? <AlertCircle size={20} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
                : <CalendarDays size={20} color={T.steel} style={{ flexShrink: 0, marginTop: 1 }} />}
              <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{pending.mensaje}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => responder(false)}>Cancelar</Btn>
              <Btn variant={esDestructivo ? "danger" : "accent"} onClick={() => responder(true)}>
                {pending.confirmLabel || (esDestructivo ? "Sí, eliminar" : "Sí, continuar")}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// Calcula el total de horas extra a partir de un rango "HH:MM" a "HH:MM".
// Si el rango cruza el mediodía, se resta 1 hora de almuerzo (no se paga).
function calcularHorasRango(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return 0;
  const [h1, m1] = horaInicio.split(":").map(Number);
  const [h2, m2] = horaFin.split(":").map(Number);
  const inicio = h1 + m1 / 60;
  let fin = h2 + m2 / 60;
  if (fin <= inicio) fin += 24; // por si el rango cruza medianoche
  let total = fin - inicio;
  if (inicio < 12 && fin > 12) total -= 1; // hora de almuerzo, no se paga
  return Math.max(0, Math.round(total * 100) / 100);
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString("en-US");

function LogoUploadButton({ small }) {
  const { setLogo } = useContext(LogoContext);
  const inputRef = React.useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      <button
        onClick={() => inputRef.current?.click()}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "transparent",
          border: `1px dashed rgba(255,255,255,0.35)`, color: "#fff", opacity: 0.85,
          cursor: "pointer", fontSize: small ? 11 : 12.5, padding: small ? "4px 8px" : "6px 10px",
          borderRadius: 7,
        }}
      >
        <Upload size={12} /> {small ? "Cambiar logo" : "Subir logo"}
      </button>
    </>
  );
}

const AREAS = [
  { id: "inspecciones", label: "Inspecciones", icon: ClipboardList, color: T.steel },
  { id: "proyectos", label: "Proyectos", icon: HardHat, color: T.green },
  { id: "cotizaciones", label: "Cotizaciones", icon: FileText, color: T.amber },
  { id: "salud", label: "Salud Ocupacional", icon: CalendarDays, color: T.red },
  { id: "apertura", label: "Apertura de OD", icon: Building2, color: T.blue },
  { id: "calendario_global", label: "Calendario General", icon: CalendarDays, color: T.accent },
  { id: "facturacion_publica", label: "Facturación", icon: LayoutDashboard, color: T.green },
  { id: "planilla", label: "Planilla", icon: Wallet, color: T.amber },
  { id: "admin", label: "Administrativo", icon: LayoutDashboard, color: T.steelSoft },
];

// Categorías de usuario disponibles para Gestión de Usuarios (solo Admin las crea)
const CATEGORIAS_USUARIO = [
  { id: "admin", label: "Admin" },
  { id: "asistente", label: "Asistente" },
  { id: "tecnico", label: "Técnico" },
];

// Los usuarios ya NO viven aquí: se guardan en Supabase (tabla "usuarios").
// Los usuarios iniciales de la demo se insertan al correr supabase/schema.sql.

const CURSO_TIPOS = [
  "Básico de Ingreso", "Alturas", "Trabajo en Caliente", "Espacio Confinado",
  "Bloqueo y Etiquetado", "Manejo de Residuos", "Derrames y Fugas",
  "Uso de EPP", "Equipos de Elevación", "Curso de Andamios",
];

const SEMAFORO = {
  Pendiente: T.blue,
  Coordinado: T.amber,
  Cancelado: "#4B5563",
  Realizado: T.green,
  Vencido: T.red,
};

// El estado "Vencido" se calcula automáticamente: si el curso no está
// Cancelado ni Realizado y su fecha de vencimiento ya pasó, se muestra
// como Vencido (rojo) sin que nadie tenga que cambiarlo manualmente.
function estadoEfectivoCurso(r) {
  if (r.estado === "Cancelado") return r.estado;
  const venc = vencimientoCalculado(r.fecha);
  if (venc && venc < todayISO()) return "Vencido";
  return r.estado;
}

// El vencimiento de un curso EHS es dinámico: vence exactamente 1 año
// después de la fecha en que se realizó/coordinó. Al "renovar" (cambiar
// la fecha del curso), el vencimiento y el estado Vencido se recalculan solos.
function vencimientoCalculado(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha + "T00:00:00");
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// Estado efectivo de una OD (Inspecciones/Proyectos): si el registro está
// "Activo" y la fecha de control (vencimiento en Inspecciones, o fecha de
// entrega en Proyectos) ya pasó, se muestra automáticamente como "Vencido"
// (rojo) sin que nadie tenga que cambiarlo a mano. "No Activo" y
// "Entregado" no se ven afectados por esta regla.
function estadoEfectivoOD(r, campoFecha) {
  const fecha = r[campoFecha];
  if (r.estado === "Activo" && fecha && fecha < todayISO()) return "Vencido";
  return r.estado;
}

/* ---------------------------------------------------------
   SEED DATA
   --------------------------------------------------------- */
const FRECUENCIA_OPCIONES = ["Semanal", "Mensual", "Bimensual", "Trimestral", "Cuatrimestral", "Semestral", "Anual"];

// Normaliza un valor de frecuencia importado desde Excel (espacios de más,
// mayúsculas distintas, etc.) para que coincida exactamente con una de las
// opciones válidas — si no, el desplegable de edición del admin se vería
// vacío aunque el asistente sí viera el texto tal cual.
function normalizarFrecuencia(valor) {
  if (!valor) return "";
  const limpio = String(valor).trim();
  const encontrada = FRECUENCIA_OPCIONES.find((f) => f.toLowerCase() === limpio.toLowerCase());
  return encontrada || limpio;
}

const seedClientes = (area) => ([
  { id: uid(), od: "OD-1001", cliente: "Grupo Andina S.A.", estado: "Activo", tecnico: "J. Solano", vencimiento: "", frecuencia: "Semestral", fechaInicio: "", fechaEntrega: "", accion: "", area },
  { id: uid(), od: "OD-1002", cliente: "Portuaria del Golfo", estado: "Activo", tecnico: "M. Rojas", vencimiento: "", frecuencia: "Anual", fechaInicio: "", fechaEntrega: "", accion: "", area },
  { id: uid(), od: "OD-1003", cliente: "Textiles Norte", estado: "No Activo", tecnico: "J. Solano", vencimiento: "", frecuencia: "Trimestral", fechaInicio: "", fechaEntrega: "", accion: "Cliente en revisión de contrato", area },
]);

const seedHoras = (area) => ([
  { id: uid(), fecha: todayISO(), od: "OD-1001", personal: "J. Solano, M. Rojas", horas: 4, estado: "Aprobada", area },
  { id: uid(), fecha: todayISO(), od: "OD-1002", personal: "M. Rojas", horas: 2, estado: "Pendiente", area },
]);

const seedEventos = (area) => ([
  { id: uid(), tipo: area === "proyectos" ? "Proyecto" : "Inspección", od: "OD-1001", personas: "J. Solano", fecha: todayISO(), area },
]);

const seedCotizaciones = ([
  { id: uid(), consecutivo: "00001", solicitante: "J. Solano", cliente: "Grupo Andina S.A.", contacto: "R. Méndez", email: "compras@andina.com", telefono: "8888-1111", provincia: "San José", dias: 5, personal: "2 técnicos", descripcion: "Montaje de andamio Layher para mantenimiento de fachada.", equipos: "2x Andamio / Layher / Layher 3000", dispositivos: "Materiales de anclaje, detector de gases", numCot: "COT-0451", estado: "Enviada" },
  { id: uid(), consecutivo: "00002", solicitante: "M. Rojas", cliente: "Portuaria del Golfo", contacto: "L. Araya", email: "gerencia@golfo.com", telefono: "8888-2222", provincia: "Puntarenas", dias: 12, personal: "4 técnicos, 1 supervisor", descripcion: "Izaje de equipo pesado en muelle de carga.", equipos: "1x Grúa telescópica / Terex / AC55", dispositivos: "Equipos de izaje, materiales de rigging", numCot: "", estado: "Abierto" },
]);

const seedCursos = ([
  { id: uid(), solicitante: "J. Solano", personal: "M. Rojas, A. Vargas", lugar: "Planta Grupo Andina", tipo: "Alturas", estado: "Coordinado", fecha: todayISO() },
  { id: uid(), solicitante: "M. Rojas", personal: "J. Solano", lugar: "Sede Central", tipo: "Espacio Confinado", estado: "Pendiente", fecha: "" },
  { id: uid(), solicitante: "A. Vargas", personal: "J. Solano, M. Rojas", lugar: "Portuaria del Golfo", tipo: "Uso de EPP", estado: "Coordinado", fecha: "2025-06-10" },
]);

const seedFacturacion = ([
  { mes: "Ene", monto: 98000 }, { mes: "Feb", monto: 105000 }, { mes: "Mar", monto: 121000 },
  { mes: "Abr", monto: 134000 }, { mes: "May", monto: 112000 }, { mes: "Jun", monto: 128000 },
]);

/* ---------------------------------------------------------
   HELPERS UI
   --------------------------------------------------------- */
function Badge({ children, color, soft }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
      borderRadius: 999, fontSize: 12, fontWeight: 600, color, background: soft,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Dot({ color }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", boxShadow: `0 0 0 3px ${color}22` }} />;
}

function Card({ title, action, children, style }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          {title && <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: -0.2 }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", small, style, disabled }) {
  const variants = {
    primary: { background: T.steel, color: "#fff", border: "none" },
    accent: { background: T.accent, color: "#fff", border: "none" },
    ghost: { background: "transparent", color: T.steel, border: `1px solid ${T.line}` },
    danger: { background: T.redSoft, color: T.red, border: "none" },
    success: { background: T.greenSoft, color: T.green, border: "none" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        padding: small ? "6px 10px" : "9px 16px", borderRadius: 9, fontSize: small ? 12.5 : 13.5,
        fontWeight: 600, transition: "filter .15s", ...variants[variant], ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.94)")}
      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
    >{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: T.inkSoft, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13.5,
  color: T.ink, fontFamily: "inherit", outline: "none", background: "#fff",
};

function exportExcel(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, filename);
}

/* ---------------------------------------------------------
   REPORTE 2 (Planilla): "Formulario de Solicitud de Horas Extras"
   Usa tu Excel real (public/plantilla-horas-extra.xlsx) como base,
   pero en vez de reconstruirlo con una librería (lo cual descarta
   checkboxes/controles de formulario que no soportan), se edita
   directamente el XML interno del archivo: se localizan las celdas
   ya existentes en la plantilla y solo se les cambia el valor, sin
   tocar nada más (bordes, combinadas, colores, fórmulas, checkboxes).
   Se agrupa por OD y por quincena (1-15 / 16-fin de mes); si dentro
   de una quincena hay solicitudes en más de una semana, se descarga
   un archivo por cada semana. Solo toma solicitudes Aprobadas.
   --------------------------------------------------------- */
const REPORTE2_DIAS_COL = ["H", "I", "J", "K", "L", "M", "N"];
const REPORTE2_HOJA = "xl/worksheets/sheet1.xml";
const REPORTE2_WORKBOOK = "xl/workbook.xml";
const REPORTE2_MAX_FILAS = 8; // filas 26-33 ya definidas en la plantilla

// Lunes (00:00) de la semana ISO a la que pertenece una fecha "YYYY-MM-DD".
function reporte2LunesDeSemana(fechaISO) {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d;
}

// "2026-06-Q1" (días 1-15) o "2026-06-Q2" (16-fin de mes)
function reporte2Quincena(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const q = dia <= 15 ? "Q1" : "Q2";
  return `${anio}-${String(mes).padStart(2, "0")}-${q}`;
}

function reporte2NombreQuincena(clave) {
  const [anio, mes, q] = clave.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const nombreMes = meses[Number(mes) - 1];
  return q === "Q1" ? `1-15${nombreMes}${anio}` : `16-fin${nombreMes}${anio}`;
}

function reporte2FechaASerial(fecha) {
  const base = Date.UTC(1899, 11, 30);
  return Math.round((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - base) / 86400000);
}

function reporte2EscaparXML(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Reemplaza el valor de UNA celda ya existente en el XML de la hoja,
// conservando sus demás atributos (estilo, etc.) intactos. Si la celda
// no existe en la plantilla, no hace nada (no se crean celdas nuevas).
function reporte2SetCeldaXML(xml, addr, { texto, numero }) {
  const patronVacia = new RegExp(`<c r="${addr}"([^>]*)/>`);
  const patronConValor = new RegExp(`<c r="${addr}"([^>]*)>.*?</c>`, "s");

  let match = xml.match(patronVacia);
  let esVacia = true;
  if (!match) { match = xml.match(patronConValor); esVacia = false; }
  if (!match) return xml;

  let atributos = match[1].replace(/\st="[^"]*"/, "");
  let tAttr = "";
  let contenido;
  if (texto !== undefined) {
    tAttr = ` t="inlineStr"`;
    contenido = `<is><t xml:space="preserve">${reporte2EscaparXML(texto)}</t></is>`;
  } else {
    contenido = `<v>${numero}</v>`;
  }
  const nuevaCelda = `<c r="${addr}"${atributos}${tAttr}>${contenido}</c>`;
  return esVacia ? xml.replace(patronVacia, nuevaCelda) : xml.replace(patronConValor, nuevaCelda);
}

// Llena una copia (una semana) de la plantilla real para un OD,
// editando solo el XML de la hoja, y devuelve el buffer final del .xlsx.
async function reporte2LlenarPlantilla(plantillaBuffer, od, cliente, entradasSemana, lunes, empleadosPorCodigo) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(plantillaBuffer);
  let xml = await zip.file(REPORTE2_HOJA).async("string");

  xml = reporte2SetCeldaXML(xml, "E14", { texto: "" });
  xml = reporte2SetCeldaXML(xml, "E15", { numero: reporte2FechaASerial(new Date()) });
  xml = reporte2SetCeldaXML(xml, "E16", { texto: cliente || "" });
  xml = reporte2SetCeldaXML(xml, "E17", { texto: od });

  REPORTE2_DIAS_COL.forEach((col, i) => {
    const d = new Date(lunes);
    d.setDate(d.getDate() + i);
    xml = reporte2SetCeldaXML(xml, `${col}25`, { numero: reporte2FechaASerial(d) });
  });

  // La plantilla trae 8 filas de personal (26-33). Si hay más solicitudes
  // que filas, se toman solo las primeras 8 (limitación conocida).
  entradasSemana.slice(0, REPORTE2_MAX_FILAS).forEach((s, idx) => {
    const filaActual = 26 + idx;
    const emp = empleadosPorCodigo[s.personal_codigos?.[0]];
    xml = reporte2SetCeldaXML(xml, `C${filaActual}`, { texto: emp?.nombre || s.personal || "" });
    xml = reporte2SetCeldaXML(xml, `E${filaActual}`, { texto: emp?.puesto || "" });
    xml = reporte2SetCeldaXML(xml, `F${filaActual}`, { texto: s.hora_inicio || "" });
    xml = reporte2SetCeldaXML(xml, `G${filaActual}`, { texto: s.hora_fin || "" });
    const fechaRef = s.fecha_ejecucion || s.fecha;
    if (fechaRef) {
      const diaSemana = (new Date(fechaRef + "T00:00:00").getDay() + 6) % 7;
      xml = reporte2SetCeldaXML(xml, `${REPORTE2_DIAS_COL[diaSemana]}${filaActual}`, { numero: Number(s.horas) || 0 });
    }
  });

  const personasUnicas = new Set(entradasSemana.map((s) => s.personal_codigos?.[0] || s.personal));
  xml = reporte2SetCeldaXML(xml, "E35", { numero: personasUnicas.size });

  zip.file(REPORTE2_HOJA, xml);

  // Fuerza a Excel a recalcular TODAS las fórmulas al abrir el archivo
  // (por defecto, Excel confía en el valor guardado en caché de cada
  // fórmula, y como aquí solo cambiamos los valores de entrada por fuera
  // de Excel, esa caché queda desactualizada sin esta bandera).
  const wbXmlFile = zip.file(REPORTE2_WORKBOOK);
  if (wbXmlFile) {
    let wbXml = await wbXmlFile.async("string");
    if (/<calcPr[^/]*fullCalcOnLoad=/.test(wbXml)) {
      wbXml = wbXml.replace(/fullCalcOnLoad="[^"]*"/, 'fullCalcOnLoad="1"');
    } else if (/<calcPr[^/]*\/>/.test(wbXml)) {
      wbXml = wbXml.replace(/<calcPr([^/]*)\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
    }
    zip.file(REPORTE2_WORKBOOK, wbXml);
  }

  return zip.generateAsync({ type: "arraybuffer" });
}

function reporte2Descargar_disparar(buffer, nombreArchivo) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Junta las solicitudes de horas extra Aprobadas de UN área,
// agrupadas por OD + quincena (y por semana dentro de la quincena, ya
// que la plantilla es semanal), y descarga un archivo por cada grupo.
async function reporte2Descargar(area) {
  const { data: horas } = await supabase.from("horas_extras").select("*").eq("area", area).eq("estado", "Aprobada");
  const { data: emps } = await supabase.from("empleados").select("*");
  const { data: ods } = await supabase.from("ordenes_trabajo").select("*").eq("area", area);

  const empleadosPorCodigo = {};
  (emps || []).forEach((e) => { empleadosPorCodigo[e.codigo] = e; });
  const clientePorOd = {};
  (ods || []).forEach((o) => { clientePorOd[o.od] = o.cliente; });

  // od -> quincena -> semana(lunes ISO) -> [entradas]
  const grupos = {};
  (horas || []).forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef || !h.od) return;
    const quincena = reporte2Quincena(fechaRef);
    const lunes = reporte2LunesDeSemana(fechaRef).toISOString().slice(0, 10);
    grupos[h.od] = grupos[h.od] || {};
    grupos[h.od][quincena] = grupos[h.od][quincena] || {};
    (grupos[h.od][quincena][lunes] = grupos[h.od][quincena][lunes] || []).push(h);
  });

  const odsConDatos = Object.keys(grupos);
  const nombreArea = area === "inspecciones" ? "Inspecciones" : "Proyectos";
  if (odsConDatos.length === 0) {
    alert(`Todavía no hay solicitudes de horas extra aprobadas registradas en ${nombreArea}.`);
    return;
  }

  let plantillaBuffer;
  try {
    const resp = await fetch("/plantilla-horas-extra.xlsx");
    if (!resp.ok) throw new Error(`No se encontró la plantilla (HTTP ${resp.status}). Verifica que "plantilla-horas-extra.xlsx" esté en la carpeta public/ de tu proyecto.`);
    plantillaBuffer = await resp.arrayBuffer();
  } catch (err) {
    alert("No se pudo generar el Reporte: " + (err.message || "error desconocido al cargar la plantilla."));
    return;
  }

  try {
    for (const od of odsConDatos) {
      for (const quincena of Object.keys(grupos[od])) {
        const semanas = Object.keys(grupos[od][quincena]).sort();
        for (const lunesISO of semanas) {
          const entradasSemana = grupos[od][quincena][lunesISO];
          const buffer = await reporte2LlenarPlantilla(
            plantillaBuffer, od, clientePorOd[od], entradasSemana, new Date(lunesISO + "T00:00:00"), empleadosPorCodigo
          );
          const sufijoSemana = semanas.length > 1 ? `_semana-${lunesISO}` : "";
          const nombreOd = String(od).replace(/[^a-zA-Z0-9-]/g, "");
          const nombreArchivo = `SolicitudHoras_${nombreArea}_${nombreOd}_${reporte2NombreQuincena(quincena)}${sufijoSemana}.xlsx`;
          reporte2Descargar_disparar(buffer, nombreArchivo);
        }
      }
    }
  } catch (err) {
    alert("No se pudo generar el Reporte: " + (err.message || "error desconocido al armar el Excel."));
  }
}

// Normaliza un valor de fecha proveniente de un Excel importado (puede llegar
// como objeto Date, número serial de Excel, o texto en varios formatos) a
// una cadena "YYYY-MM-DD" compatible con <input type="date">.
function excelValueToISODate(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !isNaN(value)) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF?.parse_date_code?.(value);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return d.toISOString().slice(0, 10);
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parts = trimmed.split(/[\/\-.]/);
    if (parts.length === 3) {
      let [a, b, c] = parts;
      if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`; // YYYY-MM-DD
      let [d, m, y] = [a, b, c]; // asumimos DD/MM/YYYY
      if (y.length === 2) y = "20" + y;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate)) return parsedDate.toISOString().slice(0, 10);
  }
  return "";
}

// Convierte una fila de la tabla "ordenes_trabajo" de Supabase (snake_case)
// al formato que usa la app (camelCase), y viceversa.
function odRowFromDb(r) {
  return {
    id: r.id,
    od: r.od || "",
    cliente: r.cliente || "",
    estado: r.estado || "Activo",
    tecnico: r.tecnico || "",
    vencimiento: r.vencimiento || "",
    frecuencia: r.frecuencia || "",
    fechaInicio: r.fecha_inicio || "",
    fechaEntrega: r.fecha_entrega || "",
    fechaAprobacion: r.fecha_aprobacion || "",
    accion: r.accion || "",
    tipoOD: r.tipo_od || "Normal",
    progreso: r.progreso || "Pendiente",
    facturado: r.facturado || "Sin facturar",
    area: r.area,
    created_at: r.created_at,
  };
}
const ODFIELD_TO_DB = { fechaInicio: "fecha_inicio", fechaEntrega: "fecha_entrega", fechaAprobacion: "fecha_aprobacion", tipoOD: "tipo_od" };
function odPatchToDb(patch) {
  const out = {};
  for (const k in patch) out[ODFIELD_TO_DB[k] || k] = patch[k] === "" ? null : patch[k];
  return out;
}

function cotRowFromDb(r) {
  return {
    id: r.id,
    consecutivo: String(r.numero).padStart(5, "0"),
    solicitante: r.solicitante || "",
    cliente: r.cliente || "",
    contacto: r.contacto || "",
    email: r.email || "",
    telefono: r.telefono || "",
    provincia: r.provincia || "",
    dias: r.dias || "",
    personal: r.personal || "",
    descripcion: r.descripcion || "",
    equipos: r.equipos || "",
    dispositivos: r.dispositivos || "",
    numCot: r.num_cot || "",
    estado: r.estado || "Solicitud",
    actividad: r.actividad || "Seguimiento",
    tipo: r.tipo || "Inspecciones",
    frecuencia: r.frecuencia || "",
    observaciones: r.observaciones || "",
  };
}

/* ---------------------------------------------------------
   LOGIN
   --------------------------------------------------------- */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { logo } = useContext(LogoContext);

  const submit = async () => {
    if (!email.trim() || pin.length < 4) { setError("Ingresa correo y contraseña (mínimo 4 caracteres)."); return; }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.rpc("login_usuario", {
      p_email: email.trim(),
      p_pin: pin,
    });
    setLoading(false);
    if (err) { setError("No se pudo conectar. Intenta de nuevo."); return; }
    if (!data || data.length === 0) { setError("Email o PIN incorrecto."); return; }
    onLogin(data[0]);
  };

  return (
    <div style={{
      minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${T.steel} 0%, #0E1B2E 100%)`, padding: 20,
      position: "relative", overflow: "hidden",
    }}>
      <Flame size={380} color="#fff" style={{ position: "absolute", opacity: 0.09, right: "5%", top: "48%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <div style={{ width: 360, background: T.panel, borderRadius: 16, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,.3)", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: logo ? "transparent" : `linear-gradient(135deg, ${T.accent}, #C2410C)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {logo ? <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Flame size={22} color="#fff" />}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: T.ink, letterSpacing: -0.3, lineHeight: 1.15 }}>Departamento A&D Salvavidas</div>
            <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, letterSpacing: 0.3 }}>SISTEMAS DE ALARMA Y DETECCIÓN DE INCENDIOS</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 24, marginTop: 6 }}>Inspecciones · Proyectos · Cotizaciones · EHS</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Correo electrónico">
            <input style={inputStyle} type="email" placeholder="usuario@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input style={inputStyle} type="password" placeholder="••••••••" value={pin}
              onChange={(e) => setPin(e.target.value)} />
          </Field>
          {error && <div style={{ color: T.red, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={14} />{error}</div>}
          <Btn onClick={submit} variant="accent" disabled={loading} style={{ justifyContent: "center", marginTop: 6 }}>{loading ? "Ingresando..." : "Ingresar"}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MODULO: HORAS EXTRAS
   --------------------------------------------------------- */
function HorasExtras({ area, color }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canCerrar = isAdmin || currentUser?.categoria === "asistente";
  const canBorrar = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const [disponible, setDisponibleState] = useState(150);
  const [rows, setRows] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState({ od: "", personalCodigo: "", horaInicio: "07:00", horaFin: "15:00", fechaEjecucion: "" });
  const [subTab, setSubTab] = useState("solicitud");
  const used = rows.reduce((s, r) => s + ((r.estado === "Pendiente" || r.estado === "Aprobada") ? Number(r.horas) : 0), 0);
  const saldo = disponible - used;
  const horasCalculadas = calcularHorasRango(form.horaInicio, form.horaFin);

  useEffect(() => {
    (async () => {
      const { data: filas } = await supabase.from("horas_extras").select("*").eq("area", area).order("created_at", { ascending: false });
      if (filas) setRows(filas);
      const { data: config } = await supabase.from("horas_disponible").select("*").eq("area", area).single();
      if (config) setDisponibleState(Number(config.disponible));
      const { data: personal } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
      if (personal) setEmpleados(personal);
    })();
  }, [area]);

  const setDisponible = (valor) => {
    setDisponibleState(valor);
    supabase.from("horas_disponible").upsert({ area, disponible: valor }).then();
  };

  const add = async () => {
    const horas = calcularHorasRango(form.horaInicio, form.horaFin);
    if (!form.od || !form.personalCodigo || !horas) return;
    const empleado = empleados.find((e) => e.codigo === form.personalCodigo);
    const payload = {
      area, fecha: todayISO(), fecha_ejecucion: form.fechaEjecucion || null, od: form.od,
      personal: empleado?.nombre || "", personal_codigos: [form.personalCodigo],
      hora_inicio: form.horaInicio, hora_fin: form.horaFin, horas, estado: "Pendiente",
    };
    setForm({ od: "", personalCodigo: "", horaInicio: "07:00", horaFin: "15:00", fechaEjecucion: "" });
    const { data, error } = await supabase.from("horas_extras").insert(payload).select().single();
    if (!error && data) setRows((prev) => [data, ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    supabase.from("horas_extras").update({ estado }).eq("id", id).then();
  };
  const setOd = (id, od) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, od } : r)));
    supabase.from("horas_extras").update({ od }).eq("id", id).then();
  };
  const setRango = (id, horaInicio, horaFin) => {
    const horas = calcularHorasRango(horaInicio, horaFin);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, hora_inicio: horaInicio, hora_fin: horaFin, horas } : r)));
    supabase.from("horas_extras").update({ hora_inicio: horaInicio, hora_fin: horaFin, horas }).eq("id", id).then();
  };
  const setPersonalCodigo = (id, codigo) => {
    const empleado = empleados.find((e) => e.codigo === codigo);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, personal: empleado?.nombre || "", personal_codigos: [codigo] } : r)));
    supabase.from("horas_extras").update({ personal: empleado?.nombre || "", personal_codigos: [codigo] }).eq("id", id).then();
  };
  const setFechaEjecucion = (id, fecha_ejecucion) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, fecha_ejecucion } : r)));
    supabase.from("horas_extras").update({ fecha_ejecucion: fecha_ejecucion || null }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta solicitud de horas extra? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("horas_extras").delete().eq("id", id).then();
  };
  const vaciarPestana = async (estadoObjetivo, etiqueta) => {
    const idsAEliminar = rows.filter((r) => r.estado === estadoObjetivo).map((r) => r.id);
    if (idsAEliminar.length === 0) return;
    if (!(await confirmar(`¿Está seguro que desea eliminar las ${idsAEliminar.length} solicitudes de "${etiqueta}"? Esta acción no se puede deshacer.`))) return;
    setRows((prev) => prev.filter((r) => r.estado !== estadoObjetivo));
    idsAEliminar.forEach((id) => supabase.from("horas_extras").delete().eq("id", id).then());
  };

  const rowsSolicitud = rows.filter((r) => r.estado === "Pendiente" || r.estado === "Aprobada");
  const rowsDenegadas = rows.filter((r) => r.estado === "Rechazada");
  const rowsCerradas = rows.filter((r) => r.estado === "Cerrada");
  const rowsMostradas = subTab === "solicitud" ? rowsSolicitud : subTab === "denegadas" ? rowsDenegadas : rowsCerradas;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Disponible quincenal">
          <div style={{ fontSize: 30, fontWeight: 800, color }}>{saldo}h</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>de {disponible}h asignadas · {used}h usadas</div>
          <div style={{ height: 8, background: T.graySoft, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${Math.min(100, (used / disponible) * 100)}%`, background: used > disponible ? T.red : color }} />
          </div>
          {isAdmin ? (
            <Field label="Editar disponible (solo Administrativo)">
              <input style={inputStyle} type="number" value={disponible} onChange={(e) => setDisponible(Number(e.target.value))} />
            </Field>
          ) : (
            <div style={{ fontSize: 11.5, color: T.gray }}>Solo un usuario Administrativo puede modificar el disponible.</div>
          )}
        </Card>
        <Card title="Nueva solicitud">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="OD del proyecto"><input style={inputStyle} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} placeholder="OD-1004" /></Field>
            <Field label="Persona que solicita">
              {empleados.length === 0 ? (
                <div style={{ fontSize: 11.5, color: T.gray }}>Aún no hay personal cargado. Agrégalo desde Planilla.</div>
              ) : (
                <select style={inputStyle} value={form.personalCodigo} onChange={(e) => setForm({ ...form, personalCodigo: e.target.value })}>
                  <option value="">Selecciona una persona…</option>
                  {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
                </select>
              )}
              <div style={{ fontSize: 10.5, color: T.gray, marginTop: 4 }}>Esta lista se administra desde Planilla.</div>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Desde"><input style={inputStyle} type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></Field>
              <Field label="Hasta"><input style={inputStyle} type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></Field>
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              Total: <strong style={{ color: T.ink }}>{horasCalculadas}h</strong>
              {form.horaInicio && form.horaFin && (Number(form.horaInicio.split(":")[0]) < 12 && Number(form.horaFin.split(":")[0]) >= 12) && (
                <span> (ya se restó 1h de almuerzo)</span>
              )}
            </div>
            <Field label="Fecha en que se ejecutarán"><input style={inputStyle} type="date" value={form.fechaEjecucion} onChange={(e) => setForm({ ...form, fechaEjecucion: e.target.value })} /></Field>
            <Btn onClick={add} variant="accent" style={{ justifyContent: "center" }} disabled={!horasCalculadas || !form.personalCodigo}><Plus size={14} /> Solicitar</Btn>
          </div>
        </Card>
      </div>

      <Card title="Solicitudes" action={<Btn small variant="ghost" onClick={() => exportExcel(rowsMostradas.map(({ fecha, fecha_ejecucion, od, personal, hora_inicio, hora_fin, horas, estado }) => ({ Fecha: fecha, "Fecha Ejecución": fecha_ejecucion, OD: od, Personal: personal, "Hora Inicio": hora_inicio, "Hora Fin": hora_fin, Horas: horas, Estado: estado })), `horas_${area}.xlsx`)}><Download size={13} /> Excel</Btn>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small variant={subTab === "solicitud" ? "accent" : "ghost"} onClick={() => setSubTab("solicitud")}>Solicitud ({rowsSolicitud.length})</Btn>
          <Btn small variant={subTab === "denegadas" ? "accent" : "ghost"} onClick={() => setSubTab("denegadas")}>Denegadas ({rowsDenegadas.length})</Btn>
          <Btn small variant={subTab === "cerradas" ? "accent" : "ghost"} onClick={() => setSubTab("cerradas")}>Cerradas ({rowsCerradas.length})</Btn>
          {isAdmin && subTab === "denegadas" && rowsDenegadas.length > 0 && (
            <Btn small variant="danger" onClick={() => vaciarPestana("Rechazada", "Denegadas")}><X size={12} /> Eliminar Denegadas</Btn>
          )}
          {isAdmin && subTab === "cerradas" && rowsCerradas.length > 0 && (
            <Btn small variant="danger" onClick={() => vaciarPestana("Cerrada", "Cerradas")}><X size={12} /> Eliminar Cerradas</Btn>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Fecha</th><th>Fecha ejecución</th><th>OD</th><th>Personal</th><th>Rango</th><th>Horas</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rowsMostradas.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px" }}>{r.fecha}</td>
                <td>
                  {isAdmin ? (
                    <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fecha_ejecucion || ""} onChange={(e) => setFechaEjecucion(r.id, e.target.value)} />
                  ) : (r.fecha_ejecucion || "—")}
                </td>
                <td>
                  {isAdmin ? (
                    <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} value={r.od} onChange={(e) => setOd(r.id, e.target.value)} />
                  ) : (r.od)}
                </td>
                <td>
                  {isAdmin ? (
                    <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 150 }} value={r.personal_codigos?.[0] || ""} onChange={(e) => setPersonalCodigo(r.id, e.target.value)}>
                      <option value="">Selecciona…</option>
                      {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
                    </select>
                  ) : (r.personal || "—")}
                </td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {isAdmin ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input type="time" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 90 }} value={r.hora_inicio || ""} onChange={(e) => setRango(r.id, e.target.value, r.hora_fin)} />
                      <span>–</span>
                      <input type="time" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 90 }} value={r.hora_fin || ""} onChange={(e) => setRango(r.id, r.hora_inicio, e.target.value)} />
                    </div>
                  ) : (r.hora_inicio && r.hora_fin ? `${r.hora_inicio} – ${r.hora_fin}` : "—")}
                </td>
                <td>{r.horas}h</td>
                <td>
                  {isAdmin ? (
                    <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: r.estado === "Aprobada" ? T.greenSoft : r.estado === "Rechazada" ? T.redSoft : r.estado === "Cerrada" ? T.graySoft : T.amberSoft, color: r.estado === "Aprobada" ? T.green : r.estado === "Rechazada" ? T.red : r.estado === "Cerrada" ? T.steel : T.amber, borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {["Pendiente", "Aprobada", "Rechazada", "Cerrada"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <Badge color={r.estado === "Aprobada" ? T.green : r.estado === "Rechazada" ? T.red : r.estado === "Cerrada" ? T.steel : T.amber} soft={r.estado === "Aprobada" ? T.greenSoft : r.estado === "Rechazada" ? T.redSoft : r.estado === "Cerrada" ? T.graySoft : T.amberSoft}>{r.estado}</Badge>
                      {canCerrar && r.estado === "Aprobada" && (
                        <Btn small variant="ghost" onClick={() => setEstado(r.id, "Cerrada")}>Cerrar</Btn>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ display: "flex", gap: 6, padding: "9px 8px" }}>
                  {isAdmin && r.estado === "Pendiente" && <>
                    <Btn small variant="success" onClick={() => setEstado(r.id, "Aprobada")}><Check size={12} /></Btn>
                    <Btn small variant="danger" onClick={() => setEstado(r.id, "Rechazada")}><X size={12} /></Btn>
                  </>}
                  {canBorrar && <Btn small variant="danger" onClick={() => del(r.id)} style={{ opacity: 0.7 }}>Borrar</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 12.5, color: T.inkSoft, textAlign: "right", fontWeight: 700 }}>
          Total horas (esta pestaña): {rowsMostradas.reduce((s, r) => s + Number(r.horas || 0), 0)}h
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   MODULO: OD / CLIENTES
   --------------------------------------------------------- */
/* Contexto compartido: datos reales de OD/clientes de Inspecciones y
   Proyectos, para que el dashboard Administrativo pueda reflejarlos. */
const ClientesContext = createContext(null);

function useClientesArea(area) {
  const { clientes, setClientes } = useContext(ClientesContext);
  const rows = clientes[area] || [];
  const setRows = (updater) => {
    setClientes((prev) => ({
      ...prev,
      [area]: typeof updater === "function" ? updater(prev[area] || []) : updater,
    }));
  };
  return [rows, setRows];
}

function OrdenesTrabajo({ area, color, tipoOD = "Normal" }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canEditFechas = isAdmin || currentUser?.categoria === "asistente";
  // La fecha de vencimiento (Inspecciones) y la fecha de entrega (Proyectos)
  // solo puede modificarlas un usuario Administrativo.
  const canEditFechaControl = isAdmin;
  const canEditEstado = isAdmin || currentUser?.categoria === "asistente";
  const canMoverTipo = isAdmin || currentUser?.categoria === "asistente";
  const canEditProgreso = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const isInspecciones = area === "inspecciones";
  const isProyectos = area === "proyectos";
  const esCorrectivo = tipoOD === "Correctivo";
  const tecnicoLabel = isProyectos ? "Encargado" : "Técnico";
  const [rowsTodas, setRows] = useClientesArea(area);
  const rows = useMemo(() => rowsTodas.filter((r) => (r.tipoOD || "Normal") === tipoOD), [rowsTodas, tipoOD]);
  const [form, setForm] = useState({ od: "", cliente: "", tecnico: "" });
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [subTabCorrectivo, setSubTabCorrectivo] = useState("Pendientes");
  const fileInputRef = React.useRef(null);

  const add = async () => {
    if (!form.od || !form.cliente) return;
    const payload = { area, od: form.od, cliente: form.cliente, estado: "Activo", tecnico: form.tecnico, accion: "", tipo_od: tipoOD, progreso: "Pendiente", facturado: "Sin facturar" };
    setForm({ od: "", cliente: "", tecnico: "" });
    const { data, error } = await supabase.from("ordenes_trabajo").insert(payload).select().single();
    if (!error && data) setRows((prev) => [odRowFromDb(data), ...prev]);
  };
  const setProgreso = (id, progreso) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, progreso } : r));
    supabase.from("ordenes_trabajo").update({ progreso }).eq("id", id).then();
  };
  const setFacturado = (id, facturado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, facturado } : r));
    supabase.from("ordenes_trabajo").update({ facturado }).eq("id", id).then();
  };
  const toggle = (id) => {
    if (!canEditEstado) return;
    const actual = rows.find((r) => r.id === id);
    const estado = actual?.estado === "Activo" ? "No Activo" : "Activo";
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("ordenes_trabajo").update({ estado }).eq("id", id).then();
  };
  const ESTADO_OD_COLOR = { "Activo": [T.green, T.greenSoft], "No Activo": [T.red, T.redSoft], "Entregado": [T.blue, T.blueSoft], "Vencido": [T.amber, T.amberSoft] };
  const campoFechaControl = isInspecciones ? "vencimiento" : "fechaEntrega";
  const setEstadoOD = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("ordenes_trabajo").update({ estado }).eq("id", id).then();
  };
  const setAccion = (id, accion) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, accion } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ accion })).eq("id", id).then();
  };
  const moverTipoOD = async (id, od, nuevoTipo) => {
    if (!(await confirmar(`¿Mover la OD ${od} a "${nuevoTipo === "Correctivo" ? "OD Correctivos" : "OD " + (isProyectos ? "Proyectos" : "IPM")}"?`, { confirmLabel: "Sí, mover", variant: "accent" }))) return;
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, tipoOD: nuevoTipo } : r));
    supabase.from("ordenes_trabajo").update({ tipo_od: nuevoTipo }).eq("id", id).then();
  };
  const setTecnico = (id, tecnico) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, tecnico } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ tecnico })).eq("id", id).then();
  };
  const setVencimiento = (id, vencimiento) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, vencimiento } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ vencimiento })).eq("id", id).then();
  };
  const setFechaAprobacion = (id, fechaAprobacion) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fechaAprobacion } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ fechaAprobacion })).eq("id", id).then();
  };
  const setFrecuencia = (id, frecuencia) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, frecuencia } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ frecuencia })).eq("id", id).then();
  };
  const setFechaInicio = (id, fechaInicio) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fechaInicio } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ fechaInicio })).eq("id", id).then();
  };
  const setFechaEntrega = (id, fechaEntrega) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fechaEntrega } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ fechaEntrega })).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta OD? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("ordenes_trabajo").delete().eq("id", id).then();
  };
  const eliminarTodos = async () => {
    if (rows.length === 0) return;
    if (!(await confirmar(`¿Está seguro que desea eliminar TODAS las ${rows.length} OD de esta área? Esta acción no se puede deshacer.`))) return;
    const idsAEliminar = rows.map((r) => r.id);
    setRows((prev) => prev.filter((r) => !idsAEliminar.includes(r.id)));
    idsAEliminar.forEach((id) => supabase.from("ordenes_trabajo").delete().eq("id", id).then());
  };

  // Importar Excel manteniendo el mismo formato usado en la exportación
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        const nuevas = json
          .map((row) => ({
            area,
            od: row["OD"] ?? row["od"] ?? "",
            cliente: row["Cliente"] ?? row["cliente"] ?? "",
            estado: row["Activo/No Activo"] ?? row["Estado"] ?? "Activo",
            tecnico: row[`${tecnicoLabel} asignado`] ?? row["Técnico asignado"] ?? row["Encargado"] ?? row["Tecnico"] ?? row["tecnico"] ?? "",
            vencimiento: excelValueToISODate(row["Fecha de Vencimiento"] ?? row["Vencimiento"] ?? "") || null,
            frecuencia: normalizarFrecuencia(row["Frecuencia"] ?? ""),
            fecha_inicio: excelValueToISODate(row["Fecha de Inicio"] ?? "") || null,
            fecha_entrega: excelValueToISODate(row["Fecha de Entrega"] ?? "") || null,
            accion: row["Acción"] ?? row["Accion"] ?? row["accion"] ?? "",
            tipo_od: tipoOD,
            progreso: "Pendiente",
            facturado: "Sin facturar",
          }))
          .filter((r) => r.od || r.cliente);
        if (nuevas.length === 0) return;
        const { data: inserted, error } = await supabase.from("ordenes_trabajo").insert(nuevas).select();
        if (!error && inserted) setRows((prev) => [...inserted.map(odRowFromDb), ...prev]);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const vencidos = rows.filter((r) => estadoEfectivoOD(r, campoFechaControl) === "Vencido").length;
  const activos = rows.filter((r) => r.estado === "Activo" && estadoEfectivoOD(r, campoFechaControl) !== "Vencido").length;
  const noActivos = rows.filter((r) => r.estado === "No Activo").length;
  const entregados = rows.filter((r) => r.estado === "Entregado").length;
  const pieData = isProyectos
    ? [{ name: "Activos", value: activos, fill: T.green }, { name: "No Activos", value: noActivos, fill: T.red }, { name: "Entregados", value: entregados, fill: T.blue }, { name: "Vencidos", value: vencidos, fill: T.amber }]
    : [{ name: "Activos", value: activos, fill: T.green }, { name: "No Activos", value: noActivos, fill: T.red }, { name: "Vencidos", value: vencidos, fill: T.amber }];

  const filteredRows = rows.filter((r) => {
    const texto = filtroTexto.trim().toLowerCase();
    const matchTexto = !texto
      || (r.od || "").toLowerCase().includes(texto)
      || (r.cliente || "").toLowerCase().includes(texto)
      || (r.tecnico || "").toLowerCase().includes(texto);
    const efectivoFiltro = estadoEfectivoOD(r, campoFechaControl);
    const matchEstado = filtroEstado === "Todos" || r.estado === filtroEstado || efectivoFiltro === filtroEstado;
    const matchProgreso = !esCorrectivo || (subTabCorrectivo === "Pendientes" ? (r.progreso || "Pendiente") !== "Completado" : (r.progreso || "Pendiente") === "Completado");
    return matchTexto && matchEstado && matchProgreso;
  }).sort((a, b) => {
    if (!esCorrectivo) return 0;
    // OD Correctivos: del más antiguo al más nuevo.
    return (a.created_at || "").localeCompare(b.created_at || "");
  });
  const estadoOpciones = isProyectos ? ["Todos", "Activo", "No Activo", "Entregado", "Vencido"] : ["Todos", "Activo", "No Activo", "Vencido"];
  const pendientesCorrectivoCount = rows.filter((r) => (r.progreso || "Pendiente") !== "Completado").length;
  const completadosCorrectivoCount = rows.filter((r) => (r.progreso || "Pendiente") === "Completado").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2.4fr 0.7fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title={esCorrectivo ? "OD Correctivos" : "Clientes / OD"} action={
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
            <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Importar Excel</Btn>
            <Btn small variant="ghost" onClick={() => exportExcel(rows.map(({ od, cliente, estado, tecnico, vencimiento, frecuencia, fechaInicio, fechaEntrega, accion }) => ({
              OD: od, Cliente: cliente, "Activo/No Activo": estado, [`${tecnicoLabel} asignado`]: tecnico,
              ...(isInspecciones ? { "Fecha de Vencimiento": vencimiento, Frecuencia: frecuencia } : {}),
              ...(isProyectos ? { "Fecha de Inicio": fechaInicio, "Fecha de Entrega": fechaEntrega } : {}),
              Acción: accion,
            })), `${esCorrectivo ? "od_correctivos" : "od"}_${area}.xlsx`)}><Download size={13} /> Excel</Btn>
            {isAdmin && <Btn small variant="danger" onClick={eliminarTodos}><X size={13} /> Eliminar todo</Btn>}
          </div>
        }>
          {esCorrectivo && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Btn small variant={subTabCorrectivo === "Pendientes" ? "accent" : "ghost"} onClick={() => setSubTabCorrectivo("Pendientes")}>Pendientes ({pendientesCorrectivoCount})</Btn>
              <Btn small variant={subTabCorrectivo === "Completados" ? "accent" : "ghost"} onClick={() => setSubTabCorrectivo("Completados")}>Completados ({completadosCorrectivoCount})</Btn>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder={`Buscar por OD, cliente o ${tecnicoLabel.toLowerCase()}...`}
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
            <select style={{ ...inputStyle, width: 150 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              {estadoOpciones.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "6px 8px" }}>OD</th><th style={{ minWidth: 190 }}>Cliente</th><th>Estado</th><th>{tecnicoLabel}</th>
                {esCorrectivo && <th>Fecha de Aprobación</th>}
                {!esCorrectivo && isInspecciones && <th>Fecha de Vencimiento</th>}
                {!esCorrectivo && isInspecciones && <th>Frecuencia</th>}
                {!esCorrectivo && isProyectos && <th>Fecha de Inicio</th>}
                {!esCorrectivo && isProyectos && <th>Fecha de Entrega</th>}
                <th>Acción</th>
                {esCorrectivo && <th>Progreso</th>}
                {esCorrectivo && <th>Facturado</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const efectivo = estadoEfectivoOD(r, campoFechaControl);
                const vencidoAuto = efectivo === "Vencido";
                return (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 8px", fontWeight: 600 }}>{r.od}</td>
                  <td>{r.cliente}</td>
                  <td>
                    {isProyectos ? (
                      vencidoAuto ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <Badge color={T.amber} soft={T.amberSoft}><Dot color={T.amber} /> Vencido</Badge>
                          {canEditEstado && (
                            <select value={r.estado} onChange={(e) => setEstadoOD(r.id, e.target.value)} style={{ border: "none", background: "transparent", color: T.gray, fontSize: 11, padding: "0 2px" }}>
                              {["Activo", "No Activo", "Entregado"].map((s) => <option key={s}>{s}</option>)}
                            </select>
                          )}
                        </div>
                      ) : canEditEstado ? (
                        <select
                          value={r.estado}
                          onChange={(e) => setEstadoOD(r.id, e.target.value)}
                          style={{ border: "none", background: (ESTADO_OD_COLOR[r.estado] || [T.gray, T.graySoft])[1], color: (ESTADO_OD_COLOR[r.estado] || [T.gray, T.graySoft])[0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}
                        >
                          {["Activo", "No Activo", "Entregado"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <Badge color={(ESTADO_OD_COLOR[r.estado] || [T.gray, T.graySoft])[0]} soft={(ESTADO_OD_COLOR[r.estado] || [T.gray, T.graySoft])[1]}>
                          <Dot color={(ESTADO_OD_COLOR[r.estado] || [T.gray, T.graySoft])[0]} />{r.estado}
                        </Badge>
                      )
                    ) : vencidoAuto ? (
                      <span onClick={() => toggle(r.id)} style={{ cursor: canEditEstado ? "pointer" : "default" }}>
                        <Badge color={T.amber} soft={T.amberSoft}><Dot color={T.amber} /> Vencido</Badge>
                      </span>
                    ) : (
                      <span onClick={() => toggle(r.id)} style={{ cursor: canEditEstado ? "pointer" : "default" }}>
                        <Badge color={r.estado === "Activo" ? T.green : T.red} soft={r.estado === "Activo" ? T.greenSoft : T.redSoft}><Dot color={r.estado === "Activo" ? T.green : T.red} />{r.estado}</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 110 }} value={r.tecnico} onChange={(e) => setTecnico(r.id, e.target.value)} />
                    ) : (r.tecnico || "—")}
                  </td>
                  {esCorrectivo && (
                    <td>
                      {canEditFechas ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fechaAprobacion || ""} onChange={(e) => setFechaAprobacion(r.id, e.target.value)} />
                      ) : (r.fechaAprobacion || "—")}
                    </td>
                  )}
                  {!esCorrectivo && isInspecciones && (
                    <td>
                      {canEditFechaControl ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.vencimiento || ""} onChange={(e) => setVencimiento(r.id, e.target.value)} />
                      ) : (r.vencimiento || "—")}
                    </td>
                  )}
                  {!esCorrectivo && isInspecciones && (
                    <td>
                      {isAdmin ? (
                        <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }} value={r.frecuencia || ""} onChange={(e) => setFrecuencia(r.id, e.target.value)}>
                          <option value="">—</option>
                          {FRECUENCIA_OPCIONES.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      ) : (r.frecuencia || "—")}
                    </td>
                  )}
                  {!esCorrectivo && isProyectos && (
                    <td>
                      {canEditFechas ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fechaInicio || ""} onChange={(e) => setFechaInicio(r.id, e.target.value)} />
                      ) : (r.fechaInicio || "—")}
                    </td>
                  )}
                  {!esCorrectivo && isProyectos && (
                    <td>
                      {canEditFechaControl ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fechaEntrega || ""} onChange={(e) => setFechaEntrega(r.id, e.target.value)} />
                      ) : (r.fechaEntrega || "—")}
                    </td>
                  )}
                  <td>
                    {isAdmin ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }} placeholder="Acción tomada..." value={r.accion} onChange={(e) => setAccion(r.id, e.target.value)} />
                    ) : <span style={{ color: T.gray, fontSize: 12 }}>{r.accion || "—"}</span>}
                  </td>
                  {esCorrectivo && (
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <Badge color={(r.progreso || "Pendiente") === "Completado" ? T.green : T.amber} soft={(r.progreso || "Pendiente") === "Completado" ? T.greenSoft : T.amberSoft}>
                          {r.progreso || "Pendiente"}
                        </Badge>
                        {canEditProgreso && (r.progreso || "Pendiente") !== "Completado" && (
                          <Btn small variant="ghost" onClick={() => setProgreso(r.id, "Completado")}>Marcar completado</Btn>
                        )}
                      </div>
                    </td>
                  )}
                  {esCorrectivo && (
                    <td>
                      {canEditEstado ? (
                        <select value={r.facturado || "Sin facturar"} onChange={(e) => setFacturado(r.id, e.target.value)} style={{ border: "none", background: (r.facturado === "Facturado") ? T.greenSoft : T.redSoft, color: (r.facturado === "Facturado") ? T.green : T.red, borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                          <option>Sin facturar</option>
                          <option>Facturado</option>
                        </select>
                      ) : (
                        <Badge color={r.facturado === "Facturado" ? T.green : T.red} soft={r.facturado === "Facturado" ? T.greenSoft : T.redSoft}>{r.facturado || "Sin facturar"}</Badge>
                      )}
                    </td>
                  )}
                  <td style={{ display: "flex", gap: 6 }}>
                    {canMoverTipo && (
                      <Btn small variant="ghost" onClick={() => moverTipoOD(r.id, r.od, esCorrectivo ? "Normal" : "Correctivo")} title={esCorrectivo ? `Mover a OD ${isProyectos ? "Proyectos" : "IPM"}` : "Mover a OD Correctivos"}>
                        {esCorrectivo ? `← ${isProyectos ? "Proyectos" : "IPM"}` : "→ Correctivo"}
                      </Btn>
                    )}
                    {isAdmin && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </Card>
        <Card title="Agregar cliente / OD">
          <div style={{ display: "flex", gap: 10 }}>
            <input style={inputStyle} placeholder="OD" value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} />
            <input style={{ ...inputStyle, flex: 1 }} placeholder="Cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
            <input style={inputStyle} placeholder={tecnicoLabel} value={form.tecnico} onChange={(e) => setForm({ ...form, tecnico: e.target.value })} />
            <Btn variant="accent" onClick={add}><Plus size={14} /></Btn>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Resumen">
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: T.greenSoft, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{activos}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>Activos</div>
            </div>
            <div style={{ flex: 1, background: T.redSoft, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.red }}>{noActivos}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>No Activos</div>
            </div>
            <div style={{ flex: 1, background: T.amberSoft, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.amber }}>{vencidos}</div>
              <div style={{ fontSize: 12, color: T.inkSoft }}>Vencidos</div>
            </div>
            {isProyectos && (
              <div style={{ flex: 1, background: T.blueSoft, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{entregados}</div>
                <div style={{ fontSize: 12, color: T.inkSoft }}>Entregados</div>
              </div>
            )}
          </div>
        </Card>
        <Card title="Distribución de cartera">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MODULO: CALENDARIO — vista de mes en cuadrícula (estilo
   Google Calendar mensual), con un color por OD.
   --------------------------------------------------------- */
const isoDate = (d) => d.toISOString().slice(0, 10);

// Primer día (domingo) de la cuadrícula del mes que contiene "d".
function startOfMonthGrid(d) {
  const primero = new Date(d.getFullYear(), d.getMonth(), 1);
  const dia = primero.getDay(); // 0 = domingo
  primero.setDate(primero.getDate() - dia);
  primero.setHours(0, 0, 0, 0);
  return primero;
}

const DIAS_SEMANA_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const CALENDARIO_MAX_VISIBLE = 5;

// Color consistente por OD, compartido entre el Calendario de cada área y
// el Calendario General, para que un mismo OD siempre se vea del mismo color.
const PALETA_OD = [T.accent, T.steel, T.green, T.blue, T.amber, T.red, T.turquoise];
function odColor(str) {
  let h = 0;
  const s = str || "sin-od";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % PALETA_OD.length;
  return PALETA_OD[Math.abs(h)];
}

/* ---------------------------------------------------------
   INTEGRACION: Google Calendar (solo lectura, calendarios
   públicos) — trae las visitas agendadas en Google Calendar
   de Inspecciones y Proyectos para mostrarlas junto a las
   propias de la app. No escribe nada de vuelta a Google.
   --------------------------------------------------------- */
const GOOGLE_CALENDAR_IDS = {
  inspecciones: import.meta.env.VITE_GOOGLE_CALENDAR_ID_INSPECCIONES || "",
  proyectos: import.meta.env.VITE_GOOGLE_CALENDAR_ID_PROYECTOS || "",
};
const GOOGLE_CALENDAR_API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY || "";
async function fetchGoogleCalendarEventos(area, timeMinISO, timeMaxISO) {
  const calendarId = GOOGLE_CALENDAR_IDS[area];
  if (!calendarId || !GOOGLE_CALENDAR_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      key: GOOGLE_CALENDAR_API_KEY,
      timeMin: new Date(timeMinISO + "T00:00:00").toISOString(),
      timeMax: new Date(timeMaxISO + "T23:59:59").toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.items || []).flatMap((e) => {
      const base = {
        area, tipo: "Google Calendar", od: e.summary || "(Sin título)", personas: e.location || "",
        _google: true,
      };
      if (e.start?.date && e.end?.date) {
        // Evento de "todo el día" — puede durar varios días seguidos.
        // end.date en Google es EXCLUSIVO (el día después del último), así
        // que hay que repetir el evento en cada día real que dura.
        const inicio = new Date(e.start.date + "T00:00:00");
        const finExclusivo = new Date(e.end.date + "T00:00:00");
        const dias = [];
        const cursorFecha = new Date(inicio);
        while (cursorFecha < finExclusivo) {
          dias.push(isoDate(cursorFecha));
          cursorFecha.setDate(cursorFecha.getDate() + 1);
        }
        return dias.map((fecha, i) => ({ ...base, id: `gcal-${e.id}-${i}`, fecha, hora: "" }));
      }
      const fecha = e.start?.dateTime ? e.start.dateTime.slice(0, 10) : "";
      if (!fecha) return [];
      const hora = e.start.dateTime.slice(11, 16);
      return [{ ...base, id: `gcal-${e.id}`, fecha, hora }];
    });
  } catch (err) {
    console.error("Error cargando Google Calendar:", err);
    return [];
  }
}

function Calendario({ area, color, tipoLabel = ["Inspección", "Proyecto"] }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const confirmar = useContext(ConfirmContext);
  const [cursor, setCursor] = useState(new Date());
  const [vista, setVista] = useState("mes");
  const [diaSeleccionado, setDiaSeleccionado] = useState(todayISO());
  const [eventos, setEventos] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ tipo: tipoLabel[0], od: "", personas: "", fecha: todayISO(), hora: "08:00" });
  const [modoRango, setModoRango] = useState(false);
  const [ultimoRango, setUltimoRango] = useState(null);
  const [formRango, setFormRango] = useState({
    tipo: tipoLabel[0], od: "", personas: "", hora: "08:00",
    fechaInicio: todayISO(), fechaFin: todayISO(),
  });

  const [eventosGoogle, setEventosGoogle] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("calendario_eventos").select("*").eq("area", area);
      if (data) setEventos(data);
    })();
  }, [area]);

  const delEvento = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta visita agendada?"))) return;
    const respaldo = eventos.find((e) => e.id === id);
    setEventos((prev) => prev.filter((e) => e.id !== id));
    setErrorMsg("");
    const { error } = await supabase.from("calendario_eventos").delete().eq("id", id);
    if (error) {
      setErrorMsg("No se pudo eliminar la visita: " + (error.message || "error desconocido en la base de datos."));
      if (respaldo) setEventos((prev) => [...prev, respaldo]);
    }
  };

  const monthLabel = cursor.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const gridStart = startOfMonthGrid(cursor);
  const gridDays = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const inicioSemana = new Date(cursor);
  inicioSemana.setDate(cursor.getDate() - cursor.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });
  const rangoSemanaLabel = `${diasSemana[0].toLocaleDateString("es-CR", { day: "numeric", month: "short" })} – ${diasSemana[6].toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}`;
  const diaLabel = cursor.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const navegar = (delta) => {
    if (vista === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (vista === "semana") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    else if (vista === "dia") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta));
  };
  const irAHoy = () => { setCursor(new Date()); setDiaSeleccionado(todayISO()); };

  const VISTAS = [
    { id: "mes", label: "Mes" },
    { id: "semana", label: "Semana" },
    { id: "dia", label: "Día" },
    { id: "agenda", label: "Agenda" },
  ];
  const tituloVista = vista === "mes" ? monthLabel : vista === "semana" ? rangoSemanaLabel : vista === "dia" ? diaLabel : "Agenda completa";

  useEffect(() => {
    if (!GOOGLE_CALENDAR_IDS[area]) { setEventosGoogle([]); return; }
    let activo = true;
    const cargar = async () => {
      const desde = isoDate(gridDays[0]);
      const hasta = isoDate(gridDays[gridDays.length - 1]);
      const eventosG = await fetchGoogleCalendarEventos(area, desde, hasta);
      if (activo) setEventosGoogle(eventosG);
    };
    cargar();
    // Vuelve a consultar Google Calendar cada 60 segundos mientras esta
    // vista esté abierta, para que las visitas nuevas aparezcan solas.
    const intervalo = setInterval(cargar, 60000);
    return () => { activo = false; clearInterval(intervalo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, cursor.getMonth(), cursor.getFullYear()]);

  const addEvento = async () => {
    if (!form.od || !form.fecha) return;
    const payload = { area, tipo: form.tipo, od: form.od, personas: form.personas, fecha: form.fecha, hora: form.hora };
    setForm({ ...form, od: "", personas: "" });
    setErrorMsg("");
    const { data, error } = await supabase.from("calendario_eventos").insert(payload).select().single();
    if (!error && data) setEventos((prev) => [...prev, data]);
    if (error) setErrorMsg("No se pudo guardar la visita: " + (error.message || "error desconocido en la base de datos."));
  };

  const generarRango = async () => {
    if (!formRango.od || !formRango.fechaInicio || !formRango.fechaFin) return;
    const inicio = new Date(formRango.fechaInicio + "T00:00:00");
    const fin = new Date(formRango.fechaFin + "T00:00:00");
    if (fin < inicio) return;
    const fechas = [];
    let cursorFecha = new Date(inicio);
    while (cursorFecha <= fin) {
      fechas.push(isoDate(cursorFecha));
      cursorFecha.setDate(cursorFecha.getDate() + 1);
    }
    if (fechas.length === 0) return;
    if (!(await confirmar(
      `Se generará una visita TODOS los días entre ${formRango.fechaInicio} y ${formRango.fechaFin} (${fechas.length} en total). ¿Continuar?`,
      { confirmLabel: "Sí, generar", variant: "accent" }
    ))) return;
    const payloads = fechas.map((fecha) => ({ area, tipo: formRango.tipo, od: formRango.od, personas: formRango.personas, fecha, hora: formRango.hora }));
    setErrorMsg("");
    const { data: inserted, error } = await supabase.from("calendario_eventos").insert(payloads).select();
    if (!error && inserted) {
      setEventos((prev) => [...prev, ...inserted]);
      setUltimoRango({ od: formRango.od, min: formRango.fechaInicio, max: formRango.fechaFin, color: hashColor(formRango.od) });
    }
    if (error) setErrorMsg("No se pudieron guardar las visitas: " + (error.message || "error desconocido en la base de datos."));
    setFormRango((f) => ({ ...f, od: "", personas: "" }));
  };

  const eventosDelDia = (d) => {
    const iso = isoDate(d);
    return [...eventos.filter((e) => e.fecha === iso), ...eventosGoogle.filter((e) => e.fecha === iso)];
  };

  // Color consistente por OD (cada OD siempre se ve del mismo color en
  // todo el calendario, como en Google Calendar por "calendario"/cliente).
  const hashColor = odColor;

  const eventosDelDiaSeleccionado = [...eventos, ...eventosGoogle]
    .filter((e) => e.fecha === diaSeleccionado)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  const renderPill = (e) => (
    <div
      key={e.id}
      title={`${e._google ? "Desde Google Calendar · " : ""}${e.tipo} · ${e.od} · ${e.personas} · ${e.hora}`}
      style={{
        background: hashColor(e.od), color: "#fff", fontSize: 11, fontWeight: 600,
        borderRadius: 6, padding: "3px 8px", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap", boxShadow: "0 1px 2px rgba(16,24,38,0.12)",
      }}
    >
      {e._google ? "G· " : ""}{e.od}{e.personas ? ` // ${e.personas}` : ""}
    </div>
  );

  // ---- datos para vista Agenda ----
  const todosLosEventos = [...eventos, ...eventosGoogle];
  const gruposAgenda = {};
  todosLosEventos.forEach((e) => {
    if (!e.fecha) return;
    (gruposAgenda[e.fecha] = gruposAgenda[e.fecha] || []).push(e);
  });
  const fechasAgenda = Object.keys(gruposAgenda).sort();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {VISTAS.map((v) => (
                <Btn key={v.id} small variant={vista === v.id ? "accent" : "ghost"} onClick={() => setVista(v.id)}>{v.label}</Btn>
              ))}
            </div>
            <Btn small variant="ghost" onClick={() => exportExcel(eventos.map(({ tipo, od, personas, fecha, hora }) => ({ Tipo: tipo, OD: od, "Personas asignadas": personas, Fecha: fecha, Hora: hora })), `agenda_${area}.xlsx`)}><Download size={13} /> Excel</Btn>
          </div>
        </Card>

        {vista === "mes" && (
          <Card
            title={tituloVista}
            action={
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
                <Btn small variant="ghost" onClick={irAHoy}>Hoy</Btn>
                <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
              </div>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 10 }}>
              {DIAS_SEMANA_CORTO.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
              {gridDays.map((d) => {
                const iso = isoDate(d);
                const esMesActual = d.getMonth() === cursor.getMonth();
                const esHoy = iso === todayISO();
                const esSeleccionado = iso === diaSeleccionado;
                const eventosDia = eventosDelDia(d);
                return (
                  <div
                    key={iso}
                    onClick={() => setDiaSeleccionado(iso)}
                    style={{
                      minHeight: 140, border: `1px solid ${esSeleccionado ? color : T.line}`,
                      borderWidth: esSeleccionado ? 2 : 1,
                      borderRadius: 10, padding: 8, cursor: "pointer",
                      background: esMesActual ? T.panel : T.bg,
                      display: "flex", flexDirection: "column", gap: 5,
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    <div style={{
                      fontSize: 12.5, fontWeight: esHoy ? 800 : 600, color: esMesActual ? (esHoy ? "#fff" : T.ink) : T.gray,
                      background: esHoy ? color : "transparent", width: 24, height: 24, lineHeight: "24px",
                      textAlign: "center", borderRadius: "50%",
                    }}>{d.getDate()}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
                      {eventosDia.slice(0, CALENDARIO_MAX_VISIBLE).map(renderPill)}
                      {eventosDia.length > CALENDARIO_MAX_VISIBLE && (
                        <div style={{ fontSize: 10.5, color: T.gray, fontWeight: 700, paddingLeft: 4 }}>
                          +{eventosDia.length - CALENDARIO_MAX_VISIBLE} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {vista === "semana" && (
          <Card
            title={tituloVista}
            action={
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
                <Btn small variant="ghost" onClick={irAHoy}>Hoy</Btn>
                <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
              </div>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
              {diasSemana.map((d) => {
                const iso = isoDate(d);
                const esHoy = iso === todayISO();
                const esSeleccionado = iso === diaSeleccionado;
                const eventosDia = eventosDelDia(d);
                return (
                  <div
                    key={iso}
                    onClick={() => setDiaSeleccionado(iso)}
                    style={{ minHeight: 280, border: `1px solid ${esSeleccionado ? color : T.line}`, borderWidth: esSeleccionado ? 2 : 1, borderRadius: 10, padding: 10, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <div style={{ textAlign: "center", marginBottom: 2 }}>
                      <div style={{ fontSize: 10, color: T.gray, fontWeight: 800, textTransform: "uppercase" }}>{d.toLocaleDateString("es-CR", { weekday: "short" })}</div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, color: esHoy ? "#fff" : T.ink,
                        background: esHoy ? color : "transparent", width: 24, height: 24, lineHeight: "24px",
                        borderRadius: "50%", margin: "2px auto 0",
                      }}>{d.getDate()}</div>
                    </div>
                    {eventosDia.map(renderPill)}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {vista === "dia" && (
          <Card
            title={tituloVista}
            action={
              <div style={{ display: "flex", gap: 6 }}>
                <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
                <Btn small variant="ghost" onClick={irAHoy}>Hoy</Btn>
                <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
              </div>
            }
          >
            {eventosDelDia(cursor).length === 0 ? (
              <div style={{ color: T.gray, fontSize: 13 }}>Sin visitas agendadas este día.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {eventosDelDia(cursor).map((e) => (
                  <div key={e.id} style={{ background: hashColor(e.od), color: "#fff", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>{e._google ? "Google Calendar" : e.tipo} · {e.hora}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{e._google ? "G· " : ""}{e.od}{e.personas ? ` // ${e.personas}` : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {vista === "agenda" && (
          <>
            {fechasAgenda.length === 0 && (
              <Card><div style={{ color: T.gray, fontSize: 13 }}>No hay visitas agendadas todavía.</div></Card>
            )}
            <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
              {fechasAgenda.map((fecha, idx) => {
                const fechaObj = new Date(fecha + "T00:00:00");
                const eventosDia = gruposAgenda[fecha].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
                return (
                  <div key={fecha} style={{ display: "flex", borderTop: idx === 0 ? "none" : `1px solid ${T.line}` }}>
                    <div style={{ width: 76, flexShrink: 0, padding: "18px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "lowercase" }}>
                        {fechaObj.toLocaleDateString("es-CR", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{fechaObj.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "16px 16px 16px 0" }}>
                      {eventosDia.map((e) => (
                        <div
                          key={e.id}
                          title={`${e._google ? "Desde Google Calendar · " : ""}${e.tipo} · ${e.od} · ${e.personas} · ${e.hora}`}
                          style={{
                            background: hashColor(e.od), color: "#fff", fontWeight: 700, fontSize: 13,
                            borderRadius: 10, padding: "12px 16px", overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          {e._google ? "G· " : ""}{e.od}{e.personas ? ` // ${e.personas}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title={`Visitas — ${new Date(diaSeleccionado + "T00:00:00").toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "short" })}`}>
          {eventosDelDiaSeleccionado.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.gray }}>Sin visitas agendadas este día.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
              {eventosDelDiaSeleccionado.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: `1px dashed ${T.line}`, paddingBottom: 8 }}>
                  <div style={{ marginTop: 4, width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hashColor(e.od) }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{e.hora} · {e.tipo}{e._google && <span style={{ color: T.gray, fontWeight: 600 }}> · Google Calendar</span>}</div>
                    <div style={{ fontSize: 12, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.od} — {e.personas}
                    </div>
                  </div>
                  {!e._google && (
                    <button onClick={() => delEvento(e.id)} style={{ background: "transparent", border: "none", color: T.gray, cursor: "pointer", padding: 2, flexShrink: 0 }} title="Borrar">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Agendar visita" action={
          <Btn small variant="ghost" onClick={() => setModoRango(!modoRango)}>
            {modoRango ? "Visita única" : "Rango extendido"}
          </Btn>
        }>
          {errorMsg && (
            <div style={{ color: T.red, fontSize: 12, display: "flex", gap: 6, alignItems: "center", marginBottom: 10, background: T.redSoft, padding: "8px 10px", borderRadius: 8 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />{errorMsg}
            </div>
          )}
          {!modoRango ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Tipo">
                <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  {tipoLabel.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="OD"><input style={inputStyle} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} placeholder="OD-1005" /></Field>
              <Field label="Personas asignadas"><input style={inputStyle} value={form.personas} onChange={(e) => setForm({ ...form, personas: e.target.value })} placeholder="Nombres" /></Field>
              <Field label="Fecha"><input style={inputStyle} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
              <Field label="Hora"><input style={inputStyle} type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></Field>
              <Btn variant="accent" onClick={addEvento} style={{ justifyContent: "center" }}><Plus size={14} /> Agendar</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: T.gray }}>Genera una visita para cada día entre las dos fechas elegidas.</div>
              <Field label="Tipo">
                <select style={inputStyle} value={formRango.tipo} onChange={(e) => setFormRango({ ...formRango, tipo: e.target.value })}>
                  {tipoLabel.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="OD"><input style={inputStyle} value={formRango.od} onChange={(e) => setFormRango({ ...formRango, od: e.target.value })} placeholder="OD-1005" /></Field>
              <Field label="Personas asignadas"><input style={inputStyle} value={formRango.personas} onChange={(e) => setFormRango({ ...formRango, personas: e.target.value })} placeholder="Nombres" /></Field>
              <Field label="Hora"><input style={inputStyle} type="time" value={formRango.hora} onChange={(e) => setFormRango({ ...formRango, hora: e.target.value })} /></Field>
              <Field label="Desde"><input style={inputStyle} type="date" value={formRango.fechaInicio} onChange={(e) => setFormRango({ ...formRango, fechaInicio: e.target.value })} /></Field>
              <Field label="Hasta"><input style={inputStyle} type="date" value={formRango.fechaFin} onChange={(e) => setFormRango({ ...formRango, fechaFin: e.target.value })} /></Field>
              <Btn variant="accent" onClick={generarRango} style={{ justifyContent: "center" }}><Plus size={14} /> Generar visitas</Btn>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   MODULO: COTIZACIONES
   --------------------------------------------------------- */
function CotizacionPrintView({ r, onClose }) {
  const { logo } = useContext(LogoContext);
  if (!r) return null;
  const row = (label, value) => (
    <tr>
      <td style={{ padding: "8px 12px", fontWeight: 600, color: T.inkSoft, width: "40%", borderBottom: `1px solid ${T.line}` }}>{label}</td>
      <td style={{ padding: "8px 12px", color: T.ink, borderBottom: `1px solid ${T.line}` }}>{value || "—"}</td>
    </tr>
  );
  return (
    <div id="cotizacion-print-overlay" style={{
      position: "fixed", inset: 0, background: "rgba(16,24,38,0.55)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cotizacion-print-content, #cotizacion-print-content * { visibility: visible; }
          #cotizacion-print-content { position: absolute; top: 0; left: 0; width: 100%; }
          #cotizacion-print-toolbar { display: none !important; }
        }
      `}</style>
      <div style={{ background: "#fff", borderRadius: 14, width: 640, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div id="cotizacion-print-toolbar" style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px 0" }}>
          <Btn small variant="ghost" onClick={onClose}><X size={13} /> Cerrar</Btn>
          <Btn small variant="accent" onClick={() => window.print()}><Download size={13} /> Imprimir / Guardar PDF</Btn>
        </div>
        <div id="cotizacion-print-content" style={{ padding: 32 }}>
          {logo && <img src={logo} alt="Logo" style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />}
          <h1 style={{ fontSize: 18, margin: "0 0 2px" }}>Solicitud de Cotización #{r.consecutivo}</h1>
          <div style={{ color: T.inkSoft, fontSize: 12.5, marginBottom: 22 }}>
            Departamento A&D Salvavidas · Generado {new Date().toLocaleDateString("es-CR")}
          </div>

          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: T.steel, margin: "22px 0 8px" }}>Información general</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {row("Solicitante", r.solicitante)}
              {row("Cliente", r.cliente)}
              {row("Nombre del contacto", r.contacto)}
              {row("Email", r.email)}
              {row("Teléfono", r.telefono)}
              {row("Provincia", r.provincia)}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: T.steel, margin: "22px 0 8px" }}>Detalles</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {row("Días de implementación", r.dias)}
              {row("Frecuencia", r.frecuencia)}
              {row("Descripción del trabajo", r.descripcion)}
              {row("Personal y puesto", r.personal)}
              {row("Equipos de elevación requeridos", r.equipos)}
              {row("Lista de dispositivos", r.dispositivos)}
              {row("Observaciones", r.observaciones)}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: T.steel, margin: "22px 0 8px" }}>Estado de la solicitud</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {row("N° de cotización", r.numCot)}
              {row("Tipo de oferta", r.tipo)}
              {row("Estatus", r.estado)}
              {row("Actividad", r.actividad)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cotizaciones() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canEditEstadoCot = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [printRow, setPrintRow] = useState(null);
  const [subTab, setSubTab] = useState("Todas");
  const [avisoForm, setAvisoForm] = useState("");
  const [form, setForm] = useState({
    solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "",
    dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Solicitud",
    actividad: "Seguimiento", tipo: "Inspecciones", frecuencia: "", observaciones: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cotizaciones").select("*").order("numero", { ascending: false });
      if (data) setRows(data.map(cotRowFromDb));
    })();
  }, []);

  const maxNumero = rows.reduce((m, r) => Math.max(m, Number(r.consecutivo) || 0), 0);
  const nextConsecutivo = String(maxNumero + 1).padStart(5, "0");

  const submit = async () => {
    if (!form.cliente || !form.email) {
      setAvisoForm("Falta completar Cliente y/o Email — ambos son obligatorios para guardar la solicitud.");
      return;
    }
    setAvisoForm("");
    const payload = {
      numero: maxNumero + 1,
      solicitante: form.solicitante, cliente: form.cliente, contacto: form.contacto, email: form.email,
      telefono: form.telefono, provincia: form.provincia, dias: form.dias || null, personal: form.personal,
      descripcion: form.descripcion, equipos: form.equipos, dispositivos: form.dispositivos,
      num_cot: form.numCot, estado: form.estado, actividad: form.actividad, tipo: form.tipo,
      frecuencia: form.frecuencia, observaciones: form.observaciones,
    };
    setForm({ solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "", dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Solicitud", actividad: "Seguimiento", tipo: "Inspecciones", frecuencia: "", observaciones: "" });
    setOpen(false);
    const { data, error } = await supabase.from("cotizaciones").insert(payload).select().single();
    if (!error && data) setRows((prev) => [cotRowFromDb(data), ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("cotizaciones").update({ estado }).eq("id", id).then();
  };
  const setActividad = (id, actividad) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, actividad } : r));
    supabase.from("cotizaciones").update({ actividad }).eq("id", id).then();
  };
  const setTipo = (id, tipo) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, tipo } : r));
    supabase.from("cotizaciones").update({ tipo }).eq("id", id).then();
  };
  const setNumCot = (id, numCot) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, numCot } : r));
    supabase.from("cotizaciones").update({ num_cot: numCot }).eq("id", id).then();
  };
  const setObservaciones = (id, observaciones) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, observaciones } : r));
    supabase.from("cotizaciones").update({ observaciones }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta cotización? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("cotizaciones").delete().eq("id", id).then();
  };

  const ESTADOS_COT = ["Solicitud", "Enviado", "Abierto", "Comparado"];
  const estadoColor = { Solicitud: [T.amber, T.amberSoft], Enviado: [T.blue, T.blueSoft], Abierto: [T.steel, T.steelSoft], Comparado: [T.green, T.greenSoft] };
  const actividadColor = { Seguimiento: [T.blue, T.blueSoft], Cancelado: [T.red, T.redSoft], "Con OC": [T.green, T.greenSoft] };
  const TIPO_OFERTA_OPCIONES = ["Inspecciones", "Proyectos", "Inspecciones y Proyectos"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CotizacionPrintView r={printRow} onClose={() => setPrintRow(null)} />
      <Card
        title={`Historial de solicitudes — próximo consecutivo #${nextConsecutivo}`}
        action={<div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="ghost" onClick={() => exportExcel(rows.map(r => ({ Consecutivo: r.consecutivo, Solicitante: r.solicitante, Cliente: r.cliente, "Nombre del contacto": r.contacto, Email: r.email, Telefono: r.telefono, Provincia: r.provincia, Dias: r.dias, Personal: r.personal, "Descripción del trabajo": r.descripcion, "Equipos de elevación": r.equipos, "Lista de dispositivos": r.dispositivos, "N° Cotización": r.numCot, Tipo: r.tipo, Estado: r.estado, Actividad: r.actividad, Frecuencia: r.frecuencia, Observaciones: r.observaciones })), "cotizaciones.xlsx")}><Download size={13} /> Excel</Btn>
          <Btn small variant="accent" onClick={() => setOpen(!open)}><Plus size={13} /> Nueva solicitud</Btn>
        </div>}
      >
        {open && (
          <div style={{ background: T.graySoft, borderRadius: 10, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {avisoForm && (
              <div style={{ gridColumn: "1 / -1", color: T.red, fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", background: T.redSoft, padding: "8px 10px", borderRadius: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />{avisoForm}
              </div>
            )}
            <Field label="Nombre del solicitante"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></Field>
            <Field label="Cliente *"><input style={inputStyle} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
            <Field label="Nombre del contacto"><input style={inputStyle} value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></Field>
            <Field label="Email *"><input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Teléfono"><input style={inputStyle} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
            <Field label="Provincia"><input style={inputStyle} value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></Field>
            <Field label="Días de implementación"><input style={inputStyle} type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} /></Field>
            <Field label="Personal y puesto"><input style={inputStyle} value={form.personal} onChange={(e) => setForm({ ...form, personal: e.target.value })} placeholder="2 técnicos, 1 supervisor" /></Field>
            <Field label="Frecuencia"><input style={inputStyle} value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} placeholder="Única vez, Mensual, Anual..." /></Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Descripción del trabajo"><input style={inputStyle} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalle del trabajo a realizar..." /></Field>
            </div>
            <Field label="Equipos de elevación (cant./tipo/marca/modelo)"><input style={inputStyle} value={form.equipos} onChange={(e) => setForm({ ...form, equipos: e.target.value })} placeholder="1x Grúa / Terex / AC55" /></Field>
            <Field label="Lista de dispositivos"><input style={inputStyle} value={form.dispositivos} onChange={(e) => setForm({ ...form, dispositivos: e.target.value })} placeholder="Materiales y/o equipos..." /></Field>
            <Field label="N° de cotización (si aplica)"><input style={inputStyle} value={form.numCot} onChange={(e) => setForm({ ...form, numCot: e.target.value })} /></Field>
            <Field label="Tipo de oferta">
              <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPO_OFERTA_OPCIONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Observaciones"><input style={inputStyle} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas adicionales..." /></Field>
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
              <Btn variant="accent" onClick={submit}>Guardar solicitud</Btn>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Btn small variant={subTab === "Todas" ? "accent" : "ghost"} onClick={() => setSubTab("Todas")}>Todas ({rows.length})</Btn>
          {ESTADOS_COT.map((e) => (
            <Btn key={e} small variant={subTab === e ? "accent" : "ghost"} onClick={() => setSubTab(e)}>{e} ({rows.filter((r) => r.estado === e).length})</Btn>
          ))}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>#</th><th>Solicitante</th><th>Cliente</th><th>Provincia</th><th>Días</th><th style={{ minWidth: 150 }}>N° Cotización</th><th>Tipo</th><th>Estado</th><th>Actividad</th><th style={{ minWidth: 180 }}>Observaciones</th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => subTab === "Todas" || r.estado === subTab).map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px", fontWeight: 700 }}>{r.consecutivo}</td>
                <td>{r.solicitante}</td>
                <td>{r.cliente}</td>
                <td>{r.provincia}</td>
                <td>{r.dias}</td>
                <td>
                  {canEditEstadoCot ? (
                    <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} value={r.numCot} onChange={(e) => setNumCot(r.id, e.target.value)} placeholder="COT-000" />
                  ) : (r.numCot || "—")}
                </td>
                <td>
                  {isAdmin ? (
                    <select value={r.tipo} onChange={(e) => setTipo(r.id, e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }}>
                      {TIPO_OFERTA_OPCIONES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  ) : (r.tipo || "—")}
                </td>
                <td>
                  {canEditEstadoCot ? (
                    <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: (estadoColor[r.estado] || [T.gray, T.graySoft])[1], color: (estadoColor[r.estado] || [T.gray, T.graySoft])[0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {Object.keys(estadoColor).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge color={(estadoColor[r.estado] || [T.gray, T.graySoft])[0]} soft={(estadoColor[r.estado] || [T.gray, T.graySoft])[1]}>{r.estado}</Badge>
                  )}
                </td>
                <td>
                  {canEditEstadoCot ? (
                    <select value={r.actividad} onChange={(e) => setActividad(r.id, e.target.value)} style={{ border: "none", background: (actividadColor[r.actividad] || [T.gray, T.graySoft])[1], color: (actividadColor[r.actividad] || [T.gray, T.graySoft])[0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {Object.keys(actividadColor).map((a) => <option key={a}>{a}</option>)}
                    </select>
                  ) : (
                    <Badge color={(actividadColor[r.actividad] || [T.gray, T.graySoft])[0]} soft={(actividadColor[r.actividad] || [T.gray, T.graySoft])[1]}>{r.actividad}</Badge>
                  )}
                </td>
                <td>
                  <input
                    style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 180 }}
                    value={r.observaciones}
                    onChange={(e) => setObservaciones(r.id, e.target.value)}
                    placeholder="Notas..."
                  />
                </td>
                <td>
                  <Btn small variant="ghost" onClick={() => setPrintRow(r)}><Download size={12} /> PDF</Btn>
                </td>
                <td>
                  {isAdmin && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   MODULO: CURSOS EHS
   --------------------------------------------------------- */
function CursosEHS() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canEditCurso = isAdmin || currentUser?.categoria === "tecnico";
  const canEditEstadoCurso = isAdmin || currentUser?.categoria === "tecnico" || currentUser?.categoria === "asistente";
  const canEditLugar = isAdmin || currentUser?.categoria === "asistente";
  const canBorrarCurso = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const [rows, setRows] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [subTab, setSubTab] = useState("activos");
  const [form, setForm] = useState({ solicitante: "", personal: "", lugar: "", tipo: CURSO_TIPOS[0], fecha: "" });
  const [personalSeleccionado, setPersonalSeleccionado] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: personal } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
      if (personal) setEmpleados(personal);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cursos_ehs").select("*").order("created_at", { ascending: false });
      if (data) {
        const normalizados = data.map((r) => ({ ...r, fecha: r.fecha || "" }));
        // Cuando un curso ya cumplió su año de vigencia (Vencido), se recicla
        // solo a Pendiente y se limpia su fecha, para que vuelva a aparecer en
        // Activos como una solicitud que hay que coordinar de nuevo.
        const idsReciclados = [];
        const finales = normalizados.map((r) => {
          if (r.estado !== "Cancelado" && r.estado !== "Pendiente") {
            const venc = vencimientoCalculado(r.fecha);
            if (venc && venc < todayISO()) {
              idsReciclados.push(r.id);
              return { ...r, estado: "Pendiente", fecha: "" };
            }
          }
          return r;
        });
        setRows(finales);
        idsReciclados.forEach((id) => supabase.from("cursos_ehs").update({ estado: "Pendiente", fecha: null }).eq("id", id).then());
      }
    })();
  }, []);

  const add = async () => {
    const nombresPersonal = personalSeleccionado.map((codigo) => empleados.find((e) => e.codigo === codigo)?.nombre).filter(Boolean).join(", ");
    if (!form.solicitante || !nombresPersonal) return;
    const payload = { ...form, personal: nombresPersonal, fecha: form.fecha || null, estado: "Pendiente" };
    setForm({ solicitante: "", personal: "", lugar: "", tipo: CURSO_TIPOS[0], fecha: "" });
    setPersonalSeleccionado([]);
    const { data, error } = await supabase.from("cursos_ehs").insert(payload).select().single();
    if (!error && data) setRows((prev) => [{ ...data, fecha: data.fecha || "" }, ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("cursos_ehs").update({ estado }).eq("id", id).then();
  };
  const setFecha = (id, fecha) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fecha } : r));
    supabase.from("cursos_ehs").update({ fecha: fecha || null }).eq("id", id).then();
  };
  const setLugar = (id, lugar) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, lugar } : r));
    supabase.from("cursos_ehs").update({ lugar }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este curso? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("cursos_ehs").delete().eq("id", id).then();
  };

  const rowsVencidos = rows.filter((r) => estadoEfectivoCurso(r) === "Vencido");
  const rowsRealizados = rows.filter((r) => r.estado === "Realizado" && estadoEfectivoCurso(r) !== "Vencido");
  const rowsActivos = rows.filter((r) => r.estado !== "Realizado" && estadoEfectivoCurso(r) !== "Vencido");
  const rowsMostrados = subTab === "activos" ? rowsActivos : subTab === "vencidos" ? rowsVencidos : rowsRealizados;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
      <Card title="Solicitudes de curso" action={<Btn small variant="ghost" onClick={() => exportExcel(rowsMostrados.map(r => ({ Solicitante: r.solicitante, Personal: r.personal, Lugar: r.lugar, Tipo: r.tipo, Estado: r.estado, Fecha: r.fecha, Vencimiento: vencimientoCalculado(r.fecha) || "" })), "cursos_ehs.xlsx")}><Download size={13} /> Excel</Btn>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Btn small variant={subTab === "activos" ? "accent" : "ghost"} onClick={() => setSubTab("activos")}>Activos ({rowsActivos.length})</Btn>
          <Btn small variant={subTab === "vencidos" ? "accent" : "ghost"} onClick={() => setSubTab("vencidos")}>Vencidos ({rowsVencidos.length})</Btn>
          <Btn small variant={subTab === "realizados" ? "accent" : "ghost"} onClick={() => setSubTab("realizados")}>Realizados ({rowsRealizados.length})</Btn>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}></th><th>Tipo</th><th>Personal</th><th>Lugar</th><th>Fecha</th><th>Vence</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rowsMostrados.map((r) => {
              const efectivo = estadoEfectivoCurso(r);
              const venc = vencimientoCalculado(r.fecha);
              return (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 8px" }}><Dot color={SEMAFORO[efectivo]} /></td>
                  <td style={{ fontWeight: 600 }}>{r.tipo}</td>
                  <td>{r.personal}</td>
                  <td>
                    {canEditLugar ? (
                      <input style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px" }} value={r.lugar || ""} onChange={(e) => setLugar(r.id, e.target.value)} />
                    ) : (r.lugar || "—")}
                  </td>
                  <td>
                    {canEditCurso ? (
                      <input type="date" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 130 }} value={r.fecha || ""} onChange={(e) => setFecha(r.id, e.target.value)} title="Cambiar esta fecha renueva el curso y recalcula el vencimiento" />
                    ) : (r.fecha || "—")}
                  </td>
                  <td style={{ color: efectivo === "Vencido" ? T.red : T.inkSoft, fontWeight: efectivo === "Vencido" ? 700 : 500 }}>{venc || "—"}</td>
                  <td>
                    {canEditEstadoCurso ? (
                      efectivo === "Vencido" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <Badge color={T.red} soft={`${T.red}1A`}><Dot color={T.red} /> Vencido</Badge>
                          <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: "transparent", color: T.gray, fontSize: 11, padding: "0 2px" }}>
                            {["Pendiente", "Coordinado", "Cancelado", "Realizado"].map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      ) : (
                        <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: `${SEMAFORO[efectivo]}1A`, color: SEMAFORO[efectivo], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                          {["Pendiente", "Coordinado", "Cancelado", "Realizado"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      )
                    ) : (
                      <Badge color={SEMAFORO[efectivo]} soft={`${SEMAFORO[efectivo]}1A`}><Dot color={SEMAFORO[efectivo]} />{efectivo}</Badge>
                    )}
                  </td>
                  <td>{canBorrarCurso && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Nueva solicitud de curso">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Solicitante"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></Field>
          <Field label="Personal que asistirá">
            {empleados.length === 0 ? (
              <div style={{ fontSize: 11.5, color: T.gray }}>Aún no hay personal cargado. Agrégalo desde Planilla.</div>
            ) : (
              <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${T.line}`, borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {empleados.map((emp) => (
                  <label key={emp.codigo} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={personalSeleccionado.includes(emp.codigo)}
                      onChange={(e) => setPersonalSeleccionado((prev) => e.target.checked ? [...prev, emp.codigo] : prev.filter((c) => c !== emp.codigo))}
                    />
                    {emp.nombre}
                  </label>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10.5, color: T.gray, marginTop: 4 }}>Esta lista se administra desde Planilla.</div>
          </Field>
          <Field label="Lugar del curso"><input style={inputStyle} value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} /></Field>
          <Field label="Tipo de curso">
            <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {CURSO_TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Fecha del curso"><input style={inputStyle} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Btn variant="accent" onClick={add} style={{ justifyContent: "center" }}><Plus size={14} /> Solicitar curso</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: SALUD OCUPACIONAL (tabs internas: cursos / calendario)
   --------------------------------------------------------- */
function SaludOcupacional() {
  const [tab, setTab] = useState("cursos");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Btn variant={tab === "cursos" ? "accent" : "ghost"} small onClick={() => setTab("cursos")}>Cursos EHS</Btn>
        <Btn variant={tab === "horas" ? "accent" : "ghost"} small onClick={() => setTab("horas")}>Horas extras</Btn>
        <Btn variant={tab === "calendario" ? "accent" : "ghost"} small onClick={() => setTab("calendario")}>Agenda de visitas a Proyectos/Inspecciones</Btn>
      </div>
      {tab === "cursos" && <CursosEHS />}
      {tab === "horas" && <HorasExtras area="salud" color={T.red} />}
      {tab === "calendario" && <Calendario area="salud" color={T.red} tipoLabel={["Inspección", "Proyecto"]} />}
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: INSPECCIONES / PROYECTOS (tabs internas)
   --------------------------------------------------------- */
function ClientesPorPersona({ area, color }) {
  const [rows] = useClientesArea(area);
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const isProyectos = area === "proyectos";
  const label = isProyectos ? "Encargado" : "Técnico";
  const rowsFiltradas = rows.filter((r) => (filtroTipo === "Todos" || (r.tipoOD || "Normal") === filtroTipo) && r.estado === "Activo");
  const counts = {};
  rowsFiltradas.forEach((r) => {
    const key = r.tecnico?.trim() || "Sin asignar";
    counts[key] = (counts[key] || 0) + 1;
  });
  const data = Object.entries(counts).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);

  return (
    <Card
      title={`Cantidad de clientes activos por ${label.toLowerCase()}`}
      action={
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small variant={filtroTipo === "Todos" ? "accent" : "ghost"} onClick={() => setFiltroTipo("Todos")}>Todos</Btn>
          <Btn small variant={filtroTipo === "Normal" ? "accent" : "ghost"} onClick={() => setFiltroTipo("Normal")}>OD Normal</Btn>
          <Btn small variant={filtroTipo === "Correctivo" ? "accent" : "ghost"} onClick={() => setFiltroTipo("Correctivo")}>OD Correctivos</Btn>
        </div>
      }
    >
      {data.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay clientes cargados en esta área.</div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={data} margin={{ top: 24, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="nombre" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill={filtroTipo === "Correctivo" ? T.amber : color} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="cantidad" position="top" style={{ fontSize: 12, fontWeight: 700, fill: T.ink }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------
   HORAS EXTRAS QUINCENALES (por área) — se carga a mano desde
   Administrativo (o aquí mismo, solo admin), y todos la pueden ver.
   --------------------------------------------------------- */
function HorasExtrasQuincenales({ area, color }) {
  const [filas, setFilas] = useState([]);
  const [reales, setReales] = useState([]);
  const [ventana, setVentana] = useState(0);
  const VENTANA_QUINCENAS = 12;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("horas_extras_manual").select("*").eq("area", area).order("created_at", { ascending: true });
      if (data) setFilas(data);
    })();
    (async () => {
      const { data } = await supabase.from("horas_extras").select("*").eq("area", area).in("estado", ["Aprobada", "Cerrada"]);
      if (data) setReales(data);
    })();
  }, [area]);

  const MESES_CORTOS_QNA = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  function etiquetaQuincenaCorta(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-").map(Number);
    const nombreMes = MESES_CORTOS_QNA[mes - 1];
    if (dia <= 15) return `1-15 ${nombreMes}`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return `16-${ultimoDia} ${nombreMes}`;
  }
  const autoPorQuincena = {};
  const fechaPorQuincenaAuto = {};
  reales.forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef) return;
    const etiqueta = etiquetaQuincenaCorta(fechaRef);
    autoPorQuincena[etiqueta] = (autoPorQuincena[etiqueta] || 0) + (Number(h.horas) || 0);
    if (!fechaPorQuincenaAuto[etiqueta] || fechaRef < fechaPorQuincenaAuto[etiqueta]) fechaPorQuincenaAuto[etiqueta] = fechaRef;
  });
  const quincenasOrdenadas = [];
  filas.forEach((f) => { if (!quincenasOrdenadas.includes(f.quincena)) quincenasOrdenadas.push(f.quincena); });
  const soloAuto = Object.keys(autoPorQuincena).filter((q) => !quincenasOrdenadas.includes(q));
  soloAuto.sort((a, b) => (fechaPorQuincenaAuto[a] || "").localeCompare(fechaPorQuincenaAuto[b] || ""));
  quincenasOrdenadas.push(...soloAuto);

  const dataCompleta = quincenasOrdenadas.map((q) => {
    const tieneManual = filas.some((f) => f.quincena === q);
    return {
      quincena: q,
      horas: tieneManual
        ? filas.filter((f) => f.quincena === q).reduce((s, f) => s + Number(f.horas || 0), 0)
        : Math.round((autoPorQuincena[q] || 0) * 100) / 100,
    };
  });
  const totalVentanas = Math.max(1, Math.ceil(dataCompleta.length / VENTANA_QUINCENAS));
  const ventanaActual = Math.min(ventana, totalVentanas - 1);
  const finVentana = dataCompleta.length - ventanaActual * VENTANA_QUINCENAS;
  const inicioVentana = Math.max(0, finVentana - VENTANA_QUINCENAS);
  const data = dataCompleta.slice(inicioVentana, finVentana);

  return (
    <Card
      title="Estadística de horas extras"
      action={
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.min(v + 1, totalVentanas - 1))} disabled={ventanaActual >= totalVentanas - 1}><ChevronLeft size={14} /></Btn>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.max(v - 1, 0))} disabled={ventanaActual <= 0}><ChevronRight size={14} /></Btn>
        </div>
      }
    >
      {data.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay quincenas cargadas (se editan desde Administrativo).</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="quincena" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax) => Math.max(180, Math.ceil(dataMax * 1.15))]} />
            <Tooltip formatter={(v) => `${v} h`} />
            <ReferenceLine y={150} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Límite 150h", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
            <Line type="monotone" dataKey="horas" stroke={color || T.steel} strokeWidth={3} dot={{ r: 4 }}>
              <LabelList dataKey="horas" position="top" formatter={(v) => `${v}h`} style={{ fontSize: 11.5, fontWeight: 700, fill: T.ink }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function AreaOperativa({ area, color }) {
  const [tab, setTab] = useState("horas");
  const tecnicoLabel = area === "proyectos" ? "Encargado" : "Técnico";
  const tabs = [
    { id: "horas", label: "Horas extras", icon: Clock },
    { id: "horas_quincenales", label: "Estadística de Horas Extras", icon: LayoutDashboard },
    { id: "od", label: area === "inspecciones" ? "OD IPM" : "OD Proyectos", icon: ClipboardList },
    { id: "od_correctivos", label: "OD Correctivos", icon: AlertCircle },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
    { id: "porpersona", label: `Por ${tecnicoLabel}`, icon: LayoutDashboard },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <Btn key={t.id} variant={tab === t.id ? "accent" : "ghost"} small onClick={() => setTab(t.id)}>
            <t.icon size={13} /> {t.label}
          </Btn>
        ))}
      </div>
      {tab === "horas" && <HorasExtras area={area} color={color} />}
      {tab === "horas_quincenales" && <HorasExtrasQuincenales area={area} color={color} />}
      {tab === "od" && <OrdenesTrabajo area={area} color={color} tipoOD="Normal" />}
      {tab === "od_correctivos" && <OrdenesTrabajo area={area} color={T.amber} tipoOD="Correctivo" />}
      {tab === "calendario" && <Calendario area={area} color={color} />}
      {tab === "porpersona" && <ClientesPorPersona area={area} color={color} />}
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: ADMINISTRATIVO (tabs internas: resumen / usuarios)
   --------------------------------------------------------- */
function ResumenEjecutivo() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const confirmar = useContext(ConfirmContext);
  const [facturas, setFacturas] = useState([]);
  const [nuevoMes, setNuevoMes] = useState({ mes: "", monto: "" });
  const [horasManual, setHorasManual] = useState([]);
  const [horasReales, setHorasReales] = useState([]);
  const [ventanaHoras, setVentanaHoras] = useState(0); // 0 = ventana más reciente
  const graficoRef = React.useRef(null);
  const [ventanaFactura, setVentanaFactura] = useState(0);
  const [filtroCorrectivos, setFiltroCorrectivos] = useState("Todos");
  const VENTANA_MESES = 12;
  const { clientes } = useContext(ClientesContext);
  const PUNTO_EQUILIBRIO = 120000;
  const PUNTO_EQUILIBRIO_HORAS = 150;
  const VENTANA_QUINCENAS = 12;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("facturacion").select("*").order("created_at", { ascending: true });
      if (data) setFacturas(data);
    })();
    (async () => {
      const { data } = await supabase.from("horas_extras_manual").select("*").order("created_at", { ascending: true });
      if (data) setHorasManual(data);
    })();
    (async () => {
      const { data } = await supabase.from("horas_extras").select("*").in("area", ["inspecciones", "proyectos"]).in("estado", ["Aprobada", "Cerrada"]);
      if (data) setHorasReales(data);
    })();
  }, []);

  const addFactura = async () => {
    if (!nuevoMes.mes || !nuevoMes.monto) return;
    const payload = { mes: nuevoMes.mes, monto: Number(nuevoMes.monto) };
    setNuevoMes({ mes: "", monto: "" });
    const { data, error } = await supabase.from("facturacion").insert(payload).select().single();
    if (!error && data) setFacturas((prev) => [...prev, data]);
  };
  const editarMonto = (id, monto) => {
    const valor = Number(monto) || 0;
    setFacturas((prev) => prev.map((f) => f.id === id ? { ...f, monto: valor } : f));
    supabase.from("facturacion").update({ monto: valor }).eq("id", id).then();
  };
  const eliminarMes = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este mes de facturación?"))) return;
    setFacturas((prev) => prev.filter((f) => f.id !== id));
    supabase.from("facturacion").delete().eq("id", id).then();
  };

  const inspRows = clientes.inspecciones || [];
  const projRows = clientes.proyectos || [];
  const contar = (rows) => ({
    activos: rows.filter((r) => r.estado === "Activo").length,
    noActivos: rows.filter((r) => r.estado === "No Activo").length,
  });
  const insp = contar(inspRows);
  const proj = contar(projRows);
  const odComparativo = [
    { area: "Proyectos", Activos: proj.activos, "No Activos": proj.noActivos },
    { area: "Inspecciones", Activos: insp.activos, "No Activos": insp.noActivos },
  ];
  // Gráfico circular solicitado: OD de Proyectos e Inspecciones, activos e inactivos
  const odPie = [
    { name: "Proyectos — Activos", value: proj.activos, fill: T.green },
    { name: "Proyectos — No Activos", value: proj.noActivos, fill: T.red },
    { name: "Inspecciones — Activos", value: insp.activos, fill: T.steel },
    { name: "Inspecciones — No Activos", value: insp.noActivos, fill: T.amber },
  ];
  const totalActivos = insp.activos + proj.activos;

  // OD Correctivos: resumen general (ambas áreas), para saber cuántos
  // entran y quién hace más. Solo se cuentan los Activos (nada Cerrado/No
  // Activo) en ninguna de las 3 categorías.
  const correctivosInsp = inspRows.filter((r) => (r.tipoOD || "Normal") === "Correctivo" && r.estado === "Activo");
  const correctivosProj = projRows.filter((r) => (r.tipoOD || "Normal") === "Correctivo" && r.estado === "Activo");
  const totalCorrectivos = correctivosInsp.length + correctivosProj.length;
  // Al seleccionar "Inspecciones" o "Proyectos" en las cajitas, el gráfico
  // de personal cambia de fuente: ya no muestra Correctivos, sino el OD
  // normal de esa área (OD IPM u OD Proyectos respectivamente).
  const normalInsp = inspRows.filter((r) => (r.tipoOD || "Normal") === "Normal" && r.estado === "Activo");
  const normalProj = projRows.filter((r) => (r.tipoOD || "Normal") === "Normal" && r.estado === "Activo");
  const correctivosSeleccionados = filtroCorrectivos === "Inspecciones" ? normalInsp : filtroCorrectivos === "Proyectos" ? normalProj : [...correctivosInsp, ...correctivosProj];
  const colorGraficoCorrectivos = filtroCorrectivos === "Inspecciones" ? T.blue : filtroCorrectivos === "Proyectos" ? T.green : T.amber;
  const correctivosPorTecnico = {};
  correctivosSeleccionados.forEach((r) => {
    const key = r.tecnico?.trim() || "Sin asignar";
    correctivosPorTecnico[key] = (correctivosPorTecnico[key] || 0) + 1;
  });
  const correctivosPorTecnicoData = Object.entries(correctivosPorTecnico)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Horas extras quincenales — Inspecciones vs Proyectos: el histórico
  // cargado a mano (tabla horas_extras_manual) se conserva tal cual, y a
  // partir de ahí, cualquier quincena nueva se calcula sola sumando las
  // solicitudes de horas extra ya Aprobadas/Cerradas — así ya no hace
  // falta seguir cargando esto a mano hacia adelante.
  const MESES_CORTOS_QNA = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  function etiquetaQuincenaCorta(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-").map(Number);
    const nombreMes = MESES_CORTOS_QNA[mes - 1];
    if (dia <= 15) return `1-15 ${nombreMes}`;
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return `16-${ultimoDia} ${nombreMes}`;
  }
  const horasAutoPorQuincena = {};
  const fechaPorQuincenaAuto = {};
  horasReales.forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef) return;
    const etiqueta = etiquetaQuincenaCorta(fechaRef);
    horasAutoPorQuincena[etiqueta] = horasAutoPorQuincena[etiqueta] || { inspecciones: 0, proyectos: 0 };
    horasAutoPorQuincena[etiqueta][h.area] = (horasAutoPorQuincena[etiqueta][h.area] || 0) + (Number(h.horas) || 0);
    if (!fechaPorQuincenaAuto[etiqueta] || fechaRef < fechaPorQuincenaAuto[etiqueta]) fechaPorQuincenaAuto[etiqueta] = fechaRef;
  });

  const quincenasOrdenadas = [];
  horasManual.forEach((f) => { if (!quincenasOrdenadas.includes(f.quincena)) quincenasOrdenadas.push(f.quincena); });
  const quincenasSoloAuto = Object.keys(horasAutoPorQuincena).filter((q) => !quincenasOrdenadas.includes(q));
  quincenasSoloAuto.sort((a, b) => (fechaPorQuincenaAuto[a] || "").localeCompare(fechaPorQuincenaAuto[b] || ""));
  quincenasOrdenadas.push(...quincenasSoloAuto);

  const horasQuincenalesDataCompleta = quincenasOrdenadas.map((q) => {
    const tieneManualInsp = horasManual.some((f) => f.quincena === q && f.area === "inspecciones");
    const tieneManualProy = horasManual.some((f) => f.quincena === q && f.area === "proyectos");
    return {
      quincena: q,
      Inspecciones: tieneManualInsp
        ? horasManual.filter((f) => f.quincena === q && f.area === "inspecciones").reduce((s, f) => s + Number(f.horas || 0), 0)
        : Math.round((horasAutoPorQuincena[q]?.inspecciones || 0) * 100) / 100,
      Proyectos: tieneManualProy
        ? horasManual.filter((f) => f.quincena === q && f.area === "proyectos").reduce((s, f) => s + Number(f.horas || 0), 0)
        : Math.round((horasAutoPorQuincena[q]?.proyectos || 0) * 100) / 100,
    };
  });

  // Ventana deslizante de 12 quincenas (para no perder tamaño de letra),
  // navegable con flechas hacia atrás/adelante.
  const totalVentanas = Math.max(1, Math.ceil(horasQuincenalesDataCompleta.length / VENTANA_QUINCENAS));
  const ventanaActual = Math.min(ventanaHoras, totalVentanas - 1);
  const finVentana = horasQuincenalesDataCompleta.length - ventanaActual * VENTANA_QUINCENAS;
  const inicioVentana = Math.max(0, finVentana - VENTANA_QUINCENAS);
  const horasQuincenalesData = horasQuincenalesDataCompleta.slice(inicioVentana, finVentana);

  const promedio = (arr) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : 0;
  const totalInspHoras = horasQuincenalesDataCompleta.reduce((s, d) => s + d.Inspecciones, 0);
  const totalProyHoras = horasQuincenalesDataCompleta.reduce((s, d) => s + d.Proyectos, 0);
  const promedioInspHoras = promedio(horasQuincenalesDataCompleta.map((d) => d.Inspecciones));
  const promedioProyHoras = promedio(horasQuincenalesDataCompleta.map((d) => d.Proyectos));
  const quincenasSobreInsp = horasQuincenalesDataCompleta.filter((d) => d.Inspecciones > PUNTO_EQUILIBRIO_HORAS).length;
  const quincenasSobreProy = horasQuincenalesDataCompleta.filter((d) => d.Proyectos > PUNTO_EQUILIBRIO_HORAS).length;

  const capturarGraficoComoPNG = async (contenedorRef, escala = 2) => {
    const svg = contenedorRef.current?.querySelector("svg");
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const ancho = rect.width || 720;
    const alto = rect.height || 280;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = ancho * escala;
          canvas.height = alto * escala;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png").split(",")[1]);
        };
        img.onerror = reject;
        img.src = url;
      });
      return { base64, ancho, alto };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const COLOR_HEADER = "FF1F3A5F";
  const COLOR_ACCENT = "FFE86A2C";
  const bordeFino = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  const estiloEncabezado = (celda, color = COLOR_HEADER) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    celda.border = bordeFino;
    celda.alignment = { vertical: "middle" };
  };

  const descargarReporteEjecutivo = async () => {
    const imagen = await capturarGraficoComoPNG(graficoRef);
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();

    // ---- Hoja: Resumen Ejecutivo ----
    const wsResumen = workbook.addWorksheet("Resumen Ejecutivo");
    wsResumen.mergeCells("A1:F1");
    const titulo = wsResumen.getCell("A1");
    titulo.value = "Departamento A&D Salvavidas";
    titulo.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_HEADER } };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    wsResumen.getRow(1).height = 30;

    wsResumen.mergeCells("A2:F2");
    const subtitulo = wsResumen.getCell("A2");
    subtitulo.value = `Reporte Ejecutivo — Horas Extras · Generado el ${new Date().toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" })}`;
    subtitulo.font = { italic: true, size: 11, color: { argb: "FF5B6572" } };
    subtitulo.alignment = { horizontal: "center" };
    wsResumen.getRow(2).height = 20;

    let fila = 4;
    if (imagen) {
      const anchoImgPx = 680;
      const altoImgPx = Math.round(anchoImgPx * (imagen.alto / imagen.ancho));
      const imageId = workbook.addImage({ base64: imagen.base64, extension: "png" });
      wsResumen.addImage(imageId, { tl: { col: 0.1, row: fila - 1 }, ext: { width: anchoImgPx, height: altoImgPx } });
      fila += Math.ceil(altoImgPx / 20) + 2;
    }

    wsResumen.getCell(`A${fila}`).value = "Indicador";
    wsResumen.getCell(`B${fila}`).value = "Valor";
    estiloEncabezado(wsResumen.getCell(`A${fila}`), COLOR_ACCENT);
    estiloEncabezado(wsResumen.getCell(`B${fila}`), COLOR_ACCENT);
    fila++;

    const indicadores = [
      ["Total horas Inspecciones", totalInspHoras],
      ["Total horas Proyectos", totalProyHoras],
      ["Promedio quincenal Inspecciones", promedioInspHoras],
      ["Promedio quincenal Proyectos", promedioProyHoras],
      ["Quincenas sobre 150h — Inspecciones", quincenasSobreInsp],
      ["Quincenas sobre 150h — Proyectos", quincenasSobreProy],
      ["Total facturado", fmtMoney(totalFacturado)],
      ["Promedio mensual facturado", fmtMoney(Math.round(avgFactura))],
    ];
    indicadores.forEach(([nombre, valor], i) => {
      const filaActual = fila + i;
      wsResumen.getCell(`A${filaActual}`).value = nombre;
      wsResumen.getCell(`B${filaActual}`).value = valor;
      wsResumen.getCell(`A${filaActual}`).border = bordeFino;
      wsResumen.getCell(`B${filaActual}`).border = bordeFino;
      if (i % 2 === 1) {
        wsResumen.getCell(`A${filaActual}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F7" } };
        wsResumen.getCell(`B${filaActual}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F7" } };
      }
    });
    wsResumen.getColumn(1).width = 36;
    wsResumen.getColumn(2).width = 20;
    wsResumen.getColumn(3).width = 14;
    wsResumen.getColumn(4).width = 14;
    wsResumen.getColumn(5).width = 14;
    wsResumen.getColumn(6).width = 14;

    // ---- Hoja: Horas por quincena ----
    const wsDatos = workbook.addWorksheet("Horas por quincena");
    ["Quincena", "Horas Inspecciones", "Horas Proyectos", "Total"].forEach((h, i) => {
      const celda = wsDatos.getCell(1, i + 1);
      celda.value = h;
      estiloEncabezado(celda);
    });
    horasQuincenalesDataCompleta.forEach((d, i) => {
      const f = i + 2;
      wsDatos.getCell(f, 1).value = d.quincena;
      wsDatos.getCell(f, 2).value = d.Inspecciones;
      wsDatos.getCell(f, 3).value = d.Proyectos;
      wsDatos.getCell(f, 4).value = d.Inspecciones + d.Proyectos;
      for (let c = 1; c <= 4; c++) wsDatos.getCell(f, c).border = bordeFino;
    });
    wsDatos.columns = [{ width: 16 }, { width: 20 }, { width: 18 }, { width: 12 }];

    // ---- Hoja: Facturación ----
    const wsFact = workbook.addWorksheet("Facturación");
    ["Mes", "Monto"].forEach((h, i) => {
      const celda = wsFact.getCell(1, i + 1);
      celda.value = h;
      estiloEncabezado(celda, "FF2E7D5B");
    });
    facturas.forEach((f, i) => {
      const fl = i + 2;
      wsFact.getCell(fl, 1).value = f.mes;
      wsFact.getCell(fl, 2).value = f.monto;
      wsFact.getCell(fl, 1).border = bordeFino;
      wsFact.getCell(fl, 2).border = bordeFino;
    });
    wsFact.columns = [{ width: 14 }, { width: 16 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_ejecutivo_${todayISO()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reiniciarAnioHoras = async () => {
    if (!(await confirmar(
      "¿Está seguro que desea reiniciar el histórico de horas extra quincenales? Esto borra TODOS los datos cargados a mano para empezar de cero (para un año nuevo). Esta acción no se puede deshacer.",
      { confirmLabel: "Sí, reiniciar", variant: "danger" }
    ))) return;
    const ids = horasManual.map((f) => f.id);
    setHorasManual([]);
    setVentanaHoras(0);
    ids.forEach((id) => supabase.from("horas_extras_manual").delete().eq("id", id).then());
  };

  const totalFacturado = facturas.reduce((s, f) => s + f.monto, 0);
  const avgFactura = totalFacturado / (facturas.length || 1);
  const mesesSobre = facturas.filter((f) => f.monto >= PUNTO_EQUILIBRIO).length;

  const totalVentanasFactura = Math.max(1, Math.ceil(facturas.length / VENTANA_MESES));
  const ventanaFacturaActual = Math.min(ventanaFactura, totalVentanasFactura - 1);
  const finVentanaFactura = facturas.length - ventanaFacturaActual * VENTANA_MESES;
  const inicioVentanaFactura = Math.max(0, finVentanaFactura - VENTANA_MESES);
  const facturasVentana = facturas.slice(inicioVentanaFactura, finVentanaFactura);

  const reiniciarAnioFacturacion = async () => {
    if (!(await confirmar(
      "¿Está seguro que desea reiniciar la facturación? Esto borra TODOS los meses cargados para empezar de cero (para un año nuevo). Esta acción no se puede deshacer.",
      { confirmLabel: "Sí, reiniciar", variant: "danger" }
    ))) return;
    const ids = facturas.map((f) => f.id);
    setFacturas([]);
    setVentanaFactura(0);
    ids.forEach((id) => supabase.from("facturacion").delete().eq("id", id).then());
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Total facturado</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.steel }}>{fmtMoney(totalFacturado)}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Promedio mensual</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.steel }}>{fmtMoney(avgFactura)}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Punto de equilibrio</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>{fmtMoney(PUNTO_EQUILIBRIO)}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Meses sobre el punto</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green }}>{mesesSobre} / {facturas.length}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>OD activos (total)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.steel }}>{totalActivos}</div>
        </Card>
      </div>

      <Card
        title="Facturación mensual vs. punto de equilibrio ($120,000)"
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => setVentanaFactura((v) => Math.min(v + 1, totalVentanasFactura - 1))} disabled={ventanaFacturaActual >= totalVentanasFactura - 1}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setVentanaFactura((v) => Math.max(v - 1, 0))} disabled={ventanaFacturaActual <= 0}><ChevronRight size={14} /></Btn>
            {isAdmin && <Btn small variant="danger" onClick={reiniciarAnioFacturacion}><X size={13} /> Reiniciar año</Btn>}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={facturasVentana} margin={{ top: 26, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <ReferenceLine y={PUNTO_EQUILIBRIO} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Punto de equilibrio", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
            <Line type="monotone" dataKey="monto" stroke={T.steel} strokeWidth={3} dot={{ r: 4 }}>
              <LabelList
                dataKey="monto"
                position="top"
                offset={12}
                formatter={(v) => fmtMoney(v)}
                style={{ fontSize: 11.5, fontWeight: 700, fill: T.ink }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>

        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, margin: "16px 0 8px" }}>Editar monto por mes</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {facturas.map((f) => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 3, background: T.graySoft, borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{f.mes}</span>
                <button onClick={() => eliminarMes(f.id)} title="Borrar mes" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
              <input
                type="number"
                value={f.monto}
                onChange={(e) => editarMonto(f.id, e.target.value)}
                style={{ ...inputStyle, width: 100, padding: "4px 6px", fontSize: 12.5, border: `1px solid ${T.line}` }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <Field label="Mes nuevo"><input style={inputStyle} value={nuevoMes.mes} onChange={(e) => setNuevoMes({ ...nuevoMes, mes: e.target.value })} placeholder="Jul" /></Field>
          <Field label="Monto facturado (USD)"><input style={inputStyle} type="number" value={nuevoMes.monto} onChange={(e) => setNuevoMes({ ...nuevoMes, monto: e.target.value })} placeholder="125000" /></Field>
          <Btn variant="accent" onClick={addFactura}><Plus size={14} /> Agregar mes</Btn>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="OD activos e inactivos — Proyectos vs. Inspecciones">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={odComparativo} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="area" tick={{ fontSize: 12.5, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Activos" fill={T.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="No Activos" fill={T.red} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="OD por área — vista circular">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={odPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                {odPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip /><Legend wrapperStyle={{ fontSize: 11.5 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="OD Correctivos — resumen general">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
          <div
            onClick={() => setFiltroCorrectivos("Todos")}
            style={{ background: T.amberSoft, borderRadius: 10, padding: 14, cursor: "pointer", outline: filtroCorrectivos === "Todos" ? `2px solid ${T.amber}` : "none" }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: T.amber }}>{totalCorrectivos}</div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>Total Correctivos</div>
          </div>
          <div
            onClick={() => setFiltroCorrectivos("Inspecciones")}
            style={{ background: T.graySoft, borderRadius: 10, padding: 14, cursor: "pointer", outline: filtroCorrectivos === "Inspecciones" ? `2px solid ${T.steel}` : "none" }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: T.steel }}>{normalInsp.length}</div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>En Inspecciones (OD IPM)</div>
          </div>
          <div
            onClick={() => setFiltroCorrectivos("Proyectos")}
            style={{ background: T.graySoft, borderRadius: 10, padding: 14, cursor: "pointer", outline: filtroCorrectivos === "Proyectos" ? `2px solid ${T.green}` : "none" }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{normalProj.length}</div>
            <div style={{ fontSize: 12, color: T.inkSoft }}>En Proyectos (OD Proyectos)</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>
          Personal — {filtroCorrectivos === "Todos" ? "OD Correctivos (Inspecciones y Proyectos)" : filtroCorrectivos === "Inspecciones" ? "OD IPM" : "OD Proyectos"}
        </div>
        {correctivosPorTecnicoData.length === 0 ? (
          <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay datos cargados en esta selección.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={correctivosPorTecnicoData} margin={{ top: 24, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="nombre" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="cantidad" fill={colorGraficoCorrectivos} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="cantidad" position="top" style={{ fontSize: 12, fontWeight: 700, fill: T.ink }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card
        title="Estadística de horas extras — Inspecciones vs. Proyectos"
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => setVentanaHoras((v) => Math.min(v + 1, totalVentanas - 1))} disabled={ventanaActual >= totalVentanas - 1}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setVentanaHoras((v) => Math.max(v - 1, 0))} disabled={ventanaActual <= 0}><ChevronRight size={14} /></Btn>
            <Btn small variant="ghost" onClick={descargarReporteEjecutivo}><Download size={13} /> Reporte Ejecutivo</Btn>
            {isAdmin && <Btn small variant="danger" onClick={reiniciarAnioHoras}><X size={13} /> Reiniciar año</Btn>}
          </div>
        }
      >
        {horasQuincenalesData.length === 0 ? (
          <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay quincenas cargadas.</div>
        ) : (
          <div ref={graficoRef}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={horasQuincenalesData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="quincena" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} domain={[0, (dataMax) => Math.max(180, Math.ceil(dataMax * 1.15))]} />
              <Tooltip formatter={(v) => `${v} h`} />
              <Legend />
              <ReferenceLine y={PUNTO_EQUILIBRIO_HORAS} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Límite 150h", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
              <Line type="monotone" dataKey="Inspecciones" stroke={T.turquoise} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Proyectos" stroke={T.green} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function GestionUsuarios() {
  const { users, refetchUsers } = useContext(UsersContext);
  const confirmar = useContext(ConfirmContext);
  const [form, setForm] = useState({ name: "", email: "", pin: "", categoria: "asistente" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const catInfo = (id) => CATEGORIAS_USUARIO.find((c) => c.id === id) || CATEGORIAS_USUARIO[1];
  const catColor = { admin: [T.accent, T.accentSoft], asistente: [T.blue, T.blueSoft], tecnico: [T.steel, T.graySoft] };

  const add = async () => {
    if (!form.name || !form.email || form.pin.length < 4) return;
    setBusy(true);
    setErrorMsg("");
    const { error } = await supabase.rpc("crear_usuario", {
      p_email: form.email, p_pin: form.pin, p_categoria: form.categoria, p_name: form.name, p_area: form.area || null,
    });
    setBusy(false);
    if (error) { setErrorMsg("No se pudo crear el usuario (¿correo repetido?)."); return; }
    setForm({ name: "", email: "", pin: "", categoria: "asistente" });
    refetchUsers();
  };
  const startEdit = (u) => { setEditId(u.id); setEditForm({ ...u }); };
  const cancelEdit = () => { setEditId(null); setEditForm(null); };
  const saveEdit = async () => {
    setBusy(true);
    setErrorMsg("");
    const { error } = await supabase.rpc("actualizar_usuario", {
      p_id: editId, p_email: editForm.email, p_pin: editForm.pin, p_categoria: editForm.categoria, p_name: editForm.name, p_area: editForm.area || null,
    });
    setBusy(false);
    if (error) { setErrorMsg("No se pudo guardar el cambio."); return; }
    cancelEdit();
    refetchUsers();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este usuario?"))) return;
    setBusy(true);
    const { error } = await supabase.rpc("eliminar_usuario", { p_id: id });
    setBusy(false);
    if (error) { setErrorMsg("No se pudo eliminar el usuario."); return; }
    refetchUsers();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
      <Card title="Usuarios del sistema">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Nombre</th><th>Correo</th><th>PIN</th><th>Categoría</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const editing = editId === u.id;
              return (
                <tr key={u.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 8px" }}>
                    {editing ? <input style={{ ...inputStyle, fontSize: 12.5, padding: "5px 8px" }} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /> : u.name}
                  </td>
                  <td>
                    {editing ? <input style={{ ...inputStyle, fontSize: 12.5, padding: "5px 8px" }} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /> : u.email}
                  </td>
                  <td>
                    {editing ? (
                      <input style={{ ...inputStyle, fontSize: 12.5, padding: "5px 8px", width: 100 }} value={editForm.pin} onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })} />
                    ) : "••••"}
                  </td>
                  <td>
                    {editing ? (
                      <select style={{ ...inputStyle, fontSize: 12.5, padding: "5px 8px" }} value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}>
                        {CATEGORIAS_USUARIO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    ) : (
                      <Badge color={catColor[u.categoria]?.[0] || T.gray} soft={catColor[u.categoria]?.[1] || T.graySoft}>{catInfo(u.categoria).label}</Badge>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: 6, padding: "9px 8px" }}>
                    {editing ? (
                      <>
                        <Btn small variant="success" onClick={saveEdit}><Check size={12} /></Btn>
                        <Btn small variant="ghost" onClick={cancelEdit}><X size={12} /></Btn>
                      </>
                    ) : (
                      <>
                        <Btn small variant="ghost" onClick={() => startEdit(u)}>Editar</Btn>
                        <Btn small variant="danger" onClick={() => del(u.id)}><X size={12} /></Btn>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Crear nuevo usuario">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Nombre"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Correo electrónico"><input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@empresa.com" /></Field>
          <Field label="Contraseña"><input style={inputStyle} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="Ej. NFPA72" /></Field>
          <Field label="Categoría">
            <select style={inputStyle} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {CATEGORIAS_USUARIO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Btn variant="accent" onClick={add} disabled={busy} style={{ justifyContent: "center" }}><Plus size={14} /> {busy ? "Guardando..." : "Crear usuario"}</Btn>
          {errorMsg && <div style={{ color: T.red, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><AlertCircle size={13} />{errorMsg}</div>}
        </div>
      </Card>
    </div>
  );
}

function Administrativo() {
  const [tab, setTab] = useState("resumen");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Btn variant={tab === "resumen" ? "accent" : "ghost"} small onClick={() => setTab("resumen")}>Resumen Ejecutivo</Btn>
        <Btn variant={tab === "usuarios" ? "accent" : "ghost"} small onClick={() => setTab("usuarios")}>Gestión de Usuarios</Btn>
      </div>
      {tab === "resumen" ? <ResumenEjecutivo /> : <GestionUsuarios />}
    </div>
  );
}

/* ---------------------------------------------------------
   APP SHELL
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   CALENDARIO GENERAL (todas las áreas, vista ampliada)
   --------------------------------------------------------- */
function CalendarioGlobal() {
  const [eventos, setEventos] = useState([]);
  const [eventosGoogle, setEventosGoogle] = useState([]);
  const [filtroArea, setFiltroArea] = useState("Todos");
  const [vista, setVista] = useState("agenda");
  const [cursor, setCursor] = useState(new Date());
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("calendario_eventos").select("*").order("fecha", { ascending: true });
      if (data) setEventos(data);
    })();
  }, []);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      const desde = new Date(cursor.getFullYear(), cursor.getMonth() - 2, 1);
      const hasta = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
      const [gInsp, gProy] = await Promise.all([
        fetchGoogleCalendarEventos("inspecciones", isoDate(desde), isoDate(hasta)),
        fetchGoogleCalendarEventos("proyectos", isoDate(desde), isoDate(hasta)),
      ]);
      if (activo) setEventosGoogle([...gInsp, ...gProy]);
    };
    cargar();
    // Vuelve a consultar Google Calendar cada 60 segundos mientras esta
    // vista esté abierta, para que las visitas nuevas aparezcan solas.
    const intervalo = setInterval(cargar, 60000);
    return () => { activo = false; clearInterval(intervalo); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.getMonth(), cursor.getFullYear()]);

  const AREA_INFO = {
    inspecciones: { label: "Inspecciones", color: T.turquoise, soft: T.turquoiseSoft },
    proyectos: { label: "Proyectos", color: T.green, soft: T.greenSoft },
    salud: { label: "Salud Ocupacional", color: T.red, soft: T.redSoft },
  };
  const FILTRO_OPCIONES = ["Todos", "Inspecciones", "Proyectos", "Salud Ocupacional"];
  const VISTAS = [
    { id: "mes", label: "Mes" },
    { id: "semana", label: "Semana" },
    { id: "dia", label: "Día" },
    { id: "agenda", label: "Agenda" },
  ];
  const colorDe = (e) => AREA_INFO[e.area]?.color || T.gray;

  const eventosFiltrados = [...eventos, ...eventosGoogle].filter((e) => {
    if (filtroArea === "Todos") return true;
    return (AREA_INFO[e.area]?.label || e.area) === filtroArea;
  });
  const eventosDelDia = (iso) => eventosFiltrados.filter((e) => e.fecha === iso).sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  // ---- datos para vista Agenda ----
  const grupos = {};
  eventosFiltrados.forEach((e) => {
    if (!e.fecha) return;
    (grupos[e.fecha] = grupos[e.fecha] || []).push(e);
  });
  const fechasAgenda = Object.keys(grupos).sort();

  // ---- datos para vista Mes ----
  const monthLabel = cursor.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const gridStart = startOfMonthGrid(cursor);
  const gridDaysMes = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // ---- datos para vista Semana ----
  const inicioSemana = new Date(cursor);
  inicioSemana.setDate(cursor.getDate() - cursor.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });
  const rangoSemanaLabel = `${diasSemana[0].toLocaleDateString("es-CR", { day: "numeric", month: "short" })} – ${diasSemana[6].toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}`;

  // ---- datos para vista Día ----
  const diaIso = isoDate(cursor);
  const eventosDiaUnico = eventosDelDia(diaIso);

  const navegar = (delta) => {
    if (vista === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (vista === "semana") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta * 7));
    else if (vista === "dia") setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + delta));
  };

  const renderPill = (e) => (
    <div
      key={e.id}
      title={`${e._google ? "Desde Google Calendar · " : ""}${AREA_INFO[e.area]?.label || e.area} · ${e.tipo} · ${e.hora} · ${e.personas}`}
      style={{
        background: colorDe(e), color: "#fff", fontWeight: 600, fontSize: 11,
        borderRadius: 6, padding: "3px 8px", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap", boxShadow: "0 1px 2px rgba(16,24,38,0.12)",
      }}
    >
      {e._google ? "G· " : ""}{e.od}{e.personas ? ` // ${e.personas}` : ""}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft }}>Filtrar por área</span>
            <select style={{ ...inputStyle, width: 200 }} value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
              {FILTRO_OPCIONES.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {VISTAS.map((v) => (
              <Btn key={v.id} small variant={vista === v.id ? "accent" : "ghost"} onClick={() => setVista(v.id)}>{v.label}</Btn>
            ))}
          </div>
        </div>
      </Card>

      {vista === "mes" && (
        <Card title={monthLabel} action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setCursor(new Date())}>Hoy</Btn>
            <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
          </div>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8, marginBottom: 10 }}>
            {DIAS_SEMANA_CORTO.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
            {gridDaysMes.map((d) => {
              const iso = isoDate(d);
              const esMesActual = d.getMonth() === cursor.getMonth();
              const esHoy = iso === todayISO();
              const eventosDia = eventosDelDia(iso);
              return (
                <div key={iso} style={{
                  minHeight: 140, border: `1px solid ${T.line}`, borderRadius: 10, padding: 8,
                  background: esMesActual ? T.panel : T.bg, display: "flex", flexDirection: "column", gap: 5,
                }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: esHoy ? 800 : 600, color: esMesActual ? (esHoy ? "#fff" : T.ink) : T.gray,
                    background: esHoy ? T.accent : "transparent", width: 24, height: 24, lineHeight: "24px",
                    textAlign: "center", borderRadius: "50%",
                  }}>{d.getDate()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, overflow: "hidden" }}>
                    {eventosDia.slice(0, CALENDARIO_MAX_VISIBLE).map(renderPill)}
                    {eventosDia.length > CALENDARIO_MAX_VISIBLE && (
                      <div style={{ fontSize: 10.5, color: T.gray, fontWeight: 700, paddingLeft: 4 }}>+{eventosDia.length - CALENDARIO_MAX_VISIBLE} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {vista === "semana" && (
        <Card title={rangoSemanaLabel} action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setCursor(new Date())}>Hoy</Btn>
            <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
          </div>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {diasSemana.map((d) => {
              const iso = isoDate(d);
              const esHoy = iso === todayISO();
              const eventosDia = eventosDelDia(iso);
              return (
                <div key={iso} style={{ minHeight: 280, border: `1px solid ${T.line}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ textAlign: "center", marginBottom: 2 }}>
                    <div style={{ fontSize: 10, color: T.gray, fontWeight: 800, textTransform: "uppercase" }}>{d.toLocaleDateString("es-CR", { weekday: "short" })}</div>
                    <div style={{
                      fontSize: 13, fontWeight: 800, color: esHoy ? "#fff" : T.ink,
                      background: esHoy ? T.accent : "transparent", width: 24, height: 24, lineHeight: "24px",
                      borderRadius: "50%", margin: "2px auto 0",
                    }}>{d.getDate()}</div>
                  </div>
                  {eventosDia.map(renderPill)}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {vista === "dia" && (
        <Card title={cursor.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => navegar(-1)}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setCursor(new Date())}>Hoy</Btn>
            <Btn small variant="ghost" onClick={() => navegar(1)}><ChevronRight size={14} /></Btn>
          </div>
        }>
          {eventosDiaUnico.length === 0 ? (
            <div style={{ color: T.gray, fontSize: 13 }}>Sin visitas agendadas este día.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {eventosDiaUnico.map((e) => (
                <div key={e.id} style={{ background: colorDe(e), color: "#fff", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>{AREA_INFO[e.area]?.label || e.area} · {e.hora}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.od}{e.personas ? ` // ${e.personas}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {vista === "agenda" && (
        <>
          {fechasAgenda.length === 0 && (
            <Card><div style={{ color: T.gray, fontSize: 13 }}>No hay eventos agendados todavía en esta selección.</div></Card>
          )}
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
            {fechasAgenda.map((fecha, idx) => {
              const fechaObj = new Date(fecha + "T00:00:00");
              const eventosDia = grupos[fecha].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
              return (
                <div key={fecha} style={{ display: "flex", borderTop: idx === 0 ? "none" : `1px solid ${T.line}` }}>
                  <div style={{ width: 76, flexShrink: 0, padding: "18px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "lowercase" }}>
                      {fechaObj.toLocaleDateString("es-CR", { weekday: "short" })}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: T.ink }}>{fechaObj.getDate()}</div>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "16px 16px 16px 0" }}>
                    {eventosDia.map((e) => (
                      <div
                        key={e.id}
                        title={`${AREA_INFO[e.area]?.label || e.area} · ${e.tipo} · ${e.hora} · ${e.personas}`}
                        style={{
                          background: colorDe(e), color: "#fff", fontWeight: 700, fontSize: 13,
                          borderRadius: 10, padding: "12px 16px", overflow: "hidden",
                          textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {e.od}{e.personas ? ` // ${e.personas}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   APERTURA DE OD
   --------------------------------------------------------- */
function AperturaOD() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const confirmar = useContext(ConfirmContext);
  const [rows, setRows] = useState([]);
  const [subTab, setSubTab] = useState("pendientes");
  const [form, setForm] = useState({ solicitante: "", od: "", cliente: "", fecha: todayISO(), tipo: "Normal", consecutivo: "" });
  const ESTADOS = ["Pendiente", "Solicitado", "Cancelado"];
  const ESTADO_COLOR = { Pendiente: [T.amber, T.amberSoft], Solicitado: [T.green, T.greenSoft], Cancelado: [T.red, T.redSoft] };
  const TIPO_APERTURA_OPCIONES = ["Normal", "QA", "OD Emergencia"];
  const TIPO_APERTURA_COLOR = { Normal: [T.gray, T.graySoft], QA: [T.blue, T.blueSoft], "OD Emergencia": [T.red, T.redSoft] };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("apertura_od").select("*").order("created_at", { ascending: false });
      if (data) setRows(data);
    })();
  }, []);

  const add = async () => {
    if (!form.solicitante || !form.od) return;
    const payload = { ...form, estado: "Pendiente", consecutivo: form.tipo === "Normal" ? null : form.consecutivo || null };
    setForm({ solicitante: "", od: "", cliente: "", fecha: todayISO(), tipo: "Normal", consecutivo: "" });
    const { data, error } = await supabase.from("apertura_od").insert(payload).select().single();
    if (!error && data) setRows((prev) => [data, ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("apertura_od").update({ estado }).eq("id", id).then();
  };
  const setTipo = (id, tipo) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, tipo } : r));
    supabase.from("apertura_od").update({ tipo }).eq("id", id).then();
  };
  const setConsecutivo = (id, consecutivo) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, consecutivo } : r));
    supabase.from("apertura_od").update({ consecutivo: consecutivo || null }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta solicitud de apertura? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("apertura_od").delete().eq("id", id).then();
  };

  const rowsPendientes = rows.filter((r) => r.estado === "Pendiente");
  const rowsAbiertos = rows.filter((r) => r.estado === "Solicitado" || r.estado === "Cancelado");
  const rowsMostradas = subTab === "pendientes" ? rowsPendientes : rowsAbiertos;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
      <Card title="Solicitudes de apertura de OD">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Btn small variant={subTab === "pendientes" ? "accent" : "ghost"} onClick={() => setSubTab("pendientes")}>Pendientes ({rowsPendientes.length})</Btn>
          <Btn small variant={subTab === "abiertos" ? "accent" : "ghost"} onClick={() => setSubTab("abiertos")}>Abiertos ({rowsAbiertos.length})</Btn>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Solicitante</th><th>OD</th><th>Cliente</th><th>Fecha</th><th>Tipo</th><th>Consecutivo</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rowsMostradas.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px" }}>{r.solicitante}</td>
                <td style={{ fontWeight: 700 }}>{r.od}</td>
                <td>{r.cliente}</td>
                <td>{r.fecha}</td>
                <td>
                  {isAdmin ? (
                    <select value={r.tipo || "Normal"} onChange={(e) => setTipo(r.id, e.target.value)} style={{ border: "none", background: (TIPO_APERTURA_COLOR[r.tipo] || TIPO_APERTURA_COLOR.Normal)[1], color: (TIPO_APERTURA_COLOR[r.tipo] || TIPO_APERTURA_COLOR.Normal)[0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {TIPO_APERTURA_OPCIONES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  ) : (
                    <Badge color={(TIPO_APERTURA_COLOR[r.tipo] || TIPO_APERTURA_COLOR.Normal)[0]} soft={(TIPO_APERTURA_COLOR[r.tipo] || TIPO_APERTURA_COLOR.Normal)[1]}>{r.tipo || "Normal"}</Badge>
                  )}
                </td>
                <td>
                  {r.tipo && r.tipo !== "Normal" ? (
                    isAdmin ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={r.consecutivo || ""} onChange={(e) => setConsecutivo(r.id, e.target.value)} placeholder="Consecutivo" />
                    ) : (r.consecutivo || "—")
                  ) : "—"}
                </td>
                <td>
                  {isAdmin ? (
                    <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: ESTADO_COLOR[r.estado][1], color: ESTADO_COLOR[r.estado][0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {ESTADOS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge color={ESTADO_COLOR[r.estado][0]} soft={ESTADO_COLOR[r.estado][1]}>{r.estado}</Badge>
                  )}
                </td>
                <td>{isAdmin && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Nueva solicitud de apertura">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Quién solicita"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></Field>
          <Field label="Número de OD"><input style={inputStyle} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} placeholder="OD-1005" /></Field>
          <Field label="Cliente"><input style={inputStyle} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
          <Field label="Fecha"><input style={inputStyle} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
          <Field label="Tipo de solicitud">
            <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPO_APERTURA_OPCIONES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          {form.tipo !== "Normal" && (
            <Field label="Consecutivo">
              <input style={inputStyle} value={form.consecutivo} onChange={(e) => setForm({ ...form, consecutivo: e.target.value })} placeholder="Ej. QA-045" />
            </Field>
          )}
          <Btn variant="accent" onClick={add} style={{ justifyContent: "center" }}><Plus size={14} /> Solicitar apertura</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   FACTURACIÓN (vista pública, solo lectura, para todos)
   --------------------------------------------------------- */
function FacturacionPublica() {
  const [facturas, setFacturas] = useState([]);
  const [ventana, setVentana] = useState(0);
  const VENTANA_MESES = 12;
  const PUNTO_EQUILIBRIO = 120000;
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("facturacion").select("*").order("created_at", { ascending: true });
      if (data) setFacturas(data);
    })();
  }, []);
  const totalVentanas = Math.max(1, Math.ceil(facturas.length / VENTANA_MESES));
  const ventanaActual = Math.min(ventana, totalVentanas - 1);
  const finVentana = facturas.length - ventanaActual * VENTANA_MESES;
  const inicioVentana = Math.max(0, finVentana - VENTANA_MESES);
  const facturasVentana = facturas.slice(inicioVentana, finVentana);
  return (
    <Card
      title="Facturación mensual vs. punto de equilibrio ($120,000)"
      action={facturas.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.min(v + 1, totalVentanas - 1))} disabled={ventanaActual >= totalVentanas - 1}><ChevronLeft size={14} /></Btn>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.max(v - 1, 0))} disabled={ventanaActual <= 0}><ChevronRight size={14} /></Btn>
        </div>
      )}
    >
      {facturas.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay datos de facturación cargados.</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={facturasVentana} margin={{ top: 26, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
            <Tooltip formatter={(v) => fmtMoney(v)} />
            <ReferenceLine y={PUNTO_EQUILIBRIO} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Punto de equilibrio", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
            <Line type="monotone" dataKey="monto" stroke={T.steel} strokeWidth={3} dot={{ r: 4 }}>
              <LabelList dataKey="monto" position="top" offset={12} formatter={(v) => fmtMoney(v)} style={{ fontSize: 11.5, fontWeight: 700, fill: T.ink }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------
   PLANILLA (placeholder — pendiente de definir alcance)
   --------------------------------------------------------- */
function Planilla() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const confirmar = useContext(ConfirmContext);
  const [tab, setTab] = useState("personal");
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState({ codigo: "", nombre: "", puesto: "", area: "" });
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("empleados").select("*").order("nombre", { ascending: true });
      if (data) setEmpleados(data);
    })();
  }, []);

  const add = async () => {
    if (!form.codigo || !form.nombre) return;
    const payload = { codigo: form.codigo, nombre: form.nombre, puesto: form.puesto || null, area: form.area || null, activo: true };
    setForm({ codigo: "", nombre: "", puesto: "", area: "" });
    const { data, error } = await supabase.from("empleados").insert(payload).select().single();
    if (!error && data) setEmpleados((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const toggleActivo = (id, activo) => {
    setEmpleados((prev) => prev.map((e) => e.id === id ? { ...e, activo } : e));
    supabase.from("empleados").update({ activo }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este empleado? Esta acción no se puede deshacer."))) return;
    setEmpleados((prev) => prev.filter((e) => e.id !== id));
    supabase.from("empleados").delete().eq("id", id).then();
  };

  // Importa un Excel con columnas Código / Nombre (y opcionalmente Puesto, Área).
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        const nuevos = json
          .map((row) => ({
            codigo: String(row["Código"] ?? row["Codigo"] ?? row["codigo"] ?? "").trim(),
            nombre: String(row["Nombre"] ?? row["nombre"] ?? "").trim(),
            puesto: row["Puesto"] ?? row["puesto"] ?? null,
            area: row["Área"] ?? row["Area"] ?? row["area"] ?? null,
            activo: true,
          }))
          .filter((r) => r.codigo && r.nombre);
        if (nuevos.length === 0) return;
        const { data: inserted, error } = await supabase.from("empleados").insert(nuevos).select();
        if (!error && inserted) setEmpleados((prev) => [...prev, ...inserted].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant={tab === "personal" ? "accent" : "ghost"} small onClick={() => setTab("personal")}>Personal</Btn>
        <Btn variant={tab === "reporte1" ? "accent" : "ghost"} small onClick={() => setTab("reporte1")}>Reporte 1</Btn>
        <Btn variant={tab === "reporte2" ? "accent" : "ghost"} small onClick={() => setTab("reporte2")}>Reporte Horas Extras</Btn>
      </div>

      {tab === "personal" && (
        <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "1.4fr 1fr" : "1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="Personal / Código de empleado" action={
              <div style={{ display: "flex", gap: 8 }}>
                {isAdmin && <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />}
                {isAdmin && <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Importar Excel</Btn>}
                <Btn small variant="ghost" onClick={() => exportExcel(empleados.map(({ codigo, nombre, puesto, area, activo }) => ({ Código: codigo, Nombre: nombre, Puesto: puesto, Área: area, Activo: activo ? "Sí" : "No" })), "empleados.xlsx")}><Download size={13} /> Excel</Btn>
              </div>
            }>
              <div style={{ fontSize: 11.5, color: T.gray, marginBottom: 12 }}>
                El Excel debe traer columnas <strong>Código</strong> y <strong>Nombre</strong> (opcional: Puesto, Área).
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <th style={{ padding: "6px 8px" }}>Código</th><th>Nombre</th><th>Puesto</th><th>Área</th><th>Activo</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e) => (
                    <tr key={e.id} style={{ borderTop: `1px solid ${T.line}` }}>
                      <td style={{ padding: "9px 8px", fontWeight: 700 }}>{e.codigo}</td>
                      <td>{e.nombre}</td>
                      <td>{e.puesto || "—"}</td>
                      <td>{e.area || "—"}</td>
                      <td>
                        {isAdmin ? (
                          <span onClick={() => toggleActivo(e.id, !e.activo)} style={{ cursor: "pointer" }}>
                            <Badge color={e.activo ? T.green : T.gray} soft={e.activo ? T.greenSoft : T.graySoft}>{e.activo ? "Activo" : "Inactivo"}</Badge>
                          </span>
                        ) : (
                          <Badge color={e.activo ? T.green : T.gray} soft={e.activo ? T.greenSoft : T.graySoft}>{e.activo ? "Activo" : "Inactivo"}</Badge>
                        )}
                      </td>
                      <td>{isAdmin && <Btn small variant="danger" onClick={() => del(e.id)}><X size={12} /></Btn>}</td>
                    </tr>
                  ))}
                  {empleados.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "14px 8px", color: T.gray, fontSize: 12.5 }}>Todavía no hay personal cargado. Importa un Excel o agrégalo manualmente.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          {isAdmin && (
            <Card title="Agregar empleado manualmente">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Código de empleado"><input style={inputStyle} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="EMP-004" /></Field>
                <Field label="Nombre"><input style={inputStyle} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" /></Field>
                <Field label="Puesto (opcional)"><input style={inputStyle} value={form.puesto} onChange={(e) => setForm({ ...form, puesto: e.target.value })} /></Field>
                <Field label="Área (opcional)"><input style={inputStyle} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="inspecciones / proyectos / salud" /></Field>
                <Btn variant="accent" onClick={add} style={{ justifyContent: "center" }}><Plus size={14} /> Agregar</Btn>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "reporte1" && (
        <Card title="Reporte 1">
        </Card>
      )}

      {tab === "reporte2" && (
        <Card title="Reporte Horas Extras">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="accent" onClick={() => reporte2Descargar("inspecciones")}><Download size={14} /> Descargar Inspecciones</Btn>
              <Btn variant="accent" onClick={() => reporte2Descargar("proyectos")}><Download size={14} /> Descargar Proyectos</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function AppInner() {
  const [user, setUser] = useState(() => {
    try {
      const guardado = localStorage.getItem("sesion_usuario");
      return guardado ? JSON.parse(guardado) : null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState(null);
  const { logo } = useContext(LogoContext);

  const iniciarSesion = (u) => {
    setUser(u);
    try { localStorage.setItem("sesion_usuario", JSON.stringify(u)); } catch {}
  };
  const cerrarSesion = () => {
    setUser(null);
    setTab(null);
    try { localStorage.removeItem("sesion_usuario"); } catch {}
  };

  const visibleAreas = useMemo(() => {
    if (!user) return [];
    // Todos los usuarios ven las 4 áreas operativas; Administrativo
    // (incluyendo Gestión de Usuarios) queda reservado solo para la
    // categoría "admin".
    if (user.categoria === "admin") return AREAS;
    return AREAS.filter((a) => a.id !== "admin");
  }, [user]);

  useEffect(() => {
    if (user && !tab) setTab(visibleAreas[0]?.id);
  }, [user]);

  if (!user) return <Login onLogin={iniciarSesion} />;

  if (user.categoria === "tecnico") {
    return (
      <CurrentUserContext.Provider value={user}>
        <VistaMovilTecnico user={user} onLogout={cerrarSesion} />
      </CurrentUserContext.Provider>
    );
  }

  const current = AREAS.find((a) => a.id === tab);

  return (
    <CurrentUserContext.Provider value={user}>
    <div style={{ minHeight: "100%", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", color: T.ink, display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: T.steel, color: "#fff", display: "flex", flexDirection: "column", padding: "20px 14px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px", marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: logo ? "transparent" : T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {logo ? <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Flame size={16} color="#fff" />}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>Departamento<br />A&D Salvavidas</div>
        </div>
        {user.categoria === "admin" && (
          <div style={{ padding: "0 8px", marginBottom: 20 }}>
            <LogoUploadButton small />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {visibleAreas.map((a) => {
            const Icon = a.icon;
            const activeTab = tab === a.id;
            return (
              <button key={a.id} onClick={() => setTab(a.id)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
                background: activeTab ? "rgba(255,255,255,0.14)" : "transparent", border: "none",
                color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "left",
              }}>
                <Icon size={16} /> {a.label}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{user.email}</div>
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            <Badge color="#fff" soft="rgba(255,255,255,0.14)">
              {CATEGORIAS_USUARIO.find((c) => c.id === user.categoria)?.label || user.categoria}
            </Badge>
          </div>
          <button onClick={cerrarSesion} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#fff", opacity: 0.85, cursor: "pointer", fontSize: 12.5 }}>
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          {current && <current.icon size={20} color={current.color} />}
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: -0.4 }}>{current?.label}</h1>
        </div>

        {tab === "inspecciones" && <AreaOperativa area="inspecciones" color={T.steel} />}
        {tab === "proyectos" && <AreaOperativa area="proyectos" color={T.green} />}
        {tab === "cotizaciones" && <Cotizaciones />}
        {tab === "salud" && <SaludOcupacional />}
        {tab === "apertura" && <AperturaOD />}
        {tab === "calendario_global" && <CalendarioGlobal />}
        {tab === "facturacion_publica" && <FacturacionPublica />}
        {tab === "planilla" && <Planilla />}
        {tab === "admin" && <Administrativo />}
      </div>
    </div>
    </CurrentUserContext.Provider>
  );
}

/* ---------------------------------------------------------
   VISTA MOVIL — pensada para técnicos en campo (celular).
   Solo 4 secciones esenciales, tarjetas grandes, sin tablas.
   --------------------------------------------------------- */
function VistaMovilTecnico({ user, onLogout }) {
  const [tab, setTab] = useState("od");
  const confirmar = useContext(ConfirmContext);
  const { clientes } = useContext(ClientesContext);
  const nombre = (user.name || "").trim().toLowerCase();

  const TABS = [
    { id: "od", label: "Mis OD", icon: ClipboardList },
    { id: "horas", label: "Horas Extras", icon: Clock },
    { id: "ehs", label: "Cursos EHS", icon: HardHat },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
  ];

  const cardStyle = { background: T.panel, borderRadius: 14, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(16,24,38,0.08)" };
  const labelStyle = { fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 5, display: "block" };
  const bigInputStyle = { width: "100%", padding: "12px 14px", fontSize: 15.5, borderRadius: 10, border: `1px solid ${T.line}`, background: "#fff", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100%", background: T.bg, fontFamily: "'Inter', -apple-system, sans-serif", color: T.ink, display: "flex", flexDirection: "column" }}>
      <div style={{ background: T.steel, color: "#fff", padding: "18px 18px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{user.name}</div>
          <div style={{ fontSize: 12.5, opacity: 0.8 }}>Técnico</div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 10, padding: "9px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <LogOut size={15} /> Salir
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 90px" }}>
        {tab === "od" && <MovilMisOD nombre={nombre} clientes={clientes} cardStyle={cardStyle} />}
        {tab === "horas" && <MovilHorasExtras nombre={nombre} user={user} cardStyle={cardStyle} labelStyle={labelStyle} bigInputStyle={bigInputStyle} />}
        {tab === "ehs" && <MovilCursosEHS nombre={nombre} cardStyle={cardStyle} bigInputStyle={bigInputStyle} />}
        {tab === "calendario" && <MovilCalendario cardStyle={cardStyle} />}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: T.panel,
        borderTop: `1px solid ${T.line}`, display: "flex", boxShadow: "0 -2px 10px rgba(16,24,38,0.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const activo = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "10px 4px 8px", background: "transparent", border: "none",
                color: activo ? T.accent : T.gray, cursor: "pointer",
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MovilMisOD({ nombre, clientes, cardStyle }) {
  const [filtroArea, setFiltroArea] = useState("Todos");
  const inspRows = clientes.inspecciones || [];
  const projRows = clientes.proyectos || [];
  const misOD = [...inspRows.map((r) => ({ ...r, area: "inspecciones" })), ...projRows.map((r) => ({ ...r, area: "proyectos" }))]
    .filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre)
    .filter((r) => filtroArea === "Todos" || r.area === filtroArea);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn small variant={filtroArea === "Todos" ? "accent" : "ghost"} onClick={() => setFiltroArea("Todos")}>Todos ({inspRows.filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre).length + projRows.filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre).length})</Btn>
        <Btn small variant={filtroArea === "inspecciones" ? "accent" : "ghost"} onClick={() => setFiltroArea("inspecciones")}>Inspecciones</Btn>
        <Btn small variant={filtroArea === "proyectos" ? "accent" : "ghost"} onClick={() => setFiltroArea("proyectos")}>Proyectos</Btn>
      </div>
      {misOD.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "30px 10px" }}>No tienes OD asignadas todavía.</div>
      ) : misOD.map((r) => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{r.od}</div>
            <Badge color={r.estado === "Activo" ? T.green : T.red} soft={r.estado === "Activo" ? T.greenSoft : T.redSoft}>{r.estado}</Badge>
          </div>
          <div style={{ fontSize: 14.5, color: T.ink, marginBottom: 4 }}>{r.cliente}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>
            {area_label(r.area)}{r.tipoOD === "Correctivo" ? " · Correctivo" : ""}
            {r.vencimiento ? ` · Vence: ${r.vencimiento}` : ""}
            {r.fechaEntrega ? ` · Entrega: ${r.fechaEntrega}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
function area_label(area) { return area === "inspecciones" ? "Inspecciones" : "Proyectos"; }

function MovilHorasExtras({ nombre, user, cardStyle, labelStyle, bigInputStyle }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ area: "inspecciones", od: "", fechaEjecucion: "", horaInicio: "07:00", horaFin: "15:00" });
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("horas_extras").select("*").order("created_at", { ascending: false });
      if (data) setRows(data.filter((r) => (r.personal || "").trim().toLowerCase() === nombre));
    })();
  }, [nombre]);

  const horas = calcularHorasRango(form.horaInicio, form.horaFin);

  const enviar = async () => {
    if (!form.od || !horas) { setAviso("Completa el OD y las horas."); return; }
    setAviso("");
    const payload = {
      area: form.area, fecha: todayISO(), fecha_ejecucion: form.fechaEjecucion || null, od: form.od,
      personal: user.name, hora_inicio: form.horaInicio, hora_fin: form.horaFin, horas, estado: "Pendiente",
    };
    const { data, error } = await supabase.from("horas_extras").insert(payload).select().single();
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setForm({ area: form.area, od: "", fechaEjecucion: "", horaInicio: "07:00", horaFin: "15:00" });
    }
  };

  const estadoColor = { Pendiente: [T.amber, T.amberSoft], Aprobada: [T.green, T.greenSoft], Rechazada: [T.red, T.redSoft], Cerrada: [T.steel, T.graySoft] };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Nueva solicitud</div>
        {aviso && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{aviso}</div>}
        <label style={labelStyle}>Área</label>
        <select style={{ ...bigInputStyle, marginBottom: 12 }} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
          <option value="inspecciones">Inspecciones</option>
          <option value="proyectos">Proyectos</option>
        </select>
        <label style={labelStyle}>OD</label>
        <input style={{ ...bigInputStyle, marginBottom: 12 }} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} placeholder="OD-1005" />
        <label style={labelStyle}>Fecha en que se ejecutarán</label>
        <input style={{ ...bigInputStyle, marginBottom: 12 }} type="date" value={form.fechaEjecucion} onChange={(e) => setForm({ ...form, fechaEjecucion: e.target.value })} />
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Desde</label>
            <input style={bigInputStyle} type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Hasta</label>
            <input style={bigInputStyle} type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 12 }}>Total: <b>{horas || 0}h</b> (se resta 1h de almuerzo si cruza mediodía)</div>
        <Btn variant="accent" onClick={enviar} style={{ justifyContent: "center", width: "100%", padding: "14px 0", fontSize: 15 }}><Plus size={16} /> Solicitar</Btn>
      </div>

      <div style={{ fontSize: 15, fontWeight: 800, margin: "18px 4px 10px" }}>Mis solicitudes</div>
      {rows.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "20px 10px" }}>Todavía no has solicitado horas extra.</div>
      ) : rows.map((r) => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{r.od}</div>
            <Badge color={(estadoColor[r.estado] || [T.gray, T.graySoft])[0]} soft={(estadoColor[r.estado] || [T.gray, T.graySoft])[1]}>{r.estado}</Badge>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft }}>{r.fecha_ejecucion || r.fecha} · {r.hora_inicio}–{r.hora_fin} · {r.horas}h</div>
        </div>
      ))}
    </div>
  );
}

function MovilCursosEHS({ nombre, cardStyle, bigInputStyle }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cursos_ehs").select("*").order("created_at", { ascending: false });
      if (data) setRows(data.filter((r) => (r.personal || "").toLowerCase().includes(nombre)));
    })();
  }, [nombre]);

  const setFecha = (id, fecha) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fecha } : r));
    supabase.from("cursos_ehs").update({ fecha: fecha || null }).eq("id", id).then();
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("cursos_ehs").update({ estado }).eq("id", id).then();
  };

  if (rows.length === 0) {
    return <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "30px 10px" }}>No tienes cursos EHS asignados todavía.</div>;
  }

  return (
    <div>
      {rows.map((r) => {
        const efectivo = estadoEfectivoCurso(r);
        const venc = vencimientoCalculado(r.fecha);
        return (
          <div key={r.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>{r.tipo}</div>
              <Dot color={SEMAFORO[efectivo]} />
            </div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 10 }}>{r.lugar || "—"}{venc ? ` · Vence: ${venc}` : ""}</div>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, display: "block", marginBottom: 4 }}>Fecha del curso</label>
            <input type="date" style={{ ...bigInputStyle, marginBottom: 10 }} value={r.fecha || ""} onChange={(e) => setFecha(r.id, e.target.value)} />
            <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ ...bigInputStyle, background: `${SEMAFORO[efectivo]}1A`, color: SEMAFORO[efectivo], fontWeight: 700 }}>
              {["Pendiente", "Coordinado", "Cancelado", "Realizado"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

function MovilCalendario({ cardStyle }) {
  const [eventos, setEventos] = useState([]);
  useEffect(() => {
    (async () => {
      const desde = todayISO();
      const hasta = new Date(); hasta.setDate(hasta.getDate() + 30);
      const { data } = await supabase.from("calendario_eventos").select("*").gte("fecha", desde).lte("fecha", hasta.toISOString().slice(0, 10)).order("fecha", { ascending: true });
      if (data) setEventos(data);
    })();
  }, []);

  const AREA_LABEL = { inspecciones: "Inspecciones", proyectos: "Proyectos", salud: "Salud Ocupacional" };
  const AREA_COLOR = { inspecciones: T.turquoise, proyectos: T.green, salud: T.red };

  const grupos = {};
  eventos.forEach((e) => { (grupos[e.fecha] = grupos[e.fecha] || []).push(e); });
  const fechas = Object.keys(grupos).sort();

  if (fechas.length === 0) {
    return <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "30px 10px" }}>No hay visitas agendadas en los próximos 30 días.</div>;
  }

  return (
    <div>
      {fechas.map((fecha) => {
        const fechaObj = new Date(fecha + "T00:00:00");
        return (
          <div key={fecha} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: T.inkSoft, marginBottom: 8, textTransform: "capitalize" }}>
              {fechaObj.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "short" })}
            </div>
            {grupos[fecha].sort((a, b) => (a.hora || "").localeCompare(b.hora || "")).map((e) => (
              <div key={e.id} style={{ ...cardStyle, borderLeft: `5px solid ${AREA_COLOR[e.area] || T.gray}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: AREA_COLOR[e.area] || T.gray, marginBottom: 4 }}>{AREA_LABEL[e.area] || e.area} · {e.hora}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{e.od}</div>
                {e.personas && <div style={{ fontSize: 13, color: T.inkSoft }}>{e.personas}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [logo, setLogoState] = useState(null);
  const setLogo = (value) => {
    setLogoState(value);
    supabase.from("app_config").upsert({ key: "logo", value }).then();
  };
  const [users, setUsers] = useState([]);
  const [clientes, setClientes] = useState({ inspecciones: [], proyectos: [] });

  const refetchUsers = async () => {
    const { data, error } = await supabase.rpc("listar_usuarios");
    if (!error && data) setUsers(data);
  };

  const refetchClientes = async () => {
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setClientes({
        inspecciones: data.filter((r) => r.area === "inspecciones").map(odRowFromDb),
        proyectos: data.filter((r) => r.area === "proyectos").map(odRowFromDb),
      });
    }
  };

  const refetchLogo = async () => {
    const { data } = await supabase.from("app_config").select("value").eq("key", "logo").maybeSingle();
    if (data?.value) setLogoState(data.value);
  };

  useEffect(() => {
    refetchUsers();
    refetchClientes();
    refetchLogo();
  }, []);

  return (
    <LogoContext.Provider value={{ logo, setLogo }}>
      <UsersContext.Provider value={{ users, refetchUsers }}>
        <ClientesContext.Provider value={{ clientes, setClientes }}>
          <ConfirmProvider>
            <AppInner />
          </ConfirmProvider>
        </ClientesContext.Provider>
      </UsersContext.Provider>
    </LogoContext.Provider>
  );
}
