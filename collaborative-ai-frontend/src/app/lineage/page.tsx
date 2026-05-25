'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Box, Database, FileSpreadsheet, Network, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

// Lineage Graph visualization simulation using pure CSS layout

export default function LineagePage() {
    const [activePath, setActivePath] = useState<'source' | 'transform' | 'target'>('target');
    const [contracts, setContracts] = useState<any[]>([]);
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLineageData() {
            try {
                const [cData, wData] = await Promise.all([
                    apiClient.get('/data/contracts'),
                    apiClient.get('/data/workflows')
                ]);
                setContracts(cData || []);
                setWorkflows(wData || []);
            } catch (err) {
                console.error("Lineage fetch error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadLineageData();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <div className="spinner" style={{ width: 40, height: 40, border: '3px solid var(--primary-color)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Data Lineage</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Interactive visualization of data flow provenance derived from real contracts and workflows.</p>
            </div>

            <Card style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-color)' }}>

                {/* Placeholder graph container */}
                <div style={{ position: 'absolute', inset: 0, padding: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>

                    {/* Layer 1: Sources (Derived from Contracts) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', zIndex: 2 }}>
                        {contracts.slice(0, 2).map((c, i) => (
                            <LineageNode
                                key={c.id}
                                onClick={() => setActivePath('source')}
                                icon={i === 0 ? <Database size={24} /> : <FileSpreadsheet size={24} />}
                                title={c.name}
                                subtitle={c.domain}
                                active={activePath === 'source'}
                            />
                        ))}
                        {contracts.length === 0 && (
                            <LineageNode icon={<Database size={24} />} title="No Sources Found" subtitle="Create a contract first" active={activePath === 'source'} />
                        )}
                    </div>

                    <ArrowRight size={32} color={activePath === 'source' ? "var(--primary-color)" : "var(--border-color)"} style={{ transition: 'color 0.3s' }} />

                    {/* Layer 2: Transformation / Ingestion (Derived from Workflows) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', zIndex: 2 }}>
                        {workflows.slice(0, 2).map((w, i) => (
                            <LineageNode
                                key={w.id}
                                onClick={() => setActivePath('transform')}
                                icon={i === 0 ? <Box size={24} /> : <Network size={24} />}
                                title={w.title}
                                subtitle={w.status}
                                active={activePath === 'transform'}
                            />
                        ))}
                        {workflows.length === 0 && (
                            <LineageNode icon={<Box size={24} />} title="No Active Pipelines" subtitle="Check workflows" active={activePath === 'transform'} />
                        )}
                    </div>

                    <ArrowRight size={32} color={activePath === 'transform' || activePath === 'target' ? "var(--primary-color)" : "var(--border-color)"} style={{ transition: 'color 0.3s' }} />

                    {/* Layer 3: Targets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', zIndex: 2 }}>
                        <LineageNode onClick={() => setActivePath('target')} icon={<Database size={24} />} title="Analytics Data Warehouse" subtitle="Snowflake Schema" active={activePath === 'target'} />
                    </div>

                </div>

                {/* Legend / Overlay */}
                <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', maxWidth: '350px' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Lineage Inspector</h4>
                    {activePath === 'target' && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Analytics Target</strong><br />
                            Data warehouse receiving cleaned inputs from verified domains. <br />
                            <span style={{ color: 'var(--success-color)' }}>• Healthy: Connected to Snowflake.</span>
                        </p>
                    )}
                    {activePath === 'transform' && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Workflow Pipelines</strong><br />
                            ETL jobs matching current workflow task statuses.<br />
                            <span style={{ color: 'var(--primary-color)' }}>• {workflows.filter(w => w.status === 'Approved').length} tasks approved.</span>
                        </p>
                    )}
                    {activePath === 'source' && (
                        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <strong>Data Contracts</strong><br />
                            Sources defined by {contracts.length} active data contracts.<br />
                            <span style={{ color: 'var(--text-primary)' }}>• Governing {contracts.reduce((acc, c) => acc + (c.domain ? 1 : 0), 0)} domains.</span>
                        </p>
                    )}
                </div>

            </Card>
        </div>
    );
}

function LineageNode({ icon, title, subtitle, active = false, onClick }: { icon: React.ReactNode, title: string, subtitle: string, active?: boolean, onClick?: () => void }) {
    const [isHovered, setIsHovered] = React.useState(false);
    return (
        <div
            style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                backgroundColor: 'var(--bg-color)',
                border: `2px solid ${active ? 'var(--primary-color)' : isHovered ? 'var(--primary-color)' : 'var(--border-color)'}`,
                padding: '1rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                minWidth: '220px',
                boxShadow: active ? '0 0 0 4px var(--primary-light)' : isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                transform: active || isHovered ? 'scale(1.05)' : 'none'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            <div style={{ color: active || isHovered ? 'var(--primary-color)' : 'var(--text-secondary)', transition: 'color 0.2s' }}>
                {icon}
            </div>
            <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{subtitle}</div>
            </div>
        </div>
    );
}
