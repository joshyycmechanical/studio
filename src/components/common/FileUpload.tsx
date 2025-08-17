
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { UploadCloud, File, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadFile } from '@/services/storage';
import { updateWorkOrder } from '@/services/workOrders';
import type { WorkOrderAttachment } from '@/types/work-order';
import { useAuth } from '@/context/AuthContext';

interface FileUploadProps {
  workOrderId: string;
  companyId: string;
  existingAttachments: WorkOrderAttachment[];
  onUploadComplete: () => void;
}

export function FileUpload({ workOrderId, companyId, existingAttachments, onUploadComplete }: FileUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<{ file: File; progress: number }[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) return;
    setUploadingFiles(acceptedFiles.map(file => ({ file, progress: 0 })));

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const path = `companies/${companyId}/work-orders/${workOrderId}/${Date.now()}_${file.name}`;
      
      try {
        const downloadURL = await uploadFile(file, path, (progress) => {
          setUploadingFiles(prev => prev.map(f => f.file === file ? { ...f, progress } : f));
        });

        const newAttachment: WorkOrderAttachment = {
          id: `att_${Date.now()}`,
          file_name: file.name,
          file_type: file.type,
          download_url: downloadURL,
          uploaded_at: new Date(),
          uploaded_by: user.id,
        };

        const updatedAttachments = [...existingAttachments, newAttachment];
        await updateWorkOrder(companyId, workOrderId, { attachments: updatedAttachments });

        toast({ title: 'Upload Successful', description: `${file.name} has been uploaded.` });
        onUploadComplete();
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
      }
    }
    setUploadingFiles([]);
  }, [user, companyId, workOrderId, existingAttachments, onUploadComplete, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <Card>
      <CardContent className="pt-6">
        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:bg-muted/50'}`}>
          <input {...getInputProps()} />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
          {isDragActive ? <p>Drop the files here ...</p> : <p>Drag 'n' drop some files here, or click to select files</p>}
        </div>
        
        {uploadingFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Uploading...</h4>
            {uploadingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <File className="h-5 w-5" />
                <span className="flex-grow truncate">{f.file.name}</span>
                <Progress value={f.progress} className="w-1/3" />
                <span>{Math.round(f.progress)}%</span>
              </div>
            ))}
          </div>
        )}

        {existingAttachments.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium">Uploaded Files</h4>
            {existingAttachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                <File className="h-5 w-5" />
                <a href={att.download_url} target="_blank" rel="noopener noreferrer" className="flex-grow truncate text-primary hover:underline">
                  {att.file_name}
                </a>
                {/* TODO: Add delete functionality */}
                <Button variant="ghost" size="icon" disabled><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
