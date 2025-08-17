import { db } from './config';
import { collection, addDoc, Timestamp, doc } from 'firebase/firestore';

interface CompanyData {
  name: string;
  address?: string;
  contact_info?: any; // Consider defining a more specific type for contact_info
}

// Function to add a new company
export const addCompany = async (companyData: CompanyData): Promise<string> => {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized.");
  }
  try {
    const docRef = await addDoc(collection(db, 'companies'), {
      ...companyData,
      createdAt: Timestamp.now(), // Add a timestamp
    });
    console.log("Document written with ID: ", docRef.id);
    return docRef.id; // Return the new document ID
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e; // Re-throw the error for handling in the calling code
  }
};

export async function addUserToFirestore(userData: any) {
  if (!db) {
    throw new Error("Firebase Firestore is not initialized.");
  }
  try {
    const usersCollectionRef = collection(db, 'users');
    const docRef = await addDoc(usersCollectionRef, userData);
    console.log('User document written with ID:', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error adding user document:', e);
    throw e; // Re-throw the error for handling in the calling code
  }
}