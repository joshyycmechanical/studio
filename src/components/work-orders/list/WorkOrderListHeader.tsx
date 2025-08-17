
import { Button } from '@/components/ui/button';
import { PlusCircle, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const WorkOrderListHeader = ({ canCreate }: { canCreate: boolean }) => {
    const router = useRouter();
    return (
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="h-6 w-6"/> Work Orders</h1>
                <p className="text-muted-foreground">Manage all work orders for your company.</p>
            </div>
            {canCreate && <Button onClick={() => router.push('/work-orders/new')}><PlusCircle className="mr-2 h-4"/> New Work Order</Button>}
        </div>
    )
}
