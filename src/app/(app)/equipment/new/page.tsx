
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Wrench, Save, AlertCircle, Camera } from 'lucide-react'; // Added Camera icon
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn, formatEnum } from '@/lib/utils';
import type { Customer } from '@/types/customer';
import type { Location } from '@/types/location';
import type { Equipment, EquipmentStatus } from '@/types/equipment';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    fetchCompanyCustomers
} from '@/services/customers';
import {
    fetchCompanyLocations
} from '@/services/locations';
import {
    createEquipment
} from '@/services/equipment';
import {
    extractNameplateDetails
} from '@/ai/flows/extract-nameplate-details'; // Import the new AI flow


const equipmentStatuses: EquipmentStatus[] = ['operational', 'needs-repair', 'decommissioned'];

const equipmentSchema = z.object({
  name: z.string().min(1, { message: 'Equipment Name is required' }),
  customer_id: z.string().min(1, { message: 'Customer is required' }),
  location_id: z.string().min(1, { message: 'Location is required' }),
  status: z.enum(equipmentStatuses),
  asset_tag: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model_number: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  equipment_type: z.string().optional().nullable(),
  installation_date: z.date().optional().nullable(),
  last_service_date: z.date().optional().nullable(),
  next_service_due_date: z.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

export default function NewEquipmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // For OCR loading state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  const canCreateEquipment = !authLoading && hasPermission(user, 'equipment', 'create');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: '',
      customer_id: '',
      location_id: '',
      status: 'operational',
      asset_tag: '',
      manufacturer: '',
      model_number: '',
      serial_number: '',
      equipment_type: '',
      installation_date: null,
      last_service_date: null,
      next_service_due_date: null,
      notes: '',
    },
  });

  const selectedCustomerId = watch('customer_id');

  const fetchDropdownData = useCallback(async () => {
      if (!companyId || !canCreateEquipment) {
          setLoadingDropdowns(false);
          return;
      }
      setLoadingDropdowns(true);
      try {
          const [customerData, locationData] = await Promise.all([
              fetchCompanyCustomers(companyId),
              fetchCompanyLocations(companyId),
          ]);
          setCustomers(customerData);
          setLocations(locationData);
      } catch (error: any) {
          console.error("Error fetching dropdown data:", error);
          toast({ variant: "destructive", title: "Error", description: error.message || "Could not load customers or locations." });
      } finally {
          setLoadingDropdowns(false);
      }
  }, [companyId, canCreateEquipment, toast]);

  useEffect(() => {
      if (!authLoading) {
          fetchDropdownData();
      }
  }, [fetchDropdownData, authLoading]);

   useEffect(() => {
    if (selectedCustomerId && locations.length > 0) {
      setFilteredLocations(locations.filter(loc => loc.customer_id === selectedCustomerId));
    } else {
      setFilteredLocations([]);
      setValue('location_id', '');
    }
  }, [selectedCustomerId, locations, setValue]);

  const handleOcrScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    toast({ title: 'Scanning Nameplate...', description: 'Please wait while we extract the details.' });

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const imageDataUri = reader.result as string;
            const result = await extractNameplateDetails({ nameplateImageDataUri: imageDataUri });

            if (result.modelNumber) {
                setValue('model_number', result.modelNumber, { shouldValidate: true });
            }
            if (result.serialNumber) {
                setValue('serial_number', result.serialNumber, { shouldValidate: true });
            }
            if (result.manufacturer) {
                setValue('manufacturer', result.manufacturer, { shouldValidate: true });
            }
            
            toast({
                title: 'Scan Complete',
                description: `Extracted Model: ${result.modelNumber || 'N/A'}, Serial: ${result.serialNumber || 'N/A'}`
            });
        };
        reader.onerror = (error) => {
            throw new Error("Failed to read the image file.");
        };
    } catch (error: any) {
        console.error("OCR Scan failed:", error);
        toast({
            variant: "destructive",
            title: "Scan Failed",
            description: error.message || "Could not extract details from the image.",
        });
    } finally {
        setIsScanning(false);
        // Reset file input value to allow scanning the same file again
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const onSubmit = async (data: EquipmentFormData) => {
     if (!canCreateEquipment) {
        toast({ variant: "destructive", title: "Permission Denied" });
        return;
     }
     if (!companyId || !user) {
       toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
       return;
    }
    setIsSubmitting(true);
    try {
        const equipmentData: Omit<Equipment, 'id' | 'created_at' | 'company_id' | 'customer_id'> = {
            name: data.name.trim(),
            location_id: data.location_id,
            status: data.status,
            asset_tag: data.asset_tag?.trim() || null,
            manufacturer: data.manufacturer?.trim() || null,
            model_number: data.model_number?.trim() || null,
            serial_number: data.serial_number?.trim() || null,
            equipment_type: data.equipment_type?.trim() || null,
            installation_date: data.installation_date ?? null,
            last_service_date: data.last_service_date ?? null,
            next_service_due_date: data.next_service_due_date ?? null,
            notes: data.notes?.trim() || null,
        };
       await createEquipment(companyId, user.id, equipmentData);
       toast({
        title: "Equipment Created",
        description: `Equipment "${data.name}" has been successfully created.`,
       });
       router.push('/equipment');
    } catch (error: any) {
       console.error("Failed to create equipment:", error);
       toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not create the equipment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateEquipment) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to add new equipment.</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             <Wrench className="h-6 w-6" /> Add New Equipment
          </CardTitle>
          <CardDescription>Enter the details for the new piece of equipment manually or scan a nameplate.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Identification & Location */}
            <div className="space-y-4">
               {/* Customer and Location dropdowns... */}
               {/* Equipment Name */}
              <div>
                 <Label htmlFor="name">Equipment Name <span className="text-destructive">*</span></Label>
                <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
            </div>

            {/* Column 2: Details & Dates */}
            <div className="space-y-4">
               {/* Scan Button */}
                <div>
                    <Label>Nameplate Details</Label>
                    <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                        {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Camera className="mr-2 h-4 w-4" />}
                        {isScanning ? 'Scanning...' : 'Scan Nameplate (OCR)'}
                    </Button>
                    <Input type="file" ref={fileInputRef} onChange={handleOcrScan} className="hidden" accept="image/*" />
                    <p className="text-xs text-muted-foreground mt-1">Capture or upload an image of the equipment nameplate.</p>
                </div>

               {/* Manufacturer, Model, Serial... */}
               <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Controller name="manufacturer" control={control} render={({ field }) => <Input id="manufacturer" {...field} value={field.value ?? ''} />} />
              </div>
              <div>
                <Label htmlFor="model_number">Model Number</Label>
                <Controller name="model_number" control={control} render={({ field }) => <Input id="model_number" {...field} value={field.value ?? ''} />} />
              </div>
              <div>
                <Label htmlFor="serial_number">Serial Number</Label>
                <Controller name="serial_number" control={control} render={({ field }) => <Input id="serial_number" {...field} value={field.value ?? ''} />} />
              </div>

               {/* Other fields... */}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || loadingDropdowns || isScanning}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Creating...' : 'Create Equipment'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
