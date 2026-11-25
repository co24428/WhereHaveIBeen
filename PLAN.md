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

### Google Calendar (checked, see section 7)
- Use the calendar's **secret iCal address** (a private `.ics` link), not OAuth. It is read-only and needs no Google Cloud project, no token refresh and no 7-day token expiry.
- The link is kept in a Vercel env var `GCAL_ICS_URLS` (comma-separated for more than one calendar) and fetched **only on the server**.
- A **⟳ Refresh** button fetches the feed again, and the result is cached in Supabase.
- Each event's `LOCATION` text is turned into map coordinates with Nominatim, then the app shows it as a "suggested place".

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

-- cached Google Calendar events (filled by the Refresh button)
create table gcal_events (
  uid         text not null,              -- iCal UID (+ recurrence date)
  user_id     uuid not null references auth.users on delete cascade,
  title       text,
  location    text,                       -- free text from Google
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean default false,
  fetched_at  timestamptz default now(),
  primary key (user_id, uid)
);
```
- **Row Level Security** on every table: `user_id = auth.uid()`.
- The secret iCal URL is **not** stored in the database. It lives only in the Vercel env var.

---

## 4. Project structure

```
app/
  layout.tsx            # nav bar
  page.tsx              # calendar (main)
  map/page.tsx          # map + sticky date bar
  add/page.tsx          # add place
  login/page.tsx
  auth/callback/route.ts  # Supabase auth callback
  api/gcal/refresh/route.ts  # download .ics, cache events (server)
components/
  NavBar.tsx  MonthCalendar.tsx  DayCell.tsx
  DateBar.tsx  PlaceMap.tsx  PlaceList.tsx  PlaceForm.tsx  PlaceSearch.tsx
lib/
  supabase/{client,server}.ts
  geocode.ts            # Nominatim now; swap provider later
  gcal.ts               # fetch + parse .ics (node-ical)
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
7. **Google Calendar:** iCal feed, refresh button, 📅 in calendar cells, "Add to map?" suggestions.
8. **Polish:** mobile layout, empty states, loading states.
9. *(Phase 2)* photos, all-places list and filters, all-time map.

---

## 6. Decisions
- **Users:** just me for now. Login still uses Supabase Auth with RLS, so more users can be added later.
- **Language:** English first, with Korean support through `next-intl` (`en`, `ko`).
- **Map:** OpenStreetMap through MapLibre, with Nominatim for search.
- **Google Calendar:** read-only, with a manual refresh button.
- **Device:** phone first. Bottom sheet instead of a side panel, large tap targets, and a compact nav bar.

## 7. Google Calendar check
| Question | Answer |
|---|---|
| Free? | Yes. Normal use of the Calendar API and of the iCal feed costs nothing. Google's usage-limits page says charges for going **over** quota are planned. One person's refreshes stay far below the quota. |
| Location data? | **Yes, as free text only.** Each event has an optional `location` field (`LOCATION` in .ics) containing whatever was typed or picked, e.g. `"Blue Bottle Seongsu, 7 Achasan-ro, Seongdong-gu, Seoul"`. There is **no latitude/longitude**, so the app has to geocode the text. |
| Events without a location | Shown in the calendar cell, but no map suggestion. |
| Geocoding can fail | When the text is vague (e.g. "mom's house"), the user picks the right result or drops a pin. The confirmed coordinates are saved, so it is asked only once. |
| Recurring events | The .ics has repeat rules; `node-ical` expands them into dates. |
| Risk | The secret link works like a password. It lives only in a server env var, and if it leaks you press "Reset" in Google Calendar settings. |
| Fallback | If the iCal feed is too slow to update or blocked (e.g. by a work account's admin), switch to OAuth with the `calendar.readonly` scope. The app would then need to be published to "In production" to avoid the 7-day token expiry. |

### Import flow
1. Press ⟳ on the calendar. The server downloads the .ics and saves new or changed events in a `gcal_events` cache table.
2. Days with events show 📅 in the calendar.
3. On the map page for that day, events with a location appear as **"Add to map?"** cards.
4. Tap a card. The app geocodes the location text and pre-fills the place form (name, time, memo = event title). Confirm, and the place is saved with `google_event_id`, so it is never suggested twice.
