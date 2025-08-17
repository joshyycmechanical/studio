import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';

export default function FilesPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6" /> File Manager
          </CardTitle>
          <CardDescription>Manage documents and files related to jobs, customers, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">File Manager content goes here.</p>
          {/* TODO: Implement file upload, storage, and organization features */}
        </CardContent>
      </Card>
    </main>
  );
}
