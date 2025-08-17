
'use client';

import * as React from 'react';
import { useState } from 'react';
import { extractPurchaseOrderDetails, ExtractPurchaseOrderDetailsOutput } from '@/ai/flows/extract-purchase-order-details';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PurchaseOrdersPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractPurchaseOrderDetailsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic validation (optional: add more specific checks like MIME type)
      if (file.size > 5 * 1024 * 1024) { // Example: 5MB limit
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please select a file smaller than 5MB.",
        });
        return;
      }
      setSelectedFile(file);
      setExtractedData(null); // Clear previous results
      setError(null); // Clear previous errors
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select a purchase order file to process.",
      });
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedData(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        if (!base64data) {
             throw new Error("Failed to read file.");
        }

        try {
            const result = await extractPurchaseOrderDetails({ purchaseOrderDataUri: base64data });
            setExtractedData(result);
             toast({
                title: "Processing Complete",
                description: "Purchase order details extracted successfully.",
            });
        } catch (aiError) {
             console.error('AI Processing Error:', aiError);
             setError('Failed to extract details from the purchase order. The AI model might not support this document type or encountered an issue.');
              toast({
                variant: "destructive",
                title: "Processing Failed",
                description: "Could not extract details from the document.",
            });
        } finally {
             setIsProcessing(false);
        }

      };
      reader.onerror = (error) => {
        console.error('File Reading Error:', error);
        setError('Failed to read the selected file.');
         toast({
            variant: "destructive",
            title: "File Read Error",
            description: "Could not read the selected file.",
         });
        setIsProcessing(false);
      };
    } catch (e) {
      console.error('Error setting up file reader:', e);
      setError('An unexpected error occurred.');
       toast({
            variant: "destructive",
            title: "Unexpected Error",
            description: "An unexpected error occurred during file processing setup.",
       });
      setIsProcessing(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Process Purchase Order</CardTitle>
          <CardDescription>Upload a purchase order document (image or PDF) to automatically extract line item details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="purchase-order-file">Purchase Order File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="purchase-order-file"
                type="file"
                accept="image/*,.pdf" // Accept images and PDFs
                onChange={handleFileChange}
                className="flex-1"
                aria-describedby="file-help"
              />
              <Button
                onClick={handleProcessFile}
                disabled={!selectedFile || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                {isProcessing ? 'Processing...' : 'Process'}
              </Button>
            </div>
             <p id="file-help" className="text-sm text-muted-foreground">
               Max file size: 5MB. Accepted formats: images, PDF.
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {extractedData && extractedData.lineItems && extractedData.lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Line Items</CardTitle>
            <CardDescription>The following line items were extracted from the document.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                   <TableHead className="text-right">Total Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedData.lineItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {item.unitPrice.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} {/* Format as currency */}
                    </TableCell>
                     <TableCell className="text-right">
                      {(item.quantity * item.unitPrice).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} {/* Calculate and Format total */}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter className="justify-end text-sm text-muted-foreground">
             <p>Total Items: {extractedData.lineItems.length}</p>
           </CardFooter>
        </Card>
      )}
       {extractedData && (!extractedData.lineItems || extractedData.lineItems.length === 0) && !isProcessing && (
         <Card>
            <CardHeader>
                <CardTitle>No Line Items Found</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">The AI could not detect any line items in the uploaded document.</p>
            </CardContent>
         </Card>
        )}
    </main>
  );
}
