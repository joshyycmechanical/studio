
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailItem, StatusBadge } from './utils';
import { format } from 'date-fns';
import Image from 'next/image';
import { formatEnum } from '@/lib/utils';
import type { WorkOrder } from "@/types/work-order";

export const WorkOrderInfoCard = ({ workOrder }: { workOrder: WorkOrder }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {workOrder.generated_image_url && (
                    <div className="relative h-48 w-full rounded-md overflow-hidden">
                        <Image src={workOrder.generated_image_url} alt="Work Order Image" layout="fill" objectFit="cover" />
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Status">
                        <StatusBadge status={workOrder.status} />
                    </DetailItem>
                    <DetailItem label="Priority" value={formatEnum(workOrder.priority)} />
                    <DetailItem label="Work Order Type" value={workOrder.type ? formatEnum(workOrder.type) : 'N/A'} />
                    <DetailItem label="Customer" value={workOrder.customer_name} />
                    <DetailItem label="Location" value={workOrder.location_name} />
                    <DetailItem label="Created Date" value={workOrder.created_at ? format(new Date(workOrder.created_at), 'PPP') : 'N/A'} />
                    {workOrder.scheduled_date && <DetailItem label="Scheduled Date" value={format(new Date(workOrder.scheduled_date), 'PPP')} />}
                    {workOrder.completed_date && <DetailItem label="Completed Date" value={format(new Date(workOrder.completed_date), 'PPP')} />}
                </div>
            </CardContent>
        </Card>
    )
}
