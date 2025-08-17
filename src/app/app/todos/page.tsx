
'use client';

import * as React from 'react';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useTodos } from '@/hooks/useTodos'; // Import the custom hook
import { Loader2, PlusCircle, Trash2, ListTodo, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { hasPermission } from '@/lib/permissions'; // Import permission checker
import { useAuth } from '@/context/AuthContext'; // Import useAuth

export default function TodosPage() {
    const { todos, loading, error, addTodo, toggleTodo, deleteTodo, refetch } = useTodos();
    const [newTodoText, setNewTodoText] = useState('');
    const { user, loading: authLoading } = useAuth(); // Get user for permission check

    // Permission check
    const canManageTodos = !authLoading && hasPermission(user, 'todos', 'manage');
    const canViewTodos = !authLoading && hasPermission(user, 'todos', 'view');

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodoText.trim()) return;
        await addTodo(newTodoText);
        setNewTodoText(''); // Clear input after adding
    };

    if (authLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!canViewTodos) {
         return (
           <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 items-center justify-center">
             <Alert variant="destructive" className="m-4 max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view Todos.</AlertDescription>
              </Alert>
           </main>
        );
    }


    return (
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ListTodo className="h-6 w-6" /> My Tasks / Todos
                    </CardTitle>
                    <CardDescription>Keep track of your personal tasks and reminders.</CardDescription>
                </CardHeader>
                <CardContent>
                     {/* Add New Todo Form */}
                    {canManageTodos && (
                         <form onSubmit={handleAddTodo} className="flex items-center gap-2 mb-6">
                            <Input
                                type="text"
                                placeholder="Add a new task..."
                                value={newTodoText}
                                onChange={(e) => setNewTodoText(e.target.value)}
                                className="flex-1"
                                disabled={loading}
                            />
                            <Button type="submit" disabled={loading || !newTodoText.trim()}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Task
                            </Button>
                        </form>
                    )}

                     {/* Error Display */}
                     {error && (
                         <Alert variant="destructive" className="mb-4">
                           <AlertCircle className="h-4 w-4" />
                           <AlertTitle>Error</AlertTitle>
                           <AlertDescription>{error}</AlertDescription>
                         </Alert>
                     )}

                    {/* Todo List */}
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : todos.length === 0 ? (
                        <p className="text-center text-muted-foreground mt-4">No tasks yet. Add one above!</p>
                    ) : (
                        <ul className="space-y-3">
                            {todos.map(todo => (
                                <li key={todo.id} className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50 hover:bg-muted/80 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                         {canManageTodos && (
                                            <Checkbox
                                                id={`todo-${todo.id}`}
                                                checked={todo.completed}
                                                onCheckedChange={() => toggleTodo(todo.id)}
                                                aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                                            />
                                         )}
                                        <label
                                            htmlFor={`todo-${todo.id}`}
                                            className={`flex-1 min-w-0 break-words text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
                                        >
                                            {todo.text}
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                         <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(todo.created_at), { addSuffix: true })}
                                         </span>
                                         {canManageTodos && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => deleteTodo(todo.id)}
                                                title="Delete Task"
                                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                         )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                    You have {todos.filter(t => !t.completed).length} pending task(s).
                </CardFooter>
            </Card>
        </main>
    );
}
