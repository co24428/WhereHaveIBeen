# WhereHaveIBeen 📍

A phone-first personal map of places you **went** and **will go**, organised by day.

- **Calendar** (`/`): month grid with dots per day. Filled dots mean you went, outlined dots mean you will go. Tap a day to open its map.
- **Map** (`/map?date=…`): numbered markers 1, 2, 3… joined by a route line. A date bar has ‹ › buttons. A list of the day's places sits in a bottom sheet, and you drag ≡ to reorder it.
- **Add / edit** (`/add`): paste a Google / Kakao / Naver map link, `[카카오맵] …` share text, or a 도로명주소. You can also search, or tap the map to drop a pin. Then fill in the nickname, people, memo, category, time, rating and cost.
- **Android:** install the app (Chrome menu → *Add to Home screen*), and it appears in Google Maps' / Kakao Map's **Share** menu.
- English and Korean (한 / EN button in the nav bar).

Stack: Next.js 16 · Tailwind · Supabase (Postgres, Auth, RLS) · MapLibre + OpenFreeMap tiles · Kakao Local API · Vercel. See [PLAN.md](PLAN.md).

---

## Setup

### 1. Supabase (use your existing project)
All tables live in their own schema, **`wherehaveibeen`**, so this app can share a Supabase project with another app without touching that app's tables.

1. Open your existing project → **SQL Editor** → paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates the schema `wherehaveibeen` with the tables `places`, `people` and `place_people`, plus row-level security. Running it again is safe.
2. **Project Settings → Data API → Exposed schemas**: add **`wherehaveibeen`** next to `public`, then save. Without this, the app gets the error *"The schema must be one of the following: public…"*.
3. **Authentication → URL Configuration → Redirect URLs**: **add** `https://<your-vercel-url>/auth/callback` and `http://localhost:3000/auth/callback`. Leave the **Site URL** as it is, because it belongs to your other app.
4. **Authentication → Emails → Magic Link** template: add the code line. Other apps in this project will show the code too, which is harmless.
   ```html
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```
5. **Project Settings → API**: copy the **Project URL** and the **publishable** key (or the legacy *anon* key).

> **Shared project, shared users.** Accounts (`auth.users`) are shared with the other app. That's fine because:
> - Every row is tied to its owner's `user_id` by row-level security, so other users can never see your places.
> - Set `ALLOWED_EMAILS` to your email so only you can log in here.
> - **Don't** turn off "Allow new users to sign up". That setting is for the whole project and would affect the other app.

### 2. Kakao Local API
1. <https://developers.kakao.com> → **내 애플리케이션 → 애플리케이션 추가하기**.
2. **앱 키** → copy the **REST API 키**. It is used only on the server.
3. If searches fail with a 403 error, make sure **카카오맵** is turned on in the app's product settings (제품 설정).

### 3. Vercel
1. Import this repo at <https://vercel.com/new>.
2. Add these **Environment Variables** (see [`.env.example`](.env.example)):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable / anon key |
| `ALLOWED_EMAILS` | your email (only this email can log in) |
| `KAKAO_REST_API_KEY` | Kakao REST API key |
| `APP_TIME_ZONE` | `Asia/Seoul` |

3. Deploy.

### Local development
```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

Checks: `npm test` (link / share-text parsers, translations), `npm run lint`, `npm run typecheck`.

---

## How "paste" works
| You paste | What happens |
|---|---|
| Google Maps link | Name from `/place/<name>`. Exact pin from `!3d…!4d…` or the Plus Code in `!20s…`. Address from Kakao. |
| `maps.app.goo.gl` / `kko.to` / `naver.me` | The server follows the redirect (it reads only the `Location` header, never the page), then parses the full link. |
| `[카카오맵] 이름 https://kko.to/…` and/or `경기 의왕시 이미로 40 (포일동)` | The address goes to Kakao address search for the building pin, then the name is matched nearby. |
| A plain 도로명 / 지번 address | Kakao address search |
| Anything else | Kakao keyword search. You pick from the results. |

The parsing rules live in `lib/parse/` and are unit-tested in `lib/parse/parse.test.ts`.

## Notes
- The map uses free OpenStreetMap tiles from [OpenFreeMap](https://openfreemap.org), with no key. Set `NEXT_PUBLIC_MAP_STYLE_URL` to use another MapLibre style.
- MapLibre's web worker is copied to `public/` by `scripts/copy-maplibre-worker.mjs`, which runs on install, dev and build.
