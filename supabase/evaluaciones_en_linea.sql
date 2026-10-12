-- =====================================================================
-- EVALUACIÓN DE COMPETENCIAS EN LÍNEA — Departamento A&D Salvavidas
-- Pegar completo en Supabase > SQL Editor > Run. Se puede correr más de
-- una vez sin problema.
--
-- Cómo funciona:
--   * El admin asigna la evaluación a un técnico y a su jefe inmediato.
--   * El técnico la responde en la app; al enviarla se califica sola
--     AQUÍ en Supabase (la clave nunca llega al celular del técnico).
--   * El jefe inmediato completa la evaluación práctica, la rúbrica, los
--     ejercicios escritos y el dictamen, y la CIERRA. Cerrada ya no se
--     puede abrir ni modificar.
--   * Solo un admin puede ver la clave y descargar el examen con las
--     respuestas del técnico.
-- Las dos tablas quedan con RLS activo y SIN políticas: nadie las puede
-- leer ni tocar directo con la llave pública; todo pasa por las funciones
-- de abajo, que revisan quién es el usuario.
-- =====================================================================

create table if not exists evaluaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  tecnico_id uuid not null,
  tecnico_nombre text,
  jefe_id uuid,
  jefe_nombre text,
  creado_por uuid,
  creado_por_nombre text,
  datos jsonb not null default '{}'::jsonb,       -- cédula, puestos, área, antigüedad, tiempo, fecha
  pesos jsonb not null default '{}'::jsonb,       -- {"A":40,"B":15,"C":20,"D":15,"E":10}
  incluir jsonb not null default '{}'::jsonb,     -- {"D":true,"E":true,"F":true}
  preguntas jsonb not null default '{}'::jsonb,   -- {"A":[...],"B":[...],"C":[...]} SIN respuestas
  respuestas jsonb not null default '{}'::jsonb,  -- lo que marcó el técnico
  escritos jsonb not null default '{}'::jsonb,    -- {"F1":"...","F2":"..."}
  evaluacion_jefe jsonb not null default '{}'::jsonb,
  puntajes jsonb not null default '{}'::jsonb,
  nota_final numeric,
  estado text not null default 'pendiente',
  creado_en timestamptz not null default now(),
  iniciado_en timestamptz,
  enviado_en timestamptz,
  cerrado_en timestamptz
);
alter table evaluaciones drop constraint if exists evaluaciones_estado_check;
alter table evaluaciones add constraint evaluaciones_estado_check
  check (estado in ('pendiente', 'en_curso', 'respondida', 'cerrada'));
create index if not exists evaluaciones_tecnico_idx on evaluaciones (tecnico_id);
create index if not exists evaluaciones_jefe_idx on evaluaciones (jefe_id);

create table if not exists evaluaciones_clave (
  evaluacion_id uuid primary key references evaluaciones(id) on delete cascade,
  clave jsonb not null
);

alter table evaluaciones enable row level security;
alter table evaluaciones_clave enable row level security;
revoke all on evaluaciones from anon, authenticated;
revoke all on evaluaciones_clave from anon, authenticated;

-- ---------------------------------------------------------------------
-- Ayudantes
-- ---------------------------------------------------------------------
create or replace function eval_es_admin(p_usuario uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from usuarios where id = p_usuario and categoria = 'admin');
$$;

-- Ordena una lista de índices [2,0] -> [0,2] para comparar respuestas
create or replace function eval_ordenar(j jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(v order by v), '[]'::jsonb)
  from (select (x #>> '{}')::int as v
        from jsonb_array_elements(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) x) s;
$$;

-- Calcula D, E, F, C combinado y la nota final con lo que haya
create or replace function eval_calcular(e evaluaciones, p_jefe jsonb)
returns jsonb language plpgsql stable as $$
declare
  pts jsonb := coalesce(e.puntajes, '{}'::jsonb);
  pd numeric; nd int; pe numeric; ne int; nf int;
  c_preg numeric; c_tot int; nota numeric := 0; parte text; peso numeric; valor numeric;
  hay_nota boolean := (e.estado in ('respondida', 'cerrada'));
begin
  -- D: Cumple = 2, Parcial = 1, No cumple = 0, N/A no cuenta
  if coalesce((e.incluir ->> 'D')::boolean, false) then
    select sum((x ->> 'v')::numeric), count(*) into pd, nd
      from jsonb_array_elements(coalesce(p_jefe -> 'practica', '[]'::jsonb)) x
     where x ->> 'v' in ('0', '1', '2');
    pts := pts || jsonb_build_object('D', case when nd > 0 then round(pd / (2 * nd) * 100, 1) else null end);
  end if;
  -- E: promedio 1..5 -> 0..100
  if coalesce((e.incluir ->> 'E')::boolean, false) then
    select sum((x ->> 'v')::numeric), count(*) into pe, ne
      from jsonb_array_elements(coalesce(p_jefe -> 'rubrica', '[]'::jsonb)) x
     where x ->> 'v' in ('1', '2', '3', '4', '5');
    pts := pts || jsonb_build_object('E', case when ne > 0 then round(pe / ne / 5 * 100, 1) else null end);
  end if;
  -- F: 12 criterios; cuenta 30 % de la parte C (o toda la C si no hay preguntas C)
  c_tot := coalesce((pts ->> 'C_total')::int, 0);
  c_preg := (pts ->> 'C_preg')::numeric;
  if coalesce((e.incluir ->> 'F')::boolean, false) and not (coalesce(p_jefe, '{}'::jsonb) ? 'criteriosF') then
    null; -- el jefe aún no califica los ejercicios escritos: la parte C queda pendiente
  elsif coalesce((e.incluir ->> 'F')::boolean, false) then
    select count(*) into nf from jsonb_array_elements(coalesce(p_jefe -> 'criteriosF', '[]'::jsonb)) x where x = 'true'::jsonb;
    pts := pts || jsonb_build_object('F', round(nf::numeric / 12 * 100, 1));
    if c_tot > 0 and c_preg is not null then
      pts := pts || jsonb_build_object('C', round(c_preg * 0.7 + (pts ->> 'F')::numeric * 0.3, 1));
    elsif c_tot = 0 then
      pts := pts || jsonb_build_object('C', (pts ->> 'F')::numeric);
    end if;
  elsif c_preg is not null then
    pts := pts || jsonb_build_object('C', c_preg);
  end if;
  -- Nota final = suma de (puntaje × peso ÷ 100) de las partes incluidas
  if hay_nota then
    foreach parte in array array['A', 'B', 'C', 'D', 'E'] loop
      peso := coalesce((e.pesos ->> parte)::numeric, 0);
      continue when peso = 0;
      valor := (pts ->> parte)::numeric;
      if valor is null then
        -- parte que existe pero aún sin calificar
        if (parte in ('A', 'B') and coalesce((pts ->> (parte || '_total'))::int, 0) > 0)
           or (parte = 'C' and (c_tot > 0 or coalesce((e.incluir ->> 'F')::boolean, false)))
           or (parte in ('D', 'E') and coalesce((e.incluir ->> parte)::boolean, false)) then
          hay_nota := false;
        end if;
        continue;
      end if;
      nota := nota + valor * peso / 100;
    end loop;
  end if;
  return jsonb_build_object('puntajes', pts, 'nota', case when hay_nota then round(nota, 1) else null end);
end;
$$;

-- ---------------------------------------------------------------------
-- Listar: el admin ve todas; cada usuario ve las suyas (como técnico o
-- como jefe inmediato). Al técnico no se le muestran notas ni la parte
-- del jefe.
-- ---------------------------------------------------------------------
drop function if exists eval_listar(uuid);
create or replace function eval_listar(p_usuario uuid)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select case
           when eval_es_admin(p_usuario) or e.jefe_id = p_usuario then to_jsonb(e)
           else to_jsonb(e) - array['puntajes', 'nota_final', 'evaluacion_jefe']
         end
    from evaluaciones e
   where eval_es_admin(p_usuario) or e.tecnico_id = p_usuario or e.jefe_id = p_usuario
   order by e.creado_en desc;
$$;

-- ---------------------------------------------------------------------
-- Crear (solo admin). La clave se guarda aparte.
-- ---------------------------------------------------------------------
create or replace function eval_crear(p_usuario uuid, p_eval jsonb, p_clave jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare nuevo uuid; quien text;
begin
  if not eval_es_admin(p_usuario) then
    raise exception 'Solo un administrador puede asignar evaluaciones.';
  end if;
  if not exists (select 1 from usuarios where id = (p_eval ->> 'tecnico_id')::uuid) then
    raise exception 'El técnico elegido no existe como usuario de la app.';
  end if;
  select name into quien from usuarios where id = p_usuario;
  insert into evaluaciones (codigo, tecnico_id, tecnico_nombre, jefe_id, jefe_nombre, creado_por, creado_por_nombre,
                            datos, pesos, incluir, preguntas)
  values (p_eval ->> 'codigo', (p_eval ->> 'tecnico_id')::uuid, p_eval ->> 'tecnico_nombre',
          nullif(p_eval ->> 'jefe_id', '')::uuid, p_eval ->> 'jefe_nombre', p_usuario, quien,
          coalesce(p_eval -> 'datos', '{}'::jsonb), coalesce(p_eval -> 'pesos', '{}'::jsonb),
          coalesce(p_eval -> 'incluir', '{}'::jsonb), coalesce(p_eval -> 'preguntas', '{}'::jsonb))
  returning id into nuevo;
  insert into evaluaciones_clave (evaluacion_id, clave) values (nuevo, p_clave);
  return nuevo;
end;
$$;

-- ---------------------------------------------------------------------
-- El técnico guarda su avance (p_enviar = false) o la envía (true).
-- Al enviarla se califica aquí y ya no puede cambiar nada.
-- ---------------------------------------------------------------------
create or replace function eval_responder(p_usuario uuid, p_id uuid, p_respuestas jsonb, p_escritos jsonb, p_enviar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e evaluaciones; k jsonb; parte text; total int; ok int; i int; pts jsonb := '{}'::jsonb; calc jsonb;
begin
  select * into e from evaluaciones where id = p_id for update;
  if not found then raise exception 'La evaluación no existe.'; end if;
  if e.tecnico_id <> p_usuario then raise exception 'Esta evaluación está asignada a otra persona.'; end if;
  if e.estado not in ('pendiente', 'en_curso') then raise exception 'Esta evaluación ya fue enviada y no se puede modificar.'; end if;

  if not p_enviar then
    update evaluaciones
       set respuestas = coalesce(p_respuestas, '{}'::jsonb), escritos = coalesce(p_escritos, '{}'::jsonb),
           estado = 'en_curso', iniciado_en = coalesce(iniciado_en, now())
     where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  select clave into k from evaluaciones_clave where evaluacion_id = p_id;
  foreach parte in array array['A', 'B', 'C'] loop
    total := coalesce(jsonb_array_length(k -> parte), 0);
    ok := 0;
    if total > 0 then
      for i in 0 .. total - 1 loop
        if jsonb_array_length(eval_ordenar(p_respuestas -> parte -> i)) > 0
           and eval_ordenar(p_respuestas -> parte -> i) = eval_ordenar(k -> parte -> i) then
          ok := ok + 1;
        end if;
      end loop;
      pts := pts || jsonb_build_object(parte || '_ok', ok, parte || '_total', total,
                                       case when parte = 'C' then 'C_preg' else parte end, round(ok::numeric / total * 100, 1));
    else
      pts := pts || jsonb_build_object(parte || '_ok', 0, parte || '_total', 0);
    end if;
  end loop;

  update evaluaciones
     set respuestas = coalesce(p_respuestas, '{}'::jsonb), escritos = coalesce(p_escritos, '{}'::jsonb),
         estado = 'respondida', iniciado_en = coalesce(iniciado_en, now()), enviado_en = now(), puntajes = pts
   where id = p_id
  returning * into e;
  calc := eval_calcular(e, e.evaluacion_jefe);
  update evaluaciones set puntajes = calc -> 'puntajes', nota_final = (calc ->> 'nota')::numeric where id = p_id;
  return jsonb_build_object('ok', true, 'enviada', true);
end;
$$;

-- ---------------------------------------------------------------------
-- El jefe inmediato (o un admin) guarda la parte práctica/rúbrica/
-- escritos/dictamen. Con p_cerrar = true la evaluación queda CERRADA
-- para siempre.
-- ---------------------------------------------------------------------
create or replace function eval_jefe(p_usuario uuid, p_id uuid, p_datos jsonb, p_cerrar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e evaluaciones; calc jsonb; faltan int;
begin
  select * into e from evaluaciones where id = p_id for update;
  if not found then raise exception 'La evaluación no existe.'; end if;
  if not (eval_es_admin(p_usuario) or e.jefe_id = p_usuario) then
    raise exception 'Solo el jefe inmediato asignado o un administrador puede completar esta parte.';
  end if;
  if e.estado = 'cerrada' then raise exception 'La evaluación ya está cerrada y no se puede modificar.'; end if;
  if e.tecnico_id = p_usuario and not eval_es_admin(p_usuario) then
    raise exception 'El técnico evaluado no puede completar su propia evaluación.';
  end if;

  if p_cerrar then
    if e.estado <> 'respondida' then raise exception 'El técnico todavía no ha enviado sus respuestas.'; end if;
    if coalesce((e.incluir ->> 'D')::boolean, false) then
      select count(*) into faltan from jsonb_array_elements(coalesce(p_datos -> 'practica', '[]'::jsonb)) x
       where coalesce(x ->> 'v', '') not in ('0', '1', '2', 'na');
      if faltan > 0 or jsonb_array_length(coalesce(p_datos -> 'practica', '[]'::jsonb)) = 0 then
        raise exception 'Falta completar la evaluación práctica (parte D).';
      end if;
    end if;
    if coalesce((e.incluir ->> 'E')::boolean, false) then
      select count(*) into faltan from jsonb_array_elements(coalesce(p_datos -> 'rubrica', '[]'::jsonb)) x
       where coalesce(x ->> 'v', '') not in ('1', '2', '3', '4', '5');
      if faltan > 0 or jsonb_array_length(coalesce(p_datos -> 'rubrica', '[]'::jsonb)) = 0 then
        raise exception 'Falta completar la rúbrica de competencias (parte E).';
      end if;
    end if;
    if coalesce(p_datos ->> 'dictamen', '') not in ('promocion', 'desarrollo', 'no') then
      raise exception 'Falta elegir el dictamen.';
    end if;
  end if;

  calc := eval_calcular(e, p_datos);
  update evaluaciones
     set evaluacion_jefe = coalesce(p_datos, '{}'::jsonb),
         puntajes = calc -> 'puntajes',
         nota_final = (calc ->> 'nota')::numeric,
         estado = case when p_cerrar then 'cerrada' else estado end,
         cerrado_en = case when p_cerrar then now() else cerrado_en end
   where id = p_id;
  return calc;
end;
$$;

-- ---------------------------------------------------------------------
-- Clave de respuestas (solo admin) — para descargar el examen calificado
-- ---------------------------------------------------------------------
create or replace function eval_clave(p_usuario uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k jsonb;
begin
  if not eval_es_admin(p_usuario) then raise exception 'Solo un administrador puede ver la clave.'; end if;
  select clave into k from evaluaciones_clave where evaluacion_id = p_id;
  return k;
end;
$$;

-- ---------------------------------------------------------------------
-- Eliminar (solo admin y solo si NO está cerrada)
-- ---------------------------------------------------------------------
create or replace function eval_eliminar(p_usuario uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not eval_es_admin(p_usuario) then raise exception 'Solo un administrador puede eliminar evaluaciones.'; end if;
  if exists (select 1 from evaluaciones where id = p_id and estado = 'cerrada') then
    raise exception 'Una evaluación cerrada no se puede eliminar.';
  end if;
  delete from evaluaciones where id = p_id;
end;
$$;

grant execute on function eval_listar(uuid), eval_crear(uuid, jsonb, jsonb),
  eval_responder(uuid, uuid, jsonb, jsonb, boolean), eval_jefe(uuid, uuid, jsonb, boolean),
  eval_clave(uuid, uuid), eval_eliminar(uuid, uuid) to anon, authenticated;
-- Las funciones internas no se llaman desde la app
revoke execute on function eval_calcular(evaluaciones, jsonb) from public, anon, authenticated;

notify pgrst, 'reload schema';
