# Departamento A&D Salvavidas — Control Interno

App de control interno (Inspecciones, Proyectos, Cotizaciones, Salud Ocupacional,
Administrativo). Este proyecto ya está preparado para:

- Correr localmente con **Vite**.
- Publicarse en **Vercel**.
- Usar **Supabase** para la tabla de usuarios (login real, persistente).

> **Importante — qué falta todavía:** por ahora SOLO la tabla de usuarios
> (login y "Gestión de Usuarios") vive en Supabase. Los demás módulos
> (OD, Horas Extras, Cotizaciones, Cursos EHS, Calendario, Facturación)
> siguen guardando los datos en memoria del navegador, igual que en la
> demo — se reinician al recargar la página. Migrarlos a Supabase es el
> siguiente paso natural, uno por uno.

---

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com y crea una cuenta (gratis).
2. Crea un **New Project** (elige una contraseña de base de datos y guárdala).
3. Espera a que termine de aprovisionarse (1-2 minutos).
4. Ve a **SQL Editor** (menú izquierdo) → **New query**.
5. Abre el archivo `supabase/schema.sql` de este proyecto, copia todo su
   contenido, pégalo ahí y dale **Run**.
   - Esto crea la tabla `usuarios`, las funciones de login/CRUD, y los
     5 usuarios de la demo (mismos correos/PIN que ya conoces).
6. Ve a **Project Settings → API**. Ahí vas a ver:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public key** (una clave larga)

Guarda esos dos datos, los necesitas en el siguiente paso.

---

## 2. Correr el proyecto en tu computadora

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o más reciente).

```bash
# 1. Entra a la carpeta del proyecto
cd control-departamento-ad-salvavidas

# 2. Instala las dependencias
npm install

# 3. Configura las variables de entorno
cp .env.example .env
# Abre .env y pega tu Project URL y anon key de Supabase

# 4. Corre en modo desarrollo
npm run dev
```

Esto abre la app en `http://localhost:5173`. Prueba iniciar sesión con
`admin@empresa.com` / `1234` — si ves el dashboard, Supabase ya está
conectado correctamente.

---

## 3. Subir el proyecto a GitHub

1. Crea un repositorio nuevo en https://github.com/new (puede ser privado).
2. Desde la carpeta del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Primera versión"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
   git push -u origin main
   ```
   (El archivo `.env` **no** se sube, está en `.gitignore` a propósito —
   nunca subas tus llaves de Supabase a GitHub).

---

## 4. Publicar en Vercel

1. Entra a https://vercel.com y crea una cuenta (puedes usar tu cuenta de GitHub).
2. **Add New → Project** → selecciona el repositorio que acabas de subir.
3. Vercel detecta automáticamente que es un proyecto **Vite** — no cambies
   nada en "Build Command" ni "Output Directory".
4. Antes de darle "Deploy", ve a **Environment Variables** y agrega:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | (tu Project URL de Supabase) |
   | `VITE_SUPABASE_ANON_KEY` | (tu anon key de Supabase) |
5. Dale **Deploy**. En 1-2 minutos tendrás una URL pública tipo
   `https://tu-proyecto.vercel.app` — esa es tu app en producción.

Cada vez que hagas `git push` a `main`, Vercel vuelve a publicar
automáticamente la última versión.

---

## 5. Seguridad — léelo antes de usarlo con datos reales

- El login actual es por **PIN de 4 dígitos**, igual que la demo. Es simple
  y funcional, pero **no es tan seguro** como un login real de Supabase
  (con contraseña + sesión). Los PIN nunca se exponen al navegador (viven
  solo del lado de la base de datos, protegidos por Row Level Security),
  pero sí es un sistema básico. Si vas a manejar información sensible de
  clientes, el siguiente paso recomendado es migrar a **Supabase Auth**
  (login con email + contraseña real). Puedo ayudarte con eso cuando quieras.
- Los demás módulos (OD, cotizaciones, etc.) **todavía no están conectados**
  a Supabase — es el siguiente paso a migrar.

---

## Estructura del proyecto

```
├── index.html
├── package.json
├── vite.config.js
├── .env.example        ← copiar a .env con tus datos de Supabase
├── supabase/
│   └── schema.sql       ← correr esto en el SQL Editor de Supabase
└── src/
    ├── main.jsx
    ├── App.jsx           ← toda la aplicación
    ├── supabaseClient.js ← conexión a Supabase
    └── index.css
```
