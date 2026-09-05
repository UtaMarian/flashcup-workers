# SQLite → PostgreSQL (WSL / RedHat)

The app now targets **PostgreSQL**. `prisma/schema.prisma` uses
`provider = "postgresql"`. The old SQLite schema and migrations are frozen at
`prisma/schema.sqlite.prisma` and `prisma/migrations_sqlite_backup/` and are
used only for the one-time data copy.

---

## 1. On the WSL box (RedHat) — prepare PostgreSQL

```bash
# create role + database
sudo -u postgres psql <<'SQL'
CREATE ROLE flashcup WITH LOGIN PASSWORD 'CHANGE_ME' CREATEDB;
CREATE DATABASE flashcup OWNER flashcup;
SQL
```

`CREATEDB` lets `prisma migrate dev` build its temporary shadow database. If you
prefer not to grant it, create `flashcup_shadow` too and use
`SHADOW_DATABASE_URL` (see `.env` + uncomment `shadowDatabaseUrl` in
`schema.prisma`).

### Make it reachable from Windows

- `postgresql.conf`:  `listen_addresses = '*'`
- `pg_hba.conf` (add a line — dev-only, tighten for real deployments):
  `host  all  all  0.0.0.0/0  scram-sha-256`
- firewalld:  `sudo firewall-cmd --add-port=5432/tcp --permanent && sudo firewall-cmd --reload`
- restart:  `sudo systemctl restart postgresql`

### Connection host

Use **`localhost`** in `DATABASE_URL`: WSL2 forwards listening ports to Windows,
and the `172.23.x.x` WSL IP changes on every reboot. The IP is only a fallback
(there's a commented line for it in `.env`). For a stable IP, enable mirrored
networking in `C:\Users\<you>\.wslconfig` (`[wsl2]` → `networkingMode=mirrored`).

Verify from Windows PowerShell:
```
psql "postgresql://flashcup:CHANGE_ME@localhost:5432/flashcup"
```

---

## 2. In `flashleague-backend/.env`

```env
DATABASE_URL="postgresql://flashcup:CHANGE_ME@localhost:5432/flashcup?schema=public"
SQLITE_DATABASE_URL="file:./dev.db"
# SHADOW_DATABASE_URL="postgresql://flashcup:CHANGE_ME@localhost:5432/flashcup_shadow?schema=public"
```

---

## 3. Create the schema on Postgres

```bash
cd flashleague-backend
npx prisma migrate dev --name init      # fresh Postgres baseline in prisma/migrations/
```

(On a server / CI: `npx prisma migrate deploy`.)

---

## 4. Copy the data (skip if you'd rather start clean with `npm run seed`)

```bash
npm run db:sqlite-client        # prisma generate --schema prisma/schema.sqlite.prisma
npm run db:copy-from-sqlite     # node scripts/migrateSqliteToPostgres.js
```

The script copies every table in FK-safe order, preserving ids and timestamps,
then prints a `src -> dst` row-count check for each table.

> Do **not** also run `npm run seed` after copying — you'd get duplicate
> admin/teams.

---

## 5. Start

```bash
npm run dev
```

`GET /api/health` → `{"app":"Flash Cup API"}`, log in with an existing account.

---

## 6. Cleanup (after verifying)

```bash
rm prisma/schema.sqlite.prisma
rm -rf node_modules/sqlite-prisma-client
rm prisma/dev.db prisma/dev.db_old        # keep a backup copy elsewhere first
# prisma/migrations_sqlite_backup/ can stay as history or be deleted
```

Remove `SQLITE_DATABASE_URL` from `.env`, and the
`db:sqlite-client` / `db:copy-from-sqlite` scripts from `package.json`.

---

## Local dev after the switch

`prisma migrate dev` now needs a Postgres. Either point at the same WSL
instance, or run one in Docker:

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment: { POSTGRES_USER: flashcup, POSTGRES_PASSWORD: flashcup, POSTGRES_DB: flashcup }
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes: { pgdata: {} }
```
