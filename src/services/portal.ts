
'use client';

// This service file centralizes data fetching for the customer portal.
// It re-uses the primary service functions but ensures filtering by customerId.

import {
    fetchCompanyWorkOrders as fetchAllWorkOrders,
    fetchCompanyLocations as fetchAllLocations,
    fetchCompanyEquipment as fetchAllEquipment,
    fetchCompanyInvoices as fetchAllInvoices,
} from './workOrders'; // workOrders service exports all needed functions

import type { WorkOrder } from '@/types/work-order';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import type { Invoice } from '@/types/invoice';


/**
 * Fetches work orders for a specific customer within a company.
 * @param companyId The ID of the company.
 * @param customerId The ID of the customer.
 * @returns A promise that resolves to an array of WorkOrder objects.
 */
export async function fetchCompanyWorkOrders(companyId: string, customerId: string): Promise<WorkOrder[]> {
    if (!companyId || !customerId) return [];
    const allWorkOrders = await fetchAllWorkOrders(companyId);
    return allWorkOrders.filter(wo => wo.customer_id === customerId);
}

/**
 * Fetches locations for a specific customer within a company.
 * @param companyId The ID of the company.
 * @param customerId The ID of the customer.
 * @returns A promise that resolves to an array of Location objects.
 */
export async function fetchCompanyLocations(companyId: string, customerId: string): Promise<Location[]> {
    if (!companyId || !customerId) return [];
    const allLocations = await fetchAllLocations(companyId);
    return allLocations.filter(loc => loc.customer_id === customerId);
}

/**
 * Fetches equipment for a specific customer within a company.
 * @param companyId The ID of the company.
 * @param customerId The ID of the customer.
 * @returns A promise that resolves to an array of Equipment objects.
 */
export async function fetchCompanyEquipment(companyId: string, customerId: string): Promise<Equipment[]> {
     if (!companyId || !customerId) return [];
    const allEquipment = await fetchAllEquipment(companyId);
    return allEquipment.filter(eq => eq.customer_id === customerId);
}

/**
 * Fetches invoices for a specific customer within a company.
 * @param companyId The ID of the company.
 * @param customerId The ID of the customer.
 * @returns A promise that resolves to an array of Invoice objects.
 */
export async function fetchCompanyInvoices(companyId: string, customerId: string): Promise<Invoice[]> {
    if (!companyId || !customerId) return [];
    // The main invoices service function is in workOrders.ts due to circular dependency potential
    // This is not ideal and should be refactored if more invoice logic is needed.
    const allInvoices = await fetchAllInvoices(companyId);
    return allInvoices.filter(inv => inv.customer_id === customerId);
}
