
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Wrench, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Deficiency } from '@/types/deficiency';
import type { Equipment } from '@/types/equipment';
import { cn } from '@/lib/utils';

interface DeficiencyManagerProps {
    deficiencies: Deficiency[];
    equipment: Equipment[];
    canLog: boolean;
    onLogDeficiency: () => void;
    onLogRepair: (deficiencyId: string) => void;
}

const severityClasses = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-blue-500 text-white',
};

export function DeficiencyManager({ deficiencies, equipment, canLog, onLogDeficiency, onLogRepair }: DeficiencyManagerProps) {
    const getEquipmentName = (equipmentId: string | null | undefined) => {
        if (!equipmentId) return 'No specific equipment';
        const eq = equipment.find(e => e.id === equipmentId);
        return eq ? eq.name : 'Unknown Equipment';
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><ShieldAlert /> Deficiencies</CardTitle>
                        <CardDescription>Issues reported for this work order.</CardDescription>
                    </div>
                    {canLog && <Button onClick={onLogDeficiency} size="sm"><PlusCircle className="mr-2 h-4"/>Log Deficiency</Button>}
                </div>
            </CardHeader>
            <CardContent>
                {deficiencies.length > 0 ? (
                    <ul className="space-y-4">
                        {deficiencies.map((d) => (
                            <li key={d.id} className="flex flex-col md:flex-row md:items-start justify-between p-4 rounded-lg border">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2 mb-1">
                                         <Badge className={cn(severityClasses[d.severity])}>{d.severity}</Badge>
                                         <Badge variant={d.status === 'open' ? 'destructive' : 'default'}>{d.status}</Badge>
                                    </div>
                                    <p className="font-semibold text-base py-1">{d.description}</p>
                                    <p className="text-sm text-muted-foreground">
                                        <strong>Equipment:</strong> {getEquipmentName(d.equipment_id)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 mt-3 md:mt-0 md:ml-4 flex-shrink-0">
                                    {d.status === 'open' && canLog && (
                                        <Button size="sm" variant="outline" onClick={() => onLogRepair(d.id)}>
                                            <Wrench className="mr-2 h-4 w-4" />
                                            Log Repair
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-center py-6">No deficiencies have been logged.</p>
                )}
            </CardContent>
        </Card>
    );
}
