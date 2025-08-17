
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This page now acts as a redirect to the default company settings page.
export default function SettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the company profile, which is the main settings page.
    router.replace('/settings/company-profile');
  }, [router]);

  // Render a loading state or null while the redirect happens
  return (
    <div className="flex h-full w-full items-center justify-center">
      <p>Redirecting to company settings...</p>
    </div>
  );
}
