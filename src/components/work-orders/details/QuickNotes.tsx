
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Loader2, Edit } from "lucide-react";
import type { WorkOrderNote } from '@/types/work-order';
import { formatDistanceToNow, isValid } from 'date-fns';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/lib/permissions';

interface QuickNotesProps {
    publicNotes: WorkOrderNote[];
    internalNotes: WorkOrderNote[];
    onAddNote: (noteData: Omit<WorkOrderNote, 'id' | 'authorId' | 'authorName' | 'timestamp'>) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
    isSaving: boolean;
}

const NoteItem = ({ note, onEdit }: { note: WorkOrderNote; onEdit: () => void }) => {
    const { user } = useAuth();
    const canEdit = hasPermission(user, 'work-orders', 'edit') && note.authorId === user?.id;

    const date = note.timestamp instanceof Date ? note.timestamp : new Date(note.timestamp);
    const displayTime = isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'just now';

    return (
        <div className="p-3 bg-background rounded-md border text-sm group relative">
            <p className="whitespace-pre-wrap">{note.content}</p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <Badge variant={note.type === 'public' ? 'outline' : 'secondary'}>{note.type}</Badge>
                <p className="text-xs text-muted-foreground">
                    {note.authorName} - {displayTime}
                </p>
            </div>
             {canEdit && (
                <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onEdit}
                >
                    <Edit className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
};

export function QuickNotes({ publicNotes, internalNotes, onAddNote, onUpdateNote, onDeleteNote, isSaving }: QuickNotesProps) {
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingNote, setEditingNote] = React.useState<WorkOrderNote | null>(null);
    const [noteContent, setNoteContent] = React.useState('');
    const [noteType, setNoteType] = React.useState<'public' | 'internal'>('internal');
    const { user } = useAuth();
    const canAddNote = hasPermission(user, 'work-orders', 'edit');


    const allNotes = React.useMemo(() => 
        [...(publicNotes || []), ...(internalNotes || [])].sort((a, b) => {
            const dateA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const dateB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return dateB - dateA;
        }),
    [publicNotes, internalNotes]);

    const handleOpenDialog = (note: WorkOrderNote | null = null) => {
        if (note) {
            setEditingNote(note);
            setNoteContent(note.content);
            setNoteType(note.type);
        } else {
            setEditingNote(null);
            setNoteContent('');
            setNoteType('internal');
        }
        setDialogOpen(true);
    };

    const handleSaveNote = () => {
        if (!noteContent.trim()) return;
        if (editingNote) {
            onUpdateNote(editingNote.id, noteContent);
        } else {
            onAddNote({ content: noteContent, type: noteType });
        }
    };
    
    // Close dialog on successful save
    React.useEffect(() => {
        if (!isSaving) {
            setDialogOpen(false);
        }
    }, [isSaving]);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Notes & Activity</CardTitle>
                    {canAddNote && (
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Note
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {allNotes.length > 0 ? (
                        <ScrollArea className="h-72">
                            <div className="space-y-4 pr-4">
                                {allNotes.map((note, index) => <NoteItem key={note.id || `note-${index}`} note={note} onEdit={() => handleOpenDialog(note)}/>)}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No notes have been added.</p>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingNote ? 'Edit Note' : 'Add New Note'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Textarea
                            placeholder="Type your note here..."
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            rows={5}
                        />
                        {!editingNote && (
                            <RadioGroup value={noteType} onValueChange={(value: 'public' | 'internal') => setNoteType(value)}>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="internal" id="type-internal" />
                                    <Label htmlFor="type-internal">Internal Note (Team only)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="public" id="type-public" />
                                    <Label htmlFor="type-public">Public Note (Visible to customer)</Label>
                                </div>
                            </RadioGroup>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSaveNote} disabled={isSaving || !noteContent.trim()}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {editingNote ? 'Save Changes' : 'Save Note'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
