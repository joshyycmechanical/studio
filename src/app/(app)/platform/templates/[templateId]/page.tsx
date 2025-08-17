
'use client';

// This file has been deactivated.
// The functionality for editing platform templates has been moved into a dialog
// on the main /platform/templates page for a better user experience.
// This file can be safely removed from the project.

import { Loader2 } from "lucide-react";

export default function DeactivatedEditPlatformTemplatePage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin"/>
        <p className="ml-4 text-muted-foreground">Redirecting...</p>
    </div>
  );
}
