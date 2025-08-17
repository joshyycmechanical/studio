
'use client';
import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, getIdToken } from 'firebase/auth';
import { auth, firebaseInitializationError } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
// Removed client-side Firestore imports as they are no longer used here
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link'; // Import Link
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Company } from '@/types/company';
// Removed UserProfile type import as it's not directly used here for creation anymore
// Removed COLLECTIONS and seeding data imports as they are moved to backend

// This function is now moved to the backend API route
// async function createInitialUserAndCompanyRecords(...) { ... }

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<Company['subscription_plan']>('Trial');
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [platformOwnerExists, setPlatformOwnerExists] = useState<boolean | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const isLoadingPage = initialLoading || !!firebaseInitializationError;

  useEffect(() => {
    const checkPlatformOwner = async () => {
      setInitialLoading(true);
      try {
        const response = await fetch('/api/platform/owner-check');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: `API Error: ${response.status}` }));
          throw new Error(errorData.message || `Failed to check platform configuration (status ${response.status}).`);
        }
        const data = await response.json();
        const ownerExists = data.platformOwnerExists;
        setPlatformOwnerExists(ownerExists);
        // isPlatformOwnerSignupAttempt is implicitly handled by platformOwnerExists state

        if (!ownerExists) {
          console.warn("SIGNUP PAGE IS CURRENTLY CONFIGURED TO CREATE A PLATFORM OWNER. THIS WILL HAPPEN ON THE NEXT SUCCESSFUL SIGNUP.");
        } else {
          console.log("Platform Owner already exists. Regular company signup enabled.");
        }
      } catch (err: any) {
        console.error("Error checking for Platform Owner via API:", err);
        setError(`Failed to check platform configuration: ${err.message}. This could be due to server issues or network problems. Please try again or contact support.`);
        setPlatformOwnerExists(null);
      } finally {
        setInitialLoading(false);
      }
    };

    if (!firebaseInitializationError) {
      checkPlatformOwner();
    } else {
      setInitialLoading(false);
    }
  }, [firebaseInitializationError]);


  useEffect(() => {
    if (firebaseInitializationError) {
      setError(`Signup unavailable due to Firebase configuration issue: ${firebaseInitializationError}`);
      toast({
        variant: "destructive",
        title: "Configuration Error",
        description: "Signup is currently unavailable due to a setup issue.",
        duration: Infinity,
      });
      setInitialLoading(false);
    } else {
        if (error && error.includes("Firebase configuration issue")) {
            setError(null);
        }
    }
  }, [firebaseInitializationError, toast, error]);


  const handleSignup = async () => {
    if (!auth || firebaseInitializationError) {
       const configError = firebaseInitializationError || "Firebase auth instance not available.";
       setError(`Signup unavailable: ${configError}.`);
       toast({
          variant: "destructive",
          title: "Configuration Error",
          description: "Signup is currently unavailable.",
       });
      return;
    }

    setIsSigningUp(true);
    if (!(platformOwnerExists === null && error)) {
        setError(null);
    }

    try {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }
      const isPlatformOwnerSignup = platformOwnerExists === false || platformOwnerExists === null;
      if (platformOwnerExists === null && !error?.startsWith("Failed to check platform configuration")) {
          console.warn("[Signup Handle] Platform owner check was inconclusive. Proceeding with isPlatformOwnerSignup as:", isPlatformOwnerSignup);
      }
      
      // NEW: Validate company name and full name client-side
      if (platformOwnerExists && !companyName.trim()) {
        throw new Error("Company Name is required.");
      }
      if (!fullName.trim()) {
        throw new Error("Full Name is required.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("[Signup Handle] Firebase Auth User Created:", user.uid);

      // Get ID token for the new user
      const idToken = await getIdToken(user);

      // Call the backend API to perform post-signup setup
      const postSignupResponse = await fetch('/api/users/post-signup-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: user.email,
          isPlatformOwnerSignup: isPlatformOwnerSignup,
          companyName: companyName,
          adminFullName: fullName,
          subscription_plan: subscriptionPlan,
        }),
      });

      if (!postSignupResponse.ok) {
        const errorData = await postSignupResponse.json().catch(() => ({ message: "Post-signup setup failed with non-JSON response."}));
        console.error("[Signup Handle] Post-signup API error:", errorData);
        throw new Error(errorData.message || `Post-signup setup failed with status ${postSignupResponse.status}.`);
      }

      const postSignupResult = await postSignupResponse.json();
      console.log("[Signup Handle] Post-signup API successful:", postSignupResult);

      toast({
          title: "Account Created!",
          description: isPlatformOwnerSignup
              ? "Platform Owner account created successfully. Please log in."
              : "Your account and new company are ready. Please log in.",
      });

      const redirectPath = '/login';
      console.log(`[Signup Handle] Redirecting to ${redirectPath}`);
      router.push(redirectPath);

    } catch (err: any) {
        console.error("[Signup Handle] Signup Error:", err.code || 'N/A', err.message);
        let errorMessage = err.message || 'An unknown error occurred during signup.';
        
        if (err.message?.includes("Post-signup setup failed")) {
            errorMessage = err.message; // Use the specific message from API failure
        } else if (err.code === 'auth/email-already-in-use') {
            errorMessage = 'This email address is already registered. Please try logging in.';
        } else if (err.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please choose a stronger password (min. 6 characters).';
        } else if (err.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
        } else if (err.code === 'auth/invalid-api-key' || err.code?.includes('api-key-not-valid')) {
            errorMessage = 'Firebase configuration error (Invalid API Key). Please check setup.';
            setError(errorMessage); 
        } else if (err.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your internet connection.';
        }

      if (!error || !error.includes("Firebase configuration error")) {
           setError(errorMessage);
       }
        toast({
            variant: "destructive",
            title: "Signup Failed",
            description: errorMessage,
        });
    } finally {
        setIsSigningUp(false);
    }
  };

  const getButtonText = () => {
    if (firebaseInitializationError) return "Signup Unavailable";
    if (initialLoading) return 'Checking setup...';
    if (isSigningUp) return 'Processing...';
    if (platformOwnerExists === null && error) return 'Proceed with Signup';
    return (platformOwnerExists === false || platformOwnerExists === null) ? 'Create Platform Owner' : 'Create Company Account';
  };

  return (
     <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {isLoadingPage ? "Loading Setup..."
              : (platformOwnerExists === null && error) ? "Setup Problem"
              : ((platformOwnerExists === false || platformOwnerExists === null) ? "Create Platform Owner Account" : "Create Your OpSite Company")}
          </CardTitle>
           <CardDescription className="text-center text-muted-foreground">
              {isLoadingPage ? "Please wait while we check the system configuration."
               : (platformOwnerExists === null && error) ? "There was an issue checking the platform setup."
               : ((platformOwnerExists === false || platformOwnerExists === null)
                ? "Enter the details for the primary platform owner."
                : "Sign up to create your new company workspace on OpSite.")
              }
           </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           {error && (
             <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{firebaseInitializationError ? "Configuration Error" : (error.startsWith("Setup error:") ? "Setup Incomplete" : (error.startsWith("Failed to check platform configuration") ? "Configuration Check Failed" : "Signup Error"))}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
           )}
           {(!isLoadingPage && (platformOwnerExists === false || platformOwnerExists === null) && !error?.startsWith("Failed to check platform configuration")) && (
                <Alert variant="default" className="border-orange-500 text-orange-700 [&>svg]:text-orange-500 dark:border-orange-400 dark:text-orange-300 dark:[&>svg]:text-orange-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Important: Platform Owner Setup</AlertTitle>
                    <AlertDescription>
                        This signup will create the <strong>Platform Owner</strong> account with full system access.
                        This can only be done once.
                    </AlertDescription>
                </Alert>
           )}
           <div className={(isLoadingPage || (platformOwnerExists === null && error && !isSigningUp)) ? 'opacity-50 pointer-events-none' : ''}>
                <div className="space-y-4">
                    {platformOwnerExists === true && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
                                <Input
                                    id="companyName"
                                    type="text"
                                    placeholder="Your Company's Name"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    required
                                    className="h-10"
                                    disabled={isLoadingPage || isSigningUp}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="subscription_plan">Subscription Plan</Label>
                                 <Select value={subscriptionPlan} onValueChange={(value) => setSubscriptionPlan(value as Company['subscription_plan'])}>
                                     <SelectTrigger className="w-full h-10">
                                         <SelectValue placeholder="Select a plan" />
                                     </SelectTrigger>
                                     <SelectContent>
                                         <SelectItem value="Trial">Trial</SelectItem>
                                         <SelectItem value="Starter">Starter</SelectItem>
                                         <SelectItem value="Pro">Pro</SelectItem>
                                         <SelectItem value="Enterprise">Enterprise</SelectItem>
                                     </SelectContent>
                                 </Select>
                            </div>
                        </>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Your Full Name <span className="text-destructive">*</span></Label>
                        <Input
                            id="fullName"
                            type="text"
                            placeholder="e.g., Jane Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="h-10"
                            disabled={isLoadingPage || isSigningUp}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-10"
                            disabled={isLoadingPage || isSigningUp}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Minimum 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="h-10 pr-10"
                            disabled={isLoadingPage || isSigningUp}
                            />
                            <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            disabled={isLoadingPage || isSigningUp}
                            >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
          </div>
         </CardContent>
        <CardFooter className="flex flex-col items-center gap-4">
           <Button
            onClick={handleSignup}
            disabled={isLoadingPage || isSigningUp || (platformOwnerExists === null && error && !isSigningUp && !firebaseInitializationError)}
            className="w-full h-10"
           >
            {isSigningUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getButtonText()}
          </Button>
           {!isLoadingPage && (
             <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
                </Link>
             </p>
           )}
        </CardFooter>
      </Card>
    </main>
  );
}
