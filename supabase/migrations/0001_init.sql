-- WhereHaveIBeen: initial schema
-- Run in Supabase → SQL Editor (or `supabase db push`).

create table if not exists public.places (
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
create index if not exists places_user_date_order on public.places (user_id, visit_date, visit_order);

create table if not exists public.people (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  name     text not null,
  unique (user_id, name)
);

create table if not exists public.place_people (
  place_id  uuid not null references public.places on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  primary key (place_id, person_id)
);

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

-- Row Level Security: every user sees only their own rows
alter table public.places       enable row level security;
alter table public.people       enable row level security;
alter table public.place_people enable row level security;

create policy "own places" on public.places
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own people" on public.people
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own place_people" on public.place_people
  for all to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.places p where p.id = place_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.people pe where pe.id = person_id and pe.user_id = (select auth.uid()))
  );
