
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Todo } from '@/types/todo';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/config'; // CLIENT-SIDE DB
import {
    collection,
    query,
    orderBy,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';

// --- Client-Side Firestore Functions ---

async function fetchTodosFromDB(userId: string): Promise<Todo[]> {
    if (!userId) return [];
    const todosCollection = collection(db, COLLECTIONS.USERS, userId, COLLECTIONS.TODOS);
    const q = query(todosCollection, orderBy('created_at', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        created_at: (doc.data().created_at as Timestamp)?.toDate() || new Date(),
    }) as Todo);
}

async function addTodoAPI(idToken: string, companyId: string, text: string): Promise<{ id: string }> {
    const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ companyId, text }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add todo.');
    }
    return response.json();
}

async function updateTodoInDB(userId: string, todoId: string, updates: Partial<Todo>): Promise<void> {
    const todoDocRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.TODOS, todoId);
    await updateDoc(todoDocRef, updates);
}

async function deleteTodoFromDB(userId: string, todoId: string): Promise<void> {
    const todoDocRef = doc(db, COLLECTIONS.USERS, userId, COLLECTIONS.TODOS, todoId);
    await deleteDoc(todoDocRef);
}


// --- React Hook ---
export const useTodos = (userId: string | null) => {
    const { firebaseUser, companyId } = useAuth();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTodos = useCallback(async () => {
        if (!userId) {
            setTodos([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fetchedTodos = await fetchTodosFromDB(userId);
            setTodos(fetchedTodos);
        } catch (err: any) {
            setError(err.message || "Failed to load todos.");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchTodos();
    }, [fetchTodos]);

    const addTodo = useCallback(async (text: string) => {
        if (!firebaseUser || !companyId || !text.trim()) return;
        setError(null);
        
        // Create a local, optimistic version of the todo
        const optimisticTodo: Todo = {
            id: `temp-${Date.now()}`, // Temporary ID
            text: text.trim(),
            completed: false,
            created_at: new Date(), // Use client-side time for optimistic update
            user_id: firebaseUser.uid,
            company_id: companyId,
        };

        setTodos(prev => [optimisticTodo, ...prev]);

        try {
            const idToken = await firebaseUser.getIdToken();
            const { id: newId } = await addTodoAPI(idToken, companyId, text.trim());
            
            // Update the temporary todo with the real ID from the server
            setTodos(prev => prev.map(t => t.id === optimisticTodo.id ? { ...t, id: newId } : t));

        } catch (err: any) {
            setError(err.message || "Failed to add todo.");
            // Revert the optimistic update on error
            setTodos(prev => prev.filter(t => t.id !== optimisticTodo.id));
        }
    }, [firebaseUser, companyId]);

    const toggleTodo = useCallback(async (id: string) => {
        if (!userId) return;
        const originalTodos = [...todos];
        const todo = originalTodos.find(t => t.id === id);
        if (!todo) return;

        setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        try {
            await updateTodoInDB(userId, id, { completed: !todo.completed });
        } catch (err: any) {
            setError(err.message || "Failed to update todo status.");
            setTodos(originalTodos);
        }
    }, [userId, todos]);

    const deleteTodo = useCallback(async (id: string) => {
        if (!userId) return;
        const originalTodos = [...todos];
        setTodos(prev => prev.filter(t => t.id !== id));
        try {
            await deleteTodoFromDB(userId, id);
        } catch (err: any) {
            setError(err.message || "Failed to delete todo.");
            setTodos(originalTodos);
        }
    }, [userId, todos]);

    return { todos, loading, error, addTodo, toggleTodo, deleteTodo, refetch: fetchTodos };
};
