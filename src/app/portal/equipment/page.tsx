
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wrench, Loader2, MapPin } from 'lucide-react';
import type { Equipment, EquipmentStatus } from '@/types/equipment'; // Import types
import type { Location } from '@/types/location'; // Import location type
import { format } from 'date-fns';
import { usePortalAuth } from '@/context/PortalAuthContext';
import { fetchCompanyEquipment, fetchCompanyLocations } from '@/services/portal';

export default function PortalEquipmentPage() {
    const { customerUser, loading: authLoading } = usePortalAuth();
    const [equipment, setEquipment] = React.useState<Equipment[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (authLoading || !customerUser?.companyId || !customerUser.customerId) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const [equipmentData, locationData] = await Promise.all([
                    fetchCompanyEquipment(customerUser.companyId, customerUser.customerId),
                    fetchCompanyLocations(customerUser.companyId, customerUser.customerId),
                ]);
                setEquipment(equipmentData);
                setLocations(locationData);
            } catch (err) {
                 console.error("Error fetching portal equipment data:", err);
                 // Handle error, e.g., show a toast
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, customerUser]);

    const getLocationName = (locationId: string): string => {
       return locations.find(l => l.id === locationId)?.name ?? 'Unknown Location';
    }

    const getStatusBadgeVariant = (status: EquipmentStatus): "default" | "destructive" | "secondary" | "outline" => {
        switch (status) {
            case 'operational': return 'default';
            case 'needs-repair': return 'destructive';
            case 'decommissioned': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" /> Your Equipment
                </CardTitle>
                <CardDescription>View details and service history for your equipment.</CardDescription>
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
                                <TableHead>Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Serial #</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Service</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {equipment.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No equipment records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                equipment.map((eq) => (
                                    <TableRow key={eq.id}>
                                        <TableCell className="font-medium">{eq.name}</TableCell>
                                         <TableCell className="flex items-center gap-1 text-xs text-muted-foreground">
                                             <MapPin className="h-3 w-3"/>{getLocationName(eq.location_id)}
                                        </TableCell>
                                        <TableCell>{eq.equipment_type || '-'}</TableCell>
                                        <TableCell>{eq.serial_number || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(eq.status)} className="capitalize">
                                                {eq.status.replace('-', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{eq.last_service_date ? format(new Date(eq.last_service_date), 'PP') : '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
                Showing {equipment.length} equipment items.
            </CardFooter>
        </Card>
    );
}
