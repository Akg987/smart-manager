export type PermissionRef = {
  module: string;
  action: string;
};

export type PermissionDefinition = PermissionRef & {
  description: string;
};

export const PERMISSION_PART_PATTERN = /^[a-z][a-z0-9_]*$/;

export function permissionCode(permission: PermissionRef): string {
  return `${permission.module}.${permission.action}`;
}

export function samePermission(
  left: PermissionRef,
  right: PermissionRef,
): boolean {
  return left.module === right.module && left.action === right.action;
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Keys are camelCase action names (`assignPermissions` -> `assign_permissions`),
 * values are human-readable descriptions.
 */
export function definePermissions<const T extends Record<string, string>>(
  module: string,
  actions: T,
): { readonly [K in keyof T]: PermissionDefinition } {
  const entries = Object.entries(actions).map(([key, description]) => [
    key,
    { module, action: toSnakeCase(key), description },
  ]);
  return Object.freeze(Object.fromEntries(entries)) as {
    readonly [K in keyof T]: PermissionDefinition;
  };
}

export type Permission = PermissionRef & {
  id: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WritePermissionInput = PermissionRef & {
  description?: string | null;
};
