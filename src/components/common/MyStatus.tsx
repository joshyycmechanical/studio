
'use client';

import * as React from 'react';
import { useAuth } from '@/context/AuthContext';
import { clockOut } from '@/services/user-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hourglass, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function MyStatus() {
  const { user, activeTimer, fetchUserProfile, companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = React.useState('');

  const clockOutMutation = useMutation({
    mutationFn: () => clockOut(notes),
    onSuccess: () => {
      toast({ title: 'Clocked Out', description: 'Your time entry has been saved.' });
      // Invalidate queries that might be affected by the user's status change
      queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
      fetchUserProfile(); // This refetches all user data including the active timer.
      setNotes('');
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Clock Out Failed', description: error.message });
    },
  });

  if (!activeTimer) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Hourglass className="h-6 w-6 text-primary animate-pulse" />
          <div>
            <p className="font-semibold">Currently Clocked In</p>
            <div className="text-sm text-muted-foreground">
                On Work Order: {activeTimer.work_order_id.substring(0, 8)}...
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Clock Out</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Clock Out</AlertDialogTitle>
                    <AlertDialogDescription>Add any notes for this time entry before clocking out.</AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="clock-out-notes">Notes (Optional)</Label>
                    <Textarea id="clock-out-notes" placeholder="e.g., Finished diagnostics, parts needed..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}>
                        {clockOutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4"/>}
                        Confirm Clock Out
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
