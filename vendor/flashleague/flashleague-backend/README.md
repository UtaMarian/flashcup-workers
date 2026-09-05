# Flash Cup — Backend API

Node.js / Express / Prisma backend for the Flash Cup football manager
simulator (matches the React interfaces built earlier).

## Stack

- **Express** — HTTP API
- **Prisma ORM** + **SQLite** (file-based, zero setup — swap the datasource
  in `prisma/schema.prisma` for PostgreSQL/MySQL in production)
- **JWT** auth (`jsonwebtoken`) + **bcrypt** password hashing
- **Background cron jobs** (match auto-simulation, energy regen, manager
  polls, events) now live in a separate repo —
  [`flashcup-workers`](https://github.com/UtaMarian/flashcup-workers) — which
  reuses this backend's services via a git submodule. This API process runs
  no cron of its own.

## Setup

```bash
cd flashleague-backend
npm install
cp .env.example .env          # edit JWT_SECRET etc. if you like
npx prisma migrate dev --name init   # creates dev.db + tables
npm run seed                  # creates the admin account + Liga 1 + 4 starter teams
npm run dev                   # starts the API on http://localhost:4000
```

The seed script creates the required administrator account, using the
`ADMIN_EMAIL`/`ADMIN_PASSWORD` values from your `.env` (set them there —
never commit real values).

## Architecture notes

### Exponential leveling (`src/utils/xp.js`)

`xpToReachNextLevel(level) = BASE * level ^ EXPONENT` with `BASE=8`,
`EXPONENT=2.1`. Cumulative cost:

| Level | ~Total XP | ~Training sessions (80xp each) |
|---|---|---|
| 10  | ~2,800     | ~35 (a day or two) |
| 50  | ~460,000   | ~5,800 (weeks) |
| 100 | ~4,000,000 | ~50,000 (long-term grind) |

Every XP-granting action (training, match appearances, goals, assists)
recomputes level from *total lifetime XP* via `levelFromTotalXp()`, so the
curve is the single source of truth — no separate level-up bookkeeping.

### On-field positions

`GK, DC, LB, RB, DMC, MC, ML, MR, AMC, AML, AMR, ST, LW, RW` — chosen at
registration (`POST /api/auth/register`), stored on `User.position`.

### Player detail tracked (`User` model)

`registeredAt`, `lastLoginAt`, `totalGoals`, `totalAssists`, `totalMatches`,
`level`, `xp`, `energy`, five trainable attributes, current `team`, plus a
full **`TeamHistory`** table recording every team the player has ever
belonged to (`JOINED` / `RESIGNED` / `KICKED` / `TRANSFERRED`, with
`joinedAt`/`leftAt` timestamps).

### Competitions

Only `LIGA` (league/championship) competitions are usable end-to-end right
now, per spec — cup types (`CUPA_INTERNA`, `CUPA_CAMPIONILOR`,
`CUPA_INTERNATIONALA`) exist in the schema/enum so the admin can create them
later, but fixture auto-generation currently targets leagues.

**Flow:**
1. Admin creates a league — `POST /api/leagues` (this is how "Liga 1", the
   first league, gets created — nothing is hardcoded beyond the seed demo
   data).
2. Admin creates teams and assigns them to that league —
   `POST /api/teams`, `PATCH /api/teams/:id/league`.
3. Admin tunes the parameters needed before kickoff —
   `PATCH /api/leagues/:id/settings`: `startDate`,
   `matchDayStartHour`/`matchDayEndHour` (default 16–22), `daysBetweenRounds`
   (default `1` → daily etapas, as required), qualification slot counts for
   the two cups, single/double round-robin.
4. Admin starts the league — `POST /api/leagues/:id/start`. This:
   - generates the full round-robin fixture list (circle method,
     `src/utils/fixtures.js`),
   - assigns each round/etapa to its own calendar day starting from
     `startDate`,
   - auto-generates kickoff times for every match that day, evenly spread
     across the 16:00–22:00 window (`src/utils/matchTimes.js`),
   - flips the league to `ACTIVE`.
5. From then on, the **match-scheduler cron job** (in the
   [`flashcup-workers`](https://github.com/UtaMarian/flashcup-workers) repo,
   running every minute) automatically simulates any `SCHEDULED` match whose
   kickoff time has passed — no manual action needed. It calls
   `simulateDueMatches()` from `src/services/matchService.js`.
   `POST /api/matches/:id/simulate` exists for an admin to force one early
   (e.g. for a demo).

### Match simulation (`src/utils/matchSim.js` + `src/services/matchService.js`)

Team strength = average `level` of active squad players. Expected goals are
biased by the strength differential, then drawn with randomness. Goal/assist
events are attributed to weighted-random players by position (strikers/
wingers score more, midfielders assist more). On simulation: match result +
events are persisted, and every involved player's `totalMatches`,
`totalGoals`, `totalAssists`, `xp`/`level`, and `energy` are updated in one
transaction.

## API reference

All request/response bodies are JSON. Authenticated routes expect
`Authorization: Bearer <token>`.

### Auth
| Method & path | Access | Notes |
|---|---|---|
| `POST /api/auth/register` | public | `{email, password, firstName, lastName, teamId, position}` — team **and** position are both mandatory |
| `POST /api/auth/login` | public | `{email, password}` |
| `GET /api/auth/me` | authenticated | current user + derived level/xp progression |

### Users (admin)
| Method & path | Access | Notes |
|---|---|---|
| `GET /api/users?search=&role=&status=` | admin | search by name/email |
| `PATCH /api/users/:id/role` | admin | `{role: "PLAYER"\|"MANAGER"\|"ADMIN"}` |
| `PATCH /api/users/:id/ban` | admin | `{ban: true\|false, reason?}` |

### Teams
| Method & path | Access | Notes |
|---|---|---|
| `GET /api/teams` | public | list, with league + squad count |
| `GET /api/teams/:id` | public | includes full squad |
| `POST /api/teams` | admin | `{name, city?, colorHex?, logoUrl?, leagueId?}` |
| `PATCH /api/teams/:id/league` | admin | `{leagueId}` — assign/reassign to a league |
| `GET /api/teams/:id/posts` | authenticated | club news feed |
| `POST /api/teams/:id/posts` | authenticated (own team) | `{text}` |

### Leagues
| Method & path | Access | Notes |
|---|---|---|
| `GET /api/leagues` | public | |
| `POST /api/leagues` | admin | create a league (first one = "Liga 1", or any cup) |
| `PATCH /api/leagues/:id/settings` | admin | only while `status = DRAFT` |
| `POST /api/leagues/:id/start` | admin | generates fixtures + kickoff times, sets `ACTIVE` |
| `GET /api/leagues/:id/standings` | public | computed live from played matches |
| `GET /api/leagues/:id/matches?status=PLAYED\|SCHEDULED` | public | full fixture list |

### Matches
| Method & path | Access | Notes |
|---|---|---|
| `GET /api/matches/:id` | public | includes goal/assist events |
| `POST /api/matches/:id/simulate` | admin | manual/early trigger |

### Players (self-service)
| Method & path | Access | Notes |
|---|---|---|
| `GET /api/players/me` | authenticated | |
| `PATCH /api/players/me` | authenticated | `{firstName?, lastName?}` |
| `PATCH /api/players/me/password` | authenticated | `{currentPassword, newPassword}` |
| `POST /api/players/me/train` | authenticated | `{attribute: "viteza"\|"tehnica"\|"fizic"\|"aparare"\|"atac"}` — costs 10 energy, grants XP |
| `POST /api/players/me/resign` | authenticated | leaves current team, logs `TeamHistory` |

### Manager
| Method & path | Access | Notes |
|---|---|---|
| `POST /api/manager/kick/:userId` | manager (own team) or admin | removes a player from the manager's team, logs `TeamHistory` |

## Project layout

```
flashleague-backend/
  prisma/
    schema.prisma       # all data models
    seed.js              # admin account + starter league/teams
  src/
    config/db.js          # Prisma client singleton
    controllers/           # one file per resource
    middleware/            # auth, role guard, error handler
    routes/                 # Express routers, mirrors controllers
    services/matchService.js  # simulate + persist a match (shared by the workers repo & manual trigger)
    utils/                 # xp curve, round-robin, kickoff times, sim engine, password, jwt
    app.js
    server.js
```

Background cron jobs are in the separate
[`flashcup-workers`](https://github.com/UtaMarian/flashcup-workers) repo.
