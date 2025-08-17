'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, Wrench, Send, CheckCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { fetchPublicEquipmentDetails, submitServiceRequest } from '@/services/public';
import type { Equipment } from '@/types/equipment';
import Image from 'next/image';

const requestSchema = z.object({
  description: z.string().min(10, "Please provide a more detailed description of the issue."),
  contact_name: z.string().min(1, "Your name is required."),
  contact_phone: z.string().min(1, "A contact phone number is required."),
  contact_email: z.string().email("Please enter a valid email address.").optional().or(z.literal('')),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function RequestServicePage() {
    const { equipmentId } = useParams() as { equipmentId: string };
    const { toast } = useToast();
    const [equipment, setEquipment] = React.useState<Equipment | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RequestFormData>({
        resolver: zodResolver(requestSchema),
        defaultValues: { description: '', contact_name: '', contact_phone: '', contact_email: '' },
    });

    React.useEffect(() => {
        if (equipmentId) {
            const getEquipment = async () => {
                setLoading(true);
                setError(null);
                try {
                    const data = await fetchPublicEquipmentDetails(equipmentId);
                    if (!data) throw new Error("Equipment not found. Please check the QR code.");
                    setEquipment(data);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            getEquipment();
        }
    }, [equipmentId]);

    const onSubmit = async (data: RequestFormData) => {
        try {
            await submitServiceRequest(equipmentId, data);
            setIsSubmitted(true);
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: err.message || 'There was a problem submitting your request.',
            });
        }
    };
    
    if (loading) {
        return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></main>;
    }
    
    if (error) {
        return (
             <main className="flex min-h-screen items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-lg">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Loading Equipment</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
             </main>
        );
    }
    
    if (isSubmitted) {
        return (
             <main className="flex min-h-screen items-center justify-center p-4">
                <Card className="w-full max-w-lg text-center">
                    <CardHeader>
                        <div className="mx-auto bg-green-100 rounded-full p-3 w-fit dark:bg-green-900">
                           <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="mt-4">Request Submitted!</CardTitle>
                        <CardDescription>
                            Your service request for the <strong>{equipment?.name}</strong> has been sent. A service coordinator will be in touch with you shortly.
                        </CardDescription>
                    </CardHeader>
                </Card>
             </main>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 bg-muted/40">
            <Card className="w-full max-w-lg">
                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl"><Wrench className="h-6 w-6 text-primary"/> Service Request</CardTitle>
                        <CardDescription>You are requesting service for the following equipment:</CardDescription>
                         <div className="pt-2">
                            <p className="font-semibold text-lg">{equipment?.name}</p>
                            <p className="text-sm text-muted-foreground">{equipment?.location_name}</p>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="description">Describe the Issue <span className="text-destructive">*</span></Label>
                            <Controller name="description" control={control} render={({ field }) => <Textarea id="description" {...field} rows={4} placeholder="e.g., The walk-in freezer is not holding temperature."/>} />
                            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="contact_name">Your Name <span className="text-destructive">*</span></Label>
                            <Controller name="contact_name" control={control} render={({ field }) => <Input id="contact_name" {...field} />} />
                            {errors.contact_name && <p className="text-sm text-destructive mt-1">{errors.contact_name.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="contact_phone">Contact Phone <span className="text-destructive">*</span></Label>
                            <Controller name="contact_phone" control={control} render={({ field }) => <Input id="contact_phone" {...field} type="tel" />} />
                             {errors.contact_phone && <p className="text-sm text-destructive mt-1">{errors.contact_phone.message}</p>}
                        </div>
                         <div>
                            <Label htmlFor="contact_email">Contact Email (Optional)</Label>
                            <Controller name="contact_email" control={control} render={({ field }) => <Input id="contact_email" {...field} type="email"/>} />
                             {errors.contact_email && <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Submit Request
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </main>
    );
}
