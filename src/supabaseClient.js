import { createClient } from "@supabase/supabase-js";

// Estas dos variables se configuran en un archivo .env (local) y en
// "Environment Variables" dentro de Vercel (producción). Nunca se
// escriben directamente aquí. Ver .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltan las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Copia .env.example a .env y completa tus datos de Supabase."
  );
}

// ---- Sesión ----
// Al entrar, Supabase entrega un token de sesión (login_usuario). Se manda
// en cada consulta en el encabezado "x-ignis-sesion"; la base de datos lo
// revisa en sus reglas (RLS) y en sus funciones. Sin token válido no se
// pueden leer ni cambiar los datos internos, aunque alguien tenga la llave
// pública de Supabase.
let tokenSesion = null;
const oyentes = new Set();
export function setTokenSesion(token) {
  const nuevo = token || null;
  if (nuevo === tokenSesion) return;
  tokenSesion = nuevo;
  oyentes.forEach((f) => { try { f(tokenSesion); } catch (e) { /* nada */ } });
}
export function getTokenSesion() { return tokenSesion; }
export function onTokenSesion(f) { oyentes.add(f); return () => oyentes.delete(f); }

// Si el navegador bloqueara el encabezado (CORS) o la red fallara, esa
// consulta se reintenta una vez sin él, para que la App no quede caída.
let avisado = false;
const fetchConSesion = async (input, init = {}) => {
  if (!tokenSesion) return fetch(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set("x-ignis-sesion", tokenSesion);
  try {
    return await fetch(input, { ...init, headers });
  } catch (e) {
    if (!(e instanceof TypeError)) throw e;
    if (!avisado) { avisado = true; console.warn("Consulta con x-ignis-sesion falló; se reintenta sin el encabezado.", e); }
    return fetch(input, init);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConSesion },
});
