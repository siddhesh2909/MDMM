'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/components/providers/ToastProvider';
import { 
    Sparkles, Send, Database, Loader2, Cpu, FileSpreadsheet, ShieldAlert,
    HelpCircle, ChevronRight, BarChart3, LineChart, Table, AlertCircle, Wand2
} from 'lucide-react';

interface DatasetMeta {
    id: string;
    name: string;
}

interface Message {
    id: string;
    sender: 'user' | 'bot';
    text: string;
}

interface Capability {
    name: string;
    prompt: string;
    icon: React.ReactNode;
}

export default function AIAssistantPage() {
    const { showToast } = useToast();
    const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
    const [selectedDsId, setSelectedDsId] = useState<string>('');
    const [dsDetail, setDsDetail] = useState<any>(null);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', sender: 'bot', text: '👋 Welcome to the **Advanced AI Data Analyst Copilot** studio. Select a dataset above, and use the technical capability filters on the left or type your query below to get technical insights!' }
    ]);
    const [inputVal, setInputVal] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const capabilities: Record<string, Capability[]> = {
        'Data Understanding': [
            { name: 'Describe Dataset', prompt: 'Summarize the dimensions, row count, fields, and basic domain metrics of the active dataset.', icon: <Database size={14} /> },
            { name: 'Explain Columns', prompt: 'List all column headers, clarify their data roles, and explain schema constraints.', icon: <Table size={14} /> },
            { name: 'Detect Data Types', prompt: 'Inspect all fields and verify if they are cast to proper semantic data types (e.g. String, Int, Date).', icon: <Cpu size={14} /> }
        ],
        'Data Quality': [
            { name: 'Detect Missing Values', prompt: 'Scan fields for missing values, null parameters, or empty indicators, and report rates.', icon: <AlertCircle size={14} /> },
            { name: 'Detect Duplicates', prompt: 'Inspect rows for duplication profiles or duplicate rows, and identify redundancies.', icon: <FileSpreadsheet size={14} /> },
            { name: 'Detect Anomalies', prompt: 'Run a 3-sigma statistical check on numeric values to isolate outlier anomalies.', icon: <ShieldAlert size={14} /> }
        ],
        'Preprocessing Suggestions': [
            { name: 'Imputation Suggestions', prompt: 'Recommend best statistical imputation strategies (mean, median, mode) for missing fields.', icon: <Wand2 size={14} /> },
            { name: 'Encoding & Standardizing', prompt: 'Suggest normalization, standardization, and category encoding strategies for training readiness.', icon: <Wand2 size={14} /> },
            { name: 'Feature Engineering', prompt: 'Recommend feature engineering enhancements or calculated columns based on schema.', icon: <Wand2 size={14} /> }
        ],
        'Visualization & Charts': [
            { name: 'Recommend Charts', prompt: 'Suggest suitable chart types (e.g. Area, Scatter, Line) based on metrics and dimensions.', icon: <BarChart3 size={14} /> },
            { name: 'Recommend KPIs', prompt: 'Suggest crucial executive KPI metrics and summary cards to capture transactional values.', icon: <LineChart size={14} /> }
        ]
    };

    useEffect(() => {
        if (endOfMessagesRef.current) {
            endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Load available datasets
    useEffect(() => {
        async function fetchDatasets() {
            try {
                const data = await apiClient.get('/data/datasets');
                if (data && data.length > 0) {
                    setDatasets(data.map((d: any) => ({ id: d.id, name: d.name })));
                    setSelectedDsId(data[0].id);
                } else {
                    // Fallback mock dataset if none ingest yet
                    setDatasets([{ id: 'products-50', name: 'products-50.csv' }]);
                    setSelectedDsId('products-50');
                }
            } catch (err) {
                console.error('Failed to fetch datasets:', err);
                setDatasets([{ id: 'products-50', name: 'products-50.csv' }]);
                setSelectedDsId('products-50');
            }
        }
        fetchDatasets();
    }, []);

    // Load dataset detail context
    useEffect(() => {
        if (!selectedDsId) return;

        async function fetchDetail() {
            setLoadingDetail(true);
            try {
                if (selectedDsId === 'products-50') {
                    setDsDetail({
                        name: 'products-50.csv',
                        rows: 50,
                        columns: ['id', 'user_id', 'name', 'age', 'gender', 'email', 'signup_date', 'country', 'total_spent', 'device'],
                        quality: 96
                    });
                } else {
                    const res = await apiClient.get(`/data/datasets/${selectedDsId}`);
                    if (res?.success && res?.data) {
                        setDsDetail({
                            name: res.data.dataset.name,
                            rows: res.data.dataset.rows,
                            columns: res.data.preview_columns || [],
                            quality: res.data.dataset.quality
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to get dataset details:', err);
            } finally {
                setLoadingDetail(false);
            }
        }
        fetchDetail();
    }, [selectedDsId]);

    const handleSend = async (providedText?: string) => {
        const textToUse = providedText || inputVal;
        if (!textToUse.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: textToUse };
        setMessages(prev => [...prev, userMsg]);
        setInputVal('');
        setIsThinking(true);

        try {
            // Include dynamic context about dataset schema/metadata
            const datasetContext = dsDetail ? {
                datasetId: selectedDsId,
                name: dsDetail.name,
                rows: dsDetail.rows,
                columns: dsDetail.columns,
                qualityScore: dsDetail.quality
            } : null;

            const res = await apiClient.post('/ai/chat', {
                message: textToUse,
                datasetContext,
                copilotType: 'analyst'
            });

            if (res?.reply) {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: res.reply }]);
            } else {
                setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Failed to retrieve AI analysis. Ensure the backend Groq service is configured.' }]);
            }
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: 'Connection timeout. Failed to query Data Analyst Copilot.' }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '1.5rem' }}>
            {/* Header select section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem 2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={22} style={{ color: 'var(--primary-color)' }} />
                        AI Data Analyst Copilot
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Target Dataset:</span>
                    <select
                        value={selectedDsId}
                        onChange={e => setSelectedDsId(e.target.value)}
                        style={{
                            padding: '0.5rem 2rem 0.5rem 1rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--surface-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                            fontWeight: 500
                        }}
                    >
                        {datasets.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Split layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
                {/* Left Panel Capabilities */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {Object.entries(capabilities).map(([category, items]) => (
                        <Card key={category}>
                            <CardHeader style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                {category}
                            </CardHeader>
                            <CardContent style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {items.map(item => (
                                    <button
                                        key={item.name}
                                        onClick={() => handleSend(item.prompt)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '6px',
                                            border: 'none',
                                            background: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            width: '100%',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem',
                                            transition: 'background-color 0.2s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ color: 'var(--primary-color)' }}>{item.icon}</span>
                                            <span>{item.name}</span>
                                        </div>
                                        <ChevronRight size={14} color="var(--text-secondary)" />
                                    </button>
                                ))}
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
                                    backgroundColor: msg.sender === 'user' ? 'var(--primary-color)' : 'var(--surface-color)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.92rem',
                                    lineHeight: '1.6',
                                    boxShadow: 'var(--shadow-sm)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {/* Markdown formatting simulation for chat responses */}
                                    {msg.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                        part.startsWith('**') && part.endsWith('**')
                                            ? <strong key={j} style={{ color: msg.sender === 'user' ? '#fff' : 'var(--primary-color)' }}>{part.slice(2, -2)}</strong>
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
                                    <span>Data Analyst Copilot is analyzing schema metrics...</span>
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
                            placeholder="Query schemas, ask for custom standardizations, or get code-level preprocessing recommendations..."
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
                            style={{ height: '48px', padding: '0 1.5rem' }}
                        >
                            <Send size={18} />
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
