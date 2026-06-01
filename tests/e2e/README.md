# Tests E2E (Capa 1)

Esta suite verifica el comportamiento **del lado de Postgres**: triggers,
constraints, RPCs y RLS. Para todo eso necesita una instancia REAL de
Postgres con las migraciones del repo aplicadas. La solución más cómoda es
la CLI de Supabase, que monta un Postgres + Auth + Storage en Docker
idénticos a producción.

Si Supabase local no está disponible, los tests se **skipean limpiamente**
con un aviso en stdout — no fallan, así puedes ejecutar `npm run test:e2e`
en cualquier entorno (incluido CI sin Docker).

---

## Setup (una sola vez)

1. **Docker Desktop** corriendo.
2. **Levantar Supabase local** (descarga imágenes la primera vez, tarda
   ~2 min):

   ```bash
   npx supabase start
   ```

3. Cuando termine, **anota las claves** que imprime:

   ```bash
   npx supabase status
   ```

   Verás algo como:

   ```
   API URL: http://127.0.0.1:54321
   anon key: eyJhbGciOi…
   service_role key: eyJhbGciOi…
   ```

4. **Crea `.env.test`** copiando la plantilla y pegando esas claves:

   ```bash
   cp .env.test.example .env.test
   # edita .env.test y rellena anon + service_role
   ```

`.env.test` está incluido en `.gitignore` por defecto (las claves del
Supabase local son inocuas pero conviene no commitearlas para evitar
confusiones con producción).

---

## Lanzar los tests

```bash
npm run test:e2e
```

Esperado en verde con Supabase up:

```
Test Files  4 passed (4)
Tests       16 passed (16)
```

Si Supabase está down, verás:

```
[e2e] Supabase local no disponible (...). Los tests E2E se skipean.
Test Files  4 passed (4)
Tests       16 skipped (16)
```

---

## Comandos útiles

| Comando | Para qué |
|---|---|
| `npx supabase start` | Levanta la instancia local. |
| `npx supabase stop` | Para los contenedores (libera CPU/RAM). |
| `npx supabase status` | Muestra URLs y claves. |
| `npx supabase db reset` | Borra TODO y reaplica migraciones + seed. Útil si los tests dejaron basura. |
| `npm run test:e2e` | Lanza la suite E2E. |
| `npm test` | Lanza la suite unit/integration (no requiere Docker). |

---

## Qué cubre cada fichero

| Fichero | Requisitos verificados |
|---|---|
| `requests.e2e.test.ts` | RN-003 (trigger activa credentials al aprobar), RN-004 (RPC `get_email_registration_status`). |
| `ownership.e2e.test.ts` | RN-010 (`trg_validate_single_current_owner`), RN-011 (gap G2 documentado). |
| `trades.e2e.test.ts` | RN-014 (CHECK), RF-018 (`trg_reset_acceptance`), RF-020 (`trg_complete_trade_on_mutual_acceptance`), `trg_unique_not_in_active_trade`, RN-016 (gap G3 documentado). |
| `accounts.e2e.test.ts` | RN-002 (login + flag is_active + preservación de datos al desactivar). |

---

## Cómo se aíslan los tests

Cada test crea sus propios recursos con un **sufijo único por sesión**
(`e2e-<random>-...`) y los limpia en `afterEach`:

1. Cromos creados se borran con `cromo.id IN (...)` → cascada elimina
   `unique_cromo` y `unique_ownership`.
2. Cromo_labels se borran al final.
3. Trades de los usuarios trackeados se borran (cascada → `trade_offer` y
   `trade_unique`).
4. Requests del usuario se borran.
5. Auth users se borran con `auth.admin.deleteUser` → cascada `profile` y
   `credentials`.

Si interrumpes los tests bruscamente (`Ctrl-C`) puede quedar basura. En ese
caso lanza `npx supabase db reset` y la BD queda como recién migrada.

---

## Notas para CI

Si quieres correr esto en GitHub Actions, hay una `supabase/setup-cli`
oficial y la propia CLI tiene flags para arrancar sin TTY. El flujo
mínimo:

```yaml
- uses: supabase/setup-cli@v1
- run: npx supabase start
- run: |
    npx supabase status -o env >> $GITHUB_ENV
    # renombrar las vars al formato SUPABASE_E2E_*
    echo "SUPABASE_E2E_URL=$API_URL" >> $GITHUB_ENV
    echo "SUPABASE_E2E_ANON_KEY=$ANON_KEY" >> $GITHUB_ENV
    echo "SUPABASE_E2E_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" >> $GITHUB_ENV
- run: npm run test:e2e
```

(No incluido en el repo: cada uno tiene su CI.)
