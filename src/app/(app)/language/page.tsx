import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Languages } from 'lucide-react';

export default function LanguagePage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-6 w-6" /> Language Settings
          </CardTitle>
          <CardDescription>Configure language and localization options.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Language settings content goes here.</p>
          {/* TODO: Implement language selection and translation management */}
        </CardContent>
      </Card>
    </main>
  );
}
