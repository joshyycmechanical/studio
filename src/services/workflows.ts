
'use server';

import { dbAdmin } from '@/lib/firebase/adminConfig';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { auth } from '@/lib/firebase/config';
import type { WorkOrder } from '@/types/work-order';
import type { Invoice, InvoiceLineItem } from '@/types/invoice';
import type { TimeEntry } from '@/types/time-entry';
import type { WorkflowStatusConfig, WorkflowTrigger, WorkflowActionType } from '@/types/workflow';
import { Timestamp } from 'firebase-admin/firestore';


// --- API Client Helper ---
async function handleApiResponse(response: Response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `An unknown API error occurred. Status: ${response.status}` }));
        throw new Error(errorData.message || 'API request failed.');
    }
    if (response.status === 204) return null;
    return response.json();
}

/**
 * Fetches all workflow statuses for the current user's company.
 */
export async function fetchWorkflowStatuses(): Promise<WorkflowStatusConfig[]> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/workflow-statuses', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    return handleApiResponse(response);
}

/**
 * Fetches all workflow triggers for the current user's company.
 */
export async function fetchWorkflowTriggers(): Promise<WorkflowTrigger[]> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/workflow-triggers', {
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
    return handleApiResponse(response);
}

/**
 * Creates a new workflow trigger.
 * @param data The data for the new trigger.
 * @returns The newly created trigger.
 */
export async function createWorkflowTrigger(data: Omit<WorkflowTrigger, 'id' | 'company_id' | 'created_at' | 'created_by'>): Promise<WorkflowTrigger> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch('/api/workflow-triggers', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}

/**
 * Updates an existing workflow trigger.
 * @param triggerId The ID of the trigger to update.
 * @param data The data to update.
 * @returns The updated trigger.
 */
export async function updateWorkflowTrigger(triggerId: string, data: Partial<Omit<WorkflowTrigger, 'id' | 'company_id' | 'created_at' | 'created_by'>>): Promise<WorkflowTrigger> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(`/api/workflow-triggers/${triggerId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    return handleApiResponse(response);
}

/**
 * Deletes a workflow trigger.
 * @param triggerId The ID of the trigger to delete.
 */
export async function deleteWorkflowTrigger(triggerId: string): Promise<void> {
    if (!auth) throw new Error("Authentication service is not initialized.");
    if (!auth.currentUser) throw new Error("User not authenticated.");
    const idToken = await auth.currentUser.getIdToken();
    await fetch(`/api/workflow-triggers/${triggerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
    });
}


/**
 * Processes all relevant workflow triggers for a given work order event.
 * @param workOrderId The ID of the work order that changed.
 * @param companyId The ID of the company this work order belongs to.
 * @param newStatus The new status the work order has entered.
 * @param eventType The type of event that occurred (e.g., 'on_enter').
 */
export async function processWorkflowTriggers(workOrderId: string, companyId: string, newStatus: string, eventType: 'on_enter' | 'on_exit') {
    console.log(`[Workflow] Processing triggers for WO #${workOrderId}, Status: ${newStatus}, Event: ${eventType}`);
    
    if (!dbAdmin) {
        console.error('[Workflow] Firestore Admin SDK is not initialized. Cannot process triggers.');
        return;
    }

    const triggersSnapshot = await dbAdmin.collection(COLLECTIONS.WORKFLOW_TRIGGERS)
        .where('company_id', '==', companyId)
        .where('workflow_status_name', '==', newStatus)
        .where('trigger_event', '==', eventType)
        .get();

    if (triggersSnapshot.empty) {
        console.log(`[Workflow] No triggers found.`);
        return;
    }

    const workOrderSnap = await dbAdmin.collection(COLLECTIONS.WORK_ORDERS).doc(workOrderId).get();
    if (!workOrderSnap.exists) {
        console.error(`[Workflow] Work Order ${workOrderId} not found.`);
        return;
    }
    const workOrder = workOrderSnap.data() as WorkOrder;

    for (const doc of triggersSnapshot.docs) {
        const trigger = doc.data() as WorkflowTrigger;
        // Basic check for conditions; in a real app, this would be a more complex evaluation engine.
        if (trigger.conditions && trigger.conditions.length > 0) {
            console.log(`[Workflow] Condition evaluation is not fully implemented. Skipping conditional trigger: ${trigger.name}`);
            continue;
        }
        console.log(`[Workflow] Executing action: ${trigger.action.type}`);
        await executeAction(trigger.action, workOrder, companyId);
    }
}

/**
 * Executes a single workflow action.
 * @param action The workflow action to perform.
 * @param workOrder The related work order document.
 * @param companyId The company ID.
 */
async function executeAction(action: { type: WorkflowActionType; params: any }, workOrder: WorkOrder, companyId: string) {
    switch (action.type) {
        case 'create_invoice_draft':
            await createInvoiceFromWorkOrder(workOrder, companyId, action.params);
            break;
        case 'notify_customer':
            await createCustomerNotification(workOrder, companyId, action.params);
            break;
        // Other cases will go here...
        default:
            console.warn(`[Workflow] Unhandled action type: ${action.type}`);
    }
}

/**
 * Action implementation for creating a draft invoice from a work order.
 */
async function createInvoiceFromWorkOrder(workOrder: WorkOrder, companyId: string, params: any) {
    if (!dbAdmin) return;
    console.log(`[Workflow Action] Creating draft invoice for WO #${workOrder.work_order_number}`);

    // 1. Fetch related time entries to build line items
    const timeEntriesSnap = await dbAdmin.collection(COLLECTIONS.TIME_ENTRIES)
        .where('work_order_id', '==', workOrder.id)
        .get();
        
    const lineItems: InvoiceLineItem[] = timeEntriesSnap.docs.map((doc, index) => {
        const entry = doc.data() as TimeEntry;
        return {
            id: `time_${index}`,
            description: `Technician Labor: ${entry.notes || 'General Labor'}`,
            quantity: parseFloat(entry.duration_hours.toFixed(2)),
            unit_price: 50, // TODO: Replace with actual user pay rate or a standard billable rate
            item_type: 'labor',
        };
    });

    const subtotal = lineItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    const totalAmount = subtotal; // Assuming no tax/discounts for now

    const newInvoiceData = {
        company_id: companyId,
        customer_id: workOrder.customer_id,
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        status: 'draft' as const,
        issue_date: Timestamp.now(),
        due_date: Timestamp.fromDate(new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)), // Due in 30 days
        line_items: lineItems,
        subtotal: subtotal,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: totalAmount,
        amount_paid: 0,
        amount_due: totalAmount,
        related_work_order_ids: [workOrder.id],
        created_at: Timestamp.now(),
        created_by: 'system_workflow',
    };

    await dbAdmin.collection(COLLECTIONS.INVOICES).add(newInvoiceData);
    console.log(`[Workflow Action] Successfully created draft invoice for WO #${workOrder.work_order_number}`);
}

/**
 * Action implementation for creating a customer notification.
 */
async function createCustomerNotification(workOrder: WorkOrder, companyId: string, params: any) {
    if (!dbAdmin) return;
    const message = params.message || `Your work order #${workOrder.work_order_number} has been updated to '${workOrder.status}'.`;
    console.log(`[Workflow Action] Creating notification for customer ${workOrder.customer_id}: \"${message}\"`);

    await dbAdmin.collection(COLLECTIONS.NOTIFICATIONS).add({
        company_id: companyId,
        customer_id: workOrder.customer_id,
        user_id: null, // It's for the customer, not an internal user
        type: 'work_order_status_update',
        message: message,
        is_read: false,
        created_at: Timestamp.now(),
        related_entity: {
            type: 'work_order',
            id: workOrder.id,
        }
    });
}

    