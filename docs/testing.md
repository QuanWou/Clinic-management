# Testing and smoke checks

Run commands from the repository root unless a directory change is shown. The smoke script is read-only and does not create accounts or modify clinical data.

## Backend (Java 21 and Maven)

```powershell
cd backend
mvn test
```

Runs all Maven modules, including service-unit, controller/security, and Gateway CORS regression tests. For a faster check after a gateway change:

```powershell
cd backend
mvn -pl api-gateway -am test
```

The two Gateway CORS tests exercise an actual embedded HTTP server with OPTIONS preflights to both `/api/users/me` (proxied route) and `/api/dashboard/me` (local controller). The browser origin used is `http://localhost:5173`.

## Frontend (Node 22 / npm)

```powershell
cd frontend
npm test
npm run build
```

`npm test` uses Node's built-in test runner and the existing Vite bundler to test the real TypeScript API/auth/role modules without a backend or new test dependencies. Fetch and localStorage are mocked. Coverage includes bearer tokens, unauthenticated login, server error handling, invalid response handling, token lifecycle, endpoint paths, and role normalization. The build checks TypeScript and production bundling. These are unit tests, not browser E2E tests.

## Runtime smoke test

```powershell
# Requires Docker Desktop's engine to be running.
docker compose config --quiet
docker compose up --build -d

# In another terminal:
cd frontend
npm run dev

# In a third terminal, from repository root:
.\scripts\smoke.ps1
```

Default smoke URLs: frontend `http://localhost:5173`, gateway `http://localhost:8090`. The script checks frontend HTML, JavaScript assets, gateway `/actuator/health`, and browser CORS preflight on routed and controller endpoints. It fails with the URL of the first unavailable/invalid response. It does not perform appointment booking or other database-mutating E2E flows.

For the frontend-only production preview:

```powershell
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# In a separate terminal at the repository root:
.\scripts\smoke.ps1 -FrontendUrl http://127.0.0.1:4173 -FrontendOnly
```

**Verification on September 16, 2026:** `mvn test`: 53 tests passed; `npm test`: 7 tests passed; `npm run build`: passed; `docker compose config --quiet`: passed; frontend preview smoke: passed. Full Docker startup and database-backed browser E2E were not verified because the Docker Desktop Linux engine was unavailable at that time.

## Runtime verification on September 20, 2026

- Full Docker Compose build and detached startup succeeded; PostgreSQL and RabbitMQ are healthy, and all eight Spring Boot processes (seven services plus Gateway) return `HTTP 200` with actuator `status=UP`.
- PostgreSQL `clinic_db` accepts connections; all seven service schemas exist, and all applied Flyway migrations report success. Identity reached V3; Doctor and Appointment reached V2, including the `appointments_doctor_slot_no_overlap` exclusion constraint.
- `mvn test`: 53 tests in 15 reports, zero failures/errors/skips. `npm test`: 7 passed. `npm run build`: passed. Vite dev root and entry point returned HTTP 200.
- Full `scripts/smoke.ps1` passed with frontend `http://127.0.0.1:5173`: frontend HTTP, Gateway actuator, and the two CORS preflights. Fixed smoke's previous false negatives: Vite dev uses a `.tsx` entry rather than a `.js` bundle, and PowerShell returned a binary body for the actuator media type.
- Prometheus health and Mailpit API returned HTTP 200. Grafana was running on host port 3001; its `/api/health` endpoint returned HTTP 401 without authentication, so it was not counted as a successful authenticated Grafana health check.
- Remaining E2E limitation: the database contains **zero doctors and zero doctor schedules**, so appointment booking cannot be validated with an existing doctor. The attempted isolated registration/profile/login/logout command with cleanup was blocked by tool safety checks before execution. Do not classify those flows as passing. No synthetic accounts or doctor fixtures were inserted by this run.
- Anonymous GETs to `/api/users/me`, `/api/patients/profile`, `/api/doctors`, `/api/specialties`, and `/api/appointments/my` returned HTTP 403. The documented generic unauthenticated error is HTTP 401; review the API/security contract and intended public catalog access before treating this as expected behavior.

The running Docker stack is left in place for inspection. No Git reset, restore, stash, clean, stage, commit, or push was performed, because other tasks share this dirty checkout.
