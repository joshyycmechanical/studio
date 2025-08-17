
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, HardHat } from 'lucide-react';
import type { Equipment } from '@/types/equipment';
import type { WorkOrder } from '@/types/work-order';

interface EquipmentManagerProps {
    equipment: Equipment[];
    canAdd: boolean;
    workOrder: WorkOrder;
    onAddEquipment: () => void;
}

export function EquipmentManager({ equipment, canAdd, workOrder, onAddEquipment }: EquipmentManagerProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><HardHat /> Equipment at Location</CardTitle>
                        <CardDescription>All equipment registered at this service location.</CardDescription>
                    </div>
                    {canAdd && <Button onClick={onAddEquipment} size="sm"><PlusCircle className="mr-2 h-4"/>Add Equipment</Button>}
                </div>
            </CardHeader>
            <CardContent>
                {equipment.length > 0 ? (
                    <ul className="divide-y divide-border">
                        {equipment.map(item => (
                            <li key={item.id} className="py-3">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {item.manufacturer && `${item.manufacturer} `}
                                    {item.model_number && `(Model: ${item.model_number})`}
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-center py-4">No equipment has been added for this location.</p>
                )}
            </CardContent>
        </Card>
    );
}
