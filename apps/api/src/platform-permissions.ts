export const platformPermissions = [
  'users.read', 'users.manage', 'billing.manage', 'support.read', 'support.write',
  'audit.read', 'operations.read', 'operations.manage', 'content.manage',
] as const;
export type PlatformPermission = typeof platformPermissions[number] | 'roles.manage';
export type PlatformIdentity = { platformAdmin?: boolean; platformRole?: { publicId: string; name: string; permissions: string[] } | null; platformPermissions?: readonly string[] };

export function permissionsFor(user: PlatformIdentity): PlatformPermission[] {
  if (user.platformAdmin) return [...platformPermissions, 'roles.manage'];
  return platformPermissions.filter(permission => (user.platformRole?.permissions ?? user.platformPermissions ?? []).includes(permission));
}
export function hasPlatformPermission(user: PlatformIdentity, permission: PlatformPermission): boolean {
  return permissionsFor(user).includes(permission);
}
export function platformStaff(user: PlatformIdentity): boolean {
  return Boolean(user.platformAdmin || user.platformRole || permissionsFor(user).length);
}
