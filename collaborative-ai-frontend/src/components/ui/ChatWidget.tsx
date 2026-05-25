'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import './ChatWidget.css';

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'bot', text: 'Hi there! I am your AI assistant. I can help you query datasets, build dashboards, or explore lineage. What can I do for you today?' }
    ]);
    const [inputVal, setInputVal] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = async (providedText?: string) => {
        const textToUse = providedText || inputVal;
        if (!textToUse.trim()) return;

        const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: textToUse };
        setMessages(prev => [...prev, userMessage]);
        setInputVal('');
        setIsThinking(true);

        try {
            const data = await apiClient.post('/ai/chat', { message: textToUse });

            if (data?.reply) {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: data.reply, sender: 'bot' }]);
            } else {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "I'm sorry, I'm having trouble connecting to my brain right now.", sender: 'bot' }]);
            }
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: "Connection error.", sender: 'bot' }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <>
            <button
                className="chat-widget-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle AI Assistant"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>

            {isOpen && (
                <div className="chat-widget-panel">
                    <div className="chat-header">
                        <div className="chat-title">
                            <Sparkles size={20} />
                            Collab AI Assistant
                        </div>
                        <button className="icon-btn" onClick={() => setIsOpen(false)}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="chat-body">
                        {messages.map(msg => (
                            <div key={msg.id} className={`chat-message ${msg.sender}`}>
                                {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                    part.startsWith('**') && part.endsWith('**')
                                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                                        : part.split(/(`[^`]+`)/g).map((sub, k) =>
                                            sub.startsWith('`') && sub.endsWith('`')
                                                ? <code key={k} style={{ backgroundColor: msg.sender === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--bg-color)', padding: '0 3px', borderRadius: '3px', fontSize: '0.72rem' }}>{sub.slice(1, -1)}</code>
                                                : sub
                                        )
                                )}
                            </div>
                        ))}

                        {isThinking && (
                            <div className="chat-message bot thinking">
                                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                            </div>
                        )}
                        <div ref={endOfMessagesRef} />
                    </div>

                    {messages.length < 3 && !isThinking && (
                        <div className="chat-suggestions">
                            <button onClick={() => handleSend("Show me the latest revenue trends")}>Show revenue trends</button>
                            <button onClick={() => handleSend("Are there any data anomalies?")}>Check for anomalies</button>
                            <button onClick={() => handleSend("Draft a new contract schema")}>Draft new schema</button>
                        </div>
                    )}

                    <div className="chat-input-area">
                        <input
                            type="text"
                            className="chat-input"
                            placeholder="Ask a question about your data..."
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            className="chat-send-btn"
                            onClick={() => handleSend()}
                            disabled={!inputVal.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
