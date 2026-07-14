import React, { useState, useMemo, useEffect, useContext, createContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine, LineChart, Line, LabelList
} from "recharts";
import * as XLSX from "xlsx";
import {
  LogOut, Plus, Download, Check, X, Clock, ClipboardList,
  CalendarDays, FileText, HardHat, LayoutDashboard, Building2,
  ChevronLeft, ChevronRight, AlertCircle, Upload, Flame
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
  const [pending, setPending] = useState(null); // { mensaje, resolve }

  const confirmar = (mensaje = "¿Está seguro que desea eliminar este registro? Esta acción no se puede deshacer.") =>
    new Promise((resolve) => setPending({ mensaje, resolve }));

  const responder = (ok) => {
    pending?.resolve(ok);
    setPending(null);
  };

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
              <AlertCircle size={20} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.5 }}>{pending.mensaje}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => responder(false)}>Cancelar</Btn>
              <Btn variant="danger" onClick={() => responder(true)}>Sí, eliminar</Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
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
  if (r.estado === "Cancelado" || r.estado === "Realizado") return r.estado;
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

/* ---------------------------------------------------------
   SEED DATA
   --------------------------------------------------------- */
const FRECUENCIA_OPCIONES = ["Semanal", "Mensual", "Bimensual", "Trimestral", "Cuatrimestral", "Semestral", "Anual"];

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
  { id: uid(), consecutivo: "00001", solicitante: "J. Solano", cliente: "Grupo Andina S.A.", contacto: "R. Méndez", email: "compras@andina.com", telefono: "8888-1111", provincia: "San José", dias: 5, personal: "2 técnicos", descripcion: "Montaje de andamio Layher para mantenimiento de fachada.", equipos: "2x Andamio / Layher / Layher 3000", dispositivos: "Materiales de anclaje, detector de gases", numCot: "COT-0451", estado: "Cerrado" },
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
    accion: r.accion || "",
    area: r.area,
  };
}
const ODFIELD_TO_DB = { fechaInicio: "fecha_inicio", fechaEntrega: "fecha_entrega" };
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
    estado: r.estado || "Abierto",
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
  const confirmar = useContext(ConfirmContext);
  const [disponible, setDisponibleState] = useState(150);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ od: "", personal: "", horas: "" });
  const used = rows.reduce((s, r) => s + (r.estado !== "Rechazada" ? Number(r.horas) : 0), 0);
  const saldo = disponible - used;

  useEffect(() => {
    (async () => {
      const { data: filas } = await supabase.from("horas_extras").select("*").eq("area", area).order("created_at", { ascending: false });
      if (filas) setRows(filas);
      const { data: config } = await supabase.from("horas_disponible").select("*").eq("area", area).single();
      if (config) setDisponibleState(Number(config.disponible));
    })();
  }, [area]);

  const setDisponible = (valor) => {
    setDisponibleState(valor);
    supabase.from("horas_disponible").upsert({ area, disponible: valor }).then();
  };

  const add = async () => {
    if (!form.od || !form.horas) return;
    const payload = { area, fecha: todayISO(), od: form.od, personal: form.personal, horas: Number(form.horas), estado: "Pendiente" };
    setForm({ od: "", personal: "", horas: "" });
    const { data, error } = await supabase.from("horas_extras").insert(payload).select().single();
    if (!error && data) setRows((prev) => [data, ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
    supabase.from("horas_extras").update({ estado }).eq("id", id).then();
  };
  const setPersonal = (id, personal) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, personal } : r)));
    supabase.from("horas_extras").update({ personal }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta solicitud de horas extra? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("horas_extras").delete().eq("id", id).then();
  };

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
            <Field label="Personal asistente"><input style={inputStyle} value={form.personal} onChange={(e) => setForm({ ...form, personal: e.target.value })} placeholder="Nombres" /></Field>
            <Field label="Horas"><input style={inputStyle} type="number" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} /></Field>
            <Btn onClick={add} variant="accent" style={{ justifyContent: "center" }}><Plus size={14} /> Solicitar</Btn>
          </div>
        </Card>
      </div>

      <Card title="Solicitudes" action={<Btn small variant="ghost" onClick={() => exportExcel(rows.map(({ fecha, od, personal, horas, estado }) => ({ Fecha: fecha, OD: od, Personal: personal, Horas: horas, Estado: estado })), `horas_${area}.xlsx`)}><Download size={13} /> Excel</Btn>}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Fecha</th><th>OD</th><th>Personal</th><th>Horas</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px" }}>{r.fecha}</td>
                <td>{r.od}</td>
                <td>
                  {isAdmin ? (
                    <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.personal} onChange={(e) => setPersonal(r.id, e.target.value)} />
                  ) : (r.personal || "—")}
                </td>
                <td>{r.horas}h</td>
                <td><Badge color={r.estado === "Aprobada" ? T.green : r.estado === "Rechazada" ? T.red : T.amber} soft={r.estado === "Aprobada" ? T.greenSoft : r.estado === "Rechazada" ? T.redSoft : T.amberSoft}>{r.estado}</Badge></td>
                <td style={{ display: "flex", gap: 6, padding: "9px 8px" }}>
                  {isAdmin && r.estado === "Pendiente" && <>
                    <Btn small variant="success" onClick={() => setEstado(r.id, "Aprobada")}><Check size={12} /></Btn>
                    <Btn small variant="danger" onClick={() => setEstado(r.id, "Rechazada")}><X size={12} /></Btn>
                  </>}
                  {isAdmin && <Btn small variant="danger" onClick={() => del(r.id)} style={{ opacity: 0.7 }}>Borrar</Btn>}
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

function OrdenesTrabajo({ area, color }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canEditFechas = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const isInspecciones = area === "inspecciones";
  const isProyectos = area === "proyectos";
  const tecnicoLabel = isProyectos ? "Encargado" : "Técnico";
  const [rows, setRows] = useClientesArea(area);
  const [form, setForm] = useState({ od: "", cliente: "", tecnico: "" });
  const fileInputRef = React.useRef(null);

  const add = async () => {
    if (!form.od || !form.cliente) return;
    const payload = { area, od: form.od, cliente: form.cliente, estado: "Activo", tecnico: form.tecnico, accion: "" };
    setForm({ od: "", cliente: "", tecnico: "" });
    const { data, error } = await supabase.from("ordenes_trabajo").insert(payload).select().single();
    if (!error && data) setRows((prev) => [odRowFromDb(data), ...prev]);
  };
  const toggle = (id) => {
    if (!isAdmin) return;
    const actual = rows.find((r) => r.id === id);
    const estado = actual?.estado === "Activo" ? "No Activo" : "Activo";
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("ordenes_trabajo").update({ estado }).eq("id", id).then();
  };
  const ESTADO_OD_COLOR = { "Activo": [T.green, T.greenSoft], "No Activo": [T.red, T.redSoft], "Entregado": [T.blue, T.blueSoft] };
  const setEstadoOD = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("ordenes_trabajo").update({ estado }).eq("id", id).then();
  };
  const setAccion = (id, accion) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, accion } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ accion })).eq("id", id).then();
  };
  const setTecnico = (id, tecnico) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, tecnico } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ tecnico })).eq("id", id).then();
  };
  const setVencimiento = (id, vencimiento) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, vencimiento } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ vencimiento })).eq("id", id).then();
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
            frecuencia: row["Frecuencia"] ?? "",
            fecha_inicio: excelValueToISODate(row["Fecha de Inicio"] ?? "") || null,
            fecha_entrega: excelValueToISODate(row["Fecha de Entrega"] ?? "") || null,
            accion: row["Acción"] ?? row["Accion"] ?? row["accion"] ?? "",
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

  const activos = rows.filter((r) => r.estado === "Activo").length;
  const noActivos = rows.filter((r) => r.estado === "No Activo").length;
  const entregados = rows.filter((r) => r.estado === "Entregado").length;
  const pieData = isProyectos
    ? [{ name: "Activos", value: activos, fill: T.green }, { name: "No Activos", value: noActivos, fill: T.red }, { name: "Entregados", value: entregados, fill: T.blue }]
    : [{ name: "Activos", value: activos, fill: T.green }, { name: "No Activos", value: noActivos, fill: T.red }];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Clientes / OD" action={
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImport} />
            <Btn small variant="ghost" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Importar Excel</Btn>
            <Btn small variant="ghost" onClick={() => exportExcel(rows.map(({ od, cliente, estado, tecnico, vencimiento, frecuencia, fechaInicio, fechaEntrega, accion }) => ({
              OD: od, Cliente: cliente, "Activo/No Activo": estado, [`${tecnicoLabel} asignado`]: tecnico,
              ...(isInspecciones ? { "Fecha de Vencimiento": vencimiento, Frecuencia: frecuencia } : {}),
              ...(isProyectos ? { "Fecha de Inicio": fechaInicio, "Fecha de Entrega": fechaEntrega } : {}),
              Acción: accion,
            })), `od_${area}.xlsx`)}><Download size={13} /> Excel</Btn>
          </div>
        }>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "6px 8px" }}>OD</th><th>Cliente</th><th>Estado</th><th>{tecnicoLabel}</th>
                {isInspecciones && <th>Fecha de Vencimiento</th>}
                {isInspecciones && <th>Frecuencia</th>}
                {isProyectos && <th>Fecha de Inicio</th>}
                {isProyectos && <th>Fecha de Entrega</th>}
                <th>Acción</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 8px", fontWeight: 600 }}>{r.od}</td>
                  <td>{r.cliente}</td>
                  <td>
                    {isProyectos ? (
                      isAdmin ? (
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
                    ) : (
                      <span onClick={() => toggle(r.id)} style={{ cursor: isAdmin ? "pointer" : "default" }}>
                        <Badge color={r.estado === "Activo" ? T.green : T.red} soft={r.estado === "Activo" ? T.greenSoft : T.redSoft}><Dot color={r.estado === "Activo" ? T.green : T.red} />{r.estado}</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    {isAdmin ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 110 }} value={r.tecnico} onChange={(e) => setTecnico(r.id, e.target.value)} />
                    ) : (r.tecnico || "—")}
                  </td>
                  {isInspecciones && (
                    <td>
                      {canEditFechas ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.vencimiento || ""} onChange={(e) => setVencimiento(r.id, e.target.value)} />
                      ) : (r.vencimiento || "—")}
                    </td>
                  )}
                  {isInspecciones && (
                    <td>
                      {isAdmin ? (
                        <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }} value={r.frecuencia || ""} onChange={(e) => setFrecuencia(r.id, e.target.value)}>
                          <option value="">—</option>
                          {FRECUENCIA_OPCIONES.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      ) : (r.frecuencia || "—")}
                    </td>
                  )}
                  {isProyectos && (
                    <td>
                      {canEditFechas ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fechaInicio || ""} onChange={(e) => setFechaInicio(r.id, e.target.value)} />
                      ) : (r.fechaInicio || "—")}
                    </td>
                  )}
                  {isProyectos && (
                    <td>
                      {canEditFechas ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fechaEntrega || ""} onChange={(e) => setFechaEntrega(r.id, e.target.value)} />
                      ) : (r.fechaEntrega || "—")}
                    </td>
                  )}
                  <td>
                    {isAdmin ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px" }} placeholder="Acción tomada..." value={r.accion} onChange={(e) => setAccion(r.id, e.target.value)} />
                    ) : <span style={{ color: T.gray, fontSize: 12 }}>{r.accion || "—"}</span>}
                  </td>
                  <td>
                    {isAdmin && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}
                  </td>
                </tr>
              ))}
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
   MODULO: CALENDARIO — agenda semanal, líneas horizontales
   por hora (estilo Google Calendar).
   --------------------------------------------------------- */
const HORA_INICIO = 7;   // 7:00
const HORA_FIN = 18;     // 18:00
const HOUR_PX = 52;

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=domingo
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
const isoDate = (d) => d.toISOString().slice(0, 10);

function Calendario({ area, color, tipoLabel = ["Inspección", "Proyecto"] }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const confirmar = useContext(ConfirmContext);
  const [cursor, setCursor] = useState(new Date());
  const [eventos, setEventos] = useState(seedEventos(area).map((e) => ({ hora: "08:00", ...e })));
  const [form, setForm] = useState({ tipo: tipoLabel[0], od: "", personas: "", fecha: todayISO(), hora: "08:00" });
  const delEvento = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta visita agendada?"))) return;
    setEventos((prev) => prev.filter((e) => e.id !== id));
  };

  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);

  const rangeLabel = `${days[0].toLocaleDateString("es-CR", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" })}`;

  const addEvento = () => {
    if (!form.od || !form.fecha) return;
    setEventos([...eventos, { id: uid(), ...form, area }]);
    setForm({ ...form, od: "", personas: "" });
  };

  const eventosDelDia = (d) => eventos.filter((e) => e.fecha === isoDate(d));

  const topFor = (hora) => {
    const [h, m] = (hora || "08:00").split(":").map(Number);
    const clamped = Math.max(HORA_INICIO, Math.min(HORA_FIN, h + m / 60));
    return (clamped - HORA_INICIO) * HOUR_PX;
  };

  // Ahora mismo, para la línea indicadora de hora actual (solo visible en la columna de hoy)
  const now = new Date();
  const nowDecimal = now.getHours() + now.getMinutes() / 60;
  const showNowLine = nowDecimal >= HORA_INICIO && nowDecimal <= HORA_FIN;

  // Resumen semanal ordenado cronológicamente, estilo lista de planificador
  const eventosSemana = days.flatMap((d) => eventosDelDia(d).map((e) => ({ ...e, _dia: d })))
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
      <Card
        title={rangeLabel}
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small variant="ghost" onClick={() => setCursor(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7))}><ChevronLeft size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => setCursor(new Date())}>Hoy</Btn>
            <Btn small variant="ghost" onClick={() => setCursor(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7))}><ChevronRight size={14} /></Btn>
            <Btn small variant="ghost" onClick={() => exportExcel(eventos.map(({ tipo, od, personas, fecha, hora }) => ({ Tipo: tipo, OD: od, "Personas asignadas": personas, Fecha: fecha, Hora: hora })), `agenda_${area}.xlsx`)}><Download size={13} /> Excel</Btn>
          </div>
        }
        style={{ background: "#FFFDF9" }}
      >
        {/* Cabecera de días */}
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", borderBottom: `2px solid ${T.ink}` }}>
          <div />
          {days.map((d) => {
            const isToday = isoDate(d) === todayISO();
            return (
              <div key={d.toISOString()} style={{ textAlign: "center", padding: "4px 0 10px" }}>
                <div style={{ fontSize: 10, color: T.gray, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  {d.toLocaleDateString("es-CR", { weekday: "short" })}
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 800, color: isToday ? "#fff" : T.ink,
                  background: isToday ? color : "transparent", width: 27, height: 27, lineHeight: "27px",
                  borderRadius: "50%", margin: "3px auto 0", boxShadow: isToday ? `0 2px 6px ${color}55` : "none",
                }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        {/* Grilla estilo planificador: líneas punteadas tipo cuaderno + margen rojo */}
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7,1fr)", position: "relative" }}>
          {/* columna de horas con "margen" tipo agenda física */}
          <div style={{ borderRight: `2px solid ${T.accentSoft}`, position: "relative" }}>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX, fontSize: 10.5, color: T.gray, fontWeight: 600, textAlign: "right", paddingRight: 10, transform: "translateY(-6px)" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* columnas de días con líneas punteadas horizontales */}
          {days.map((d, di) => {
            const isToday = isoDate(d) === todayISO();
            return (
              <div key={d.toISOString()} style={{
                position: "relative",
                borderLeft: `1px solid ${T.line}`,
                background: isToday ? `${color}0A` : (di === 0 || di === 6) ? "#FAFAF7" : "transparent",
              }}>
                {hours.map((h) => (
                  <div key={h} style={{ height: HOUR_PX, borderBottom: `1px dashed ${T.line}` }} />
                ))}
                {isToday && showNowLine && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: (nowDecimal - HORA_INICIO) * HOUR_PX,
                    borderTop: `2px solid ${T.accent}`, zIndex: 2,
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, position: "absolute", left: -4, top: -4 }} />
                  </div>
                )}
                {eventosDelDia(d).map((e) => (
                  <div
                    key={e.id}
                    title={`${e.tipo} · ${e.od} · ${e.personas} · ${e.hora}`}
                    style={{
                      position: "absolute", left: 3, right: 3, top: topFor(e.hora), height: 44,
                      background: e.tipo === tipoLabel[1] ? T.greenSoft : T.accentSoft,
                      borderLeft: `3px solid ${e.tipo === tipoLabel[1] ? T.green : T.accent}`,
                      color: e.tipo === tipoLabel[1] ? T.green : T.accent,
                      borderRadius: 6, padding: "3px 6px", fontSize: 10.5, fontWeight: 700,
                      overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.08)", zIndex: 1,
                    }}
                  >
                    <div>{e.hora} · {e.od}</div>
                    <div style={{ fontWeight: 500, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.personas}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Resumen de la semana">
          {eventosSemana.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.gray }}>Sin visitas agendadas esta semana.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 260, overflowY: "auto" }}>
              {eventosSemana.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: `1px dashed ${T.line}`, paddingBottom: 8 }}>
                  <div style={{ marginTop: 4, width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: e.tipo === tipoLabel[1] ? T.green : T.accent }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>
                      {e._dia.toLocaleDateString("es-CR", { weekday: "short", day: "numeric" })} · {e.hora}
                    </div>
                    <div style={{ fontSize: 12, color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.od} — {e.personas}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => delEvento(e.id)} style={{ background: "transparent", border: "none", color: T.gray, cursor: "pointer", padding: 2, flexShrink: 0 }} title="Borrar">
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Agendar visita">
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
              {row("Descripción del trabajo", r.descripcion)}
              {row("Personal y puesto", r.personal)}
              {row("Equipos requeridos", r.equipos)}
              {row("Lista de dispositivos", r.dispositivos)}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: T.steel, margin: "22px 0 8px" }}>Estado de la solicitud</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {row("N° de cotización", r.numCot)}
              {row("Estatus", r.estado)}
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
  const confirmar = useContext(ConfirmContext);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [printRow, setPrintRow] = useState(null);
  const [form, setForm] = useState({
    solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "",
    dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Abierto",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cotizaciones").select("*").order("numero", { ascending: false });
      if (data) setRows(data.map(cotRowFromDb));
    })();
  }, []);

  const nextConsecutivo = String(rows.length + 1).padStart(5, "0");

  const submit = async () => {
    if (!form.solicitante || !form.cliente) return;
    const payload = {
      solicitante: form.solicitante, cliente: form.cliente, contacto: form.contacto, email: form.email,
      telefono: form.telefono, provincia: form.provincia, dias: form.dias || null, personal: form.personal,
      descripcion: form.descripcion, equipos: form.equipos, dispositivos: form.dispositivos,
      num_cot: form.numCot, estado: form.estado,
    };
    setForm({ solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "", dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Abierto" });
    setOpen(false);
    const { data, error } = await supabase.from("cotizaciones").insert(payload).select().single();
    if (!error && data) setRows((prev) => [cotRowFromDb(data), ...prev]);
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("cotizaciones").update({ estado }).eq("id", id).then();
  };
  const setNumCot = (id, numCot) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, numCot } : r));
    supabase.from("cotizaciones").update({ num_cot: numCot }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta cotización? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("cotizaciones").delete().eq("id", id).then();
  };

  const estadoColor = { Abierto: [T.amber, T.amberSoft], "En espera": [T.steelSoft, T.graySoft], Cerrado: [T.green, T.greenSoft], Cancelado: [T.red, T.redSoft] };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CotizacionPrintView r={printRow} onClose={() => setPrintRow(null)} />
      <Card
        title={`Historial de solicitudes — próximo consecutivo #${nextConsecutivo}`}
        action={<div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="ghost" onClick={() => exportExcel(rows.map(r => ({ Consecutivo: r.consecutivo, Solicitante: r.solicitante, Cliente: r.cliente, "Nombre del contacto": r.contacto, Email: r.email, Telefono: r.telefono, Provincia: r.provincia, Dias: r.dias, Personal: r.personal, "Descripción del trabajo": r.descripcion, Equipos: r.equipos, "Lista de dispositivos": r.dispositivos, "N° Cotización": r.numCot, Estado: r.estado })), "cotizaciones.xlsx")}><Download size={13} /> Excel</Btn>
          <Btn small variant="accent" onClick={() => setOpen(!open)}><Plus size={13} /> Nueva solicitud</Btn>
        </div>}
      >
        {open && (
          <div style={{ background: T.graySoft, borderRadius: 10, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <Field label="Nombre del solicitante"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></Field>
            <Field label="Cliente"><input style={inputStyle} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></Field>
            <Field label="Nombre del contacto"><input style={inputStyle} value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></Field>
            <Field label="Email"><input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Teléfono"><input style={inputStyle} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
            <Field label="Provincia"><input style={inputStyle} value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></Field>
            <Field label="Días de implementación"><input style={inputStyle} type="number" value={form.dias} onChange={(e) => setForm({ ...form, dias: e.target.value })} /></Field>
            <Field label="Personal y puesto"><input style={inputStyle} value={form.personal} onChange={(e) => setForm({ ...form, personal: e.target.value })} placeholder="2 técnicos, 1 supervisor" /></Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Descripción del trabajo"><input style={inputStyle} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalle del trabajo a realizar..." /></Field>
            </div>
            <Field label="Equipos (cant./tipo/marca/modelo)"><input style={inputStyle} value={form.equipos} onChange={(e) => setForm({ ...form, equipos: e.target.value })} placeholder="1x Grúa / Terex / AC55" /></Field>
            <Field label="Lista de dispositivos"><input style={inputStyle} value={form.dispositivos} onChange={(e) => setForm({ ...form, dispositivos: e.target.value })} placeholder="Materiales y/o equipos..." /></Field>
            <Field label="N° de cotización (si aplica)"><input style={inputStyle} value={form.numCot} onChange={(e) => setForm({ ...form, numCot: e.target.value })} /></Field>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setOpen(false)}>Cancelar</Btn>
              <Btn variant="accent" onClick={submit}>Guardar solicitud</Btn>
            </div>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>#</th><th>Solicitante</th><th>Cliente</th><th>Provincia</th><th>Días</th><th>N° Cotización</th><th>Estado</th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px", fontWeight: 700 }}>{r.consecutivo}</td>
                <td>{r.solicitante}</td>
                <td>{r.cliente}</td>
                <td>{r.provincia}</td>
                <td>{r.dias}</td>
                <td>
                  {isAdmin ? (
                    <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={r.numCot} onChange={(e) => setNumCot(r.id, e.target.value)} placeholder="COT-000" />
                  ) : (r.numCot || "—")}
                </td>
                <td>
                  {isAdmin ? (
                    <select value={r.estado} onChange={(e) => setEstado(r.id, e.target.value)} style={{ border: "none", background: estadoColor[r.estado][1], color: estadoColor[r.estado][0], borderRadius: 999, fontSize: 12, fontWeight: 600, padding: "4px 10px" }}>
                      {Object.keys(estadoColor).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <Badge color={estadoColor[r.estado][0]} soft={estadoColor[r.estado][1]}>{r.estado}</Badge>
                  )}
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
  const confirmar = useContext(ConfirmContext);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ solicitante: "", personal: "", lugar: "", tipo: CURSO_TIPOS[0], fecha: "" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cursos_ehs").select("*").order("created_at", { ascending: false });
      if (data) setRows(data.map((r) => ({ ...r, fecha: r.fecha || "" })));
    })();
  }, []);

  const add = async () => {
    if (!form.solicitante || !form.personal) return;
    const payload = { ...form, fecha: form.fecha || null, estado: "Pendiente" };
    setForm({ solicitante: "", personal: "", lugar: "", tipo: CURSO_TIPOS[0], fecha: "" });
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
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este curso? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("cursos_ehs").delete().eq("id", id).then();
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
      <Card title="Solicitudes de curso" action={<Btn small variant="ghost" onClick={() => exportExcel(rows.map(r => ({ Solicitante: r.solicitante, Personal: r.personal, Lugar: r.lugar, Tipo: r.tipo, Estado: r.estado, Fecha: r.fecha, Vencimiento: vencimientoCalculado(r.fecha) || "" })), "cursos_ehs.xlsx")}><Download size={13} /> Excel</Btn>}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}></th><th>Tipo</th><th>Personal</th><th>Lugar</th><th>Fecha</th><th>Vence</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const efectivo = estadoEfectivoCurso(r);
              const venc = vencimientoCalculado(r.fecha);
              return (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 8px" }}><Dot color={SEMAFORO[efectivo]} /></td>
                  <td style={{ fontWeight: 600 }}>{r.tipo}</td>
                  <td>{r.personal}</td>
                  <td>{r.lugar}</td>
                  <td>
                    {isAdmin ? (
                      <input type="date" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 130 }} value={r.fecha || ""} onChange={(e) => setFecha(r.id, e.target.value)} title="Cambiar esta fecha renueva el curso y recalcula el vencimiento" />
                    ) : (r.fecha || "—")}
                  </td>
                  <td style={{ color: efectivo === "Vencido" ? T.red : T.inkSoft, fontWeight: efectivo === "Vencido" ? 700 : 500 }}>{venc || "—"}</td>
                  <td>
                    {isAdmin ? (
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
                  <td>{isAdmin && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Nueva solicitud de curso">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Solicitante"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} /></Field>
          <Field label="Personal que asistirá"><input style={inputStyle} value={form.personal} onChange={(e) => setForm({ ...form, personal: e.target.value })} placeholder="Nombres separados por coma" /></Field>
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
        <Btn variant={tab === "calendario" ? "accent" : "ghost"} small onClick={() => setTab("calendario")}>Agenda de visitas a Proyectos/Inspecciones</Btn>
      </div>
      {tab === "cursos" ? <CursosEHS /> : <Calendario area="salud" color={T.red} tipoLabel={["Inspección", "Proyecto"]} />}
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: INSPECCIONES / PROYECTOS (tabs internas)
   --------------------------------------------------------- */
function AreaOperativa({ area, color }) {
  const [tab, setTab] = useState("horas");
  const tabs = [
    { id: "horas", label: "Horas extras", icon: Clock },
    { id: "od", label: "OD", icon: ClipboardList },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => (
          <Btn key={t.id} variant={tab === t.id ? "accent" : "ghost"} small onClick={() => setTab(t.id)}>
            <t.icon size={13} /> {t.label}
          </Btn>
        ))}
      </div>
      {tab === "horas" && <HorasExtras area={area} color={color} />}
      {tab === "od" && <OrdenesTrabajo area={area} color={color} />}
      {tab === "calendario" && <Calendario area={area} color={color} />}
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: ADMINISTRATIVO (tabs internas: resumen / usuarios)
   --------------------------------------------------------- */
function ResumenEjecutivo() {
  const confirmar = useContext(ConfirmContext);
  const [facturas, setFacturas] = useState(seedFacturacion);
  const [nuevoMes, setNuevoMes] = useState({ mes: "", monto: "" });
  const { clientes } = useContext(ClientesContext);
  const PUNTO_EQUILIBRIO = 120000;

  const addFactura = () => {
    if (!nuevoMes.mes || !nuevoMes.monto) return;
    setFacturas([...facturas, { mes: nuevoMes.mes, monto: Number(nuevoMes.monto) }]);
    setNuevoMes({ mes: "", monto: "" });
  };
  const editarMonto = (i, monto) => setFacturas(facturas.map((f, idx) => idx === i ? { ...f, monto: Number(monto) || 0 } : f));
  const eliminarMes = async (i) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este mes de facturación?"))) return;
    setFacturas(facturas.filter((_, idx) => idx !== i));
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

  const avgFactura = facturas.reduce((s, f) => s + f.monto, 0) / (facturas.length || 1);
  const mesesSobre = facturas.filter((f) => f.monto >= PUNTO_EQUILIBRIO).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
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

      <Card title="Facturación mensual vs. punto de equilibrio ($120,000)">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={facturas} margin={{ top: 26, right: 20, left: 0, bottom: 0 }}>
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
          {facturas.map((f, i) => (
            <div key={f.mes + i} style={{ display: "flex", flexDirection: "column", gap: 3, background: T.graySoft, borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>{f.mes}</span>
                <button onClick={() => eliminarMes(i)} title="Borrar mes" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
              </div>
              <input
                type="number"
                value={f.monto}
                onChange={(e) => editarMonto(i, e.target.value)}
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
function AppInner() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(null);
  const { logo } = useContext(LogoContext);

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

  if (!user) return <Login onLogin={(u) => setUser(u)} />;

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
          <button onClick={() => { setUser(null); setTab(null); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#fff", opacity: 0.85, cursor: "pointer", fontSize: 12.5 }}>
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
        {tab === "admin" && <Administrativo />}
      </div>
    </div>
    </CurrentUserContext.Provider>
  );
}

export default function App() {
  const [logo, setLogo] = useState(null);
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

  useEffect(() => {
    refetchUsers();
    refetchClientes();
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
