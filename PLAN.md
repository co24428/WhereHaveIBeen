# WhereHaveIBeen — Plan

A personal map for marking places you **went** and places you **will go**, organized by day.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Deploys to Vercel with no setup; server and client code in one repo |
| Styling | **Tailwind CSS + shadcn/ui** | Fast to build, ready-made accessible components (dialog, calendar, popover) |
| Database / Auth | **Supabase** (Postgres + Auth + Row Level Security) | Already chosen; Google sign-in is built in |
| Map | **MapLibre GL / react-map-gl** with free OpenStreetMap-based tiles (e.g. MapTiler free tier) | Free, no credit card. Google Maps JS needs billing set up |
| Place search (geocoding) | **Nominatim** (OSM, free) at first; can switch to **Mapbox / Google Places** later if results are poor | Free; search quality for small shops can be weak, so the provider sits behind one module that is easy to swap |
| Calendar UI | Own month grid built with `date-fns` | Full control over the dots and badges in each day cell |
| Google Calendar | **Google Calendar API** (free, read-only scope) | No cost; quota is far beyond personal use |
| Data fetching | Server Components + Server Actions, `@supabase/ssr` | Little client state needed |
| Drag to reorder | `@dnd-kit` | To reorder a day's places (1, 2, 3…) |
| Hosting | **Vercel** | Already chosen |

### About Google Calendar being free
- The API is **free**. You need a Google Cloud project with an OAuth client.
- Log in with Google through Supabase Auth and request the extra scope `calendar.readonly`.
- **Catch:** Supabase gives the Google token at login but does **not** refresh it. We save the Google `refresh_token` in our own table and refresh it on the server.
- **Catch 2:** while the Google OAuth app is in "Testing" mode, refresh tokens **expire after 7 days**. For personal use, switch the app to "In production" (unverified). You will see a "Google hasn't verified this app" warning once at login. That is fine for up to 100 users with no review.

---

## 2. Screens

### Layout (every page)
```
┌──────────────────────────────────────────────────────────┐
│ 📍 WhereHaveIBeen    Calendar   Map   [+ Add place]   (👤) │  ← top nav bar (sticky)
├──────────────────────────────────────────────────────────┤
│                         page content                      │
```

### 2.1 Main page `/` — Calendar
```
┌──────────────────────────────────────────────────────────┐
│ NAV                                                       │
├──────────────────────────────────────────────────────────┤
│   ◀  November 2026  ▶                [Today] [G-Cal: ON]  │
│  Sun   Mon   Tue   Wed   Thu   Fri   Sat                  │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │
│ │  1  │  2  │  3  │  4  │  5  │  6  │  7  │               │
│ │     │ ●●  │     │ ○   │     │     │     │  ● went       │
│ │     │     │     │📅Mtg│     │     │     │  ○ will go    │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤  📅 Google    │
│ │ ... │     │     │     │     │     │     │     event     │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │
└──────────────────────────────────────────────────────────┘
```
- Month grid. Each day shows:
  - dots or a count of saved places (filled = went, outline = will go)
  - Google Calendar event titles (shortened), when connected
- **Click a day → go to `/map?date=2026-11-02`**
- On mobile, the grid shrinks to dots only and the events become a list under the grid.

### 2.2 Map page `/map?date=YYYY-MM-DD`
```
┌──────────────────────────────────────────────────────────┐
│ NAV                                                       │
├──────────────────────────────────────────────────────────┤
│   ◀   Mon, Nov 2, 2026   ▶          (sticky date bar)    │
├──────────────────────────────────────────────────────────┤
│ ┌───────────────┐                                         │
│ │ 1 Cafe Onion  │         (1)───────(2)                   │
│ │ 2 Gyeongbok.. │                     \                   │
│ │ 3 Dinner w/.. │          MAP         (3)                │
│ │  [+ add]      │                                         │
│ └───────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```
- The map fills the screen.
- A **date bar** stays fixed under the nav, with ◀ ▶ to move one day back or forward (and a click opens a small date picker).
- Places appear as **numbered markers 1, 2, 3…** in visit order, joined by a line to show the route.
- Side panel (a bottom sheet on mobile) lists the day's places. You can drag to reorder, and clicking a row focuses its marker.
- Clicking a marker opens a popup with the nickname, time, people and memo, plus Edit and Delete.
- If the day has Google events that have a location, show them as "Add to map?" suggestions.

### 2.3 Add / edit place — `/add` (also opens as a dialog from the map)
Fields:
| Field | Notes |
|---|---|
| **Search place** | Type to search, then pick a result. You can also click the map to drop a pin |
| **Date** | Required. Defaults to the selected day |
| **Status** | `Went` / `Will go`. Set automatically from the date (past = went), but you can change it |
| **Order** | Next number for that day by default; can be changed by dragging |
| **Nickname** | e.g. "That good ramen place" |
| **Time** | Optional start and end time |
| **With whom** | Tag input with autocomplete from people you entered before |
| **Purpose / memo** | Free text |
| **Category** | Food, Cafe, Sightseeing, Shopping, Work, Home, Other (with an icon/color per category) |
| **Rating** | 1–5 stars (for "went") |
| **Cost** | Optional amount |
| **Photos** | *(phase 2)* Supabase Storage |

### 2.4 Later screens (phase 2+)
- `/places` — list or search of every place, with filters (person, category, status)
- "All-time map" — every place you ever went, as a heat map or clusters
- Settings — connect or disconnect Google Calendar, choose the week's first day

---

## 3. Data model (Supabase / Postgres)

```sql
-- places: one row = one visit (or planned visit) on one day
create table places (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  visit_date    date not null,
  visit_order   int  not null,            -- 1, 2, 3 ... within the day
  status        text not null check (status in ('visited','planned')),
  nickname      text,
  name          text not null,            -- official place name from search
  address       text,
  lat           double precision not null,
  lng           double precision not null,
  start_time    time,
  end_time      time,
  category      text,
  memo          text,
  rating        smallint check (rating between 1 and 5),
  cost          numeric,
  google_event_id text,                   -- if imported from Google Calendar
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on places (user_id, visit_date, visit_order);

-- people you go with (reused for autocomplete & filtering)
create table people (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users on delete cascade,
  name     text not null,
  unique (user_id, name)
);
create table place_people (
  place_id  uuid references places on delete cascade,
  person_id uuid references people on delete cascade,
  primary key (place_id, person_id)
);

-- Google refresh token, server-side only
create table google_tokens (
  user_id       uuid primary key references auth.users on delete cascade,
  refresh_token text not null,
  updated_at    timestamptz default now()
);
```
- **Row Level Security** on every table: `user_id = auth.uid()`.
- `google_tokens` has no client policies and is read only with the service-role key on the server.

---

## 4. Project structure

```
app/
  layout.tsx            # nav bar
  page.tsx              # calendar (main)
  map/page.tsx          # map + sticky date bar
  add/page.tsx          # add place
  login/page.tsx
  auth/callback/route.ts  # Supabase OAuth callback, saves Google refresh token
  api/gcal/route.ts     # fetch Google events for a month (server)
components/
  NavBar.tsx  MonthCalendar.tsx  DayCell.tsx
  DateBar.tsx  PlaceMap.tsx  PlaceList.tsx  PlaceForm.tsx  PlaceSearch.tsx
lib/
  supabase/{client,server}.ts
  geocode.ts            # Nominatim now; swap provider later
  gcal.ts               # token refresh + events.list
supabase/migrations/    # SQL above
```

---

## 5. Build order

1. **Setup:** Next.js, Tailwind, shadcn, Supabase project, SQL migration, Vercel deploy of an empty app.
2. **Auth:** Google login through Supabase (only the basic scope at first).
3. **Nav bar + calendar page:** month grid that reads place counts from Supabase.
4. **Map page:** date bar, MapLibre map, numbered markers and route line.
5. **Add / edit place:** search, map pin, all fields, people tags.
6. **Reorder** by drag and drop, plus delete.
7. **Google Calendar:** extra scope, saving the refresh token, events in calendar cells, "add event's location to map".
8. **Polish:** mobile layout, empty states, loading states.
9. *(Phase 2)* photos, all-places list and filters, all-time map.

---

## 6. Questions for you
1. **Just you, or other people too?** This plan assumes multiple users are possible (each sees only their own data), which costs almost nothing extra.
2. **Language of the UI:** English, Korean, or both?
3. **Map provider:** is the free OpenStreetMap map OK, or do you want Google Maps? Google Maps has better place search in Korea and Asia, but it needs a billing account. There is a free monthly credit.
4. **Google Calendar:** only *read* events, or also *write* planned places back to Google Calendar as events?
5. Mainly used on **phone or desktop**?
