import { db } from './firebase-service.js';

/**
 * Adds a new session to the "session" collection.
 * @param sessionName - The name or title of the session
 * @param joinUrl - The URL used to join the session
 * @returns The auto-generated ID of the new session document
 */
export async function addSession(sessionName: string, joinUrl: string) {
  try {
    // Add to session collection
    const docRef = await db.collection('session').add({
      sessionName: sessionName,
      joinUrl: joinUrl,
      createdAt: new Date() // Optional: Good practice to track creation time
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding session:', error);
    throw error;
  }
}