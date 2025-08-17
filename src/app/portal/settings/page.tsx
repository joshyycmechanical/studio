
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Loader2 } from 'lucide-react';

export default function PortalSettingsPage() {
    const [loading, setLoading] = React.useState(false);
    const [userName, setUserName] = React.useState('Mock Customer Contact'); // TODO: Fetch real data
    const [userEmail, setUserEmail] = React.useState('customer@example.com'); // TODO: Fetch real data

    const handleSaveChanges = async () => {
        setLoading(true);
        console.log("Saving portal user settings:", { userName, userEmail });
        // TODO: Implement API call to update portal user profile details
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate save
        alert("Settings saved (simulated).");
        setLoading(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" /> Portal Settings
                </CardTitle>
                <CardDescription>Manage your contact information and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="portal-name">Your Name</Label>
                    <Input
                        id="portal-name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Enter your full name"
                    />
                 </div>
                  <div className="space-y-2">
                    <Label htmlFor="portal-email">Your Email</Label>
                    <Input
                        id="portal-email"
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="Enter your email address"
                         disabled // Usually email is not editable by the user easily
                    />
                 </div>
                 {/* TODO: Add password change functionality */}
                 {/* TODO: Add notification preferences */}

                 <Button onClick={handleSaveChanges} disabled={loading} className="mt-4">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </CardContent>
        </Card>
    );
}
