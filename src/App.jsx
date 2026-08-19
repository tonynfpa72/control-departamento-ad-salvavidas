import React, { useState, useMemo, useEffect, useContext, createContext } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ReferenceLine, LineChart, Line, LabelList
} from "recharts";
import * as XLSX from "xlsx";
import {
  LogOut, Plus, Download, Check, X, Clock, ClipboardList,
  CalendarDays, FileText, HardHat, LayoutDashboard, Building2,
  ChevronLeft, ChevronRight, AlertCircle, Upload, Flame, Wallet, CreditCard, Truck, Package, GraduationCap, Award,
  Star, Trophy, Zap, Target, Medal, Rocket, Crown, Sparkles, ShieldCheck, Gem, Repeat, Lock
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
  { id: "equipos", label: "Equipos", icon: Package, color: T.amber },
  { id: "facturacion_publica", label: "Facturación", icon: LayoutDashboard, color: T.green },
  { id: "gastos_tarjeta", label: "Gastos de Tarjeta", icon: CreditCard, color: T.red },
  { id: "vehiculos", label: "Vehículos", icon: Truck, color: T.blue },
  { id: "planilla", label: "Planilla", icon: Wallet, color: T.amber },
  { id: "entrenamiento", label: "Entrenamiento", icon: GraduationCap, color: T.turquoise },
  { id: "admin", label: "Administrativo", icon: LayoutDashboard, color: T.steelSoft },
];

// Categorías de usuario disponibles para Gestión de Usuarios (solo Admin las crea)
const CATEGORIAS_USUARIO = [
  { id: "admin", label: "Admin" },
  { id: "asistente", label: "Asistente" },
  { id: "tecnico", label: "Técnico" },
  { id: "ehs", label: "EHS" },
  { id: "entrenamiento", label: "Entrenamiento" },
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

// Ícono de trofeo para Entrenamiento: cada rango se representa con un
// componente real de un sistema de alarma contra incendio, en orden de
// complejidad creciente.
function IconTrofeo({ tipo, size = 16, color = "#000" }) {
  const s = color;
  const iconos = {
    estacion_manual: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke={s} strokeWidth="2" />
        <path d="M7 17 L17 7" stroke={s} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 7 H17 V12" stroke={s} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    detector_humo: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={s} strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill={s} />
        <circle cx="12" cy="12" r="9" stroke={s} strokeWidth="1" strokeDasharray="1 3" />
      </svg>
    ),
    sensor_flama: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={s}>
        <path d="M12 2c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-2.5.8 3 3 3.5 3 6.5a5 5 0 0 1-10 0c0-4 3-5 3-9 0-1.2.5-2.3 2-3z" />
      </svg>
    ),
    modulo_monitor: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke={s} strokeWidth="2" />
        <circle cx="8" cy="12" r="2" fill={s} />
        <path d="M13 9h5M13 12h5M13 15h5" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    modulo_rele: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke={s} strokeWidth="2" />
        <path d="M7 9 a3 3 0 1 0 0.001 0" stroke={s} strokeWidth="1.6" />
        <path d="M11 12h4l-1.5-1.5M15 12l-1.5 1.5" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    bateria_12v: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="16" height="10" rx="1.5" stroke={s} strokeWidth="2" />
        <rect x="18" y="10" width="2.5" height="4" fill={s} />
        <path d="M6 12h3M7.5 10.5v3" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 12h3" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    panel: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke={s} strokeWidth="2" />
        <circle cx="8" cy="7" r="1.4" fill={s} />
        <circle cx="12.5" cy="7" r="1.4" fill={s} />
        <circle cx="17" cy="7" r="1.4" fill={s} />
        <path d="M6 12h12M6 15h12M6 18h8" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  };
  return iconos[tipo] || null;
}

// Insignia estilo "medalla" (inspirado en Duolingo): círculo con
// degradado de color y brillo cuando está desbloqueada, gris con candado
// cuando no. Puede mostrar una barra/leyenda de progreso (ej. "3/5").
// Anima un número contando desde su valor anterior hasta el nuevo (en vez
// de saltar directo) — le da sensación de "marcador" real cuando suman
// puntos.
function NumeroAnimado({ valor }) {
  const [mostrado, setMostrado] = useState(valor);
  const prevRef = React.useRef(valor);
  useEffect(() => {
    const inicio = prevRef.current;
    const fin = valor;
    if (inicio === fin) return;
    const duracion = 600;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duracion);
      setMostrado(Math.round(inicio + (fin - inicio) * p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = fin;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <>{mostrado}</>;
}

function InsigniaMedalla({ nombre, desc, Icono, colorDesde, colorHasta, cumplido, progresoTexto, progresoPct }) {
  const gradId = "grad-" + nombre.replace(/\s+/g, "-").toLowerCase();
  return (
    <div title={desc} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "clamp(85px, 26vw, 108px)",
      opacity: cumplido ? 1 : 0.55, transition: "opacity 0.2s, transform 0.2s", cursor: "default",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <style>{`@keyframes insigniaGlow { 0%,100% { filter: drop-shadow(0 0 0px ${colorHasta}); } 50% { filter: drop-shadow(0 0 6px ${colorHasta}); } }
        @keyframes brilloBarra { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
      <div style={{ position: "relative", width: 68, height: 68, animation: cumplido ? "insigniaGlow 2.5s ease-in-out infinite" : "none" }}>
        <svg width="68" height="68" viewBox="0 0 68 68" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colorDesde} />
              <stop offset="100%" stopColor={colorHasta} />
            </linearGradient>
          </defs>
          <circle cx="34" cy="34" r="32" fill={cumplido ? `url(#${gradId})` : T.graySoft} stroke={cumplido ? colorHasta : T.line} strokeWidth="2" />
          {cumplido && <circle cx="34" cy="34" r="32" fill="none" stroke="#fff" strokeWidth="1.5" strokeOpacity="0.4" />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {cumplido ? <Icono size={30} color="#fff" strokeWidth={2.2} /> : <Lock size={22} color={T.gray} strokeWidth={2} />}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: cumplido ? T.ink : T.gray, textAlign: "center", lineHeight: 1.2 }}>{nombre}</div>
      {progresoTexto && (
        <div style={{ width: "100%" }}>
          <div style={{ height: 5, background: T.graySoft, borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${Math.min(100, progresoPct)}%`, background: cumplido ? colorHasta : T.line, transition: "width 0.4s ease", position: "relative", overflow: "hidden" }}>
              {progresoPct > 0 && progresoPct < 100 && (
                <div style={{ position: "absolute", inset: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)", animation: "brilloBarra 1.8s ease-in-out infinite" }} />
              )}
            </div>
          </div>
          <div style={{ fontSize: 9.5, color: T.gray, textAlign: "center", marginTop: 2 }}>{progresoTexto}</div>
        </div>
      )}
    </div>
  );
}

// Tarjeta de "misión" para elegir módulo dentro de Entrenamiento — estilo
// juego: fondo con degradado del color del módulo, ícono grande, lema
// motivacional, barra de progreso, y un trofeo cuando ya está al 100%.
function MisionCard({ label, Icono, colorDesde, colorHasta, lema, puntos, max, seleccionada, onClick }) {
  const pct = max > 0 ? Math.min(100, (puntos / max) * 100) : 0;
  const completa = max > 0 && puntos >= max;
  const casiCompleta = max > 0 && pct >= 90 && !completa;
  return (
    <button onClick={onClick} style={{
      position: "relative", width: "clamp(150px, 44vw, 190px)", textAlign: "left", border: "none", borderRadius: 16, padding: 0, cursor: "pointer",
      overflow: "hidden", boxShadow: seleccionada ? `0 0 0 3px ${colorHasta}, 0 8px 18px ${colorHasta}55` : "0 2px 8px rgba(0,0,0,0.08)",
      transform: seleccionada ? "translateY(-3px)" : "translateY(0)", transition: "transform 0.15s, box-shadow 0.15s",
      animation: casiCompleta ? "misionCasiLista 1.6s ease-in-out infinite" : "none",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = seleccionada ? "translateY(-3px)" : "translateY(0)"; }}
    >
      <style>{`@keyframes misionCasiLista { 0%,100% { box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 0px ${colorHasta}00; } 50% { box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 0 14px ${colorHasta}99; } }
        @keyframes brilloBarraMision { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
      <div style={{ background: `linear-gradient(135deg, ${colorDesde}, ${colorHasta})`, padding: "16px 16px 14px" }}>
        {completa && (
          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.9)", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trophy size={14} color="#f59f00" fill="#f59f00" />
          </div>
        )}
        <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <Icono size={22} color="#fff" strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.3, minHeight: 26 }}>{lema}</div>
      </div>
      <div style={{ background: "#fff", padding: "10px 14px" }}>
        <div style={{ height: 6, background: T.graySoft, borderRadius: 99, overflow: "hidden", marginBottom: 5, position: "relative" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: colorHasta, transition: "width 0.4s ease", position: "relative", overflow: "hidden" }}>
            {pct > 0 && pct < 100 && (
              <div style={{ position: "absolute", inset: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)", animation: "brilloBarraMision 1.8s ease-in-out infinite" }} />
            )}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{puntos} pts{max > 0 ? ` · ${Math.round(pct)}%` : ""}</div>
      </div>
    </button>
  );
}

// Botón de reinicio de módulo — SOLO visible para Admin. Al hacer clic
// pregunta si además de desbloquear los ejercicios fallados, se debe
// borrar el ranking (puntos ya ganados) de ese técnico en el módulo.
function BotonReiniciarModulo({ onReiniciar }) {
  const [preguntando, setPreguntando] = useState(false);
  if (preguntando) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 8, padding: "6px 10px" }}>
        <span style={{ fontSize: 12, color: T.amber, fontWeight: 600 }}>¿Borrar también el ranking (puntos ya ganados) de este técnico en este módulo?</span>
        <Btn small variant="accent" onClick={() => { onReiniciar(true); setPreguntando(false); }}>Sí, borrar puntos también</Btn>
        <Btn small variant="ghost" onClick={() => { onReiniciar(false); setPreguntando(false); }}>No, solo desbloquear</Btn>
        <Btn small variant="ghost" onClick={() => setPreguntando(false)}>Cancelar</Btn>
      </div>
    );
  }
  return <Btn small variant="ghost" onClick={() => setPreguntando(true)}>🔓 Reiniciar módulo (Admin)</Btn>;
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

// Guía educativa organizada por sub-temas: a la izquierda la lista de
// temas del módulo (se marcan con ✓ los ya revisados), a la derecha el
// contenido ampliado del tema seleccionado. Se usa como pantalla previa
// obligatoria antes de cada examen/ejercicio de Entrenamiento.
function GuiaPorTemas({ temas, onContinuar, tituloModulo }) {
  const [temaActivo, setTemaActivo] = useState(temas[0].id);
  const [confirmados, setConfirmados] = useState(() => new Set());
  const seleccionar = (id) => setTemaActivo(id);
  const confirmarTema = (id) => setConfirmados((prev) => new Set(prev).add(id));
  const tema = temas.find((t) => t.id === temaActivo);
  const faltantes = temas.filter((t) => !confirmados.has(t.id));
  const todoConfirmado = faltantes.length === 0;
  const temaConfirmado = confirmados.has(tema.id);

  return (
    <Card title={`Antes de empezar: ${tituloModulo}`}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {temas.map((t) => {
            const activo = temaActivo === t.id;
            const confirmado = confirmados.has(t.id);
            return (
              <button key={t.id} onClick={() => seleccionar(t.id)} style={{
                textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: activo ? T.accent : (confirmado ? T.greenSoft : T.graySoft),
                color: activo ? "#fff" : (confirmado ? T.green : T.ink),
                fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
              }}>
                <span>{t.titulo}</span>
                {confirmado && !activo && <Check size={13} />}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 10 }}>{tema.titulo}</div>
          <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.7 }}>{tema.contenido}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 12px", background: temaConfirmado ? T.greenSoft : T.graySoft, borderRadius: 8, cursor: "pointer", width: "fit-content" }}>
            <input type="checkbox" checked={temaConfirmado} onChange={() => confirmarTema(tema.id)} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: temaConfirmado ? T.green : T.ink }}>
              {temaConfirmado ? "Comprendido y confirmado" : "Marcar como comprendido"}
            </span>
          </label>
        </div>
      </div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Btn variant="accent" onClick={onContinuar} disabled={!todoConfirmado}>Ya entendí, empezar el examen</Btn>
          <span style={{ fontSize: 12, color: T.gray }}>{confirmados.size}/{temas.length} temas confirmados</span>
        </div>
        {!todoConfirmado && (
          <div style={{ fontSize: 12, color: T.amber }}>
            Falta confirmar: {faltantes.map((t) => t.titulo).join(", ")}
          </div>
        )}
      </div>
    </Card>
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

// Etiqueta corta de quincena compartida (ej. "1-15 Jul", "16-31 Jul"),
// usada tanto para el gráfico de Administrativo como para conservar el
// dato al borrar una solicitud de horas extra ya aprobada/cerrada.
const MESES_CORTOS_QNA = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
// Reconoce cualquier forma en que se haya escrito un mes (completo,
// abreviado, con o sin tilde, incluso truncado como "En") y lo devuelve
// siempre en la misma forma corta ("Ene", "Feb", ...) para poder comparar
// fechas de facturación sin importar cómo se haya escrito el mes.
const MES_ALIAS = {
  ene: "Ene", enero: "Ene", en: "Ene",
  feb: "Feb", febrero: "Feb",
  mar: "Mar", marzo: "Mar",
  abr: "Abr", abril: "Abr",
  may: "May", mayo: "May",
  jun: "Jun", junio: "Jun",
  jul: "Jul", julio: "Jul",
  ago: "Ago", agosto: "Ago",
  set: "Set", sep: "Set", sept: "Set", septiembre: "Set", setiembre: "Set",
  oct: "Oct", octubre: "Oct",
  nov: "Nov", noviembre: "Nov",
  dic: "Dic", diciembre: "Dic",
};
function normalizarMesCorto(mes) {
  const clave = String(mes || "").trim().toLowerCase();
  return MES_ALIAS[clave] || String(mes || "").trim();
}

// Similitud entre dos nombres (0 a 1) usando coeficiente de Dice sobre
// bigramas de caracteres — sirve para agrupar clientes que se escribieron
// distinto (mayúsculas, "S.A.", tildes, espacios) pero son el mismo.
function similitudNombres(a, b) {
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return x === y ? 1 : 0;
  if (x === y) return 1;
  const bigramas = (s) => { const out = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
  const bigX = bigramas(x), bigY = [...bigramas(y)];
  if (bigX.length === 0 || bigY.length === 0) return 0;
  let interseccion = 0;
  bigX.forEach((bg) => {
    const idx = bigY.indexOf(bg);
    if (idx !== -1) { interseccion++; bigY.splice(idx, 1); }
  });
  return (2 * interseccion) / (bigX.length + [...bigramas(y)].length);
}

function etiquetaQuincenaCorta(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const nombreMes = MESES_CORTOS_QNA[mes - 1];
  if (dia <= 15) return `1-15 ${nombreMes}`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return `16-${ultimoDia} ${nombreMes}`;
}

// Dada una lista ORDENADA (ascendente) de fechas de corte "YYYY-MM-DD",
// arma la etiqueta del periodo al que pertenece una fecha (el periodo va
// del día después del corte anterior, hasta el corte que sigue).
// Devuelve null si la fecha cae después del último corte cargado (aún no
// se sabe dónde termina ese periodo).
function etiquetaPeriodoDeCorte(fechaISO, fechasCorte) {
  if (!fechaISO || !fechasCorte || fechasCorte.length === 0) return null;
  const fin = fechasCorte.find((f) => f >= fechaISO);
  if (!fin) return null;
  const idx = fechasCorte.indexOf(fin);
  const anteriorISO = idx > 0 ? fechasCorte[idx - 1] : null;
  const df = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return `${d.getDate()} ${MESES_CORTOS_QNA[d.getMonth()]}`;
  };
  if (!anteriorISO) return `Hasta ${df(fin)}`;
  const dInicio = new Date(anteriorISO + "T00:00:00");
  dInicio.setDate(dInicio.getDate() + 1);
  return `${df(isoDate(dInicio))} – ${df(fin)}`;
}

// Punto único que usan las gráficas y el contador de "Disponible": si ya
// hay fechas de corte configuradas y la fecha cae dentro de un periodo ya
// cerrado por un corte, usa esa etiqueta; si no, respalda con la quincena
// fija 1-15/16-31 para que nada se rompa mientras no se configuren cortes.
function etiquetaPeriodo(fechaISO, fechasCorte) {
  const porCorte = etiquetaPeriodoDeCorte(fechaISO, fechasCorte);
  return porCorte || etiquetaQuincenaCorta(fechaISO);
}

// Si una solicitud de horas extra ya Aprobada/Cerrada se borra, y esa
// quincena ya tenía un número manual fijo (horas_extras_manual), le resta
// esas horas para que la gráfica sí refleje el borrado. Si la quincena no
// tiene número manual, no hace falta hacer nada: el cálculo automático ya
// se recalcula solo con lo que quede en la base de datos.
async function descontarHorasDeGrafica(area, fila, fechasCorte) {
  const fechaRef = fila.fecha_ejecucion || fila.fecha;
  const horas = Number(fila.horas) || 0;
  if (!fechaRef || !horas) return;
  const quincena = etiquetaPeriodo(fechaRef, fechasCorte || []);
  const { data: existente } = await supabase.from("horas_extras_manual").select("*").eq("area", area).eq("quincena", quincena).maybeSingle();
  if (existente) {
    const nuevoValor = Math.max(0, Number(existente.horas || 0) - horas);
    await supabase.from("horas_extras_manual").update({ horas: nuevoValor }).eq("id", existente.id);
  }
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
    let totalGenerados = 0;
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
          totalGenerados++;
          // Los navegadores bloquean/ignoran descargas disparadas muy rápido
          // seguidas; una pequeña pausa entre cada una evita que se pierdan.
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }
    if (totalGenerados > 5) {
      alert(`Se generaron ${totalGenerados} reportes. Si tu navegador preguntó "¿Permitir varias descargas?", asegúrate de darle clic a "Permitir" para recibirlos todos.`);
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

// Convierte un monto que puede venir como número directo, o como texto con
// distintos formatos de separador de miles/decimales (ej. "5,900.00" o
// "5.900,00" o con símbolo de moneda), a un número de JavaScript confiable.
function parsearMontoImportado(valor) {
  if (typeof valor === "number" && !isNaN(valor)) return valor;
  let s = String(valor ?? "").trim();
  if (!s) return 0;
  s = s.replace(/[₡$€\s]/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const digitosDespues = s.length - lastComma - 1;
    s = digitosDespues === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
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
    equiposCorrectivo: r.equipos_correctivo || "",
    poNumero: r.po_numero || "",
    fechaPo: r.fecha_po || "",
    sapNumero: r.sap_numero || "",
    estatusEquipo: r.estatus_equipo || "Abierto",
    accion: r.accion || "",
    tipoOD: r.tipo_od || "Normal",
    progreso: r.progreso || "Pendiente",
    facturado: r.facturado || "Sin facturar",
    area: r.area,
    created_at: r.created_at,
  };
}
const ODFIELD_TO_DB = {
  fechaInicio: "fecha_inicio", fechaEntrega: "fecha_entrega", fechaAprobacion: "fecha_aprobacion",
  equiposCorrectivo: "equipos_correctivo", tipoOD: "tipo_od",
  poNumero: "po_numero", fechaPo: "fecha_po", sapNumero: "sap_numero", estatusEquipo: "estatus_equipo",
};
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
    monto: r.monto || 0,
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
  const puedeAdminAqui = isAdmin || (currentUser?.categoria === "ehs" && area === "salud");
  const canCerrar = puedeAdminAqui || currentUser?.categoria === "asistente";
  const canBorrar = puedeAdminAqui || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const { fechasCorte } = useContext(FechasCorteContext);
  const [odsDelArea] = useClientesArea(area);
  const [disponible, setDisponibleState] = useState(150);
  const [rows, setRows] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState({ od: "", personalCodigo: "", horaInicio: "07:00", horaFin: "15:00", fechaEjecucion: "" });
  const [subTab, setSubTab] = useState("solicitud");
  const mismoPeriodo = (fechaISO) => {
    if (!fechaISO) return false;
    return etiquetaPeriodo(fechaISO, fechasCorte) === etiquetaPeriodo(todayISO(), fechasCorte);
  };
  const used = rows.reduce((s, r) => {
    if (r.estado !== "Pendiente" && r.estado !== "Aprobada") return s;
    if (!mismoPeriodo(r.fecha_ejecucion || r.fecha)) return s;
    return s + (Number(r.horas) || 0);
  }, 0);
  const saldo = disponible - used;
  const horasCalculadas = calcularHorasRango(form.horaInicio, form.horaFin);

  useEffect(() => {
    const cargar = async () => {
      const { data: filas } = await supabase.from("horas_extras").select("*").eq("area", area).order("created_at", { ascending: false });
      if (filas) setRows(filas);
      const { data: config } = await supabase.from("horas_disponible").select("*").eq("area", area).single();
      if (config) setDisponibleState(Number(config.disponible));
      const { data: personal } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
      if (personal) setEmpleados(personal);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
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
  const fileInputRefHoras = React.useRef(null);
  const handleImportHoras = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws);
        const nuevas = json.map((row) => {
          const nombrePersonal = String(row["Personal"] ?? row["personal"] ?? "").trim();
          const empleadoMatch = empleados.find((emp) => emp.nombre.toLowerCase() === nombrePersonal.toLowerCase());
          const horaInicio = String(row["Hora Inicio"] ?? row["hora_inicio"] ?? "").trim();
          const horaFin = String(row["Hora Fin"] ?? row["hora_fin"] ?? "").trim();
          const horasCalculadas = horaInicio && horaFin ? calcularHorasRango(horaInicio, horaFin) : null;
          return {
            area,
            fecha: todayISO(),
            fecha_ejecucion: excelValueToISODate(row["Fecha Ejecución"] ?? row["Fecha de Ejecución"] ?? row["fecha_ejecucion"] ?? "") || null,
            od: row["OD"] ?? row["od"] ?? "",
            personal: empleadoMatch?.nombre || nombrePersonal,
            personal_codigos: empleadoMatch ? [empleadoMatch.codigo] : [],
            hora_inicio: horaInicio || null,
            hora_fin: horaFin || null,
            horas: horasCalculadas ?? (Number(row["Horas"] ?? row["horas"]) || 0),
            estado: row["Estado"] ?? row["estado"] ?? "Pendiente",
          };
        }).filter((r) => r.od && r.personal && r.horas);
        if (nuevas.length === 0) return;
        const { data: inserted, error } = await supabase.from("horas_extras").insert(nuevas).select();
        if (!error && inserted) setRows((prev) => [...inserted, ...prev]);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
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
    const fila = rows.find((r) => r.id === id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (fila && (fila.estado === "Aprobada" || fila.estado === "Cerrada")) await descontarHorasDeGrafica(area, fila, fechasCorte);
    supabase.from("horas_extras").delete().eq("id", id).then();
  };
  const vaciarPestana = async (estadoObjetivo, etiqueta) => {
    const filasAEliminar = rows.filter((r) => r.estado === estadoObjetivo);
    if (filasAEliminar.length === 0) return;
    if (!(await confirmar(`¿Está seguro que desea eliminar las ${filasAEliminar.length} solicitudes de "${etiqueta}"? Esta acción no se puede deshacer.`))) return;
    setRows((prev) => prev.filter((r) => r.estado !== estadoObjetivo));
    if (estadoObjetivo === "Cerrada" || estadoObjetivo === "Aprobada") {
      for (const fila of filasAEliminar) await descontarHorasDeGrafica(area, fila, fechasCorte);
    }
    filasAEliminar.forEach((r) => supabase.from("horas_extras").delete().eq("id", r.id).then());
  };

  const [filtroPersonalHoras, setFiltroPersonalHoras] = useState("");
  const [filtroOdHoras, setFiltroOdHoras] = useState("");
  const [filtroFechaEjecHoras, setFiltroFechaEjecHoras] = useState("");

  const rowsSolicitud = rows.filter((r) => r.estado === "Pendiente" || r.estado === "Aprobada");
  const rowsDenegadas = rows.filter((r) => r.estado === "Rechazada");
  const rowsCerradas = rows.filter((r) => r.estado === "Cerrada");
  const rowsMostradas = (subTab === "solicitud" ? rowsSolicitud : subTab === "denegadas" ? rowsDenegadas : rowsCerradas).filter((r) => {
    const matchPersonal = !filtroPersonalHoras.trim() || (r.personal || "").toLowerCase().includes(filtroPersonalHoras.trim().toLowerCase());
    const matchOd = !filtroOdHoras.trim() || (r.od || "").toLowerCase().includes(filtroOdHoras.trim().toLowerCase());
    const matchFecha = !filtroFechaEjecHoras || r.fecha_ejecucion === filtroFechaEjecHoras;
    return matchPersonal && matchOd && matchFecha;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Disponible quincenal">
          <div style={{ fontSize: 30, fontWeight: 800, color }}>{saldo}h</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>de {disponible}h asignadas · {used}h usadas en esta quincena</div>
          <div style={{ height: 8, background: T.graySoft, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${Math.min(100, (used / disponible) * 100)}%`, background: used > disponible ? T.red : color }} />
          </div>
          {puedeAdminAqui ? (
            <Field label="Editar disponible (solo Administrativo)">
              <input style={inputStyle} type="number" value={disponible} onChange={(e) => setDisponible(Number(e.target.value))} />
            </Field>
          ) : (
            <div style={{ fontSize: 11.5, color: T.gray }}>Solo un usuario Administrativo puede modificar el disponible.</div>
          )}
        </Card>
        <Card title="Nueva solicitud">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="OD del proyecto">
              {odsDelArea.length === 0 ? (
                <input style={inputStyle} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })} placeholder="OD-1004" />
              ) : (
                <select style={inputStyle} value={form.od} onChange={(e) => setForm({ ...form, od: e.target.value })}>
                  <option value="">Selecciona un OD…</option>
                  {odsDelArea.map((o) => <option key={o.id} value={o.od}>{o.od} — {o.cliente}</option>)}
                </select>
              )}
            </Field>
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

      <Card title="Solicitudes" action={
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileInputRefHoras} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportHoras} />
          <Btn small variant="ghost" onClick={() => fileInputRefHoras.current?.click()}><Upload size={13} /> Importar Excel</Btn>
          <Btn small variant="ghost" onClick={() => exportExcel(rowsMostradas.map(({ fecha, fecha_ejecucion, od, personal, hora_inicio, hora_fin, horas, estado }) => ({ Fecha: fecha, "Fecha Ejecución": fecha_ejecucion, OD: od, Personal: personal, "Hora Inicio": hora_inicio, "Hora Fin": hora_fin, Horas: horas, Estado: estado })), `horas_${area}.xlsx`)}><Download size={13} /> Excel</Btn>
        </div>
      }>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small variant={subTab === "solicitud" ? "accent" : "ghost"} onClick={() => setSubTab("solicitud")}>Solicitud ({rowsSolicitud.length})</Btn>
          <Btn small variant={subTab === "denegadas" ? "accent" : "ghost"} onClick={() => setSubTab("denegadas")}>Denegadas ({rowsDenegadas.length})</Btn>
          <Btn small variant={subTab === "cerradas" ? "accent" : "ghost"} onClick={() => setSubTab("cerradas")}>Cerradas ({rowsCerradas.length})</Btn>
          {puedeAdminAqui && subTab === "denegadas" && rowsDenegadas.length > 0 && (
            <Btn small variant="danger" onClick={() => vaciarPestana("Rechazada", "Denegadas")}><X size={12} /> Eliminar Denegadas</Btn>
          )}
          {puedeAdminAqui && subTab === "cerradas" && rowsCerradas.length > 0 && (
            <Btn small variant="danger" onClick={() => vaciarPestana("Cerrada", "Cerradas")}><X size={12} /> Eliminar Cerradas</Btn>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, width: 180 }} value={filtroPersonalHoras} onChange={(e) => setFiltroPersonalHoras(e.target.value)} placeholder="Filtrar por personal..." />
          <input style={{ ...inputStyle, width: 150 }} value={filtroOdHoras} onChange={(e) => setFiltroOdHoras(e.target.value)} placeholder="Filtrar por OD..." />
          <input style={{ ...inputStyle, width: 160 }} type="date" value={filtroFechaEjecHoras} onChange={(e) => setFiltroFechaEjecHoras(e.target.value)} title="Filtrar por fecha de ejecución" />
          {(filtroPersonalHoras || filtroOdHoras || filtroFechaEjecHoras) && (
            <Btn small variant="ghost" onClick={() => { setFiltroPersonalHoras(""); setFiltroOdHoras(""); setFiltroFechaEjecHoras(""); }}>Limpiar filtros</Btn>
          )}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Fecha</th><th>Fecha ejecución</th><th style={{ minWidth: 220 }}>OD</th><th>Personal</th><th>Rango</th><th>Horas</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rowsMostradas.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "9px 8px" }}>{r.fecha}</td>
                <td>
                  {puedeAdminAqui ? (
                    <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fecha_ejecucion || ""} onChange={(e) => setFechaEjecucion(r.id, e.target.value)} />
                  ) : (r.fecha_ejecucion || "—")}
                </td>
                <td>
                  {puedeAdminAqui ? (
                    <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 200 }} value={r.od} onChange={(e) => setOd(r.id, e.target.value)} />
                  ) : (r.od)}
                  {(() => {
                    const clienteOD = odsDelArea.find((o) => o.od === r.od)?.cliente;
                    return clienteOD ? <div style={{ fontSize: 11, color: T.gray, marginTop: 2 }}>{clienteOD}</div> : null;
                  })()}
                </td>
                <td>
                  {puedeAdminAqui ? (
                    <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 150 }} value={r.personal_codigos?.[0] || ""} onChange={(e) => setPersonalCodigo(r.id, e.target.value)}>
                      <option value="">Selecciona…</option>
                      {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
                    </select>
                  ) : (r.personal || "—")}
                </td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {puedeAdminAqui ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <input type="time" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 90 }} value={r.hora_inicio || ""} onChange={(e) => setRango(r.id, e.target.value, r.hora_fin)} />
                      <span>–</span>
                      <input type="time" style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 90 }} value={r.hora_fin || ""} onChange={(e) => setRango(r.id, r.hora_inicio, e.target.value)} />
                    </div>
                  ) : (r.hora_inicio && r.hora_fin ? `${r.hora_inicio} – ${r.hora_fin}` : "—")}
                </td>
                <td>{r.horas}h</td>
                <td>
                  {puedeAdminAqui ? (
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
                  {puedeAdminAqui && r.estado === "Pendiente" && <>
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
        {subTab === "solicitud" && (
          <div style={{ marginTop: 4, fontSize: 12, color: T.inkSoft, textAlign: "right" }}>
            De esas: <span style={{ color: T.amber, fontWeight: 700 }}>{rowsMostradas.filter((r) => r.estado === "Pendiente").reduce((s, r) => s + Number(r.horas || 0), 0)}h Pendientes de aprobar</span>
            {" · "}
            <span style={{ color: T.green, fontWeight: 700 }}>{rowsMostradas.filter((r) => r.estado === "Aprobada").reduce((s, r) => s + Number(r.horas || 0), 0)}h ya Aprobadas</span>
            {" (solo las Aprobadas y Cerradas cuentan en la gráfica)"}
          </div>
        )}
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
const EquiposNavContext = createContext({ irAEquipos: () => {} });
const FechasCorteContext = createContext([]);

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
  const canEditProgreso = isAdmin || currentUser?.categoria === "asistente" || currentUser?.categoria === "tecnico";
  const confirmar = useContext(ConfirmContext);
  const { irAEquipos } = useContext(EquiposNavContext);
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
  const [editandoId, setEditandoId] = useState(null);
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
  const setOD = (id, od) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, od } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ od })).eq("id", id).then();
  };
  const setClienteOD = (id, cliente) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, cliente } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ cliente })).eq("id", id).then();
  };
  const setVencimiento = (id, vencimiento) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, vencimiento } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ vencimiento })).eq("id", id).then();
  };
  const setFechaAprobacion = (id, fechaAprobacion) => {
    // Se sincroniza con Fecha PO (Equipos) — son la misma fecha en los dos lados.
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fechaAprobacion, fechaPo: fechaAprobacion } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ fechaAprobacion, fechaPo: fechaAprobacion })).eq("id", id).then();
  };
  const setEquiposCorrectivo = (id, equiposCorrectivo) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, equiposCorrectivo } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ equiposCorrectivo })).eq("id", id).then();
  };
  const setEstatusEquipoOD = (id, estatusEquipo) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estatusEquipo } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ estatusEquipo })).eq("id", id).then();
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
                {esCorrectivo && <th style={{ minWidth: 160 }}>Equipos</th>}
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
                  <td style={{ padding: "9px 8px", fontWeight: 600 }}>
                    {editandoId === r.id ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={r.od} onChange={(e) => setOD(r.id, e.target.value)} />
                    ) : r.od}
                  </td>
                  <td>
                    {editandoId === r.id ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 170 }} value={r.cliente} onChange={(e) => setClienteOD(r.id, e.target.value)} />
                    ) : r.cliente}
                  </td>
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
                    {canEditEstado ? (
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
                  {esCorrectivo && (
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {canEditProgreso ? (
                          <select style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: 150 }} value={r.estatusEquipo || "Abierto"} onChange={(e) => setEstatusEquipoOD(r.id, e.target.value)}>
                            {ESTATUS_EQUIPO_OPCIONES.map((op) => <option key={op}>{op}</option>)}
                          </select>
                        ) : (r.estatusEquipo || "Abierto")}
                        {r.estatusEquipo !== "No lleva equipos" && (
                          <Btn small variant="ghost" onClick={() => irAEquipos(area, r.od)}><Package size={13} /> Ver en Equipos</Btn>
                        )}
                      </div>
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
                    {canEditEstado && (
                      <Btn small variant={editandoId === r.id ? "accent" : "ghost"} onClick={() => setEditandoId(editandoId === r.id ? null : r.id)}>
                        {editandoId === r.id ? "Listo" : "Editar"}
                      </Btn>
                    )}
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
async function fetchGoogleCalendarEventos(area, timeMinISO, timeMaxISO, intento = 1) {
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
    if (!resp.ok) {
      // Reintenta una vez tras un fallo pasajero (ej. límite de Google al
      // navegar rápido entre meses) antes de darse por vencido.
      if (intento < 3) {
        await new Promise((r) => setTimeout(r, 500 * intento));
        return fetchGoogleCalendarEventos(area, timeMinISO, timeMaxISO, intento + 1);
      }
      return null; // null = la consulta falló definitivamente; distinto de "no hay eventos"
    }
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
    if (intento < 3) {
      await new Promise((r) => setTimeout(r, 500 * intento));
      return fetchGoogleCalendarEventos(area, timeMinISO, timeMaxISO, intento + 1);
    }
    console.error("Error cargando Google Calendar:", err);
    return null;
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
  const irAFecha = (valor) => {
    if (!valor) return;
    const [anio, mes, dia] = valor.split("-").map(Number);
    setCursor(new Date(anio, mes - 1, dia));
    setDiaSeleccionado(valor);
  };

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
      // Si falla (ej. límite de Google), conserva lo que ya había en
      // pantalla en vez de dejarla en blanco.
      if (activo && eventosG !== null) setEventosGoogle(eventosG);
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
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {VISTAS.map((v) => (
                <Btn key={v.id} small variant={vista === v.id ? "accent" : "ghost"} onClick={() => setVista(v.id)}>{v.label}</Btn>
              ))}
              <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, width: 150 }} title="Ir a una fecha" />
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
                <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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
                <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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
                <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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

function ResumenCotizacionesCard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("cotizaciones").select("actividad, monto");
      if (data) setRows(data);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000); // se refresca sola cada 20s
    return () => clearInterval(intervalo);
  }, []);
  const total = rows.length;
  const conOC = rows.filter((r) => r.actividad === "Con OC").length;
  const tasaConversion = total > 0 ? Math.round((conOC / total) * 1000) / 10 : 0;
  const pipelineAbierto = rows.filter((r) => r.actividad === "Seguimiento").reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const valorGanado = rows.filter((r) => r.actividad === "Con OC").reduce((s, r) => s + (Number(r.monto) || 0), 0);

  return (
    <Card title="Cotizaciones — conversión y pipeline">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <div style={{ background: T.blueSoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{tasaConversion}%</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Tasa de conversión ({conOC} de {total} → Con OC)</div>
        </div>
        <div style={{ background: T.amberSoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.amber }}>{fmtMoney(pipelineAbierto)}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Valor del pipeline abierto (en Seguimiento)</div>
        </div>
        <div style={{ background: T.greenSoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{fmtMoney(valorGanado)}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Valor ganado (Con OC)</div>
        </div>
      </div>
    </Card>
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
  const [filtroSolicitante, setFiltroSolicitante] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroProvincia, setFiltroProvincia] = useState("");
  const [filtroDias, setFiltroDias] = useState("");
  const [filtroNumCot, setFiltroNumCot] = useState("");
  const [filtroTipoCot, setFiltroTipoCot] = useState("Todos");
  const [form, setForm] = useState({
    solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "",
    dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Solicitud",
    actividad: "Seguimiento", tipo: "Inspecciones", frecuencia: "", observaciones: "", monto: "",
  });

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("cotizaciones").select("*").order("numero", { ascending: false });
      if (data) setRows(data.map(cotRowFromDb));
    };
    cargar();
    // Se refresca sola, para que el consecutivo (próximo número) y la lista
    // se mantengan al día si alguien más agrega una cotización mientras
    // tienes esta pantalla abierta.
    const intervalo = setInterval(cargar, 15000);
    return () => clearInterval(intervalo);
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
      frecuencia: form.frecuencia, observaciones: form.observaciones, monto: Number(form.monto) || 0,
    };
    setForm({ solicitante: "", cliente: "", contacto: "", email: "", telefono: "", provincia: "", dias: "", personal: "", descripcion: "", equipos: "", dispositivos: "", numCot: "", estado: "Solicitud", actividad: "Seguimiento", tipo: "Inspecciones", frecuencia: "", observaciones: "", monto: "" });
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
  const setMonto = (id, monto) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, monto } : r));
    supabase.from("cotizaciones").update({ monto: Number(monto) || 0 }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta cotización? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("cotizaciones").delete().eq("id", id).then();
  };

  const ESTADOS_COT = ["Solicitud", "En proceso", "Enviado", "Comparado"];
  const estadoColor = { Solicitud: [T.amber, T.amberSoft], "En proceso": [T.steel, T.steelSoft], Enviado: [T.blue, T.blueSoft], Comparado: [T.green, T.greenSoft] };
  const actividadColor = { Seguimiento: [T.blue, T.blueSoft], Cancelado: [T.red, T.redSoft], "Con OC": [T.green, T.greenSoft] };
  const TIPO_OFERTA_OPCIONES = ["Inspecciones", "Proyectos", "Inspecciones y Proyectos"];

  const rowsFiltradas = rows.filter((r) => {
    const matchTab = subTab === "Todas" || r.estado === subTab;
    const matchSolicitante = !filtroSolicitante.trim() || (r.solicitante || "").toLowerCase().includes(filtroSolicitante.trim().toLowerCase());
    const matchCliente = !filtroCliente.trim() || (r.cliente || "").toLowerCase().includes(filtroCliente.trim().toLowerCase());
    const matchProvincia = !filtroProvincia.trim() || (r.provincia || "").toLowerCase().includes(filtroProvincia.trim().toLowerCase());
    const matchDias = !filtroDias.trim() || String(r.dias || "").includes(filtroDias.trim());
    const matchNumCot = !filtroNumCot.trim() || (r.numCot || "").toLowerCase().includes(filtroNumCot.trim().toLowerCase());
    const matchTipo = filtroTipoCot === "Todos" || r.tipo === filtroTipoCot;
    return matchTab && matchSolicitante && matchCliente && matchProvincia && matchDias && matchNumCot && matchTipo;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ResumenCotizacionesCard />
      <CotizacionPrintView r={printRow} onClose={() => setPrintRow(null)} />
      <Card
        title={`Historial de solicitudes — próximo consecutivo #${nextConsecutivo}`}
        action={<div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="ghost" onClick={() => exportExcel(rowsFiltradas.map(r => ({ Consecutivo: r.consecutivo, Solicitante: r.solicitante, Cliente: r.cliente, "Nombre del contacto": r.contacto, Email: r.email, Telefono: r.telefono, Provincia: r.provincia, Dias: r.dias, Personal: r.personal, "Descripción del trabajo": r.descripcion, "Equipos de elevación": r.equipos, "Lista de dispositivos": r.dispositivos, "N° Cotización": r.numCot, Tipo: r.tipo, Monto: r.monto, Estado: r.estado, Actividad: r.actividad, Frecuencia: r.frecuencia, Observaciones: r.observaciones })), "cotizaciones.xlsx")}><Download size={13} /> Excel</Btn>
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
            <Field label="Monto estimado ($)"><input style={inputStyle} type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" /></Field>
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

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, width: 150 }} value={filtroSolicitante} onChange={(e) => setFiltroSolicitante(e.target.value)} placeholder="Solicitante..." />
          <input style={{ ...inputStyle, width: 150 }} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Cliente..." />
          <input style={{ ...inputStyle, width: 140 }} value={filtroProvincia} onChange={(e) => setFiltroProvincia(e.target.value)} placeholder="Provincia..." />
          <input style={{ ...inputStyle, width: 100 }} value={filtroDias} onChange={(e) => setFiltroDias(e.target.value)} placeholder="Días..." />
          <input style={{ ...inputStyle, width: 140 }} value={filtroNumCot} onChange={(e) => setFiltroNumCot(e.target.value)} placeholder="N° Cotización..." />
          <select style={{ ...inputStyle, width: 180 }} value={filtroTipoCot} onChange={(e) => setFiltroTipoCot(e.target.value)}>
            <option value="Todos">Todos los tipos</option>
            {TIPO_OFERTA_OPCIONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filtroSolicitante || filtroCliente || filtroProvincia || filtroDias || filtroNumCot || filtroTipoCot !== "Todos") && (
            <Btn small variant="ghost" onClick={() => { setFiltroSolicitante(""); setFiltroCliente(""); setFiltroProvincia(""); setFiltroDias(""); setFiltroNumCot(""); setFiltroTipoCot("Todos"); }}>Limpiar filtros</Btn>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>#</th><th>Solicitante</th><th>Cliente</th><th>Provincia</th><th>Días</th><th style={{ minWidth: 150 }}>N° Cotización</th><th>Tipo</th><th>Monto</th><th>Estado</th><th>Actividad</th><th style={{ minWidth: 180 }}>Observaciones</th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.map((r) => (
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
                    <input type="number" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={r.monto || ""} onChange={(e) => setMonto(r.id, e.target.value)} placeholder="0.00" />
                  ) : (fmtMoney(r.monto))}
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
function ResumenEHSCard() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("cursos_ehs").select("fecha, estado");
      if (data) setRows(data);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);
  const total = rows.length;
  const alDia = rows.filter((r) => estadoEfectivoCurso(r) !== "Vencido").length;
  const pctAlDia = total > 0 ? Math.round((alDia / total) * 1000) / 10 : 100;
  const vencidos = total - alDia;

  return (
    <Card title="Cursos EHS — cumplimiento">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <div style={{ background: pctAlDia >= 90 ? T.greenSoft : pctAlDia >= 70 ? T.amberSoft : T.redSoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: pctAlDia >= 90 ? T.green : pctAlDia >= 70 ? T.amber : T.red }}>{pctAlDia}%</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Cursos al día</div>
        </div>
        <div style={{ background: T.graySoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.steel }}>{total}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Total de cursos cargados</div>
        </div>
        <div style={{ background: T.redSoft, borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.red }}>{vencidos}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>Vencidos</div>
        </div>
      </div>
    </Card>
  );
}

function CursosEHS() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const isEHS = currentUser?.categoria === "ehs";
  const canEditCurso = isAdmin || isEHS || currentUser?.categoria === "tecnico";
  const canEditEstadoCurso = isAdmin || isEHS || currentUser?.categoria === "tecnico" || currentUser?.categoria === "asistente";
  const canEditLugar = isAdmin || isEHS || currentUser?.categoria === "asistente";
  const canBorrarCurso = isAdmin || isEHS || currentUser?.categoria === "asistente";
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
    const cargar = async () => {
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
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
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

  const [filtroTipoEHS, setFiltroTipoEHS] = useState("Todos");
  const [filtroPersonalEHS, setFiltroPersonalEHS] = useState("");
  const [filtroLugarEHS, setFiltroLugarEHS] = useState("");
  const rowsVencidos = rows.filter((r) => estadoEfectivoCurso(r) === "Vencido");
  const rowsRealizados = rows.filter((r) => r.estado === "Realizado" && estadoEfectivoCurso(r) !== "Vencido");
  const rowsActivos = rows.filter((r) => r.estado !== "Realizado" && estadoEfectivoCurso(r) !== "Vencido");
  const rowsMostradosPorTab = subTab === "activos" ? rowsActivos : subTab === "vencidos" ? rowsVencidos : rowsRealizados;
  const rowsMostrados = rowsMostradosPorTab.filter((r) => {
    const matchTipo = filtroTipoEHS === "Todos" || r.tipo === filtroTipoEHS;
    const matchPersonal = !filtroPersonalEHS.trim() || (r.personal || "").toLowerCase().includes(filtroPersonalEHS.trim().toLowerCase());
    const matchLugar = !filtroLugarEHS.trim() || (r.lugar || "").toLowerCase().includes(filtroLugarEHS.trim().toLowerCase());
    return matchTipo && matchPersonal && matchLugar;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ResumenEHSCard />
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
      <Card title="Solicitudes de curso" action={<Btn small variant="ghost" onClick={() => exportExcel(rowsMostrados.map(r => ({ Solicitante: r.solicitante, Personal: r.personal, Lugar: r.lugar, Tipo: r.tipo, Estado: r.estado, Fecha: r.fecha, Vencimiento: vencimientoCalculado(r.fecha) || "" })), "cursos_ehs.xlsx")}><Download size={13} /> Excel</Btn>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Btn small variant={subTab === "activos" ? "accent" : "ghost"} onClick={() => setSubTab("activos")}>Activos ({rowsActivos.length})</Btn>
          <Btn small variant={subTab === "vencidos" ? "accent" : "ghost"} onClick={() => setSubTab("vencidos")}>Vencidos ({rowsVencidos.length})</Btn>
          <Btn small variant={subTab === "realizados" ? "accent" : "ghost"} onClick={() => setSubTab("realizados")}>Realizados ({rowsRealizados.length})</Btn>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, width: 180 }} value={filtroTipoEHS} onChange={(e) => setFiltroTipoEHS(e.target.value)}>
            <option value="Todos">Todos los tipos</option>
            {CURSO_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input style={{ ...inputStyle, width: 200 }} value={filtroPersonalEHS} onChange={(e) => setFiltroPersonalEHS(e.target.value)} placeholder="Buscar por persona..." />
          <input style={{ ...inputStyle, width: 200 }} value={filtroLugarEHS} onChange={(e) => setFiltroLugarEHS(e.target.value)} placeholder="Buscar por lugar..." />
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
    </div>
  );
}

/* ---------------------------------------------------------
   AREA: SALUD OCUPACIONAL (tabs internas: cursos / calendario)
   --------------------------------------------------------- */
const EPP_TIPOS = [
  "Chaleco reflectivo", "Zapatos de seguridad", "Guantes", "Casco",
  "Lentes de seguridad", "Protección auditiva", "Mascarilla / Respirador",
  "Arnés de seguridad", "Impermeable", "Faja de protección lumbar",
];

function EquipoSeguridad() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const isEHS = currentUser?.categoria === "ehs";
  const canGestionar = isAdmin || isEHS || currentUser?.categoria === "asistente" || currentUser?.categoria === "tecnico";
  const confirmar = useContext(ConfirmContext);
  const canAdminTipos = isAdmin || isEHS;
  const [rows, setRows] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [tiposEPP, setTiposEPP] = useState(EPP_TIPOS);
  const [nuevoTipoEPP, setNuevoTipoEPP] = useState("");
  const [subTab, setSubTab] = useState("solicitado");
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [filtroPersonal, setFiltroPersonal] = useState("");
  const [form, setForm] = useState({ solicitante: "", personalCodigo: "" });
  const [itemActual, setItemActual] = useState({ tipo: EPP_TIPOS[0], cantidad: 1, talla: "" });
  const [carrito, setCarrito] = useState([]);

  useEffect(() => {
    const cargar = () => {
      (async () => {
        const { data } = await supabase.from("epp_registros").select("*").order("created_at", { ascending: false });
        if (data) setRows(data);
      })();
      (async () => {
        const { data } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
        if (data) setEmpleados(data);
      })();
      (async () => {
        const { data } = await supabase.from("epp_tipos").select("*").order("nombre", { ascending: true });
        if (data && data.length > 0) setTiposEPP(data.map((t) => t.nombre));
      })();
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const agregarTipoEPP = async () => {
    const nombre = nuevoTipoEPP.trim();
    if (!nombre || tiposEPP.includes(nombre)) return;
    setNuevoTipoEPP("");
    const { error } = await supabase.from("epp_tipos").insert({ nombre });
    if (!error) setTiposEPP((prev) => [...prev, nombre].sort());
  };

  const agregarAlCarrito = () => {
    if (!itemActual.tipo || !itemActual.cantidad) return;
    setCarrito((prev) => [...prev, { ...itemActual, cantidad: Number(itemActual.cantidad) || 1 }]);
    setItemActual({ tipo: EPP_TIPOS[0], cantidad: 1, talla: "" });
  };
  const quitarDelCarrito = (idx) => {
    setCarrito((prev) => prev.filter((_, i) => i !== idx));
  };
  const guardarPedido = async () => {
    const empleado = empleados.find((e) => e.codigo === form.personalCodigo);
    if (!empleado || carrito.length === 0) return;
    const fecha = todayISO();
    const payloads = carrito.map((item) => ({
      solicitante: form.solicitante || null,
      personal_codigo: form.personalCodigo, personal_nombre: empleado.nombre, tipo: item.tipo,
      cantidad: item.cantidad, talla: item.talla || null,
      fecha_solicitud: fecha, fecha_entrega: null, estado: "Solicitado",
    }));
    setCarrito([]);
    setForm({ solicitante: "", personalCodigo: "" });
    const { data, error } = await supabase.from("epp_registros").insert(payloads).select();
    if (!error && data) setRows((prev) => [...data, ...prev]);
  };
  const marcarEntregado = (id) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado: "Entregado", fecha_entrega: todayISO() } : r));
    supabase.from("epp_registros").update({ estado: "Entregado", fecha_entrega: todayISO() }).eq("id", id).then();
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este registro? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("epp_registros").delete().eq("id", id).then();
  };
  const reiniciarEPP = async () => {
    if (!(await confirmar("¿Está seguro que desea BORRAR TODOS los registros de EPP (solicitados y entregados)? Esta acción no se puede deshacer, se usa para empezar un año nuevo.", { confirmLabel: "Sí, reiniciar", variant: "danger" }))) return;
    const ids = rows.map((r) => r.id);
    setRows([]);
    for (const id of ids) await supabase.from("epp_registros").delete().eq("id", id);
  };

  const rowsSolicitado = rows.filter((r) => r.estado === "Solicitado");
  const rowsEntregado = rows.filter((r) => r.estado === "Entregado");
  const rowsMostradosPorTab = subTab === "solicitado" ? rowsSolicitado : rowsEntregado;
  const rowsMostrados = rowsMostradosPorTab.filter((r) => {
    const matchTipo = filtroTipo === "Todos" || r.tipo === filtroTipo;
    const matchPersonal = !filtroPersonal || r.personal_nombre === filtroPersonal;
    return matchTipo && matchPersonal;
  });

  // Control de cuántos equipos se le han entregado a cada persona.
  const totalPorPersona = {};
  rowsEntregado.forEach((r) => {
    totalPorPersona[r.personal_nombre] = (totalPorPersona[r.personal_nombre] || 0) + (Number(r.cantidad) || 0);
  });
  const resumenPersonas = Object.entries(totalPorPersona).sort((a, b) => b[1] - a[1]);
  const totalGeneralEntregado = resumenPersonas.reduce((s, [, total]) => s + total, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card
          title="Equipo de Protección Personal (EPP)"
          action={<Btn small variant="ghost" onClick={() => exportExcel(rowsMostrados.map(r => ({ Solicitante: r.solicitante, Destinatario: r.personal_nombre, Tipo: r.tipo, Cantidad: r.cantidad, Talla: r.talla, "Fecha solicitud": r.fecha_solicitud, "Fecha entrega": r.fecha_entrega, Estado: r.estado })), "epp.xlsx")}><Download size={13} /> Excel</Btn>}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <Btn small variant={subTab === "solicitado" ? "accent" : "ghost"} onClick={() => setSubTab("solicitado")}>Solicitado ({rowsSolicitado.length})</Btn>
            <Btn small variant={subTab === "entregado" ? "accent" : "ghost"} onClick={() => setSubTab("entregado")}>Entregado ({rowsEntregado.length})</Btn>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, width: 200 }} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="Todos">Todos los tipos</option>
              {tiposEPP.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={{ ...inputStyle, width: 200 }} value={filtroPersonal} onChange={(e) => setFiltroPersonal(e.target.value)}>
              <option value="">Todo el personal</option>
              {empleados.map((emp) => <option key={emp.codigo} value={emp.nombre}>{emp.nombre}</option>)}
            </select>
          </div>
          {canAdminTipos && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
              <input style={{ ...inputStyle, width: 220 }} value={nuevoTipoEPP} onChange={(e) => setNuevoTipoEPP(e.target.value)} placeholder="Nuevo tipo de EPP (ej. Protector facial)" />
              <Btn small variant="ghost" onClick={agregarTipoEPP}><Plus size={13} /> Agregar tipo a la lista</Btn>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "6px 8px" }}>Solicitante</th><th>Destinatario</th><th>Tipo</th><th>Cant.</th><th>Talla</th><th>Fecha solicitud</th>
                {subTab === "entregado" && <th>Fecha entrega</th>}
                <th></th><th></th>
              </tr>
            </thead>
            <tbody>
              {rowsMostrados.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "10px 8px", color: T.gray }}>No hay registros en esta pestaña.</td></tr>
              ) : rowsMostrados.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "8px" }}>{r.solicitante || "—"}</td>
                  <td>{r.personal_nombre}</td>
                  <td>{r.tipo}</td>
                  <td>{r.cantidad}</td>
                  <td>{r.talla || "—"}</td>
                  <td>{r.fecha_solicitud}</td>
                  {subTab === "entregado" && <td>{r.fecha_entrega}</td>}
                  <td>
                    {subTab === "solicitado" && canGestionar && (
                      <Btn small variant="accent" onClick={() => marcarEntregado(r.id)}>Marcar entregado</Btn>
                    )}
                  </td>
                  <td>{canGestionar && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card title="Nueva solicitud de EPP">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Solicitante (quien pide el equipo)"><input style={inputStyle} value={form.solicitante} onChange={(e) => setForm({ ...form, solicitante: e.target.value })} placeholder="Nombre del solicitante" /></Field>
            <Field label="Destinatario (quien recibe el equipo)">
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

            <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 10, fontSize: 12, fontWeight: 700, color: T.inkSoft }}>Artículos del pedido</div>
            <Field label="Tipo de EPP">
              <select style={inputStyle} value={itemActual.tipo} onChange={(e) => setItemActual({ ...itemActual, tipo: e.target.value })}>
                {tiposEPP.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="Cantidad"><input style={inputStyle} type="number" min="1" value={itemActual.cantidad} onChange={(e) => setItemActual({ ...itemActual, cantidad: e.target.value })} /></Field>
              <Field label="Talla (opcional)"><input style={inputStyle} value={itemActual.talla} onChange={(e) => setItemActual({ ...itemActual, talla: e.target.value })} placeholder="M, L, 42..." /></Field>
            </div>
            <Btn variant="ghost" onClick={agregarAlCarrito} style={{ justifyContent: "center" }}><Plus size={14} /> Agregar artículo al pedido</Btn>

            {carrito.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: T.graySoft, borderRadius: 8, padding: 10 }}>
                {carrito.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                    <span>{item.tipo} × {item.cantidad}{item.talla ? ` (talla ${item.talla})` : ""}</span>
                    <button onClick={() => quitarDelCarrito(idx)} style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <Btn variant="accent" onClick={guardarPedido} disabled={carrito.length === 0 || !form.personalCodigo} style={{ justifyContent: "center" }}>
              <Plus size={14} /> Guardar pedido ({carrito.length} artículo{carrito.length === 1 ? "" : "s"})
            </Btn>
          </div>
        </Card>

        <Card
          title="Total entregado por persona"
          action={isAdmin && rows.length > 0 && (
            <Btn small variant="danger" onClick={reiniciarEPP}><X size={13} /> Reiniciar año</Btn>
          )}
        >
          {resumenPersonas.length === 0 ? (
            <div style={{ color: T.gray, fontSize: 13 }}>Todavía no se ha marcado ninguna entrega.</div>
          ) : (
            <>
              <div style={{ background: T.blueSoft, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Total general entregado</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.blue }}>{totalGeneralEntregado} artículos</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {resumenPersonas.map(([nombre, total]) => (
                  <div key={nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px dashed ${T.line}`, paddingBottom: 6 }}>
                    <span style={{ fontSize: 12.5 }}>{nombre}</span>
                    <Badge color={T.green} soft={T.greenSoft}>{total} artículos</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function SaludOcupacional() {
  const [tab, setTab] = useState("cursos");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <Btn variant={tab === "cursos" ? "accent" : "ghost"} small onClick={() => setTab("cursos")}>Cursos EHS</Btn>
        <Btn variant={tab === "epp" ? "accent" : "ghost"} small onClick={() => setTab("epp")}>Equipo de Seguridad (EPP)</Btn>
        <Btn variant={tab === "horas" ? "accent" : "ghost"} small onClick={() => setTab("horas")}>Horas extras</Btn>
        <Btn variant={tab === "calendario" ? "accent" : "ghost"} small onClick={() => setTab("calendario")}>Agenda de visitas a Proyectos/Inspecciones</Btn>
      </div>
      {tab === "cursos" && <CursosEHS />}
      {tab === "epp" && <EquipoSeguridad />}
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
  const { fechasCorte } = useContext(FechasCorteContext);
  const [filasTodas, setFilasTodas] = useState([]);
  const [realesTodas, setRealesTodas] = useState([]);
  const [ventana, setVentana] = useState(0);
  const VENTANA_QUINCENAS = 12;
  // Inspecciones y Proyectos comparten las mismas fechas de corte, así que
  // sus gráficas muestran siempre los mismos periodos en el eje (aunque
  // alguno tenga 0 horas), para poder compararlas una al lado de la otra.
  const AREAS_COMPARABLES = ["inspecciones", "proyectos"];
  const areasParaPeriodos = AREAS_COMPARABLES.includes(area) ? AREAS_COMPARABLES : [area];

  useEffect(() => {
    const cargarManual = async () => {
      const { data } = await supabase.from("horas_extras_manual").select("*").in("area", areasParaPeriodos).order("created_at", { ascending: true });
      if (data) setFilasTodas(data);
    };
    const cargarReales = async () => {
      const { data } = await supabase.from("horas_extras").select("*").in("area", areasParaPeriodos).in("estado", ["Aprobada", "Cerrada"]);
      if (data) setRealesTodas(data);
    };
    cargarManual();
    cargarReales();
    // Se refresca sola, para que si apruebas/cierras una solicitud mientras
    // tienes esta gráfica abierta, el número se actualice sin recargar la página.
    const intervalo = setInterval(() => { cargarManual(); cargarReales(); }, 20000);
    return () => clearInterval(intervalo);
  }, [area]);

  const filas = filasTodas.filter((f) => f.area === area);
  const reales = realesTodas.filter((r) => r.area === area);

  const autoPorQuincena = {};
  const fechaPorQuincenaAuto = {};
  reales.forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef) return;
    const etiqueta = etiquetaPeriodo(fechaRef, fechasCorte);
    autoPorQuincena[etiqueta] = (autoPorQuincena[etiqueta] || 0) + (Number(h.horas) || 0);
    if (!fechaPorQuincenaAuto[etiqueta] || fechaRef < fechaPorQuincenaAuto[etiqueta]) fechaPorQuincenaAuto[etiqueta] = fechaRef;
  });
  // Los periodos que se muestran en el eje se arman con TODOS los registros
  // (manual + reales) de las áreas comparables, no solo los de esta área,
  // para que el eje quede igual entre Inspecciones y Proyectos.
  const fechaPorQuincenaCompartida = {};
  realesTodas.forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef) return;
    const etiqueta = etiquetaPeriodo(fechaRef, fechasCorte);
    if (!fechaPorQuincenaCompartida[etiqueta] || fechaRef < fechaPorQuincenaCompartida[etiqueta]) fechaPorQuincenaCompartida[etiqueta] = fechaRef;
  });
  const quincenasOrdenadas = [];
  filasTodas.forEach((f) => { if (!quincenasOrdenadas.includes(f.quincena)) quincenasOrdenadas.push(f.quincena); });
  const soloAuto = [...new Set(realesTodas.map((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    return fechaRef ? etiquetaPeriodo(fechaRef, fechasCorte) : null;
  }))].filter((q) => q && !quincenasOrdenadas.includes(q));
  soloAuto.sort((a, b) => (fechaPorQuincenaCompartida[a] || "").localeCompare(fechaPorQuincenaCompartida[b] || ""));
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
            <ReferenceLine y={156} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Límite 156h", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
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
  const { fechasCorte } = useContext(FechasCorteContext);
  const [facturas, setFacturas] = useState([]);
  const [nuevoMesCombinado, setNuevoMesCombinado] = useState({ mes: "", montoActual: "", montoAnterior: "" });
  const [horasManual, setHorasManual] = useState([]);
  const [horasReales, setHorasReales] = useState([]);
  const [ventanaHoras, setVentanaHoras] = useState(0); // 0 = ventana más reciente
  const graficoRef = React.useRef(null);
  const [ventanaFactura, setVentanaFactura] = useState(0);
  const [filtroCorrectivos, setFiltroCorrectivos] = useState("Todos");
  const VENTANA_MESES = 12;
  const { clientes } = useContext(ClientesContext);
  const PUNTO_EQUILIBRIO = 120000;
  const PUNTO_EQUILIBRIO_HORAS = 156;
  const VENTANA_QUINCENAS = 12;

  useEffect(() => {
    const cargarTodo = () => {
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
    };
    cargarTodo();
    // Se refresca sola cada 20s, para que si apruebas/cierras horas extras o
    // cambias facturación mientras tienes Administrativo abierto, se actualice sin recargar.
    const intervalo = setInterval(cargarTodo, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const agregarMesCombinado = async () => {
    if (!nuevoMesCombinado.mes) return;
    const inserts = [];
    if (nuevoMesCombinado.montoActual) inserts.push({ mes: nuevoMesCombinado.mes, anio: anioMasReciente, monto: Number(nuevoMesCombinado.montoActual) });
    if (nuevoMesCombinado.montoAnterior) inserts.push({ mes: nuevoMesCombinado.mes, anio: anioMasReciente - 1, monto: Number(nuevoMesCombinado.montoAnterior) });
    if (inserts.length === 0) return;
    setNuevoMesCombinado({ mes: "", montoActual: "", montoAnterior: "" });
    const { data, error } = await supabase.from("facturacion").insert(inserts).select();
    if (!error && data) setFacturas((prev) => [...prev, ...data]);
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
  const horasAutoPorQuincena = {};
  const fechaPorQuincenaAuto = {};
  horasReales.forEach((h) => {
    const fechaRef = h.fecha_ejecucion || h.fecha;
    if (!fechaRef) return;
    const etiqueta = etiquetaPeriodo(fechaRef, fechasCorte);
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
    const insp = tieneManualInsp
      ? horasManual.filter((f) => f.quincena === q && f.area === "inspecciones").reduce((s, f) => s + Number(f.horas || 0), 0)
      : Math.round((horasAutoPorQuincena[q]?.inspecciones || 0) * 100) / 100;
    const proy = tieneManualProy
      ? horasManual.filter((f) => f.quincena === q && f.area === "proyectos").reduce((s, f) => s + Number(f.horas || 0), 0)
      : Math.round((horasAutoPorQuincena[q]?.proyectos || 0) * 100) / 100;
    return {
      quincena: q,
      Inspecciones: insp,
      Proyectos: proy,
      Total: Math.round((insp + proy) * 100) / 100,
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
      ["Quincenas sobre 156h — Inspecciones", quincenasSobreInsp],
      ["Quincenas sobre 156h — Proyectos", quincenasSobreProy],
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

  // La gráfica principal y los KPI de arriba solo muestran el año más
  // reciente cargado (el "año en curso"); los años anteriores (ej. 2025)
  // quedan reservados únicamente para la gráfica de comparación de abajo.
  const anioMasReciente = facturas.reduce((max, f) => (f.anio && f.anio > max ? f.anio : max), new Date().getFullYear());
  const facturasAnioActual = facturas.filter((f) => !f.anio || f.anio === anioMasReciente);
  const facturasAnioAnterior = facturas.filter((f) => f.anio === anioMasReciente - 1);

  const totalFacturado = facturasAnioActual.reduce((s, f) => s + f.monto, 0);
  const avgFactura = totalFacturado / (facturasAnioActual.length || 1);
  const mesesSobre = facturasAnioActual.filter((f) => f.monto >= PUNTO_EQUILIBRIO).length;

  const totalVentanasFactura = Math.max(1, Math.ceil(facturasAnioActual.length / VENTANA_MESES));
  const ventanaFacturaActual = Math.min(ventanaFactura, totalVentanasFactura - 1);
  const finVentanaFactura = facturasAnioActual.length - ventanaFacturaActual * VENTANA_MESES;
  const inicioVentanaFactura = Math.max(0, finVentanaFactura - VENTANA_MESES);
  const facturasVentana = facturasAnioActual.slice(inicioVentanaFactura, finVentanaFactura);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }} id="reporte-ejecutivo-print">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-ejecutivo-print, #reporte-ejecutivo-print * { visibility: visible; }
          #reporte-ejecutivo-print { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn variant="accent" onClick={() => window.print()}><Download size={14} /> Descargar PDF</Btn>
      </div>
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
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green }}>{mesesSobre} / {facturasAnioActual.length}</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>OD activos (total)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.steel }}>{totalActivos}</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ResumenCotizacionesCard />
        <ResumenEHSCard />
      </div>

      <Card
        title="Facturación mensual vs. punto de equilibrio ($120,000)"
        action={
          <div className="no-print" style={{ display: "flex", gap: 6 }}>
            {isAdmin && <Btn small variant="danger" onClick={reiniciarAnioFacturacion}><X size={13} /> Reiniciar año</Btn>}
          </div>
        }
      >
        {(() => {
          const ORDEN_MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
          const dataGrafica = ORDEN_MESES.map((mes) => ({
            mes,
            [String(anioMasReciente)]: facturasAnioActual.find((f) => normalizarMesCorto(f.mes) === mes)?.monto ?? null,
            [String(anioMasReciente - 1)]: facturasAnioAnterior.find((f) => normalizarMesCorto(f.mes) === mes)?.monto ?? null,
          }));
          const mesesConDatos = ORDEN_MESES.filter((mes) =>
            facturasAnioActual.some((f) => normalizarMesCorto(f.mes) === mes) || facturasAnioAnterior.some((f) => normalizarMesCorto(f.mes) === mes)
          );
          return (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dataGrafica} margin={{ top: 26, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Legend />
                  <ReferenceLine y={PUNTO_EQUILIBRIO} stroke={T.red} strokeDasharray="6 4" label={{ value: "Punto de equilibrio", fill: T.red, fontSize: 11, position: "insideTopRight" }} />
                  <Line type="monotone" dataKey={String(anioMasReciente - 1)} stroke={T.gray} strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey={String(anioMasReciente)} stroke={T.accent} strokeWidth={3} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>

              <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, margin: "16px 0 8px" }}>Editar montos por mes (el mes se escribe una sola vez, comparte fila entre los 2 años)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 16 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <th style={{ padding: "6px 8px" }}>Mes</th>
                    <th>{anioMasReciente} (actual)</th>
                    <th>{anioMasReciente - 1} (anterior)</th>
                  </tr>
                </thead>
                <tbody>
                  {mesesConDatos.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: "10px 8px", color: T.gray }}>Todavía no hay meses cargados.</td></tr>
                  ) : mesesConDatos.map((mes) => {
                    const filaActual = facturasAnioActual.find((f) => normalizarMesCorto(f.mes) === mes);
                    const filaAnterior = facturasAnioAnterior.find((f) => normalizarMesCorto(f.mes) === mes);
                    return (
                      <tr key={mes} style={{ borderTop: `1px solid ${T.line}` }}>
                        <td style={{ padding: "8px", fontWeight: 700 }}>{mes}</td>
                        <td>
                          {filaActual ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="number" value={filaActual.monto} onChange={(e) => editarMonto(filaActual.id, e.target.value)} style={{ ...inputStyle, width: 100, padding: "5px 8px", fontSize: 12.5 }} />
                              <button onClick={() => eliminarMes(filaActual.id)} title="Borrar" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14 }}>×</button>
                            </div>
                          ) : <span style={{ color: T.gray }}>—</span>}
                        </td>
                        <td>
                          {filaAnterior ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input type="number" value={filaAnterior.monto} onChange={(e) => editarMonto(filaAnterior.id, e.target.value)} style={{ ...inputStyle, width: 100, padding: "5px 8px", fontSize: 12.5 }} />
                              <button onClick={() => eliminarMes(filaAnterior.id)} title="Borrar" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14 }}>×</button>
                            </div>
                          ) : <span style={{ color: T.gray }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <Field label="Mes nuevo"><input style={inputStyle} value={nuevoMesCombinado.mes} onChange={(e) => setNuevoMesCombinado({ ...nuevoMesCombinado, mes: e.target.value })} placeholder="Jul" /></Field>
                <Field label={`Monto ${anioMasReciente}`}><input style={inputStyle} type="number" value={nuevoMesCombinado.montoActual} onChange={(e) => setNuevoMesCombinado({ ...nuevoMesCombinado, montoActual: e.target.value })} placeholder="125000" /></Field>
                <Field label={`Monto ${anioMasReciente - 1}`}><input style={inputStyle} type="number" value={nuevoMesCombinado.montoAnterior} onChange={(e) => setNuevoMesCombinado({ ...nuevoMesCombinado, montoAnterior: e.target.value })} placeholder="(opcional)" /></Field>
                <Btn variant="accent" onClick={agregarMesCombinado}><Plus size={14} /> Agregar mes</Btn>
              </div>
            </>
          );
        })()}
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
          <div className="no-print" style={{ display: "flex", gap: 6 }}>
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
              <ReferenceLine y={PUNTO_EQUILIBRIO_HORAS} stroke={T.accent} strokeDasharray="6 4" label={{ value: "Límite 156h", fill: T.accent, fontSize: 11, position: "insideTopRight" }} />
              <Line type="monotone" dataKey="Inspecciones" stroke={T.turquoise} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Proyectos" stroke={T.green} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Total" stroke={T.steel} strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>

      <ResumenGastosCard />
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
      {tab === "resumen" && <ResumenEjecutivo />}
      {tab === "usuarios" && <GestionUsuarios />}
    </div>
  );
}

// Ranking de Entrenamiento (visible para todos dentro de Entrenamiento):
// tabla de todo el personal ordenada por puntaje total, con su rango/
// trofeo, sus insignias, y el desglose por módulo — para generar
// competitividad sana entre técnicos.
function RankingEntrenamiento() {
  const [puntajes, setPuntajes] = useState([]);
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("entrenamiento_puntajes").select("*");
      if (data) setPuntajes(data);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const porPersona = {};
  puntajes.forEach((p) => {
    if (!porPersona[p.personal_codigo]) porPersona[p.personal_codigo] = { nombre: p.personal_nombre, total: 0, porSegmento: {}, repasos: 0 };
    porPersona[p.personal_codigo].total += p.puntos;
    porPersona[p.personal_codigo].porSegmento[p.segmento] = (porPersona[p.personal_codigo].porSegmento[p.segmento] || 0) + p.puntos;
    if (p.ejercicio && p.ejercicio.includes("(repaso)")) porPersona[p.personal_codigo].repasos += 1;
  });
  const filas = Object.values(porPersona).sort((a, b) => b.total - a.total);
  const medallas = ["🥇", "🥈", "🥉"];
  const coloresAvatar = ["#ff8787", "#74c0fc", "#63e6be", "#ffd43b", "#b197fc", "#ffa94d"];
  const TOTAL_INSIGNIAS = 17;

  return (
    <Card title="Ranking de Entrenamiento — todo el personal">
      {filas.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13 }}>Todavía nadie ha jugado ningún módulo de Entrenamiento.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <style>{`@keyframes oroShimmer { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "8px" }}>#</th><th>Persona</th><th>Rango</th><th>Puntaje total</th><th>Premios</th><th>Repasos</th>
              {SEGMENTOS_ENTRENAMIENTO.map((s) => <th key={s.id}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const rango = calcularRangoUsuario(f.total, f.porSegmento);
              const iniciales = f.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
              const premios = contarInsigniasGanadas(f.total, f.porSegmento, f.repasos);
              return (
                <tr key={f.nombre} style={{
                  borderTop: `1px solid ${T.line}`,
                  background: i === 0 ? "linear-gradient(90deg, #fff9db, #ffe066aa, #fff9db)" : i < 3 ? rango.soft + "40" : "transparent",
                  backgroundSize: i === 0 ? "200% 100%" : undefined,
                  animation: i === 0 ? "oroShimmer 3s ease-in-out infinite" : "none",
                }}>
                  <td style={{ padding: "10px 8px", fontWeight: 800, fontSize: i < 3 ? 16 : 13, color: i === 0 ? T.accent : T.ink }}>{medallas[i] || i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: coloresAvatar[i % coloresAvatar.length], color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{iniciales}</div>
                      <span style={{ fontWeight: 700 }}>{f.nombre}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Badge color={rango.color} soft={rango.soft}>{rango.nombre}</Badge>
                      {rango.tipo && <IconTrofeo tipo={rango.tipo} size={14} color={rango.color} />}
                    </div>
                  </td>
                  <td style={{ fontWeight: 800 }}>{f.total} pts</td>
                  <td style={{ color: T.inkSoft }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700, color: T.ink }}><Medal size={12} color="#f59f00" />{premios}/{TOTAL_INSIGNIAS}</span>
                  </td>
                  <td style={{ color: T.inkSoft }}>
                    {f.repasos > 0 ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Repeat size={11} color={T.turquoise} />{f.repasos}</span> : "—"}
                  </td>
                  {SEGMENTOS_ENTRENAMIENTO.map((s) => <td key={s.id} style={{ color: T.inkSoft }}>{f.porSegmento[s.id] || 0} pts</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </Card>
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
      const gInsp = await fetchGoogleCalendarEventos("inspecciones", isoDate(desde), isoDate(hasta));
      const gProy = await fetchGoogleCalendarEventos("proyectos", isoDate(desde), isoDate(hasta));
      if (!activo) return;
      // Si una consulta falla (ej. límite de Google), conserva los datos
      // que ya había en pantalla para esa área en vez de dejarla en blanco.
      setEventosGoogle((prev) => {
        const inspFinal = gInsp !== null ? gInsp : prev.filter((e) => e.area === "inspecciones");
        const proyFinal = gProy !== null ? gProy : prev.filter((e) => e.area === "proyectos");
        return [...inspFinal, ...proyFinal];
      });
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
  const irAFecha = (valor) => {
    if (!valor) return;
    const [anio, mes, dia] = valor.split("-").map(Number);
    setCursor(new Date(anio, mes - 1, dia));
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
            <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, width: 150 }} title="Ir a una fecha" />
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
            <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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
            <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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
            <input type="date" onChange={(e) => irAFecha(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 140 }} title="Ir a una fecha" />
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
    const cargar = async () => {
      const { data } = await supabase.from("facturacion").select("*").order("created_at", { ascending: true });
      if (data) setFacturas(data);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);
  // Solo se muestra el año más reciente cargado; los años anteriores
  // quedan reservados para la gráfica de comparación de Administrativo.
  const anioMasReciente = facturas.reduce((max, f) => (f.anio && f.anio > max ? f.anio : max), new Date().getFullYear());
  const facturasAnioActual = facturas.filter((f) => !f.anio || f.anio === anioMasReciente);
  const totalVentanas = Math.max(1, Math.ceil(facturasAnioActual.length / VENTANA_MESES));
  const ventanaActual = Math.min(ventana, totalVentanas - 1);
  const finVentana = facturasAnioActual.length - ventanaActual * VENTANA_MESES;
  const inicioVentana = Math.max(0, finVentana - VENTANA_MESES);
  const facturasVentana = facturasAnioActual.slice(inicioVentana, finVentana);
  return (
    <Card
      title="Facturación mensual vs. punto de equilibrio ($120,000)"
      action={facturasAnioActual.length > 0 && (
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.min(v + 1, totalVentanas - 1))} disabled={ventanaActual >= totalVentanas - 1}><ChevronLeft size={14} /></Btn>
          <Btn small variant="ghost" onClick={() => setVentana((v) => Math.max(v - 1, 0))} disabled={ventanaActual <= 0}><ChevronRight size={14} /></Btn>
        </div>
      )}
    >
      {facturasAnioActual.length === 0 ? (
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
function FechasDeCorte({ isAdmin, confirmar }) {
  const { fechasCorte, refetchFechasCorte } = useContext(FechasCorteContext);
  const [rows, setRows] = useState([]);
  const [nuevaFecha, setNuevaFecha] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("fechas_corte").select("*").order("fecha", { ascending: true });
      if (data) setRows(data);
    })();
  }, []);

  const agregar = async () => {
    if (!nuevaFecha) return;
    const { data, error } = await supabase.from("fechas_corte").insert({ fecha: nuevaFecha }).select().single();
    if (!error && data) {
      setRows((prev) => [...prev, data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      setNuevaFecha("");
      refetchFechasCorte();
    }
  };
  const eliminar = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar esta fecha de corte?"))) return;
    setRows((prev) => prev.filter((f) => f.id !== id));
    await supabase.from("fechas_corte").delete().eq("id", id);
    refetchFechasCorte();
  };

  const [reorganizando, setReorganizando] = useState(false);
  const [anioReorganizar, setAnioReorganizar] = useState(new Date().getFullYear());
  const fechaAproximadaDeQuincena = (quincena, anio) => {
    const partes = String(quincena || "").trim().split(" ");
    if (partes.length < 2) return null;
    const rango = partes[0];
    const nombreMes = partes[1];
    const mesIdx = MESES_CORTOS_QNA.indexOf(nombreMes);
    if (mesIdx === -1) return null;
    const diaInicio = parseInt(rango.split("-")[0], 10);
    if (!diaInicio) return null;
    return `${anio}-${String(mesIdx + 1).padStart(2, "0")}-${String(diaInicio).padStart(2, "0")}`;
  };
  const reorganizarQuincenas = async () => {
    if (rows.length === 0) return;
    const anio = Number(anioReorganizar) || new Date().getFullYear();
    if (!(await confirmar(
      `Esto va a reorganizar TODAS las quincenas manuales que ya tienes cargadas (${anio}) según tus nuevas fechas de corte, sumando las que caigan en el mismo periodo. Esta acción no se puede deshacer. ¿Continuar?`
    ))) return;
    setReorganizando(true);
    try {
      const { data: manuales } = await supabase.from("horas_extras_manual").select("*");
      if (!manuales || manuales.length === 0) { setReorganizando(false); return; }
      const fechasCorteOrdenadas = rows.map((r) => r.fecha);
      const consolidado = {};
      manuales.forEach((m) => {
        const fechaAprox = fechaAproximadaDeQuincena(m.quincena, anio);
        if (!fechaAprox) return;
        const nuevaEtiqueta = etiquetaPeriodo(fechaAprox, fechasCorteOrdenadas);
        const key = `${m.area}|||${nuevaEtiqueta}`;
        consolidado[key] = (consolidado[key] || 0) + (Number(m.horas) || 0);
      });
      const idsViejos = manuales.map((m) => m.id);
      await supabase.from("horas_extras_manual").delete().in("id", idsViejos);
      const filasNuevas = Object.entries(consolidado).map(([key, horas]) => {
        const [area, quincena] = key.split("|||");
        return { area, quincena, horas };
      });
      if (filasNuevas.length > 0) await supabase.from("horas_extras_manual").insert(filasNuevas);
      alert(`Listo: se reorganizaron ${manuales.length} registros en ${filasNuevas.length} periodos nuevos.`);
    } finally {
      setReorganizando(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Fechas de corte">
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" style={inputStyle} value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />
            <Btn variant="accent" onClick={agregar}><Plus size={14} /> Agregar corte</Btn>
            {rows.length > 0 && (
              <>
                <input type="number" style={{ ...inputStyle, width: 90 }} value={anioReorganizar} onChange={(e) => setAnioReorganizar(e.target.value)} title="Año de las quincenas a reorganizar" />
                <Btn variant="ghost" onClick={reorganizarQuincenas} disabled={reorganizando}>
                  {reorganizando ? "Reorganizando..." : `Reorganizar quincenas ${anioReorganizar}`}
                </Btn>
              </>
            )}
          </div>
        )}
        {rows.length === 0 ? (
          <div style={{ color: T.gray, fontSize: 13 }}>Todavía no has agregado ninguna fecha de corte.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "6px 8px" }}>Fecha de corte</th><th>Periodo que cierra</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f, i) => {
                const anterior = i > 0 ? rows[i - 1].fecha : null;
                return (
                  <tr key={f.id} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ padding: "9px 8px", fontWeight: 700 }}>{f.fecha}</td>
                    <td style={{ color: T.inkSoft }}>{etiquetaPeriodoDeCorte(f.fecha, rows.map((r) => r.fecha))}{anterior ? "" : " (desde el inicio)"}</td>
                    <td>{isAdmin && <Btn small variant="danger" onClick={() => eliminar(f.id)}><X size={12} /></Btn>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const GASTO_CATEGORIAS_DEFECTO = [
  "Herramientas", "Restaurantes", "Equipo de oficina", "EPP", "Hospedaje",
  "Boletos de avión", "Hogar", "Supermercados", "Electrónicos",
  "Equipos de alarmas", "Baterías", "Gasolina", "Automotriz",
];

function ResumenGastosCard() {
  const [rows, setRows] = useState([]);
  const [monedaVista, setMonedaVista] = useState("Colones");
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("gastos_tarjeta").select("personal_nombre, categoria, monto, fecha, moneda");
      if (data) setRows(data);
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const fmtEnMoneda = (n, moneda) => (moneda === "Dólares" ? "$" : "₡") + Number(n || 0).toLocaleString("en-US");

  const totalColones = rows.filter((r) => (r.moneda || "Colones") === "Colones").reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const totalDolares = rows.filter((r) => r.moneda === "Dólares").reduce((s, r) => s + (Number(r.monto) || 0), 0);

  const rowsMoneda = rows.filter((r) => (r.moneda || "Colones") === monedaVista);

  const porPersona = {};
  rowsMoneda.forEach((r) => { porPersona[r.personal_nombre] = (porPersona[r.personal_nombre] || 0) + (Number(r.monto) || 0); });
  const dataPersona = Object.entries(porPersona).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto).slice(0, 8);

  const porCategoria = {};
  rowsMoneda.forEach((r) => { porCategoria[r.categoria] = (porCategoria[r.categoria] || 0) + (Number(r.monto) || 0); });
  const dataCategoria = Object.entries(porCategoria).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto);

  const MESES_CORTOS_GASTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  const porMes = {};
  rowsMoneda.forEach((r) => {
    if (!r.fecha) return;
    const [anio, mes] = r.fecha.split("-").map(Number);
    const clave = `${MESES_CORTOS_GASTOS[mes - 1]} ${anio}`;
    porMes[clave] = (porMes[clave] || 0) + (Number(r.monto) || 0);
  });
  const dataMes = Object.entries(porMes)
    .map(([mes, monto]) => ({ mes, monto, _orden: mes.split(" ")[1] + String(MESES_CORTOS_GASTOS.indexOf(mes.split(" ")[0])).padStart(2, "0") }))
    .sort((a, b) => a._orden.localeCompare(b._orden));

  return (
    <Card title="Gastos de Tarjeta de Crédito">
      {rows.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13 }}>Todavía no hay gastos cargados.</div>
      ) : (
        <>
        <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ background: T.blueSoft, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Total en Colones</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.blue }}>₡{totalColones.toLocaleString("en-US")}</div>
          </div>
          <div style={{ background: T.greenSoft, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Total en Dólares</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.green }}>${totalDolares.toLocaleString("en-US")}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Btn small variant={monedaVista === "Colones" ? "accent" : "ghost"} onClick={() => setMonedaVista("Colones")}>Ver gráficas en Colones</Btn>
          <Btn small variant={monedaVista === "Dólares" ? "accent" : "ghost"} onClick={() => setMonedaVista("Dólares")}>Ver gráficas en Dólares</Btn>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>Cuándo se gasta (por mes)</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dataMes} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmtEnMoneda(v, monedaVista)} />
              <Line type="monotone" dataKey="monto" stroke={T.accent} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>Quién gasta más</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataPersona} margin={{ top: 20, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} />
                <XAxis dataKey="nombre" tick={{ fontSize: 10.5 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtEnMoneda(v, monedaVista)} />
                <Bar dataKey="monto" fill={T.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>En qué se gasta más</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dataCategoria} dataKey="monto" nameKey="nombre" cx="50%" cy="50%" outerRadius={75} label={({ nombre }) => nombre}>
                  {dataCategoria.map((_, i) => <Cell key={i} fill={PALETA_OD[i % PALETA_OD.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtEnMoneda(v, monedaVista)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>
      )}
    </Card>
  );
}

function GastosTarjeta() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canGestionar = isAdmin || currentUser?.categoria === "asistente";
  const canAdminCategorias = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const { clientes } = useContext(ClientesContext);
  const [rows, setRows] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [categorias, setCategorias] = useState(GASTO_CATEGORIAS_DEFECTO);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [filtroPersonal, setFiltroPersonal] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroOd, setFiltroOd] = useState("");
  const [filtroMoneda, setFiltroMoneda] = useState("Todas");
  const [diagnostico, setDiagnostico] = useState("");
  const [form, setForm] = useState({
    personalCodigo: "", fecha: todayISO(), monto: "", numeroFactura: "",
    categoria: GASTO_CATEGORIAS_DEFECTO[0], od: "", observaciones: "",
    moneda: "Colones", estadoTransaccion: "Aprobada", nombreTarjeta: "", numeroTarjeta: "",
    detalle: "", tipoTransaccion: "C", pais: "Costa Rica", departamento: "",
  });

  const odsCombinados = [...(clientes.inspecciones || []), ...(clientes.proyectos || [])];
  const fileInputRefGastos = React.useRef(null);

  useEffect(() => {
    const cargarTodo = () => {
      refetchGastos();
      (async () => {
        const { data } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
        if (data) setEmpleados(data);
      })();
      (async () => {
        const { data } = await supabase.from("gastos_categorias").select("*").order("nombre", { ascending: true });
        if (data && data.length > 0) setCategorias(data.map((c) => c.nombre));
      })();
    };
    cargarTodo();
    const intervalo = setInterval(cargarTodo, 20000);
    return () => clearInterval(intervalo);
  }, []);

  // Compara "NOMBRE TARJETA" (ej. "ADRIAN CASTILLO L.") contra el nombre
  // real en Planilla, ignorando tildes/mayúsculas y comparando por palabras,
  // para relacionar el gasto con la persona automáticamente al importar.
  const normalizarNombre = (s) => (s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[.,]/g, "").trim();
  const buscarEmpleadoPorNombreTarjeta = (nombreTarjeta) => {
    const objetivo = normalizarNombre(nombreTarjeta);
    if (!objetivo) return null;
    const palabrasObjetivo = objetivo.split(/\s+/).filter(Boolean);
    let mejor = null;
    let mejorPuntaje = 0;
    empleados.forEach((emp) => {
      const palabrasEmp = normalizarNombre(emp.nombre).split(/\s+/).filter(Boolean);
      const coincidencias = palabrasEmp.filter((p) => palabrasObjetivo.includes(p)).length;
      if (coincidencias > mejorPuntaje) { mejorPuntaje = coincidencias; mejor = emp; }
    });
    return mejorPuntaje >= 2 ? mejor : null; // al menos nombre + apellido coinciden
  };

  const refetchGastos = async () => {
    const { data } = await supabase.from("gastos_tarjeta").select("*").order("fecha", { ascending: false });
    if (data) setRows(data);
    return data;
  };

  const handleImportGastos = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDiagnostico("Leyendo archivo...");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Se lee por POSICIÓN de columna (A, B, C...) en vez de por el texto
        // del título, ya que el formato del banco siempre trae las columnas
        // en el mismo orden exacto — así se evita cualquier problema
        // invisible de acentos/espacios en el encabezado.
        const filas = XLSX.utils.sheet_to_json(ws, { header: 1, range: 1, defval: "" });
        if (filas.length === 0) {
          setDiagnostico("El archivo no tiene filas de datos (solo encabezados, o está vacío).");
          return;
        }
        const COL = {
          fecha: 0, monto: 1, monedaDesc: 2, categoria: 3, descripcion: 4, estado: 5,
          monedaAlpha: 6, nombreTarjeta: 7, numeroTarjeta: 8, detalle: 9,
          tipoTransaccion: 10, pais: 11, departamento: 12, od: 13,
        };

        // Categorías nuevas que traiga el archivo y que todavía no existan.
        const categoriasNuevas = [];
        filas.forEach((fila) => {
          const cat = String(fila[COL.categoria] || "").trim();
          if (cat && !categorias.includes(cat) && !categoriasNuevas.includes(cat)) categoriasNuevas.push(cat);
        });
        if (categoriasNuevas.length > 0) {
          await supabase.from("gastos_categorias").insert(categoriasNuevas.map((nombre) => ({ nombre })));
          setCategorias((prev) => [...prev, ...categoriasNuevas].sort());
        }

        let sinRelacionar = 0;
        const nuevas = filas.map((fila) => {
          const nombreTarjeta = String(fila[COL.nombreTarjeta] || "").trim();
          const empleado = buscarEmpleadoPorNombreTarjeta(nombreTarjeta);
          if (!empleado) sinRelacionar++;
          const monedaTexto = String(fila[COL.monedaDesc] || "").toLowerCase();
          return {
            personal_codigo: empleado?.codigo || null,
            personal_nombre: empleado?.nombre || nombreTarjeta || "Sin asignar",
            fecha: excelValueToISODate(fila[COL.fecha]) || todayISO(),
            monto: parsearMontoImportado(fila[COL.monto]),
            numero_factura: null,
            categoria: String(fila[COL.categoria] || "").trim() || "Otros",
            od: String(fila[COL.od] || "").trim() || null,
            observaciones: String(fila[COL.descripcion] || "").trim() || null,
            moneda: monedaTexto.includes("dólar") || monedaTexto.includes("dolar") ? "Dólares" : "Colones",
            estado_transaccion: String(fila[COL.estado] || "").trim() || "Aprobada",
            nombre_tarjeta: nombreTarjeta || null,
            numero_tarjeta: String(fila[COL.numeroTarjeta] || "").trim() || null,
            detalle: String(fila[COL.detalle] || "").trim() || null,
            tipo_transaccion: String(fila[COL.tipoTransaccion] || "C").trim(),
            pais: String(fila[COL.pais] || "").trim() || null,
            departamento: String(fila[COL.departamento] || "").trim() || null,
          };
        });

        setDiagnostico(`Se leyeron ${nuevas.length} filas. Primera fila leída → Fecha: ${nuevas[0].fecha}, Monto: ${nuevas[0].monto} (columna B cruda: ${JSON.stringify(filas[0][COL.monto])}), Categoría: ${nuevas[0].categoria}, Personal: ${nuevas[0].personal_nombre}, OD: ${nuevas[0].od || "—"}. Guardando en la base de datos...`);

        const { data: inserted, error } = await supabase.from("gastos_tarjeta").insert(nuevas).select();
        if (error) {
          setDiagnostico(`ERROR al guardar: ${error.message} (código: ${error.code || "sin código"}). Es muy probable que falte correr el SQL de 'gastos_tarjeta' en Supabase, o que falten columnas.`);
          return;
        }
        // Siempre se vuelve a traer la tabla completa desde la base de datos,
        // en vez de confiar solo en lo que devolvió la inserción, para que
        // no haya dudas de que lo que se ve en pantalla es lo que hay guardado.
        const datosFrescos = await refetchGastos();
        setFiltroPersonal("");
        setFiltroCategoria("Todas");
        setFiltroOd("");
        setDiagnostico(`Listo: se guardaron ${inserted?.length ?? nuevas.length} gastos. La tabla ahora tiene ${datosFrescos?.length ?? "?"} gastos en total.${sinRelacionar > 0 ? ` ${sinRelacionar} no se pudieron relacionar automáticamente con Planilla.` : ""}`);
      } catch (err) {
        console.error(err);
        setDiagnostico("No se pudo leer el archivo: " + (err.message || "error desconocido") + ". Confirma que sea el formato exacto del banco.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const reiniciarGastos = async () => {
    if (!(await confirmar("¿Está seguro que desea BORRAR TODOS los gastos de tarjeta cargados? Esta acción no se puede deshacer.", { confirmLabel: "Sí, borrar todo", variant: "danger" }))) return;
    const ids = rows.map((r) => r.id);
    setRows([]);
    setDiagnostico("");
    for (const id of ids) await supabase.from("gastos_tarjeta").delete().eq("id", id);
  };

  const add = async () => {
    const empleado = empleados.find((e) => e.codigo === form.personalCodigo);
    if (!empleado || !form.monto || !form.categoria) return;
    const payload = {
      personal_codigo: form.personalCodigo, personal_nombre: empleado.nombre,
      fecha: form.fecha || todayISO(), monto: Number(form.monto) || 0,
      numero_factura: form.numeroFactura || null, categoria: form.categoria,
      od: form.od || null, observaciones: form.observaciones || null,
      moneda: form.moneda, estado_transaccion: form.estadoTransaccion,
      nombre_tarjeta: form.nombreTarjeta || null, numero_tarjeta: form.numeroTarjeta || null,
      detalle: form.detalle || null, tipo_transaccion: form.tipoTransaccion,
      pais: form.pais || null, departamento: form.departamento || null,
    };
    setForm({
      personalCodigo: form.personalCodigo, fecha: todayISO(), monto: "", numeroFactura: "",
      categoria: form.categoria, od: "", observaciones: "",
      moneda: form.moneda, estadoTransaccion: "Aprobada", nombreTarjeta: form.nombreTarjeta, numeroTarjeta: form.numeroTarjeta,
      detalle: "", tipoTransaccion: form.tipoTransaccion, pais: form.pais, departamento: form.departamento,
    });
    const { data, error } = await supabase.from("gastos_tarjeta").insert(payload).select().single();
    if (!error && data) setRows((prev) => [data, ...prev]);
  };
  const del = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este gasto? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("gastos_tarjeta").delete().eq("id", id).then();
  };
  const setCampoGasto = (id, campo, valor) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [campo]: valor } : r));
    supabase.from("gastos_tarjeta").update({ [campo]: valor }).eq("id", id).then();
  };
  const setPersonalGasto = (id, codigo) => {
    const empleado = empleados.find((e) => e.codigo === codigo);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, personal_codigo: codigo, personal_nombre: empleado?.nombre || r.personal_nombre } : r));
    supabase.from("gastos_tarjeta").update({ personal_codigo: codigo, personal_nombre: empleado?.nombre || null }).eq("id", id).then();
  };
  const agregarCategoria = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre || categorias.includes(nombre)) return;
    setNuevaCategoria("");
    const { error } = await supabase.from("gastos_categorias").insert({ nombre });
    if (!error) setCategorias((prev) => [...prev, nombre].sort());
  };

  const rowsFiltradas = rows.filter((r) => {
    const matchPersonal = !filtroPersonal || r.personal_nombre === filtroPersonal;
    const matchCategoria = filtroCategoria === "Todas" || r.categoria === filtroCategoria;
    const matchOd = !filtroOd.trim() || (r.od || "").toLowerCase().includes(filtroOd.trim().toLowerCase());
    const matchMoneda = filtroMoneda === "Todas" || (r.moneda || "Colones") === filtroMoneda;
    return matchPersonal && matchCategoria && matchOd && matchMoneda;
  });
  const totalFiltradoColones = rowsFiltradas.filter((r) => (r.moneda || "Colones") === "Colones").reduce((s, r) => s + (Number(r.monto) || 0), 0);
  const totalFiltradoDolares = rowsFiltradas.filter((r) => r.moneda === "Dólares").reduce((s, r) => s + (Number(r.monto) || 0), 0);

  const descargarInformeBanco = () => {
    const filas = rowsFiltradas.map((r) => ({
      "FECHA DE LA TRANSACCIÓN": r.fecha,
      "MONTO DE LA TRANSACCIÓN": r.monto,
      "DESCRIPCIÓN DE MONEDA DE LA TRANSACCIÓN": r.moneda || "",
      "NOMBRE DE LA CATEGORÍA DE COMERCIO": r.categoria || "",
      "DESCRIPCIÓN": r.observaciones || "",
      "ESTADO": r.estado_transaccion || "",
      "CÓDIGO ALPHA DE LA MONEDA DE LA TRANSACCIÓN": r.moneda === "Dólares" ? "USD" : "CRC",
      "NOMBRE TARJETA": r.nombre_tarjeta || "",
      "NÚMERO DE TARJETA ENMASCARADO": r.numero_tarjeta || "",
      "DETALLE": r.detalle || "",
      "TIPO DE TRANSACCIÓN (D DÉBITO, C CRÉDITO)": r.tipo_transaccion || "",
      "PAIS": r.pais || "",
      "DEPARTAMENTO": r.departamento || "",
      "OD": r.od || "",
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Report.xlsx");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ResumenGastosCard />
        <Card
          title={`Gastos registrados — Total: ₡${totalFiltradoColones.toLocaleString("en-US")} + $${totalFiltradoDolares.toLocaleString("en-US")}`}
          action={
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={fileInputRefGastos} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportGastos} />
              <Btn small variant="accent" onClick={() => fileInputRefGastos.current?.click()}><Upload size={13} /> Importar Excel del banco</Btn>
              <Btn small variant="ghost" onClick={() => exportExcel(rowsFiltradas.map(r => ({ Fecha: r.fecha, Personal: r.personal_nombre, Monto: r.monto, "N° Factura": r.numero_factura, Categoría: r.categoria, OD: r.od, Observaciones: r.observaciones })), "gastos_tarjeta.xlsx")}><Download size={13} /> Excel</Btn>
              <Btn small variant="ghost" onClick={descargarInformeBanco}><Download size={13} /> Informe (formato banco)</Btn>
              {canGestionar && rows.length > 0 && (
                <Btn small variant="danger" onClick={reiniciarGastos}><X size={13} /> Reiniciar (borrar todo)</Btn>
              )}
            </div>
          }
        >
          {diagnostico && (
            <div style={{ background: T.graySoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>
              {diagnostico}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, width: 190 }} value={filtroPersonal} onChange={(e) => setFiltroPersonal(e.target.value)}>
              <option value="">Todo el personal</option>
              {empleados.map((emp) => <option key={emp.codigo} value={emp.nombre}>{emp.nombre}</option>)}
            </select>
            <select style={{ ...inputStyle, width: 180 }} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="Todas">Todas las categorías</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input style={{ ...inputStyle, width: 140 }} value={filtroOd} onChange={(e) => setFiltroOd(e.target.value)} placeholder="Filtrar por OD..." />
            <select style={{ ...inputStyle, width: 150 }} value={filtroMoneda} onChange={(e) => setFiltroMoneda(e.target.value)}>
              <option value="Todas">Colones y Dólares</option>
              <option value="Colones">Solo Colones</option>
              <option value="Dólares">Solo Dólares</option>
            </select>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ padding: "6px 8px" }}>Fecha</th><th>Personal</th><th>Monto</th><th>N° Factura</th><th>Categoría</th><th>OD</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltradas.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "10px 8px", color: T.gray }}>No hay gastos que coincidan con estos filtros.</td></tr>
              ) : rowsFiltradas.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ padding: "8px" }}>
                    {canGestionar ? (
                      <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 130 }} value={r.fecha || ""} onChange={(e) => setCampoGasto(r.id, "fecha", e.target.value)} />
                    ) : r.fecha}
                  </td>
                  <td>
                    {canGestionar ? (
                      <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 160 }} value={r.personal_codigo || ""} onChange={(e) => setPersonalGasto(r.id, e.target.value)}>
                        <option value="">{r.personal_nombre || "Sin asignar"}</option>
                        {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
                      </select>
                    ) : (r.personal_nombre || "Sin asignar")}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {canGestionar ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 11, color: T.gray }}>{r.moneda === "Dólares" ? "$" : "₡"}</span>
                        <input type="number" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 90 }} value={r.monto} onChange={(e) => setCampoGasto(r.id, "monto", Number(e.target.value) || 0)} />
                      </div>
                    ) : (r.moneda === "Dólares" ? "$" : "₡") + Number(r.monto || 0).toLocaleString("en-US")}
                  </td>
                  <td>
                    {canGestionar ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 110 }} value={r.numero_factura || ""} onChange={(e) => setCampoGasto(r.id, "numero_factura", e.target.value)} />
                    ) : (r.numero_factura || "—")}
                  </td>
                  <td>
                    {canGestionar ? (
                      <select style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 150 }} value={r.categoria || ""} onChange={(e) => setCampoGasto(r.id, "categoria", e.target.value)}>
                        {!categorias.includes(r.categoria) && <option value={r.categoria}>{r.categoria}</option>}
                        {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : r.categoria}
                  </td>
                  <td>
                    {canGestionar ? (
                      <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 110 }} value={r.od || ""} onChange={(e) => setCampoGasto(r.id, "od", e.target.value)} />
                    ) : (r.od || "—")}
                  </td>
                  <td>{canGestionar && <Btn small variant="danger" onClick={() => del(r.id)}><X size={12} /></Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {canAdminCategorias && (
          <Card title="Agregar clasificación nueva">
            <div style={{ display: "flex", gap: 8 }}>
              <input style={inputStyle} value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Ej. Combustible" />
              <Btn variant="ghost" onClick={agregarCategoria}><Plus size={14} /></Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

const ALERTA_KM_MANTENIMIENTO = 300;

const ESTATUS_EQUIPO_OPCIONES = ["Abierto", "En importación", "Cerrado", "Completado", "No lleva equipos"];

function EquiposCorrectivos({ irInicial, onIrConsumido }) {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canEditar = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const [areaActiva, setAreaActiva] = useState(irInicial?.area || "inspecciones");
  const [tipoOdActivo, setTipoOdActivo] = useState("Correctivo");
  const [subTab, setSubTab] = useState("pendientes");
  const [odsDelArea, setRows] = useClientesArea(areaActiva);

  const [filtroOd, setFiltroOd] = useState(irInicial?.od || "");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroPo, setFiltroPo] = useState("");
  const [vista, setVista] = useState("tarjetas");

  useEffect(() => {
    if (!irInicial) return;
    setAreaActiva(irInicial.area || "inspecciones");
    setFiltroOd(irInicial.od || "");
    onIrConsumido && onIrConsumido();
    // eslint-disable-next-line
  }, [irInicial]);

  const setCampo = (id, campo, valor) => {
    // Fecha PO se sincroniza con Fecha de Aprobación (OD Correctivos) — son la misma fecha en los dos lados.
    if (campo === "fechaPo") {
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, fechaPo: valor, fechaAprobacion: valor } : r));
      supabase.from("ordenes_trabajo").update(odPatchToDb({ fechaPo: valor, fechaAprobacion: valor })).eq("id", id).then();
      return;
    }
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [campo]: valor } : r));
    supabase.from("ordenes_trabajo").update(odPatchToDb({ [campo]: valor })).eq("id", id).then();
  };
  const borrarOD = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este OD Correctivo? Esta acción no se puede deshacer."))) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    supabase.from("ordenes_trabajo").delete().eq("id", id).then();
  };

  // Las tarjetas son solo para trabajos que sí necesitan solicitud de
  // equipos — si se marca "No lleva equipos", desaparece sola del tablero
  // (pero el OD sigue viéndose normal en Inspecciones/Proyectos).
  const correctivos = odsDelArea.filter((r) => (r.tipoOD || "Normal") === tipoOdActivo && r.estatusEquipo !== "No lleva equipos");
  const pendientes = correctivos.filter((r) => (r.estatusEquipo || "Abierto") !== "Completado");
  const completados = correctivos.filter((r) => r.estatusEquipo === "Completado");
  const listaActiva = subTab === "completados" ? completados : pendientes;

  const listaFiltrada = listaActiva.filter((r) => {
    const matchOd = !filtroOd.trim() || (r.od || "").toLowerCase().includes(filtroOd.trim().toLowerCase());
    const matchCliente = !filtroCliente.trim() || (r.cliente || "").toLowerCase().includes(filtroCliente.trim().toLowerCase());
    const matchPo = !filtroPo.trim() || (r.poNumero || "").toLowerCase().includes(filtroPo.trim().toLowerCase());
    return matchOd && matchCliente && matchPo;
  });

  // Agrupa por cliente usando coincidencia difusa (80% de similitud), para
  // que nombres escritos distinto ("Marina Pez Vela" / "MARINA PEZ VELA S.A.")
  // queden juntos en una sola sección en vez de duplicarse.
  const porCliente = {};
  const clavesCanonicas = [];
  listaFiltrada.forEach((r) => {
    const nombreCliente = r.cliente || "Sin cliente";
    let clave = clavesCanonicas.find((c) => similitudNombres(c, nombreCliente) >= 0.8);
    if (!clave) {
      clave = nombreCliente;
      clavesCanonicas.push(clave);
      porCliente[clave] = [];
    }
    porCliente[clave].push(r);
  });
  const clientesOrdenados = clavesCanonicas.sort();

  // Semáforo por antigüedad de la Fecha PO: 6 semanas = amarillo, 8 = rojo.
  const colorPorFechaPo = (fechaPo) => {
    if (!fechaPo) return { fondo: T.graySoft, borde: T.line };
    const dias = (new Date(todayISO()) - new Date(fechaPo)) / (1000 * 60 * 60 * 24);
    const semanas = dias / 7;
    if (semanas >= 8) return { fondo: T.redSoft, borde: T.red };
    if (semanas >= 6) return { fondo: T.amberSoft, borde: T.amber };
    return { fondo: T.greenSoft, borde: T.green };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant={areaActiva === "inspecciones" ? "accent" : "ghost"} onClick={() => { setAreaActiva("inspecciones"); setTipoOdActivo("Correctivo"); }}>Correctivos Inspecciones</Btn>
        <Btn variant={areaActiva === "proyectos" ? "accent" : "ghost"} onClick={() => setAreaActiva("proyectos")}>Correctivos Proyectos</Btn>
        {areaActiva === "proyectos" && (
          <>
            <div style={{ width: 1, background: T.line, margin: "0 4px" }} />
            <Btn variant={tipoOdActivo === "Normal" ? "accent" : "ghost"} onClick={() => setTipoOdActivo(tipoOdActivo === "Normal" ? "Correctivo" : "Normal")}>OD Proyectos</Btn>
          </>
        )}
        <div style={{ width: 1, background: T.line, margin: "0 4px" }} />
        <Btn variant={subTab === "pendientes" ? "accent" : "ghost"} onClick={() => setSubTab("pendientes")}>Pendientes ({pendientes.length})</Btn>
        <Btn variant={subTab === "completados" ? "accent" : "ghost"} onClick={() => setSubTab("completados")}>Completados ({completados.length})</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, width: 150 }} value={filtroOd} onChange={(e) => setFiltroOd(e.target.value)} placeholder="Filtrar por OD..." />
        <input style={{ ...inputStyle, width: 180 }} value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} placeholder="Filtrar por cliente..." />
        <input style={{ ...inputStyle, width: 150 }} value={filtroPo} onChange={(e) => setFiltroPo(e.target.value)} placeholder="Filtrar por PO..." />
        {(filtroOd || filtroCliente || filtroPo) && (
          <Btn small variant="ghost" onClick={() => { setFiltroOd(""); setFiltroCliente(""); setFiltroPo(""); }}>Limpiar filtros</Btn>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <Btn small variant={vista === "tarjetas" ? "accent" : "ghost"} onClick={() => setVista("tarjetas")}>Tarjetas</Btn>
        <Btn small variant={vista === "compacta" ? "accent" : "ghost"} onClick={() => setVista("compacta")}>Compacta</Btn>
        <Btn small variant={vista === "cuadros" ? "accent" : "ghost"} onClick={() => setVista("cuadros")}>Cuadros</Btn>
        <Btn small variant={vista === "lista" ? "accent" : "ghost"} onClick={() => setVista("lista")}>Lista</Btn>
      </div>

      {subTab === "pendientes" && (
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.inkSoft, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.greenSoft, border: `1px solid ${T.green}` }} /> Al día</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.graySoft, border: `1px solid ${T.line}` }} /> Sin Fecha PO</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.amberSoft, border: `1px solid ${T.amber}` }} /> 6+ semanas desde la Fecha PO</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: T.redSoft, border: `1px solid ${T.red}` }} /> 8+ semanas desde la Fecha PO</span>
        </div>
      )}

      {vista === "lista" ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ padding: "6px 8px" }}>Cliente</th><th>OD</th><th>PO#</th><th>Fecha PO</th><th>SAP#</th><th>Estatus</th><th style={{ minWidth: 160 }}>Equipos</th><th></th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: "10px 8px", color: T.gray }}>No hay OD Correctivos que coincidan.</td></tr>
            ) : [...listaFiltrada].sort((a, b) => (a.cliente || "Sin cliente").localeCompare(b.cliente || "Sin cliente")).map((r) => {
              const { fondo, borde } = subTab === "completados" ? { fondo: T.greenSoft, borde: T.green } : colorPorFechaPo(r.fechaPo);
              return (
              <tr key={r.id} style={{ borderTop: `1px solid ${T.line}`, background: fondo, borderLeft: `3px solid ${borde}` }}>
                <td style={{ padding: "8px" }}>{r.cliente || "Sin cliente"}</td>
                <td style={{ fontWeight: 700 }}>{r.od}</td>
                <td>{canEditar ? <input style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: 100 }} value={r.poNumero || ""} onChange={(e) => setCampo(r.id, "poNumero", e.target.value)} /> : (r.poNumero || "—")}</td>
                <td>{canEditar ? <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: 130 }} value={r.fechaPo || ""} onChange={(e) => setCampo(r.id, "fechaPo", e.target.value)} /> : (r.fechaPo || "—")}</td>
                <td>{canEditar ? <input style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: 100 }} value={r.sapNumero || ""} onChange={(e) => setCampo(r.id, "sapNumero", e.target.value)} /> : (r.sapNumero || "—")}</td>
                <td>
                  {canEditar ? (
                    <select style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: 130 }} value={r.estatusEquipo || "Abierto"} onChange={(e) => setCampo(r.id, "estatusEquipo", e.target.value)}>
                      {ESTATUS_EQUIPO_OPCIONES.map((op) => <option key={op}>{op}</option>)}
                    </select>
                  ) : (r.estatusEquipo || "Abierto")}
                </td>
                <td>{canEditar ? <input style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%" }} value={r.equiposCorrectivo || ""} onChange={(e) => setCampo(r.id, "equiposCorrectivo", e.target.value)} placeholder="Ej. escalera, taladro..." /> : (r.equiposCorrectivo || "—")}</td>
                <td>{canEditar && <Btn small variant="danger" onClick={() => borrarOD(r.id)}><X size={12} /></Btn>}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      ) : vista === "cuadros" ? (
        clientesOrdenados.length === 0 ? (
          <div style={{ color: T.gray, fontSize: 13.5 }}>No hay OD Correctivos {subTab === "completados" ? "completados" : "pendientes"} que coincidan en esta área.</div>
        ) : clientesOrdenados.map((cliente) => (
          <div key={cliente} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 10 }}>{cliente}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 170px))", gap: 10, justifyContent: "start" }}>
              {porCliente[cliente].map((r) => {
                const { fondo, borde } = subTab === "completados" ? { fondo: T.greenSoft, borde: T.green } : colorPorFechaPo(r.fechaPo);
                return (
                  <div key={r.id} style={{ background: fondo, border: `1px solid ${borde}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6, minHeight: 180 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.od}</div>
                      {canEditar && <button onClick={() => borrarOD(r.id)} title="Borrar" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>}
                    </div>
                    <div style={{ fontSize: 11.5 }}>
                      <span style={{ color: T.inkSoft }}>PO#</span>{" "}
                      {canEditar ? <input style={{ ...inputStyle, fontSize: 11.5, padding: "3px 5px", width: "100%" }} value={r.poNumero || ""} onChange={(e) => setCampo(r.id, "poNumero", e.target.value)} /> : (r.poNumero || "—")}
                    </div>
                    <div style={{ fontSize: 11.5 }}>
                      <span style={{ color: T.inkSoft }}>Fecha</span>{" "}
                      {canEditar ? <input type="date" style={{ ...inputStyle, fontSize: 11.5, padding: "3px 5px", width: "100%" }} value={r.fechaPo || ""} onChange={(e) => setCampo(r.id, "fechaPo", e.target.value)} /> : (r.fechaPo || "—")}
                    </div>
                    <div style={{ fontSize: 11.5 }}>
                      <span style={{ color: T.inkSoft }}>SAP#</span>{" "}
                      {canEditar ? <input style={{ ...inputStyle, fontSize: 11.5, padding: "3px 5px", width: "100%" }} value={r.sapNumero || ""} onChange={(e) => setCampo(r.id, "sapNumero", e.target.value)} /> : (r.sapNumero || "—")}
                    </div>
                    <div style={{ fontSize: 11.5, display: "flex", flexDirection: "column", flex: 1 }}>
                      <span style={{ color: T.inkSoft, marginBottom: 2 }}>Equipos</span>
                      {canEditar ? (
                        <textarea style={{ ...inputStyle, fontSize: 11.5, padding: "4px 6px", width: "100%", flex: 1, minHeight: 44, resize: "vertical" }} value={r.equiposCorrectivo || ""} onChange={(e) => setCampo(r.id, "equiposCorrectivo", e.target.value)} placeholder="Ej. escalera, taladro..." />
                      ) : (r.equiposCorrectivo || "—")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      ) : clientesOrdenados.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 13.5 }}>No hay OD Correctivos {subTab === "completados" ? "completados" : "pendientes"} que coincidan en esta área.</div>
      ) : clientesOrdenados.map((cliente) => (
        <div key={cliente}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 10 }}>{cliente}</div>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: vista === "compacta" ? 10 : 12 }}>
            {porCliente[cliente].map((r) => {
              const { fondo, borde } = subTab === "completados" ? { fondo: T.greenSoft, borde: T.green } : colorPorFechaPo(r.fechaPo);
              return (
                <div key={r.id} style={{ background: fondo, border: `1px solid ${borde}`, borderRadius: 12, padding: vista === "compacta" ? 10 : "14px 16px", display: "flex", flexDirection: "column", gap: vista === "compacta" ? 6 : 10, flex: "1 1 0", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.od}</div>
                    {canEditar && <button onClick={() => borrarOD(r.id)} title="Borrar" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: vista === "compacta" ? "1fr" : "1fr 1fr", gap: "6px 12px", fontSize: 12 }}>
                    {vista === "compacta" && <div style={{ color: T.inkSoft }}>PO#</div>}
                    {vista !== "compacta" && <div style={{ color: T.inkSoft, alignSelf: "center" }}>PO#</div>}
                    <div>
                      {canEditar ? (
                        <input style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%" }} value={r.poNumero || ""} onChange={(e) => setCampo(r.id, "poNumero", e.target.value)} />
                      ) : (r.poNumero || "—")}
                    </div>
                    {vista === "compacta" && <div style={{ color: T.inkSoft }}>Fecha PO</div>}
                    {vista !== "compacta" && <div style={{ color: T.inkSoft, alignSelf: "center" }}>Fecha PO</div>}
                    <div>
                      {canEditar ? (
                        <input type="date" style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%" }} value={r.fechaPo || ""} onChange={(e) => setCampo(r.id, "fechaPo", e.target.value)} />
                      ) : (r.fechaPo || "—")}
                    </div>
                    {vista === "compacta" && <div style={{ color: T.inkSoft }}>SAP#</div>}
                    {vista !== "compacta" && <div style={{ color: T.inkSoft, alignSelf: "center" }}>SAP#</div>}
                    <div>
                      {canEditar ? (
                        <input style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%" }} value={r.sapNumero || ""} onChange={(e) => setCampo(r.id, "sapNumero", e.target.value)} />
                      ) : (r.sapNumero || "—")}
                    </div>
                    {vista === "compacta" && <div style={{ color: T.inkSoft }}>Estatus</div>}
                    {vista !== "compacta" && <div style={{ color: T.inkSoft, alignSelf: "center" }}>Estatus</div>}
                    <div>
                      {canEditar ? (
                        <select style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%" }} value={r.estatusEquipo || "Abierto"} onChange={(e) => setCampo(r.id, "estatusEquipo", e.target.value)}>
                          {ESTATUS_EQUIPO_OPCIONES.map((op) => <option key={op}>{op}</option>)}
                        </select>
                      ) : (r.estatusEquipo || "Abierto")}
                    </div>
                    <div style={{ color: T.inkSoft }}>Equipos</div>
                    <div style={{ gridColumn: vista === "compacta" ? "1 / 2" : "2 / 3" }}>
                      {canEditar ? (
                        <textarea style={{ ...inputStyle, fontSize: 12, padding: "4px 6px", width: "100%", minHeight: 40, resize: "vertical" }} value={r.equiposCorrectivo || ""} onChange={(e) => setCampo(r.id, "equiposCorrectivo", e.target.value)} placeholder="Ej. escalera, taladro..." />
                      ) : (r.equiposCorrectivo || "—")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Vehiculos() {
  const currentUser = useContext(CurrentUserContext);
  const isAdmin = currentUser?.categoria === "admin";
  const canGestionar = isAdmin || currentUser?.categoria === "asistente";
  const confirmar = useContext(ConfirmContext);
  const [areaActiva, setAreaActiva] = useState("inspecciones");
  const [subTab, setSubTab] = useState("flota");
  const [vehiculos, setVehiculos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [formVehiculo, setFormVehiculo] = useState({ placa: "", descripcion: "", kilometrajeActual: "", kilometrajeMantenimiento: "" });
  const [formRegistro, setFormRegistro] = useState({ vehiculoId: "", personalCodigo: "", fecha: todayISO(), kilometraje: "" });

  const [filtroVehiculo, setFiltroVehiculo] = useState("");
  const [filtroPersonalKm, setFiltroPersonalKm] = useState("");
  const [filtroMes, setFiltroMes] = useState("");

  useEffect(() => {
    const cargar = () => {
      (async () => {
        const { data } = await supabase.from("vehiculos").select("*").order("placa", { ascending: true });
        if (data) setVehiculos(data);
      })();
      (async () => {
        const { data } = await supabase.from("vehiculos_kilometraje").select("*").order("fecha", { ascending: false });
        if (data) setRegistros(data);
      })();
      (async () => {
        const { data } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
        if (data) setEmpleados(data);
      })();
    };
    cargar();
    const intervalo = setInterval(cargar, 20000);
    return () => clearInterval(intervalo);
  }, []);

  const agregarVehiculo = async () => {
    if (!formVehiculo.placa) return;
    const payload = {
      placa: formVehiculo.placa, descripcion: formVehiculo.descripcion || null,
      kilometraje_actual: Number(formVehiculo.kilometrajeActual) || 0,
      kilometraje_mantenimiento: Number(formVehiculo.kilometrajeMantenimiento) || 0,
      activo: true, area: areaActiva,
    };
    setFormVehiculo({ placa: "", descripcion: "", kilometrajeActual: "", kilometrajeMantenimiento: "" });
    const { data, error } = await supabase.from("vehiculos").insert(payload).select().single();
    if (!error && data) setVehiculos((prev) => [...prev, data].sort((a, b) => a.placa.localeCompare(b.placa)));
  };
  const editarVehiculoCampo = (id, campo, valor) => {
    setVehiculos((prev) => prev.map((v) => v.id === id ? { ...v, [campo]: valor } : v));
    supabase.from("vehiculos").update({ [campo]: valor }).eq("id", id).then();
  };
  const borrarVehiculo = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este vehículo? Esta acción no se puede deshacer."))) return;
    setVehiculos((prev) => prev.filter((v) => v.id !== id));
    supabase.from("vehiculos").delete().eq("id", id).then();
  };

  const agregarRegistro = async () => {
    const vehiculo = vehiculos.find((v) => v.id === formRegistro.vehiculoId);
    const empleado = empleados.find((e) => e.codigo === formRegistro.personalCodigo);
    if (!vehiculo || !empleado || !formRegistro.kilometraje) return;
    const km = Number(formRegistro.kilometraje) || 0;
    const payload = {
      vehiculo_id: vehiculo.id, placa: vehiculo.placa,
      personal_codigo: empleado.codigo, personal_nombre: empleado.nombre,
      fecha: formRegistro.fecha || todayISO(), kilometraje: km, estado: "Activo",
    };
    setFormRegistro({ vehiculoId: formRegistro.vehiculoId, personalCodigo: formRegistro.personalCodigo, fecha: todayISO(), kilometraje: "" });
    const { data, error } = await supabase.from("vehiculos_kilometraje").insert(payload).select().single();
    if (!error && data) {
      setRegistros((prev) => [data, ...prev]);
      // Si este kilometraje es mayor al actual del vehículo, actualiza el vehículo también.
      if (km > (vehiculo.kilometraje_actual || 0)) {
        editarVehiculoCampo(vehiculo.id, "kilometraje_actual", km);
      }
    }
  };
  const borrarRegistro = async (id) => {
    if (!(await confirmar("¿Está seguro que desea eliminar este registro de kilometraje? Esta acción no se puede deshacer."))) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    supabase.from("vehiculos_kilometraje").delete().eq("id", id).then();
  };
  const cerrarRegistro = (id) => {
    setRegistros((prev) => prev.map((r) => r.id === id ? { ...r, estado: "Cerrado" } : r));
    supabase.from("vehiculos_kilometraje").update({ estado: "Cerrado" }).eq("id", id).then();
  };
  const reabrirRegistro = (id) => {
    setRegistros((prev) => prev.map((r) => r.id === id ? { ...r, estado: "Activo" } : r));
    supabase.from("vehiculos_kilometraje").update({ estado: "Activo" }).eq("id", id).then();
  };

  const vehiculosDelArea = vehiculos.filter((v) => (v.area || "inspecciones") === areaActiva);
  const placasDelArea = vehiculosDelArea.map((v) => v.placa);
  const registrosDelArea = registros.filter((r) => placasDelArea.includes(r.placa));
  const registrosActivos = registrosDelArea.filter((r) => r.estado !== "Cerrado");
  const registrosCerrados = registrosDelArea.filter((r) => r.estado === "Cerrado");
  const registrosMostrados = (subTab === "cerrados" ? registrosCerrados : registrosActivos).filter((r) => {
    const matchVehiculo = !filtroVehiculo || r.placa === filtroVehiculo;
    const matchPersonal = !filtroPersonalKm || r.personal_nombre === filtroPersonalKm;
    const matchMes = !filtroMes || (r.fecha || "").startsWith(filtroMes);
    return matchVehiculo && matchPersonal && matchMes;
  });

  const alertas = vehiculosDelArea.filter((v) => {
    const restante = (v.kilometraje_mantenimiento || 0) - (v.kilometraje_actual || 0);
    return v.kilometraje_mantenimiento > 0 && restante <= ALERTA_KM_MANTENIMIENTO;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant={areaActiva === "inspecciones" ? "accent" : "ghost"} onClick={() => { setAreaActiva("inspecciones"); setFiltroVehiculo(""); }}>Inspecciones</Btn>
        <Btn variant={areaActiva === "proyectos" ? "accent" : "ghost"} onClick={() => { setAreaActiva("proyectos"); setFiltroVehiculo(""); }}>Proyectos</Btn>
      </div>

      {alertas.length > 0 && (
        <Card style={{ background: T.redSoft, border: `1px solid ${T.red}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.red, fontWeight: 700, fontSize: 13.5 }}>
            <AlertCircle size={18} />
            {alertas.length} vehículo{alertas.length > 1 ? "s" : ""} a menos de {ALERTA_KM_MANTENIMIENTO} km de su mantenimiento: {alertas.map((v) => v.placa).join(", ")}
          </div>
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn variant={subTab === "flota" ? "accent" : "ghost"} small onClick={() => setSubTab("flota")}>Flota</Btn>
        <Btn variant={subTab === "registro" ? "accent" : "ghost"} small onClick={() => setSubTab("registro")}>Registro diario ({registrosActivos.length})</Btn>
        <Btn variant={subTab === "cerrados" ? "accent" : "ghost"} small onClick={() => setSubTab("cerrados")}>Cerrados ({registrosCerrados.length})</Btn>
      </div>

      {subTab === "flota" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <Card title="Flota de vehículos">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <th style={{ padding: "6px 8px" }}>Placa</th><th>Descripción</th><th>Km actual</th><th>Km mantenimiento</th><th>Restante</th><th></th>
                </tr>
              </thead>
              <tbody>
                {vehiculosDelArea.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "10px 8px", color: T.gray }}>Todavía no hay vehículos cargados.</td></tr>
                ) : vehiculosDelArea.map((v) => {
                  const restante = (v.kilometraje_mantenimiento || 0) - (v.kilometraje_actual || 0);
                  const enAlerta = v.kilometraje_mantenimiento > 0 && restante <= ALERTA_KM_MANTENIMIENTO;
                  return (
                    <tr key={v.id} style={{ borderTop: `1px solid ${T.line}`, background: enAlerta ? T.redSoft : "transparent" }}>
                      <td style={{ padding: "8px", fontWeight: 700 }}>{v.placa}</td>
                      <td>
                        {canGestionar ? (
                          <input style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 160 }} value={v.descripcion || ""} onChange={(e) => editarVehiculoCampo(v.id, "descripcion", e.target.value)} />
                        ) : (v.descripcion || "—")}
                      </td>
                      <td>
                        {canGestionar ? (
                          <input type="number" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={v.kilometraje_actual || 0} onChange={(e) => editarVehiculoCampo(v.id, "kilometraje_actual", Number(e.target.value) || 0)} />
                        ) : (v.kilometraje_actual || 0)}
                      </td>
                      <td>
                        {canGestionar ? (
                          <input type="number" style={{ ...inputStyle, fontSize: 12, padding: "5px 8px", width: 100 }} value={v.kilometraje_mantenimiento || 0} onChange={(e) => editarVehiculoCampo(v.id, "kilometraje_mantenimiento", Number(e.target.value) || 0)} />
                        ) : (v.kilometraje_mantenimiento || 0)}
                      </td>
                      <td style={{ color: enAlerta ? T.red : T.inkSoft, fontWeight: enAlerta ? 700 : 400 }}>
                        {v.kilometraje_mantenimiento > 0 ? restante : "—"}
                      </td>
                      <td>{canGestionar && <Btn small variant="danger" onClick={() => borrarVehiculo(v.id)}><X size={12} /></Btn>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {canGestionar && (
            <Card title="Agregar vehículo">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Placa"><input style={inputStyle} value={formVehiculo.placa} onChange={(e) => setFormVehiculo({ ...formVehiculo, placa: e.target.value })} placeholder="ABC-123" /></Field>
                <Field label="Descripción"><input style={inputStyle} value={formVehiculo.descripcion} onChange={(e) => setFormVehiculo({ ...formVehiculo, descripcion: e.target.value })} placeholder="Toyota Hilux 2022" /></Field>
                <Field label="Kilometraje actual"><input style={inputStyle} type="number" value={formVehiculo.kilometrajeActual} onChange={(e) => setFormVehiculo({ ...formVehiculo, kilometrajeActual: e.target.value })} placeholder="45000" /></Field>
                <Field label="Kilometraje de mantenimiento"><input style={inputStyle} type="number" value={formVehiculo.kilometrajeMantenimiento} onChange={(e) => setFormVehiculo({ ...formVehiculo, kilometrajeMantenimiento: e.target.value })} placeholder="50000" /></Field>
                <Btn variant="accent" onClick={agregarVehiculo} style={{ justifyContent: "center" }}><Plus size={14} /> Agregar vehículo</Btn>
              </div>
            </Card>
          )}
        </div>
      )}

      {(subTab === "registro" || subTab === "cerrados") && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <Card
            title={subTab === "cerrados" ? "Kilometrajes cerrados" : "Registro diario de kilometraje"}
            action={<Btn small variant="ghost" onClick={() => exportExcel(registrosMostrados.map(r => ({ Fecha: r.fecha, Placa: r.placa, Personal: r.personal_nombre, Kilometraje: r.kilometraje, Estado: r.estado })), "kilometraje.xlsx")}><Download size={13} /> Excel</Btn>}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <select style={{ ...inputStyle, width: 160 }} value={filtroVehiculo} onChange={(e) => setFiltroVehiculo(e.target.value)}>
                <option value="">Todos los vehículos</option>
                {vehiculosDelArea.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
              </select>
              <select style={{ ...inputStyle, width: 190 }} value={filtroPersonalKm} onChange={(e) => setFiltroPersonalKm(e.target.value)}>
                <option value="">Todo el personal</option>
                {empleados.map((emp) => <option key={emp.codigo} value={emp.nombre}>{emp.nombre}</option>)}
              </select>
              <input style={{ ...inputStyle, width: 150 }} type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
              {(filtroVehiculo || filtroPersonalKm || filtroMes) && (
                <Btn small variant="ghost" onClick={() => { setFiltroVehiculo(""); setFiltroPersonalKm(""); setFiltroMes(""); }}>Limpiar filtros</Btn>
              )}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: T.inkSoft, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <th style={{ padding: "6px 8px" }}>Fecha</th><th>Placa</th><th>Personal</th><th>Kilometraje</th><th></th><th></th>
                </tr>
              </thead>
              <tbody>
                {registrosMostrados.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "10px 8px", color: T.gray }}>No hay registros que coincidan.</td></tr>
                ) : registrosMostrados.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                    <td style={{ padding: "8px" }}>{r.fecha}</td>
                    <td>{r.placa}</td>
                    <td>{r.personal_nombre}</td>
                    <td style={{ fontWeight: 700 }}>{r.kilometraje}</td>
                    <td>
                      {canGestionar && (subTab === "cerrados"
                        ? <Btn small variant="ghost" onClick={() => reabrirRegistro(r.id)}>Reabrir</Btn>
                        : <Btn small variant="ghost" onClick={() => cerrarRegistro(r.id)}>Cerrar</Btn>
                      )}
                    </td>
                    <td>{canGestionar && <Btn small variant="danger" onClick={() => borrarRegistro(r.id)}><X size={12} /></Btn>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Cargar kilometraje de hoy">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label="Vehículo">
                <select style={inputStyle} value={formRegistro.vehiculoId} onChange={(e) => setFormRegistro({ ...formRegistro, vehiculoId: e.target.value })}>
                  <option value="">Selecciona un vehículo…</option>
                  {vehiculosDelArea.map((v) => <option key={v.id} value={v.id}>{v.placa} — {v.descripcion}</option>)}
                </select>
              </Field>
              <Field label="Persona">
                <select style={inputStyle} value={formRegistro.personalCodigo} onChange={(e) => setFormRegistro({ ...formRegistro, personalCodigo: e.target.value })}>
                  <option value="">Selecciona una persona…</option>
                  {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
                </select>
              </Field>
              <Field label="Fecha"><input style={inputStyle} type="date" value={formRegistro.fecha} onChange={(e) => setFormRegistro({ ...formRegistro, fecha: e.target.value })} /></Field>
              <Field label="Kilometraje"><input style={inputStyle} type="number" value={formRegistro.kilometraje} onChange={(e) => setFormRegistro({ ...formRegistro, kilometraje: e.target.value })} placeholder="45230" /></Field>
              <Btn variant="accent" onClick={agregarRegistro} style={{ justifyContent: "center" }}><Plus size={14} /> Registrar kilometraje</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// ÁREA: ENTRENAMIENTO — módulos de práctica tipo juego, con
// puntaje por segmento que se suma a un total, por empleado
// (tomado de Planilla). Se va llenando con más segmentos:
// compuertas lógicas, tablas de verdad, lógica en escalera,
// ecuaciones de símplex, notifier.
// ---------------------------------------------------------
const SEGMENTOS_ENTRENAMIENTO = [
  { id: "compuertas", label: "Compuertas lógicas", Icono: Zap, colorDesde: "#ff922b", colorHasta: "#e8590c", lema: "Arma el circuito antes de que suene la alarma" },
  { id: "tablas_verdad", label: "Tablas de la verdad", Icono: Target, colorDesde: "#4dabf7", colorHasta: "#1971c2", lema: "Acierta cada combinación posible" },
  { id: "escalera", label: "Lógica en escalera", Icono: HardHat, colorDesde: "#da77f2", colorHasta: "#9c36b5", lema: "Cablea el riel como un técnico experto" },
  { id: "simplex", label: "Ecuaciones de símplex", Icono: Rocket, colorDesde: "#38d9a9", colorHasta: "#0ca678", lema: "Programa la lógica del panel" },
  { id: "notifier", label: "Ecuaciones Notifier", Icono: AlertCircle, colorDesde: "#f783ac", colorHasta: "#c2255c", lema: "Domina las ecuaciones del panel Notifier" },
  { id: "nfpa72", label: "NFPA 72", Icono: ShieldCheck, colorDesde: "#ff6b6b", colorHasta: "#c92a2a", lema: "Certifícate en la norma que salva vidas" },
  { id: "electronica", label: "Electrónica Básica", Icono: Sparkles, colorDesde: "#ffd43b", colorHasta: "#f08c00", lema: "Domina los fundamentos eléctricos" },
];

// Rangos de Entrenamiento: cada nivel se representa con un componente
// real de un sistema de alarma contra incendio, en orden de complejidad
// creciente — desde una estación manual hasta el panel completo.
const RANGOS_ENTRENAMIENTO = [
  { nombre: "Aprendiz", min: 0, siguiente: 40, color: T.gray, soft: T.graySoft, tipo: null, mensaje: "" },
  { nombre: "Estación Manual", min: 40, siguiente: 90, color: T.blue, soft: T.blueSoft, tipo: "estacion_manual", mensaje: "Diste el primer paso de verdad. Así como una estación manual, ahora eres parte activa del sistema." },
  { nombre: "Detector de Humo", min: 90, siguiente: 160, color: T.turquoise, soft: T.turquoiseSoft, tipo: "detector_humo", mensaje: "Tu ojo para los detalles está mejorando. Sigue detectando cada respuesta correcta." },
  { nombre: "Sensor de Flama", min: 160, siguiente: 240, color: T.amber, soft: T.amberSoft, tipo: "sensor_flama", mensaje: "¡Vas encendido! Tu conocimiento técnico ya responde tan rápido como un sensor de flama." },
  { nombre: "Módulo Monitor", min: 240, siguiente: 330, color: T.steel, soft: T.steelSoft, tipo: "modulo_monitor", mensaje: "Ya supervisas el sistema completo. Tu nivel técnico está a la altura de un módulo monitor." },
  { nombre: "Módulo Relé", min: 330, siguiente: 430, color: T.accent, soft: T.accentSoft, tipo: "modulo_rele", mensaje: "Estás a un paso del máximo nivel. Como un relé, ya conectas todo el conocimiento con precisión. Para dar el salto final a Senior necesitas 100% en todos los módulos con contenido." },
  { nombre: "Panel — Senior Experto Certificado", min: 430, siguiente: null, color: T.green, soft: T.greenSoft, tipo: "panel", mensaje: "¡Llegaste al panel! Eres el cerebro del sistema — dominas al 100% todos los módulos de Entrenamiento." },
];
function rangoDeEntrenamiento(pts) {
  let actual = RANGOS_ENTRENAMIENTO[0];
  for (const r of RANGOS_ENTRENAMIENTO) { if (pts >= r.min) actual = r; }
  return actual;
}

// Puntaje máximo posible por segmento (cantidad de ejercicios/preguntas ×
// 10 puntos cada uno). Los segmentos en 0 todavía no tienen contenido y no
// bloquean el rango Senior mientras sigan vacíos.
const MAX_PUNTOS_SEGMENTO = {
  compuertas: 160, tablas_verdad: 120, escalera: 50, simplex: 80, notifier: 0, nfpa72: 200, electronica: 190,
};

// El rango Senior (el más alto) SOLO se otorga si el usuario tiene 100% en
// TODOS los módulos que ya tienen contenido — sin importar el puntaje
// acumulado. Si no cumple ese requisito, se tope en el penúltimo rango.
function calcularRangoUsuario(puntosTotal, puntosPorSegmento) {
  const rango = rangoDeEntrenamiento(puntosTotal);
  if (rango.tipo !== "panel") return rango;
  const segmentosConContenido = SEGMENTOS_ENTRENAMIENTO.filter((s) => (MAX_PUNTOS_SEGMENTO[s.id] || 0) > 0);
  const cumpleSenior = segmentosConContenido.length > 0 && segmentosConContenido.every((s) => (puntosPorSegmento[s.id] || 0) >= MAX_PUNTOS_SEGMENTO[s.id]);
  if (cumpleSenior) return rango;
  return RANGOS_ENTRENAMIENTO[RANGOS_ENTRENAMIENTO.length - 2]; // Módulo Relé
}

// Cuenta cuántas de las 17 insignias tiene ganadas una persona, dado su
// puntaje total, su puntaje por segmento, y su cantidad de repasos —
// misma lista de criterios que las insignias que se muestran en
// Entrenamiento, para poder mostrar el conteo también en el ranking.
function contarInsigniasGanadas(puntosTotal, porSegmento, repasos) {
  const segmentosConContenido = SEGMENTOS_ENTRENAMIENTO.filter((s) => (MAX_PUNTOS_SEGMENTO[s.id] || 0) > 0);
  const modulosConPuntos = SEGMENTOS_ENTRENAMIENTO.filter((s) => (porSegmento[s.id] || 0) > 0).length;
  const modulosAl100 = segmentosConContenido.filter((s) => (porSegmento[s.id] || 0) >= MAX_PUNTOS_SEGMENTO[s.id]).length;
  const rango = calcularRangoUsuario(puntosTotal, porSegmento);
  let n = 0;
  if (puntosTotal > 0) n++;
  if (puntosTotal >= 100) n++;
  if (puntosTotal >= 300) n++;
  if (puntosTotal >= 500) n++;
  if (puntosTotal >= 800) n++;
  if (repasos >= 1) n++;
  if (repasos >= 5) n++;
  if (repasos >= 15) n++;
  if (repasos >= 30) n++;
  if (modulosConPuntos >= 3) n++;
  if (modulosConPuntos >= SEGMENTOS_ENTRENAMIENTO.length) n++;
  if (segmentosConContenido.length > 0 && modulosAl100 === segmentosConContenido.length) n++;
  if ((porSegmento.nfpa72 || 0) >= 200) n++;
  if ((porSegmento.electronica || 0) >= (MAX_PUNTOS_SEGMENTO.electronica || Infinity)) n++;
  if ((porSegmento.compuertas || 0) >= (MAX_PUNTOS_SEGMENTO.compuertas || Infinity)) n++;
  if ((porSegmento.escalera || 0) >= (MAX_PUNTOS_SEGMENTO.escalera || Infinity)) n++;
  if (rango.tipo === "panel") n++;
  return n;
}

// Calcula la racha diaria: días consecutivos con al menos una actividad
// registrada, contando hacia atrás desde hoy (o desde ayer, si hoy
// todavía no ha jugado — para no "romper" la racha a media noche).
// Traduce un porcentaje de examen a un rango de resultado, para que la
// retroalimentación se sienta más como un veredicto que como un número.
function rangoResultadoExamen(porcentaje) {
  if (porcentaje >= 90) return { texto: "🌟 EXCELENTE", color: "#2f9e44" };
  if (porcentaje >= 80) return { texto: "👏 MUY BIEN", color: "#2b8a3e" };
  if (porcentaje >= 70) return { texto: "✓ APROBADO", color: "#1971c2" };
  return { texto: "📖 DEBES REPASAR", color: "#e03131" };
}

function calcularRacha(puntajes) {
  const fechas = [...new Set(puntajes.map((p) => p.fecha))].filter(Boolean).sort();
  if (fechas.length === 0) return 0;
  const msDia = 86400000;
  const hoy = todayISO();
  const ultima = fechas[fechas.length - 1];
  const diffHastaHoy = Math.round((new Date(hoy) - new Date(ultima)) / msDia);
  if (diffHastaHoy > 1) return 0;
  let racha = 1;
  for (let i = fechas.length - 1; i > 0; i--) {
    const diff = Math.round((new Date(fechas[i]) - new Date(fechas[i - 1])) / msDia);
    if (diff === 1) racha++;
    else if (diff === 0) continue;
    else break;
  }
  return racha;
}

// Misiones diarias: 3 retos simples calculados a partir de lo que la
// persona ya hizo HOY (sin necesidad de guardar nada nuevo en la base de
// datos) — dan una razón para volver a entrar cada día.
function calcularMisionesDiarias(puntajes) {
  const hoy = todayISO();
  const deHoy = puntajes.filter((p) => p.fecha === hoy);
  const aciertosHoy = deHoy.filter((p) => p.puntos > 0).length;
  const puntosHoy = deHoy.reduce((s, p) => s + p.puntos, 0);
  const modulosHoy = new Set(deHoy.map((p) => p.segmento)).size;
  return [
    { id: "m1", texto: "Acierta 3 ejercicios hoy", meta: 3, progreso: aciertosHoy, cumplida: aciertosHoy >= 3, Icono: Target },
    { id: "m2", texto: "Gana 50 puntos hoy", meta: 50, progreso: puntosHoy, cumplida: puntosHoy >= 50, Icono: Zap },
    { id: "m3", texto: "Practica en 2 módulos distintos hoy", meta: 2, progreso: modulosHoy, cumplida: modulosHoy >= 2, Icono: Rocket },
  ];
}

// Ráfaga breve de confeti con CSS puro (sin librerías) — se usa al subir
// de rango o al completar una misión importante.
function Confeti() {
  const piezas = React.useMemo(() => Array.from({ length: 36 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duracion: 1.6 + Math.random() * 1,
    color: ["#ff922b", "#ffd43b", "#51cf66", "#4dabf7", "#f783ac", "#845ef7"][i % 6],
    rotacion: Math.random() * 360,
  })), []);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style>{`@keyframes caerConfeti { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(160px) rotate(360deg); opacity: 0; } }`}</style>
      {piezas.map((p) => (
        <div key={p.id} style={{
          position: "absolute", top: 0, left: `${p.left}%`, width: 7, height: 10, background: p.color,
          animation: `caerConfeti ${p.duracion}s ease-in ${p.delay}s forwards`, transform: `rotate(${p.rotacion}deg)`,
        }} />
      ))}
    </div>
  );
}

function Entrenamiento() {
  const currentUser = useContext(CurrentUserContext);
  const esTecnico = currentUser?.categoria === "tecnico";
  const [empleados, setEmpleados] = useState([]);
  const [jugadorCodigo, setJugadorCodigo] = useState("");
  const [puntajes, setPuntajes] = useState([]);
  const [modulo, setModulo] = useState(null);
  const [mostrarRanking, setMostrarRanking] = useState(false);
  const [subioDeRango, setSubioDeRango] = useState(null);
  const rangoAnteriorRef = React.useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("empleados").select("*").eq("activo", true).order("nombre", { ascending: true });
      if (data) setEmpleados(data);
    })();
  }, []);

  // Un usuario Técnico queda bloqueado a su propio perfil (encontrado por
  // coincidencia de nombre contra Planilla) — no puede elegir a nadie más.
  useEffect(() => {
    if (!esTecnico || empleados.length === 0 || jugadorCodigo) return;
    let mejor = null, mejorScore = 0;
    empleados.forEach((emp) => {
      const score = similitudNombres(emp.nombre, currentUser?.name || "");
      if (score > mejorScore) { mejorScore = score; mejor = emp; }
    });
    if (mejor && mejorScore >= 0.35) setJugadorCodigo(mejor.codigo);
  }, [esTecnico, empleados, currentUser]);

  const jugador = empleados.find((e) => e.codigo === jugadorCodigo);

  const cargarPuntajes = async (codigo) => {
    const { data } = await supabase.from("entrenamiento_puntajes").select("*").eq("personal_codigo", codigo);
    if (data) setPuntajes(data);
  };

  useEffect(() => {
    if (jugadorCodigo) cargarPuntajes(jugadorCodigo);
    else setPuntajes([]);
  }, [jugadorCodigo]);

  const registrarPuntos = async (segmento, ejercicio, puntos) => {
    if (!jugador) return;
    const payload = { personal_codigo: jugador.codigo, personal_nombre: jugador.nombre, segmento, ejercicio, puntos, fecha: todayISO() };
    const { data } = await supabase.from("entrenamiento_puntajes").insert(payload).select().single();
    if (data) setPuntajes((prev) => [...prev, data]);
  };

  // Solo Admin puede reiniciar un módulo bloqueado. Si además decide
  // borrar el ranking, se eliminan de Supabase los puntos ya ganados por
  // este técnico en ese segmento (para que pueda ganarlos de nuevo).
  const reiniciarSegmento = async (segmentoId, borrarRanking) => {
    if (!jugador) return;
    if (borrarRanking) {
      await supabase.from("entrenamiento_puntajes").delete().eq("personal_codigo", jugador.codigo).eq("segmento", segmentoId);
      setPuntajes((prev) => prev.filter((p) => !(p.personal_codigo === jugador.codigo && p.segmento === segmentoId)));
    }
  };

  const puntosDeSegmento = (segId) => puntajes.filter((p) => p.segmento === segId).reduce((s, p) => s + p.puntos, 0);
  const puntosTotal = puntajes.reduce((s, p) => s + p.puntos, 0);
  const puntosPorSegmento = {};
  SEGMENTOS_ENTRENAMIENTO.forEach((s) => { puntosPorSegmento[s.id] = puntosDeSegmento(s.id); });

  const rangoActual = calcularRangoUsuario(puntosTotal, puntosPorSegmento);
  const racha = calcularRacha(puntajes);
  const misionesDiarias = calcularMisionesDiarias(puntajes);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [vistaModo, setVistaModo] = useState("auto"); // "auto" | "movil" | "pc"
  const [pantallaMovil, setPantallaMovil] = useState("inicio"); // "inicio" | "modulos" | "ranking" | "perfil"

  // Detecta cuando el rango sube, para mostrar una celebración — se queda
  // visible hasta que la persona le dé clic a la X, así da tiempo de leerla.
  useEffect(() => {
    if (rangoAnteriorRef.current !== null && rangoActual.min > rangoAnteriorRef.current) {
      setSubioDeRango(rangoActual);
    }
    rangoAnteriorRef.current = rangoActual.min;
  }, [rangoActual.min]);

  // Insignia por segmento: se muestra el mismo ícono del dispositivo que
  // corresponda al puntaje de ese segmento, para ver de un vistazo en
  // cuál módulo va más avanzado.
  const rangoDeSegmento = (segId) => rangoDeEntrenamiento(puntosDeSegmento(segId));

  const repasos = puntajes.filter((p) => p.ejercicio && p.ejercicio.includes("(repaso)")).length;
  const modulosConPuntos = SEGMENTOS_ENTRENAMIENTO.filter((s) => puntosDeSegmento(s.id) > 0).length;
  const modulosConContenido = SEGMENTOS_ENTRENAMIENTO.filter((s) => (MAX_PUNTOS_SEGMENTO[s.id] || 0) > 0);
  const modulosAl100 = modulosConContenido.filter((s) => puntosDeSegmento(s.id) >= MAX_PUNTOS_SEGMENTO[s.id]).length;

  const LOGROS = [
    { id: "primer_punto", nombre: "Primer Paso", desc: "Gana tus primeros puntos", Icono: Star, colorDesde: "#ffd43b", colorHasta: "#f59f00", cumplido: puntosTotal > 0 },
    { id: "cien_puntos", nombre: "Centurión", desc: "Alcanza 100 puntos en total", Icono: Medal, colorDesde: "#74c0fc", colorHasta: "#1c7ed6", cumplido: puntosTotal >= 100, progresoTexto: `${Math.min(puntosTotal, 100)}/100 pts`, progresoPct: (puntosTotal / 100) * 100 },
    { id: "trescientos_puntos", nombre: "Medio Millar", desc: "Alcanza 300 puntos en total", Icono: Trophy, colorDesde: "#b197fc", colorHasta: "#7048e8", cumplido: puntosTotal >= 300, progresoTexto: `${Math.min(puntosTotal, 300)}/300 pts`, progresoPct: (puntosTotal / 300) * 100 },
    { id: "quinientos_puntos", nombre: "Élite Técnica", desc: "Alcanza 500 puntos en total", Icono: Crown, colorDesde: "#ff8787", colorHasta: "#e03131", cumplido: puntosTotal >= 500, progresoTexto: `${Math.min(puntosTotal, 500)}/500 pts`, progresoPct: (puntosTotal / 500) * 100 },
    { id: "ochocientos_puntos", nombre: "Leyenda A&D", desc: "Alcanza 800 puntos en total", Icono: Gem, colorDesde: "#63e6be", colorHasta: "#0ca678", cumplido: puntosTotal >= 800, progresoTexto: `${Math.min(puntosTotal, 800)}/800 pts`, progresoPct: (puntosTotal / 800) * 100 },
    { id: "perseverancia_bronce", nombre: "Constancia I", desc: "Repite 1 ejercicio ya acertado", Icono: Repeat, colorDesde: "#e8b895", colorHasta: "#a9682f", cumplido: repasos >= 1, progresoTexto: `${Math.min(repasos, 1)}/1 repaso`, progresoPct: (repasos / 1) * 100 },
    { id: "perseverancia_plata", nombre: "Constancia II", desc: "Repite 5 ejercicios ya acertados", Icono: Repeat, colorDesde: "#dee2e6", colorHasta: "#868e96", cumplido: repasos >= 5, progresoTexto: `${Math.min(repasos, 5)}/5 repasos`, progresoPct: (repasos / 5) * 100 },
    { id: "perseverancia_oro", nombre: "Constancia III", desc: "Repite 15 ejercicios ya acertados", Icono: Repeat, colorDesde: "#ffe066", colorHasta: "#f59f00", cumplido: repasos >= 15, progresoTexto: `${Math.min(repasos, 15)}/15 repasos`, progresoPct: (repasos / 15) * 100 },
    { id: "perseverancia_diamante", nombre: "Constancia IV", desc: "Repite 30 ejercicios ya acertados", Icono: Repeat, colorDesde: "#99e9f2", colorHasta: "#15aabf", cumplido: repasos >= 30, progresoTexto: `${Math.min(repasos, 30)}/30 repasos`, progresoPct: (repasos / 30) * 100 },
    { id: "tres_modulos", nombre: "Explorador", desc: "Suma puntos en 3 módulos distintos", Icono: Rocket, colorDesde: "#ffa94d", colorHasta: "#e8590c", cumplido: modulosConPuntos >= 3, progresoTexto: `${Math.min(modulosConPuntos, 3)}/3 módulos`, progresoPct: (modulosConPuntos / 3) * 100 },
    { id: "todos_modulos", nombre: "Todo Terreno", desc: "Suma puntos en todos los módulos", Icono: Target, colorDesde: "#8ce99a", colorHasta: "#2f9e44", cumplido: SEGMENTOS_ENTRENAMIENTO.every((s) => puntosDeSegmento(s.id) > 0), progresoTexto: `${modulosConPuntos}/${SEGMENTOS_ENTRENAMIENTO.length} módulos`, progresoPct: (modulosConPuntos / SEGMENTOS_ENTRENAMIENTO.length) * 100 },
    { id: "perfeccionista", nombre: "Perfeccionista", desc: "Alcanza el 100% en todos los módulos con contenido", Icono: Sparkles, colorDesde: "#ffe066", colorHasta: "#fab005", cumplido: modulosConContenido.length > 0 && modulosAl100 === modulosConContenido.length, progresoTexto: `${modulosAl100}/${modulosConContenido.length} al 100%`, progresoPct: modulosConContenido.length > 0 ? (modulosAl100 / modulosConContenido.length) * 100 : 0 },
    { id: "nfpa_aprobado", nombre: "Certificado NFPA 72", desc: "Aprueba el Examen Básico de NFPA 72", Icono: ShieldCheck, colorDesde: "#ff8787", colorHasta: "#c92a2a", cumplido: puntosDeSegmento("nfpa72") >= 200 },
    { id: "electronica_aprobada", nombre: "Certificado Electrónica", desc: "Alcanza el 100% en Electrónica Básica", Icono: Zap, colorDesde: "#ffe066", colorHasta: "#f08c00", cumplido: puntosDeSegmento("electronica") >= (MAX_PUNTOS_SEGMENTO.electronica || Infinity) },
    { id: "compuertas_aprobada", nombre: "Certificado Compuertas", desc: "Alcanza el 100% en Compuertas Lógicas", Icono: GraduationCap, colorDesde: "#a5d8ff", colorHasta: "#1971c2", cumplido: puntosDeSegmento("compuertas") >= (MAX_PUNTOS_SEGMENTO.compuertas || Infinity) },
    { id: "escalera_aprobada", nombre: "Certificado Escalera", desc: "Alcanza el 100% en Lógica en Escalera", Icono: HardHat, colorDesde: "#eebefa", colorHasta: "#9c36b5", cumplido: puntosDeSegmento("escalera") >= (MAX_PUNTOS_SEGMENTO.escalera || Infinity) },
    { id: "senior", nombre: "Senior Experto", desc: "Alcanza el rango máximo (Panel) — 100% en todos los módulos", Icono: Crown, colorDesde: "#40c057", colorHasta: "#2b8a3e", cumplido: rangoActual.tipo === "panel" },
  ];

  if (!jugadorCodigo) {
    return (
      <Card title="Entrenamiento — ¿Quién va a jugar?">
        <div style={{ fontSize: 13.5, color: T.inkSoft, marginBottom: 14 }}>
          {esTecnico
            ? "No pudimos relacionar automáticamente tu usuario con un nombre en Planilla. Selecciona tu nombre de la lista para continuar (o pídele a un Administrativo que revise que tu nombre esté cargado en Planilla)."
            : "Selecciona tu nombre de la lista de Planilla para empezar a acumular puntos."}
        </div>
        {empleados.length === 0 ? (
          <div style={{ fontSize: 13, color: T.gray }}>Aún no hay personal cargado. Agrégalo desde Planilla.</div>
        ) : (
          <select style={{ ...inputStyle, maxWidth: 320 }} value={jugadorCodigo} onChange={(e) => setJugadorCodigo(e.target.value)}>
            <option value="">Selecciona tu nombre…</option>
            {empleados.map((emp) => <option key={emp.codigo} value={emp.codigo}>{emp.nombre}</option>)}
          </select>
        )}
      </Card>
    );
  }

  const anchoVista = vistaModo === "pc" ? 1400 : undefined;

  const moduloActivo =
    modulo === "compuertas" ? (
      <JuegoCompuertasLogicas
        onGanarPuntos={(ejercicio, puntos) => registrarPuntos("compuertas", ejercicio, puntos)}
        esAdmin={currentUser?.categoria === "admin"}
        onReiniciar={(borrarRanking) => reiniciarSegmento("compuertas", borrarRanking)}
      />
    ) : modulo === "escalera" ? (
      <JuegoLogicaEscalera
        onGanarPuntos={(ejercicio, puntos) => registrarPuntos("escalera", ejercicio, puntos)}
        esAdmin={currentUser?.categoria === "admin"}
        onReiniciar={(borrarRanking) => reiniciarSegmento("escalera", borrarRanking)}
      />
    ) : modulo === "tablas_verdad" ? (
      <JuegoTablasVerdad
        onGanarPuntos={(ejercicio, puntos) => registrarPuntos("tablas_verdad", ejercicio, puntos)}
        esAdmin={currentUser?.categoria === "admin"}
        onReiniciar={(borrarRanking) => reiniciarSegmento("tablas_verdad", borrarRanking)}
      />
    ) : modulo === "nfpa72" ? (
      <JuegoNFPA72 onGanarPuntos={(ejercicio, puntos) => registrarPuntos("nfpa72", ejercicio, puntos)} />
    ) : modulo === "electronica" ? (
      <JuegoElectronicaBasica onGanarPuntos={(ejercicio, puntos) => registrarPuntos("electronica", ejercicio, puntos)} />
    ) : modulo === "simplex" ? (
      <JuegoSimplex
        onGanarPuntos={(ejercicio, puntos) => registrarPuntos("simplex", ejercicio, puntos)}
        esAdmin={currentUser?.categoria === "admin"}
        onReiniciar={(borrarRanking) => reiniciarSegmento("simplex", borrarRanking)}
      />
    ) : modulo ? (
      <Card title={SEGMENTOS_ENTRENAMIENTO.find((m) => m.id === modulo)?.label}>
        <div style={{ color: T.gray, fontSize: 13.5 }}>
          Este módulo todavía no tiene contenido. Comparte el primer ejemplo de "{SEGMENTOS_ENTRENAMIENTO.find((m) => m.id === modulo)?.label}" y lo armamos aquí.
        </div>
      </Card>
    ) : null;

  // ============================================================
  // VISTA CELULAR: se ve y se comporta como una app nativa — marco de
  // teléfono, barra de estado propia, navegación inferior por pestañas,
  // y el contenido de cada pestaña ocupa toda la pantalla con scroll
  // independiente (como un APK real).
  // ============================================================
  if (vistaModo === "movil") {
    const TABS_MOVIL = [
      { id: "inicio", icon: "🏠", label: "Inicio" },
      { id: "modulos", icon: "🎯", label: "Módulos" },
      { id: "ranking", icon: "🏆", label: "Ranking" },
      { id: "perfil", icon: "👤", label: "Perfil" },
    ];
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999, background: "rgba(20,20,20,0.85)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "16px 0", overflowY: "auto",
      }}>
        <style>{`@keyframes flameFloatSlow { 0%,100% { transform: translateY(0) rotate(-10deg) scale(1); opacity: 0.12; } 50% { transform: translateY(-8px) rotate(-6deg) scale(1.05); opacity: 0.2; } }
          @keyframes rachaPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.75; } }`}</style>
        <div style={{ width: 390, maxWidth: "94vw", background: "#111", borderRadius: 34, padding: 8, boxShadow: "0 24px 60px rgba(0,0,0,0.5)", flexShrink: 0 }}>
          <div style={{ background: "#fff", borderRadius: 26, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(760px, 88vh)" }}>
            <div style={{ background: "linear-gradient(120deg, #ff922b 0%, #e8590c 45%, #c92a2a 100%)", padding: "16px 16px 12px", color: "#fff", flexShrink: 0, position: "relative", overflow: "hidden" }}>
              <Flame size={64} color="#fff" style={{ position: "absolute", top: -16, left: -8, opacity: 0.12, transform: "rotate(-10deg)", animation: "flameFloatSlow 5s ease-in-out infinite" }} />
              <button onClick={() => setVistaModo("auto")} title="Salir de vista celular" style={{ position: "absolute", top: 12, right: 14, background: "rgba(255,255,255,0.22)", border: "none", borderRadius: 8, width: 26, height: 26, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <X size={14} />
              </button>
              {modulo ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 34 }}>
                  <button onClick={() => setModulo(null)} style={{ background: "rgba(255,255,255,0.22)", border: "none", borderRadius: 8, width: 30, height: 30, color: "#fff", fontSize: 16, cursor: "pointer", flexShrink: 0 }}>←</button>
                  <div style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SEGMENTOS_ENTRENAMIENTO.find((m) => m.id === modulo)?.label}</div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 34 }}>
                  <div>
                    <div style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>🔥 Entrenamiento</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>¡Vamos, {jugador?.nombre?.split(" ")[0] || "técnico"}!</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 800 }}><NumeroAnimado valor={puntosTotal} /> pts</div>
                    <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "4px 8px", fontSize: 11, fontWeight: 800 }}>
                      <span style={{ display: "inline-block", animation: racha > 0 ? "rachaPulse 1.4s ease-in-out infinite" : "none" }}>🔥</span><NumeroAnimado valor={racha} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14, background: "#f8f9fa", WebkitOverflowScrolling: "touch" }}>
              {modulo ? moduloActivo : pantallaMovil === "inicio" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: rangoActual.soft, borderRadius: 14, padding: 14 }}>
                    <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase" }}>Rango actual</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      {rangoActual.tipo && <IconTrofeo tipo={rangoActual.tipo} size={18} color={rangoActual.color} />}
                      <span style={{ fontSize: 16, fontWeight: 800, color: rangoActual.color }}>{rangoActual.nombre}</span>
                    </div>
                    {rangoActual.siguiente && (
                      <>
                        <div style={{ height: 6, background: "#fff", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, (puntosTotal / rangoActual.siguiente) * 100)}%`, background: rangoActual.color }} />
                        </div>
                        <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 3 }}>{rangoActual.siguiente - puntosTotal} pts para subir</div>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>📅 Misiones de hoy</div>
                  {misionesDiarias.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: m.cumplida ? T.greenSoft : T.graySoft, border: `1px solid ${m.cumplida ? T.green : T.line}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: m.cumplida ? T.green : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {m.cumplida ? <Check size={14} color="#fff" /> : <m.Icono size={13} color={T.gray} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: m.cumplida ? T.green : T.ink }}>{m.texto}</div>
                        <div style={{ height: 4, background: "#fff", borderRadius: 99, overflow: "hidden", marginTop: 3 }}>
                          <div style={{ height: "100%", width: `${Math.min(100, (m.progreso / m.meta) * 100)}%`, background: m.cumplida ? T.green : T.accent }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: m.cumplida ? T.green : T.gray }}>{Math.min(m.progreso, m.meta)}/{m.meta}</div>
                    </div>
                  ))}
                </div>
              ) : pantallaMovil === "modulos" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>🎯 Elige tu misión</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {SEGMENTOS_ENTRENAMIENTO.map((s) => (
                      <div key={s.id} style={{ width: "100%" }}>
                        <MisionCard
                          label={s.label} Icono={s.Icono} colorDesde={s.colorDesde} colorHasta={s.colorHasta} lema={s.lema}
                          puntos={puntosDeSegmento(s.id)} max={MAX_PUNTOS_SEGMENTO[s.id] || 0}
                          seleccionada={false}
                          onClick={() => setModulo(s.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : pantallaMovil === "ranking" ? (
                <RankingEntrenamiento />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg, ${rangoActual.color}, ${rangoActual.color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                      {(jugador?.nombre || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{jugador?.nombre}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: rangoActual.color }}>{rangoActual.nombre}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "Puntaje", valor: `${puntosTotal} pts` },
                      { label: "Racha", valor: `🔥 ${racha}` },
                      { label: "Insignias", valor: `${LOGROS.filter((l) => l.cumplido).length}/${LOGROS.length}` },
                      { label: "Repasos", valor: `${repasos}` },
                    ].map((s) => (
                      <div key={s.label} style={{ background: T.graySoft, borderRadius: 10, padding: "8px 12px", minWidth: 100 }}>
                        <div style={{ fontSize: 9.5, color: T.gray, fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{s.valor}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>Insignias</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {LOGROS.map((l) => (
                      <InsigniaMedalla key={l.id} nombre={l.nombre} desc={l.desc} Icono={l.Icono} colorDesde={l.colorDesde} colorHasta={l.colorHasta} cumplido={l.cumplido} progresoTexto={l.progresoTexto} progresoPct={l.progresoPct} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!modulo && (
              <div style={{ display: "flex", borderTop: `1px solid ${T.line}`, background: "#fff", flexShrink: 0 }}>
                {TABS_MOVIL.map((t) => (
                  <button key={t.id} onClick={() => setPantallaMovil(t.id)} style={{ flex: 1, padding: "9px 4px", background: "transparent", border: "none", cursor: "pointer" }}>
                    <div style={{ fontSize: 18, opacity: pantallaMovil === t.id ? 1 : 0.5 }}>{t.icon}</div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: pantallaMovil === t.id ? T.accent : T.gray }}>{t.label}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={() => setVistaModo("auto")} style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", flexShrink: 0 }}>✕ Salir de vista celular</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: anchoVista, margin: anchoVista ? "0 auto" : undefined, transition: "max-width 0.2s ease" }}>
      {subioDeRango && (
        <>
        <style>{`
          @keyframes trofeoBounce { 0% { transform: scale(0.3) rotate(-15deg); opacity: 0; } 50% { transform: scale(1.15) rotate(6deg); opacity: 1; } 70% { transform: scale(0.95) rotate(-3deg); } 100% { transform: scale(1) rotate(0deg); } }
          @keyframes bannerGlow { 0%,100% { box-shadow: 0 0 0 0 ${subioDeRango.color}55; } 50% { box-shadow: 0 0 0 10px ${subioDeRango.color}00; } }
        `}</style>
        <div style={{
          position: "relative",
          background: `linear-gradient(120deg, ${subioDeRango.soft}, #fff 70%)`, border: `2px solid ${subioDeRango.color}`,
          borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 18,
          animation: "bannerGlow 1.8s ease-in-out infinite",
        }}>
          <Confeti />
          <button
            onClick={() => setSubioDeRango(null)}
            aria-label="Cerrar"
            style={{
              position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%",
              border: "none", background: "#fff", color: T.inkSoft, cursor: "pointer", fontSize: 15, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <X size={14} />
          </button>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#fff", border: `3px solid ${subioDeRango.color}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            animation: "trofeoBounce 0.7s cubic-bezier(.36,1.5,.4,1)",
          }}>
            {subioDeRango.tipo ? <IconTrofeo tipo={subioDeRango.tipo} size={34} color={subioDeRango.color} /> : <Award size={34} color={subioDeRango.color} fill={subioDeRango.color} />}
          </div>
          <div style={{ paddingRight: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: subioDeRango.color, textTransform: "uppercase", letterSpacing: 0.4 }}>🎉 ¡Felicidades, {jugador?.nombre?.split(" ")[0] || ""}!</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, margin: "2px 0 4px" }}>Nuevo rango desbloqueado: {subioDeRango.nombre}</div>
            <div style={{ fontSize: 12.5, color: T.inkSoft }}>{subioDeRango.mensaje || "Sigue sumando puntos en los módulos para llegar más alto."}</div>
          </div>
        </div>
        </>
      )}
      <div style={{
        background: "linear-gradient(120deg, #ff922b 0%, #e8590c 45%, #c92a2a 100%)",
        borderRadius: 18, padding: "18px clamp(14px, 4vw, 24px)", marginBottom: 16, position: "relative", overflow: "hidden",
      }}>
        <style>{`
          @keyframes flameFloat { 0%,100% { transform: translateY(0) rotate(-4deg); opacity: 0.5; } 50% { transform: translateY(-6px) rotate(4deg); opacity: 0.8; } }
          @keyframes flameFloatSlow { 0%,100% { transform: translateY(0) rotate(15deg) scale(1); opacity: 0.12; } 50% { transform: translateY(-10px) rotate(20deg) scale(1.05); opacity: 0.2; } }
          @keyframes flameFlicker { 0%,100% { transform: translateY(0) scale(1) rotate(-6deg); opacity: 0.3; } 25% { transform: translateY(-3px) scale(1.08) rotate(-2deg); opacity: 0.45; } 50% { transform: translateY(-8px) scale(0.95) rotate(-8deg); opacity: 0.55; } 75% { transform: translateY(-3px) scale(1.05) rotate(-3deg); opacity: 0.4; } }
          @keyframes flameDrift { 0%,100% { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0.18; } 50% { transform: translateX(6px) translateY(-8px) rotate(10deg); opacity: 0.3; } }
        `}</style>
        <Flame size={90} color="#fff" style={{ position: "absolute", top: -20, right: -10, opacity: 0.15, transform: "rotate(15deg)", animation: "flameFloatSlow 5s ease-in-out infinite" }} />
        <Flame size={46} color="#fff" style={{ position: "absolute", bottom: -6, right: 90, opacity: 0.35, animation: "flameFloat 3s ease-in-out infinite" }} />
        <Flame size={30} color="#fff" style={{ position: "absolute", top: 14, right: 140, opacity: 0.3, animation: "flameFlicker 2.2s ease-in-out infinite" }} />
        <Flame size={24} color="#fff" style={{ position: "absolute", bottom: 10, left: "38%", opacity: 0.18, animation: "flameDrift 4s ease-in-out infinite 0.5s" }} />
        <Flame size={18} color="#fff" style={{ position: "absolute", top: "50%", right: "22%", opacity: 0.22, animation: "flameFlicker 2.8s ease-in-out infinite 0.8s" }} />
        <Flame size={54} color="#fff" style={{ position: "absolute", top: -14, left: "58%", opacity: 0.1, transform: "rotate(-10deg)", animation: "flameFloatSlow 6s ease-in-out infinite 1.2s" }} />
        <style>{`@keyframes rachaPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.75; } }
          @keyframes brilloBarraRango { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "relative" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: 0.6 }}>🔥 Centro de Entrenamiento</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "2px 0 10px" }}>¡Vamos, {jugador?.nombre?.split(" ")[0] || "técnico"}!</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase" }}>Puntaje</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}><NumeroAnimado valor={puntosTotal} /> pts</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 14px", minWidth: 190 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase" }}>Rango</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {rangoActual.tipo && <IconTrofeo tipo={rangoActual.tipo} size={17} color="#fff" />}
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{rangoActual.nombre}</span>
                </div>
                {rangoActual.siguiente && (
                  <>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.3)", borderRadius: 99, overflow: "hidden", marginTop: 4, position: "relative" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (puntosTotal / rangoActual.siguiente) * 100)}%`, background: "#fff", transition: "width 0.4s ease", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,146,43,0.7), transparent)", animation: "brilloBarraRango 2s ease-in-out infinite" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{rangoActual.siguiente - puntosTotal} pts para subir</div>
                  </>
                )}
              </div>
              <div style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase" }}>Racha</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                  <span style={{ display: "inline-block", animation: racha > 0 ? "rachaPulse 1.4s ease-in-out infinite" : "none" }}>🔥</span> <NumeroAnimado valor={racha} />
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(4px)", borderRadius: 12, padding: "8px 14px" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", fontWeight: 700, textTransform: "uppercase" }}>Insignias</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{LOGROS.filter((l) => l.cumplido).length}/{LOGROS.length}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: 3, gap: 2 }}>
              <button onClick={() => setVistaModo(vistaModo === "movil" ? "auto" : "movil")} title="Simular vista de celular" style={{ background: vistaModo === "movil" ? "#fff" : "transparent", color: vistaModo === "movil" ? "#e8590c" : "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>📱</button>
              <button onClick={() => setVistaModo(vistaModo === "pc" ? "auto" : "pc")} title="Simular vista de PC" style={{ background: vistaModo === "pc" ? "#fff" : "transparent", color: vistaModo === "pc" ? "#e8590c" : "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>💻</button>
            </div>
            <button onClick={() => setMostrarPerfil((v) => !v)} style={{ background: mostrarPerfil ? "#fff" : "rgba(255,255,255,0.2)", color: mostrarPerfil ? "#e8590c" : "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>👤 Perfil</button>
            <button onClick={() => setMostrarRanking((v) => !v)} style={{ background: mostrarRanking ? "#fff" : "rgba(255,255,255,0.2)", color: mostrarRanking ? "#e8590c" : "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>🏆 Ranking</button>
            {!esTecnico && <button onClick={() => setJugadorCodigo("")} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Cambiar jugador</button>}
          </div>
        </div>
      </div>

      {mostrarPerfil && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, ${rangoActual.color}, ${rangoActual.color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
              {(jugador?.nombre || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{jugador?.nombre}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {rangoActual.tipo && <IconTrofeo tipo={rangoActual.tipo} size={14} color={rangoActual.color} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: rangoActual.color }}>{rangoActual.nombre}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Puntaje total", valor: `${puntosTotal} pts` },
              { label: "Racha actual", valor: `🔥 ${racha} día${racha === 1 ? "" : "s"}` },
              { label: "Insignias", valor: `${LOGROS.filter((l) => l.cumplido).length}/${LOGROS.length}` },
              { label: "Ejercicios acertados", valor: `${puntajes.filter((p) => p.puntos > 0 && !(p.ejercicio || "").includes("(repaso)")).length}` },
              { label: "Repasos realizados", valor: `${repasos}` },
              { label: "Módulos con progreso", valor: `${modulosConPuntos}/${SEGMENTOS_ENTRENAMIENTO.length}` },
            ].map((s) => (
              <div key={s.label} style={{ background: T.graySoft, borderRadius: 10, padding: "10px 14px", minWidth: 140 }}>
                <div style={{ fontSize: 10.5, color: T.gray, fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{s.valor}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10 }}>📅 Misiones de hoy</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {misionesDiarias.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, minWidth: 220,
              background: m.cumplida ? T.greenSoft : T.graySoft, border: `1px solid ${m.cumplida ? T.green : T.line}`,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: m.cumplida ? T.green : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {m.cumplida ? <Check size={16} color="#fff" /> : <m.Icono size={15} color={T.gray} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.cumplida ? T.green : T.ink }}>{m.texto}</div>
                <div style={{ height: 4, background: "#fff", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (m.progreso / m.meta) * 100)}%`, background: m.cumplida ? T.green : T.accent }} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: m.cumplida ? T.green : T.gray }}>{Math.min(m.progreso, m.meta)}/{m.meta}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🎯 Elige tu misión</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 14 }}>Cada módulo es una misión — sube el progreso hasta el 100% para ganarte el trofeo.</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
          {SEGMENTOS_ENTRENAMIENTO.map((s) => (
            <MisionCard
              key={s.id}
              label={s.label} Icono={s.Icono} colorDesde={s.colorDesde} colorHasta={s.colorHasta} lema={s.lema}
              puntos={puntosDeSegmento(s.id)} max={MAX_PUNTOS_SEGMENTO[s.id] || 0}
              seleccionada={modulo === s.id}
              onClick={() => setModulo(s.id)}
            />
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Tabla de rangos</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RANGOS_ENTRENAMIENTO.map((r) => (
              <div key={r.nombre} style={{ background: rangoActual.nombre === r.nombre ? r.soft : "#fff", border: `1px solid ${rangoActual.nombre === r.nombre ? r.color : T.line}`, borderRadius: 10, padding: "8px 12px", minWidth: 165 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {r.tipo && <IconTrofeo tipo={r.tipo} size={14} color={r.color} />}
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.nombre}</div>
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft }}>{r.min}{r.siguiente ? ` – ${r.siguiente - 1}` : "+"} pts</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Insignias</div>
            <div style={{ fontSize: 11.5, color: T.gray }}>{LOGROS.filter((l) => l.cumplido).length}/{LOGROS.length} desbloqueadas</div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {LOGROS.map((l) => (
              <InsigniaMedalla key={l.id} nombre={l.nombre} desc={l.desc} Icono={l.Icono} colorDesde={l.colorDesde} colorHasta={l.colorHasta} cumplido={l.cumplido} progresoTexto={l.progresoTexto} progresoPct={l.progresoPct} />
            ))}
          </div>
        </div>
        {mostrarRanking && (
          <div style={{ marginTop: 18 }}>
            <RankingEntrenamiento />
          </div>
        )}
      </Card>

      {moduloActivo}
    </div>
  );
}

// Juego de Compuertas Lógicas: arrastra compuertas reales al lienzo,
// conéctalas dibujando el cable a mano, y el fondo cambia de color solo
// (gris = incompleto, verde = correcto, rojo = incorrecto). Al acertar
// un ejercicio nuevo, avisa hacia arriba para sumar puntos.
function JuegoCompuertasLogicas({ onGanarPuntos, esAdmin, onReiniciar }) {
  const contenedorRef = React.useRef(null);
  const ganadosRef = React.useRef(new Set());
  const falladosRef = React.useRef(new Set());
  const cargarEjercicioRef = React.useRef(null);
  const ejActualExpuestoRef = React.useRef(0);
  const nivelActualExpuestoRef = React.useRef("Básico");
  const nivelLongitudRef = React.useRef(0);
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [, forceRender] = useState(0);
  const bloqueado = (clave) => falladosRef.current.has(clave) && !ganadosRef.current.has(clave);
  const reiniciarModulo = (borrarRanking) => {
    falladosRef.current.clear();
    if (borrarRanking) ganadosRef.current.clear();
    onReiniciar && onReiniciar(borrarRanking);
    cargarEjercicioRef.current && cargarEjercicioRef.current(ejActualExpuestoRef.current);
    forceRender((n) => n + 1);
  };
  // Reinicio propio del técnico: solo desbloquea las preguntas falladas
  // DE ESTE NIVEL para poder recuperarlas — los puntos ya ganados en la
  // primera ronda se mantienen y no se vuelven a sumar.
  const reiniciarNivelTecnico = () => {
    const nv = nivelActualExpuestoRef.current;
    Array.from(falladosRef.current).forEach((clave) => { if (clave.startsWith(nv + "-")) falladosRef.current.delete(clave); });
    cargarEjercicioRef.current && cargarEjercicioRef.current(0);
    forceRender((n) => n + 1);
  };
  const hayBloqueadosEnNivelActual = () => {
    const nv = nivelActualExpuestoRef.current;
    for (let i = 0; i < nivelLongitudRef.current; i++) { if (bloqueado(nv + "-" + i)) return true; }
    return false;
  };

  useEffect(() => {
    if (mostrarIntro) return;
    const cont = contenedorRef.current;
    if (!cont) return;

    const GATES_JUEGO = {
      AND: { inputs: 2, fn: (a, b) => (a && b) },
      OR: { inputs: 2, fn: (a, b) => (a || b) },
      NAND: { inputs: 2, fn: (a, b) => !(a && b) },
      NOR: { inputs: 2, fn: (a, b) => !(a || b) },
      NOT: { inputs: 1, fn: (a) => !a },
    };
    const NIVELES_JUEGO = {
      "Básico": [
        { frase: '"Activa la Notificación Audible si hay Sensor de Humo o Estación Manual."', terminales: ["Sensor de Humo", "Estación Manual"], evaluar: (v) => v["Sensor de Humo"] || v["Estación Manual"] },
        { frase: '"Envía al Extractor de Humo si hay Sensor de Humo y Sensor de Temperatura."', terminales: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => v["Sensor de Humo"] && v["Sensor de Temperatura"] },
        { frase: '"El Inyector de Aire debe estar apagado mientras haya Sensor de Humo activo."', terminales: ["Sensor de Humo"], evaluar: (v) => !v["Sensor de Humo"] },
        { frase: '"El Extractor de Humo se apaga únicamente cuando el Sensor de Humo y el Sensor de Temperatura están ambos activos a la vez; en cualquier otro caso, sigue encendido."', terminales: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => !(v["Sensor de Humo"] && v["Sensor de Temperatura"]) },
        { frase: '"El Sistema de Diluvio solo se habilita cuando no hay Sensor de Gas LPG ni Falla del Sistema activos."', terminales: ["Sensor de Gas LPG", "Falla del Sistema"], evaluar: (v) => !(v["Sensor de Gas LPG"] || v["Falla del Sistema"]) },
      ],
      "Intermedio": [
        { frase: '"Activa Notificación Visible si hay Sensor de Flama o Sensor de Temperatura, y no hay Falla del Sistema."', terminales: ["Sensor de Flama", "Sensor de Temperatura", "Falla del Sistema"], evaluar: (v) => (v["Sensor de Flama"] || v["Sensor de Temperatura"]) && !v["Falla del Sistema"] },
        { frase: '"Abre las Puertas si hay Sensor de Gas LPG y no hay Falla del Sistema."', terminales: ["Sensor de Gas LPG", "Falla del Sistema"], evaluar: (v) => v["Sensor de Gas LPG"] && !v["Falla del Sistema"] },
        { frase: '"Control de Elevadores baja al vestíbulo si hay Estación Manual y no hay Falla del Sistema."', terminales: ["Estación Manual", "Falla del Sistema"], evaluar: (v) => v["Estación Manual"] && !v["Falla del Sistema"] },
        { frase: '"Activa el Sistema de Espuma si hay Sensor de Flama y Sensor de Flujo, y no hay Sensor de Monóxido."', terminales: ["Sensor de Flama", "Sensor de Flujo", "Sensor de Monóxido"], evaluar: (v) => v["Sensor de Flama"] && v["Sensor de Flujo"] && !v["Sensor de Monóxido"] },
        { frase: '"La Notificación Audible se silencia únicamente cuando la Estación Manual y el Llavín de Mantenimiento están ambos activos a la vez; en cualquier otro caso, suena."', terminales: ["Estación Manual", "Llavín de Mantenimiento"], evaluar: (v) => !(v["Estación Manual"] && v["Llavín de Mantenimiento"]) },
        { frase: '"El Control de Elevadores solo se habilita para el recall cuando no hay Sensor de Humo ni Sensor de Monóxido activos."', terminales: ["Sensor de Humo", "Sensor de Monóxido"], evaluar: (v) => !(v["Sensor de Humo"] || v["Sensor de Monóxido"]) },
      ],
      "Avanzado": [
        { frase: 'Activa el Sistema de Diluvio cuando cualquiera de los sensores de detección (Humo, Flama o Estación Manual) se dispare, siempre que además haya flujo de agua confirmado por el Sensor de Flujo.', terminales: ["Sensor de Humo", "Sensor de Flama", "Estación Manual", "Sensor de Flujo"], evaluar: (v) => (v["Sensor de Humo"] || v["Sensor de Flama"] || v["Estación Manual"]) && v["Sensor de Flujo"] },
        { frase: 'El Agente Limpio se descarga si los tres sensores (Humo, Temperatura y Flama) detectan la condición al mismo tiempo, o si alguien activa la Estación Manual.', terminales: ["Sensor de Humo", "Sensor de Temperatura", "Sensor de Flama", "Estación Manual"], evaluar: (v) => (v["Sensor de Humo"] && v["Sensor de Temperatura"] && v["Sensor de Flama"]) || v["Estación Manual"] },
        { frase: 'El Extractor de Humo se enciende si hay Sensor de Humo o se activó la Estación Manual junto con temperatura elevada; también se enciende automáticamente si hay una fuga detectada por el Sensor de Gas LPG.', terminales: ["Sensor de Humo", "Estación Manual", "Sensor de Temperatura", "Sensor de Gas LPG"], evaluar: (v) => ((v["Sensor de Humo"] || v["Estación Manual"]) && v["Sensor de Temperatura"]) || v["Sensor de Gas LPG"] },
        { frase: 'El Control de Elevadores hace el recall si detecta Humo o Monóxido junto con el Sensor de Flama, o si se activa la Estación Manual.', terminales: ["Sensor de Humo", "Sensor de Monóxido", "Sensor de Flama", "Estación Manual"], evaluar: (v) => ((v["Sensor de Humo"] || v["Sensor de Monóxido"]) && v["Sensor de Flama"]) || v["Estación Manual"] },
        { frase: 'Prueba Final — Sistema de Agente Limpio: hay dos sensores de humo. Si ambos sensores están activos a la vez, se debe iniciar la Descarga del agente — a menos que se presione el Botón de Aborto o esté puesto el Llavín de Mantenimiento. También hay un Botón de Descarga Directa que dispara la Descarga de inmediato, pero solo si el Llavín de Mantenimiento no está puesto.', terminales: ["Sensor Humo 1", "Sensor Humo 2", "Botón Aborto", "Llavín Mantenimiento", "Botón Descarga Directa"], evaluar: (v) => (v["Sensor Humo 1"] && v["Sensor Humo 2"] && !v["Botón Aborto"] && !v["Llavín Mantenimiento"]) || (v["Botón Descarga Directa"] && !v["Llavín Mantenimiento"]) },
      ],
    };
    let nivelActual = "Básico";
    let EJERCICIOS_JUEGO = NIVELES_JUEGO[nivelActual];

    function svgGate(tipo) {
      const s = "currentColor";
      const dosEntradas = `<line x1="-10" y1="8" x2="2" y2="8" stroke="${s}" stroke-width="2"/><line x1="-10" y1="32" x2="2" y2="32" stroke="${s}" stroke-width="2"/>`;
      const unaEntrada = `<line x1="-10" y1="20" x2="2" y2="20" stroke="${s}" stroke-width="2"/>`;
      const shapes = {
        AND: `${dosEntradas}<path d="M2,2 L20,2 A18,18 0 0 1 20,38 L2,38 Z" fill="none" stroke="${s}" stroke-width="2"/><line x1="38" y1="20" x2="48" y2="20" stroke="${s}" stroke-width="2"/>`,
        NAND: `${dosEntradas}<path d="M2,2 L18,2 A18,18 0 0 1 18,38 L2,38 Z" fill="none" stroke="${s}" stroke-width="2"/><circle cx="42" cy="20" r="4" fill="none" stroke="${s}" stroke-width="2"/><line x1="46" y1="20" x2="56" y2="20" stroke="${s}" stroke-width="2"/>`,
        OR: `${dosEntradas}<path d="M2,2 C16,2 16,2 24,20 C16,38 16,38 2,38 C10,28 10,12 2,2 Z" fill="none" stroke="${s}" stroke-width="2" stroke-linejoin="round"/><line x1="24" y1="20" x2="34" y2="20" stroke="${s}" stroke-width="2"/>`,
        NOR: `${dosEntradas}<path d="M2,2 C14,2 14,2 20,20 C14,38 14,38 2,38 C8,28 8,12 2,2 Z" fill="none" stroke="${s}" stroke-width="2" stroke-linejoin="round"/><circle cx="38" cy="20" r="4" fill="none" stroke="${s}" stroke-width="2"/><line x1="42" y1="20" x2="52" y2="20" stroke="${s}" stroke-width="2"/>`,
        NOT: `${unaEntrada}<path d="M2,2 L2,38 L32,20 Z" fill="none" stroke="${s}" stroke-width="2" stroke-linejoin="round"/><circle cx="38" cy="20" r="4" fill="none" stroke="${s}" stroke-width="2"/><line x1="42" y1="20" x2="52" y2="20" stroke="${s}" stroke-width="2"/>`,
      };
      return `<svg width="66" height="40" viewBox="-10 0 76 40" style="display:block; color:${T.ink};">${shapes[tipo]}</svg>`;
    }

    let ejActual = 0, nodos = {}, conexiones = [], nodoIdSeq = 1, conexionIdSeq = 1, arrastreCable = null, circuitoCorrecto = false;

    const elTitulo = cont.querySelector(".je-titulo");
    const elFrase = cont.querySelector(".je-frase");
    const elCanvas = cont.querySelector(".je-canvas");
    const elSvg = cont.querySelector(".je-wires");
    const elResultado = cont.querySelector(".je-resultado");
    const elPalette = cont.querySelector(".je-palette");

    function fondoNeutral() { elCanvas.style.background = T.graySoft; }

    function limpiarLienzo() {
      nodos = {}; conexiones = []; arrastreCable = null;
      Array.from(elCanvas.querySelectorAll(".je-nodo")).forEach((n) => n.remove());
      elResultado.textContent = "";
      fondoNeutral();
      dibujarConexiones();
    }

    function cargarEjercicio(i) {
      if (EJERCICIOS_JUEGO.length === 0) {
        ejActual = 0;
        elTitulo.textContent = nivelActual + " — sin ejercicios todavía";
        elFrase.textContent = "Este nivel se irá llenando pronto.";
        limpiarLienzo();
        return;
      }
      ejActual = (i + EJERCICIOS_JUEGO.length) % EJERCICIOS_JUEGO.length;
      ejActualExpuestoRef.current = ejActual;
      const ej = EJERCICIOS_JUEGO[ejActual];
      elTitulo.textContent = nivelActual + " — Ejercicio #" + (ejActual + 1);
      elFrase.textContent = ej.frase;
      limpiarLienzo();
      const claveEj = nivelActual + "-" + ejActual;
      if (bloqueado(claveEj)) {
        elCanvas.innerHTML = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:20px;"><div style="color:${T.red}; font-size:13px; font-weight:600; max-width:340px;">🔒 Bloqueado — fallaste este ejercicio. Llega hasta el último ejercicio del nivel para poder reiniciarlo y recuperarlo.</div></div>`;
        elCanvas.style.background = T.redSoft;
        elPalette.style.opacity = "0.4";
        elPalette.style.pointerEvents = "none";
        forceRender((n) => n + 1);
        return;
      }
      elPalette.style.opacity = "1";
      elPalette.style.pointerEvents = "auto";
      ej.terminales.forEach((nombre, i2) => crearNodo("term", nombre, 10, 16 + i2 * 72));
      crearNodo("salida", "Salida", 560, 160);
      forceRender((n) => n + 1);
    }
    cargarEjercicioRef.current = cargarEjercicio;

    function cambiarNivel(nivel) {
      nivelActual = nivel;
      EJERCICIOS_JUEGO = NIVELES_JUEGO[nivelActual];
      nivelActualExpuestoRef.current = nivel;
      nivelLongitudRef.current = EJERCICIOS_JUEGO.length;
      Array.from(cont.querySelectorAll(".je-nivel-btn")).forEach((b) => {
        const activo = b.dataset.nivel === nivel;
        b.style.background = activo ? T.accent : "transparent";
        b.style.color = activo ? "#fff" : T.steel;
        b.style.borderColor = activo ? T.accent : T.line;
      });
      cargarEjercicio(0);
    }

    function borrarNodo(id) {
      conexiones = conexiones.filter((c) => c.deNodo !== id && c.aNodo !== id);
      const el = elCanvas.querySelector('.je-nodo[data-id="' + id + '"]');
      if (el) el.remove();
      delete nodos[id];
      dibujarConexiones();
      actualizarEstado();
    }

    function crearNodo(tipo, label, x, y) {
      const id = "n" + (nodoIdSeq++);
      const inputs = tipo === "gate" ? GATES_JUEGO[label].inputs : (tipo === "salida" ? 1 : 0);
      const el = document.createElement("div");
      el.className = "je-nodo";
      el.dataset.id = id;
      el.style.cssText = "position:absolute; cursor:grab; user-select:none;";
      el.style.left = x + "px"; el.style.top = y + "px";

      if (tipo === "gate") {
        el.innerHTML = svgGate(label) +
          `<button class="je-btn-borrar" style="position:absolute; top:-8px; right:-4px; width:18px; height:18px; padding:0; border-radius:50%; background:${T.red}; color:#fff; border:none; font-size:11px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>`;
      } else if (tipo === "term") {
        el.innerHTML = `<div style="padding:8px 12px; background:${T.blueSoft}; color:${T.blue}; border-radius:8px; font-size:12px; font-weight:700; min-width:50px; text-align:center;">${label}</div>`;
      } else {
        el.innerHTML = `<div style="padding:8px 12px; background:#fff; border:1px solid ${T.line}; border-radius:8px; font-size:12px; font-weight:700; min-width:50px; text-align:center;">Salida</div>`;
      }
      elCanvas.appendChild(el);
      nodos[id] = { tipo, label, x, y, valorFijo: tipo === "term" ? false : null };

      if (inputs >= 1) crearPuerto(el, id, "in0", "in", 0, inputs, tipo);
      if (inputs >= 2) crearPuerto(el, id, "in1", "in", 1, inputs, tipo);
      if (tipo === "gate" || tipo === "term") crearPuerto(el, id, "out", "out", 0, 1, tipo);

      if (tipo === "term") {
        el.onclick = (e) => {
          if (e.target.classList.contains("je-puerto")) return;
          nodos[id].valorFijo = !nodos[id].valorFijo;
          const box = el.querySelector("div");
          box.style.background = nodos[id].valorFijo ? T.greenSoft : T.blueSoft;
          box.style.color = nodos[id].valorFijo ? T.green : T.blue;
        };
      }
      if (tipo === "gate") {
        const btnBorrar = el.querySelector(".je-btn-borrar");
        btnBorrar.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnBorrar.addEventListener("click", (e) => { e.stopPropagation(); borrarNodo(id); });
      }
      hacerArrastrable(el, id);
      return id;
    }

    function altoNodo(tipo) { return tipo === "gate" ? 40 : 34; }

    function crearPuerto(nodoEl, nodoId, puertoId, dir, idx, total, tipo) {
      const dot = document.createElement("div");
      dot.className = "je-puerto";
      dot.dataset.nodo = nodoId; dot.dataset.puerto = puertoId; dot.dataset.dir = dir;
      const h = altoNodo(tipo);
      const offsetY = total > 1 ? (idx === 0 ? h * 0.28 : h * 0.72) : h / 2;
      dot.style.cssText = `position:absolute; width:11px; height:11px; border-radius:50%; background:${T.steel}; cursor:crosshair; top:${offsetY}px; transform:translate(-50%,-50%); z-index:2;`;
      dot.style.left = dir === "in" ? "0px" : (tipo === "gate" ? "62px" : "100%");
      nodoEl.appendChild(dot);

      dot.addEventListener("pointerdown", (e) => {
        if (dir !== "out") return;
        e.stopPropagation();
        const p1 = centroPuerto(nodoId, puertoId);
        arrastreCable = { deNodo: nodoId, dePuerto: puertoId, x: p1.x, y: p1.y, curX: e.clientX, curY: e.clientY };
        dibujarConexiones();
      });
      dot.addEventListener("pointerup", (e) => {
        if (dir !== "in" || !arrastreCable) return;
        e.stopPropagation();
        conexiones = conexiones.filter((c) => !(c.aNodo === nodoId && c.aPuerto === puertoId));
        conexiones.push({ id: "c" + (conexionIdSeq++), deNodo: arrastreCable.deNodo, dePuerto: arrastreCable.dePuerto, aNodo: nodoId, aPuerto: puertoId });
        arrastreCable = null;
        dibujarConexiones();
        actualizarEstado();
      });
    }

    function onDocPointerMove(e) {
      if (!arrastreCable) return;
      const cr = elCanvas.getBoundingClientRect();
      arrastreCable.curX = e.clientX - cr.left;
      arrastreCable.curY = e.clientY - cr.top;
      dibujarConexiones();
    }
    function onDocPointerUp() {
      if (arrastreCable) { arrastreCable = null; dibujarConexiones(); }
    }
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);

    function hacerArrastrable(el, id) {
      let arrastrando = false, offX = 0, offY = 0;
      el.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("je-puerto") || e.target.classList.contains("je-btn-borrar")) return;
        arrastrando = true;
        el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect();
        offX = e.clientX - rect.left; offY = e.clientY - rect.top;
      });
      el.addEventListener("pointermove", (e) => {
        if (!arrastrando) return;
        const canvasRect = elCanvas.getBoundingClientRect();
        let x = e.clientX - canvasRect.left - offX;
        let y = e.clientY - canvasRect.top - offY;
        x = Math.max(0, Math.min(x, canvasRect.width - 60));
        y = Math.max(0, Math.min(y, canvasRect.height - 40));
        el.style.left = x + "px"; el.style.top = y + "px";
        nodos[id].x = x; nodos[id].y = y;
        dibujarConexiones();
      });
      el.addEventListener("pointerup", () => { arrastrando = false; });
    }

    function centroPuerto(nodoId, puertoId) {
      const nodoEl = elCanvas.querySelector('.je-nodo[data-id="' + nodoId + '"]');
      const puertoEl = nodoEl.querySelector('.je-puerto[data-puerto="' + puertoId + '"]');
      const r = puertoEl.getBoundingClientRect();
      const cr = elCanvas.getBoundingClientRect();
      return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    }

    function curva(p1, p2) {
      const midX = (p1.x + p2.x) / 2;
      return `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    function dibujarConexiones() {
      elSvg.innerHTML = "";
      conexiones.forEach((c) => {
        if (!nodos[c.deNodo] || !nodos[c.aNodo]) return;
        const p1 = centroPuerto(c.deNodo, c.dePuerto);
        const p2 = centroPuerto(c.aNodo, c.aPuerto);
        const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hit.setAttribute("d", curva(p1, p2));
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "14");
        hit.setAttribute("fill", "none");
        hit.style.cursor = "pointer";
        hit.style.pointerEvents = "stroke";
        const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
        visible.setAttribute("d", curva(p1, p2));
        if (circuitoCorrecto) {
          visible.setAttribute("stroke", T.green);
          visible.setAttribute("stroke-width", "2.5");
          visible.setAttribute("stroke-dasharray", "6 4");
          visible.setAttribute("class", "je-corriente");
        } else {
          visible.setAttribute("stroke", T.inkSoft);
          visible.setAttribute("stroke-width", "2");
        }
        visible.setAttribute("fill", "none");
        visible.style.pointerEvents = "none";
        hit.addEventListener("click", () => {
          conexiones = conexiones.filter((x) => x.id !== c.id);
          dibujarConexiones();
          actualizarEstado();
        });
        hit.addEventListener("mouseenter", () => { if (!circuitoCorrecto) visible.setAttribute("stroke", T.red); });
        hit.addEventListener("mouseleave", () => { if (!circuitoCorrecto) visible.setAttribute("stroke", T.inkSoft); });
        grupo.appendChild(hit); grupo.appendChild(visible);
        elSvg.appendChild(grupo);
      });
      if (arrastreCable) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", curva({ x: arrastreCable.x, y: arrastreCable.y }, { x: arrastreCable.curX, y: arrastreCable.curY }));
        path.setAttribute("stroke", T.blue);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-dasharray", "4 3");
        path.setAttribute("fill", "none");
        elSvg.appendChild(path);
      }
    }

    elPalette.innerHTML = "";
    const ECUACION_GATE = { AND: "C=a·b", OR: "C=a+b", NOT: "b=¬a", NAND: "C=¬(a·b)", NOR: "C=¬(a+b)" };
    Object.keys(GATES_JUEGO).forEach((key) => {
      const btn = document.createElement("button");
      btn.style.cssText = "padding:4px 10px; display:flex; align-items:center; gap:6px; border:1px solid " + T.line + "; border-radius:8px; background:#fff; cursor:pointer;";
      btn.innerHTML = svgGate(key) + `<span style="display:flex; flex-direction:column; align-items:flex-start;"><span style="font-size:11px; font-weight:600;">${key}</span><span style="font-size:9.5px; color:${T.gray};">${ECUACION_GATE[key]}</span></span>`;
      btn.onclick = () => { crearNodo("gate", key, 200 + Math.random() * 140, 30 + Math.random() * 220); actualizarEstado(); };
      elPalette.appendChild(btn);
    });

    cont.querySelector(".je-limpiar").onclick = () => cargarEjercicio(ejActual);
    cont.querySelector(".je-prev").onclick = () => cargarEjercicio(ejActual - 1);
    cont.querySelector(".je-next").onclick = () => cargarEjercicio(ejActual + 1);

    function evaluarNodo(nodoId, cache) {
      if (cache.has(nodoId)) return cache.get(nodoId);
      const n = nodos[nodoId];
      if (n.tipo === "term") { cache.set(nodoId, n.valorFijo); return n.valorFijo; }
      const entradas = conexiones.filter((c) => c.aNodo === nodoId).sort((a, b) => a.aPuerto.localeCompare(b.aPuerto));
      if (n.tipo === "salida") {
        if (entradas.length === 0) return null;
        return evaluarNodo(entradas[0].deNodo, cache);
      }
      const gate = GATES_JUEGO[n.label];
      if (entradas.length < gate.inputs) return null;
      const valores = entradas.slice(0, gate.inputs).map((e) => evaluarNodo(e.deNodo, cache));
      if (valores.some((v) => v === null)) return null;
      const resultado = gate.fn(...valores);
      cache.set(nodoId, resultado);
      return resultado;
    }

    function actualizarEstado() {
      const ej = EJERCICIOS_JUEGO[ejActual];
      const salidaId = Object.keys(nodos).find((id) => nodos[id].tipo === "salida");
      const n = ej.terminales.length;
      const combinaciones = [];
      for (let i = 0; i < (1 << n); i++) {
        const v = {};
        ej.terminales.forEach((t, idx) => v[t] = !!((i >> idx) & 1));
        combinaciones.push(v);
      }
      const valoresGuardados = {};
      Object.keys(nodos).forEach((id) => { if (nodos[id].tipo === "term") valoresGuardados[id] = nodos[id].valorFijo; });

      let incompleto = false, todoCorrecto = true;
      for (const combo of combinaciones) {
        Object.keys(nodos).forEach((id) => { if (nodos[id].tipo === "term") nodos[id].valorFijo = combo[nodos[id].label]; });
        const salida = evaluarNodo(salidaId, new Map());
        if (salida === null) { incompleto = true; break; }
        if (!!salida !== !!ej.evaluar(combo)) { todoCorrecto = false; break; }
      }
      Object.keys(valoresGuardados).forEach((id) => { nodos[id].valorFijo = valoresGuardados[id]; });

      if (incompleto) {
        circuitoCorrecto = false;
        fondoNeutral();
        elResultado.textContent = "Circuito incompleto — sigue conectando hasta Salida.";
        elResultado.style.color = T.inkSoft;
      } else if (bloqueado(nivelActual + "-" + ejActual)) {
        circuitoCorrecto = false;
        elCanvas.style.background = T.redSoft;
        elResultado.textContent = "🔒 Este ejercicio quedó bloqueado por haberlo fallado. Llega hasta el último ejercicio del nivel para poder reiniciarlo y recuperarlo.";
        elResultado.style.color = T.red;
      } else if (todoCorrecto) {
        elCanvas.style.background = T.greenSoft;
        circuitoCorrecto = true;
        const clave = nivelActual + "-" + ejActual;
        const yaGanado = ganadosRef.current.has(clave);
        elResultado.textContent = yaGanado ? "✓ Correcto (ya ganaste los puntos de este ejercicio)." : "✓ ¡Correcto! +10 puntos.";
        elResultado.style.color = T.green;
        if (!yaGanado) {
          ganadosRef.current.add(clave);
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1), 10);
        } else {
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1) + " (repaso)", 0);
        }
      } else {
        circuitoCorrecto = false;
        elCanvas.style.background = T.redSoft;
        const clave = nivelActual + "-" + ejActual;
        const yaFallado = falladosRef.current.has(clave);
        const yaGanado = ganadosRef.current.has(clave);
        elResultado.textContent = (yaFallado || yaGanado) ? "✗ No coincide en todos los casos — borra una línea o compuerta y corrige." : "✗ No coincide en todos los casos — borra una línea o compuerta y corrige. -10 puntos, y podrías perder insignias si tu puntaje baja del umbral. Este ejercicio quedará bloqueado — llega hasta el final del nivel para recuperarlo.";
        elResultado.style.color = T.red;
        if (!yaFallado && !yaGanado) {
          falladosRef.current.add(clave);
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1) + " (fallo)", -10);
        }
      }
      dibujarConexiones();
    }

    Array.from(cont.querySelectorAll(".je-nivel-btn")).forEach((b) => {
      b.onclick = () => cambiarNivel(b.dataset.nivel);
    });
    cambiarNivel("Básico");

    return () => {
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
    };
  }, [mostrarIntro]);

  const INFO_COMPUERTAS = [
    { tipo: "AND", ecuacion: "C = a · b", explicacion: "Trabaja en serie con todas las entradas previas: la salida solo se activa si TODAS las entradas están activas a la vez.", tabla: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] },
    { tipo: "OR", ecuacion: "C = a + b", explicacion: "Trabaja en paralelo con todas las entradas previas: la salida se activa si CUALQUIERA de las entradas está activa.", tabla: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] },
    { tipo: "NOT", ecuacion: "b = ¬a", explicacion: "Actúa como un inversor de estado: invierte lo que recibe. Se puede combinar con OR/AND para lograr un objetivo.", tabla: [[0, 1], [1, 0]] },
    { tipo: "NAND", ecuacion: "C = ¬(a · b)", explicacion: "Es un AND seguido de un NOT: la salida se activa en todos los casos MENOS cuando ambas entradas están activas.", tabla: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] },
    { tipo: "NOR", ecuacion: "C = ¬(a + b)", explicacion: "Es un OR seguido de un NOT: la salida solo se activa cuando NINGUNA entrada está activa.", tabla: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]] },
  ];
  const svgGateIntro = (tipo) => {
    const s = T.ink;
    const dosEntradas = <><line x1="-10" y1="8" x2="2" y2="8" stroke={s} strokeWidth="2" /><line x1="-10" y1="32" x2="2" y2="32" stroke={s} strokeWidth="2" /></>;
    const unaEntrada = <line x1="-10" y1="20" x2="2" y2="20" stroke={s} strokeWidth="2" />;
    const shapes = {
      AND: <>{dosEntradas}<path d="M2,2 L20,2 A18,18 0 0 1 20,38 L2,38 Z" fill={T.graySoft} stroke={s} strokeWidth="2" /><line x1="38" y1="20" x2="48" y2="20" stroke={s} strokeWidth="2" /></>,
      NAND: <>{dosEntradas}<path d="M2,2 L18,2 A18,18 0 0 1 18,38 L2,38 Z" fill={T.graySoft} stroke={s} strokeWidth="2" /><circle cx="42" cy="20" r="4" fill={T.graySoft} stroke={s} strokeWidth="2" /><line x1="46" y1="20" x2="56" y2="20" stroke={s} strokeWidth="2" /></>,
      OR: <>{dosEntradas}<path d="M2,2 C16,2 16,2 24,20 C16,38 16,38 2,38 C10,28 10,12 2,2 Z" fill={T.graySoft} stroke={s} strokeWidth="2" strokeLinejoin="round" /><line x1="24" y1="20" x2="34" y2="20" stroke={s} strokeWidth="2" /></>,
      NOR: <>{dosEntradas}<path d="M2,2 C14,2 14,2 20,20 C14,38 14,38 2,38 C8,28 8,12 2,2 Z" fill={T.graySoft} stroke={s} strokeWidth="2" strokeLinejoin="round" /><circle cx="38" cy="20" r="4" fill={T.graySoft} stroke={s} strokeWidth="2" /><line x1="42" y1="20" x2="52" y2="20" stroke={s} strokeWidth="2" /></>,
      NOT: <>{unaEntrada}<path d="M2,2 L2,38 L32,20 Z" fill={T.graySoft} stroke={s} strokeWidth="2" strokeLinejoin="round" /><circle cx="38" cy="20" r="4" fill={T.graySoft} stroke={s} strokeWidth="2" /><line x1="42" y1="20" x2="52" y2="20" stroke={s} strokeWidth="2" /></>,
    };
    return <svg width="66" height="40" viewBox="-10 0 76 40" style={{ display: "block" }}>{shapes[tipo]}</svg>;
  };

  if (mostrarIntro) {
    const TEMA_INTRO_COMPUERTAS = {
      id: "intro",
      titulo: "Introducción a las Compuertas Lógicas",
      contenido: (
        <>
          <p>Las <strong>compuertas lógicas</strong> son los bloques básicos con los que se construye cualquier lógica de
          control: reciben una o varias entradas (0 = apagado, 1 = activo) y producen una salida según una regla fija. En los
          siguientes temas vas a repasar cada compuerta por separado (AND, OR, NOT, NAND, NOR), con su símbolo, ecuación y
          tabla de verdad.</p>
          <a href="https://www.youtube.com/watch?v=shcAMLESVrE" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
            ▶ Ver video explicativo — Compuertas Lógicas
          </a>
        </>
      ),
    };
    const TEMAS_COMPUERTAS = [TEMA_INTRO_COMPUERTAS, ...INFO_COMPUERTAS.map((g) => ({
      id: g.tipo,
      titulo: `Compuerta ${g.tipo}`,
      contenido: (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            {svgGateIntro(g.tipo)}
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{g.ecuacion}</div>
          </div>
          <p>{g.explicacion}</p>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, margin: "10px 0 6px" }}>Tabla de verdad</div>
          <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: T.gray }}>
                <th style={{ textAlign: "left", padding: "3px 10px 3px 0" }}>a</th>
                {g.tabla[0].length === 3 && <th style={{ textAlign: "left", padding: "3px 10px" }}>b</th>}
                <th style={{ textAlign: "left", padding: "3px 10px" }}>salida</th>
              </tr>
            </thead>
            <tbody>
              {g.tabla.map((fila, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                  {fila.map((v, j) => <td key={j} style={{ padding: "3px 10px 3px 0", fontWeight: j === fila.length - 1 ? 700 : 400 }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    }))];
    return <GuiaPorTemas temas={TEMAS_COMPUERTAS} onContinuar={() => setMostrarIntro(false)} tituloModulo="cómo funcionan las compuertas lógicas" />;
  }

  return (
    <Card>
      <div ref={contenedorRef}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          {["Básico", "Intermedio", "Avanzado"].map((niv) => (
            <button key={niv} className="je-nivel-btn" data-nivel={niv} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>{niv}</button>
          ))}
          {esAdmin && <div style={{ marginLeft: "auto" }}><BotonReiniciarModulo onReiniciar={reiniciarModulo} /></div>}
        </div>
        {ejActualExpuestoRef.current === nivelLongitudRef.current - 1 && hayBloqueadosEnNivelActual() && (
          <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: T.amber, fontWeight: 600 }}>Llegaste al final del nivel — tienes ejercicios pendientes de recuperar. Al reiniciar, tus puntos ya ganados se mantienen; solo sumarán los que recuperes.</span>
            <Btn small variant="accent" onClick={reiniciarNivelTecnico}>🔄 Reiniciar nivel para recuperar</Btn>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="je-titulo" style={{ fontSize: 15, fontWeight: 700 }}>Ejercicio #1</div>
            <div className="je-frase" style={{ fontSize: 13, color: T.inkSoft }}></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="je-prev" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>← Anterior</button>
            <button className="je-next" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Siguiente →</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: 10, background: T.graySoft, borderRadius: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.gray, marginRight: 4 }}>Arrastra al lienzo:</span>
          <div className="je-palette" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}></div>
          <span style={{ fontSize: 12, color: T.gray, marginLeft: 12 }}>Clic en la × para borrar una compuerta, o en una línea para borrarla.</span>
          <button className="je-limpiar" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Limpiar lienzo</button>
          <button onClick={() => setMostrarIntro(true)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Ver la guía otra vez</button>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 12, WebkitOverflowScrolling: "touch" }}>
          <div className="je-canvas" style={{ position: "relative", height: 400, minWidth: 650, background: T.graySoft, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.line}`, transition: "background 0.2s" }}>
            <svg className="je-wires" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}></svg>
            <style>{`@keyframes marchHormigas { to { stroke-dashoffset: -20; } } .je-corriente { animation: marchHormigas 0.6s linear infinite; }`}</style>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: T.gray, marginTop: 4 }}>💡 En celular, desliza el lienzo hacia los lados para ver el circuito completo.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <span className="je-resultado" style={{ fontSize: 14 }}></span>
        </div>
      </div>
    </Card>
  );
}

// Juego de Lógica en Escalera: mismo motor que Compuertas Lógicas —
// arrastras contactos (OR/AND/NOT dibujados al estilo de riel: rayitas
// ⊣⊢, NOT con raya diagonal) al lienzo y los conectas cableando a mano,
// con verificación automática contra todas las combinaciones posibles.
function JuegoLogicaEscalera({ onGanarPuntos, esAdmin, onReiniciar }) {
  const contenedorRef = React.useRef(null);
  const ganadosRef = React.useRef(new Set());
  const falladosRef = React.useRef(new Set());
  const cargarEjercicioRef = React.useRef(null);
  const ejActualExpuestoRef = React.useRef(0);
  const nivelActualExpuestoRef = React.useRef("Básico");
  const nivelLongitudRef = React.useRef(0);
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [, forceRender] = useState(0);
  const bloqueado = (clave) => falladosRef.current.has(clave) && !ganadosRef.current.has(clave);
  const reiniciarModulo = (borrarRanking) => {
    falladosRef.current.clear();
    if (borrarRanking) ganadosRef.current.clear();
    onReiniciar && onReiniciar(borrarRanking);
    cargarEjercicioRef.current && cargarEjercicioRef.current(ejActualExpuestoRef.current);
    forceRender((n) => n + 1);
  };
  const reiniciarNivelTecnico = () => {
    const nv = nivelActualExpuestoRef.current;
    Array.from(falladosRef.current).forEach((clave) => { if (clave.startsWith(nv + "-")) falladosRef.current.delete(clave); });
    cargarEjercicioRef.current && cargarEjercicioRef.current(0);
    forceRender((n) => n + 1);
  };
  const hayBloqueadosEnNivelActual = () => {
    const nv = nivelActualExpuestoRef.current;
    for (let i = 0; i < nivelLongitudRef.current; i++) { if (bloqueado(nv + "-" + i)) return true; }
    return false;
  };

  useEffect(() => {
    if (mostrarIntro) return;
    const cont = contenedorRef.current;
    if (!cont) return;

    const GATES_JUEGO = {
      AND: { inputs: 2, fn: (a, b) => (a && b) },
      OR: { inputs: 2, fn: (a, b) => (a || b) },
      NOT: { inputs: 1, fn: (a) => !a },
    };
    const NIVELES_JUEGO = {
      "Básico": [
        { frase: '"Activa la Notificación Audible si hay Sensor de Humo o Estación Manual."', terminales: ["Sensor de Humo", "Estación Manual"], evaluar: (v) => v["Sensor de Humo"] || v["Estación Manual"] },
        { frase: '"Envía al Extractor de Humo si hay Sensor de Humo y Sensor de Temperatura."', terminales: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => v["Sensor de Humo"] && v["Sensor de Temperatura"] },
        { frase: '"El Inyector de Aire debe estar apagado mientras haya Sensor de Humo activo."', terminales: ["Sensor de Humo"], evaluar: (v) => !v["Sensor de Humo"] },
        { frase: '"Activa el Sistema de Espuma si hay Sensor de Flama y Sensor de Flujo, y no hay Falla del Sistema."', terminales: ["Sensor de Flama", "Sensor de Flujo", "Falla del Sistema"], evaluar: (v) => v["Sensor de Flama"] && v["Sensor de Flujo"] && !v["Falla del Sistema"] },
        { frase: '"El Sistema de Diluvio solo se habilita cuando no hay Sensor de Gas LPG ni Falla del Sistema activos."', terminales: ["Sensor de Gas LPG", "Falla del Sistema"], evaluar: (v) => !(v["Sensor de Gas LPG"] || v["Falla del Sistema"]) },
      ],
      "Intermedio": [
        { frase: '"Activa Notificación Visible si hay Sensor de Flama o Sensor de Temperatura, y no hay Falla del Sistema."', terminales: ["Sensor de Flama", "Sensor de Temperatura", "Falla del Sistema"], evaluar: (v) => (v["Sensor de Flama"] || v["Sensor de Temperatura"]) && !v["Falla del Sistema"] },
        { frase: '"Abre las Puertas si hay Sensor de Gas LPG o se activa la Estación Manual, y no hay Falla del Sistema."', terminales: ["Sensor de Gas LPG", "Estación Manual", "Falla del Sistema"], evaluar: (v) => (v["Sensor de Gas LPG"] || v["Estación Manual"]) && !v["Falla del Sistema"] },
        { frase: '"Control de Elevadores baja al vestíbulo si hay Estación Manual y no hay Falla del Sistema."', terminales: ["Estación Manual", "Falla del Sistema"], evaluar: (v) => v["Estación Manual"] && !v["Falla del Sistema"] },
        { frase: '"El Inyector de Aire funciona solo si no hay Sensor de Humo ni Sensor de Temperatura activos."', terminales: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => !(v["Sensor de Humo"] || v["Sensor de Temperatura"]) },
      ],
      "Avanzado": [
        { frase: 'Activa el Sistema de Diluvio cuando cualquiera de los sensores de detección (Humo, Flama o Estación Manual) se dispare, siempre que además haya flujo de agua confirmado por el Sensor de Flujo.', terminales: ["Sensor de Humo", "Sensor de Flama", "Estación Manual", "Sensor de Flujo"], evaluar: (v) => (v["Sensor de Humo"] || v["Sensor de Flama"] || v["Estación Manual"]) && v["Sensor de Flujo"] },
        { frase: 'Activa la Notificación Audible si los tres sensores (Humo, Temperatura y Monóxido) detectan la condición al mismo tiempo, o si alguien activa la Estación Manual.', terminales: ["Sensor de Humo", "Sensor de Temperatura", "Sensor de Monóxido", "Estación Manual"], evaluar: (v) => (v["Sensor de Humo"] && v["Sensor de Temperatura"] && v["Sensor de Monóxido"]) || v["Estación Manual"] },
      ],
    };
    let nivelActual = "Básico";
    let EJERCICIOS_JUEGO = NIVELES_JUEGO[nivelActual];

    // Contacto de riel: dos rayitas verticales (⊣⊢); NOT agrega la raya
    // diagonal cruzada — el mismo estilo que ya usan las guías educativas.
    function svgGate(tipo) {
      const s = "currentColor";
      const contacto = (cx, cy, negado) => `
        <line x1="${cx - 3}" y1="${cy - 8}" x2="${cx - 3}" y2="${cy + 8}" stroke="${s}" stroke-width="2"/>
        <line x1="${cx + 3}" y1="${cy - 8}" x2="${cx + 3}" y2="${cy + 8}" stroke="${s}" stroke-width="2"/>
        ${negado ? `<line x1="${cx - 8}" y1="${cy + 10}" x2="${cx + 8}" y2="${cy - 10}" stroke="${s}" stroke-width="2"/>` : ""}
      `;
      const shapes = {
        OR: `
          <line x1="-10" y1="8" x2="14" y2="8" stroke="${s}" stroke-width="2"/>${contacto(17, 8, false)}<line x1="20" y1="8" x2="38" y2="8" stroke="${s}" stroke-width="2"/>
          <line x1="-10" y1="32" x2="14" y2="32" stroke="${s}" stroke-width="2"/>${contacto(17, 32, false)}<line x1="20" y1="32" x2="38" y2="32" stroke="${s}" stroke-width="2"/>
          <line x1="38" y1="8" x2="38" y2="32" stroke="${s}" stroke-width="2"/>
          <line x1="38" y1="20" x2="56" y2="20" stroke="${s}" stroke-width="2"/>
        `,
        AND: `
          <line x1="-10" y1="8" x2="6" y2="8" stroke="${s}" stroke-width="2"/><line x1="6" y1="8" x2="6" y2="20" stroke="${s}" stroke-width="2"/>
          <line x1="6" y1="20" x2="14" y2="20" stroke="${s}" stroke-width="2"/>${contacto(17, 20, false)}<line x1="20" y1="20" x2="34" y2="20" stroke="${s}" stroke-width="2"/>${contacto(37, 20, false)}<line x1="40" y1="20" x2="56" y2="20" stroke="${s}" stroke-width="2"/>
          <line x1="-10" y1="32" x2="30" y2="32" stroke="${s}" stroke-width="2"/><line x1="30" y1="32" x2="30" y2="23" stroke="${s}" stroke-width="2"/>
        `,
        NOT: `
          <line x1="-10" y1="20" x2="14" y2="20" stroke="${s}" stroke-width="2"/>${contacto(17, 20, true)}<line x1="20" y1="20" x2="56" y2="20" stroke="${s}" stroke-width="2"/>
        `,
      };
      return `<svg width="66" height="40" viewBox="-10 0 76 40" style="display:block; color:${T.ink};">${shapes[tipo]}</svg>`;
    }

    let ejActual = 0, nodos = {}, conexiones = [], nodoIdSeq = 1, conexionIdSeq = 1, arrastreCable = null, circuitoCorrecto = false;

    const elTitulo = cont.querySelector(".je-titulo");
    const elFrase = cont.querySelector(".je-frase");
    const elCanvas = cont.querySelector(".je-canvas");
    const elSvg = cont.querySelector(".je-wires");
    const elResultado = cont.querySelector(".je-resultado");
    const elPalette = cont.querySelector(".je-palette");

    function fondoNeutral() { elCanvas.style.background = T.graySoft; }

    function limpiarLienzo() {
      nodos = {}; conexiones = []; arrastreCable = null;
      Array.from(elCanvas.querySelectorAll(".je-nodo")).forEach((n) => n.remove());
      elResultado.textContent = "";
      fondoNeutral();
      dibujarConexiones();
    }

    function cargarEjercicio(i) {
      if (EJERCICIOS_JUEGO.length === 0) {
        ejActual = 0;
        elTitulo.textContent = nivelActual + " — sin ejercicios todavía";
        elFrase.textContent = "Este nivel se irá llenando pronto.";
        limpiarLienzo();
        return;
      }
      ejActual = (i + EJERCICIOS_JUEGO.length) % EJERCICIOS_JUEGO.length;
      ejActualExpuestoRef.current = ejActual;
      const ej = EJERCICIOS_JUEGO[ejActual];
      elTitulo.textContent = nivelActual + " — Ejercicio #" + (ejActual + 1);
      elFrase.textContent = ej.frase;
      limpiarLienzo();
      const claveEj = nivelActual + "-" + ejActual;
      if (bloqueado(claveEj)) {
        elCanvas.innerHTML = `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:20px;"><div style="color:${T.red}; font-size:13px; font-weight:600; max-width:340px;">🔒 Bloqueado — fallaste este ejercicio. Llega hasta el último ejercicio del nivel para poder reiniciarlo y recuperarlo.</div></div>`;
        elCanvas.style.background = T.redSoft;
        elPalette.style.opacity = "0.4";
        elPalette.style.pointerEvents = "none";
        forceRender((n) => n + 1);
        return;
      }
      elPalette.style.opacity = "1";
      elPalette.style.pointerEvents = "auto";
      ej.terminales.forEach((nombre, i2) => crearNodo("term", nombre, 10, 16 + i2 * 72));
      crearNodo("salida", "Salida", 560, 160);
      forceRender((n) => n + 1);
    }
    cargarEjercicioRef.current = cargarEjercicio;

    function cambiarNivel(nivel) {
      nivelActual = nivel;
      EJERCICIOS_JUEGO = NIVELES_JUEGO[nivelActual];
      nivelActualExpuestoRef.current = nivel;
      nivelLongitudRef.current = EJERCICIOS_JUEGO.length;
      Array.from(cont.querySelectorAll(".je-nivel-btn")).forEach((b) => {
        const activo = b.dataset.nivel === nivel;
        b.style.background = activo ? T.accent : "transparent";
        b.style.color = activo ? "#fff" : T.steel;
        b.style.borderColor = activo ? T.accent : T.line;
      });
      cargarEjercicio(0);
    }

    function borrarNodo(id) {
      conexiones = conexiones.filter((c) => c.deNodo !== id && c.aNodo !== id);
      const el = elCanvas.querySelector('.je-nodo[data-id="' + id + '"]');
      if (el) el.remove();
      delete nodos[id];
      dibujarConexiones();
      actualizarEstado();
    }

    function crearNodo(tipo, label, x, y) {
      const id = "n" + (nodoIdSeq++);
      const inputs = tipo === "gate" ? GATES_JUEGO[label].inputs : (tipo === "salida" ? 1 : 0);
      const el = document.createElement("div");
      el.className = "je-nodo";
      el.dataset.id = id;
      el.style.cssText = "position:absolute; cursor:grab; user-select:none;";
      el.style.left = x + "px"; el.style.top = y + "px";

      if (tipo === "gate") {
        el.innerHTML = svgGate(label) +
          `<button class="je-btn-borrar" style="position:absolute; top:-8px; right:-4px; width:18px; height:18px; padding:0; border-radius:50%; background:${T.red}; color:#fff; border:none; font-size:11px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>`;
      } else if (tipo === "term") {
        el.innerHTML = `<div style="padding:8px 12px; background:${T.blueSoft}; color:${T.blue}; border-radius:8px; font-size:12px; font-weight:700; min-width:50px; text-align:center;">${label}</div>`;
      } else {
        el.innerHTML = `<div style="padding:8px 12px; background:#fff; border:1px solid ${T.line}; border-radius:8px; font-size:12px; font-weight:700; min-width:50px; text-align:center;">Salida</div>`;
      }
      elCanvas.appendChild(el);
      nodos[id] = { tipo, label, x, y, valorFijo: tipo === "term" ? false : null };

      if (inputs >= 1) crearPuerto(el, id, "in0", "in", 0, inputs, tipo);
      if (inputs >= 2) crearPuerto(el, id, "in1", "in", 1, inputs, tipo);
      if (tipo === "gate" || tipo === "term") crearPuerto(el, id, "out", "out", 0, 1, tipo);

      if (tipo === "term") {
        el.onclick = (e) => {
          if (e.target.classList.contains("je-puerto")) return;
          nodos[id].valorFijo = !nodos[id].valorFijo;
          const box = el.querySelector("div");
          box.style.background = nodos[id].valorFijo ? T.greenSoft : T.blueSoft;
          box.style.color = nodos[id].valorFijo ? T.green : T.blue;
        };
      }
      if (tipo === "gate") {
        const btnBorrar = el.querySelector(".je-btn-borrar");
        btnBorrar.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnBorrar.addEventListener("click", (e) => { e.stopPropagation(); borrarNodo(id); });
      }
      hacerArrastrable(el, id);
      return id;
    }

    function altoNodo(tipo) { return tipo === "gate" ? 40 : 34; }

    function crearPuerto(nodoEl, nodoId, puertoId, dir, idx, total, tipo) {
      const dot = document.createElement("div");
      dot.className = "je-puerto";
      dot.dataset.nodo = nodoId; dot.dataset.puerto = puertoId; dot.dataset.dir = dir;
      const h = altoNodo(tipo);
      const offsetY = total > 1 ? (idx === 0 ? h * 0.28 : h * 0.72) : h / 2;
      dot.style.cssText = `position:absolute; width:11px; height:11px; border-radius:50%; background:${T.steel}; cursor:crosshair; top:${offsetY}px; transform:translate(-50%,-50%); z-index:2;`;
      dot.style.left = dir === "in" ? "0px" : (tipo === "gate" ? "62px" : "100%");
      nodoEl.appendChild(dot);

      dot.addEventListener("pointerdown", (e) => {
        if (dir !== "out") return;
        e.stopPropagation();
        const p1 = centroPuerto(nodoId, puertoId);
        arrastreCable = { deNodo: nodoId, dePuerto: puertoId, x: p1.x, y: p1.y, curX: e.clientX, curY: e.clientY };
        dibujarConexiones();
      });
      dot.addEventListener("pointerup", (e) => {
        if (dir !== "in" || !arrastreCable) return;
        e.stopPropagation();
        conexiones = conexiones.filter((c) => !(c.aNodo === nodoId && c.aPuerto === puertoId));
        conexiones.push({ id: "c" + (conexionIdSeq++), deNodo: arrastreCable.deNodo, dePuerto: arrastreCable.dePuerto, aNodo: nodoId, aPuerto: puertoId });
        arrastreCable = null;
        dibujarConexiones();
        actualizarEstado();
      });
    }

    function onDocPointerMove(e) {
      if (!arrastreCable) return;
      const cr = elCanvas.getBoundingClientRect();
      arrastreCable.curX = e.clientX - cr.left;
      arrastreCable.curY = e.clientY - cr.top;
      dibujarConexiones();
    }
    function onDocPointerUp() {
      if (arrastreCable) { arrastreCable = null; dibujarConexiones(); }
    }
    document.addEventListener("pointermove", onDocPointerMove);
    document.addEventListener("pointerup", onDocPointerUp);

    function hacerArrastrable(el, id) {
      let arrastrando = false, offX = 0, offY = 0;
      el.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("je-puerto") || e.target.classList.contains("je-btn-borrar")) return;
        arrastrando = true;
        el.setPointerCapture(e.pointerId);
        const rect = el.getBoundingClientRect();
        offX = e.clientX - rect.left; offY = e.clientY - rect.top;
      });
      el.addEventListener("pointermove", (e) => {
        if (!arrastrando) return;
        const canvasRect = elCanvas.getBoundingClientRect();
        let x = e.clientX - canvasRect.left - offX;
        let y = e.clientY - canvasRect.top - offY;
        x = Math.max(0, Math.min(x, canvasRect.width - 60));
        y = Math.max(0, Math.min(y, canvasRect.height - 40));
        el.style.left = x + "px"; el.style.top = y + "px";
        nodos[id].x = x; nodos[id].y = y;
        dibujarConexiones();
      });
      el.addEventListener("pointerup", () => { arrastrando = false; });
    }

    function centroPuerto(nodoId, puertoId) {
      const nodoEl = elCanvas.querySelector('.je-nodo[data-id="' + nodoId + '"]');
      const puertoEl = nodoEl.querySelector('.je-puerto[data-puerto="' + puertoId + '"]');
      const r = puertoEl.getBoundingClientRect();
      const cr = elCanvas.getBoundingClientRect();
      return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
    }

    function curva(p1, p2) {
      const midX = (p1.x + p2.x) / 2;
      return `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
    }

    function dibujarConexiones() {
      elSvg.innerHTML = "";
      conexiones.forEach((c) => {
        if (!nodos[c.deNodo] || !nodos[c.aNodo]) return;
        const p1 = centroPuerto(c.deNodo, c.dePuerto);
        const p2 = centroPuerto(c.aNodo, c.aPuerto);
        const grupo = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
        hit.setAttribute("d", curva(p1, p2));
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "14");
        hit.setAttribute("fill", "none");
        hit.style.cursor = "pointer";
        hit.style.pointerEvents = "stroke";
        const visible = document.createElementNS("http://www.w3.org/2000/svg", "path");
        visible.setAttribute("d", curva(p1, p2));
        if (circuitoCorrecto) {
          visible.setAttribute("stroke", T.green);
          visible.setAttribute("stroke-width", "2.5");
          visible.setAttribute("stroke-dasharray", "6 4");
          visible.setAttribute("class", "je-corriente");
        } else {
          visible.setAttribute("stroke", T.inkSoft);
          visible.setAttribute("stroke-width", "2");
        }
        visible.setAttribute("fill", "none");
        visible.style.pointerEvents = "none";
        hit.addEventListener("click", () => {
          conexiones = conexiones.filter((x) => x.id !== c.id);
          dibujarConexiones();
          actualizarEstado();
        });
        hit.addEventListener("mouseenter", () => { if (!circuitoCorrecto) visible.setAttribute("stroke", T.red); });
        hit.addEventListener("mouseleave", () => { if (!circuitoCorrecto) visible.setAttribute("stroke", T.inkSoft); });
        grupo.appendChild(hit); grupo.appendChild(visible);
        elSvg.appendChild(grupo);
      });
      if (arrastreCable) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", curva({ x: arrastreCable.x, y: arrastreCable.y }, { x: arrastreCable.curX, y: arrastreCable.curY }));
        path.setAttribute("stroke", T.blue);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-dasharray", "4 3");
        path.setAttribute("fill", "none");
        elSvg.appendChild(path);
      }
    }

    elPalette.innerHTML = "";
    Object.keys(GATES_JUEGO).forEach((key) => {
      const btn = document.createElement("button");
      btn.style.cssText = "padding:4px 10px; display:flex; align-items:center; gap:6px; border:1px solid " + T.line + "; border-radius:8px; background:#fff; cursor:pointer;";
      btn.innerHTML = svgGate(key) + `<span style="font-size:11px; font-weight:600;">${key}</span>`;
      btn.onclick = () => { crearNodo("gate", key, 200 + Math.random() * 140, 30 + Math.random() * 220); actualizarEstado(); };
      elPalette.appendChild(btn);
    });

    cont.querySelector(".je-limpiar").onclick = () => cargarEjercicio(ejActual);
    cont.querySelector(".je-prev").onclick = () => cargarEjercicio(ejActual - 1);
    cont.querySelector(".je-next").onclick = () => cargarEjercicio(ejActual + 1);

    function evaluarNodo(nodoId, cache) {
      if (cache.has(nodoId)) return cache.get(nodoId);
      const n = nodos[nodoId];
      if (n.tipo === "term") { cache.set(nodoId, n.valorFijo); return n.valorFijo; }
      const entradas = conexiones.filter((c) => c.aNodo === nodoId).sort((a, b) => a.aPuerto.localeCompare(b.aPuerto));
      if (n.tipo === "salida") {
        if (entradas.length === 0) return null;
        return evaluarNodo(entradas[0].deNodo, cache);
      }
      const gate = GATES_JUEGO[n.label];
      if (entradas.length < gate.inputs) return null;
      const valores = entradas.slice(0, gate.inputs).map((e) => evaluarNodo(e.deNodo, cache));
      if (valores.some((v) => v === null)) return null;
      const resultado = gate.fn(...valores);
      cache.set(nodoId, resultado);
      return resultado;
    }

    function actualizarEstado() {
      const ej = EJERCICIOS_JUEGO[ejActual];
      const salidaId = Object.keys(nodos).find((id) => nodos[id].tipo === "salida");
      const n = ej.terminales.length;
      const combinaciones = [];
      for (let i = 0; i < (1 << n); i++) {
        const v = {};
        ej.terminales.forEach((t, idx) => v[t] = !!((i >> idx) & 1));
        combinaciones.push(v);
      }
      const valoresGuardados = {};
      Object.keys(nodos).forEach((id) => { if (nodos[id].tipo === "term") valoresGuardados[id] = nodos[id].valorFijo; });

      let incompleto = false, todoCorrecto = true;
      for (const combo of combinaciones) {
        Object.keys(nodos).forEach((id) => { if (nodos[id].tipo === "term") nodos[id].valorFijo = combo[nodos[id].label]; });
        const salida = evaluarNodo(salidaId, new Map());
        if (salida === null) { incompleto = true; break; }
        if (!!salida !== !!ej.evaluar(combo)) { todoCorrecto = false; break; }
      }
      Object.keys(valoresGuardados).forEach((id) => { nodos[id].valorFijo = valoresGuardados[id]; });

      if (incompleto) {
        circuitoCorrecto = false;
        fondoNeutral();
        elResultado.textContent = "Circuito incompleto — sigue conectando hasta Salida.";
        elResultado.style.color = T.inkSoft;
      } else if (bloqueado(nivelActual + "-" + ejActual)) {
        circuitoCorrecto = false;
        elCanvas.style.background = T.redSoft;
        elResultado.textContent = "🔒 Este ejercicio quedó bloqueado por haberlo fallado. Llega hasta el último ejercicio del nivel para poder reiniciarlo y recuperarlo.";
        elResultado.style.color = T.red;
      } else if (todoCorrecto) {
        elCanvas.style.background = T.greenSoft;
        circuitoCorrecto = true;
        const clave = nivelActual + "-" + ejActual;
        const yaGanado = ganadosRef.current.has(clave);
        elResultado.textContent = yaGanado ? "✓ Correcto (ya ganaste los puntos de este ejercicio)." : "✓ ¡Correcto! +10 puntos.";
        elResultado.style.color = T.green;
        if (!yaGanado) {
          ganadosRef.current.add(clave);
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1), 10);
        } else {
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1) + " (repaso)", 0);
        }
      } else {
        circuitoCorrecto = false;
        elCanvas.style.background = T.redSoft;
        const clave = nivelActual + "-" + ejActual;
        const yaFallado = falladosRef.current.has(clave);
        const yaGanado = ganadosRef.current.has(clave);
        elResultado.textContent = (yaFallado || yaGanado) ? "✗ No coincide en todos los casos — borra una línea o contacto y corrige." : "✗ No coincide en todos los casos — borra una línea o contacto y corrige. -10 puntos, y podrías perder insignias si tu puntaje baja del umbral. Este ejercicio quedará bloqueado — llega hasta el final del nivel para recuperarlo.";
        elResultado.style.color = T.red;
        if (!yaFallado && !yaGanado) {
          falladosRef.current.add(clave);
          onGanarPuntos && onGanarPuntos(nivelActual + " — Ejercicio #" + (ejActual + 1) + " (fallo)", -10);
        }
      }
      dibujarConexiones();
    }

    Array.from(cont.querySelectorAll(".je-nivel-btn")).forEach((b) => {
      b.onclick = () => cambiarNivel(b.dataset.nivel);
    });
    cambiarNivel("Básico");

    return () => {
      document.removeEventListener("pointermove", onDocPointerMove);
      document.removeEventListener("pointerup", onDocPointerUp);
    };
  }, [mostrarIntro]);

  const INFO_CONTACTOS = [
    { tipo: "AND", ecuacion: "Serie — C = a · b", explicacion: "Dos (o más) contactos uno después del otro, en la misma línea: la corriente solo llega a la salida si TODOS los contactos están cerrados (activos) a la vez.", tabla: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] },
    { tipo: "OR", ecuacion: "Paralelo — C = a + b", explicacion: "Dos (o más) contactos en ramas separadas que se unen antes de la salida: con que UNO solo esté cerrado (activo), ya llega corriente a la salida.", tabla: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] },
    { tipo: "NOT", ecuacion: "Contacto negado — b = ¬a", explicacion: "Un contacto con la raya diagonal cruzada: al revés de lo normal, deja pasar corriente cuando la condición NO se cumple.", tabla: [[0, 1], [1, 0]] },
  ];
  const svgGateIntro = (tipo) => {
    const s = T.ink;
    const contacto = (cx, cy, negado) => (
      <>
        <line x1={cx - 3} y1={cy - 8} x2={cx - 3} y2={cy + 8} stroke={s} strokeWidth="2" />
        <line x1={cx + 3} y1={cy - 8} x2={cx + 3} y2={cy + 8} stroke={s} strokeWidth="2" />
        {negado && <line x1={cx - 8} y1={cy + 10} x2={cx + 8} y2={cy - 10} stroke={s} strokeWidth="2" />}
      </>
    );
    const shapes = {
      OR: (
        <>
          <line x1="-10" y1="8" x2="14" y2="8" stroke={s} strokeWidth="2" />{contacto(17, 8, false)}<line x1="20" y1="8" x2="38" y2="8" stroke={s} strokeWidth="2" />
          <line x1="-10" y1="32" x2="14" y2="32" stroke={s} strokeWidth="2" />{contacto(17, 32, false)}<line x1="20" y1="32" x2="38" y2="32" stroke={s} strokeWidth="2" />
          <line x1="38" y1="8" x2="38" y2="32" stroke={s} strokeWidth="2" />
          <line x1="38" y1="20" x2="56" y2="20" stroke={s} strokeWidth="2" />
        </>
      ),
      AND: (
        <>
          <line x1="-10" y1="8" x2="6" y2="8" stroke={s} strokeWidth="2" /><line x1="6" y1="8" x2="6" y2="20" stroke={s} strokeWidth="2" />
          <line x1="6" y1="20" x2="14" y2="20" stroke={s} strokeWidth="2" />{contacto(17, 20, false)}<line x1="20" y1="20" x2="34" y2="20" stroke={s} strokeWidth="2" />{contacto(37, 20, false)}<line x1="40" y1="20" x2="56" y2="20" stroke={s} strokeWidth="2" />
          <line x1="-10" y1="32" x2="30" y2="32" stroke={s} strokeWidth="2" /><line x1="30" y1="32" x2="30" y2="23" stroke={s} strokeWidth="2" />
        </>
      ),
      NOT: (
        <>
          <line x1="-10" y1="20" x2="14" y2="20" stroke={s} strokeWidth="2" />{contacto(17, 20, true)}<line x1="20" y1="20" x2="56" y2="20" stroke={s} strokeWidth="2" />
        </>
      ),
    };
    return <svg width="66" height="40" viewBox="-10 0 76 40" style={{ display: "block" }}>{shapes[tipo]}</svg>;
  };

  if (mostrarIntro) {
    const TEMA_INTRO_ESCALERA = {
      id: "intro",
      titulo: "Introducción a la Lógica en Escalera",
      contenido: (
        <p>Cada contacto (⊣⊢) representa una condición. En los siguientes temas vas a repasar los 3 tipos de contacto que
        vas a usar para armar tus circuitos: en <strong>serie</strong> (AND), en <strong>paralelo</strong> (OR), y
        <strong> negado</strong> (NOT). Arrastras el contacto que necesitas al lienzo y lo conectas cableando a mano —
        exactamente igual que en Compuertas Lógicas, pero dibujado al estilo de riel eléctrico.</p>
      ),
    };
    const TEMAS_ESCALERA = [TEMA_INTRO_ESCALERA, ...INFO_CONTACTOS.map((g) => ({
      id: g.tipo,
      titulo: `Contacto ${g.tipo}`,
      contenido: (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            {svgGateIntro(g.tipo)}
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{g.ecuacion}</div>
          </div>
          <p>{g.explicacion}</p>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, margin: "10px 0 6px" }}>Tabla de verdad</div>
          <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: T.gray }}>
                <th style={{ textAlign: "left", padding: "3px 10px 3px 0" }}>a</th>
                {g.tabla[0].length === 3 && <th style={{ textAlign: "left", padding: "3px 10px" }}>b</th>}
                <th style={{ textAlign: "left", padding: "3px 10px" }}>salida</th>
              </tr>
            </thead>
            <tbody>
              {g.tabla.map((fila, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                  {fila.map((v, j) => <td key={j} style={{ padding: "3px 10px 3px 0", fontWeight: j === fila.length - 1 ? 700 : 400 }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ),
    }))];
    return <GuiaPorTemas temas={TEMAS_ESCALERA} onContinuar={() => setMostrarIntro(false)} tituloModulo="cómo funciona la lógica en escalera" />;
  }

  return (
    <Card>
      <div ref={contenedorRef}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          {["Básico", "Intermedio", "Avanzado"].map((niv) => (
            <button key={niv} className="je-nivel-btn" data-nivel={niv} style={{ padding: "6px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>{niv}</button>
          ))}
          {esAdmin && <div style={{ marginLeft: "auto" }}><BotonReiniciarModulo onReiniciar={reiniciarModulo} /></div>}
        </div>
        {ejActualExpuestoRef.current === nivelLongitudRef.current - 1 && hayBloqueadosEnNivelActual() && (
          <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: T.amber, fontWeight: 600 }}>Llegaste al final del nivel — tienes ejercicios pendientes de recuperar. Al reiniciar, tus puntos ya ganados se mantienen; solo sumarán los que recuperes.</span>
            <Btn small variant="accent" onClick={reiniciarNivelTecnico}>🔄 Reiniciar nivel para recuperar</Btn>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="je-titulo" style={{ fontSize: 15, fontWeight: 700 }}>Ejercicio #1</div>
            <div className="je-frase" style={{ fontSize: 13, color: T.inkSoft }}></div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="je-prev" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>← Anterior</button>
            <button className="je-next" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Siguiente →</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: 10, background: T.graySoft, borderRadius: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.gray, marginRight: 4 }}>Arrastra al lienzo:</span>
          <div className="je-palette" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}></div>
          <span style={{ fontSize: 12, color: T.gray, marginLeft: 12 }}>Clic en la × para borrar un contacto, o en una línea para borrarla.</span>
          <button className="je-limpiar" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Limpiar lienzo</button>
          <button onClick={() => setMostrarIntro(true)} style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "transparent", color: T.steel, border: `1px solid ${T.line}`, cursor: "pointer" }}>Ver la guía otra vez</button>
        </div>
        <div style={{ overflowX: "auto", borderRadius: 12, WebkitOverflowScrolling: "touch" }}>
          <div className="je-canvas" style={{ position: "relative", height: 400, minWidth: 650, background: T.graySoft, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.line}`, transition: "background 0.2s" }}>
            <svg className="je-wires" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}></svg>
            <style>{`@keyframes marchHormigas { to { stroke-dashoffset: -20; } } .je-corriente { animation: marchHormigas 0.6s linear infinite; }`}</style>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: T.gray, marginTop: 4 }}>💡 En celular, desliza el lienzo hacia los lados para ver el circuito completo.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <span className="je-resultado" style={{ fontSize: 14 }}></span>
        </div>
      </div>
    </Card>
  );
}


// Juego de Tablas de la Verdad: se da una fórmula lógica (con sensores y
// salidas de sistemas de alarma contra incendio) y hay que llenar TODA la
// tabla de verdad — una fila por cada combinación posible de entradas —
// marcando 0 o 1 en la columna de salida.
function JuegoTablasVerdad({ onGanarPuntos, esAdmin, onReiniciar }) {
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [nivel, setNivel] = useState("Básico");
  const [ejActual, setEjActual] = useState(0);
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);
  const ganadosRef = React.useRef(new Set());
  const falladosRef = React.useRef(new Set());
  const [, forceRender] = useState(0);
  const bloqueado = (clave) => falladosRef.current.has(clave) && !ganadosRef.current.has(clave);
  const reiniciarModulo = (borrarRanking) => {
    falladosRef.current.clear();
    if (borrarRanking) ganadosRef.current.clear();
    onReiniciar && onReiniciar(borrarRanking);
    setResultado(null);
    forceRender((n) => n + 1);
  };
  // Reinicio propio del técnico: solo desbloquea las preguntas falladas
  // DE ESTE NIVEL para poder recuperarlas — los puntos ya ganados en la
  // primera ronda se mantienen y no se vuelven a sumar.
  const reiniciarNivelTecnico = (nv) => {
    Array.from(falladosRef.current).forEach((clave) => { if (clave.startsWith(nv + "-")) falladosRef.current.delete(clave); });
    setEjActual(0);
    setRespuestas({});
    setResultado(null);
    forceRender((n) => n + 1);
  };
  const hayBloqueadosEnNivel = (nv, cantidad) => {
    for (let i = 0; i < cantidad; i++) { if (bloqueado(nv + "-" + i)) return true; }
    return false;
  };

  const NIVELES_TABLA = {
    "Básico": [
      { frase: "Notificación Audible = Sensor de Humo OR Estación Manual", vars: ["Sensor de Humo", "Estación Manual"], evaluar: (v) => v[0] || v[1] },
      { frase: "Extractor de Humo = Sensor de Humo AND Sensor de Temperatura", vars: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => v[0] && v[1] },
      { frase: "Inyector de Aire = NOT Sensor de Humo", vars: ["Sensor de Humo"], evaluar: (v) => !v[0] },
      { frase: "Recall de Elevadores = Sensor de Humo NAND Sensor de Temperatura (se cancela solo cuando ambos sensores están activos a la vez)", vars: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => !(v[0] && v[1]) },
      { frase: "Sistema de Diluvio = Sensor de Gas LPG NOR Falla del Sistema (solo se habilita cuando ninguno de los dos está activo)", vars: ["Sensor de Gas LPG", "Falla del Sistema"], evaluar: (v) => !(v[0] || v[1]) },
    ],
    "Intermedio": [
      { frase: "Notificación Visible = (Sensor de Flama OR Sensor de Temperatura) AND NOT Falla del Sistema", vars: ["Sensor de Flama", "Sensor de Temperatura", "Falla del Sistema"], evaluar: (v) => (v[0] || v[1]) && !v[2] },
      { frase: "Sistema de Espuma = Sensor de Flama AND Sensor de Flujo AND NOT Sensor de Monóxido", vars: ["Sensor de Flama", "Sensor de Flujo", "Sensor de Monóxido"], evaluar: (v) => v[0] && v[1] && !v[2] },
      { frase: "Apertura de Puertas = NOT (Sensor de Gas LPG OR Falla del Sistema)", vars: ["Sensor de Gas LPG", "Falla del Sistema"], evaluar: (v) => !(v[0] || v[1]) },
      { frase: "Agente Limpio = Estación Manual NAND Llavín de Mantenimiento (se cancela solo cuando ambos están activos a la vez)", vars: ["Estación Manual", "Llavín de Mantenimiento"], evaluar: (v) => !(v[0] && v[1]) },
      { frase: "Notificación de Descarga = Sensor de Humo NOR Sensor de Temperatura (solo se habilita cuando ninguno de los dos está activo)", vars: ["Sensor de Humo", "Sensor de Temperatura"], evaluar: (v) => !(v[0] || v[1]) },
    ],
    "Avanzado": [
      { frase: "Sistema de Diluvio = (Sensor de Humo OR Sensor de Flama OR Estación Manual) AND Sensor de Flujo", vars: ["Sensor de Humo", "Sensor de Flama", "Estación Manual", "Sensor de Flujo"], evaluar: (v) => (v[0] || v[1] || v[2]) && v[3] },
      { frase: "Agente Limpio = (Sensor de Humo AND Sensor de Temperatura AND Sensor de Flama) OR Estación Manual", vars: ["Sensor de Humo", "Sensor de Temperatura", "Sensor de Flama", "Estación Manual"], evaluar: (v) => (v[0] && v[1] && v[2]) || v[3] },
    ],
  };

  const ejercicios = NIVELES_TABLA[nivel];
  const ej = ejercicios[ejActual] || ejercicios[0];
  const n = ej.vars.length;
  const filas = [];
  for (let i = 0; i < (1 << n); i++) {
    const combo = [];
    for (let b = n - 1; b >= 0; b--) combo.push(!!((i >> b) & 1));
    filas.push(combo);
  }

  const cambiarNivel = (nv) => { setNivel(nv); setEjActual(0); setRespuestas({}); setResultado(null); };
  const cambiarEjercicio = (delta) => {
    const total = ejercicios.length;
    setEjActual((prev) => (prev + delta + total) % total);
    setRespuestas({});
    setResultado(null);
  };
  const marcar = (fila, valor) => setRespuestas((prev) => ({ ...prev, [fila]: valor }));
  const limpiar = () => { setRespuestas({}); setResultado(null); };

  const verificar = () => {
    const clave = nivel + "-" + ejActual;
    if (bloqueado(clave)) {
      setResultado({ ok: false, msg: "🔒 Este ejercicio quedó bloqueado por haberlo fallado. Llega hasta el último ejercicio del módulo para poder reiniciarlo y recuperarlo." });
      return;
    }
    if (filas.some((_, i) => respuestas[i] === undefined)) {
      setResultado({ ok: null, msg: "Completa todas las filas de la tabla primero." });
      return;
    }
    const correcto = filas.every((combo, i) => (respuestas[i] === 1) === !!ej.evaluar(combo));
    if (correcto) {
      const yaGanado = ganadosRef.current.has(clave);
      setResultado({ ok: true, msg: yaGanado ? "✓ Correcto (ya ganaste los puntos de este ejercicio)." : "✓ ¡Correcto! +10 puntos." });
      if (!yaGanado) {
        ganadosRef.current.add(clave);
        onGanarPuntos && onGanarPuntos(nivel + " — Ejercicio #" + (ejActual + 1), 10);
      } else {
        onGanarPuntos && onGanarPuntos(nivel + " — Ejercicio #" + (ejActual + 1) + " (repaso)", 0);
      }
    } else {
      const yaFallado = falladosRef.current.has(clave);
      const yaGanado = ganadosRef.current.has(clave);
      setResultado({
        ok: false,
        msg: (yaFallado || yaGanado) ? "✗ Hay filas incorrectas — revisa cada combinación." : "✗ Hay filas incorrectas — revisa cada combinación. -10 puntos, y podrías perder insignias si tu puntaje baja del umbral. Este ejercicio quedará bloqueado — llega hasta el final del nivel para recuperarlo.",
      });
      if (!yaFallado && !yaGanado) {
        falladosRef.current.add(clave);
        onGanarPuntos && onGanarPuntos(nivel + " — Ejercicio #" + (ejActual + 1) + " (fallo)", -10);
      }
    }
  };

  if (mostrarIntro) {
    const TEMAS_TABLAS = [
      {
        id: "que_es", titulo: "¿Qué es una tabla de verdad?",
        contenido: (
          <p>Una tabla de la verdad muestra <strong>todas las combinaciones posibles</strong> de las entradas (0 = apagado/falso,
          1 = activo/verdadero), y para cada una, cuál debería ser la salida según la fórmula. Si hay <strong>2 entradas</strong> hay
          <strong> 4 combinaciones</strong> posibles (2²); con <strong>3 entradas</strong> hay <strong>8</strong> (2³); con
          <strong> 4 entradas</strong> hay <strong>16</strong> (2⁴). Cuantas más entradas tenga la fórmula, más filas hay que
          llenar — pero la lógica de cada fila es siempre la misma.</p>
        ),
      },
      {
        id: "como_leer", titulo: "Cómo leer cada fila",
        contenido: (
          <p>El truco para llenar una tabla de verdad es revisarla <strong>fila por fila</strong>, nunca de un solo vistazo:
          toma los valores de entrada de esa fila exacta, aplica la fórmula tal cual está escrita (respetando el orden de OR,
          AND y NOT), y anota 1 si el resultado da activo, o 0 si da apagado. No hay que "adivinar" el patrón completo — cada
          fila es un cálculo independiente.</p>
        ),
      },
      {
        id: "ejemplo_or", titulo: "Ejemplo resuelto — OR",
        contenido: (
          <>
            <p>Fórmula: Notificación Audible = Sensor de Humo OR Estación Manual. Con el OR, la salida se activa si
            <strong> cualquiera</strong> de las entradas (o ambas) están activas — solo da 0 cuando las dos están apagadas.</p>
            <table style={{ width: "100%", maxWidth: 380, fontSize: 12.5, borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr style={{ color: T.inkSoft, textAlign: "left" }}>
                  <th style={{ padding: "6px 10px" }}>Sensor de Humo</th>
                  <th style={{ padding: "6px 10px" }}>Estación Manual</th>
                  <th style={{ padding: "6px 10px" }}>Salida</th>
                </tr>
              </thead>
              <tbody>
                {[[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]].map((fila, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                    {fila.map((v, j) => <td key={j} style={{ padding: "6px 10px", fontWeight: j === 2 ? 700 : 400 }}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ),
      },
      {
        id: "ejemplo_and", titulo: "Ejemplo resuelto — AND",
        contenido: (
          <>
            <p>Fórmula: Extractor de Humo = Sensor de Humo AND Sensor de Temperatura. Con el AND, la salida solo se activa
            cuando <strong>ambas</strong> entradas están activas al mismo tiempo — en cualquier otro caso da 0.</p>
            <table style={{ width: "100%", maxWidth: 380, fontSize: 12.5, borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr style={{ color: T.inkSoft, textAlign: "left" }}>
                  <th style={{ padding: "6px 10px" }}>Sensor de Humo</th>
                  <th style={{ padding: "6px 10px" }}>Sensor de Temperatura</th>
                  <th style={{ padding: "6px 10px" }}>Salida</th>
                </tr>
              </thead>
              <tbody>
                {[[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]].map((fila, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                    {fila.map((v, j) => <td key={j} style={{ padding: "6px 10px", fontWeight: j === 2 ? 700 : 400 }}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ),
      },
      {
        id: "ejemplo_not", titulo: "Ejemplo resuelto — NOT",
        contenido: (
          <>
            <p>Fórmula: Inyector de Aire = NOT Sensor de Humo. El NOT simplemente invierte el valor de la entrada: si el sensor
            está en 0 (apagado), la salida da 1; si está en 1 (activo), la salida da 0.</p>
            <table style={{ width: "100%", maxWidth: 300, fontSize: 12.5, borderCollapse: "collapse", marginTop: 10 }}>
              <thead>
                <tr style={{ color: T.inkSoft, textAlign: "left" }}>
                  <th style={{ padding: "6px 10px" }}>Sensor de Humo</th>
                  <th style={{ padding: "6px 10px" }}>Salida</th>
                </tr>
              </thead>
              <tbody>
                {[[0, 1], [1, 0]].map((fila, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                    {fila.map((v, j) => <td key={j} style={{ padding: "6px 10px", fontWeight: j === 1 ? 700 : 400 }}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ),
      },
    ];
    return <GuiaPorTemas temas={TEMAS_TABLAS} onContinuar={() => setMostrarIntro(false)} tituloModulo="cómo funciona una tabla de la verdad" />;
  }

  return (
    <Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {Object.keys(NIVELES_TABLA).map((nv) => (
          <Btn key={nv} small variant={nivel === nv ? "accent" : "ghost"} onClick={() => cambiarNivel(nv)}>{nv}</Btn>
        ))}
        {esAdmin && <div style={{ marginLeft: "auto" }}><BotonReiniciarModulo onReiniciar={reiniciarModulo} /></div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{nivel} — Ejercicio #{ejActual + 1}</div>
          <div style={{ fontSize: 13, color: T.inkSoft }}>{ej.frase}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="ghost" onClick={() => cambiarEjercicio(-1)}>← Anterior</Btn>
          <Btn small variant="ghost" onClick={() => cambiarEjercicio(1)}>Siguiente →</Btn>
          <Btn small variant="ghost" onClick={limpiar}>Limpiar</Btn>
          <Btn small variant="ghost" onClick={() => setMostrarIntro(true)}>Ver la guía otra vez</Btn>
        </div>
      </div>

      {bloqueado(nivel + "-" + ejActual) && (
        <div style={{ background: T.redSoft, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.red, fontWeight: 600 }}>
          🔒 Bloqueado — fallaste este ejercicio. Llega hasta el último ejercicio del nivel para poder reiniciarlo y recuperarlo.
        </div>
      )}
      {ejActual === ejercicios.length - 1 && hayBloqueadosEnNivel(nivel, ejercicios.length) && (
        <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: T.amber, fontWeight: 600 }}>Llegaste al final del nivel — tienes ejercicios pendientes de recuperar. Al reiniciar, tus puntos ya ganados se mantienen; solo sumarán los que recuperes.</span>
          <Btn small variant="accent" onClick={() => reiniciarNivelTecnico(nivel)}>🔄 Reiniciar nivel para recuperar</Btn>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 320, fontSize: 12.5, borderCollapse: "collapse", opacity: bloqueado(nivel + "-" + ejActual) ? 0.5 : 1, pointerEvents: bloqueado(nivel + "-" + ejActual) ? "none" : "auto" }}>
        <thead>
          <tr style={{ color: T.inkSoft, textAlign: "left" }}>
            {ej.vars.map((v) => <th key={v} style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{v}</th>)}
            <th style={{ padding: "6px 10px" }}>Salida</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((combo, i) => {
            const marcada = respuestas[i];
            return (
              <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                {combo.map((v, j) => <td key={j} style={{ padding: "6px 10px" }}>{v ? 1 : 0}</td>)}
                <td style={{ padding: "4px 10px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => marcar(i, 0)} style={{ width: 30, height: 26, borderRadius: 6, border: `1px solid ${T.line}`, background: marcada === 0 ? T.redSoft : "#fff", color: marcada === 0 ? T.red : T.inkSoft, fontWeight: 700, cursor: "pointer" }}>0</button>
                    <button onClick={() => marcar(i, 1)} style={{ width: 30, height: 26, borderRadius: 6, border: `1px solid ${T.line}`, background: marcada === 1 ? T.greenSoft : "#fff", color: marcada === 1 ? T.green : T.inkSoft, fontWeight: 700, cursor: "pointer" }}>1</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <Btn variant="accent" onClick={verificar} disabled={bloqueado(nivel + "-" + ejActual)}>Verificar</Btn>
        {resultado && <span style={{ fontSize: 14, color: resultado.ok === true ? T.green : resultado.ok === false ? T.red : T.inkSoft, fontWeight: 600 }}>{resultado.msg}</span>}
      </div>
    </Card>
  );
}

// Módulo NFPA 72: guía educativa con lo esencial de la capacitación
// (cableados, tipos de detectores, cobertura), y un Examen Básico de
// certificación tipo "todo o nada": se responde completo de una sola
// vez; si algo sale mal, se limpia todo y hay que volver a presentar
// las 20 preguntas desde cero para poder sumar los puntos.
const PREGUNTAS_NFPA72 = [
  { texto: "Los pulsadores manuales deben ubicarse dentro de los __________ de la apertura de la puerta de cada una de las salidas de cada piso.", tipo: "mc", opciones: ["1.07m", "1,22m", "1,52m", "Ninguna de las anteriores."], correcta: 2 },
  { texto: "Se deben suministrar pulsadores manuales adicionales para que la distancia de recorrido hasta la estación manual más próxima no exceda los ____________ (medidos en forma horizontal).", tipo: "mc", opciones: ["4.5m", "9m", "61m", "13m"], correcta: 2 },
  { texto: "La parte operable de cada pulsador manual de alarma debe estar al menos a _________ y a no más de _________ por encima del nivel del piso.", tipo: "mc", opciones: ["1m y 2,42m", "50cm y 150m", "120 y 130m", "1,07m y 1,22m"], correcta: 3, imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOMAAAD3CAYAAADvyePBAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAF5OSURBVHhe7d0JvH3lvD/w7Q5/XPM8JmUoQiIaqKhIptKgZGpQEQ0klWbK0IxKSPRrIqEUDVSGZCyZMmQeShIZrnsLd//X+/nt7+nZ67f2dM7e66xz2p/zWq+z99rPXnsNz3cenju0C7SmmGKKecV111/X+rfO6ymmmGIecYdimxLjFFM0BFNinGKKhmBKjFNM0RBMiXGKKRqCqTd1RPzlL39J/0855ZTW//t//y+9fvKTn9xaffXV0+spppgNrr/+uikxjorzzjsv/X/hC1+Y/gNC/NrXvtb6t3+bKhpTzA6IcTp7RsTf/va3tOX485//3Hk1xRSzx5QYR8SNN96YtimmGDemxDgi7nvf+6ZtiinGjSkxjgh24dQ2nGLsuMMdpsQ4xRRNwZQYR8QdCg5mm2KKcWNKjCNiqqZOMSlMZ9WI+Ne//pW2KaYYN6bEOAY89rGPnaquU8wJ81JCJeHnM5/5TGvLLbdsHXvssZ29t+Gcc85pbbfddq0NN9yw9bGPfaz1f//3f51Pmouf/OQn6bqmmGIuqJUY//d//7f14he/uLX55pu3zj777NaFF17Y+aSViG7//fdvvehFL2p9+MMfbl1yySVp7O67794otVA+auSkBm699dbOqymmmD1qJcb//u//bn3rW99KRAmPfOQj03+Q83n44Ycn58jGG2/cetWrXpX2H3fccYlwmwKENyW+KSaBWonx3ve+d6p2CJCQ8Mc//rG1/fbbt/7xj3+0nvSkJ7U++clPto455pjW3e52t/T55Zdfnv43Fc985jMXvM34hz/8ofXtb3+79bnPfa714x//eIZhBjwbOblUckx1IZgPCw21EqMJSzICVW/ttddOr7/zne8kgoRddtmldcc73jG9DlTZY1RcUvPzn/9865BDDmldcMEFrWuvvTZJVxMq8KUvfam19957tw499NDW9773vbTv0ksvTfbqP//5z1Rt8drXvrb161//On02G5DmsyXGn/70p2mizyeuu+661qMe9ajWE5/4xNaznvWs1korrdRaZZVVWn/605/S57/73e/S/gc96EFp3MMf/vDWm970pmUIdoo5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69aWcwFiLLSmzrtmoRZihFe84hWJM/71r3/t7Fm4+MIXvpC2mHyx7b333svss+l6Ht23C5W0fdhhh6X9VnWC+J6u3QsR66yzTjr/Qg1Nq34Vtnznk9vwl7/8pX3SSSfNrAFpLlx99dWdT+sDYqSJNBG1EeMb3/jG9hOf+MTOu4WNXsRIJdXmv7zf9oIXvKDz7XZSdbXRJy3BQqXGrLXWWun9QsKJJ56Yzp36edNNN3X29gZVXMNmRGlBVveiTiDGVVddtfOuWShsxvqI8dnPfnbn3cJGLzWVDXjFFVe073nPey7zGdUo1gopg7RcaaWV0rhrr722s7fZYPO97W1va9/pTndK16YL/LDw3Z122inZbmeccUZnbz1AjNY2aSIQY22R53JB7kIF76qtClbKsn78M57xjK4Ocryxlq6rysAR+pCpAzysTQevqTVOrFp86623pvVNrPk/LCQ7vP3tb0/Xfeyxx3atlJyHkW6PmKaBjBkmFOKSlC7EEii4cgr0V0EYCM4777zKOGmT8P73vz9dh7DPlltumcI11nYcJQlf8L2QrGl5OUkRoOh3SoxTjA1ihlbHktggnimgn6Nq5dxCvW0tv/zyabXgX/7ylylO11S4PtKs0KrSSmGFzZiIat11100L2+69995d7RARrJWf7H/Na17T9VmhLqb/l112WfovwaMO7Slfw6VxWKqxThaFWjPjPVzo6OXAYft99rOf7YqhWc+wmKTpc+vi//znP+98siyEAIxbeeWVk1OHDdo07LfffukcPUse4nPOOSe9v8td7jLjKbXxsD7zmc9M9mTssxUSsX3QQQelcA8PK8+mkJdVveoAm5F3u4mozYEj8G0B08WAXsTYi3huuOGG9ote9KI0RpyxytlRSNMUf4tjcf1fcMEFnU+bA55IDiqe4+uvvz5NbDHSH/zgB+2rrrqqvfPOO7fve9/7zlyH+CMCPv/881PMMfY/4AEPSGEuTJojxzEtzjppFFI6LS3YRNRGjIVdkILbiwGIxBYTK7Z+kozUtIakiUc6CHpHzLWwm2YydB760IemTBaShySVwdQkkPLWxHSthV2czrkckrEC71FHHZUI8G9/+1tnbztlMfGeRvCfFuG+rLjiiul9hHomCZLRbzURtRHjoYceumjijFSzUM/ybZBaWdhP7d13331mPLX0xhtvnMnKedrTnpak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" },
  { texto: "Los detectores de humo montados en un muro lateral se pueden montar desde la altura del cielorraso hasta los _________ en dirección descendente.", tipo: "mc", opciones: ["10cm", "1m", "30cm", "No hay restricciones de montaje"], correcta: 2 },
  { texto: "Si se requiere cobertura de un detector de humo cerca de un espacio de cocina, se deberá ubicar entre __________ y _________ desde el artefacto de cocina fijo o estacionario.", tipo: "mc", opciones: ["3m y 6.1m", "9.1 y 15m", "1,2m y 2.9m", "7m y 10m"], correcta: 0 },
  { texto: "¿Cuál es la altura mínima y máxima para el montaje de dispositivos de notificación visual de montaje en pared, medidos desde el piso?", tipo: "mc", opciones: ["2m hasta 6m", "2.03m hasta 2.44m", "1,07m hasta 1,22m", "No existen restricciones"], correcta: 1 },
  { texto: "La NFPA 72 establece que el sonido emitido por una base audible de un detector de humo debe ser de _________ HZ.", tipo: "mc", opciones: ["100 HZ", "520 HZ", "Temporal 3", "300 HZ"], correcta: 1 },
  { texto: "La NFPA 72 define el concepto de Señal de Alarma. Elija la opción correcta:", tipo: "mc", opciones: ["Indica que ocurre una condición adversa en el sistema.", "Indica una acción asociada al mantenimiento o a la revisión de un evento de supervisión.", "Indica una condición de emergencia o alerta que requiere una acción."], correcta: 2 },
  { texto: "La NFPA 72 define el concepto de Señal de Falla. Elija la opción correcta:", tipo: "mc", opciones: ["Indica que ocurre una condición adversa en el sistema.", "Indica una acción asociada al mantenimiento o a la revisión de un evento de supervisión.", "Indica una condición de emergencia o alerta que requiere una acción."], correcta: 0 },
  { texto: "El estilo de cableado 4 (Clase B) para dispositivos convencionales debe llevar una Resistencia de Final de Línea en el último dispositivo.", tipo: "vf", opciones: ["Falso", "Verdadero"], correcta: 1 },
  { texto: "Un circuito de Lámparas/Bocinas direccionadas (IDNAC) lleva Resistencia de Final de Línea.", tipo: "vf", opciones: ["Falso", "Verdadero"], correcta: 0 },
  { texto: "¿Cuál de las siguientes normas establece los requerimientos mínimos para la detección y notificación de incendios en un edificio?", tipo: "mc", opciones: ["NFPA 72", "NFPA 70", "NFPA 101"], correcta: 2 },
  { texto: "Según los lineamientos ADA (Americans with Disabilities Act), ¿cuál es la fuerza que se debe aplicar a un activador manual?", tipo: "mc", opciones: ["15 Lb", "3 Lb", "5 Lb"], correcta: 2 },
  { texto: "El espaciamiento entre detectores de calor se verá afectado para cielorrasos a partir de los ________ m de altura.", tipo: "mc", opciones: ["3 m", "9.5 m", "4.5 m", "3.7 m"], correcta: 3 },
  { texto: "Para el montaje de los detectores de temperatura, ¿cuál es la distancia mínima que se debe respetar respecto a la pared?", tipo: "mc", opciones: ["5m", "10cm", "4cm", "No hay restricción"], correcta: 1, imagen: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZcAAAGTCAIAAABrlchMAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAOwwAADsMBx2+oZAAAVCFJREFUeF7tnQlczPn/x7+jolIJJUdSSiok5YgcURYl0uHKuViWda1d9nDssvu3smhZx2IXv13sii2WHOUuKUp3dLiKUpOku5lp/p9papqZ7zTzLTPzPXrPw8OjZj7f9/F8f+fV5/v5fj+fD4vP52PwAgJAAAjQlkAb2kYOgQMBIAAEBARAxeA8AAJAgN4EQMXoXT+IHggAAVAxOAeAABCgNwFQMXrXD6IHAkAAVAzOASAABOhNAFSM3vWD6IEAEAAVg3OA3gSKior+/vvvmTNndurUiVX3Qj+gX9Gb9E4MoidMgAVPvRJmBQ0pR+Dp06eDBw8uLi6WGdmECRNOnjzZuXNnysUNASmVAPTFlIoTjKmXwOvXr5uSMBTI1atXN23apN6IwBsJBEDFSIAOLtVG4ODBg2rzBY7IIgAqRhZ58Ks0AujK8fTp02w2Gw2PJCQkoGtMcdORkZFK8wSGKEkAxsUoWRYIihgBpFCpqalLly4Vbx4WFubp6Sl6B+nawIEDidmDVrQkACpGy7JB0HIIoLuTs2bNEjbo2LHj27dvARezCcAVJbPr2+qyQw9ebNy4UZT2V1991eoQtL6EQcVaX82Zm3FiYuLEiROzs7OFKX766afr169nbrqQWT0BuKKEU4EhBNAY2ZQpU0QPXnzzzTc//vgjQ3KDNOQSABWDE4QJBKQef0W3LNHj+0xIDHIgQACuKAlAgiaUJxAeHi7qhe3YsQMkjPIVU2aAoGLKpAm2yCJQUlIicj1ixAiywgC/pBAAFSMFOzhVMoEOHTqILL5//17J1sEctQnAuBi16wPRAQEgoIgA9MUUEYLPgQAQoDYBUDFq1weiI0YAPey6fPly4eJisLIYMWbMaQVXlMypZWvOBEmY+PIVMHeyVZ0M0BdrVeVmbLLoeTHx3NDKYoxNFRLDEQAVg5OCCQR69+4tngZaq4cJWUEOxAiAihHjBK2oTWDbtm1o1iSKES1igR7ch6V4qF0uJUcH42JKBgrmgAAQUDMB6IupGTi4AwJAQMkEQMWUDBTMAQEgoGYCoGJqBg7uJAhYmVvQlQi/9HnUuSNBe1AKEZnv+XRNgwlxg4oxoYoMy6GysjI6OppqSaGQUGCNUbH0zV18l6xZi95x72PAolq4rSkeULHWVG3K5/rq1atDBw95TppU8OYN1YJFIQ2wtUPhoSCpFlsrjwfuUbbyE4Dk9NHlWNbzZ6iPg562/+vPP6+GXUYBDRk29PQ//5AcmSz3s2bMeBATiz6Z4DFpzty5Dg4OOjo6whQoGG3rCQlUrPXUmoqZIgn4/odtvx89+vL5CyrGJzcmM/Ne02fM/HnHDlAxcmsHKkYu/9buHalYcnpaVFTU70eOCLs56PXFhg3LPl1GQTTochJpljAw1GFctGSJi4sLuswEFSO3WK1HxfjcwpRbUcnP2Zix+YARrv2NNTEuOzs5T7tPf1M93Ngsvyw35RlmIesjcgvGMO/il2OZmZnXI64LZeJy+LU+ffpQKlkU3qTxHwlF1s3dTRQeXFGSXqZWomLVeTf3fLL4LOYxZZwF9vz6xWjTVcd3+XeK+HLk9xZnHqx11JQuBDd+j/Mi7LCsj0ivGZMCwEsAGiO7dvVqXl4+1bpjqCPWrVvXUaNHo8V/xEsAKkb+CclvBa/a1xfXOLqvv/SCU5dsbWn8AX/naccecxtzr+UUZsZnFAoboBcnbreTw+44we/c0pzUuKSc0lpJUuiAzLr2oh9ktqwtzUmKFzu6CWutoAoyU7TsZU731BmQAt1L0BqetODmx1wL0/ac4dZT2OVi6dnP3f37JpcOr0NXWQ3aE1/16lbgHOdhfkv8RjhP33Urr7rxb0tVRuj6aUNmb9y93ttp8k/Cj1A3bfDEBZ9MHTvRfYiN8IefItlV6aeWujrVtXQYvOpURhmG8bl513+YPNJ7/davvEZO2XY9r/QJ3hr5f8cgAiBAcwKtQcWq8p5l8mzNu7cTjX5p6JnaDepjpCUoHqfw7u9fXXU8kBD3MOH+gcF3Pt19p7i+qBXZF/Z8/cL3wvVzf4Vd+3NM9KfbrxcKn9HO5PTbHJHy7yrDuh8eH/U2zrhxOH9+SARqefmoR+pv4U95WFXmxcPHu3138XLIpXv/82OHn/jpe9nWaH4OQfhAgFwCrUHF5BMuSoyOKjHMjzy6Nyjo+M0cbm1EyjOu8JDsyFspNpOcLbVYGKvjwDEuOnef5PDqPjEYPMrJRNCza/hBw35x8DbzpBN7Azdt2X87v7yGy8fadrUfZnvzh0WLNwadybX9YqH9+xzZ1sg9BcA7EKA5gdagYjoW/QdqxaRkV4jmur2L3eFh++W1orq+WHUNV6tjdwvBq7eN25LA7W5mGsKq1lRW1Gq31RR24Xjcmtomi83JC9vsufDkS12zAe4zZ4zuWtdQo+OwtSExf66fbIVl/LN+3MRV/+USs0bzcwrCBwLqJdAaVEyj4/CpCzuH7j0cXYh6SBivLDXkwFFWgPegultNnW3srKsL9G08p071/sju3flNYbkNatfXZYxFwu2EXHQU/+2jG/e0pw3pg7ubWVev6rwnydzpy1YHTJs4WL8wo04eseKorZPnXsRGeC9Y88PWz0YIpJGYNfWeAuANCNCcQGtQMQzTG7L84Abzq0uHW/W2MrdymPK34fc71owwrutk6VpOWfODebCPm99i30lTjnfZunas8AN02AD/DV9je6d5zVni57P4/uiflgzRl11vHYsR7j0Or/CZM3uyR2C2iUV5yImQTG2nmXM67JvvPWfxEr95m9jL/7rzLzFrND+nIHwgoF4CreR5sTqogidZMws47bpY9zXVq79obKBdzc58/LK0vZm9pVH9FWTDJ8KjMGNrBU/A8gXP0L6sMUbG21fmpr7RtumNTAmOzijgYAb1lolaU+9ZQJ43BjxsxYAUyKu/cjy3JhVTDjGwokwCDJAABqSgzIqSYat1XFGSQRZ8AgEgoB4CoGLq4QxegAAQUBUBUDFVkQW7rYQALGhBeqFhXIz0EkAAQAAIfBAB6It9ED44GAgAAdIJgIqRXgIIAAgAgQ8iACr2QfjgYCAABEgnQEjF0tPSRIG+f//ea5IH+od+EL2JGgwaYL9+3Rfi+Zw7exY9SoP+F38TtUEtwSAwRGcFk04b0r/JrToAIgukOfQfkJaaKmpZUlIyeeIk9A/9IHoTNUDNvvx8nbjBs8HBaA059L/4m6gNGASGwlOCSacNka8StFEFAYyIUdAdRAl0h3m6o/QTm8i3CdoonQAhFUNelV5vMAjKyMiOvNK/omBQIQGiKgZCJkQJPTLokeHHTBR+zaCBSgk0Q8VAyEDIYCRU5uCvSr+iYFwhgeapGAgZCBkIGV7IFH7NoIFKCRBSMbjJCKN4cDUtfxRPpd9SMC6fACEVg6cloBMKnVCFnVDQGrIIEFIxeOxLWB7okUGP7MN7ZKhPoNJ/ZEkJiX4JrWmBHsFv1U8GQ/JAQC4B0eI8aDbC7BkzN27Z7OvnJzoCTV/54futj5KTlEvx7du3Z/45s+zTZco1S0trJCoouKYOgdCQEFKCOXjg4NgxY3Jzc5F31EMRj+FDflWuNalIpIyLPhXOQ5AaREa/Ss1UURZnVDLkuqKiQlkG6WuH0DxKWsozBE2YQGJi4ro1aysrKwkfobSGqCsxfcbMuQEBr169UppRMgzJ6YWd+udvWzs7pQc11dsb9QF1dHSUbpl2BkHFaFcy5QccfOYMMnrt6lXlmyZgUSRkBNpStIn6JYyiIMgKi77dSIhcKQSKioqEg80zp09XisGWGRG/tGyZBbKOQujUeSFJVppU9gt9MbL+fFDF7+WwMGEoD2Ji0aUlWWHR+tJS5nC+ii4kySoQlf2CilG5OuqI7fejR0VuyLqoFAYgJWRSd8ab9Suy1qz2zWqMN46/IyklYVJL76mjrq3JB6hYa6o2Ltfo6OiXz1/MDJiNPhkybOhvBw6i+/ckEqF1jwxxEz5UgZcw8WVBScTLVNegYkytLKG8nmZnnzsf+sOPP6LWp//5Z1fQnidPnhA6UmWN6DvYL0fCTv7zt8qAgWEMVKxVnwQBc+YMHDhQhADdvB8+fDjpRIRChsKg0eMX8iXMwMCAdKpMDoDKtx4gNrURwD/YqTbXTTmiy11L4Sxj/KOtaL6a1KrupCNlagCEZiAxWcUhtzoCaHibgntcHzp46Mw/f/958mSPHj0oWyiETl9fX+ZYGLqQhF6YGgoHV5RqgAwuWkhAfLD/A28jNutw+Y2Foi+ekkIJE98wrIUs4LCmCYCKwdlBaQK0GOwXn2CEHqpAdyTFe2FIwgLqhvngpSICoGIqAgtmlUaARoP9TUmYKuZRKo0v/Q2BitG/hq0gA+H6MxSfNC5HwgJ3/dwKqkRaijC6Txp6Sjmm5ui+FCJqDvYL0YGEkXg+Q1+MRPjgunkEhJeW//fjj6QsIiQnVpCw5hVS2a1BxZRNFOypkgASsgED7L9Yt45SQiZzOB+NhcGFpCrPhUbboGLq4QxelEZAKGQDbO3EhQy/qLoSH61QaBx/R1JKwmAepdLKL8sQqJhK8YJxlRAQDvZTp0cmerRV+FAFXsLQYvwqAQFG6wiAisGJQEsCaECdapeWciQMLUBGS8o0CRpUjCaFgjBxBCg1RiZfwsQXIINKKp0APGmhdKS0NEiLJy1kkkWPXyQnJ/28axdZ+2ggdPFJiU1dSEotA0vLk4PyQUNfjPIlggDlEqBCjwwkjNyTFFSMXP7gXQkEkJBdDbssNdivznuUMofzoRemhNISMwEqRowT01tRcFmeZiEnd7Bf/LmwpnZ1a1Y60LhZBEDFmoULGlOXABUuLeVsTEldcPSPDFSM/jWEDBoIkCtk8vfWhSqpkABTF7GFvFotAbTU9fJPP62oqFAPAeFi32mpqbC3rnqA471AX0yFfyHANCkE1N8jk98Lg8XFVH0agIqpmvAH2+eX5SY/epTJ5n6wpaYN8LnsLCkXArfJuWV8FXmtzo+/dj4ivUQ19vFCpsRbloiIlDU0wQi2B1fRiULELKgYEUpktuHnR/zo4+O//Ex6zYd944ujgpbtiyrmyUqGx47c678jki32GS8jeOG84AyZzT+YBz8vYseXlzmW5h1YH2yrCQPq7JGBhKmqisTsgooR40Raq5rcyKu3LGytn4dfTykVi6KanZkY39hXktGZEjTmsjMfZbG5dfJXXZh2JZNdLZRCXllumtjh9YYF/a/4hvaNzpowXt8Abwq9k51bJkf/eO+ren58YpuvhY5KuXpN8ercqbMaJo2LTzBqamNKlWbayo2DilH7BKh9duOvtAmrt6yYVBAcnl4hDLYqI3S9v8vE+Z/MGec6Y19s4YtbgXOch/kt8RvhPH3XrbxqpF75oausRk70HOY+62MP52GrT6VHHvD74gb23zq/35LL0k8tdXWavXH3em+HwatOZZTVI3h8aPEY12k+452Hffa/tJL6N7mvcMbFiFXhTHGyQ1d7OI10d+0/3HOSi9Xi0HxhMIP2xAsuicvi93gM3pPYXufpvpHfXMhX1VVyYmLixm+/HeMy0tffTzhpXD1llrO3rnoCaJ1eQMWoXHd+Tcr1U2lDJwwdNMrHvfRsxKPSWgyryflvz4bU8acT4x7GXfpc58Ry3zlfXHU8kBD3MOH+gcF3Pt19p1iY0xvrhSH3H8bHnJmb//2OPK/gn8dhXrvOLrV7euNw/vyQiHN/hV0+6pH6W/jT+l5TtdNnF1OznsWdmpH749ZLzwTvcgrv/v6VTOPCHl2GlKnHOZf2bc7zCU7Jyso8GWCC9FStL7TiWERExKwZM3ynev998tSQYUPRzufCS8sJHpPE1yOTesq3Wb+ilGQ+JCx/e3C1gmhlzkDFqFzw0pTr4dlW7Qqiwm4+5/UsvHYl7i2GvXscm6Tv7mKvp4Fp9pl94sYBT91yw/zIo3uDgo7fzOHWRqQ8E3ZxRoxy7qmNsTrajx6u/+iZoItW99KwXxy8zTzpxN7ATVv2384vrxFecGJarq7O3dphrE6O7q766bkFgmG4osToqBKZxmWbykuJSrD0cO2PYtMyG/GRvdrgIoVC08I9J01atnjJg5hYod+Zs2YJf1DDGJl8CYO9dVV6JoCKqRTvhxmvSI84wx7h1KH42bNnxfr9nErPhz16y6+pKK5ssItGoBJu38po07G7heDV28ZtSeB2NzMNoSxpaYrGzttoaWoKD+LkhW32XHjypa7ZAPeZM0Z3FYVYW8VpvMBrIzyYU13D1ZJpXLapqvJi+f2vqvdF5R8GRfbRaEGL6TOm/7h9+5JlS9to1J/Vo0aPFrWWErIPuWWJbEodDhKmipoStwkqRpyVmlvWvo8N+wub8tk3X6xZu3bN2i83rvTCQq7FsDvaj3MsT3iSg7pQnIxz61b9lo5VF+jbeE6d6v2R3bvzm8Jy6+9lJiY9FtyRLE2Pvl8+qm9PobRh1XlPkrnTl60OmDZxsH5hRpEoK979h6ni7QWq19nGzlq2cdmmuvYdZvY4OuUVio376uHtlDrjGgbGXfRqOVwen1+a9SA6T0UcO3XqZGZmdvXKlSVLlyIXX2zYgN4R96W6HtkP329VuD24irIGs4gAqBhVTwN+ftS/N0ymjxugK+xQtTEY6jHHKPJCVFGvKau/1j7k7zXT3236fsMNlx+FbTcP9nHzW+w7acrxLlvXjjUWHlETun7a9MW+k/3+MNn02WhjPaOexmHr/I6XDHXvcXiFz5zZkz0Cs00sykNOhGRWoeZane//5O41x3fy9GDz7fVGdC2nrPlBpnGBAx2LEVKmzqYPWL6qKmiaV8A8r6XHXmrVxcHSsRsXYPrnXDdXV8evbmnpqoj4q1ev0IaVqDs2OyAAuXBzd8M7EgmZcmNQKGFoDUXlegRrEgTImjQAfj+IQG1pTlJ8fEYhp95KVWFGQlxcZiGntu4NTl7ISstFIS8LM+PjUnNKufWtOG/z2FV8fi1H9D6yk5zVcJTwfZERUYBSxsUDl2WqLraknLev62LIEzbnFGbEJWQUIu8qeeXm5o4dM+bevXtC62gGkhw3aIoSmjYkPkVJOItI9JL/K2om3kCq8Zefr5s8cVJJSYnIGvoZvaOStMFoHQEMODCRQL2K1SsIORmqLwahhP3155+iRBVOolTiXEtxFWtKwtD75BShdXiFK0pG9s01DAfO3LNwoCGZyakpBuGFJNptN2DOHFG6ClevVsUYGeytS9rp1jrEGrJkJgHU55o5fTrqWLUsPVGP7MOvKKEX1rISKOUo6IuR9vcDHH8gAfSMGHoof4zrWOH2lC14KWuwH3phLYCvxENAxZQIE0ypj4BQwtBD+S2WMGGsQiFDP4g/2d/cNNDKPAq3B2+uTWhPnACoGHFW0JIqBJQlYSIhQw+XfcikcYUShmSOKuyYGAfsR8nEqjI6J+VKmAhVi/e1FN/KU87euo+SkxhdFjKTg74YmfTBd3MJqEjCRJeWH9Ijk789eHMzhfbECYCKEWcFLUkmoDoJEx8jQ0Imf5YlaizVAL0jX8LEFyAjGSIT3YOKMbGqTMxJ1RImLmTo52YN9oOEkXvGgYqRyx+8EyKgHgkTCRn6oVmXlgEzZsL24IQKqZpGoGKq4QpWlUdAnRImjLq5O42DhCmv2i2xBPcoW0INjlEbAaGEIXf7DxxQm1OhI4J3LcXvUaKjmtrVDYbGVFc+6Iupji1Y/lACIgn7edeuD7XV/ONbMNdSzsaUzfcPRxAlACpGlBS0Uz+BX/ftQ06RhCmc3a2i2JoSMvw9Sjm9MOEaiiqKEMwKCChlNiYYAQKqIICW3FG4xo4q/ErZxC/jg19fLC011aH/gLPBweLHol/Rm+gjNQTZml1AXwz+mFGXQI8ePcjqhYlDUXhpKedCUmoZWOqypnNkoGJ0rh7Eri4C8oVs9oyZsD24ukohww/coyQRPrimGQGZdy3RGNmOn3cq3B6cZqnSKlzoi9GqXGoMll+WmxyfmMkW7cxWzc5MEftVjaEocFWdH3/tfER6Sf3WTyoMrKkemUIJQwuQqTCsVm8aVKzVnwJNAOBlBC/08Q3YFpFXrw6FUTtW7IwspBovfl7Eji8vcyzNO4g231RliPIvLeVsTKnKoFq7bVCx1n4GyM2f9/Z80MHbBUR7OYL+W1puGdoEU/hC3bfE+OTcssbj0TbAaZLviPvHf4reyRYziA+W976q58cntvla6KitkE0Jmfy9ddUWXit0BCrWCotOPGWXJattr3z3xz3BbruiFzc/dJXVoD3xgp3Ey+L3eAzeE5OL3pm44JPJw129PF0Hzv4lrphflRG63t9l4vxP5oxznbEvFlmoSj+11NVp9sbd670dBq86lVEmEQf+U0526GoPp5Hurv2He05ysVocHC/tF4Wg0UHn6b6R31zIb9zXnHh6LW6JFzLYHrzFMD/8QFCxD2fIYAudbHyXrTG/FHgqqVJhltmaQwMjM5/Hn5jPPnYp/sl/ezakjj+dGPcw7tLnOmcPRrzkZtw4nD8/JOLcX2GXj3qk/hb+VFwaedKfPs65tG9znk9wSlZW5skAE9HwnMI41NRAfM1+UiRsxfLl6MZCdHS0mhKmsBtQMQoXhwqhtbX2/2axblDQX2mKdre2GOZig8am9C3t+5W9TLkbm6Tv7mKvp4Fp9pl94vYxfwtN+8XB28yTTuwN3LRl/+388hqu+IWqhvSneSlRCZYerv2RBS2zER8Jlsan2gsJ2Zq1a1FUwqfz0ZxwUYT4/USUHvycuXPNzHsNHz5c6ZZpZxBUjHYlU3fAWta+m9Zj+wJPJ1TU4nxXvS8qr3/TzLijhujzyrJiUe9NMNqVnFucF7bZc+HJl7pmA9xnzhjdVdIUB/dpVXmxnP6XmF9185Dw16dPH/S7QglDC5AJD0O9J2X9mztr9svnL+RYIxWMWp2DiqkVNz2d6dnO/GzR29A/7wkFS8PAuIteLYfL4/NLsx5E58lKqteQcY7lCU9yUH+Lk3Fu3crfkwryniRzpy9bHTBt4mD9wowiyaOqcZ927TvM7HF0yitkgfvq4e0UDNPsoNgvOYDl98KEaygKI0Nr/qjtHzksyPAKKkYGdbr5ZOk7ztsQYFYfNkvHblyA6Z9z3VxdHb+6paUrKxsdyymrv9Y+5O81099t+n7DxSvGWVqMcO9xeIXPnNmTPQKzTSzKQ06EZFY1HKuD+/Rs+oDlq6qCpnkFzPNaeuylFoaxdBX7JZmsnI0pSY6M0e7h2X1Gl1d1yXHZmUmvMDObPkbtmnSCHrxIySzU7jmgj5GmoBGfy85OflljbN3XtH1lbuobbZveRpqip7xkfapRjiwUdzQ3erhl1MVxkUe9uxLxq7qsZVkWrS8Ge+uqF3yjN1AxssiDX+IE0LMdn48Uqhjxg9TVUqhiIGHq4i3DD6gYifDBNUEC/Kpn0eGvu413sdAmeIQamyEV8/H1he3B1Yhc2hWoGInwwTUTCCAVs7W1Vbg9OBNSpWoOMLpP1cpAXPQhoFDCUE+NPtnQL1JQMfrVDCKmGgEDAwNhSHI2pqRazEyKB1SMSdWEXMgkIH9vXTIjY7pvUDGmVxjyUwsB2B5cLZhlOwEVIxE+uGYIAZAwcgsJ9yjJ5Q/eaU9AeI8StgcnsZDQFyMRPrhmCAGQMHILCSpGLn/wzgQCgbt+FqXR1K5uTMiTqjmAilG1MhAXDQnI2ZiShtnQJmRQMdqUCgKlOAH5e+tSPHhahwcqRuvyQfBUIQDbg5NYCVAxEuGDa4YQAAkjt5DwpAW5/ME77QmgJy309fU3btmscG9d2qdK1QSgL0bVykBc9CEAEkZurUDFyOUP3plAQGEvDK2hyIQ8qZoDqBhVKwNx0ZCAnI0paZgNbUIGFaNNqSBQihOQv7cuxYOndXigYrQuHwRPFQKkbA9OleTJjgNUjOwKgH/6EwAJI7eG8KQFufzBO+0JCJ+0ULg9OO3zpHAC0BejcHEgNJoQUChhaAEymqRCyzBBxWhZNgiaUgTQyjyieJramJJSATMsGFAxhhUU0iGTgJy9dckMi+m+QcWYXmHIT10EYHtwdZGW9gMqRhZ58MsoAiBhJJYTVIxE+OCaIQRAwsgtJKgYufzBOxMIoJV5FG4PzoQ8qZoDqBhVKwNx0YeAQglDMkefbOgXKagY/WoGEVONgIGBgTAkORtTUi1mJsUDKsakakIuZBKQv7cumZEx3TeoGNMrDPmphQBsD64WzLKdgIqRCB9cM4QASBi5hYTZ4OTyB++0J4Bmg9uil52dwr11aZ8qVROAvhhVKwNx0YcASBi5tQIVI5c/eGcCAYW9MLQAGRPypGoOoGJUrQzERUMCcjampGE2tAkZVIw2pYJAKU5A/t66FA+e1uGBitG6fBA8VQjA9uAkVgJUjET44JohBEDCyC0kPGlBLn/wTnsCwnX3YXtwEgsJfTES4YNrhhAACSO3kKBi5PIH70wg4OvnJ0qjqV3dmJAnVXMAFaNqZSAuGhKQszElDbOhTcigYrQpFQRKcQLy99alePC0Dg9UjNblg+CpQgC2ByexEqBiJMIH1wwhABJGbiHhSQty+YN32hMQPmmhcHtw2udJ4QSgL0bh4kBoNCGgUMLQAmQ0SYWWYYKK0bJsEDSlCKCVeUTxNLWrG6UCZlgwoGIMKyikQyYBORtTkhkW032DijG9wpCfugjA3rrqIi3tB1SMLPLgl1EEQMJILCeoGInwwTVDCICEkVtIUDFy+YN3JhBAK/Mo3B6cCXlSNQdQMapWBuKiDwGFEoZkjj7Z0C9SUDH61QwiphoBAwMDYUhyNqakWsxMigdUjEnVhFzIJCB/b10yI2O6b1AxplcY8lMLAdgeXC2YZTsBFSMRPrhmCAGQMHILCbPByeUP3mlPAM0Gt0UvOzuFe+vSPlWqJgB9MapWBuKiDwGQMHJrBSpGLn/wzgQCCnthaAEyJuRJ1RxAxahaGYiLhgTkbExJw2xoEzKoGG1KBYFSnID8vXUpHjytwwMVo3X5IHiqEIDtwUmsBKgYifDBNUMIgISRW0h40oJc/uCd9gSE6+7D9uAkFhL6YiTCB9cMIQASRm4hQcXI5Q/emUDA189PlEZTu7oxIU+q5gAqRtXKQFw0JCBnY0oaZkObkEHFaFMqCJTiBOTvrUvx4GkdHqgYrcsHwVOFAGwPTmIlQMVIhA+uGUIAJIzcQsKTFuTyB++0JyB80kLh9uC0z5PCCUBfjMLFgdBoQkChhKEFyGiSCi3DBBWjZdkgaEoRQCvziOJpalc3SgXMsGBAxRhWUEiHTAJyNqYkMyym+wYVY3qFIT91EYC9ddVFWtoPqBhZ5MEvowiAhJFYTlAxEuGDa4YQAAkjt5CgYuTyB+9MIIBW5lG4PTgT8qRqDqBiVK0MxEUfAgolDMkcfbKhX6SgYvSrGURMNQIGBgbCkORsTEm1mJkUD6gYk6oJuZBJQP7eumRGxnTfoGJMrzDkpxYCsD24WjDLdgIqRiJ8cM0QAiBh5BYSZoOTyx+8054Amg1ui152dgr31qV9qlRNAPpiVK0MxEUfAiBh5NYKVIxc/uCdCQQU9sLQAmRMyJOqOYCKUbUyEBcNCcjZmJKG2dAmZFAx2pQKAqU4Afl761I8eFqHBypG6/JB8FQhANuDk1gJUDES4YNrhhAACSO3kPCkBbn8wTvtCQjX3YftwUksJPTFSIQPrhlCACSM3EKCipHLH7wzgYCvn58ojaZ2dWNCnlTNAVSMqpWBuGhIQM7GlDTMhjYhg4rRplQQKMUJyN9bl+LB0zo8UDFalw+CpwoB2B6cxEqAipEIH1wzhABIGLmFhCctyOUP3mlPQPikhcLtwWmfJ4UTgL4YhYsDodGEgEIJQwuQ0SQVWoYJKkbLskHQlCKAVuYRxdPUrm6UCphhwYCKMaygkA6ZBORsTElmWEz3TVTF+GW5yfGJmezqBiDV7MwUsV9bzqnOchaby2+5iZYfyeeysx5lsivR/8m5ZRIh1H/EbblxtR1JSqikOFUb0pY4gr11W0JNGccQVTFeRvBCH9+AbRF59V/1wqgdK3ZGFsqOoTgqaNm+qGIekQjrLO+NYhNqTMRgc9rw2JF7/XfcTEf/zwvOkAhB+FEkuznmlNC2Oega3JESakudtiRBJXBVtQmQMFUTlmOfqIrVmeC9PR908HYBrtfEK8tNixfvy1QXpl1BHTVhQ9ynRNPFHSjotuH6TCJr6NMnr+r6U+jAJ5L9RBkdB355SUl9R0uru/ferEdrHTXrbYl9JHxHVgotDEaRKQl0GIb6iqif2jRGxaHKiVPGR02Fl5Zb1sSfGYER8U+bmWDLTw+ip5Ea2oGEqQGyPBd8Yi9O3G6nXgE/7V45ZMz2yLdcPj8ndNHoJSE5/MonIV962YyaFjDRydpj+83XVXxu4n4XS8te5pYuvyaVpp38ZKR13aeWjitPPinl81+HfeY8+tdEZEL4qrO8MjSPIxFIpfSBnNcR2zwGOk309nAYOHlrxGtOrchAXshKywnzl3j0R06tPdbv+sbbGnnvNXLZmcwagYPcmztmO/Ue6GTfx8n/Z0GElY/PrPyors0Qj4kjLBediUMWHHbHoRCkPwrJw0XC59e2MBg8KylTmzat6I+iEqCLi9ntJExqkcwYCIXadJyyUpAOr0wcrGXv6UEP34qgI6wSnzosOJxYwlfISizBJHQGyGhP7HSkUitUr8kTJ5WUlIiCQj+jd778fB2VwmRyLBjB5Oq15kXqyfkjp/waX1GvYlkvzyyzmX48o6aWX1sUs2OKzcpLBehMzwtZUidM3MRfx0w5klqNPi24uXFcnXiVPYu8dDlR0EqOiuEOvJd0eLrg+4yOqUg8vmpr6NMqCRWzWhn8opJfdX+HfR/3HdHvazkFl76wGX84jct9e/P7YeN+jnnPrY/wiwuPUMz+hxJLuXxOdvAnQ8RUrFqQjsRHITkyUqhIa0kwv1w8hWeFM3X3lBCdAHjv2UH385G0ysJIJFQ50PApvMeVMjQBibvVoiMp72r5byO/Hzfw+8jyxtOlTsWE2Bs+LSHCqiFBZElWXgTPRwo1QyqmUMLSUlMpFDHjQmnWFSWGtbX2/2axblDQX2nC518KUu6k2ExyttRiYayOA8e46Nx9kiN25aFhvzh4m3nSib2Bm7bsv51fXoPG8Nubu3hMtDdmye2D4g7U6Go/zPbmD4sWbww6k2v7xdopFu0kDFgM6NdDG2vXo++QbhbWpvoszY5du7cvLKvkl2fGRJUY5kce3RsUdPxmDrc2IuRYeIqNh2t/PQ1Ms6ezu6OYnSJBOpIfacpIoW2Lgkm4dhPPCmfKSqcxHoPBo5xM0GWuLIxEQpUDDZ9CGa6Uj59zMMximItNBxamb2nfr+xlofRTT0LsmF4v2z7o0woirMQSlJUXyZcmLXNvYGAgPFDOxpQtswxHESHQTBXDMC1r303rsX2BpxMqatGAUU1lrXZbTaEk8bg16C2xFycvbLPnwpMvdc0GuM+cMborkYDq2uAP1Ow4bG1IzJ/rJ1thGf+sH7fkYJLkF8rMuKOGTPM8TjVXq2N3C8Grt43bksDtU/pyG2OWPEYinbqPal7JSEGjRcHUVFbgWeFMxRXh0pCJkUiocqDhUyiSXcomwdaFWf8pS1OrLVFWjQm2+PQgfB6pt6H8vXXVG0vr8tZsFUN/eG1nfrbobeif98oxzMRupEXC7YRc1Mfiv3104572tCF9GsbIMaw670kyd/qy1QHTJg7WL8wQfj/RIxpJ0k81SDPHH1gYuXXy3IvYCO8Fa37Y+tmIvCe5yDuRV3szW+vqAn0bz6lTvT+ye3d+U1iNjbNp/NXY5yhmbs79iHgxK52th0l9VJErI4XiqJYE09dlDJ4VztTzd7isZGIkEqocaPgUdHGlHGqjRYSwqA0xVo0JysyrWR4p1Bi2ByexGC1QMYyl7zhvQ4CZIGodK78NX2N7p3nNWeLns/j+6J+WDNFHb7c36mkcts7veMlQ9x6HV/jMmT3ZIzDbxKI85ERI5suoHQsWSj3VgP23zrkPmo9W988jKJ5nMULqwIvP7Kd12Dffe87iJX7zNrGnzB7ehRi1tj291vxgHuzj5rfYd9KU4122rvUaO3vjt9qH/L0C5nktPfZS/JuqYzNL6iO9PtKRoBS0nWbOaX4wegP88awMpU1NdqpD91tS44NqOjgaKAYWgVDlQMP5Hd4LV8qhHYghbmhFjFVDgsk8mXlVNc8nNVqDhJFcByWM9NWW5iTFxyXllIrdweJz3uax0QB8LacwMz4uNQcNpaNmyVmFjfcW5XuWcaDATxx6ZRI2InJRVZiRIHEgpzAjLl4q5IbbDVIfyU6hhcHIYiVtqh6dOJ8mMEpn0TxoMlKQWcpmnCLEWDUm2OLToxkxqbqp8B6l1B1JNJzv0H/A2eBgVXsH+4gArGlB8l8RcE93AugCwsfXV+H24HRPk8rxt+SKksr5QGxAQP0EFEoYWoBM/VG1Ho8tVzHBM9sSo/QfOLHuAw9vKFnVs6gLl2Nz6TW8Ii93HGfxk1NJ0FrP+a7iTOVsTKliz63afMtVTDD/UWLuYUsn1tXz/8DDhVbK0v78MTCxbc+ukk+TUb3E8nLHcRZPpukDmztdsbntqY6UhPjk761LQkCtxmWzVIzQX37cGhVNzKNsnCGI4SYDynUkZ74kn8cymbDM01pfo+GhWnmzHdEzH4kS0z8xWX4b48S3JzjrUN5MUlzu6NQjxrlxHqjwbJU8Smo+pgybkukonPoqVq9W8+1oRqKwPXgzYCm9KdF7HLjZiIIpMsK5hw339gRTUlwmeDjWTaJ0XH4i9V2tjJmDdRMnG2cISk1pDMnDT3sUty9nvmQzpl6iGXyC6Z/W9ZMr98agmaEyE2yME9de2l2x7FmHsgjUJ4Sfs4k+UMxZ1gxKqaNy7jdOZUXTFWXMJJVMpzBObOqr9MRYiXoRPV1aUTt0tsu8I4luUKLblDD3SA2nAsF5lPjZiNcKZKrY4G/C0HTrujmV1jOOXj8tY5al2AxB/GTA4BTpaY/X3oqrWJPzJfGT8uTMIhT4tfbYGyeYSplxct7oBWcyi3B+BQnWz2TEt3/KkZ4z+DBHxqzDugTx80wFGcmYCJnHJ8KZGLSGqaxotqLMmaSS6T+trW9fjg8472HjjE41nJG0c4FUDP9QBUiYOutI8IoSPxsx5RmaZId7abm6Ondrh7E6Obq76qff+OdykuxZlvUzBPGTAd+lS097THkmvlBhk/Ml8ZMN5cwifPc4Nknf3cVeMJWyz+wTt4/5d8nC+0UJ1seJb2+Bn18pgCE967AuQdnzTGVMhMQwIpybCw1v89KpO1LpWzRcgbNlBIymlTXM6FT6pQAzDG7cslnh9uDMyJSaWRBUMfxsRDezxplGjanVVnEaNacNi8/Dmp5liY7CTwbk1khPe3QzE58g2eS0vmZNvaypKK5sCFowaJWc+06G38YE8e2LZU8RlQ5PzjxTfO4CILhZn3jOzYWGtznRvFwqfdEyt/InxlLzHCY/KoUShhYgIz9K5kZAUMXwsxFzZa4wzbv/MFWwxGtpevT98lHec93lzLJEUPGTAQ17S097lO0IV5FmTb00th/nWJ7wJAdNpeRknFu38vckXi95fvHtC2RNEcWfJkZNzzPF544OJ8K5udDwNnmD3KTSF02tN8YHbCX+V4TLzoxvesVE5n5PCGYmZ2NKghagWQsIEFQx/GzEsTLX1tHqfP8nd685vpOnB5tvX+s5UuYsy8Yw8fMWtc2lpz3KdoRLFT8pT84swnbmU1Z/LZhKOdPfbfp+w8UrxpnjpluK+8W3t8TNbfzjrwdvcVFpy55nKmiHzx29SYQzMWh6wqmsvyXz8DY9nKdKpd+NVT/19USlt6yJsaLE2JE7fb44myHqyrXglGPsIfL31mVs2lRIrDmDcLjZiDIOFs6ME5vqqHBqnowpjUQc4X03bxahYF5nUnx8RqHYIrNy/Uq3JzwHUA4B2dM5CaRPBJrEfEycTXz6ovYKS9ack4bxbdHoPspR5nA+mlwptQws42mQkiDMo6TCnxKIgcYE0DzKHT/v/OH7rQr31qVxktQOHVSM2vWB6ChPAKmYvr4+cQlD7bOeP6N8WnQKkOC4GJ1SgliBgJoJKJQwtACZKCSQMKVXB1RM6UjBYKsjYGtnJ8q5qV3dWh0UNSYMKqZG2OCK6QTkbEzJ9NTJzA9UjEz64JtJBGBvXbKqCSpGFnnwyygCIGEklhNUjET44JohBEDCyC0kqBi5/ME7EwigxcVO/vO3/L11mZAnVXMAFaNqZSAu+hBQKGFI5uiTDf0iBRWjX80gYqoRkN8LEy4DS7WYmRQPqBiTqgm5kElA/t66ZEbGdN+gYkyvMOSnFgKwPbhaMMt2AipGInxwzRACIGHkFhJmg5PLH7zTngCa3W2LXnZ2CvfWpX2qVE0A+mJUrQzERR8CIGHk1gpUjFz+4J0JBBT2wtAysEzIk6o5gIpRtTIQFw0JyNlbl4bZ0CZkUDHalAoCpTgB+duDUzx4WocHKkbr8kHwVCEgX8LEFyCjSsQMigNUjEHFhFRIIgASRhL4erfwpAW5/ME77QkI192H7cFJLCT0xUiED64ZQgAkjNxCgoqRyx+8M4GAr5+fKI2m9tZlQp5UzQFUjKqVgbhoSEDO9uA0zIY2IYOK0aZUECjFCciRMLQAGcWDp3V4oGK0Lh8ETxUC8iVMtAAZVcJlVhygYsyqJ2RDBgGQMDKoN/qEJy3I5Q/eaU9A+KSFwu3BaZ8nhROAvhiFiwOh0YSAQglDC5DRJBVahgkqRsuyQdCUIiA+waipXd0oFTDDggEVY1hBIR0yCcjZmJLMsJjuG8bFmF5hyE/FBNC4WNbzZ8hJ8/bW5bIzk16WNsTG0jcb0MdI84NC5XPZ2cnFhuJ2+GW5Kc8wi/6meqwPMi1+sCpsfmBw0Bf7QIBwOBAQEGiehKED2JE7feZ+/uO+QwcOHvxx7czxHnMPxJXyPwQmjx25139HJFvMBi8jeOG84AyeLLPFUUHL9kUVy/xMXhjybH5I+B9wLKjYB8CDQ4FAHYFmS1g9t17e3+47fPTIkXM3Hpyc9nLXqUg20hReWW5afHJumZSicdlZWWyu4EDU58p6lCn8uf7FLy8pEf9dRl1wZqsL065ksquFbmTYxBo9NhESZaoPKkaZUkAgtCWAVuZRuD243OQ09Lp068Lj1JSlnVrq6jR74+713g6DV53KKENHceP3DJ644JOpYyf+FMnmvroVOMd5mN8SvxHO03fdyqvGqp4Er5pg08/ByWrEot/iZHupSpc2y0s64PfFDey/dX6/JVdJ25TwiD+WemUCFaNeTSAiuhFQKGFI5mTllB91en/Qnj1Be7Z/9dVvr6ZOcHp/53D+/JCIc3+FXT7qkfpb+NP6671MTr/NEY+PerWL/P2rq44HEuIeJtw/MPjOp7uvJfwXtDnfJzglKyvr74VmHJnkuBk3pM1q2C8/+/M4zGvX2cWm96Vs3ilGVuo9ehvjj6VedUDFqFcTiIhuBEQTjORsTCk3Jx1z3x1nfpxoOnBx8DbzpBN7Azdt2X87v7yGW39ZaTB4lJOJJlaeGRNVYpgfeXRvUNDxmznc2oiQY+EpNh6u/fU0MM2ezu6OMr1o2jdhVtAabzPlGRLDeo+YhrxjqVInUDGqVALioDsB+Xvrysquq8usFWvWrl2zds3y2aPN9WrzwjZ7Ljz5UtdsgPvMGaO74g7hcaq5Wh27WwhevW3clgRun9KXW6vdVlPuHciql5fkmMXbdDNrvFfKURQSJYoGKkaJMkAQdCegjO3Bq/OeJHOnL1sdMG3iYP3CjCIck/ZmttbVBfo2nlOnen9k9+78prAaG2fT+Kuxz1GnjZtzPyJeFsby54/lmMXbzBW7r6AwJErUDVSMEmWAIGhNQBkShgDoWIxw73F4hc+c2ZM9ArNNLMpDToRkVomRadvTa80P5sE+bn6LfSdNOd5l61qvsbM3fqt9yN8rYJ7X0mMvtWRhNLBzkWW2vVFP47B1fsfeTZKyOda4sWsnI6R/k0RPuVGlaPDUK1UqAXHQlAB66tUWvezsFO6tSyDBuidXX9YYW/c1bV+Zm/pG26a3kfT1YjU78/HL0vZm9pb1HwkeoM2p6tKn6YdbmzDLLc4v0e3auR2G4Ww2xkokJAKZqbIJqJgq6YLtVkAAqZiPr68yJKwVwFJNinBFqRquYLU1EVAoYWgBstbEQ925goqpmzj4YzABORtTMjhr0lMDFSO9BBAAQwjI31uXIUlSMg1QMUqWBYKiGwHYHpzEioGKkQgfXDOEAEgYuYWEe5Tk8gfvtCcgXHcftgcnsZDQFyMRPrhmCAGQMHILCSpGLn/wzgQCvn5+ojSa2tWNCXlSNQdQMapWBuKiIQE5G1PSMBvahAwqRptSQaAUJyB/b12KB0/r8EDFaF0+CJ4qBGB7cBIrASpGInxwzRACIGHkFhKetCCXP3inPQHhkxYKtwenfZ4UTgD6YhQuDoRGEwIKJQwtQEaTVGgZJqgYLcsGQVOKAFpcTBRPU7u6USpghgUDKsawgkI6ZBKQszElmWEx3TeoGNMrDPmpi0BL99ZVV3zM9QMqxtzaQmZqJAASpkbY0q5AxUiED64ZQgAkjNxCgoqRyx+8M4EAWplH4fbgTMiTqjmAilG1MhAXfQgolDAkc/TJhn6RgorRr2YQMdUIGBgYCEOSszEl1WJmUjygYkyqJuRCJgH5e+uSGRnTfYOKMb3CkJ9aCChpe3C1xMo4J6BijCspJKR2AiBhakcu4RBmg5PLH7zTngCaDW6LXnZ2CvfWpX2qVE0A+mJUrQzERR8CIGHk1gpUjFz+4J0JBBT2wtACZEzIk6o5gIpRtTIQFw0JyNmYkobZ0CZkUDHalAoCpTgB+XvrUjx4WocHKkbr8kHwVCEA24OTWAlQMRLhg2uGEAAJI7eQ8KQFufzBO+0JCNfdh+3BSSwk9MVIhA+uGUIAJIzcQoKKkcsfvDOBgK+fnyiNpnZ1Y0KeVM0BriipWhmICwgAAWIEoC9GjBO0AgJAgKoEQMWoWhmICwgAAWIEQMWIcYJWQAAIUJUAqBhVKwNxAQEgQIwAqBgxTtAKCAABqhIAFaNqZSAuIAAEiBEAFSPGCVoBASBAVQKgYlStDMQFBIAAMQKgYsQ4QSsgAASoSgBUjKqVgbiAABAgRgBUjBgnaAUEgABVCYCKUbUyEBcQAALECICKEeMErYAAEKAqAVAxqlYG4gICQIAYAVAxYpygFRAAAlQlACpG1cpAXEAACBAjACpGjBO0AgJAgKoEQMWoWhmICwgAAWIEQMWIcYJWQAAIUJUAqBhVKwNxAQEgQIwAQRWrZqdfO7B4FNp6r6/nxuOhoeeD/9ixeHxfu83hT9OjzmzxsrSwMh/1yf4rj3LL+ALHnJKMiCObvtp25Mz54N+D9py4fDf051/uvsd4ZTkxwZum9TW3sHJaduAaas7DuIXpN4+sHu6zOTih8N2LmONrndGn5q6r958JPblnw7L1gafu5VbVSqbDr4j55bPgZ3W+5L4qYnauOJcjr11tVV78+aB1K05l1PlAlne6CAIQ/Ru/+VaBDAPc4szIcwe27fwjKocjHgK3IP70D/NG97MaNGPzuTQhDokXvyIvPvSXVV+dyqzCf8YtjPt76wJXS6vBvt+dSy+RcXTVa3T0muWnM6WQYHwuOy18/7KhKHLLaZuOnzsfeub4T0vHWfabdvyJoC2/OP7AgqGegZGFXEXUiH/O5xbe+2W6g5X5nBMy0mnSDr8s59GlQH902kw9jkuEuPeWt+SXFb5B515TL5Wwanm0dSdmSdqJFc6eP93Kq5ZviHS2ssPjl+XG/xfo2+xThQg1girWzsh29PiRvZDFdoPcfby9p/p/vOHg3m8GtdUy6usycaxDO/RJL5ePXAeZ6rGw6rybu+ZM2p49evXGJdOn+i9avcSx8K9d/ytEJ42GXs8hE9zsBc1Nnce7o+YamKax7dhp0z4aMW6CvbFhr2E+U8frCj52/GiKd8DSxc6Fv38zz+/H28XiX2h+YezFi+Fn72Rx5OsYrzj26rkrF29kVshkwX+XdP7Irq8+nr8u6MrrGqGp6lfpaVpOruPc3dG/sU5mGsajxg3szJLUIW5xwqnPF2x+2M3/6y8+dumpJfqUX/QoPE171KL/O/idj2bcqfX7ruTWiB3KK0n678iebxb7r913IVdC++oa8YuTwhPbjfxk64GffDXjTnyz41quRNZvk0N/D1q/ZNaaoIuv8KcyS9PIzu0j5x6CItm7+Uyb6j19wVf7/znk374+Ah6nrLQk/3V+Gd4zkVNFZhuWprH1QOsOzT2epddz0KihNoLzgIwX9+WVrT9eyZPDQRWsPjBTTumb/OL8fLb0X3RpsySzbSpLlp6p4/Chts0+VYhQI6hi0qYEf8qqLcb59pb8etd9FfMiAr84mt5loo9LV+GnLL3+s75aNbodvq3CCLVNzM3aYTz2uVuJpY19D/671BtXnvEeXrvVhDzV2+UXJV6/y+Y9DL39VFxLRF5ZhvZTl6xcMWOgWBxleazpf/7zx+GjRw4f/WW9l6XRxFEDDTXEA+WXPtw/f+73b3y2rhhurCmZFK9t79Gj7Ey7mfYb6zGhB9ZGr722OGGNDvZeS9Z8Or2/QKdxLz6vjflot/6mXc3sJkxCUt7GoL22eCNWpwHei1av9LdTiE3YgF/25k2VkYunm05dkCyjYV+eirvzs5+FDkEDzGyGOjUnd2w5w5aXHQVZUTAkypwfLVOx2tKH/4XnYaaePs76UhYqsq6eDSviaQ3pZyH88tR9gbTMJ6z1s27+t6e2uqIC/cXUGNC7R6M1LjsuscC6G8aLOf5fiuxelvBbzE55VNDJCCtL/uNyQoXiq8+6gwyHzhjfU6hNnBf3LrPd3PoZSijV++T/7T6QpDdp/ngrLZwua+p3aC+QPH7ps8RkQ9+gz8YbaxKuNUuzQ4f2ApO80szklG4BP385zrgFyi/yV5YUevM1X3fQrKm922BoTOBSoN8wh34L6i79+Nz86KObth44c2zntuMx+VUNF4Yz9gT/udl3KLoc3hKWlhNzbL3n4L6u606llfC5b2KCAvqa9/P6fv/+9Qs8R09bc+BuHleaKr8sO3z/DzuPnzkR+MMvYU9wF9R8bt7dA0s9xvku3XzqQXEjmur8mOObN+0/c3zXD0ej8yXMii5am45NSDz80JbA4yHHf94SdDlTMFJRH/DU3afPCC7Sh84IvIkCrsm6fvTvO2+xZ9dP7P8jKo/PL0k/ty/o+LngoPULvzwcKbhek89KuhfML0s7t/OXE6Gnf/ly2fo6Jg0wfbYeDtow39PVc+3ByFdcNJzy9N/1Q6ys7D4/fuHAGs/xM4LuF/N5Zc8iDmz++UTI8Z2bf72c8Z6PVRfG7JuBrrU9Nx/59asFk9y8Vv0WmVdXoBmi8vHK0kN27jkeeuaX9Qs21BkXIJDNFk9G4oyU6U6QIz4vflnGuS/d0NjRF8fPHFw1zXX6vthiHr6Z9AnPfRW5f/l4V99PNp18VCwazZA6AxVcJsv/ErVAxfjc4sSQ03Ho+pDVTlu6g8V/lxX/GH2kZaAr8RHLwNK2W+OVF6Fvdm1VYWLY+fu15j5btng3Sgb/dfQDk6XLvEww3puzVxHHJoxx8qPTjJZ94tNNA8u7djG2kJiMaWprC3WHz3kWe+XlYKnLSX5x3NnjD3gaXfWent+7/6/L8a+rcF/kyvTgrxes2JeYFHrgn/vNHoQqTQ/+7uPFvyRnnz90IoZg0DIIcN+m/RdyRxCcMCM0JjCssT/PyQ797qtjehMWTPef2Cls5e47xUbCC0N2fvsxm08f+dzo0clv91zVmbbj+NZJr/79PvBaroaxrYNVO4xTpeM0b8eRo5/3uhq4MfDaK4ns+ezYA+tX3e3tN2/6XP/eMau/ORjLlmjAeXxyzcrdWRN+/uvQ91P78Oov6RDqC98vD9abHDB9tnunfzbvuZkvdpToorXp2Pho6ODIquUP+/rPmjbPu+/9rZ8fiCmuD7j6TX6HUd/8svuzHnEHdv4ZV9K2z+gpTp0wzMJt/oqPXbpWxh5evO7CW/NRfh97mF7avmT79UK+fFa3JYvy7sH+LzacKek1xm+hp8mVwPU7ruVp1F9l83QGzvvp+MG1PaN2rd4bnlerZ96vX/d2WEV2gf4wz/EO3dqysHcxBz/bFGnjPXfaLD+bhM/XHo0tRiMsA6zRtXZVh4Hzfzz2x0rTyzs//+l6YX2B6kpd8fDAxxvOve01xj/Aw/T+roVB4eg0k81WFhmJkrST5S4ijy8jL0zPzL5fNwx7k/im42ivcQ5dUZQymkl+ISoy/9q4aGee5+5jh7dO691Qckz6DJSiSkggRI2arWKc5zGXz567GFsm2w+/tODF++aFILt14YPDy0cP8dsW23/LkW2z7TqIOiX83Pg0a2eHYRMC+mhhhTcuP5Q19C5Qodx7qaauDsMmzUEXjM+uhCVIfp8Uxlj5/N6t1CGD+0lcTvIrMx5eRwN8vcfPWOI7MP/ESp9ZX1+WGLxC2q5j6/vdr3u/mmDKSz21/1JmM0eh9G39vt576Gv3zpXpx46Hyb9kbioJzvPYsNBzYQ+a6qjW5sb+G87uYmKojTSufdu3F6NS6y/Yu9n16aKJ3tPVwqq7W5kbsNrp6mthvOLyBrHW0uvSsT1Ly6Sfgw328sqVJHGqSMROH4nXsureuQ3WpnN3S634P05KyBg/P+XWwxLd4QOtdFis9oZG9X/WanKjr94o6mjSqS4c3deXbz8plZFa07HVvrl/Mjhdq0f3zlpYG8PuVm3Tj4TcZwv/7LfrZmdpotlOvyMaHiwvrZS6s8HS6T1y3qLJTibtMC4HDTtwXhS8k/wWNs1KGKKehav/gukOJlp8LgcZf/+ioLTBgH6XTrosVhc7Z2us6M7VRw3qp+sw1GnQ+DU7g5Y7caND/khta9ndsA2m1bl7D63U4NPRb+oP1+vcsb0Gy8TW2a7d27BbCfXp1PnUsRgz/2NfJxNUGU5NLcbJK3jHlc2WL4eMJGJpd9pN59XNedigfuNXBu39ZGjHDk03E3YG3iTeSuTp2jtY6WEs3Q5G9ddjiqgq/HpKNGi2immZO3st2bJ3i6PsI9uY2I4Q3ARoeFWzM2Mv7ZhVf1MyPI2NuwZpIl7jIQvWrZ9oihVHng5JEBvar8i68azP0B6stn3GB7hoYC9CT0ZKqYgQHifzfor1QFNWe5vxU4Zo8N6eC7ktMdCuCJPgcvLluIkORhLXdHxuZZngC6arq61l5Og2Qhf3Ta6z20a7m/Oi79aN1ypJzXpTqciV9Ocs3W7D5m3ZNFmL9zTrtZwr5qbtapkPnfLxxp3rBkkM6Ina15a9eJLCq34Veelc6JU0Q79d/+dqUkusqyrpU+o7z39X8EJSsyUb1JZmpwj68NKv0hdpmTzsRdTFkPMX0g0X/rjN1YTfrHDwfzvrvthEwLOMh81fPAq7dmjvpcS3Mv7gKGSlaTx0xiK32mtBv4Ulv2n6L5a4uoni4r4rkLrFILMZElfJdFhdhi6Y54bd/GXvfylFwmuxJti2jIzAHUYsL0Xpl75IjBUbOahPXRbVklub7IQPBozZdEvuqCWurs1WsToLWl2d3frry/yK6PdxdbfVwCpi0l4I7vq1M+ozeNQwQQdZcFPSzc5Is412JxPUK8UqKqpEisavqezc11JqiK1tn6mfLx6iUZb+266jor/oNU/vptfy4sLOh15L0+ptr4Hx7obJugVZkXk3S5eXeCH0fFgaZufQAeNFn7ueLTzJ+FX5T57k464ExdnUXU4mO04Y0kUoYg2HtNHr1be/jLwr8p9k5kvePKr7K2o2boS1PlZblZ/5JL/JkTlZ8dR1drSGjuhniJ79wBsn9P3sOsSrP+rDcvIizt2WuLAVloBXqmvjOtV7Krrj7D3WVvIOBhH7gvOgVxfxQUOWYZdekqMGkg1Ymjp6+jJMa3fuZoRhXN2+Y6YIgvGe6m7b2PcmEgpLv0svA4mGWt26GBIZkUSFPrd28oorvWatmjq4q4whD4WsKp+d/WbqjFvmiz6Z4tij6TETg15d9PHDqIZdpIZZZDZDoCXT4WSdWzMj4EqPj1d5D+om7N00wbZlZATuOMTyUpS+po5+B/wXRhZVo26Dl676bDX6N3Mw6ho359UyFcNYXfsPklVzNBDfceiiHZs9OmWGBN+TOaqDelHDp9rrYU/v3n0svG7glSXfeNTDtv6Oplj0Wta+m74arcGLP7r1f3XjX/yKR/cKJs71F57rs5eumG2F8R7+G/5Eur9TkRJeMGqxv/ArOuezlT5GWEn8v7fSK/mCe6ibZ3pOmLkFXfs3SaructJ97GCjum+C2CEs89FzJ5thBYXF9SpoNnGiLT/i/6ZMmDRl8+XUaxuHWk5YcyoFjWrzS/Jye3+6Ylw3rDBii+ckT8//i5A5RiYyHv4wfL1r/VA6xit5VWTx/cdjjdHRQuMRzR4jY3UdNMiElxcedKCgk+SZJCwBJ+pSWHIRF43+RkQ8anJ4UYoRp6y4rBrjvElNeIxZ+fsMFu+rsoyGzlriyMktRM+58UsKczmOHwcMFWvA0rF28e6nVxGdmFVZy31XVFjfdWlvNcq9n0bhvfPhycUcdH/g+uVEiQdrFJ7QLBPnAH9bTgG7hIuG+dm5XNsl05yFtWu6xOWVeQ9uJ6TdPh9eJOgfchrjkThGAaval3f+Cn8rOKKmpLBYsi9WXlxag/EL0u5nYMaTvIeb4FXMaPi0j/txcwvRRSi3pLCA089/lqhZWUlpNZ//Jv1+WrXRTA/xdGqfR568kivwyXnPLhSe+02wJU5Gyl2n103nJcZHXvp1zXQsx0wbqFGRlJBVhnFF0WIyqFZZT129ds1a9O/Tqbay/tg1XUuN7777TuFJUnfX5s5//1yIfvq+ltehVy+jDp2MDNoiBURPWmZGh184ezWRzedrdjUz7d61aweDLgPHTnYxfHb5XHj223c5abGxud1Gz1i6aJJT1/YC1dTqOmiia1/9vFvH/r77/GlKVHSa7thPvKzRTUh+2csHl/89U2/N3Kp3b1uHXrVRl++nJKRzzPp3zD71f//LM7GxMu3aWZfHzkpPS4iMSHpd+OS9Qf/+fXsaotFSgeaUPY34dfv+150HWpl276xTy85OTX10Ozzp3ZsXRYbWA/v21CvPuve0h1fAR3btClIeRf537J+4vEqupol5144dTDrptkHdl6yLgad1/Jb7WNf9/WSxaoszhYf0MzKyGjXCuib+QT6/+kVhr4Av102y1OEVPbmX23PKzGlDumm8S7l+4Hj4q4rK2p5eiydYInMa3HdP4p6aTQiYbNsuPz0h8r/jJ6LzBbh6mnTsaNK5PSY0PsdrsKlmccrV347cyOVW8UwmLJpsjYZVNOqNz/Dsp52fEh954eRfD3P5XG2T3iaGHYw664q+q6gW6TcunAu9l11Zy2rfpW3p88fx10/8sG73fZdFn4+3QKPKz2+cuZDUYcy8KQ4m3W2d++q+ivjtuwOXnmEW4z2c2z25+Oe/sa94Rg4jBuikXTh2Jb1Mt9eYob3Yd06eic7jmtiPH2pZcv+P0CdGdsZF/x4ICil137x9/aReGuy4c0fOxb3hGzmMGm7b08LBwfL1nRtP8rNiMgznr/rE1Uz8Jg9Lp/tAx67v7/1x+N/415qsipjYrOoutiMHDejvOMKu/etrv2379cqzWovx04b3aCf6+4pu+SX+pyC24YP6Ow6xyou48eRdVlySod+XS8f00GAnXDh99v4LrrGDm71m4vkzEWnF7cydXQdbdtevSY+9HpWu4zJjopOpzpvYiMhH+fzedn1ZGZEv+OZOQ+xN+C+aZOU50rTxfjmGhvcMimLCrj96o2Hh2AtLfPiitpejs3ll9NkLSbo2Zvkhe/eHlrh+u2/NpJ5ty5/dPSsAy+po3b+flTE6NQRAhvTIi7j95F12TKLh3PULxyDj1c9vHj2fYmzVs+jir3suvv/o6182TOj2PqkBwqgRwyw6Fzy6cifhDdbToS8r8e4zvoWD8zCnYTLYOg5yGDpMikwj27qvvix3PbX18HkN6q+dfhFhZPM6WTn0szBG557s9O1MdBrKx9LtMXBA99LIQ79dSHzN1axIjc2sMrIbMmjAAKcR4megJFUCkiTRhA8vxhOoLc1JSs0pfXPz29GWvQKOZ1S2KGNeyc3NA3rZeR97zGvR8biDajml7LzCUo5yrCnJinJYFX4Q6pKbG23NLaccy2g56OawVYI7wvA5pYV57FJOLeEDCDVs4RVlc7US2pNIgJ97eZP3op/vvBbE0GeEY6/mDTqoLHKWpl7nrkZ6RIavVBaDtGGqsmouACqyFeSgqWfUtbOe1LPizU0O1x5U7IMRUt4Aq9uIRZ9/ZJR7KyzXbcfegP7CC+9mvvhlz2NiMqqxirSwsOsZ4rf9m2mI2s2VwQo9yBofm16CYSlhF+9kspv5PCe/9HnMg8fooJTwS9efEL6n31KsanbX0jDlH8dCPTbVWAarQAAIAAF1EIC+mDoogw8gAARURwBUTHVswTIQAALqINAsFeOVvSmUsWCWnDgFyyo074jmJ80ry31UNz2gYSGt5puQPKJhfixJS199aPhwPBBoZQSIqxiaMX912+dhch4VxaGrzrscuO6y5IRh5fPV0DMdWD89QDnGG+bHKscaWAECQEC1BIiqGL8s5dR32881o1/FK0sL/n5TSLlq4wfrQAAItHYCBJ/dr8gK27/r0L2iGm5tRXk7Czsz7YKYP4IOR+e8vHX5oaalval+G/77zMu/H7qUlhN+5GCKgVP/mrs7fz4Sn1/D5ZUXa1sMMmtfnh1x5MC/aflZ10Jul5j0tzLSKs/499vpUz45+tJQL/uPjV8eK7RzH6CRdDLwt6jCl3dDHrKs7U3bV6T/G3j4Vn5e4rWzf97XGDFc/GGn6rzII18u/ObE3acV3IIHMS86uc6YgaZvc/OkY2usMq8s4+rBg1eevozYfyDV0MneTJ9Vln7+l79iCnNu/7EzJMvIbpCZQRvh08ydXefMdOjMQjfObxzd82/au4zw05Hve9hYdap59u/mSR6f7M3RN83+84t1pwvtRg0z1W3J8wut/fSD/IGAEggQ7Ivp9hk3wRE9LGnqPm/NXJeu3GchO1b+rj154exZE/WDl++/WViWc35bwBa2y/zZXqOMonZu/zPZaNzUwe2wdj3c561e5NIVk7HyFG65orY12ecl15nKSj6xaWPBIH//GYsWT+zJFV9qns/J+Pvz+XuyJ//0v6Mbp/Ru1zCFrRIXm9jCbDn/bZwVVDRyxqwpLsZ3dm34X0KFzKWaxMDyi3ErQL3TNbe3RRPaKxKK9MdMdHcwaauEQoAJIAAEWkiAoIpJWq99FX3u1tsuxh2122jq6OoW3b2TlHj37/C33c16dNDSH7zg0NEf5zlJLLAtd+Up0XJFC3pkXJdcZyoxr6ySc+HHL3eGPirrv3zlcLFJopz8xPvxvG7Og3rpYBrtDTvULyeAjy31XUP0NTl3L14uMrbsYcDSd1p05Pd98x10ZS3VJJYtl930ClC6w4c69puwem/gp8Mk1+9pYS3gMCAABFpCoEUqVpabnlSC5UZfOhv6X6rhgqAvxui+SkPv1L1YehYj3Ad1lZxkoGjlKeGh+HWm7JzmbVzn3ibywNrpI2d/dz1XbMmo99mJaTLWqsLHZqLR8Fyv0L4wSn1zlzGOaLFKGUs1iXMkvAJUS+DDMUAACCiBQItUTLtjN7SS0nuDvmMn1y194+Xu1BctVImlpWYVyV6aTtHKU8JM8OtMWbJYtksOXbh8fLOP9bOzP5x71LhIl6aufsPmPuIc8LHZdmwYsRLaz36U+bZxvoKMpZrEzWkSWQGKwIJlSigVmAACQEAmgWaqWEVFZeGj2xmdR3o7aXDun7+UXMxFg993Lqd0dEcrr3KuHDp2rxDtnlCcdi+5qM4fp6K8rPBBVGr7IXJXnhLGhl9n6vaNI8ciSw36uM7fuMFHz6xLx8Zl6ITLMebdf/SiUnxpp7YW0rHFFzVolnDd1/zLh05HFVZj3KLkqLSiZ/ilmiRUTN4KUMKGhBYsg9MPCAABVREgeI8Sw9rq6bGexVy5m649fIbnAMv+g2za50Yc/D+0PBXPwtV7lGW3AcOGGrBv//HTzjNp1d2cJ4821zPUxR7HhEc+bTdymkefrj0HSq881bb86a3gv8WXK9LqYuMssc6UY23KzbsPMl4VPo2NrfZYEeBiot3QsWqj08NukGl59P7DIUlvNDTfxaK5ysb9XBz79xs8WDK2ng1LXLE0OtuOdO5UfOuP7T+FpNR0c/EabmZkqC+9VJONRU3sX+diCwWLajnbdreQXgGqB/f5rX9PXEst4xn1GWRr1aVhgTC0+lhnGOhX1ZkKdoFAUwQYMxucW8Z+W6XdiWILvcCJBwSAgMoJMEbFVE4KHAABIEBNAs0cF6NmEhAVEAACrZgAqFgrLj6kDgQYQQBUjBFlhCSAQCsmACrWiosPqQMBRhAAFWNEGSEJINCKCYCKteLiQ+pAgBEEQMUYUUZIAgi0YgKgYq24+JA6EGAEAVAxRpQRkgACrZgAqFgrLj6kDgQYQQBUjBFlhCSAQCsm8P+glhZEMqp9QAAAAABJRU5ErkJggg==" },
  { texto: "La estratificación: ¿es el efecto que le permite al humo llegar a las partes más altas de una bodega?", tipo: "vf", opciones: ["Falso", "Verdadero"], correcta: 0 },
  { texto: "Los detectores de humo deben separarse de toda corriente de aire al menos _______.", tipo: "mc", opciones: ["15cm", "0.9m", "4.5m"], correcta: 1 },
  { texto: "En un corredor menor a 6.1m de ancho, ¿cuál es la separación máxima entre dispositivos de notificación visual?", tipo: "mc", opciones: ["15m", "4.57m", "30.5m", "20ft"], correcta: 0 },
  { texto: "Salvavidas de Centroamérica cuenta con personal certificado en múltiples marcas de detección de incendios. ¿En cuál de los siguientes fabricantes somos distribuidores directos en la oficina de Costa Rica?", tipo: "mc", opciones: ["Notifier", "Simplex", "Edwards", "Todos los anteriores"], correcta: 1 },
  { texto: "¿Cuál de las siguientes normas establece los requerimientos mínimos para la instalación, prueba y mantenimiento de los sistemas de alarma y detección?", tipo: "mc", opciones: ["NFPA 72", "NFPA 70", "NFPA 101"], correcta: 0 },
];
const PUNTOS_POR_PREGUNTA_NFPA72 = 10;

function JuegoNFPA72({ onGanarPuntos }) {
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);
  const ganadasRef = React.useRef(new Set());
  const falladasRef = React.useRef(new Set());

  const responder = (i, valor) => setRespuestas((prev) => ({ ...prev, [i]: valor }));
  const reiniciarExamen = () => { setRespuestas({}); setResultado(null); };

  const enviarExamen = () => {
    if (PREGUNTAS_NFPA72.some((_, i) => respuestas[i] === undefined)) {
      setResultado({ ok: null, msg: "Debes responder las " + PREGUNTAS_NFPA72.length + " preguntas antes de enviar el examen." });
      return;
    }
    const detalle = PREGUNTAS_NFPA72.map((p, i) => respuestas[i] === p.correcta);
    const correctas = detalle.filter(Boolean).length;
    const total = PREGUNTAS_NFPA72.length;
    const porcentaje = Math.round((correctas / total) * 100);
    let puntosGanados = 0;
    detalle.forEach((esCorrecta, i) => {
      if (esCorrecta && !ganadasRef.current.has(i)) {
        ganadasRef.current.add(i);
        falladasRef.current.delete(i);
        puntosGanados += PUNTOS_POR_PREGUNTA_NFPA72;
      } else if (!esCorrecta && !falladasRef.current.has(i) && !ganadasRef.current.has(i)) {
        falladasRef.current.add(i);
        puntosGanados -= PUNTOS_POR_PREGUNTA_NFPA72;
      }
    });
    if (puntosGanados !== 0) onGanarPuntos && onGanarPuntos("Examen Básico NFPA 72", puntosGanados);
    const aprobado = porcentaje >= 70;
    const rangoResultado = rangoResultadoExamen(porcentaje);
    setResultado({
      ok: aprobado, detalle, rangoResultado,
      msg: aprobado
        ? `${correctas}/${total} correctas (${porcentaje}%).${porcentaje < 100 ? " Para llegar al rango Senior necesitas 100% en todos los módulos." : ""}`
        : `${correctas}/${total} correctas (${porcentaje}%). Se necesita al menos 70% para aprobar. Las preguntas falladas restan puntos y podrían hacerte perder insignias si tu puntaje baja del umbral. Revisa las preguntas marcadas en rojo y vuelve a intentar.`,
    });
  };

  if (mostrarIntro) {
    const TEMAS_NFPA72 = [
      {
        id: "que_es_nfpa", titulo: "¿Qué es la NFPA?",
        contenido: (
          <>
            <p>La <strong>Asociación Nacional de Protección contra el Fuego (NFPA)</strong> es el organismo internacional
            especializado en prevención, seguridad humana y protección contra incendios. Publica un paquete completo de normas
            técnicas usadas en todo el mundo como referencia para el diseño, instalación y mantenimiento de sistemas de
            protección contra incendios.</p>
            <p>En Costa Rica, la totalidad del paquete normativo de la NFPA es de <strong>aplicación obligatoria</strong>, según
            lo establecido en el artículo 66 del Decreto N° 37615-MP (Gaceta N° 66 del 5 de abril de 2013) y su reforma
            (Decreto Ejecutivo N° 43733 del 12 de octubre de 2022) — salvo las excepciones establecidas en el reglamento para
            el sector de diseño y construcción.</p>
          </>
        ),
      },
      {
        id: "nfpa101_72", titulo: "NFPA 101 vs NFPA 72",
        contenido: (
          <>
            <p><strong>NFPA 101 — Código de Seguridad Humana:</strong> establece los requisitos de diseño de edificaciones
            enfocados en proteger la vida de las personas — rutas de evacuación, salidas de emergencia, ocupación máxima, etc.</p>
            <p><strong>NFPA 72 — Código Nacional de Alarmas de Incendio y Señalización:</strong> es la norma específica que
            establece los requisitos mínimos para la <strong>instalación, prueba y mantenimiento</strong> de los sistemas de
            alarma y detección de incendios — la norma central del trabajo diario de Salvavidas de Centroamérica.</p>
          </>
        ),
      },
      {
        id: "cableados", titulo: "Definiciones de cableado",
        contenido: (
          <>
            <p>Un sistema de detección de incendios usa varios tipos de circuitos, cada uno con una función distinta:</p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
              <li><strong>NAC / SIG</strong> (Circuito de Aparatos de Notificación): alimenta y controla bocinas, lámparas y
              strobes que avisan a las personas sobre la emergencia.</li>
              <li><strong>SLC</strong> (Línea de Circuito de Señales): el circuito que comunica al panel con los dispositivos
              direccionables (detectores, módulos), permitiendo identificar cada uno individualmente.</li>
              <li><strong>IDNAC</strong>: como el NAC, pero para dispositivos de notificación <strong>direccionables</strong>
              (cada uno tiene su propia dirección dentro del circuito).</li>
              <li><strong>AUX</strong>: salida de 24 Voltios DC, usada para alimentar accesorios del sistema.</li>
              <li><strong>IDC</strong> (Circuito de Dispositivos de Iniciación): circuito convencional que conecta los
              dispositivos que inician una alarma (detectores, estaciones manuales) sin direccionamiento individual.</li>
            </ul>
          </>
        ),
      },
      {
        id: "detectores", titulo: "Detectores de humo",
        contenido: (
          <>
            <p>Existen dos tecnologías principales de detección de humo:</p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
              <li><strong>Iónico:</strong> detecta partículas de combustión muy pequeñas, ideal para fuegos de llama abierta y
              rápida propagación.</li>
              <li><strong>Fotoeléctrico:</strong> detecta partículas de humo más grandes mediante un haz de luz, ideal para
              fuegos de combustión lenta (humeantes).</li>
            </ul>
            <p><strong>Detectores para ductos:</strong> tienen limitaciones específicas importantes — NO son sustitutos de los
            detectores para áreas abiertas, NO son sustitutos para detección de alerta temprana, y NO reemplazan al sistema de
            detección de fuego general de un edificio. Su función es específicamente detener la propagación de humo a través
            del sistema de ventilación (HVAC).</p>
          </>
        ),
      },
      {
        id: "cobertura", titulo: "Cobertura y espaciamiento",
        contenido: (
          <>
            <p>La cobertura de un detector de humo (el área que puede vigilar de forma confiable) cambia según varios
            factores: el tipo de cielorraso, la presencia de vigas, la altura del techo, y la distancia a paredes o corrientes
            de aire.</p>
            <p><strong>Cielorrasos con vigas:</strong> cuando la profundidad de las vigas es ≥10% de la altura del cielorraso, y
            la separación entre vigas es ≥40% de esa misma altura, el detector debe ubicarse <strong>en el espacio entre
            vigas</strong> (no sobre ellas), ya que el humo se acumula ahí antes de esparcirse por todo el cielorraso.</p>
            <p>Estas reglas de espaciamiento son las que se evalúan en detalle en el examen — repásalas junto con las medidas
            específicas (distancias a paredes, corrientes de aire, cocinas, etc.) antes de presentarlo.</p>
          </>
        ),
      },
      {
        id: "reglas_examen", titulo: "Reglas del Examen Básico",
        contenido: (
          <>
            <p>El <strong>Examen Básico</strong> tiene {PREGUNTAS_NFPA72.length} preguntas y se responde completo de una sola vez.</p>
            <p>Si apruebas {PREGUNTAS_NFPA72.length}/{PREGUNTAS_NFPA72.length}, sumas <strong>{PREGUNTAS_NFPA72.length * PUNTOS_POR_PREGUNTA_NFPA72} puntos</strong> al
            segmento y al total. Si te equivocas en alguna, el examen se reinicia por completo — no se puede corregir solo la
            pregunta fallada, hay que repasar y presentarlo entero otra vez.</p>
          </>
        ),
      },
    ];
    return <GuiaPorTemas temas={TEMAS_NFPA72} onContinuar={() => setMostrarIntro(false)} tituloModulo="lo esencial de NFPA 72" />;
  }

  return (
    <Card
      title="Examen Básico — NFPA 72"
      action={<Btn small variant="ghost" onClick={() => setMostrarIntro(true)}>Ver la guía otra vez</Btn>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {PREGUNTAS_NFPA72.map((p, i) => {
          const correctaMostrada = resultado?.detalle;
          const esCorrecta = correctaMostrada ? correctaMostrada[i] : null;
          return (
            <div key={i} style={{
              border: `1px solid ${T.line}`, borderRadius: 10, padding: 14,
              background: correctaMostrada ? (esCorrecta ? T.greenSoft : T.redSoft) : T.graySoft,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{i + 1}. {p.texto}</div>
              {p.imagen && <img src={p.imagen} alt="Figura de referencia" style={{ maxWidth: 220, borderRadius: 8, border: `1px solid ${T.line}`, marginBottom: 10, display: "block" }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {p.opciones.map((op, j) => (
                  <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="radio" name={`p${i}`} checked={respuestas[i] === j} onChange={() => responder(i, j)} />
                    {op}
                  </label>
                ))}
              </div>
              {correctaMostrada && !esCorrecta && (
                <div style={{ fontSize: 11.5, color: T.red, marginTop: 8 }}>Respuesta correcta: {p.opciones[p.correcta]}</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <Btn variant="accent" onClick={enviarExamen}>Enviar examen</Btn>
        {resultado && <Btn variant="ghost" onClick={reiniciarExamen}>Empezar de nuevo</Btn>}
        {resultado && resultado.rangoResultado && (
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: resultado.rangoResultado.color, padding: "5px 12px", borderRadius: 999 }}>{resultado.rangoResultado.texto}</span>
        )}
        {resultado && <span style={{ fontSize: 14, color: resultado.ok === true ? T.green : resultado.ok === false ? T.red : T.inkSoft, fontWeight: 600 }}>{resultado.msg}</span>}
      </div>
    </Card>
  );
}

// Módulo Electrónica Básica: guía con los fundamentos (Ley de Ohm,
// resistencias y código de colores, diodos, tensión/corriente DC-AC,
// Ley de Watt) y un examen clasificado por nivel — Básico e Intermedio
// cubren fundamentos y cálculos; Avanzado cubre las leyes de circuitos
// (Kirchhoff, Superposición, Norton, Thevenin). Usa la misma regla de
// "todo o nada por nivel" que los demás módulos de ejercicios.
const CODIGO_COLORES_RESISTENCIAS = [
  { color: "Negro", valor: 0 }, { color: "Marrón", valor: 1 }, { color: "Rojo", valor: 2 },
  { color: "Naranja", valor: 3 }, { color: "Amarillo", valor: 4 }, { color: "Verde", valor: 5 },
  { color: "Azul", valor: 6 }, { color: "Violeta", valor: 7 }, { color: "Gris", valor: 8 }, { color: "Blanco", valor: 9 },
];

const NIVELES_ELECTRONICA = {
  "Básico": [
    { texto: "La Ley de Ohm relaciona Voltaje (V), Corriente (I) y Resistencia (R). ¿Cuál es la fórmula correcta?", tipo: "mc", opciones: ["V = I / R", "V = I × R", "V = R / I", "I = V × R"], correcta: 1 },
    { texto: "¿Qué es una resistencia (componente electrónico)?", tipo: "mc", opciones: ["Un componente que se opone/limita al paso de la corriente eléctrica.", "Un componente que genera corriente eléctrica.", "Un componente que almacena carga eléctrica.", "Un componente que convierte AC en DC."], correcta: 0 },
    { texto: "En el código de colores, una resistencia con bandas Marrón–Negro–Rojo representa:", tipo: "mc", opciones: ["10 Ω", "100 Ω", "1,000 Ω (1 kΩ)", "10,000 Ω (10 kΩ)"], correcta: 2 },
    { texto: "¿Cuál es la unidad de medida de la Tensión (diferencia de potencial)?", tipo: "mc", opciones: ["Amperio (A)", "Voltio (V)", "Watt (W)", "Ohmio (Ω)"], correcta: 1 },
    { texto: "¿Cuál es la unidad de medida de la Corriente eléctrica?", tipo: "mc", opciones: ["Voltio (V)", "Ohmio (Ω)", "Amperio (A)", "Watt (W)"], correcta: 2 },
    { texto: "¿Qué es un diodo y cuál es su función principal?", tipo: "mc", opciones: ["Un semiconductor que permite el paso de corriente en un solo sentido.", "Un componente que aumenta el voltaje del circuito.", "Un componente que mide la corriente.", "Un tipo de resistencia variable."], correcta: 0 },
    { texto: "La corriente DC (directa) cambia de polaridad periódicamente con el tiempo.", tipo: "vf", opciones: ["Falso", "Verdadero"], correcta: 0 },
    { texto: "¿Cómo se conecta un multímetro para medir Corriente en un circuito?", tipo: "mc", opciones: ["En paralelo con el componente.", "En serie con el circuito, en modo amperímetro.", "Directamente a la fuente sin el circuito.", "No se puede medir la corriente con un multímetro."], correcta: 1 },
  ],
  "Intermedio": [
    { texto: "En una conexión de resistencias en SERIE, la resistencia total se calcula como:", tipo: "mc", opciones: ["Rt = R1 + R2 + R3 ...", "Rt = 1 / (1/R1 + 1/R2)", "Rt = R1 × R2", "Rt = (R1 + R2) / 2"], correcta: 0 },
    { texto: "En una conexión de DOS resistencias en PARALELO, la resistencia total se calcula como:", tipo: "mc", opciones: ["Rt = R1 + R2", "Rt = (R1 × R2) / (R1 + R2)", "Rt = R1 - R2", "Rt = R1 × R2 × 2"], correcta: 1 },
    { texto: "¿Cómo se conecta un multímetro para medir Voltaje respecto a un componente o circuito?", tipo: "mc", opciones: ["En serie con el circuito.", "En paralelo con el componente o circuito.", "Se debe abrir el circuito primero.", "No se puede medir con multímetro."], correcta: 1 },
    { texto: "La Ley de Watt (potencia eléctrica) se calcula como:", tipo: "mc", opciones: ["P = V / I", "P = V + I", "P = V × I", "P = I / V"], correcta: 2 },
    { texto: "Si un circuito tiene 12V y consume 2A, ¿cuál es su potencia?", tipo: "mc", opciones: ["6 W", "14 W", "24 W", "48 W"], correcta: 2 },
    { texto: "Si un circuito tiene una resistencia de 100Ω y se le aplican 12V, ¿cuál es la corriente (usando I = V/R)?", tipo: "mc", opciones: ["0.12 A", "1.2 A", "12 A", "120 A"], correcta: 0 },
  ],
  "Avanzado": [
    { texto: "La Ley de Corrientes de Kirchhoff (LKC) establece que en un nodo:", tipo: "mc", opciones: ["La suma de corrientes que entran es igual a la suma de las que salen.", "El voltaje siempre es cero.", "La resistencia total es infinita.", "La corriente siempre se duplica."], correcta: 0 },
    { texto: "La Ley de Voltajes de Kirchhoff (LKV) establece que en una malla cerrada:", tipo: "mc", opciones: ["La suma de las caídas de voltaje es igual a cero.", "La corriente siempre es cero.", "El voltaje se duplica en cada componente.", "Solo aplica a corriente DC."], correcta: 0 },
    { texto: "El Teorema de Superposición permite analizar un circuito con varias fuentes:", tipo: "mc", opciones: ["Calculando el efecto de cada fuente por separado y sumando los resultados.", "Eliminando todas las fuentes menos una para siempre.", "Solo funciona con una fuente a la vez sin poder sumar.", "No aplica a circuitos con más de una fuente."], correcta: 0 },
    { texto: "El Teorema de Thevenin simplifica un circuito complejo a:", tipo: "mc", opciones: ["Una fuente de corriente en paralelo con una resistencia.", "Una fuente de voltaje equivalente en serie con una resistencia equivalente.", "Solo una resistencia, sin fuente.", "Un circuito abierto."], correcta: 1 },
    { texto: "El Teorema de Norton simplifica un circuito complejo a:", tipo: "mc", opciones: ["Una fuente de voltaje en serie con una resistencia.", "Un circuito en cortocircuito.", "Una fuente de corriente equivalente en paralelo con una resistencia equivalente.", "Solo un capacitor."], correcta: 2 },
  ],
};
const PUNTOS_POR_PREGUNTA_ELECTRONICA = 10;

function JuegoElectronicaBasica({ onGanarPuntos }) {
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [nivel, setNivel] = useState("Básico");
  const [respuestas, setRespuestas] = useState({});
  const [resultado, setResultado] = useState(null);
  const ganadasRef = React.useRef({});
  const falladasRef = React.useRef({});

  const preguntas = NIVELES_ELECTRONICA[nivel];
  const responder = (i, valor) => setRespuestas((prev) => ({ ...prev, [i]: valor }));
  const cambiarNivel = (n) => { setNivel(n); setRespuestas({}); setResultado(null); };

  const enviarNivel = () => {
    if (preguntas.some((_, i) => respuestas[i] === undefined)) {
      setResultado({ ok: null, msg: "Responde todas las preguntas de este nivel antes de enviar." });
      return;
    }
    if (!ganadasRef.current[nivel]) ganadasRef.current[nivel] = new Set();
    if (!falladasRef.current[nivel]) falladasRef.current[nivel] = new Set();
    const detalle = preguntas.map((p, i) => respuestas[i] === p.correcta);
    const correctas = detalle.filter(Boolean).length;
    const total = preguntas.length;
    const porcentaje = Math.round((correctas / total) * 100);
    let puntosGanados = 0;
    detalle.forEach((esCorrecta, i) => {
      if (esCorrecta && !ganadasRef.current[nivel].has(i)) {
        ganadasRef.current[nivel].add(i);
        falladasRef.current[nivel].delete(i);
        puntosGanados += PUNTOS_POR_PREGUNTA_ELECTRONICA;
      } else if (!esCorrecta && !falladasRef.current[nivel].has(i) && !ganadasRef.current[nivel].has(i)) {
        falladasRef.current[nivel].add(i);
        puntosGanados -= PUNTOS_POR_PREGUNTA_ELECTRONICA;
      }
    });
    if (puntosGanados !== 0) onGanarPuntos && onGanarPuntos(nivel, puntosGanados);
    const aprobado = porcentaje >= 70;
    const rangoResultado = rangoResultadoExamen(porcentaje);
    setResultado({
      ok: aprobado, detalle, rangoResultado,
      msg: aprobado
        ? `Nivel ${nivel} — ${correctas}/${total} correctas (${porcentaje}%).${porcentaje < 100 ? " Para el rango Senior necesitas 100% en todos los módulos." : ""}`
        : `${correctas}/${total} correctas (${porcentaje}%) — se necesita al menos 70% para aprobar. Las preguntas falladas restan puntos y podrían hacerte perder insignias si tu puntaje baja del umbral. Revisa las marcadas en rojo y vuelve a intentar.`,
    });
  };
  const reiniciarNivel = () => { setRespuestas({}); setResultado(null); };

  if (mostrarIntro) {
    const TEMAS_ELECTRONICA = [
      {
        id: "ohm", titulo: "Ley de Ohm",
        contenido: (
          <>
            <p>La Ley de Ohm es la relación fundamental entre las tres magnitudes básicas de un circuito eléctrico:
            <strong> Voltaje (V)</strong>, <strong>Corriente (I)</strong> y <strong>Resistencia (R)</strong>.</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 14, fontWeight: 700 }}>V = I × R</div>
            <p>De esta fórmula se derivan las otras dos formas, según qué dato tengas y cuál necesites calcular:</p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
              <li><strong>I = V / R</strong> — para calcular la corriente si conoces el voltaje y la resistencia.</li>
              <li><strong>R = V / I</strong> — para calcular la resistencia si conoces el voltaje y la corriente.</li>
            </ul>
            <p><strong>Ejemplo práctico:</strong> si un circuito tiene una fuente de 12V y una resistencia de 100Ω, la corriente
            que circula es I = 12/100 = <strong>0.12 A</strong>. Esta ley es la base para calcular casi cualquier valor eléctrico
            en instalaciones de detección de incendios (por ejemplo, para dimensionar circuitos NAC o IDC).</p>
            <a href="https://www.youtube.com/watch?v=MIJiPhtpAF8" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Ley de Ohm
            </a>
          </>
        ),
      },
      {
        id: "resistencias", titulo: "Resistencias y código de colores",
        contenido: (
          <>
            <p>Una <strong>resistencia</strong> es un componente electrónico que se opone al paso de la corriente eléctrica,
            limitándola a un valor controlado. Se mide en <strong>Ohmios (Ω)</strong>.</p>
            <p>Como las resistencias son físicamente pequeñas, su valor no se escribe con números sino con un
            <strong> código de colores</strong>: cada banda de color representa un dígito, y la última banda suele ser un
            multiplicador (o la tolerancia). Estos son los valores que representa cada color:</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 12px" }}>
              {CODIGO_COLORES_RESISTENCIAS.map((c) => (
                <div key={c.color} style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: "4px 8px", fontSize: 11.5 }}>
                  <b>{c.color}</b> = {c.valor}
                </div>
              ))}
            </div>
            <p><strong>Ejemplo:</strong> una resistencia con bandas Marrón–Negro–Rojo se lee así: el primer color (Marrón=1) y
            el segundo (Negro=0) forman el número "10", y el tercero (Rojo=2) es el multiplicador ×100. Resultado: 10 × 100 =
            <strong> 1,000 Ω (1 kΩ)</strong>.</p>
            <a href="https://www.youtube.com/watch?v=YdaiLW4WOWo" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Código de colores de resistencias
            </a>
          </>
        ),
      },
      {
        id: "serie", titulo: "Resistencias en Serie",
        contenido: (
          <>
            <p><strong>En serie</strong> (una resistencia después de otra, en la misma línea): la resistencia total es
            simplemente la suma de todas.</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 13, fontWeight: 700 }}>Rt = R1 + R2 + R3 + ...</div>
            <p><strong>Ejemplo:</strong> tres resistencias de 100Ω, 220Ω y 330Ω en serie dan Rt = 100 + 220 + 330 =
            <strong> 650Ω</strong>. La resistencia total en serie siempre es MAYOR que la más grande de las resistencias
            individuales.</p>
            <a href="https://www.youtube.com/watch?v=5_4eQqBJSB8" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Resistencias en Serie
            </a>
          </>
        ),
      },
      {
        id: "paralelo", titulo: "Resistencias en Paralelo",
        contenido: (
          <>
            <p><strong>En paralelo</strong> (varias resistencias conectadas entre los mismos dos puntos): la resistencia total
            siempre es MENOR que la más pequeña de las resistencias individuales. Para dos resistencias:</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 13, fontWeight: 700 }}>Rt = (R1 × R2) / (R1 + R2)</div>
            <p>Para tres o más resistencias en paralelo, se usa la fórmula general: 1/Rt = 1/R1 + 1/R2 + 1/R3 ...</p>
            <p><strong>Ejemplo:</strong> dos resistencias de 100Ω en paralelo dan Rt = (100×100)/(100+100) = 10,000/200 =
            <strong> 50Ω</strong> — la mitad de cada una, por ser iguales.</p>
            <a href="https://www.youtube.com/watch?v=UQqSrMOpC-c" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Resistencias en Paralelo
            </a>
          </>
        ),
      },
      {
        id: "diodo", titulo: "Diodos",
        contenido: (
          <>
            <p>Un <strong>diodo</strong> es un componente semiconductor que permite el paso de la corriente eléctrica en
            <strong> un solo sentido</strong> (del ánodo al cátodo) y la bloquea en sentido contrario — funciona como una
            "válvula" eléctrica de un solo sentido.</p>
            <p><strong>Funciones comunes de un diodo:</strong></p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
              <li>Rectificación: convertir corriente alterna (AC) en corriente directa (DC) pulsante.</li>
              <li>Protección: evitar que la corriente circule en sentido inverso y dañe otros componentes (por ejemplo, en bobinas de relés).</li>
              <li>Indicación visual: los LED (diodos emisores de luz) son un tipo de diodo que emite luz al circular corriente en el sentido correcto.</li>
            </ul>
            <p>Si se conecta con la polaridad invertida, el diodo normalmente NO deja pasar corriente (a menos que se exceda su
            voltaje de ruptura, lo cual puede dañarlo).</p>
            <a href="https://www.youtube.com/watch?v=aPY3I8pG478" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — El Diodo
            </a>
          </>
        ),
      },
      {
        id: "tension_corriente", titulo: "Tensión, Corriente, DC y AC",
        contenido: (
          <>
            <p><strong>Tensión o diferencia de potencial:</strong> es la "fuerza" que empuja a los electrones a moverse por un
            circuito. Se mide en <strong>Voltios (V)</strong>. Para medirla con un multímetro, se conecta
            <strong> en paralelo</strong> con el componente o circuito (sin interrumpirlo).</p>
            <p><strong>Corriente eléctrica:</strong> es el flujo de electrones que circula por el circuito. Se mide en
            <strong> Amperios (A)</strong>. Para medirla con un multímetro, hay que <strong>interrumpir el circuito</strong> y
            conectar el multímetro <strong>en serie</strong>, en modo amperímetro.</p>
            <p><strong>DC (Corriente Directa):</strong> fluye siempre en el mismo sentido, con polaridad fija (positivo y
            negativo no cambian). Ejemplos: baterías, paneles de alarma, circuitos IDC/SLC.</p>
            <p><strong>AC (Corriente Alterna):</strong> cambia de sentido y polaridad periódicamente (en Costa Rica, 60 veces
            por segundo — 60Hz). Ejemplo: la energía eléctrica que llega de la red comercial (120V/240V) a un panel de alarma.</p>
          </>
        ),
      },
      {
        id: "watt", titulo: "Ley de Watt (Potencia)",
        contenido: (
          <>
            <p>La <strong>Potencia eléctrica</strong> mide cuánta energía consume o entrega un circuito por unidad de tiempo.
            Se mide en <strong>Watts (W)</strong>, y se calcula con la Ley de Watt:</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 14, fontWeight: 700 }}>P = V × I</div>
            <p><strong>Ejemplo:</strong> un dispositivo de notificación (bocina/lámpara) que trabaja a 24V y consume 0.5A tiene
            una potencia de P = 24 × 0.5 = <strong>12W</strong>. Este cálculo es clave para dimensionar la capacidad de las
            fuentes de poder y baterías de respaldo en un sistema de alarma.</p>
            <a href="https://www.youtube.com/watch?v=nT1t_DbO3xU" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Ley de Watt
            </a>
          </>
        ),
      },
      {
        id: "kirchhoff", titulo: "Leyes de Kirchhoff",
        contenido: (
          <>
            <p>Las <strong>Leyes de Kirchhoff</strong> son dos reglas fundamentales para analizar circuitos con varias mallas o
            varios nodos, donde la Ley de Ohm sola no alcanza.</p>
            <p><strong>Ley de Corrientes de Kirchhoff (LKC):</strong> en cualquier nodo (punto donde se unen varios cables), la
            suma de las corrientes que ENTRAN es igual a la suma de las corrientes que SALEN. Ninguna corriente "desaparece".</p>
            <p><strong>Ley de Voltajes de Kirchhoff (LKV):</strong> en cualquier malla cerrada (recorrido cerrado del circuito),
            la suma de todas las caídas y subidas de voltaje es igual a cero.</p>
            <p>Estas dos leyes permiten plantear ecuaciones para resolver circuitos complejos con varias fuentes y ramas, algo
            muy común al analizar paneles con múltiples circuitos NAC/SLC compartiendo una misma fuente.</p>
          </>
        ),
      },
      {
        id: "superposicion", titulo: "Teorema de Superposición",
        contenido: (
          <>
            <p>El <strong>Teorema de Superposición</strong> aplica a circuitos lineales con <strong>más de una fuente</strong>
            de energía (por ejemplo, dos baterías o una batería más una fuente AC).</p>
            <p>El método consiste en: analizar el circuito considerando <strong>una sola fuente activa a la vez</strong>
            (las demás fuentes de voltaje se cortocircuitan, y las de corriente se dejan en circuito abierto), calcular el
            efecto (voltaje o corriente) que produce esa fuente sola, repetir el proceso para cada fuente, y finalmente
            <strong> sumar algebraicamente todos los resultados</strong> para obtener el valor real total.</p>
            <p>Es especialmente útil cuando resulta más simple analizar el efecto de cada fuente por separado que resolver
            todo el circuito de una sola vez.</p>
            <a href="https://www.youtube.com/watch?v=Ygx2dQIwe7Q" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Teorema de Superposición
            </a>
          </>
        ),
      },
      {
        id: "thevenin", titulo: "Teorema de Thevenin",
        contenido: (
          <>
            <p>El <strong>Teorema de Thevenin</strong> permite simplificar cualquier circuito lineal complejo, visto desde dos
            terminales específicas, a un circuito equivalente mucho más simple: <strong>una sola fuente de voltaje (Vth) en
            serie con una sola resistencia (Rth)</strong>.</p>
            <p>Esto es muy útil cuando se quiere analizar cómo se comporta un circuito grande frente a distintas cargas
            conectadas en un mismo punto, sin tener que resolver todo el circuito completo cada vez que la carga cambia — solo
            se calcula Vth y Rth una vez, y luego se analiza fácilmente con cualquier carga.</p>
            <a href="https://www.youtube.com/watch?v=yoGGTfONnwE" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Ley de Thevenin
            </a>
          </>
        ),
      },
      {
        id: "norton", titulo: "Teorema de Norton",
        contenido: (
          <>
            <p>El <strong>Teorema de Norton</strong> es el "hermano" del Teorema de Thevenin: también simplifica un circuito
            complejo visto desde dos terminales, pero en vez de una fuente de voltaje, lo reduce a
            <strong> una fuente de corriente (In) en paralelo con una resistencia (Rn)</strong>.</p>
            <p>De hecho, el circuito de Norton y el de Thevenin son matemáticamente equivalentes y se pueden convertir uno en
            el otro — la resistencia Rn es igual a Rth, y la corriente In se relaciona con Vth mediante la Ley de Ohm
            (In = Vth / Rth).</p>
            <a href="https://www.youtube.com/watch?v=PIA7oywgQR8&t=680s" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "8px 12px", background: T.redSoft, color: T.red, borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
              ▶ Ver video explicativo — Ley de Norton
            </a>
          </>
        ),
      },
    ];
    return <GuiaPorTemas temas={TEMAS_ELECTRONICA} onContinuar={() => setMostrarIntro(false)} tituloModulo="Electrónica Básica" />;
  }

  return (
    <Card
      title="Examen — Electrónica Básica"
      action={<Btn small variant="ghost" onClick={() => setMostrarIntro(true)}>Ver la guía otra vez</Btn>}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {Object.keys(NIVELES_ELECTRONICA).map((n) => (
          <Btn key={n} small variant={nivel === n ? "accent" : "ghost"} onClick={() => cambiarNivel(n)}>{n}</Btn>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {preguntas.map((p, i) => {
          const correctaMostrada = resultado?.detalle;
          const esCorrecta = correctaMostrada ? correctaMostrada[i] : null;
          return (
            <div key={i} style={{
              border: `1px solid ${T.line}`, borderRadius: 10, padding: 14,
              background: correctaMostrada ? (esCorrecta ? T.greenSoft : T.redSoft) : T.graySoft,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{i + 1}. {p.texto}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {p.opciones.map((op, j) => (
                  <label key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="radio" name={`elec-${nivel}-${i}`} checked={respuestas[i] === j} onChange={() => responder(i, j)} />
                    {op}
                  </label>
                ))}
              </div>
              {correctaMostrada && !esCorrecta && (
                <div style={{ fontSize: 11.5, color: T.red, marginTop: 8 }}>Respuesta correcta: {p.opciones[p.correcta]}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <Btn variant="accent" onClick={enviarNivel}>Enviar nivel</Btn>
        {resultado && <Btn variant="ghost" onClick={reiniciarNivel}>Empezar de nuevo</Btn>}
        {resultado && resultado.rangoResultado && (
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", background: resultado.rangoResultado.color, padding: "5px 12px", borderRadius: 999 }}>{resultado.rangoResultado.texto}</span>
        )}
        {resultado && <span style={{ fontSize: 14, color: resultado.ok === true ? T.green : resultado.ok === false ? T.red : T.inkSoft, fontWeight: 600 }}>{resultado.msg}</span>}
      </div>
    </Card>
  );
}

// Editor visual de Ecuaciones Simplex: se arrastran (o se hace clic en)
// herramientas individuales hacia el área de INPUTS o de OUTPUTS, se
// pueden reordenar y borrar, el sistema genera el texto de la ecuación
// automáticamente, y se verifica contra la ecuación de referencia
// (elementos, orden, compuertas OR/AND/NOT, dispositivos y acción).
const HERRAMIENTAS_INPUT_SIMPLEX = [
  { id: "status", texto: "STATUS" },
  { id: "on_i", texto: "ON" },
  { id: "fire", texto: "FIRE" },
  { id: "detect", texto: "DETECT" },
  { id: "or", texto: "OR" },
  { id: "and", texto: "AND" },
  { id: "not", texto: "NOT" },
  { id: "p48", texto: "P48 MANUAL EVAC", codigo: "P48 | DIGITAL | MANUAL EVAC" },
  { id: "p550", texto: "P550 BOTON DE INHABILITAR LAS SIRENAS", codigo: "P550 | DIGITAL | TROUBL | BOTON DE INHABILITAR LAS SIRENAS" },
  { id: "p551", texto: "P551 BOTON DE BYPASS", codigo: "P551 | DIGITAL | SUPV | BOTON DE BYPASS" },
  { id: "l259_humo", texto: "L259 | LIST | MIXED | GENERAL DETECTORES DE HUMO" },
  { id: "l261_manual", texto: "L261 | LIST | MIXED | GENERAL ESTACIONES MANUALES" },
  { id: "l260_flujo", texto: "L260 | LIST | MIXED | GENERAL SENSORES DE FLUJO" },
  { id: "m1_112", texto: "M1-112 SENSOR DE FLAMA", codigo: "M1-112 | ANALOG | UTILITY |" },
  { id: "m1_115", texto: "M1-115 SENSOR DE GAS LPG", codigo: "M1-115 | ANALOG | UTILITY |" },
  { id: "m1_11", texto: "M1-11 SENSOR DE MONOXIDO", codigo: "M1-11 | ANALOG | UTILITY |" },
  { id: "m1_200", texto: "M1-200 SENSOR DE HUMO LOBBY FRT ELEVADOR P1", codigo: "M1-200 | ANALOG | UTILITY |" },
  { id: "m1_201", texto: "M1-201 SENSOR DE HUMO LOBBY FRT ELEVADOR P3", codigo: "M1-201 | ANALOG | UTILITY |" },
];
const HERRAMIENTAS_OUTPUT_SIMPLEX = [
  { id: "hold", texto: "HOLD" },
  { id: "on_o", texto: "ON" },
  { id: "pri", texto: "PRI" },
  { id: "igual", texto: "=" },
  { id: "n2", texto: "2" }, { id: "n3", texto: "3" }, { id: "n4", texto: "4" }, { id: "n5", texto: "5" },
  { id: "n6", texto: "6" }, { id: "n7", texto: "7" }, { id: "n8", texto: "8" }, { id: "n9", texto: "9" },
  { id: "coma", texto: "," },
  { id: "desable", texto: "DISABLE" },
  { id: "off", texto: "OFF" },
  { id: "puntoycoma", texto: ";" },
  { id: "temporal", texto: "TEMPORAL" },
  { id: "track", texto: "TRACK" },
  { id: "l256_lamparas", texto: "L256 | LIST | CONTROL | GENERAL LAMPARAS BOCINAS" },
  { id: "l259_primario", texto: "L259 | LIST | MIXED | RELE LLAMADO PRIMARIO" },
  { id: "l258_alt", texto: "L258 | LIST | MIXED | RELE LLAMADO ALTERNATIVO" },
  { id: "l270", texto: "L270 | LIST | MIXED | SOLENOIDE SISTEMA DE DILUVIO" },
  { id: "l271", texto: "L271 | LIST | MIXED | RELE CORTE DE GAS" },
];
const TEXTO_HERRAMIENTA_SIMPLEX = {};
const CODIGO_HERRAMIENTA_SIMPLEX = {};
[...HERRAMIENTAS_INPUT_SIMPLEX, ...HERRAMIENTAS_OUTPUT_SIMPLEX].forEach((h) => {
  TEXTO_HERRAMIENTA_SIMPLEX[h.id] = h.texto;
  CODIGO_HERRAMIENTA_SIMPLEX[h.id] = h.codigo || h.texto;
});
// Un token es "dispositivo/lista" (va en su propia línea, indentada, en la
// ecuación generada) si su código trae el formato con barras "|".
const esDispositivoSimplex = (id) => CODIGO_HERRAMIENTA_SIMPLEX[id].includes("|");

const EJERCICIOS_SIMPLEX = [
  { titulo: "Ejercicio #1 — Inhabilitar Notificación", explicacion: "Cuando el botón P550 se activa, la ecuación inhabilita las lámparas y bocinas generales.",
    inputsRef: ["status", "on_i", "p550"], outputsRef: ["desable", "on_o", "l256_lamparas"] },
  { titulo: "Ejercicio #2 — Habilitar Notificación", explicacion: "Cuando el botón P550 no está activado, la función de inhabilitación se desactiva y las lámparas y bocinas quedan habilitadas nuevamente.",
    inputsRef: ["not", "status", "on_i", "p550"], outputsRef: ["desable", "off", "l256_lamparas"] },
  { titulo: "Ejercicio #3 — Activar la Notificación por Evacuación Manual", explicacion: "Cuando se activa el botón de evacuación manual P48, se activa temporal la notificación general mediante las lámparas y bocinas.",
    inputsRef: ["status", "on_i", "p48"], outputsRef: ["temporal", "pri", "igual", "n9", "coma", "n9", "l256_lamparas"] },
  { titulo: "Ejercicio #4 — Llamado Primario del Elevador", explicacion: "Cuando el sensor de humo ubicado en el lobby frente del elevador del piso 1 detecta humo, se activa el relé de llamado primario del elevador.",
    inputsRef: ["status", "detect", "m1_200"], outputsRef: ["hold", "on_o", "pri", "igual", "n9", "coma", "n9", "l259_primario"] },
  { titulo: "Ejercicio #5 — Llamado Alternativo del Elevador", explicacion: "Cuando el sensor de humo M1-201 del lobby frente del elevador en P3 detecta humo, se activa el relé de llamado alternativo.",
    inputsRef: ["status", "detect", "m1_201"], outputsRef: ["hold", "on_o", "pri", "igual", "n9", "coma", "n9", "l258_alt"] },
  { titulo: "Ejercicio #6 — Activación General de Alarmas", explicacion: "Las lámparas y bocinas generales se activan cuando existe detección de humo, o cuando se activa una estación manual de alarma.",
    inputsRef: ["status", "detect", "l259_humo", "or", "status", "on_i", "l261_manual"], outputsRef: ["temporal", "pri", "igual", "n9", "coma", "n9", "l256_lamparas"] },
  { titulo: "Ejercicio #7 — Activación del Sistema de Diluvio", explicacion: "El sistema de diluvio se activa únicamente cuando el sensor de flama detecta una condición y, además, existe una señal de los sensores generales de flujo.",
    inputsRef: ["status", "detect", "m1_112", "and", "status", "on_i", "l260_flujo"], outputsRef: ["hold", "on_o", "pri", "igual", "n9", "coma", "n9", "l270"] },
  { titulo: "Ejercicio #8 — Corte de Suministro de Gas", explicacion: "El relé de corte de gas se activa cuando se detecta gas LPG o monóxido de carbono, junto con la lista de sensores de humo.",
    inputsRef: ["status", "detect", "m1_115", "or", "status", "detect", "m1_11", "and", "status", "detect", "l259_humo"], outputsRef: ["hold", "on_o", "pri", "igual", "n8", "coma", "n8", "l271"] },
];
const PUNTOS_POR_EJERCICIO_SIMPLEX = 10;

// Colorea un token tipo "P550 | DIGITAL | UTILITY |" segmento por segmento:
// el primero en negro, el segundo en azul, el tercero en verde, el resto en negro.
function LineaDispositivoSimplex({ codigo }) {
  const partes = codigo.split("|").map((p) => p.trim()).filter((p, i, arr) => !(p === "" && i === arr.length - 1));
  const colores = [T.ink, T.blue, T.green, T.ink, T.ink];
  return (
    <span>
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 && <span style={{ color: T.gray }}> | </span>}
          <span style={{ color: colores[i] || T.ink }}>{parte}</span>
        </span>
      ))}
    </span>
  );
}

// Agrupa la secuencia de tokens colocados en "líneas" para mostrarlas como
// una ecuación real: las palabras clave (STATUS, ON, AND...) se juntan en
// una línea de condición, y cada dispositivo/lista pasa a su propia línea
// indentada — igual que en el editor real de Simplex.
// Une las palabras de una línea de condición con espacios normales, EXCEPTO
// alrededor de "=" y "," donde no debe quedar espacio — así "PRI", "=", "9",
// ",", "9" se ven como "PRI=9,9" en vez de "PRI = 9 , 9".
function unirTokensCondicionSimplex(tokens) {
  let resultado = "";
  tokens.forEach((t, i) => {
    if (i === 0) { resultado = t; return; }
    const sinEspacio = t === "=" || t === "," || tokens[i - 1] === "=" || tokens[i - 1] === ",";
    resultado += (sinEspacio ? "" : " ") + t;
  });
  return resultado;
}

function agruparLineasSimplex(colocados) {
  const lineas = [];
  let bufferTexto = [];
  let bufferIndices = [];
  colocados.forEach((id, i) => {
    if (esDispositivoSimplex(id)) {
      if (bufferTexto.length) { lineas.push({ tipo: "condicion", texto: unirTokensCondicionSimplex(bufferTexto), indices: bufferIndices }); bufferTexto = []; bufferIndices = []; }
      lineas.push({ tipo: "dispositivo", codigo: CODIGO_HERRAMIENTA_SIMPLEX[id], indices: [i] });
    } else {
      bufferTexto.push(TEXTO_HERRAMIENTA_SIMPLEX[id]);
      bufferIndices.push(i);
    }
  });
  if (bufferTexto.length) lineas.push({ tipo: "condicion", texto: unirTokensCondicionSimplex(bufferTexto), indices: bufferIndices });
  return lineas;
}

function PanelEcuacionSimplex({ inputsColocados, outputsColocados, onQuitarIndices }) {
  const lineasInputs = agruparLineasSimplex(inputsColocados);
  const lineasOutputs = agruparLineasSimplex(outputsColocados);

  const renderLinea = (linea, zona, idx) => (
    <div
      key={zona + idx}
      onClick={() => onQuitarIndices(zona, linea.indices)}
      title="Clic para quitar este elemento"
      style={{ cursor: "pointer", padding: "1px 4px", borderRadius: 4 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = T.redSoft)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {linea.tipo === "condicion"
        ? <span style={{ color: T.blue, fontWeight: 700 }}>{linea.texto}</span>
        : <LineaDispositivoSimplex codigo={linea.codigo} />}
    </div>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 20px", minHeight: 320, fontFamily: "monospace", fontSize: 13, lineHeight: 1.8 }}>
      <div>[INPUTS]</div>
      <div style={{ paddingLeft: 24 }}>
        {lineasInputs.length === 0 && <div style={{ color: T.gray, fontStyle: "italic" }}>&nbsp;</div>}
        {lineasInputs.map((l, i) => (
          <div key={i} style={{ paddingLeft: l.tipo === "dispositivo" ? 24 : 0 }}>{renderLinea(l, "input", i)}</div>
        ))}
      </div>
      <div>[END INPUTS]</div>
      <div style={{ height: 18 }} />
      <div>[OUTPUTS]</div>
      <div style={{ paddingLeft: 24 }}>
        {lineasOutputs.length === 0 && <div style={{ color: T.gray, fontStyle: "italic" }}>&nbsp;</div>}
        {lineasOutputs.map((l, i) => (
          <div key={i} style={{ paddingLeft: l.tipo === "dispositivo" ? 24 : 0 }}>{renderLinea(l, "output", i)}</div>
        ))}
      </div>
      <div>[END OUTPUTS]</div>
    </div>
  );
}

// Analiza la secuencia de INPUTS para VERIFICAR la ecuación: agrupa por
// dispositivo igual que arriba, pero guarda las palabras de condición
// (STATUS, ON, DETECT, FIRE) como un conjunto ordenado alfabéticamente —
// así no importa en qué orden se arrastraron "STATUS" y "ON", solo que
// estén las correctas, junto con el dispositivo, el NOT y el operador
// correcto entre grupos.
function analizarInputsParaVerificar(colocados) {
  const grupos = [];
  let condicionActual = [];
  let negActual = false;
  let operadorActual = null;
  colocados.forEach((id) => {
    if (id === "not") { negActual = true; return; }
    if (id === "or") { operadorActual = "OR"; return; }
    if (id === "and") { operadorActual = "AND"; return; }
    if (esDispositivoSimplex(id)) {
      grupos.push({ condicion: [...condicionActual].sort(), deviceId: id, neg: negActual, operador: operadorActual });
      condicionActual = [];
      negActual = false;
      operadorActual = null;
    } else {
      condicionActual.push(id);
    }
  });
  return grupos;
}

// Analiza la secuencia de INPUTS colocada y arma los "grupos" (un
// dispositivo, si venía negado con NOT, y con qué operador se conecta al
// grupo anterior) para poder dibujar el diagrama de compuertas.
function parsearGruposSimplex(colocados) {
  const grupos = [];
  let negActual = false;
  let operadorActual = null;
  colocados.forEach((id) => {
    if (id === "not") { negActual = true; return; }
    if (id === "or") { operadorActual = "OR"; return; }
    if (id === "and") { operadorActual = "AND"; return; }
    if (esDispositivoSimplex(id)) {
      grupos.push({ dispositivo: TEXTO_HERRAMIENTA_SIMPLEX[id].split("|")[0].trim(), neg: negActual, operador: operadorActual });
      negActual = false;
      operadorActual = null;
    }
  });
  return grupos;
}

// Arma el árbol de compuertas en cascada de izquierda a derecha: la primera
// entrada siempre pasa por una compuerta OR (aunque esté sola); cada
// entrada siguiente se combina con el resultado acumulado usando su propio
// operador (OR/AND).
function construirArbolSimplex(grupos) {
  if (grupos.length === 0) return null;
  let nodo = { tipo: "OR", hijos: [grupos[0]] };
  for (let i = 1; i < grupos.length; i++) {
    nodo = { tipo: grupos[i].operador || "OR", hijos: [nodo, grupos[i]] };
  }
  return nodo;
}

function IconoCompuertaSimplex({ tipo }) {
  const s = T.ink;
  const shapes = {
    OR: <path d="M2,2 C16,2 16,2 24,20 C16,38 16,38 2,38 C10,28 10,12 2,2 Z" fill={T.graySoft} stroke={s} strokeWidth="2" strokeLinejoin="round" />,
    AND: <path d="M2,2 L18,2 A18,18 0 0 1 18,38 L2,38 Z" fill={T.graySoft} stroke={s} strokeWidth="2" />,
  };
  return <svg width="30" height="40" viewBox="0 0 26 40">{shapes[tipo] || shapes.OR}</svg>;
}

function DispositivoBoxSimplex({ neg, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <div style={{ background: "#a6e3ef", border: `1px solid ${T.blue}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ width: 14, height: 2, background: T.ink }} />
      {neg && <div style={{ width: 8, height: 8, borderRadius: "50%", border: `2px solid ${T.red}`, background: "#fff" }} />}
    </div>
  );
}

function NodoArbolSimplex({ nodo }) {
  if (!nodo.tipo) return <DispositivoBoxSimplex neg={nodo.neg} label={nodo.dispositivo} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {nodo.hijos.map((h, i) => <NodoArbolSimplex key={i} nodo={h} />)}
      </div>
      <div style={{ width: 10, height: 2, background: T.ink }} />
      <IconoCompuertaSimplex tipo={nodo.tipo} />
    </div>
  );
}

// Genera automáticamente el diagrama de compuertas lógicas equivalente a
// lo que se lleva construido en INPUTS — la primera entrada siempre entra
// por una compuerta OR, y cada entrada adicional se combina con el
// resultado acumulado según el operador (OR/AND) que la precede.
function DiagramaLogicoSimplex({ inputsColocados }) {
  const grupos = parsearGruposSimplex(inputsColocados);
  const arbol = construirArbolSimplex(grupos);
  return (
    <div style={{ background: T.graySoft, borderRadius: 10, padding: 16, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", overflowX: "auto" }}>
      {!arbol ? (
        <span style={{ fontSize: 12, color: T.gray, textAlign: "center" }}>Agrega dispositivos en INPUTS para ver aquí su representación en compuertas lógicas.</span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <NodoArbolSimplex nodo={arbol} />
          <div style={{ width: 14, height: 2, background: T.ink }} />
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: T.ink }}>Salida</div>
        </div>
      )}
    </div>
  );
}

function JuegoSimplex({ onGanarPuntos, esAdmin, onReiniciar }) {
  const [mostrarIntro, setMostrarIntro] = useState(true);
  const [ejActual, setEjActual] = useState(0);
  const [inputsColocados, setInputsColocados] = useState([]);
  const [outputsColocados, setOutputsColocados] = useState([]);
  const [resultado, setResultado] = useState(null);
  const ganadosRef = React.useRef(new Set());
  const falladosRef = React.useRef(new Set());
  const [, forceRender] = useState(0);
  const bloqueado = (clave) => falladosRef.current.has(clave) && !ganadosRef.current.has(clave);
  const reiniciarModulo = (borrarRanking) => {
    falladosRef.current.clear();
    if (borrarRanking) ganadosRef.current.clear();
    onReiniciar && onReiniciar(borrarRanking);
    setResultado(null);
    forceRender((n) => n + 1);
  };
  // Reinicio propio del técnico: desbloquea los ejercicios fallados para
  // poder recuperarlos — los puntos ya ganados en la primera ronda se
  // mantienen y no se vuelven a sumar.
  const reiniciarNivelTecnico = () => {
    falladosRef.current.clear();
    setEjActual(0);
    setInputsColocados([]);
    setOutputsColocados([]);
    setResultado(null);
    forceRender((n) => n + 1);
  };
  const hayBloqueados = () => {
    for (let i = 0; i < EJERCICIOS_SIMPLEX.length; i++) { if (bloqueado("ej" + i)) return true; }
    return false;
  };

  const ej = EJERCICIOS_SIMPLEX[ejActual];

  const agregar = (zona, id) => {
    if (zona === "input") setInputsColocados((prev) => [...prev, id]);
    else setOutputsColocados((prev) => [...prev, id]);
    setResultado(null);
  };
  const quitarIndices = (zona, indices) => {
    const setter = zona === "input" ? setInputsColocados : setOutputsColocados;
    setter((prev) => prev.filter((_, j) => !indices.includes(j)));
    setResultado(null);
  };
  const limpiar = () => { setInputsColocados([]); setOutputsColocados([]); setResultado(null); };
  const cambiarEjercicio = (delta) => {
    setEjActual((prev) => (prev + delta + EJERCICIOS_SIMPLEX.length) % EJERCICIOS_SIMPLEX.length);
    setInputsColocados([]); setOutputsColocados([]); setResultado(null);
  };

  const verificar = () => {
    const clave = "ej" + ejActual;
    if (bloqueado(clave)) {
      setResultado({ ok: false, msg: "🔒 Este ejercicio quedó bloqueado por haberlo fallado. Llega hasta el último ejercicio del módulo para poder reiniciarlo y recuperarlo." });
      return;
    }
    const inputsOk = JSON.stringify(inputsColocados) === JSON.stringify(ej.inputsRef);
    const outputsOk = JSON.stringify(outputsColocados) === JSON.stringify(ej.outputsRef);
    const correcto = inputsOk && outputsOk;
    if (correcto) {
      const yaGanado = ganadosRef.current.has(clave);
      setResultado({ ok: true, msg: yaGanado ? "✓ Correcto (ya ganaste los puntos de este ejercicio)." : `✓ ¡Ecuación correcta! +${PUNTOS_POR_EJERCICIO_SIMPLEX} puntos.` });
      if (!yaGanado) {
        ganadosRef.current.add(clave);
        onGanarPuntos && onGanarPuntos(ej.titulo, PUNTOS_POR_EJERCICIO_SIMPLEX);
      } else {
        onGanarPuntos && onGanarPuntos(ej.titulo + " (repaso)", 0);
      }
    } else {
      const yaFallado = falladosRef.current.has(clave);
      const yaGanado = ganadosRef.current.has(clave);
      let detalle = [];
      if (!inputsOk) detalle.push("revisa los elementos, el orden y las compuertas (OR/AND/NOT) de INPUTS");
      if (!outputsOk) detalle.push("revisa la acción y el argumento de OUTPUTS");
      setResultado({ ok: false, msg: `✗ Todavía no — ${detalle.join("; ")}.${(yaFallado || yaGanado) ? "" : ` -${PUNTOS_POR_EJERCICIO_SIMPLEX} puntos, y podrías perder insignias si tu puntaje baja del umbral. Este ejercicio quedará bloqueado — llega hasta el final del módulo para recuperarlo.`}` });
      if (!yaFallado && !yaGanado) {
        falladosRef.current.add(clave);
        onGanarPuntos && onGanarPuntos(ej.titulo + " (fallo)", -PUNTOS_POR_EJERCICIO_SIMPLEX);
      }
    }
  };

  if (mostrarIntro) {
    const TEMAS_SIMPLEX = [
      {
        id: "que_es", titulo: "¿Qué son las Ecuaciones Simplex?",
        contenido: (
          <p>Las ecuaciones Simplex son la forma de programar la lógica de un panel de alarma: definen qué <strong>ENTRADAS</strong> (sensores, botones, listas de dispositivos) deben cumplirse para disparar una <strong>SALIDA</strong> (una acción sobre sirenas, relés, solenoides, etc.). Cada entrada puede ser un solo dispositivo o una lista con varios dispositivos agrupados; cada salida puede ser un solo punto o una lista de salidas.</p>
        ),
      },
      {
        id: "estructura_input", titulo: "Estructura de INPUT",
        contenido: (
          <>
            <p>Un bloque INPUT define la condición que debe evaluarse, con un <strong>Estado de entrada</strong> (por ejemplo STATUS ON, o STATUS DETECT) y un <strong>Argumento de entrada</strong> (el dispositivo o lista al que aplica).</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 12.5, fontFamily: "monospace" }}>INPUT<br />&nbsp;&nbsp;Estado de entrada<br />&nbsp;&nbsp;Argumento de entrada<br />FIN INPUT</div>
          </>
        ),
      },
      {
        id: "estructura_output", titulo: "Estructura de OUTPUT",
        contenido: (
          <>
            <p>Un bloque OUTPUT define qué <strong>Acción</strong> se ejecuta (por ejemplo ACTIVAR, TEMPORAL, HOLD) y sobre qué <strong>Argumento</strong> (el dispositivo, grupo o lista de salidas).</p>
            <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", margin: "8px 0", fontSize: 12.5, fontFamily: "monospace" }}>OUTPUT<br />&nbsp;&nbsp;ACCIÓN = ACTIVAR<br />&nbsp;&nbsp;ARGUMENTO = SIRENAS_PISO_1<br />FIN OUTPUT</div>
          </>
        ),
      },
      {
        id: "ejemplo_real", titulo: "Ejemplo real completo",
        contenido: (
          <div style={{ background: T.graySoft, borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
{`INPUTS
STATUS DETECT L18 | LIST | MIXED | GENERAL FIRE ALARM MONITOR ZONES
OR STATUS ON P35 | DIGITAL | UTILITY | MANUAL EVACUATION SWITCH INPUT
AND NOT STATUS ON P199 | DIGITAL | UTILITY | INHIBIT ALARM DEFAULT
OUTPUTS
TRACK ON PRI=2,2 P3 | DIGITAL | UTILITY | FIRE ALARM DETECT`}
          </div>
        ),
      },
      {
        id: "editor", titulo: "Cómo usar el editor visual",
        contenido: (
          <>
            <p>En cada ejercicio vas a ver solo el <strong>enunciado</strong> (la explicación de lo que debe hacer el sistema) — tú construyes la ecuación arrastrando o haciendo clic en las herramientas correspondientes, primero hacia el área de INPUTS y luego hacia OUTPUTS.</p>
            <ul style={{ margin: "4px 0 10px", paddingLeft: 20 }}>
              <li>Cada herramienta se agrega al final de la fila.</li>
              <li>Usa las flechitas ◀ ▶ en cada elemento para reordenarlo.</li>
              <li>Usa la × para quitar un elemento colocado por error.</li>
              <li>El sistema genera automáticamente el texto de la ecuación abajo.</li>
              <li>"Verificar" compara tu ecuación contra la de referencia: elementos, orden, compuertas (OR/AND/NOT), dispositivos y la acción de salida.</li>
            </ul>
          </>
        ),
      },
    ];
    return <GuiaPorTemas temas={TEMAS_SIMPLEX} onContinuar={() => setMostrarIntro(false)} tituloModulo="Ecuaciones Simplex" />;
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{ej.titulo}</div>
          <div style={{ fontSize: 13, color: T.inkSoft }}>{ej.explicacion}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Btn small variant="ghost" onClick={() => cambiarEjercicio(-1)}>← Anterior</Btn>
          <Btn small variant="ghost" onClick={() => cambiarEjercicio(1)}>Siguiente →</Btn>
          <Btn small variant="ghost" onClick={limpiar}>Limpiar</Btn>
          <Btn small variant="ghost" onClick={() => setMostrarIntro(true)}>Ver la guía otra vez</Btn>
          {esAdmin && <BotonReiniciarModulo onReiniciar={reiniciarModulo} />}
        </div>
      </div>

      {bloqueado("ej" + ejActual) && (
        <div style={{ background: T.redSoft, border: `1px solid ${T.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.red, fontWeight: 600 }}>
          🔒 Bloqueado — fallaste este ejercicio. Llega hasta el último ejercicio del módulo para poder reiniciarlo y recuperarlo.
        </div>
      )}
      {ejActual === EJERCICIOS_SIMPLEX.length - 1 && hayBloqueados() && (
        <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: T.amber, fontWeight: 600 }}>Llegaste al final del módulo — tienes ejercicios pendientes de recuperar. Al reiniciar, tus puntos ya ganados se mantienen; solo sumarán los que recuperes.</span>
          <Btn small variant="accent" onClick={reiniciarNivelTecnico}>🔄 Reiniciar módulo para recuperar</Btn>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 14, opacity: bloqueado("ej" + ejActual) ? 0.5 : 1, pointerEvents: bloqueado("ej" + ejActual) ? "none" : "auto" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Herramientas de Inputs</div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const v = e.dataTransfer.getData("text/plain"); if (v.startsWith("input:")) agregar("input", v.slice(6)); }}
            style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 10, background: T.blueSoft, borderRadius: 10, minHeight: 100, alignContent: "flex-start" }}
          >
            {HERRAMIENTAS_INPUT_SIMPLEX.map((h) => (
              <button key={h.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", "input:" + h.id)} onClick={() => agregar("input", h.id)}
                style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${T.blue}`, color: T.blue, borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: "grab", textTransform: "uppercase" }}>
                {h.texto}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Herramientas de Outputs</div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const v = e.dataTransfer.getData("text/plain"); if (v.startsWith("output:")) agregar("output", v.slice(7)); }}
            style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 10, background: T.greenSoft, borderRadius: 10, minHeight: 100, alignContent: "flex-start" }}
          >
            {HERRAMIENTAS_OUTPUT_SIMPLEX.map((h) => (
              <button key={h.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", "output:" + h.id)} onClick={() => agregar("output", h.id)}
                style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${T.green}`, color: T.green, borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: "grab", textTransform: "uppercase" }}>
                {h.texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.gray, marginBottom: 6 }}>Arrastra o haz clic en una herramienta para agregarla. Haz clic sobre un elemento ya colocado abajo para quitarlo.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <PanelEcuacionSimplex inputsColocados={inputsColocados} outputsColocados={outputsColocados} onQuitarIndices={quitarIndices} />
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.inkSoft, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>Diagrama de compuertas (INPUTS)</div>
          <DiagramaLogicoSimplex inputsColocados={inputsColocados} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <Btn variant="accent" onClick={verificar} disabled={bloqueado("ej" + ejActual)}>Verificar</Btn>
        {resultado && <span style={{ fontSize: 14, color: resultado.ok === true ? T.green : resultado.ok === false ? T.red : T.inkSoft, fontWeight: 600 }}>{resultado.msg}</span>}
      </div>
    </Card>
  );
}

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
        <Btn variant={tab === "cortes" ? "accent" : "ghost"} small onClick={() => setTab("cortes")}>Fechas de Corte</Btn>
      </div>

      {tab === "cortes" && <FechasDeCorte isAdmin={isAdmin} confirmar={confirmar} />}

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
  const [odParaEquipos, setOdParaEquipos] = useState(null);
  const irAEquipos = (area, od) => {
    setOdParaEquipos({ area, od });
    setTab("equipos");
  };
  const { logo } = useContext(LogoContext);
  const [esPantallaAngosta, setEsPantallaAngosta] = useState(() => typeof window !== "undefined" && window.innerWidth < 820);

  useEffect(() => {
    const revisar = () => setEsPantallaAngosta(window.innerWidth < 820);
    window.addEventListener("resize", revisar);
    return () => window.removeEventListener("resize", revisar);
  }, []);

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
    // Todos los usuarios ven las áreas operativas; Administrativo
    // (incluyendo Gestión de Usuarios) queda reservado solo para la
    // categoría "admin". Los técnicos, además, no ven Proyectos ni Planilla.
    // El perfil "entrenamiento" solo ve el área de Entrenamiento — nada más.
    if (user.categoria === "entrenamiento") return AREAS.filter((a) => a.id === "entrenamiento");
    if (user.categoria === "admin") return AREAS;
    if (user.categoria === "tecnico") return AREAS.filter((a) => a.id !== "admin" && a.id !== "proyectos" && a.id !== "planilla");
    return AREAS.filter((a) => a.id !== "admin");
  }, [user]);

  useEffect(() => {
    if (user && !tab) setTab(visibleAreas[0]?.id);
  }, [user]);

  if (!user) return <Login onLogin={iniciarSesion} />;

  const current = AREAS.find((a) => a.id === tab);

  return (
    <CurrentUserContext.Provider value={user}>
    <EquiposNavContext.Provider value={{ irAEquipos }}>
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
        {tab === "facturacion_publica" && <FacturacionPublica />}
        {tab === "gastos_tarjeta" && <GastosTarjeta />}
        {tab === "vehiculos" && <Vehiculos />}
        {tab === "equipos" && <EquiposCorrectivos irInicial={odParaEquipos} onIrConsumido={() => setOdParaEquipos(null)} />}
        {tab === "planilla" && <Planilla />}
        {tab === "entrenamiento" && <Entrenamiento />}
        {tab === "admin" && <Administrativo />}
      </div>
    </div>
    </EquiposNavContext.Provider>
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
    { id: "correctivos", label: "Correctivos", icon: AlertCircle },
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
        {tab === "correctivos" && <MovilCorrectivos nombre={nombre} clientes={clientes} cardStyle={cardStyle} />}
        {tab === "horas" && <MovilHorasExtras nombre={nombre} user={user} cardStyle={cardStyle} labelStyle={labelStyle} bigInputStyle={bigInputStyle} />}
        {tab === "ehs" && <MovilCursosEHS cardStyle={cardStyle} bigInputStyle={bigInputStyle} />}
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
    .filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre && (r.tipoOD || "Normal") !== "Correctivo")
    .filter((r) => filtroArea === "Todos" || r.area === filtroArea);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn small variant={filtroArea === "Todos" ? "accent" : "ghost"} onClick={() => setFiltroArea("Todos")}>Todos ({inspRows.filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre && (r.tipoOD || "Normal") !== "Correctivo").length + projRows.filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre && (r.tipoOD || "Normal") !== "Correctivo").length})</Btn>
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
            {area_label(r.area)}
            {r.vencimiento ? ` · Vence: ${r.vencimiento}` : ""}
            {r.fechaEntrega ? ` · Entrega: ${r.fechaEntrega}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
function area_label(area) { return area === "inspecciones" ? "Inspecciones" : "Proyectos"; }

function MovilCorrectivos({ nombre, clientes, cardStyle }) {
  const [filtroArea, setFiltroArea] = useState("Todos");
  const inspRows = clientes.inspecciones || [];
  const projRows = clientes.proyectos || [];
  const misCorrectivos = [...inspRows.map((r) => ({ ...r, area: "inspecciones" })), ...projRows.map((r) => ({ ...r, area: "proyectos" }))]
    .filter((r) => (r.tecnico || "").trim().toLowerCase() === nombre && (r.tipoOD || "Normal") === "Correctivo")
    .filter((r) => filtroArea === "Todos" || r.area === filtroArea);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <Btn small variant={filtroArea === "Todos" ? "accent" : "ghost"} onClick={() => setFiltroArea("Todos")}>Todos</Btn>
        <Btn small variant={filtroArea === "inspecciones" ? "accent" : "ghost"} onClick={() => setFiltroArea("inspecciones")}>Inspecciones</Btn>
        <Btn small variant={filtroArea === "proyectos" ? "accent" : "ghost"} onClick={() => setFiltroArea("proyectos")}>Proyectos</Btn>
      </div>
      {misCorrectivos.length === 0 ? (
        <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "30px 10px" }}>No tienes OD Correctivos asignadas todavía.</div>
      ) : misCorrectivos.map((r) => (
        <div key={r.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{r.od}</div>
            <Badge color={(r.progreso || "Pendiente") === "Completado" ? T.green : T.amber} soft={(r.progreso || "Pendiente") === "Completado" ? T.greenSoft : T.amberSoft}>{r.progreso || "Pendiente"}</Badge>
          </div>
          <div style={{ fontSize: 14.5, color: T.ink, marginBottom: 4 }}>{r.cliente}</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft }}>
            {area_label(r.area)}{r.fechaAprobacion ? ` · Aprobado: ${r.fechaAprobacion}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

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

function MovilCursosEHS({ cardStyle, bigInputStyle }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cursos_ehs").select("*").order("created_at", { ascending: false });
      if (data) setRows(data);
    })();
  }, []);

  const setFecha = (id, fecha) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, fecha } : r));
    supabase.from("cursos_ehs").update({ fecha: fecha || null }).eq("id", id).then();
  };
  const setEstado = (id, estado) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, estado } : r));
    supabase.from("cursos_ehs").update({ estado }).eq("id", id).then();
  };

  if (rows.length === 0) {
    return <div style={{ color: T.gray, fontSize: 14, textAlign: "center", padding: "30px 10px" }}>Todavía no hay cursos EHS cargados.</div>;
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
            <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 2 }}>{r.personal || "Sin asignar"}</div>
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
  const [fechasCorte, setFechasCorte] = useState([]);

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

  const refetchFechasCorte = async () => {
    const { data, error } = await supabase.from("fechas_corte").select("*").order("fecha", { ascending: true });
    if (!error && data) setFechasCorte(data.map((f) => f.fecha));
  };

  const refetchLogo = async () => {
    const { data } = await supabase.from("app_config").select("value").eq("key", "logo").maybeSingle();
    if (data?.value) setLogoState(data.value);
  };

  useEffect(() => {
    refetchUsers();
    refetchClientes();
    refetchLogo();
    refetchFechasCorte();
    // Se refresca sola cada 20s, para que Inspecciones, Proyectos y
    // Apertura de OD (que comparten estos mismos datos) se mantengan al
    // día entre varios usuarios sin tener que recargar la página a mano.
    const intervalo = setInterval(() => {
      refetchClientes();
      refetchFechasCorte();
    }, 20000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <LogoContext.Provider value={{ logo, setLogo }}>
      <UsersContext.Provider value={{ users, refetchUsers }}>
        <ClientesContext.Provider value={{ clientes, setClientes }}>
          <FechasCorteContext.Provider value={{ fechasCorte, refetchFechasCorte }}>
            <ConfirmProvider>
              <AppInner />
            </ConfirmProvider>
          </FechasCorteContext.Provider>
        </ClientesContext.Provider>
      </UsersContext.Provider>
    </LogoContext.Provider>
  );
}
