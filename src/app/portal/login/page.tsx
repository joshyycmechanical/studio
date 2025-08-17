
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default function PortalLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        
        // In a real app, this would call your authentication service.
        // For now, it will always fail as it's not implemented.
        console.log('Attempting portal login for:', email);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
        
        setError('Portal login is not yet implemented. Please contact support.');
        
        setLoading(false);
    };

    return (
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                    <LogIn className="h-6 w-6"/> Customer Portal Login
                </CardTitle>
                <CardDescription className="text-center text-muted-foreground">Access your service history and invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Login Unavailable</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div>
                    <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sr-only">Email</label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-10"
                        disabled={loading}
                    />
                </div>
                <div>
                    <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sr-only">Password</label>
                    <Input
                        id="password"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-10"
                        disabled={loading}
                    />
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-center gap-4">
                <Button onClick={handleLogin} disabled={loading} className="w-full h-10">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {loading ? 'Logging in...' : 'Login'}
                </Button>
                {/* Add Forgot Password link if needed */}
            </CardFooter>
        </Card>
    );
}
