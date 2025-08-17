
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth'; // Firebase import
import { auth, firebaseInitializationError } from '@/lib/firebase/config'; // Firebase import
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { LogOut, Loader2 } from 'lucide-react'; // Import Loader2
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast'; // Import useToast


export default function LogoutPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false); // State to track logout process


  const handleLogout = async () => {
     setIsLoggingOut(true);

       // Check Firebase config status before attempting logout
       if (!auth || firebaseInitializationError) {
            console.error("Logout Failed: Firebase not configured.");
            toast({
                variant: "destructive",
                title: "Logout Failed",
                description: "Authentication system is not available.",
            });
            setIsLoggingOut(false);
            return;
       }
      try {
        await signOut(auth);
        toast({
          title: "Logged Out",
          description: "You have been successfully logged out.",
        });
        router.push('/login'); // Redirect to login after successful logout
      } catch (error: any) {
        console.error('Logout error:', error.message);
         toast({
          variant: "destructive",
          title: "Logout Failed",
          description: `Could not log out: ${error.message}`,
        });
        setIsLoggingOut(false);
      }
      // No need for finally block to set loading false, as router.push navigates away
    };

  // Normal Logout Confirmation UI
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 text-center">
           <LogOut className="h-6 w-6" />
          <CardTitle>Log Out</CardTitle>
          <CardDescription>Are you sure you want to log out?</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
           <Button onClick={handleLogout} variant="destructive" disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoggingOut ? 'Logging out...' : 'Confirm Logout'}
            </Button>
        </CardContent>
         <CardFooter className="flex flex-col items-center text-center text-sm text-muted-foreground">
             <p>If you are not redirected automatically:</p>
             <Link href="/login" className="underline text-primary hover:text-primary/80 mt-1">
               Go to the login page
            </Link>
             <Link href="/" className="underline text-primary hover:text-primary/80 mt-2">
               Cancel and go back to Dashboard
            </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
