
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; // Import Badge

// Zod schema for the form
const profileSchema = z.object({
  full_name: z.string().min(1, 'Full Name is required'),
  phone: z.string().optional().nullable(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, firebaseUser, fetchUserProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      phone: '',
    },
  });

  // Populate form with user data from context
  React.useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name ?? '',
        phone: user.phone_number ?? '',
      });
    }
  }, [user, reset]);


  const onSubmit = async (data: ProfileFormData) => {
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      
      const response = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            id: firebaseUser.uid,
            full_name: data.full_name,
            phone_number: data.phone || null, // Ensure phone_number is used
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile.');
      }
      
      await fetchUserProfile(); // Refetch profile to update context

      toast({ title: 'Profile Updated', description: 'Your profile information has been saved.' });
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not save your profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={user.profile_photo_url ?? `https://picsum.photos/seed/${user.email ?? 'user'}/64/64`} alt={user.full_name ?? 'User Avatar'} data-ai-hint="person avatar" />
                        <AvatarFallback className="text-2xl">{user.full_name?.charAt(0)?.toUpperCase() ?? user.email?.charAt(0)?.toUpperCase() ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="h-6 w-6" /> My Profile
                        </CardTitle>
                        <CardDescription>Update your personal information.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input value={user.email} disabled />
                    <p className="text-xs text-muted-foreground">Your email address cannot be changed.</p>
                </div>
                 <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={user.companyName ?? 'N/A'} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                    <Controller
                        name="full_name"
                        control={control}
                        render={({ field }) => (
                            <Input id="full_name" placeholder="Enter your full name" {...field} value={field.value ?? ''} />
                        )}
                    />
                    {errors.full_name && <p className="text-sm text-destructive mt-1">{errors.full_name.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                     <Controller
                        name="phone"
                        control={control}
                        render={({ field }) => (
                            <Input id="phone" type="tel" placeholder="Enter your phone number" {...field} value={field.value ?? ''} />
                        )}
                    />
                </div>
                {/* --- NEW SECTION --- */}
                <div className="space-y-4 pt-4 border-t">
                     <div className="space-y-2">
                        <Label>Account Status</Label>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                            {user.status}
                        </Badge>
                     </div>
                     <div className="space-y-2">
                        <Label>Assigned Roles</Label>
                        <div className="flex flex-wrap gap-2">
                            {(user.roleNames && user.roleNames.length > 0) ? (
                                user.roleNames.map(roleName => (
                                    <Badge key={roleName} variant="outline">{roleName}</Badge>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No roles assigned.</p>
                            )}
                        </div>
                     </div>
                </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
            </CardFooter>
        </form>
      </Card>
    </main>
  );
}
