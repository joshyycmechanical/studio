import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Map } from 'lucide-react';

export default function GpsTrackingPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-6 w-6" /> GPS Tracking / Technician Map
          </CardTitle>
          <CardDescription>View technician locations in real-time.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">GPS Tracking content goes here.</p>
          {/* TODO: Implement map integration and technician location tracking */}
        </CardContent>
      </Card>
    </main>
  );
}
