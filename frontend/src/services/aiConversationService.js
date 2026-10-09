/**
 * aiConversationService — wraps AI conversation management endpoints.
 * Handles conversation CRUD operations and message management with user isolation.
 */
import { axiosClient, unwrap } from '../api/axiosClient';

const BASE = '/AIInterview/assistant';

export const aiConversationService = {
  /**
   * Get all conversations for the authenticated user.
   * GET /AIInterview/assistant/conversations
   * returns: Array of AIConversationDto
   */
  getConversations: () =>
    axiosClient.get(`${BASE}/conversations`).then(unwrap),

  /**
   * Create a new conversation.
   * POST /AIInterview/assistant/conversations
   * body: { title?, language, companyId? }
   * returns: AIConversationDto
   */
  createConversation: (data) =>
    axiosClient.post(`${BASE}/conversations`, data).then(unwrap),

  /**
   * Get a specific conversation by ID.
   * GET /AIInterview/assistant/conversations/{id}
   * returns: AIConversationDto
   */
  getConversation: (id) =>
    axiosClient.get(`${BASE}/conversations/${id}`).then(unwrap),

  /**
   * Get all messages in a conversation.
   * GET /AIInterview/assistant/conversations/{id}/messages
   * returns: Array of AIConversationMessageDto
   */
  getConversationMessages: (id) =>
    axiosClient.get(`${BASE}/conversations/${id}/messages`).then(unwrap),

  /**
   * Add a message to a conversation.
   * POST /AIInterview/assistant/conversations/{id}/messages
   * body: { role, content }
   * returns: AIConversationMessageDto
   */
  addMessage: (id, data) =>
    axiosClient.post(`${BASE}/conversations/${id}/messages`, data).then(unwrap),

  /**
   * Delete a conversation.
   * DELETE /AIInterview/assistant/conversations/{id}
   */
  deleteConversation: (id) =>
    axiosClient.delete(`${BASE}/conversations/${id}`).then(unwrap),

  /**
   * Update conversation title.
   * PUT /AIInterview/assistant/conversations/{id}
   * body: { conversationId, title }
   * returns: AIConversationDto
   */
  updateConversation: (id, data) =>
    axiosClient.put(`${BASE}/conversations/${id}`, data).then(unwrap),
};

export default aiConversationService;