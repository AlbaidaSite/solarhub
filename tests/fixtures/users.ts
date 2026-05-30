// Fixtures de usuarios y credenciales tipo. Se importan desde tests unit e
// integración. Aquí se centraliza el contrato semántico (qué significa "ser
// staff", "tener cuenta activa", etc.) para que cada test no lo redefina.

export interface CredentialsFlags {
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_loukou: boolean;
  is_garden_manager: boolean;
}

export interface TestUser {
  id: string;
  username: string;
  email: string;
  credentials: CredentialsFlags;
}

const baseFlags: CredentialsFlags = {
  is_active: true,
  is_staff: false,
  is_superuser: false,
  is_loukou: false,
  is_garden_manager: false,
};

export const userActivo: TestUser = {
  id: "u-active",
  username: "alice",
  email: "alice@example.com",
  credentials: { ...baseFlags },
};

export const userInactivo: TestUser = {
  id: "u-inactive",
  username: "bob_inactive",
  email: "bob@example.com",
  credentials: { ...baseFlags, is_active: false },
};

export const userLoukou: TestUser = {
  id: "u-loukou",
  username: "lou",
  email: "lou@example.com",
  credentials: { ...baseFlags, is_loukou: true },
};

export const userStaff: TestUser = {
  id: "u-staff",
  username: "moderator",
  email: "mod@example.com",
  credentials: { ...baseFlags, is_staff: true },
};

export const userSuperuser: TestUser = {
  id: "u-superuser",
  username: "root",
  email: "root@example.com",
  credentials: { ...baseFlags, is_staff: true, is_superuser: true },
};
