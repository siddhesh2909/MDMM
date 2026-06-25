'use client';

import React, { useState, useEffect } from 'react';
import { 
    FileText, Download, Calendar, Clock, Database, Sparkles, Shield, AlertTriangle
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { Button } from '@/components/ui/Button';

interface OwnerInfo {
    id: string;
    name: string;
    email: string;
}

interface SharedReport {
    id: string;
    name: string;
    datasetName: string;
    format: string;
    size: string;
    content: string;
    version: number;
    createdAt: string;
    owner: OwnerInfo;
}

const MarkdownRenderer = ({ content }: { content: string }) => {
    if (!content) return null;
    
    const blocks = content.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];
    
    const flushList = (key: string) => {
        if (listItems.length > 0) {
            elements.push(
                <ul key={`ul-${key}`} style={{ margin: '0.5rem 0 1rem 1.25rem', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {listItems}
                </ul>
            );
            listItems = [];
        }
        inList = false;
    };
    
    const flushTable = (key: string) => {
        if (tableHeaders.length > 0 || tableRows.length > 0) {
            elements.push(
                <div key={`table-wrapper-${key}`} style={{ overflowX: 'auto', margin: '1rem 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                                {tableHeaders.map((h, i) => (
                                    <th key={i} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>{formatInline(h)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.map((row, idx) => (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'var(--bg-color)' : 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                    {row.map((cell, i) => (
                                        <td key={i} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>{formatInline(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            tableHeaders = [];
            tableRows = [];
        }
        inTable = false;
    };
    
    const formatInline = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
        return parts.map((part, idx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={idx} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={idx} style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.92em', color: '#e01e5a' }}>{part.slice(1, -1)}</code>;
            }
            return part;
        });
    };
    
    for (let i = 0; i < blocks.length; i++) {
        const line = blocks[i].trim();
        const key = `${i}`;
        
        if (line.startsWith('|')) {
            if (inList) flushList(key);
            inTable = true;
            const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.every(c => c.match(/^:?-+:?$/))) {
                continue;
            }
            if (tableHeaders.length === 0) {
                tableHeaders = cells;
            } else {
                tableRows.push(cells);
            }
            continue;
        } else if (inTable) {
            flushTable(key);
        }
        
        if (line.startsWith('- ') || line.startsWith('* ')) {
            if (inTable) flushTable(key);
            inList = true;
            listItems.push(
                <li key={`li-${i}`} style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>
                    {formatInline(line.substring(2))}
                </li>
            );
            continue;
        } else if (inList && !line.startsWith('- ') && !line.startsWith('* ')) {
            flushList(key);
        }
        
        if (line.startsWith('# ')) {
            elements.push(<h1 key={key} style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '1.25rem 0 0.5rem 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>{formatInline(line.substring(2))}</h1>);
        } else if (line.startsWith('## ')) {
            elements.push(<h2 key={key} style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '1.1rem 0 0.4rem 0' }}>{formatInline(line.substring(3))}</h2>);
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={key} style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.95rem 0 0.3rem 0' }}>{formatInline(line.substring(4))}</h3>);
        } else if (line === '') {
            elements.push(<div key={key} style={{ height: '0.5rem' }} />);
        } else {
            elements.push(<p key={key} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 0.5rem 0' }}>{formatInline(line)}</p>);
        }
    }
    
    if (inList) flushList('end');
    if (inTable) flushTable('end');
    
    return <div style={{ fontFamily: 'inherit' }}>{elements}</div>;
};

export default function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = React.use(params);
    const [report, setReport] = useState<SharedReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchReport();
        }
    }, [token]);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiClient.get(`/data/shared/reports/${token}`);
            if (data && !data.error) {
                setReport(data);
            } else {
                setError(data?.error || 'Report not found.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load shared report.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadFormat = (format: string) => {
        if (!report) return;
        const link = document.createElement('a');
        link.href = `/api/data/shared/reports/${token}/export?format=${format}`;
        link.download = `${report.name.toLowerCase().replace(/ /g, '_')}_export.${format === 'EXCEL' ? 'xlsx' : format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading secure report...</span>
                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-color)', padding: '2rem' }}>
                <div style={{ maxWidth: '440px', width: '100%', padding: '2.5rem', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ display: 'inline-flex', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '50%', color: 'var(--danger-color)', marginBottom: '1.25rem' }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Access Denied or Link Expired</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                        {error || 'This report may have been deleted, or the share configuration has been revoked by the owner.'}
                    </p>
                    <a href="/reports" style={{ textDecoration: 'none' }}>
                        <Button variant="primary">Return to Dashboard</Button>
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Top Sleek Header */}
            <header style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ padding: '0.45rem', backgroundColor: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', color: '#6366f1', display: 'flex' }}>
                        <Shield size={18} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>CollabAI Secure View</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Sparkles size={13} color="#6366f1" />
                    <span>Read-Only Governance Copy</span>
                </div>
            </header>

            {/* Central Report Container */}
            <main style={{ flex: 1, padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: '820px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Metadata Header Card */}
                    <div style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                            <div>
                                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{report.name}</h1>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <Database size={13} />
                                        <span>Source: <strong>{report.datasetName}</strong></span>
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--border-color)' }}>|</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <Calendar size={13} />
                                        <span>Created: {new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--border-color)' }}>|</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        <Clock size={13} />
                                        <span>Size: {report.size}</span>
                                    </span>
                                </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', flexShrink: 0 }}>
                                Version {report.version}.0
                            </span>
                        </div>

                        {/* Owner Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compiled by Report Owner:</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.1rem' }}>{report.owner.name} ({report.owner.email})</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Authorized Publisher</span>
                        </div>

                        {/* Export/Download Actions */}
                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.4rem' }}>Export Options:</span>
                            <Button 
                                variant="outline" 
                                style={{ fontSize: '0.75rem', height: '32px', borderRadius: '6px', padding: '0 0.75rem' }} 
                                onClick={() => handleDownloadFormat('PDF')}
                                icon={<Download size={13} />}
                            >
                                PDF File
                            </Button>
                            <Button 
                                variant="outline" 
                                style={{ fontSize: '0.75rem', height: '32px', borderRadius: '6px', padding: '0 0.75rem' }} 
                                onClick={() => handleDownloadFormat('EXCEL')}
                                icon={<Download size={13} />}
                            >
                                Excel Sheet
                            </Button>
                            <Button 
                                variant="outline" 
                                style={{ fontSize: '0.75rem', height: '32px', borderRadius: '6px', padding: '0 0.75rem' }} 
                                onClick={() => handleDownloadFormat('CSV')}
                                icon={<Download size={13} />}
                            >
                                CSV File
                            </Button>
                            <Button 
                                variant="outline" 
                                style={{ fontSize: '0.75rem', height: '32px', borderRadius: '6px', padding: '0 0.75rem' }} 
                                onClick={() => handleDownloadFormat('JSON')}
                                icon={<Download size={13} />}
                            >
                                JSON Schema
                            </Button>
                        </div>
                    </div>

                    {/* Report Content Body Card */}
                    <div style={{ padding: '2.5rem', border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
                        <div style={{ color: 'var(--text-primary)' }}>
                            <MarkdownRenderer content={report.content} />
                        </div>
                    </div>

                </div>
            </main>

            {/* Footer */}
            <footer style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', padding: '1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>Secure report compilation provided by CollabAI Governance and Contract Management System.</span>
            </footer>
        </div>
    );
}
