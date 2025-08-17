
'use client';

import React, { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/services/storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Camera, Loader2, XCircle } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadFieldProps {
  value: string | null; // The download URL of the image
  onChange: (downloadUrl: string | null) => void;
  storagePath: string; // e.g., 'companies/{companyId}/checklists/{instanceId}/{fieldId}'
}

export function ImageUploadField({ value, onChange, storagePath }: ImageUploadFieldProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    const fullPath = `${storagePath}/${Date.now()}_${file.name}`;

    try {
      const downloadURL = await uploadFile(file, fullPath, (p) => setProgress(p));
      onChange(downloadURL);
      toast({ title: 'Image Uploaded', description: 'The image has been successfully saved.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
      onChange(null); // Clear value on failure
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the file input
    onChange(null);
  };

  return (
    <div className="mt-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
        capture="environment"
      />
      
      {value ? (
        <div className="relative w-full h-48 border rounded-md overflow-hidden group">
          <Image src={value} alt="Uploaded attachment" layout="fill" objectFit="cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleRemoveImage}
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          {isUploading ? `Uploading... ${Math.round(progress)}%` : 'Add Photo'}
        </Button>
      )}

      {isUploading && <Progress value={progress} className="w-full mt-2" />}
    </div>
  );
}
