-- WhereHaveIBeen: initial schema
--
-- Everything lives in its own schema "wherehaveibeen", so it can share a
-- Supabase project with other apps without touching their tables.
--
-- Run in Supabase → SQL Editor. Then add "wherehaveibeen" to
-- Project Settings → Data API → Exposed schemas (see README).

create schema if not exists wherehaveibeen;

-- API roles need access to the schema (RLS below still limits rows)
grant usage on schema wherehaveibeen to authenticated, service_role;

create table if not exists wherehaveibeen.places (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  visit_date      date not null,
  visit_order     int  not null default 1,          -- 1, 2, 3 ... within the day
  status          text not null default 'planned' check (status in ('visited','planned')),
  nickname        text,
  name            text not null,                    -- official place name
  address         text,                             -- 도로명 address when known
  jibun_address   text,                             -- 지번 address
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  start_time      time,
  end_time        time,
  category        text,
  memo            text,
  rating          smallint check (rating between 1 and 5),
  cost            numeric check (cost >= 0),
  source_url      text,                             -- Google / Kakao / Naver link it came from
  kakao_place_id  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists places_user_date_order on wherehaveibeen.places (user_id, visit_date, visit_order);

create table if not exists wherehaveibeen.people (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  name     text not null,
  unique (user_id, name)
);

create table if not exists wherehaveibeen.place_people (
  place_id  uuid not null references wherehaveibeen.places on delete cascade,
  person_id uuid not null references wherehaveibeen.people on delete cascade,
  primary key (place_id, person_id)
);
create index if not exists place_people_person on wherehaveibeen.place_people (person_id);

-- keep updated_at fresh
create or replace function wherehaveibeen.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists places_touch on wherehaveibeen.places;
create trigger places_touch before update on wherehaveibeen.places
  for each row execute function wherehaveibeen.touch_updated_at();

-- table privileges for logged-in users (rows are filtered by RLS)
grant select, insert, update, delete on all tables in schema wherehaveibeen to authenticated;
grant all on all tables in schema wherehaveibeen to service_role;
alter default privileges in schema wherehaveibeen grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema wherehaveibeen grant all on tables to service_role;

-- Row Level Security: every user sees only their own rows
alter table wherehaveibeen.places       enable row level security;
alter table wherehaveibeen.people       enable row level security;
alter table wherehaveibeen.place_people enable row level security;

drop policy if exists "own places" on wherehaveibeen.places;
create policy "own places" on wherehaveibeen.places
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own people" on wherehaveibeen.people;
create policy "own people" on wherehaveibeen.people
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own place_people" on wherehaveibeen.place_people;
create policy "own place_people" on wherehaveibeen.place_people
  for all to authenticated
  using (exists (select 1 from wherehaveibeen.places p where p.id = place_id and p.user_id = (select auth.uid())))
  with check (
    exists (select 1 from wherehaveibeen.places p where p.id = place_id and p.user_id = (select auth.uid()))
    and exists (select 1 from wherehaveibeen.people pe where pe.id = person_id and pe.user_id = (select auth.uid()))
  );

-- make the API notice the new schema/tables right away
notify pgrst, 'reload schema';
