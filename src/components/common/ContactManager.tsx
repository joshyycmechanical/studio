
'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PlusCircle, Edit, Trash2, Star, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/types/contact';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactManagerProps {
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
}

export default function ContactManager({ contacts, onContactsChange }: ContactManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', role: '', isPrimary: false },
  });

  const handleAddClick = () => {
    reset({ name: '', email: '', phone: '', role: '', isPrimary: !contacts.some(c => c.isPrimary) });
    setEditingContact(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (contact: Contact) => {
    reset(contact);
    setEditingContact(contact);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (contactId: string) => {
    const updatedContacts = contacts.filter(c => c.id !== contactId);
    onContactsChange(updatedContacts);
    toast({ title: 'Contact Removed', description: 'The contact has been removed from the list.' });
  };

  const onSubmit = (data: ContactFormData) => {
    let updatedContacts: Contact[];
    if (editingContact) {
      updatedContacts = contacts.map(c => c.id === editingContact.id ? { ...editingContact, ...data } : c);
      toast({ title: 'Contact Updated', description: 'The contact has been successfully updated.' });
    } else {
      const newContact = { id: Date.now().toString(), ...data, createdAt: new Date(), updatedAt: new Date(), customerId: '' };
      updatedContacts = [...contacts, newContact as any];
      toast({ title: 'Contact Added', description: 'The contact has been added to the list.' });
    }

    if (data.isPrimary) {
      updatedContacts = updatedContacts.map(c => ({...c, isPrimary: c.id === (editingContact?.id ?? updatedContacts[updatedContacts.length-1].id)}));
    }
    
    onContactsChange(updatedContacts);
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><User /> Contacts</CardTitle>
        <Button type="button" onClick={handleAddClick} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Contact</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Primary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map(contact => (
              <TableRow key={contact.id}>
                <TableCell>{contact.name}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>{contact.role}</TableCell>
                <TableCell>{contact.isPrimary && <Star className="h-5 w-5 text-yellow-500" />}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleEditClick(contact)}><Edit className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteClick(contact.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {contacts.length === 0 && <p className="text-center text-muted-foreground mt-4">No contacts added yet.</p>}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update the details of the contact.' : 'Fill in the details to add a new contact.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Controller name="name" control={control} render={({ field }) => <Input id="name" {...field} />} />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" {...field} value={field.value ?? ''} />} />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Controller name="phone" control={control} render={({ field }) => <Input id="phone" {...field} value={field.value ?? ''} />} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Controller name="role" control={control} render={({ field }) => <Input id="role" {...field} value={field.value ?? ''} />} />
              </div>
              <div className="flex items-center space-x-2">
                <Controller name="isPrimary" control={control} render={({ field }) => <Switch id="isPrimary" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="isPrimary">Set as primary contact</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
