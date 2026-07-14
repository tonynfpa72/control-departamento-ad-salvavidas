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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
