
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Loader2 } from 'lucide-react';
import type { WorkOrder, WorkOrderStatus } from '@/types/work-order';
import { format } from 'date-fns';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { fetchCompanyWorkOrders } from '@/services/portal';

export default function PortalWorkOrdersPage() {
    const { customerUser, loading: authLoading } = usePortalAuth();
    const [workOrders, setWorkOrders] = React.useState<WorkOrder[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading || !customerUser?.companyId || !customerUser.customerId) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const woData = await fetchCompanyWorkOrders(customerUser.companyId, customerUser.customerId);
                setWorkOrders(woData);
            } catch (err) {
                console.error("Error fetching portal work orders:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, customerUser]);


     const getStatusBadgeVariant = (status: WorkOrderStatus): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
            case 'completed': return 'default';
            case 'scheduled': return 'secondary';
            case 'in-progress': return 'secondary';
            case 'on-hold': return 'outline';
            case 'new': return 'outline';
            case 'invoiced': return 'default';
            case 'cancelled': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" /> Work Orders
                </CardTitle>
                <CardDescription>View the history of service requests for your locations.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>WO#</TableHead>
                                <TableHead>Summary</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Scheduled Date</TableHead>
                                <TableHead>Completed Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No work orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                workOrders.map((wo) => (
                                    <TableRow key={wo.id}>
                                        <TableCell className="font-medium">{wo.work_order_number}</TableCell>
                                        <TableCell className="max-w-xs truncate">{wo.summary}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(wo.status)} className="capitalize">
                                                {wo.status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                         <TableCell>{wo.scheduled_date ? format(new Date(wo.scheduled_date), 'PP') : '-'}</TableCell>
                                         <TableCell>{wo.completed_date ? format(new Date(wo.completed_date), 'PP') : '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
                Showing {workOrders.length} work orders.
            </CardFooter>
        </Card>
    );
}
