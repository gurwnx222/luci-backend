/**
 * Client utility to interact with chat backend API
 * This creates conversations in the chat system when bookings are accepted
 */

const CHAT_BACKEND_URL = process.env.CHAT_BACKEND_URL || "http://localhost:5001";

/**
 * Register or get user in chat system  
 */
export const registerChatUser = async (userData) => {
  try {
    const response = await fetch(`${CHAT_BACKEND_URL}/api/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error(`Failed to register chat user: ${response.statusText}`);
    }

    const result = await response.json();
    return result.user;
  } catch (error) {
    console.error("Error registering chat user:", error);
    throw error;
  }
};

/**
 * Create or get conversation between two users
 */
export const createOrGetConversation = async (userId1, userId2) => {
  try {
    const response = await fetch(`${CHAT_BACKEND_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId1, userId2 }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    const conversation = await response.json();
    return conversation;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
};

/**
 * Get user by Firebase UID or MongoDB ObjectId
 */
export const getChatUser = async (userId) => {
  try {
    const response = await fetch(`${CHAT_BACKEND_URL}/api/users/${userId}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null; // User doesn't exist
      }
      throw new Error(`Failed to get chat user: ${response.statusText}`);
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Error getting chat user:", error);
    return null;
  }
};

