import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { LifeBuoy } from 'lucide-react';

export default function SupportPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6" /> Support
          </CardTitle>
          <CardDescription>Access help resources and contact support.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Support and help content goes here.</p>
          {/* TODO: Implement knowledge base links, contact form, etc. */}
        </CardContent>
      </Card>
    </main>
  );
}
