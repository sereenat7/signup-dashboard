<div align="center">

# 📊 Signups This Week

**A minimal React + Vite sandbox built to reproduce, fix, and verify two defects in the `SignupsThisWeek` dashboard tile.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![ESLint](https://img.shields.io/badge/lint-passing-4c1?logo=eslint&logoColor=white)
![Defects](https://img.shields.io/badge/defects%20fixed-2%2F2-4c1)

</div>

---

## 📋 Contents

| Section                                                                                      | What's in it                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [🐛 The report](#-the-report)                                                                | What support actually said                      |
| [🔍 Defect 1 — the crash](#-defect-1--uninitialised-state-caused-a-crash-on-first-render)    | Root cause, fix, and a correction to the report |
| [🔍 Defect 2 — the count](#-defect-2--the-count-compared-calendar-months-not-a-7-day-window) | Root cause and fix                              |
| [🚀 Running it](#-running-it-locally)                                                        | Get it on screen in two commands                |
| [🧪 Verification](#-how-it-was-tested)                                                       | The harness, the fixture, and the numbers       |
| [📌 Assumptions](#-assumptions)                                                              | Judgement calls worth stating                   |
| [📁 Layout](#-repository-layout)                                                             | What's the fix, what's scaffolding              |

---

## 🐛 The report

> "The dashboard 'Signups this week' number looks wrong — it seems to count old
> signups too. Also the tile sometimes crashes (white screen) when the API is slow
> to respond."

Both symptoms were real, and they turned out to be **independent of each other**.

- [x] **Defect 1** — tile crashed before data loaded
- [x] **Defect 2** — count included signups outside the last 7 days

---

## 🔍 Defect 1 — Uninitialised state caused a crash on first render

State was declared without an initial value:

```js
const [signups, setSignups] = useState();
```

`signups` was therefore `undefined` on the first render. The fetch lives inside
`useEffect`, which React runs **after** that render completes — so the first pass
evaluated `undefined.filter(...)` and threw.

<details>
<summary><b>🔬 Full failure chain</b> — click to expand</summary>

<br>

```
1. Component mounts
2. First render  →  signups === undefined
3. Line 30       →  undefined.filter(...)
                    ✗ TypeError: Cannot read properties of undefined (reading 'filter')
4. No error boundary above the component
5. React unmounts the tree  →  white screen
6. useEffect would have run here — too late, render already threw
```

**A correction to the report:** this crash was **deterministic, not
latency-dependent**. `useEffect` always runs after the first render, so the
component threw on _every_ load regardless of how fast the API responded. The
report attributed it to a slow API; response time was never the trigger.

</details>

### ✅ The fix

```diff
- const [signups, setSignups] = useState();
+ const [signups, setSignups] = useState([]);
```

An empty array is safe to `.filter`. The tile now renders `0` while loading and
updates when data arrives.

---

## 🔍 Defect 2 — The count compared calendar months, not a 7-day window

```js
return d.getMonth() === now.getMonth();
```

This counted every signup in the current **calendar month**, so a signup from 14
days ago was still reported as "this week."

<details>
<summary><b>🔬 The subtler half of this bug</b> — click to expand</summary>

<br>

`getMonth()` disregards the year entirely:

```js
new Date("2026-08-19").getMonth(); // 7
new Date("2025-08-19").getMonth(); // 7  ← same value, a year apart
```

So a signup from the same month a **full year earlier** was also counted as "this
week." The fixture includes exactly this case to prove the fix catches it.

</details>

### ✅ The fix

```diff
+ const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
+
  const lastWeekCount = signups.filter((s) => {
    const d = new Date(s.event_ts);
-   return d.getMonth() === now.getMonth();
+   return d >= sevenDaysAgo && d <= now;
  }).length;
```

The upper bound at `now` also prevents future-dated records from inflating the count.

---

## 🚀 Running it locally

```bash
npm install
npm run dev
```

Open **<http://localhost:5173>** — the tile renders `0`, then updates to the real
count once the mocked API responds.

| Command         | Purpose                                   |
| --------------- | ----------------------------------------- |
| `npm run dev`   | 🟢 Start the dev server with the mock API |
| `npm run lint`  | 🧹 ESLint — passes clean                  |
| `npm run build` | 📦 Production build                       |

---

## 🧪 How it was tested

The component calls `/api/events?event=signup`, which has no backend in this
sandbox. `vite.config.js` registers a dev-only middleware serving a fixture in the
same shape as the real endpoint.

Two properties make the fix **verifiable rather than merely plausible**:

|     | Property                                                              | Why it matters                                                           |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 🕐  | Timestamps generated **relative to the current date** at request time | The fixture cannot silently rot as the calendar moves                    |
| ⏳  | Response **delayed by 1.5 s**                                         | Holds the pre-data render open long enough to observe the crash directly |

### The fixture

Eight signups, chosen as boundary cases:

| Signup timestamp             |   Before    |    After    | Why it's in there                      |
| ---------------------------- | :---------: | :---------: | -------------------------------------- |
| 0, 1, 3, 6 days ago          | counted ✅  | counted ✅  | Inside the window — the true positives |
| 10 days ago                  | counted ❌  | excluded ✅ | Same month, outside 7 days             |
| 14 days ago                  | counted ❌  | excluded ✅ | Same month, outside 7 days             |
| 30 days ago                  | excluded ✅ | excluded ✅ | Previous month — correct in both       |
| Same date, **previous year** | counted ❌  | excluded ✅ | Exposes `getMonth()` ignoring the year |

<sub>✅ = correct behaviour &nbsp;·&nbsp; ❌ = the defect</sub>

<div align="center">

### 📈 Result

|                | Tile displayed |
| -------------- | :------------: |
| Before the fix |    **7** ❌    |
| After the fix  |    **4** ✅    |

_Matching a manual count of the records genuinely inside the window._

</div>

<details>
<summary><b>🔬 Additional checks</b> — click to expand</summary>

<br>

- A ninth record with `event: "login"` confirms the `?event=signup` query filter is
  actually applied — the endpoint correctly returns **8** rows, not 9.
- **Crash path, verified separately:** before the fix, the 1.5 s delay produced a
  blank screen and the `TypeError` in the browser console. After, the tile renders
  `0` and updates to `4` when the data lands.
- `npm run lint` passes clean.

</details>

---

## 📌 Assumptions

<details open>
<summary><b>Judgement calls worth stating</b></summary>

<br>

**1. "Last 7 days" is a rolling 168-hour window** ending at the current time,
rather than the last seven calendar dates. Both interpretations produce the same
result against this fixture, but the definition is genuinely ambiguous and the
choice is worth making explicit.

**2. Timestamps are parsed as local time.** `event_ts` arrives as
`"2026-08-10 14:05"` with no timezone marker, so `new Date()` interprets it in the
runtime's zone. This matches how the original code behaved; a production fix would
want an explicit timezone contract with the API.

</details>

---

## 📁 Repository layout

```
src/
  components/
    part_b_buggy_component (2).jsx   ← 🎯 the tile, containing the fix
  App.jsx                            ← minimal shell rendering the tile
  App.css                            ← tile styling
vite.config.js                       ← dev-only mock /api/events middleware
```

> [!NOTE]
> The behavioural change is **confined to the component**. `App.jsx`, `App.css` and
> the middleware in `vite.config.js` are test scaffolding that exists so the tile
> can be rendered and verified — they are not part of the fix.

An unused `React` default import was also removed from the component: Vite's
automatic JSX runtime makes it unnecessary, and it was failing `no-unused-vars`.
