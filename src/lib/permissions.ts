
import type { UserProfile } from '@/types/user';
import type { ModulePermissions } from '@/types/role';

/**
 * Checks if the current user has a specific permission for a given module.
 * This is the primary permission-checking function for the client-side.
 * @param user The user profile object, containing roles and permissions.
 * @param moduleSlug The slug of the module to check against (e.g., "work-orders").
 * @param action The specific action to check (e.g., "create", "edit", "delete").
 * @returns True if the user has the permission, false otherwise.
 */
export function hasPermission(
  user: UserProfile | null | undefined,
  moduleSlug: string,
  action: keyof Omit<ModulePermissions, 'can_access'>
): boolean {
  if (!user || !user.permissions) {
    return false;
  }

  // The 'manage' permission for a module grants all other permissions for it.
  const modulePerms = user.permissions[moduleSlug];
  if (modulePerms?.manage === true) {
    return true;
  }

  // Check for the specific action permission.
  return modulePerms?.[action] === true;
}

/**
 * Checks if the user can access a given module at all.
 * @param user The user profile object.
 * @param moduleSlug The slug of the module.
 * @returns True if the user has 'can_access' permission for the module.
 */
export function canAccessModule(
    user: UserProfile | null | undefined,
    moduleSlug: string,
): boolean {
    if (!user || !user.permissions) {
        return false;
    }
    // A user can access a module if they have any permission for it,
    // which is implicitly true if the module key exists in their permissions map.
    return !!user.permissions[moduleSlug];
}
