
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { createWorkOrder } from '@/services/workOrders';
import { fetchCompanyCustomers, createCustomerWithContacts } from '@/services/customers'; // Corrected import
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyUsers } from '@/services/users';
import { fetchDeficiencyById } from '@/services/deficiencies';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { UserProfileWithRoles } from '@/types/user';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '@/types/work-order';
import type { Deficiency, DeficiencySeverity } from '@/types/deficiency';

// Schemas
const workOrderSchema = z.object({
  summary: z.string().min(1, { message: 'Summary is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().min(1, { message: 'Location is required' }),
  status: z.enum(['new', 'scheduled', 'in-progress', 'on-hold', 'completed', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'emergency']),
  description: z.string().optional(),
  scheduled_date: z.date().optional().nullable(),
  assigned_technician_id: z.string().optional().nullable(),
  equipment_id: z.string().optional().nullable(),
});

const newCustomerWithLocationSchema = z.object({
    customerName: z.string().min(1, 'Customer name is required'),
    locationName: z.string().min(1, 'Location name is required'),
    addressLine1: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    province: z.string().min(1, 'Province/State is required'),
    postalCode: z.string().min(1, 'Postal/Zip Code is required'),
});

type WorkOrderFormData = z.infer<typeof workOrderSchema>;
type NewCustomerFormData = z.infer<typeof newCustomerWithLocationSchema>;

export function useNewWorkOrder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [technicians, setTechnicians] = useState<Partial<UserProfileWithRoles>[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [linkedDeficiencyId, setLinkedDeficiencyId] = useState<string | null>(null);

  const canCreateWorkOrders = !authLoading && hasPermission(user, 'work-orders', 'create');

  const workOrderForm = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      summary: '',
      customer_id: '',
      location_id: '',
      equipment_id: null,
      status: 'new',
      priority: 'medium',
      description: '',
      scheduled_date: null,
      assigned_technician_id: null,
    },
  });

  const customerForm = useForm<NewCustomerFormData>({
      resolver: zodResolver(newCustomerWithLocationSchema),
      defaultValues: {
            customerName: '',
            locationName: '',
            addressLine1: '',
            city: '',
            province: '',
            postalCode: '',
      },
  });

  const selectedCustomerId = workOrderForm.watch('customer_id');

  const fetchDropdownData = useCallback(async () => {
    if (authLoading || !companyId) return;
    if (!canCreateWorkOrders) {
        setLoadingDropdowns(false);
        return;
    }
    setLoadingDropdowns(true);
    try {
        const [customerData, locationData, techData] = await Promise.all([
            fetchCompanyCustomers(companyId),
            fetchCompanyLocations(companyId),
            fetchCompanyUsers(companyId)
        ]);
        setCustomers(customerData);
        setLocations(locationData);
        setTechnicians(techData);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: "Could not load necessary data." });
    } finally {
        setLoadingDropdowns(false);
    }
  }, [companyId, authLoading, canCreateWorkOrders, toast]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  useEffect(() => {
    const deficiencyId = searchParams.get('deficiencyId');
    if (deficiencyId && companyId && locations.length > 0) {
      setLinkedDeficiencyId(deficiencyId);
      const prefillFromDeficiency = async () => {
        try {
          const deficiency = await fetchDeficiencyById(companyId, deficiencyId);
          if (deficiency) {
            const location = locations.find(l => l.id === deficiency.location_id);
            if (location) {
              const priorityMap: { [key in DeficiencySeverity]: WorkOrderPriority } = { critical: 'emergency', high: 'high', medium: 'medium', low: 'low' };
              workOrderForm.setValue('customer_id', location.customer_id, { shouldValidate: true });
              workOrderForm.setValue('location_id', deficiency.location_id, { shouldValidate: true });
              workOrderForm.setValue('summary', `Address Deficiency: ${deficiency.description.substring(0, 50)}`);
              workOrderForm.setValue('description', `This work order was created to address the following reported deficiency:

"${deficiency.description}"`);
              workOrderForm.setValue('priority', priorityMap[deficiency.severity] || 'medium');
              if(deficiency.equipment_id) workOrderForm.setValue('equipment_id', deficiency.equipment_id);
              toast({ title: "Deficiency Loaded", description: "Work order pre-filled with deficiency details." });
            }
          }
        } catch (error) {
          toast({ variant: 'destructive', title: "Error", description: "Could not load deficiency details." });
        }
      };
      prefillFromDeficiency();
    }
  }, [searchParams, companyId, locations, workOrderForm, toast]);

   useEffect(() => {
    if (selectedCustomerId && locations.length > 0) {
      setFilteredLocations(locations.filter(loc => loc.customer_id === selectedCustomerId));
      if (workOrderForm.watch('location_id') && !locations.some(l => l.id === workOrderForm.watch('location_id') && l.customer_id === selectedCustomerId)) {
           workOrderForm.setValue('location_id', '');
      }
    } else {
      setFilteredLocations([]);
      workOrderForm.setValue('location_id', '');
    }
  }, [selectedCustomerId, locations, workOrderForm]);

  const handleCreateNewCustomer = async (data: NewCustomerFormData) => {
    if (!companyId || !user) {
        toast({ title: 'Error', description: 'Cannot create customer.', variant: 'destructive' });
        return;
    }
    setIsSubmittingCustomer(true);
    try {
        const { customer: newCustomer, location: newLocation } = await createCustomerWithContacts(
            { name: data.customerName, status: 'active' },
            [] // Passing empty contacts array for now
        );
        toast({ title: 'Customer Created', description: `"${newCustomer.name}" has been added.` });
        setCustomers(prev => [...prev, newCustomer].sort((a,b) => a.name.localeCompare(b.name)));
        setLocations(prev => [...prev, newLocation as any]);
        workOrderForm.setValue('customer_id', newCustomer.id, { shouldValidate: true });
        setTimeout(() => workOrderForm.setValue('location_id', (newLocation as any).id, { shouldValidate: true }), 100);
        setIsCustomerDialogOpen(false);
        customerForm.reset();
    } catch (error: any) {
        toast({ title: 'Error Creating Customer', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmittingCustomer(false);
    }
  };

  const onSubmit = async (data: WorkOrderFormData) => {
    if (!canCreateWorkOrders || !companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Cannot create work order." });
       return;
    }
    setIsSubmitting(true);
    try {
       await createWorkOrder(companyId, user.id, {
            ...data,
            description: data.description ?? null,
            scheduled_date: data.scheduled_date ?? null,
            assigned_technician_id: data.assigned_technician_id ?? null,
            equipment_id: data.equipment_id ?? null,
            related_deficiency_ids: linkedDeficiencyId ? [linkedDeficiencyId] : [],
        });
       toast({ title: "Work Order Created", description: `Work order "${data.summary}" has been successfully created.` });
       router.push('/work-orders');
    } catch (error: any) {
       toast({ variant: "destructive", title: "Creation Failed", description: error.message || "Could not create the work order." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    router,
    toast,
    user,
    companyId,
    authLoading,
    isSubmitting,
    customers,
    locations,
    technicians,
    filteredLocations,
    loadingDropdowns,
    isCustomerDialogOpen,
    setIsCustomerDialogOpen,
    isSubmittingCustomer,
    canCreateWorkOrders,
    workOrderForm,
    customerForm,
    handleCreateNewCustomer,
    onSubmit
  };
}
