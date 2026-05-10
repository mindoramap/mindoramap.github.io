create table if not exists public.mind_folders (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text not null,
  name text not null,
  parent_id uuid references public.mind_folders (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.mind_folders enable row level security;

drop policy if exists "users can read their own folders" on public.mind_folders;
create policy "users can read their own folders"
on public.mind_folders
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "users can insert their own folders" on public.mind_folders;
create policy "users can insert their own folders"
on public.mind_folders
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "users can update their own folders" on public.mind_folders;
create policy "users can update their own folders"
on public.mind_folders
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "users can delete their own folders" on public.mind_folders;
create policy "users can delete their own folders"
on public.mind_folders
for delete
to authenticated
using (auth.uid() = owner_id);

alter table public.mind_maps
  add column if not exists folder_id uuid,
  add column if not exists parent_map_id uuid,
  add column if not exists viewport jsonb not null default '{"x":0,"y":0,"zoom":1}'::jsonb,
  add column if not exists is_favorite boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mind_maps_parent_map_id_fkey'
  ) then
    alter table public.mind_maps
      add constraint mind_maps_parent_map_id_fkey
      foreign key (parent_map_id) references public.mind_maps (id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'mind_maps_folder_id_fkey'
  ) then
    alter table public.mind_maps
      add constraint mind_maps_folder_id_fkey
      foreign key (folder_id) references public.mind_folders (id) on delete set null;
  end if;
end $$;
