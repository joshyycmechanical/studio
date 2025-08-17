
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { updateWorkOrder } from '@/services/workOrders';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { WorkOrder, WorkOrderPriority } from '@/types/work-order';
import useIsMobile from '@/hooks/use-mobile'; // Import the hook

// --- Utility Functions & Components ---

const getPriorityClasses = (priority?: WorkOrderPriority | null): string => {
  switch (priority) {
    case 'emergency': return 'bg-red-600 text-white';
    case 'high': return 'bg-orange-500 text-white';
    case 'medium': return 'bg-yellow-500 text-black';
    case 'low': return 'bg-blue-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

// --- Table Definition ---

export function WorkOrderTable({ workOrders, title }: { workOrders: any[], title: string }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const router = useRouter();
  const { user, companyId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile(); // Use the hook

  const acceptMutation = useMutation({
    mutationFn: (workOrderId: string) => {
      if (!user || !companyId) throw new Error("User or company not found.");
      return updateWorkOrder(companyId, workOrderId, { assigned_technician_id: user.id, status: 'scheduled' });
    },
    onSuccess: (updatedWorkOrder) => {
      toast({ title: "Job Accepted", description: `Work Order #${updatedWorkOrder.work_order_number} has been assigned to you.` });
      queryClient.invalidateQueries({ queryKey: ['workOrders', companyId] });
      router.push(`/work-orders/${updatedWorkOrder.id}`);
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error Accepting Job', description: error.message });
    },
  });

  const columns: ColumnDef<any>[] = [
    {
        accessorKey: 'work_order_number',
        header: 'WO #',
    },
    {
        accessorKey: 'summary',
        header: 'Summary',
        cell: ({ row }) => <div className="max-w-xs truncate">{row.getValue('summary')}</div>,
    },
    {
        accessorKey: 'customer_name',
        header: 'Customer',
    },
    {
        accessorKey: 'priority',
        header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>Priority</Button>,
        cell: ({ row }) => <Badge className={`${getPriorityClasses(row.getValue('priority'))} capitalize`}>{row.getValue('priority')}</Badge>,
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant="secondary" className="capitalize">{row.getValue('status').replace('-', ' ')}</Badge>,
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const wo = row.original;
        const isAssignedToMe = wo.assigned_technician_id === user?.id;
        const isAvailable = !wo.assigned_technician_id;

        return (
          <div className="text-right">
            {isMobile ? (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/work-orders/${wo.id}`); }}>
                <Eye className="h-4 w-4" />
              </Button>
            ) : isAvailable ? (
              <Button
                size="sm"
                variant="default"
                onClick={(e) => { e.stopPropagation(); acceptMutation.mutate(wo.id); }}
                disabled={acceptMutation.isPending && acceptMutation.variables === wo.id}
              >
                {acceptMutation.isPending && acceptMutation.variables === wo.id ?
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                  <CheckCircle className="mr-2 h-4 w-4" />
                }
                Accept
              </Button>
            ) : (
                <span/> // Empty span to keep the column on desktop
            )}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: workOrders,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle>{title}</CardTitle>
            <Input
              placeholder="Filter jobs..."
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className="max-w-sm"
            />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    onClick={() => router.push(`/work-orders/${row.original.id}`)}
                    className="cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No work orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}
