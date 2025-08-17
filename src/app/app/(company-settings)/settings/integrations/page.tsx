'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Puzzle } from 'lucide-react';

export default function IntegrationsSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="h-5 w-5" /> Integrations
        </CardTitle>
        <CardDescription>Connect OpSite with other applications like QuickBooks, Stripe, etc.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Integration management features are not yet implemented.</p>
        {/* TODO: Implement integration setup and management UI */}
      </CardContent>
    </Card>
  );
}
