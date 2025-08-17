
'use client';

import Script from 'next/script';
import * as React from 'react';

export function GoogleMapsLoader() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn("Google Maps API key is not configured. Address autocomplete will not work.");
    return null; // Don't render the script if the key is missing
  }

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
      strategy="beforeInteractive"
    />
  );
}
