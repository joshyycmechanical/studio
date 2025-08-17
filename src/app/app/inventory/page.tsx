import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Warehouse } from 'lucide-react';

export default function InventoryPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-6 w-6" /> Inventory
          </CardTitle>
          <CardDescription>Manage parts, stock levels, and warehouses.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Inventory content goes here.</p>
          {/* TODO: Implement inventory management features */}
        </CardContent>
      </Card>
    </main>
  );
}
