
'use client';
import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Firebase import
import { auth, firebaseInitializationError } from '@/lib/firebase/config'; // Firebase import
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'; // Import Eye icons
import Link from 'next/link'; // Import Link
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Import Alert components
import { useToast } from '@/hooks/use-toast'; // Import useToast


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const router = useRouter();
  const { toast } = useToast();


  useEffect(() => {
    // Set initial error state based on firebaseInitializationError
    if (firebaseInitializationError) {
       setError(`Login unavailable due to Firebase configuration issue: ${firebaseInitializationError}`);
       toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "Login is currently unavailable.",
          duration: Infinity, // Keep the toast visible
        });
    } else {
        setError(null); // Clear error if Firebase seems okay initially
    }
  }, [toast]); // Add toast to dependency array


  const isValidEmail = (email: string) => {
    // Basic email validation regex
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = async () => {
    // Re-check Firebase config status before attempting login
    if (!auth || firebaseInitializationError) {
      const configError = firebaseInitializationError || "Firebase auth instance not available.";
      setError(`Login unavailable: ${configError}. Check environment variables.`);
      toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "Login is currently unavailable.",
      });
      return;
    }

    setLoading(true);
    setError(null); // Clear previous login errors

    // Client-side email format validation
    if (!isValidEmail(email)) {
      const invalidEmailMsg = 'Please enter a valid email address.';
      setError(invalidEmailMsg);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: invalidEmailMsg,
      });
      setLoading(false);
      return;
    }


    try {
      console.log("Attempting Firebase login for:", email);
      await signInWithEmailAndPassword(auth, email, password); // Use Firebase function
      console.log("Firebase login successful.");
      toast({ title: "Login Successful", description: "Redirecting to dashboard..." }); // Add success toast
      // Use replace to avoid adding login page to history stack
      router.replace('/'); // Redirect to dashboard on successful login
      console.log("Redirecting to '/' initiated.");
    } catch (err: any) {
      console.error("Firebase Login Error:", err.code, err.message);
      let errorMessage = 'An unknown error occurred during login.';
      // Modern Firebase Authentication returns 'auth/invalid-credential' for wrong email/password.
      if (err.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. If you are an admin signing in for the first time, please use the "Forgot Password" link to set your password.';
      } else if (err.code === 'auth/invalid-email') {
         errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/invalid-api-key' || err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
         errorMessage = 'Firebase configuration error (Invalid API Key). Please check setup.';
         setError(errorMessage); // Persist the config error message
      } else if (err.code === 'auth/network-request-failed') {
         errorMessage = 'Network error. Please check your internet connection.';
      } else {
          errorMessage = err.message || errorMessage;
      }
       // Only set the generic error if it's not the config error we already set
      if (!error || !error.includes("Firebase configuration error")) {
           setError(errorMessage);
       }
       toast({ // Add error toast
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        title: "Email Required",
        description: "Please enter your email address to reset your password.",
      });
      return;
    }
     if (!auth) {
      setError(`Password reset unavailable: Firebase auth instance not available.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox (and spam folder) for instructions.",
      });
    } catch (err: any) {
      console.error("Forgot Password Error:", err.code, err.message);
      let errorMessage = 'An unknown error occurred.';
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No user found with this email address.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else {
        errorMessage = err.message;
      }
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Failed to Send Reset Email",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
     <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Login to OpSite</CardTitle>
          <CardDescription className="text-center text-muted-foreground">Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Display the configuration or login error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{error.includes("Firebase configuration error") ? "Configuration Error" : "Login Error"}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {/* Disable form inputs if there's a config error */}
          <div className={firebaseInitializationError ? 'opacity-50 pointer-events-none' : ''}>
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sr-only">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10"
              disabled={!!firebaseInitializationError || loading}
            />
          </div>
           <div className={`relative ${firebaseInitializationError ? 'opacity-50 pointer-events-none' : ''}`}>
            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sr-only">Password</label>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'} // Toggle input type
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 pr-10" // Add padding for the icon
              disabled={!!firebaseInitializationError || loading}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={!!firebaseInitializationError || loading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
          {/* Disable login button if there's a config error */}
          <Button onClick={handleLogin} disabled={loading || !!firebaseInitializationError} className="w-full h-10">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Logging in...' : 'Login'}
          </Button>
            <div className="text-sm text-center w-full">
                <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                    disabled={loading || !!firebaseInitializationError}
                >
                    Forgot Password?
                </button>
            </div>
           {/* Show signup link only if no config error */}
           {!firebaseInitializationError && (
             <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign up
                </Link>
             </p>
           )}
        </CardFooter>
      </Card>
    </main>
  );
}
