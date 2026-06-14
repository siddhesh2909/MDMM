'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/providers/ToastProvider';
import { 
    Sparkles, Send, Loader2, Landmark, TrendingUp, DollarSign, ShieldCheck,
    HelpCircle, ChevronRight, BarChart3, AlertCircle, ArrowUpRight, TrendingDown
} from 'lucide-react';

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
}

interface QuestionPreset {
    label: string;
    query: string;
    description: string;
}

export default function AIBusinessAssistantPage() {
    const { showToast } = useToast();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'bot', text: '👋 Hello! I am your **Business Intelligence Copilot**. I can help you monitor corporate performance, interpret KPIs, explain monthly performance trends, or recommend strategic growth actions. Choose a question preset below or type a query to get started!' }
    ]);
    const [inputVal, setInputVal] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const kpis = [
        { title: 'Total Revenue', value: '$24.58M', change: '+18.6%', sub: 'vs last year', isUp: true },
        { title: 'Gross Profit', value: '$9.83M', change: '+21.3%', sub: 'vs last year', isUp: true },
        { title: 'Active Buyers', value: '14.2K', change: '+12.7%', sub: 'vs last month', isUp: true },
        { title: 'Quality Index', value: '96.2%', change: '-0.4%', sub: 'vs last week', isUp: false }
    ];

    const presets: QuestionPreset[] = [
        { label: 'Sales Decrease', query: 'Why did sales decrease this month?', description: 'Investigate sales drops and volume reductions.' },
        { label: 'Top Region', query: 'Which region is performing best?', description: 'Locate geographical revenue drivers.' },
        { label: 'Top Products', query: 'Show top performing products.', description: 'List leading products and inventory indicators.' },
        { label: 'Observed Trends', query: 'What trends do you observe?', description: 'Summarize patterns in metrics and customer transactions.' },
        { label: 'KPIs Needing Attention', query: 'Which KPIs need attention?', description: 'Flag underperforming indicators.' },
        { label: 'Executive Summary', query: 'Generate executive summary.', description: 'Synthesize performance into an executive overview.' },
        { label: 'Recommend Actions', query: 'Recommend business actions.', description: 'Formulate strategic playbooks to drive metrics.' }
    ];

    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (providedText?: string) => {
        const textToUse = providedText || inputVal;
        if (!textToUse.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: textToUse };
        setMessages(prev => [...prev, userMsg]);
        setInputVal('');
        setIsThinking(true);

        try {
            // Context contains business KPIs for BI analysis
            const datasetContext = {
                type: 'business_kpis',
                kpis: kpis.map(k => ({ metricName: k.title, val: k.value, delta: k.change, isGrowth: k.isUp })),
                products: [
                    { name: 'Enterprise Cloud Ingestion Hub', sales: '$8.45M', share: '34%' },
                    { name: 'Visual Dashboard Studio Pro', sales: '$6.12M', share: '25%' },
                    { name: 'Schema Pipeline Connector Pack', sales: '$5.18M', share: '21%' }
                ],
                regions: [
                    { name: 'North America', sales: '$13.52M', trend: 'increasing' },
                    { name: 'Europe', sales: '$8.60M', trend: 'flat' },
                    { name: 'Asia Pacific', sales: '$2.46M', trend: 'growth opportunity' }
                ],
                anomalies: [
                    { date: '2026-06-03', event: 'Unexpected revenue spike in North America (+140% deviation)', status: 'resolved' }
                ]
            };

            const res = await apiClient.post('/ai/chat', {
                message: textToUse,
                datasetContext
            });

            if (res?.reply) {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: res.reply }]);
            } else {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Failed to retrieve business insights. Check LLM configurations.' }]);
            }
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Connection timeout. Failed to query Business Intelligence Copilot.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '1.5rem' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem 2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={22} style={{ color: '#8b5cf6' }} />
                    Business Intelligence Copilot
                </h1>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.25rem 0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Landmark size={14} />
                    <span>Executive Advisory Portal</span>
                </div>
            </div>

            {/* Quick KPI Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {kpis.map((k, i) => (
                    <Card key={i}>
                        <CardContent style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{k.title}</span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: k.isUp ? '#10b981' : 'var(--danger-color)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                }}>
                                    {k.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {k.change}
                                </span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{k.sub}</span>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Split layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
                {/* Left Panel Presets */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                    <div style={{ padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Recommended Business Queries
                    </div>
                    {presets.map((preset, idx) => (
                        <Card key={idx} style={{ cursor: 'pointer' }} onClick={() => handleSend(preset.query)}>
                            <CardContent style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>{preset.label}</span>
                                    <ArrowUpRight size={14} style={{ color: '#8b5cf6' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    {preset.description}
                                </span>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Right Panel Chat Console */}
                <Card style={{ display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--border-color)' }}>
                    {/* Chat Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {messages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '75%',
                                    padding: '1.25rem 1.5rem',
                                    borderRadius: '12px',
                                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                                    backgroundColor: msg.sender === 'user' ? '#8b5cf6' : 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.92rem',
                                    lineHeight: '1.6',
                                    boxShadow: 'var(--shadow-sm)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {/* Markdown formatting simulation for chat responses */}
                                    {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                        part.startsWith('**') && part.endsWith('**')
                                            ? <strong key={j} style={{ color: msg.sender === 'user' ? '#fff' : '#c084fc' }}>{part.slice(2, -2)}</strong>
                                            : part.split(/(`[^`]+`)/g).map((sub, k) =>
                                                sub.startsWith('`') && sub.endsWith('`')
                                                    ? <code key={k} style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.85rem' }}>{sub.slice(1, -1)}</code>
                                                    : sub
                                            )
                                    )}
                                </div>
                            </div>
                        ))}

                        {isThinking && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{
                                    padding: '1.25rem 1.5rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--surface-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem'
                                }}>
                                    <Loader2 className="spinner" size={16} />
                                    <span>Business Copilot is compiling performance statistics...</span>
                                </div>
                            </div>
                        )}
                        <div ref={endOfMessagesRef} />
                    </div>

                    {/* Chat Input */}
                    <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Ask questions about region growth, performance drops, product metrics, or request executive summaries..."
                            value={inputVal}
                            onChange={e => setInputVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={isThinking}
                            style={{ flex: 1, height: '48px', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 1.25rem', backgroundColor: 'var(--card-bg)' }}
                        />
                        <Button
                            variant="primary"
                            onClick={() => handleSend()}
                            disabled={isThinking || !inputVal.trim()}
                            style={{ height: '48px', padding: '0 1.5rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }}
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
