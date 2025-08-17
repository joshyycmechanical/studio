
import type { Module } from '@/types/module';
import { allPlatformModules } from './roles-data';

/**
 * Defines the default set of modules that are installed for any new company.
 * This filters out internal and platform-admin specific modules.
 */
export const defaultCompanyModules: Module[] = allPlatformModules.filter(m =>
    !m.is_internal && m.group !== 'platform_admin'
);
