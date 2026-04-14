import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Bot, User, Trash2, Copy, Check, Plus, MessageSquare, Menu, X, Settings, Download, Mic, MicOff } from 'lucide-react';
import { fetchChatCompletionStream } from '../api';
import { useChatSessions } from '../hooks/useChatSessions';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-md hover:bg-gray-700/50"
      title="复制代码"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

const MessageCopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute -bottom-6 right-0 p-1 text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs"
      title="复制内容"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? '已复制' : '复制'}
    </button>
  );
};

export function ChatInterface() {
  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    updateSessionSystemPrompt,
    addMessage,
    updateLastMessage,
    replaceLastMessage,
  } = useChatSessions();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemPromptInput, setSystemPromptInput] = useState('');
  const [interimSpeech, setInterimSpeech] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition(
    useCallback((text: string, isFinal: boolean) => {
      if (isFinal) {
        setInput(prev => prev + text + ' ');
        setInterimSpeech('');
      } else {
        setInterimSpeech(text);
      }
    }, [])
  );

  const messages = activeSession?.messages || [];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    addMessage(activeSessionId, userMessage);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const placeholderMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
    };
    addMessage(activeSessionId, placeholderMessage);

    try {
      let historyToApi = [...messages, userMessage];
      
      // Inject system prompt if present
      if (activeSession?.systemPrompt) {
        historyToApi = [
          { id: 'system', role: 'system', content: activeSession.systemPrompt, timestamp: 0 },
          ...historyToApi
        ];
      }

      await fetchChatCompletionStream(historyToApi, (chunk) => {
        updateLastMessage(activeSessionId, chunk);
      });
    } catch (error) {
      console.error(error);
      replaceLastMessage(activeSessionId, '\n\n**[Error: Failed to get response. Please check your API Key and network.]**');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    if (activeSessionId && window.confirm('确定要删除此会话吗？')) {
      deleteSession(activeSessionId);
    }
  };

  const openSettings = () => {
    if (activeSession) {
      setSystemPromptInput(activeSession.systemPrompt || '');
      setIsSettingsOpen(true);
    }
  };

  const saveSettings = () => {
    if (activeSessionId) {
      updateSessionSystemPrompt(activeSessionId, systemPromptInput.trim());
      setIsSettingsOpen(false);
    }
  };

  const exportChat = () => {
    if (!activeSession) return;
    
    let markdown = `# ${activeSession.title}\n\n`;
    if (activeSession.systemPrompt) {
      markdown += `> **System Prompt:** ${activeSession.systemPrompt}\n\n---\n\n`;
    }
    
    activeSession.messages.forEach(msg => {
      const role = msg.role === 'user' ? '🧑 **User**' : '🤖 **AI**';
      const time = new Date(msg.timestamp).toLocaleString();
      markdown += `### ${role} \n_${time}_\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${activeSession.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30
        w-72 bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            会话列表
          </h2>
          <button 
            className="md:hidden p-1 text-gray-500 hover:bg-gray-200 rounded"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-3">
          <button
            onClick={() => createNewSession()}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-500 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => {
                setActiveSessionId(session.id);
                setIsSidebarOpen(false);
              }}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === session.id 
                  ? 'bg-blue-50 border border-blue-200 text-blue-700' 
                  : 'hover:bg-gray-100 text-gray-700 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare className={`w-4 h-4 shrink-0 ${activeSessionId === session.id ? 'text-blue-500' : 'text-gray-400'}`} />
                <span className="truncate text-sm font-medium">{session.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('确定要删除此会话吗？')) {
                    deleteSession(session.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        {/* Bottom Sidebar Settings */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button 
            onClick={openSettings}
            disabled={!activeSessionId}
            className="text-gray-500 hover:text-gray-800 p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            title="设置角色扮演(System Prompt)"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={exportChat}
            disabled={!activeSessionId || messages.length === 0}
            className="text-gray-500 hover:text-gray-800 p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            title="导出对话记录为 Markdown"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-gray-50/50 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-gray-200 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md shrink-0">
              <Bot className="text-white w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight truncate">
                {activeSession?.title || 'AI 智能助手'}
              </h1>
              <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
                Online (Zhipu GLM-4)
              </p>
            </div>
          </div>
          <button
            onClick={clearHistory}
            disabled={messages.length === 0 || isLoading}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="删除当前会话"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#f5f5f5]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
              <Bot className="w-16 h-16 text-gray-300" />
              <p className="text-sm">很高兴见到你！有什么我可以帮忙的吗？</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={msg.id || msg.timestamp + idx}
                className={`flex gap-4 group mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="shrink-0">
                  {msg.role === 'user' ? (
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
                      <User className="text-white w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                      <Bot className="text-white w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-green-500 text-white rounded-tr-none'
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  }`}
                >
                  {/* Arrow */}
                  <div
                    className={`absolute top-0 w-3 h-4 ${
                      msg.role === 'user'
                        ? '-right-2 bg-green-500 clip-arrow-right'
                        : '-left-2 bg-white clip-arrow-left border-t border-l border-gray-100'
                    }`}
                    style={{
                      clipPath: msg.role === 'user' ? 'polygon(0 0, 0 100%, 100% 0)' : 'polygon(100% 0, 100% 100%, 0 0)',
                    }}
                  />

                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:bg-gray-800 prose-pre:p-0 prose-pre:rounded-lg break-words overflow-x-auto">
                      {msg.content === '' && isLoading ? (
                        <span className="flex items-center h-5 gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                        </span>
                      ) : (
                        <>
                          <ReactMarkdown
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                return !inline && match ? (
                                  <div className="relative group/code rounded-lg overflow-hidden my-2">
                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 text-xs font-sans">
                                      <span>{match[1]}</span>
                                      <CopyButton text={codeString} />
                                    </div>
                                    <SyntaxHighlighter
                                      {...props}
                                      children={codeString}
                                      style={vscDarkPlus}
                                      language={match[1]}
                                      PreTag="div"
                                      className="!m-0 text-sm"
                                      customStyle={{ margin: 0, borderRadius: '0 0 0.5rem 0.5rem' }}
                                    />
                                  </div>
                                ) : (
                                  <code {...props} className={`${className} bg-gray-100 text-red-500 px-1.5 py-0.5 rounded text-sm font-mono`}>
                                    {children}
                                  </code>
                                );
                              },
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.role === 'assistant' && !isLoading && (
                            <MessageCopyButton text={msg.content} />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#f5f5f5] p-4 shrink-0 border-t border-gray-200">
          <div className="max-w-4xl mx-auto relative">
            {isListening && (
              <div className="absolute -top-10 left-0 right-0 flex items-center justify-center">
                <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-md animate-pulse">
                  <Mic className="w-3 h-3" />
                  正在聆听... {interimSpeech}
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 sm:gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
              {isSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading || !activeSessionId}
                  className={`mb-1 shrink-0 p-3 rounded-lg transition-colors shadow-sm flex items-center justify-center ${
                    isListening 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100'
                  }`}
                  title={isListening ? '停止录音' : '语音输入'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? "思考中..." : "输入你想问的问题... (Enter 发送，Shift+Enter 换行)"}
                disabled={isLoading || !activeSessionId}
                className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none py-2 px-1 sm:px-3 text-gray-700 disabled:opacity-50 disabled:bg-gray-50"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !activeSessionId}
                className="mb-1 shrink-0 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-xs text-gray-400">
            AI 内容由智谱大模型提供，请勿输入隐私信息
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">会话设置 (角色扮演)</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                System Prompt (系统提示词)
              </label>
              <p className="text-xs text-gray-500 mb-4">
                你可以通过设置系统提示词来让 AI 扮演特定角色（例如：你是一个精通 React 的资深前端工程师...）。这会影响当前会话中 AI 的回答风格。
              </p>
              <textarea
                value={systemPromptInput}
                onChange={(e) => setSystemPromptInput(e.target.value)}
                placeholder="例如：你是一个专业的心理咨询师，请用温柔耐心的语气回答问题..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-sm text-gray-700"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}