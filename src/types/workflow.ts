
import type { Timestamp } from 'firebase/firestore';

export type WorkflowStatusGroup = 'start' | 'active' | 'final' | 'cancelled';

export interface WorkflowStatusConfig {
  id: string;
  company_id: string;
  name: string;
  color: string;
  description?: string | null;
  group: WorkflowStatusGroup;
  is_final_step: boolean;
  sort_order: number;
  trigger_count?: number;
}

export type WorkflowTriggerEvent = 'on_enter' | 'on_exit';

export interface WorkflowTrigger {
  id: string;
  company_id: string;
  name: string;
  workflow_status_name: string;
  trigger_event: WorkflowTriggerEvent;
  action: {
    type: WorkflowActionType;
    params: { [key: string]: any };
  };
  created_at: Timestamp;
  created_by: string;
  updated_at?: Timestamp | null;
}

export interface WorkflowCondition {
  id: string;
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
  value: any;
}

export type WorkflowActionType =
  | 'notify_user'
  | 'notify_customer'
  | 'send_email'
  | 'send_sms'
  | 'auto_assign_technician'
  | 'update_field'
  | 'add_checklist'
  | 'create_follow_up_wo'
  | 'create_invoice_draft'
  | 'webhook';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  params: { [key: string]: any };
}
