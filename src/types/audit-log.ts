import type { Timestamp } from 'firebase/firestore';

/**
 * Represents the type of action performed for auditing purposes.
 */
export type AuditLogAction =
  // CRUD actions
  | 'create'
  | 'read' // Might be too noisy, use sparingly or configure logging level
  | 'update'
  | 'delete'
  // Auth actions
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'signup'
  | 'invite_sent'
  | 'invite_accepted'
  // Permission/Role actions
  | 'role_assigned'
  | 'role_revoked'
  | 'role_created'
  | 'role_updated'
  | 'role_deleted'
  | 'permissions_updated'
  // Workflow/Status actions
  | 'status_change'
  | 'automation_triggered'
  | 'approval'
  | 'rejection'
  // Billing/Subscription actions
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_success'
  | 'payment_failure'
  // Other specific actions
  | 'file_upload'
  | 'file_delete'
  | 'export'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'security_event'; // Generic security-related event

/**
 * Represents an audit log document in the 'audit_logs' Firestore collection.
 * Consider partitioning this collection (e.g., by month/year or company) if volume is high.
 */
export interface AuditLog {
  id: string; // Firestore document ID
  timestamp: Timestamp; // Firestore Timestamp - When the event occurred
  company_id: string | null; // Null for platform-level actions, company ID otherwise
  user_id: string | null; // User who performed the action (null for system actions)
  user_email?: string; // Denormalized user email for easier display
  action: AuditLogAction; // The type of action performed
  entity_type?: string | null; // Optional: Type of entity affected (e.g., 'work-order', 'user', 'company')
  entity_id?: string | null; // Optional: ID of the specific entity affected
  details?: { // Flexible object for storing action-specific details
    ip_address?: string;
    user_agent?: string;
    previous_value?: any; // Value before the change (for updates)
    new_value?: any; // Value after the change (for updates/creates)
    target_user_id?: string; // For actions affecting another user
    target_role_id?: string; // For role assignment actions
    error_message?: string; // For failed actions
    [key: string]: any; // Allow other arbitrary details
  } | null;
}
