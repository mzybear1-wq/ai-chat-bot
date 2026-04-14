import { useState, useEffect, useCallback } from 'react';
import { ChatSession, Message } from '../types';

const STORAGE_KEY = 'ai_chat_sessions';

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          // Auto select first session if none selected
          setActiveSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) {
        console.error('Failed to parse sessions', e);
        createNewSession();
      }
    } else {
      // Migrate old chatHistory if exists
      const oldHistory = localStorage.getItem('chatHistory');
      if (oldHistory) {
        try {
          const parsed = JSON.parse(oldHistory);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const migratedSession: ChatSession = {
              id: Date.now().toString(),
              title: '旧对话记录',
              messages: parsed,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            setSessions([migratedSession]);
            setActiveSessionId(migratedSession.id);
            localStorage.removeItem('chatHistory'); // Clean up old
            return;
          }
        } catch (e) {}
      }
      createNewSession();
    }
  }, []);

  // Save to local storage whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  const createNewSession = useCallback((systemPrompt?: string) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      systemPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        // If all deleted, create a new one
        setTimeout(() => createNewSession(), 0);
        return [];
      }
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeSessionId, createNewSession]);

  const updateSessionTitle = useCallback((id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title, updatedAt: Date.now() } : s));
  }, []);

  const updateSessionSystemPrompt = useCallback((id: string, systemPrompt: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, systemPrompt, updatedAt: Date.now() } : s));
  }, []);

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        // Auto generate title based on first user message
        let newTitle = s.title;
        if (s.messages.length === 0 && message.role === 'user') {
          newTitle = message.content.slice(0, 15) + (message.content.length > 15 ? '...' : '');
        }
        return {
          ...s,
          title: newTitle,
          messages: [...s.messages, message],
          updatedAt: Date.now()
        };
      }
      return s;
    }));
  }, []);

  const updateLastMessage = useCallback((sessionId: string, chunk: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newMessages = [...s.messages];
        const lastMsgIndex = newMessages.length - 1;
        if (lastMsgIndex >= 0) {
          newMessages[lastMsgIndex] = {
            ...newMessages[lastMsgIndex],
            content: newMessages[lastMsgIndex].content + chunk,
          };
        }
        return { ...s, messages: newMessages, updatedAt: Date.now() };
      }
      return s;
    }));
  }, []);

  const replaceLastMessage = useCallback((sessionId: string, content: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const newMessages = [...s.messages];
        const lastMsgIndex = newMessages.length - 1;
        if (lastMsgIndex >= 0) {
          newMessages[lastMsgIndex] = {
            ...newMessages[lastMsgIndex],
            content,
          };
        }
        return { ...s, messages: newMessages, updatedAt: Date.now() };
      }
      return s;
    }));
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    updateSessionSystemPrompt,
    addMessage,
    updateLastMessage,
    replaceLastMessage,
  };
}