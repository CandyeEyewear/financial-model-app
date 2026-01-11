/**
 * Chat History Service
 * Manages persistent AI chat history in Supabase
 */

import { supabase } from '../lib/supabase';

const TABLE_NAME = 'ai_chat_messages';
const MESSAGE_LIMIT = 50;

/**
 * Load chat history for a specific deal
 * @param {string} dealId - The deal/model identifier
 * @returns {Promise<Array>} - Array of message objects
 */
export async function loadChatHistory(dealId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user, cannot load chat history');
      return [];
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, role, content, tool_results, created_at')
      .eq('user_id', user.id)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: true })
      .limit(MESSAGE_LIMIT);

    if (error) {
      console.error('Error loading chat history:', error);
      return [];
    }

    // Transform to message format expected by ChatAssistant
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      toolResults: msg.tool_results,
      timestamp: msg.created_at
    }));

  } catch (error) {
    console.error('Error in loadChatHistory:', error);
    return [];
  }
}

/**
 * Save a single message to chat history
 * @param {string} dealId - The deal/model identifier
 * @param {object} message - Message object with role and content
 * @returns {Promise<object|null>} - Saved message or null on error
 */
export async function saveMessage(dealId, message) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user, cannot save message');
      return null;
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        user_id: user.id,
        deal_id: dealId,
        role: message.role,
        content: message.content,
        tool_results: message.toolResults || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving message:', error);
      return null;
    }

    return {
      id: data.id,
      role: data.role,
      content: data.content,
      toolResults: data.tool_results,
      timestamp: data.created_at
    };

  } catch (error) {
    console.error('Error in saveMessage:', error);
    return null;
  }
}

/**
 * Save multiple messages at once (for bulk operations)
 * @param {string} dealId - The deal/model identifier
 * @param {Array} messages - Array of message objects
 * @returns {Promise<boolean>} - Success status
 */
export async function saveMessages(dealId, messages) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user, cannot save messages');
      return false;
    }

    const messagesToInsert = messages.map(msg => ({
      user_id: user.id,
      deal_id: dealId,
      role: msg.role,
      content: msg.content,
      tool_results: msg.toolResults || null
    }));

    const { error } = await supabase
      .from(TABLE_NAME)
      .insert(messagesToInsert);

    if (error) {
      console.error('Error saving messages:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error in saveMessages:', error);
    return false;
  }
}

/**
 * Clear all chat history for a specific deal
 * @param {string} dealId - The deal/model identifier
 * @returns {Promise<boolean>} - Success status
 */
export async function clearChatHistory(dealId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user, cannot clear chat history');
      return false;
    }

    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('user_id', user.id)
      .eq('deal_id', dealId);

    if (error) {
      console.error('Error clearing chat history:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error in clearChatHistory:', error);
    return false;
  }
}

/**
 * Get message count for a deal
 * @param {string} dealId - The deal/model identifier
 * @returns {Promise<number>} - Message count
 */
export async function getMessageCount(dealId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return 0;

    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('deal_id', dealId);

    if (error) {
      console.error('Error getting message count:', error);
      return 0;
    }

    return count || 0;

  } catch (error) {
    console.error('Error in getMessageCount:', error);
    return 0;
  }
}

/**
 * Get list of deals with chat history for current user
 * @returns {Promise<Array>} - Array of deal IDs with message counts
 */
export async function getDealsWithHistory() {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('deal_id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error getting deals with history:', error);
      return [];
    }

    // Get unique deal IDs with counts
    const dealCounts = {};
    (data || []).forEach(row => {
      dealCounts[row.deal_id] = (dealCounts[row.deal_id] || 0) + 1;
    });

    return Object.entries(dealCounts).map(([dealId, count]) => ({
      dealId,
      messageCount: count
    }));

  } catch (error) {
    console.error('Error in getDealsWithHistory:', error);
    return [];
  }
}
