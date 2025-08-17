
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { TimeEntry } from '@/types/time-entry';
import type { UserProfile } from '@/types/user';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"

interface TimesheetTableProps {
    timeEntries: TimeEntry[];
    users: UserProfile[];
    canApprove: boolean;
    canDelete: boolean;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: 'approved' | 'rejected') => void;
}

export function TimesheetTable({ timeEntries, users, canApprove, canDelete, onDelete, onStatusChange }: TimesheetTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Technician</TableHead>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {timeEntries.map(entry => (
                    <TableRow key={entry.id}>
                        <TableCell>{users.find(u => u.id === entry.user_id)?.full_name || 'Unknown User'}</TableCell>
                        <TableCell>{entry.work_order_id || 'N/A'}</TableCell>
                        <TableCell>{format(new Date(entry.clock_in_time), 'Pp')}</TableCell>
                        <TableCell>{entry.clock_out_time ? format(new Date(entry.clock_out_time), 'Pp') : 'Still Clocked In'}</TableCell>
                        <TableCell>{entry.duration_minutes ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m` : '-'}</TableCell>
                        <TableCell>{entry.status}</TableCell>
                        <TableCell>
                            {canApprove && entry.status === 'pending_approval' && (
                                <>
                                    <Button size="sm" variant="ghost" onClick={() => onStatusChange(entry.id, 'approved')}><CheckCircle className="text-green-500"/></Button>
                                    <Button size="sm" variant="ghost" onClick={() => onStatusChange(entry.id, 'rejected')}><XCircle className="text-red-500"/></Button>
                                </>
                            )}
                            {canDelete && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button size="sm" variant="ghost"><Trash2 className="text-destructive"/></Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the time entry.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDelete(entry.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
