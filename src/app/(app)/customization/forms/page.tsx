'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

export default function FormBuilderPage() {
    const { user } = useAuth();
    const canManageCustomization = hasPermission(user, 'customization', 'manage');

    if (!canManageCustomization) {
       return (
           <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
             <Alert variant="destructive" className="m-4 max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                  You do not have permission to manage form layouts.
                </AlertDescription>
              </Alert>
           </main>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LayoutTemplate className="h-6 w-6" /> Form Layouts
                </CardTitle>
                <CardDescription>
                    Customize the fields and layout for different forms in your application.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Card className="hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Work Order Form</CardTitle>
                                <CardDescription>Customize the fields shown on the new/edit work order pages.</CardDescription>
                            </div>
                            <Link href="/customization/fields?entity_type=work-order">
                                <Button variant="outline">
                                    Customize Layout <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardHeader>
                    </Card>
                    {/* Add more cards here for other customizable forms in the future */}
                </div>
            </CardContent>
        </Card>
    );
}