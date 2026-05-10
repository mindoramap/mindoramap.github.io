create extension if not exists pgcrypto;

create or replace function public.is_superadmin_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_email, '')) = 'gabrielnbn@hotmail.com';
$$;

create table if not exists public.access_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Usuario',
  role text not null default 'member' check (role in ('member', 'superadmin')),
  access_granted_at timestamptz,
  access_code_id uuid,
  total_usage_seconds integer not null default 0,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.mind_maps (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text not null,
  title text not null,
  mode text not null check (mode in ('study', 'brainstorm', 'project')),
  updated_at timestamptz not null default timezone('utc', now()),
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb
);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_profile_updated_at();

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_display_name text;
  v_role text;
  v_access_granted_at timestamptz;
begin
  v_email := lower(coalesce(new.email, ''));
  v_display_name := trim(
    coalesce(
      new.raw_user_meta_data ->> 'name',
      split_part(v_email, '@', 1),
      'Usuario'
    )
  );
  v_role := case when public.is_superadmin_email(v_email) then 'superadmin' else 'member' end;
  v_access_granted_at := case when v_role = 'superadmin' then timezone('utc', now()) else null end;

  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    role,
    access_granted_at,
    last_seen_at
  )
  values (
    new.id,
    v_email,
    coalesce(nullif(v_display_name, ''), 'Usuario'),
    v_role,
    v_access_granted_at,
    timezone('utc', now())
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    access_granted_at = case
      when excluded.role = 'superadmin' then coalesce(public.user_profiles.access_granted_at, excluded.access_granted_at)
      else public.user_profiles.access_granted_at
    end,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row
execute function public.handle_auth_user();

insert into public.user_profiles (
  user_id,
  email,
  display_name,
  role,
  access_granted_at,
  last_seen_at
)
select
  users.id,
  lower(coalesce(users.email, '')),
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'name'), ''),
    split_part(lower(coalesce(users.email, '')), '@', 1),
    'Usuario'
  ),
  case when public.is_superadmin_email(users.email) then 'superadmin' else 'member' end,
  case when public.is_superadmin_email(users.email) then timezone('utc', now()) else null end,
  timezone('utc', now())
from auth.users as users
on conflict (user_id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  role = excluded.role,
  access_granted_at = case
    when excluded.role = 'superadmin' then coalesce(public.user_profiles.access_granted_at, excluded.access_granted_at)
    else public.user_profiles.access_granted_at
  end,
  updated_at = timezone('utc', now());

create or replace function public.is_current_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and role = 'superadmin'
  );
$$;

alter table public.user_profiles enable row level security;
alter table public.access_codes enable row level security;
alter table public.mind_maps enable row level security;

drop policy if exists "profiles read own or superadmin" on public.user_profiles;
create policy "profiles read own or superadmin"
on public.user_profiles
for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_current_superadmin()
);

drop policy if exists "superadmin updates profiles" on public.user_profiles;
create policy "superadmin updates profiles"
on public.user_profiles
for update
to authenticated
using (public.is_current_superadmin())
with check (public.is_current_superadmin());

drop policy if exists "superadmin reads access codes" on public.access_codes;
create policy "superadmin reads access codes"
on public.access_codes
for select
to authenticated
using (public.is_current_superadmin());

drop policy if exists "superadmin manages access codes" on public.access_codes;
create policy "superadmin manages access codes"
on public.access_codes
for all
to authenticated
using (public.is_current_superadmin())
with check (public.is_current_superadmin());

drop policy if exists "users can read their own maps" on public.mind_maps;
create policy "users can read their own maps"
on public.mind_maps
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "users can insert their own maps" on public.mind_maps;
create policy "users can insert their own maps"
on public.mind_maps
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "users can update their own maps" on public.mind_maps;
create policy "users can update their own maps"
on public.mind_maps
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "users can delete their own maps" on public.mind_maps;
create policy "users can delete their own maps"
on public.mind_maps
for delete
to authenticated
using (auth.uid() = owner_id);

create or replace function public.activate_access_code(p_code text)
returns table(ok boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_profile public.user_profiles%rowtype;
  v_code_id uuid;
  v_hash text;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return query select false, 'Sessao invalida.';
    return;
  end if;

  select *
  into v_profile
  from public.user_profiles
  where user_id = v_uid;

  if not found then
    return query select false, 'Perfil nao encontrado.';
    return;
  end if;

  if v_profile.role = 'superadmin' then
    update public.user_profiles
    set access_granted_at = coalesce(access_granted_at, timezone('utc', now()))
    where user_id = v_uid;

    return query select true, 'Superadmin liberado.';
    return;
  end if;

  if v_profile.access_granted_at is not null then
    return query select true, 'Acesso ja liberado.';
    return;
  end if;

  v_hash := encode(extensions.digest(lower(trim(coalesce(p_code, ''))), 'sha256'), 'hex');

  update public.access_codes
  set
    used_at = timezone('utc', now()),
    used_by = v_uid
  where code_hash = v_hash
    and used_at is null
    and expires_at >= timezone('utc', now())
  returning id into v_code_id;

  if v_code_id is null then
    return query select false, 'Codigo invalido, expirado ou ja utilizado.';
    return;
  end if;

  update public.user_profiles
  set
    access_granted_at = timezone('utc', now()),
    access_code_id = v_code_id,
    updated_at = timezone('utc', now())
  where user_id = v_uid;

  return query select true, 'Acesso liberado com sucesso.';
end;
$$;

grant execute on function public.activate_access_code(text) to authenticated;

create or replace function public.create_access_code(p_expires_in_hours integer default 24)
returns table(access_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_code text;
  v_expires_at timestamptz;
begin
  v_uid := auth.uid();

  if v_uid is null or not public.is_current_superadmin() then
    raise exception 'Acesso negado.';
  end if;

  v_code := lower(encode(extensions.gen_random_bytes(8), 'hex'));
  v_expires_at := timezone('utc', now()) + make_interval(hours => greatest(1, least(coalesce(p_expires_in_hours, 24), 720)));

  insert into public.access_codes (
    code_hash,
    created_by,
    expires_at
  )
  values (
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    v_uid,
    v_expires_at
  );

  return query select v_code, v_expires_at;
end;
$$;

grant execute on function public.create_access_code(integer) to authenticated;

create or replace function public.record_usage_seconds(p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return;
  end if;

  if p_seconds is null or p_seconds < 1 or p_seconds > 900 then
    return;
  end if;

  update public.user_profiles
  set
    total_usage_seconds = total_usage_seconds + p_seconds,
    last_seen_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where user_id = v_uid
    and (role = 'superadmin' or access_granted_at is not null);
end;
$$;

grant execute on function public.record_usage_seconds(integer) to authenticated;
