
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Wrench } from "lucide-react";
import type { Repair } from '@/types/repair';
import { format } from 'date-fns';

interface RepairManagerProps {
    repairs: Repair[];
    canLog: boolean;
    onLogRepair: () => void;
}

export function RepairManager({ repairs, canLog, onLogRepair }: RepairManagerProps) {
    return (
        <Card>
            <CardHeader>
                 <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Wrench /> Repairs</CardTitle>
                        <CardDescription>Work performed and parts used for this job.</CardDescription>
                    </div>
                    {canLog && <Button onClick={onLogRepair} size="sm"><PlusCircle className="mr-2 h-4"/>Log Repair</Button>}
                </div>
            </CardHeader>
            <CardContent>
                {repairs.length > 0 ? (
                    <ul className="space-y-4">
                        {repairs.map((r) => (
                            <li key={r.id} className="p-4 rounded-lg border">
                                <p className="font-semibold">{r.description}</p>
                                <p className="text-sm text-muted-foreground">
                                    Logged on: {format(new Date(r.repair_date), 'PPP')} | Labor: {r.labor_hours || 0} hrs
                                </p>
                                {r.notes && <p className="text-sm italic mt-1">Notes: {r.notes}</p>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-center py-6">No repairs have been logged for this work order.</p>
                )}
            </CardContent>
        </Card>
    );
}
