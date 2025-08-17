
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';
import type { Message } from '@/types/chat';

// Send a new message to a chat room
export async function sendMessage(companyId: string, userId: string, text: string): Promise<void> {
    if (!companyId || !userId || !text.trim()) {
        throw new Error("Missing companyId, userId, or message text.");
    }
    try {
        await addDoc(collection(db, COLLECTIONS.CHATS), {
            companyId,
            userId,
            text,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error sending message:", error);
        throw new Error("Failed to send message.");
    }
}

// Listen for real-time updates to chat messages
export function onMessagesSnapshot(
    companyId: string,
    callback: (messages: Message[]) => void,
    messageLimit: number = 50
) {
    if (!companyId) {
        console.error("Company ID is required to listen for messages.");
        return () => {}; // Return an empty unsubscribe function
    }

    const q = query(
        collection(db, COLLECTIONS.CHATS),
        where("companyId", "==", companyId),
        orderBy("timestamp", "desc"),
        limit(messageLimit)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: Message[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                userId: data.userId,
                text: data.text,
                timestamp: data.timestamp?.toDate() ?? new Date(), // Handle null timestamps
            });
        });
        // Since we order by desc, we need to reverse to show oldest messages first
        callback(messages.reverse());
    }, (error) => {
        console.error("Error listening to messages:", error);
        // You might want to add more robust error handling here
    });

    return unsubscribe; // Return the unsubscribe function
}
