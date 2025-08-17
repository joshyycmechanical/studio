'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default function BillingSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Billing
        </CardTitle>
        <CardDescription>Manage your subscription, payment methods, and view billing history.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Billing management features are not yet implemented.</p>
        {/* TODO: Implement Stripe integration, plan selection, payment method management, invoice history */}
      </CardContent>
    </Card>
  );
}
