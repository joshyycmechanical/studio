
// src/services/seeding.ts
import { Timestamp, FieldValue } from 'firebase-admin/firestore'; 
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Role, ModulePermissions } from '@/types/role';
import type { WorkflowStatusConfig } from '@/types/workflow';
import {
    allPlatformModules,
    DEFAULT_COMPANY_ROLES_DATA,
    DEFAULT_WORKFLOW_STATUSES_DATA,
    DEFAULT_INSTALLED_MODULE_SLUGS_DATA,
    initialRoleTemplates
} from '@/lib/roles-data';
import type admin from 'firebase-admin';
import { authAdmin } from '@/lib/firebase/adminConfig'; 
import type { UserProfile } from '@/types/user';

export async function seedNewCompany(
    db: admin.firestore.Firestore,
    companyId: string | null, 
    adminUserId: string
): Promise<void> {
    const contextDescription = companyId === null ? `PLATFORM OWNER (User: ${adminUserId})` : `Company: ${companyId}, Admin: ${adminUserId}`;
    console.log(`[Seeding Service] Starting seeding for ${contextDescription}`);
    const batch = db.batch();

    try {
        if (companyId === null) { 
            console.log(`[Seeding Service - Platform Owner] Preparing records for User: ${adminUserId}`);
            const platformOwnerRoleId = 'platform-owner';
            const rolesCollectionRef = db.collection(COLLECTIONS.ROLES);

            const platformOwnerRoleDocRef = rolesCollectionRef.doc(platformOwnerRoleId);
            const platformOwnerRoleTemplate = initialRoleTemplates.find(role => role.id === platformOwnerRoleId);

            if (!platformOwnerRoleTemplate) {
                throw new Error(`Setup error: Platform owner role template ('${platformOwnerRoleId}') not found.`);
            }
            
            const { id: templateId, ...templateData } = platformOwnerRoleTemplate;
            const roleDataToSave: Omit<Role, 'id' | 'created_at'> & { created_at: admin.firestore.FieldValue, company_id: string | null } = {
                ...templateData,
                company_id: null,
                is_template: false, 
                created_at: FieldValue.serverTimestamp(),
            };
            batch.set(platformOwnerRoleDocRef, roleDataToSave, { merge: true });
            console.log(` -> Queued Platform Owner role document create/merge (ID: ${platformOwnerRoleId})`);

            let platformOwnerEmail: string;
            try {
                const authUserRecord = await authAdmin.getUser(adminUserId);
                if (!authUserRecord.email) {
                    const authErrorMsg = `Email not found in Firebase Auth record for UID ${adminUserId}. Cannot proceed with profile creation.`;
                    console.error(`[Seeding Service - Platform Owner] ${authErrorMsg}`);
                    throw new Error(authErrorMsg);
                }
                platformOwnerEmail = authUserRecord.email;
                console.log(` -> Retrieved email "${platformOwnerEmail}" for UID ${adminUserId} from Firebase Auth.`);
            } catch (error: any) {
                const authErrorMsg = `CRITICAL: Could not retrieve user record for UID ${adminUserId} from Firebase Auth. Error: ${error.message}`;
                console.error(`[Seeding Service - Platform Owner] ${authErrorMsg}`, error);
                throw new Error(authErrorMsg);
            }

            const userRef = db.collection(COLLECTIONS.USERS).doc(adminUserId);
            const userProfileData: Omit<UserProfile, 'id' | 'created_at' | 'last_login'> & { created_at: admin.firestore.FieldValue, last_login: null } = {
                email: platformOwnerEmail,
                company_id: null,
                status: 'active',
                full_name: "Platform Owner", // Default name
                phone: null,
                created_at: FieldValue.serverTimestamp(),
                last_login: null,
                profile_photo_url: null,
                pay_rate_hourly: null,
                overtime_threshold_hours: 40,
                invited_by: null, 
            };

            batch.set(userRef, userProfileData);
            console.log(` -> Queued Platform Owner user profile create (UID: ${adminUserId}) with email: ${platformOwnerEmail}`);

            const userRoleLinkRef = db.collection(COLLECTIONS.USER_ROLES).doc();
            batch.set(userRoleLinkRef, {
                user_id: adminUserId,
                role_id: platformOwnerRoleId,
                company_id: null,
            });
            console.log(` -> Queued Platform Owner role assignment (User: ${adminUserId} to Role: ${platformOwnerRoleId})`);

        } else {
            console.log(`[Seeding Service - Company Admin] Seeding company ${companyId} with admin ${adminUserId}`);
            
            let companyAdminRoleId: string | null = null;
            const rolesCollection = db.collection(COLLECTIONS.ROLES);
            DEFAULT_COMPANY_ROLES_DATA.forEach(roleData => {
                const roleRef = rolesCollection.doc();
                batch.set(roleRef, {
                    ...roleData,
                    company_id: companyId,
                    is_template: false,
                });
                if (roleData.name === 'Administrator') {
                    companyAdminRoleId = roleRef.id;
                }
                console.log(` -> Queued role creation: ${roleData.name} (ID: ${roleRef.id}) for company ${companyId}`);
            });

            if (!companyAdminRoleId) {
                const adminRoleErrorMsg = `CRITICAL: Default 'Administrator' role ID not captured for new company ${companyId}.`;
                console.error(`[Seeding Service] ${adminRoleErrorMsg}`);
                throw new Error(adminRoleErrorMsg);
            }
            
            const userRolesCollection = db.collection(COLLECTIONS.USER_ROLES);
            const adminRoleLinkRef = userRolesCollection.doc();
            batch.set(adminRoleLinkRef, {
                user_id: adminUserId,
                role_id: companyAdminRoleId,
                company_id: companyId,
            });
            console.log(` -> Queued admin role assignment: User ${adminUserId} to Role ${companyAdminRoleId} in company ${companyId}`);

            const statusesCollection = db.collection(COLLECTIONS.WORKFLOW_STATUSES);
            DEFAULT_WORKFLOW_STATUSES_DATA.forEach(statusData => {
                const statusRef = statusesCollection.doc();
                batch.set(statusRef, {
                    ...statusData,
                    company_id: companyId,
                });
            });
            console.log(` -> Queued ${DEFAULT_WORKFLOW_STATUSES_DATA.length} workflow statuses.`);

            const modulesCollection = db.collection(COLLECTIONS.COMPANY_MODULES);
            DEFAULT_INSTALLED_MODULE_SLUGS_DATA.forEach(slug => {
                const moduleDef = allPlatformModules.find(m => m.slug === slug);
                if (moduleDef && !moduleDef.is_internal && moduleDef.group !== 'platform_admin') {
                    const moduleInstallRef = modulesCollection.doc();
                    batch.set(moduleInstallRef, {
                        company_id: companyId,
                        module_slug: slug,
                        installed_at: FieldValue.serverTimestamp(),
                    });
                } else {
                    console.warn(`[Seeding Service] Skipping unknown or non-installable module slug during company seed: ${slug}`);
                }
            });
             console.log(` -> Queued ${DEFAULT_INSTALLED_MODULE_SLUGS_DATA.length} module installations.`);

            const companyDocRef = db.collection(COLLECTIONS.COMPANIES).doc(companyId);
            batch.update(companyDocRef, {
                settings_initialized: true,
                updated_at: FieldValue.serverTimestamp(),
            });
            console.log(" -> Queued company settings_initialized update.");
        }

        await batch.commit();
        console.log(`[Seeding Service] Successfully committed seed data for ${contextDescription}.`);

    } catch (error: any) {
        console.error(`[Seeding Service] Firestore batch.commit() FAILED for ${contextDescription}:`, error);
        if (error.details) console.error(`[Seeding Service] Firestore Error Details:`, error.details);
        if (error.code) console.error(`[Seeding Service] Firestore Error Code:`, error.code);
        throw new Error(`Seeding Failed for ${contextDescription}: ${error.message}`);
    }
}
