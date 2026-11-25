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
| Place search / address → coordinates | **Kakao Local API** (keyword search, address search, coord→address), called only from the server | Free with a REST key; best data for Korean shops and 도로명/지번 addresses |
| Calendar UI | Own month grid built with `date-fns` | Full control over the dots and badges in each day cell |
| Add by link | Paste a **Google Maps share link**; the server reads name + coordinates from the URL | Fastest way to add a place on a phone |
| Data fetching | Server Components + Server Actions, `@supabase/ssr` | Little client state needed |
| Drag to reorder | `@dnd-kit` | To reorder a day's places (1, 2, 3…) |
| Hosting | **Vercel** | Already chosen |

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
│   ◀  November 2026  ▶                          [Today]   │
│  Sun   Mon   Tue   Wed   Thu   Fri   Sat                  │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐               │
│ │  1  │  2  │  3  │  4  │  5  │  6  │  7  │               │
│ │     │ ●●  │     │ ○   │     │     │     │  ● went       │
│ │     │     │     │     │     │     │     │  ○ will go    │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤               │
│ │ ... │     │     │     │     │     │     │               │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘               │
└──────────────────────────────────────────────────────────┘
```
- Month grid. Each day shows:
  - dots or a count of saved places (filled = went, outline = will go)
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
- Settings — language, first day of the week

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
  source_url    text,                     -- Google Maps link it came from
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

```
- **Row Level Security** on every table: `user_id = auth.uid()`.

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
  api/parse-link/route.ts  # Google Maps link -> name, lat, lng, address
components/
  NavBar.tsx  MonthCalendar.tsx  DayCell.tsx
  DateBar.tsx  PlaceMap.tsx  PlaceList.tsx  PlaceForm.tsx  PlaceSearch.tsx
lib/
  supabase/{client,server}.ts
  kakao.ts              # Kakao Local API: search, address→coords, coords→address
  mapsLink.ts           # URL parsing rules (unit-tested)
supabase/migrations/    # SQL above
```

---

## 5. Build order

1. **Setup:** Next.js, Tailwind, shadcn, Supabase project, SQL migration, Vercel deploy of an empty app.
2. **Auth:** email magic-link login through Supabase (just me).
3. **Nav bar + calendar page:** month grid that reads place counts from Supabase.
4. **Map page:** date bar, MapLibre map, numbered markers and route line.
5. **Add / edit place:** search, map pin, all fields, people tags.
6. **Reorder** by drag and drop, plus delete.
7. **Add by Google Maps link** (+ Android share-to-app).
8. **Polish:** mobile layout, empty states, loading states.
9. *(Phase 2)* photos, all-places list and filters, all-time map.

---

## 6. Decisions
- **Users:** just me for now. Login still uses Supabase Auth with RLS, so more users can be added later.
- **Language:** English first, with Korean support through `next-intl` (`en`, `ko`).
- **Map:** OpenStreetMap tiles through MapLibre for display, Kakao Local API for search and addresses.
- **Google Calendar:** dropped.
- **Device:** phone first. Bottom sheet instead of a side panel, large tap targets, and a compact nav bar.

## 7. Add a place: paste a link, share text or address
Paste a link into the Add form. The server parses it and pre-fills the form, and you confirm.

| Link type | Example | What we get |
|---|---|---|
| Full place URL | `google.com/maps/place/Blue+Bottle/@37.54,127.05,17z/data=...!3d37.5446!4d127.0581` | **Name** from `/place/<name>`. **Exact pin** from `!3d<lat>!4d<lng>`. `@lat,lng` is only the map's center, so it is a fallback. |
| Place URL with no coordinates (real sample) | `google.com/maps/place/인덕원비빔국수+안양본점/data=!4m4!3m3!1s0x357b…:0x4759…!16s/g/1tdy2d4b!20s8Q98CX2H+2P3` | **Name** from `/place/`. **Plus Code** from `!20s…` (`8Q98CX2H+2P3`), decoded offline with `open-location-code` to **37.40001, 126.97930** (exact pin, about 3 m). `!1s0x…:0x…` is Google's place ID, which can't be turned into coordinates without Google's paid API. |
| Short share link (phone) | `maps.app.goo.gl/AbC123` | The server follows the redirect to get the full URL, then parses it as above. |
| Search-style URL | `google.com/maps?q=Blue+Bottle+Seongsu` or `?q=37.54,127.05` | Coordinates if they are in `q`. Otherwise the name is searched with Kakao keyword search. |
| Pasted share text | `Blue Bottle Seongsu\nhttps://maps.app.goo.gl/...` | The text before the link is used as a name hint. |

- **Order the app tries:** `!3d!4d`, then the `!20s` Plus Code, then `?q=` coordinates, then `@lat,lng`, then a name search on Kakao.
- **Address:** a Google link has no address in it, so we get the 도로명 and 지번 addresses from the coordinates with Kakao `coord2address`.
- **Altitude** is not in the links. We get **latitude and longitude**.
- **If parsing fails:** fall back to the search box and a map pin. You can always drag the pin to fix it.
- We only read the **URL** and never scrape Google's page content.
- **Phone shortcut:** as an installed PWA on **Android**, the app can appear in Google Maps' "Share" menu (Web Share Target), which opens the Add form pre-filled. **iOS** doesn't allow this for web apps, so on iPhone it is copy then paste. The form auto-reads the clipboard when you tap "Paste link".

### Naver / Kakao share text and plain addresses
- Naver links (`naver.me`) and Kakao links (`kko.kakao.com`) usually carry only a place ID, and we don't scrape their pages.
- Their app **share text** usually includes the name and address. We take those lines and look them up with Kakao (address search, plus keyword search for the name) to get the exact pin.
- A typed or pasted **도로명주소 / 지번주소** goes through Kakao address search, which pins the building.
#### Real Kakao sample (two forms)
```
A) [카카오맵] 멘부쿠제면소 https://kko.to/Iqc4jhs73Q
B) 경기 의왕시 이미로 40 (포일동)
```
You can paste A, B, or both. Parsing:
| Piece | Rule | Result |
|---|---|---|
| Source | starts with `[카카오맵]` (or `[네이버 지도]`) | kakao |
| Name | text between the prefix and the URL | `멘부쿠제면소` |
| Link | `kko.to/…` or `kko.kakao.com/…`. The server reads only the redirect target, never the page | place ID from `place.map.kakao.com/<id>` |
| Address | a line that starts with a 시/도 name and contains `…로/길 + number`. The `(포일동)` part is removed before searching | `경기 의왕시 이미로 40` |

How the coordinates are found (Kakao Local API):
1. **Address present:** run address search to get the building's exact coordinates and the 도로명/지번 addresses. Then run keyword search for the name near those coordinates (within 100 m) to get the category and Kakao place ID.
2. **Only name + link:** run keyword search for the name, and pick the result whose **ID matches the link's place ID**, which gives an exact match. If the link can't be resolved, show the top results to pick from.
3. **Only address:** run address search, then type a nickname yourself.

- **Fallback:** search box, then drop or drag the pin on the map.

## 8. Setup you'll do (when we get there)
1. Create a **Supabase** project and copy its URL and anon key, plus the service-role key for the server only.
2. Create a **Kakao Developers** app and copy its **REST API key**. It is used only on the server and is never shipped to the phone.
3. Create a **Vercel** project from this repo and add the keys as environment variables.
