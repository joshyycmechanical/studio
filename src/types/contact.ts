
import { Timestamp } from 'firebase/firestore';

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
