'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Users, Eye, Play, Pause, Loader2 } from 'lucide-react'; // Added Loader2
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Company } from '@/types/company'; // Import the Company type

interface CompanyListProps {
    companies: Company[];
    onDelete: (companyId: string, companyName: string) => Promise<void>; // Make async
    onStatusChange: (companyId: string, currentStatus: 'active' | 'paused' | 'deleted') => Promise<void>; // Make async
}


export default function CompanyList({ companies, onDelete, onStatusChange }: CompanyListProps) {
   const { toast } = useToast();
   const router = useRouter(); // Initialize router
   const [loadingActionId, setLoadingActionId] = React.useState<string | null>(null); // Track loading state for actions

   const handleEditCompany = (companyId: string) => {
      console.log("Edit company:", companyId);
      router.push(`/platform/companies/${companyId}`);
   }

   const handleDeleteClick = async (companyId: string, companyName: string) => {
       setLoadingActionId(companyId); // Set loading state for this specific row/action
       await onDelete(companyId, companyName);
       setLoadingActionId(null); // Clear loading state
   }

   const handleStatusClick = async (companyId: string, currentStatus: 'active' | 'paused' | 'deleted') => {
       setLoadingActionId(companyId); // Set loading state
       await onStatusChange(companyId, currentStatus);
       setLoadingActionId(null); // Clear loading state
   }

    const handleViewDetails = (companyId: string) => {
      console.log("View details for:", companyId);
      router.push(`/platform/companies/${companyId}`);
   }

   const handleManageUsers = (companyId: string) => {
      console.log("Manage users for:", companyId);
      router.push(`/platform/companies/${companyId}/users`);
   }


  return (
    <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Status</TableHead>
               <TableHead>Subscription</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
             {companies.length === 0 && (
                 <TableRow>
                     <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                         No companies found.
                     </TableCell>
                 </TableRow>
             )}
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>
                  <Badge
                     variant={company.status === 'active' ? 'default' : company.status === 'paused' ? 'secondary' : 'destructive'}
                     className={`capitalize ${
                         company.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700' :
                         company.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700' :
                         company.status === 'deleted' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700 line-through' :
                         'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700' // Fallback/default
                     }`}
                  >
                    {company.status}
                  </Badge>
                </TableCell>
                 <TableCell>
                     <Badge variant="outline">{company.subscription_plan}</Badge>
                 </TableCell>
                <TableCell>{new Date(company.created_at instanceof Date ? company.created_at : company.created_at.toDate()).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewDetails(company.id)} title="View Company Details" disabled={loadingActionId === company.id}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View Details</span>
                    </Button>
                     <Button variant="ghost" size="icon" onClick={() => handleManageUsers(company.id)} title="Manage Company Users" disabled={loadingActionId === company.id}>
                        <Users className="h-4 w-4" />
                        <span className="sr-only">Manage Users</span>
                    </Button>
                  <Button variant="outline" size="icon" onClick={() => handleEditCompany(company.id)} title="Edit Company Settings" disabled={loadingActionId === company.id}>
                    <Edit className="h-4 w-4" />
                     <span className="sr-only">Edit Company</span>
                  </Button>
                  {company.status !== 'deleted' && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleStatusClick(company.id, company.status as 'active' | 'paused')}
                        title={company.status === 'active' ? 'Pause Company' : 'Activate Company'}
                         disabled={loadingActionId === company.id}
                      >
                         {loadingActionId === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (company.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />)}
                         <span className="sr-only">{company.status === 'active' ? 'Pause Company' : 'Activate Company'}</span>
                      </Button>
                   )}
                   <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="destructive" size="icon" title="Delete Company" disabled={company.status === 'deleted' || loadingActionId === company.id}>
                        {loadingActionId === company.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span className="sr-only">Delete Company</span>
                      </Button>
                     </AlertDialogTrigger>
                     <AlertDialogContent>
                       <AlertDialogHeader>
                         <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                         <AlertDialogDescription>
                           This will mark the company "{company.name}" as deleted. Associated data might be archived or eventually removed.
                         </AlertDialogDescription>
                       </AlertDialogHeader>
                       <AlertDialogFooter>
                         <AlertDialogCancel disabled={loadingActionId === company.id}>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => handleDeleteClick(company.id, company.name)}
                            disabled={loadingActionId === company.id}>
                            {loadingActionId === company.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                           Mark as Deleted
                         </AlertDialogAction>
                       </AlertDialogFooter>
                     </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
