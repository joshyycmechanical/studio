'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Save, ShieldAlert, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import type { Deficiency, DeficiencySeverity, DeficiencyStatus } from '@/types/deficiency';
import type { Location } from '@/types/location';
import type { Equipment } from '@/types/equipment';
import { hasPermission } from '@/lib/permissions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
// Import REAL data service functions
import { createDeficiency } from '@/services/deficiencies';
import { fetchCompanyLocations } from '@/services/locations';
import { fetchCompanyEquipment } from '@/services/equipment'; // Fetch all equipment initially
import { formatEnum } from '@/lib/utils';

const deficiencySeverities: DeficiencySeverity[] = ['low', 'medium', 'high', 'critical'];
// Initial status should be 'open'
// const deficiencyStatuses: DeficiencyStatus[] = ['open', 'in-progress', 'resolved', 'cancelled'];

// Define the form schema using Zod
const deficiencySchema = z.object({
  location_id: z.string().min(1, { message: 'Location is required' }),
  equipment_id: z.string().optional().nullable(),
  description: z.string().min(1, { message: 'Description is required' }),
  severity: z.enum(deficiencySeverities),
  status: z.literal('open').default('open'), // Status always starts as 'open'
  // attachments: z.array(z.string()).optional(), // Handle attachments separately
});

type DeficiencyFormData = z.infer<typeof deficiencySchema>;

export default function NewDeficiencyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, companyId, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]); // Store all equipment for the company
  const [filteredEquipment, setFilteredEquipment] = useState<Equipment[]>([]); // Equipment filtered by selected location
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  const canCreateDeficiencies = !authLoading && hasPermission(user, 'deficiencies', 'create');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DeficiencyFormData>({
    resolver: zodResolver(deficiencySchema),
    defaultValues: {
      location_id: '',
      equipment_id: null,
      description: '',
      severity: 'medium',
      status: 'open',
    },
  });

  const selectedLocationId = watch('location_id');

  // Fetch locations and equipment
  const fetchDropdownData = useCallback(async () => {
    if (!companyId || !canCreateDeficiencies) {
      setLoadingDropdowns(false);
      return;
    }
    setLoadingDropdowns(true);
    try {
      const [locData, equipData] = await Promise.all([
        fetchCompanyLocations(companyId),
        fetchCompanyEquipment(companyId), // Fetch all equipment
      ]);
      setLocations(locData);
      setAllEquipment(equipData); // Store all equipment
    } catch (error: any) {
      console.error("Error fetching dropdown data:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load locations or equipment." });
    } finally {
      setLoadingDropdowns(false);
    }
  }, [companyId, canCreateDeficiencies, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchDropdownData();
    }
  }, [fetchDropdownData, authLoading]);

  // Filter equipment when location changes
  useEffect(() => {
    if (selectedLocationId && allEquipment.length > 0) {
      setFilteredEquipment(allEquipment.filter(eq => eq.location_id === selectedLocationId));
      setValue('equipment_id', null); // Reset equipment when location changes
    } else {
      setFilteredEquipment([]);
      setValue('equipment_id', null);
    }
  }, [selectedLocationId, allEquipment, setValue]);


  // Use the createDeficiency service function
  const onSubmit = async (data: DeficiencyFormData) => {
    if (!canCreateDeficiencies) {
      toast({ variant: "destructive", title: "Permission Denied" });
      return;
    }
    if (!companyId || !user?.id) {
      toast({ variant: "destructive", title: "Error", description: "Missing company or user context." });
      return;
    }
    setIsSubmitting(true);
    console.log("Submitting New Deficiency Data:", data);

    try {
        // Prepare data for the service function
        // Omit fields handled by the backend (id, company_id, created_at, reported_by, reported_at)
        const deficiencyData: Omit<Deficiency, 'id' | 'company_id' | 'created_at' | 'reported_by' | 'reported_at' | 'resolved_at' | 'resolved_by' | 'updated_at'> = {
            location_id: data.location_id,
            equipment_id: data.equipment_id || null, // Ensure null if empty
            description: data.description,
            severity: data.severity,
            status: 'open', // Always start as 'open'
            resolution_notes: null,
            attachments: [], // Start with empty attachments
            related_work_order_id: null,
        };

      await createDeficiency(companyId, user.id, deficiencyData);

      toast({
        title: "Deficiency Reported",
        description: `Deficiency "${data.description.substring(0, 30)}..." has been logged.`,
      });
      router.push('/deficiencies'); // Redirect back

    } catch (error: any) {
      console.error("Failed to report deficiency:", error);
      toast({
        variant: "destructive",
        title: "Report Failed",
        description: error.message || "Could not log the deficiency.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Checks
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!canCreateDeficiencies) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
        <Alert variant="destructive" className="m-4 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to report new deficiencies.</AlertDescription>
          <Button variant="outline" size="sm" onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Report New Deficiency
          </CardTitle>
          <CardDescription>Log a new issue or problem found at a location or with equipment.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              {/* Location */}
              <div>
                <Label htmlFor="location_id">Location <span className="text-destructive">*</span></Label>
                <Controller
                  name="location_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={loadingDropdowns}>
                      <SelectTrigger id="location_id"><SelectValue placeholder={loadingDropdowns ? "Loading..." : "Select Location"} /></SelectTrigger>
                      <SelectContent>
                        {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                        {locations.length === 0 && !loadingDropdowns && <SelectItem value="" disabled>No locations found</SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.location_id && <p className="text-sm text-destructive mt-1">{errors.location_id.message}</p>}
              </div>

              {/* Equipment (Optional, filtered by Location) */}
              <div>
                <Label htmlFor="equipment_id">Related Equipment (Optional)</Label>
                <Controller
                  name="equipment_id"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={value => field.onChange(value === 'none' ? null : value)} value={field.value ?? 'none'} disabled={!selectedLocationId || loadingDropdowns || filteredEquipment.length === 0}>
                      <SelectTrigger id="equipment_id"><SelectValue placeholder={!selectedLocationId ? "Select location first" : (filteredEquipment.length === 0 ? "No equipment at location" : "Select Equipment")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {filteredEquipment.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name} ({eq.asset_tag || eq.serial_number || 'No ID'})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              {/* Severity */}
              <div>
                <Label htmlFor="severity">Severity <span className="text-destructive">*</span></Label>
                <Controller
                  name="severity"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="severity"><SelectValue placeholder="Select Severity" /></SelectTrigger>
                      <SelectContent>
                        {deficiencySeverities.map(sev => <SelectItem key={sev} value={sev}>{formatEnum(sev)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.severity && <p className="text-sm text-destructive mt-1">{errors.severity.message}</p>}
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      id="description"
                      placeholder="Describe the deficiency observed..."
                      {...field}
                      rows={5}
                    />
                  )}
                />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
              </div>

              {/* TODO: Add Attachment Upload */}
              {/* <div>
                <Label>Attachments (Optional)</Label>
                <Input type="file" multiple />
              </div> */}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || loadingDropdowns}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Report Deficiency'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
