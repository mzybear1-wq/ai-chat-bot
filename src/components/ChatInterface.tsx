import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Bot, User, Trash2, Copy, Check } from 'lucide-react';
import { fetchChatCompletionStream } from '../api';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history from LocalStorage ONLY ONCE on mount
  useEffect(() => {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
  }, []);

  // Save to LocalStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages));
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Prepare a placeholder for the assistant's response
    const assistantMessageId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: assistantMessageId },
    ]);

    try {
      // Send entire conversation history (excluding the current empty placeholder)
      const historyToApi = [...messages, userMessage];

      await fetchChatCompletionStream(historyToApi, (chunk) => {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMsgIndex = newMessages.length - 1;
          if (newMessages[lastMsgIndex].role === 'assistant') {
            // Append the incoming chunk to the assistant's message content.
            // IMPORTANT: Create a new object rather than mutating the old one,
            // to avoid double text issues caused by React Strict Mode running updaters twice.
            newMessages[lastMsgIndex] = {
              ...newMessages[lastMsgIndex],
              content: newMessages[lastMsgIndex].content + chunk,
            };
          }
          return newMessages;
        });
      });
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMsgIndex = newMessages.length - 1;
        newMessages[lastMsgIndex] = {
          ...newMessages[lastMsgIndex],
          content: newMessages[lastMsgIndex].content + '\n\n**[Error: Failed to get response. Please check your API Key and network.]**',
        };
        return newMessages;
      });
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
    if (window.confirm('确定要清空所有聊天记录吗？')) {
      setMessages([]);
      localStorage.removeItem('chatHistory');
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-50/50 shadow-xl overflow-hidden sm:border-x sm:border-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
            <Bot className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">AI 智能助手</h1>
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
          title="清空聊天记录"
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
              key={msg.timestamp + idx}
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
                className={`relative max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
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
        <div className="flex items-end gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "思考中..." : "输入你想问的问题... (Enter 发送，Shift+Enter 换行)"}
            disabled={isLoading}
            className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none py-2 px-3 text-gray-700 disabled:opacity-50 disabled:bg-gray-50"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="mb-1 shrink-0 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center mt-2 text-xs text-gray-400">
          AI 内容由智谱大模型提供，请勿输入隐私信息
        </div>
      </div>
    </div>
  );
}