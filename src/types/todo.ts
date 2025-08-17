
import type { Timestamp } from 'firebase/firestore';

/**
 * Represents a single TODO item.
 */
export interface Todo {
  id: string; // Unique identifier
  text: string; // The content of the todo
  completed: boolean; // Whether the todo is marked as done
  created_at: Timestamp | Date; // When the todo was created
  company_id: string; // Company this todo belongs to
  user_id: string; // User who created/owns this todo
}
