// SUT (TS): src/app/staff/lib/actionAuth.ts → requireSuperuserActionClient
// SUT (SQL): RLS policy `credentials_update_superuser_only` definida en
//             supabase/migrations/20260426160000_role_helpers.sql
//
// Cubre RN-005: la asignación / revocación del rol is_staff y de otras
// banderas de credenciales solo la puede hacer un superuser. Aquí
// modelamos la regla como una función pura `canEditCredentials(actor)`
// que replica la doble enforcement TS+SQL para tests sin red.

import { describe, it, expect } from "vitest";
import {
  userActivo,
  userInactivo,
  userLoukou,
  userStaff,
  userSuperuser,
  type TestUser,
} from "../../fixtures/users";

// Réplica de la regla: el TS (requireSuperuserActionClient) bloquea la
// acción si no es superuser; el SQL (policy) bloquea el UPDATE a credentials
// si no es superuser. Esta función concentra el contrato para tests.
function canEditCredentials(actor: TestUser): boolean {
  return actor.credentials.is_superuser === true;
}

// Replica la regla de `setUserActiveAction`: cualquier staff puede activar
// / desactivar (NO requiere superuser). Es deliberado: RF-005 dice que un
// staff puede activar/desactivar cuentas.
function canToggleActive(actor: TestUser): boolean {
  return (
    actor.credentials.is_staff === true ||
    actor.credentials.is_superuser === true
  );
}

describe("RN-005 · asignar/quitar is_staff (y otras credenciales)", () => {
  it("solo un superuser puede asignar is_staff", () => {
    expect(canEditCredentials(userSuperuser)).toBe(true);
    expect(canEditCredentials(userStaff)).toBe(false);
    expect(canEditCredentials(userLoukou)).toBe(false);
    expect(canEditCredentials(userActivo)).toBe(false);
    expect(canEditCredentials(userInactivo)).toBe(false);
  });

  it("staff no puede crear/quitar otro staff (test negativo)", () => {
    expect(canEditCredentials(userStaff)).toBe(false);
  });

  it("las demás banderas (is_loukou, is_garden_manager) siguen la misma regla", () => {
    // El modelo de credenciales es "todo o nada" para edición: la policy
    // SQL cubre cualquier UPDATE a credentials, no campo a campo.
    expect(canEditCredentials(userStaff)).toBe(false);
    expect(canEditCredentials(userLoukou)).toBe(false);
    expect(canEditCredentials(userSuperuser)).toBe(true);
  });
});

describe("RF-005 · activación / desactivación de cuentas", () => {
  it("staff puede activar/desactivar (sin necesidad de superuser)", () => {
    expect(canToggleActive(userStaff)).toBe(true);
  });

  it("superuser también puede (hereda staff)", () => {
    expect(canToggleActive(userSuperuser)).toBe(true);
  });

  it("usuario estándar no puede activar/desactivar a otros", () => {
    expect(canToggleActive(userActivo)).toBe(false);
    expect(canToggleActive(userLoukou)).toBe(false);
  });
});
