
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// In a real application, this would involve a separate login flow,
// session management, and API calls to verify the customer user's identity
// and retrieve their associated customerId and companyId.

interface CustomerUser {
    name: string;
    email: string;
    companyName: string; // The service company's name
    customerId: string;  // The customer record ID in Firestore
    companyId: string;   // The company ID this customer belongs to
    avatarUrl?: string;
}

interface PortalAuthContextType {
  customerUser: CustomerUser | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextType>({
  customerUser: null,
  loading: true,
  error: null,
  logout: () => {},
});

export const PortalAuthProvider = ({ children }: { children: ReactNode }) => {
    const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // In a real app, you would have a function here to verify an existing session token.
        // Since there is no real authentication, we will immediately set the user to null
        // and show an error that the feature is not implemented.
        const checkSession = async () => {
            setLoading(true);
            setError(null);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate check
            
            // Set user to null and provide an error because login is not implemented.
            setCustomerUser(null);
            setError("Portal login is not yet implemented. This area is for demonstration only.");
            setLoading(false);
        };

        checkSession();
    }, []);

    const logout = () => {
        setLoading(true);
        // In a real app, this would clear tokens and redirect.
        setTimeout(() => {
            setCustomerUser(null);
            setLoading(false);
            router.push('/portal/login');
        }, 300);
    };

    const value = { customerUser, loading, error, logout };

    return (
        <PortalAuthContext.Provider value={value}>
            {children}
        </PortalAuthContext.Provider>
    );
};

export const usePortalAuth = () => {
    const context = useContext(PortalAuthContext);
    if (context === undefined) {
        throw new Error('usePortalAuth must be used within a PortalAuthProvider');
    }
    return context;
};
