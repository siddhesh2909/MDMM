'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/providers/ToastProvider';
import { 
    FileText, Download, Calendar, Clock, Plus, Trash2, Mail, Check, 
    FileSpreadsheet, Loader2, Sparkles, Filter, ShieldCheck, ChevronRight 
} from 'lucide-react';

interface ScheduledReport {
    id: string;
    name: string;
    format: 'PDF' | 'Excel' | 'CSV';
    frequency: 'Daily' | 'Weekly' | 'Monthly';
    recipients: string;
    time: string;
    lastRun: string;
    status: 'Active' | 'Inactive';
}

export default function ReportsPage() {
    const { showToast } = useToast();
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
    const [reports, setReports] = useState<ScheduledReport[]>([
        {
            id: 'rep-1',
            name: 'Weekly Data Quality & Compliance Audit',
            format: 'PDF',
            frequency: 'Weekly',
            recipients: 'compliance-team@company.com, data-steward@company.com',
            time: 'Mondays at 08:00 AM',
            lastRun: '2026-06-08 08:00 AM',
            status: 'Active'
        },
        {
            id: 'rep-2',
            name: 'Monthly Executive Financial KPI Rollup',
            format: 'Excel',
            frequency: 'Monthly',
            recipients: 'exec-board@company.com, analytics-lead@company.com',
            time: '1st of Month at 06:00 AM',
            lastRun: '2026-06-01 06:00 AM',
            status: 'Active'
        },
        {
            id: 'rep-3',
            name: 'Daily Schema Drift & Integration Warnings',
            format: 'CSV',
            frequency: 'Daily',
            recipients: 'data-engineers@company.com',
            time: 'Daily at 11:30 PM',
            lastRun: '2026-06-13 11:30 PM',
            status: 'Active'
        }
    ]);

    // Form states
    const [newReportName, setNewReportName] = useState('');
    const [newFormat, setNewFormat] = useState<'PDF' | 'Excel' | 'CSV'>('PDF');
    const [newFrequency, setNewFrequency] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
    const [newRecipients, setNewRecipients] = useState('');
    const [newTime, setNewTime] = useState('09:00 AM');

    const handleExport = (reportName: string, format: string) => {
        const id = `${reportName}-${format}`;
        setLoadingReportId(id);
        setTimeout(() => {
            setLoadingReportId(null);
            showToast(`Report "${reportName}" exported successfully as ${format}!`, 'success');
            
            // Mock file download trigger
            const element = document.createElement("a");
            const file = new Blob([`Mock Report Content for: ${reportName}\nFormat: ${format}\nGenerated At: ${new Date().toLocaleString()}`], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = `${reportName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_export.${format.toLowerCase() === 'excel' ? 'xlsx' : format.toLowerCase()}`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        }, 1500);
    };

    const handleCreateSchedule = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newReportName.trim() || !newRecipients.trim()) {
            showToast('Please fill out all fields.', 'error');
            return;
        }

        const newReport: ScheduledReport = {
            id: `rep-${Date.now()}`,
            name: newReportName,
            format: newFormat,
            frequency: newFrequency,
            recipients: newRecipients,
            time: newFrequency === 'Daily' ? `Daily at ${newTime}` : 
                  newFrequency === 'Weekly' ? `Mondays at ${newTime}` : `1st of Month at ${newTime}`,
            lastRun: 'Never',
            status: 'Active'
        };

        setReports(prev => [...prev, newReport]);
        setIsScheduleModalOpen(false);
        showToast(`Report schedule "${newReportName}" configured successfully.`, 'success');

        // Reset fields
        setNewReportName('');
        setNewFormat('PDF');
        setNewFrequency('Weekly');
        setNewRecipients('');
        setNewTime('09:00 AM');
    };

    const handleDeleteReport = (id: string, name: string) => {
        if (!confirm(`Are you sure you want to cancel the schedule for "${name}"?`)) return;
        setReports(prev => prev.filter(r => r.id !== id));
        showToast(`Scheduled report "${name}" removed.`, 'info');
    };

    const toggleStatus = (id: string) => {
        setReports(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'Active' ? 'Inactive' : 'Active' } : r));
        showToast('Report schedule status updated.', 'success');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Enterprise Reports & Distribution</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Download consolidated data quality audits or schedule automated distribution cycles.</p>
                </div>
                <Button 
                    variant="primary" 
                    icon={<Plus size={16} />}
                    onClick={() => setIsScheduleModalOpen(true)}
                >
                    Schedule Report
                </Button>
            </div>

            {/* Quick Export Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <Card>
                    <CardContent style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary-color)' }}>
                            <FileText size={24} />
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Executive Quality Brief</h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', minHeight: '60px' }}>
                            Consolidated data quality and compliance overview including metric distributions, anomalies, and active data contract adherence.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button 
                                variant="outline" 
                                style={{ flex: 1 }}
                                onClick={() => handleExport('Executive Quality Brief', 'PDF')}
                                disabled={loadingReportId != null}
                            >
                                {loadingReportId === 'Executive Quality Brief-PDF' ? <Loader2 className="spinner" size={14} /> : 'Export PDF'}
                            </Button>
                            <Button 
                                variant="outline"
                                style={{ flex: 1 }}
                                onClick={() => handleExport('Executive Quality Brief', 'Excel')}
                                disabled={loadingReportId != null}
                            >
                                {loadingReportId === 'Executive Quality Brief-Excel' ? <Loader2 className="spinner" size={14} /> : 'Export XLSX'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981' }}>
                            <FileSpreadsheet size={24} />
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Anomalies & Drift Ledger</h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5', minHeight: '60px' }}>
                            Detailed transactional ledger isolating 3-sigma anomalies, schema mismatch warnings, and processing pipeline warnings.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <Button 
                                variant="outline" 
                                style={{ flex: 1 }}
                                onClick={() => handleExport('Anomalies & Drift Ledger', 'CSV')}
                                disabled={loadingReportId != null}
                            >
                                {loadingReportId === 'Anomalies & Drift Ledger-CSV' ? <Loader2 className="spinner" size={14} /> : 'Export CSV'}
                            </Button>
                            <Button 
                                variant="outline"
                                style={{ flex: 1 }}
                                onClick={() => handleExport('Anomalies & Drift Ledger', 'Excel')}
                                disabled={loadingReportId != null}
                            >
                                {loadingReportId === 'Anomalies & Drift Ledger-Excel' ? <Loader2 className="spinner" size={14} /> : 'Export XLSX'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Scheduled Distributions */}
            <Card>
                <CardHeader>Scheduled Distributions</CardHeader>
                <CardContent style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem' }}>Report Name</th>
                                    <th>Format</th>
                                    <th>Frequency</th>
                                    <th>Recipients</th>
                                    <th>Schedule Time</th>
                                    <th>Last Run</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} color="var(--primary-color)" />
                                                {report.name}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ 
                                                padding: '0.25rem 0.5rem', 
                                                borderRadius: '4px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 600,
                                                backgroundColor: report.format === 'PDF' ? 'rgba(239, 68, 68, 0.1)' : 
                                                                 report.format === 'Excel' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                color: report.format === 'PDF' ? 'var(--danger-color)' : 
                                                       report.format === 'Excel' ? '#10b981' : 'var(--accent-color)'
                                            }}>
                                                {report.format}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{report.frequency}</td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={report.recipients}>
                                            {report.recipients}
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                                <Clock size={14} />
                                                {report.time}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{report.lastRun}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                onClick={() => toggleStatus(report.id)}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    cursor: 'pointer',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    backgroundColor: report.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                                    color: report.status === 'Active' ? '#10b981' : 'var(--text-secondary)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {report.status}
                                            </button>
                                        </td>
                                        <td style={{ paddingRight: '1.5rem', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="icon-btn" 
                                                    style={{ color: 'var(--text-secondary)' }}
                                                    onClick={() => handleExport(report.name, report.format)}
                                                    title="Trigger Export Now"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button 
                                                    className="icon-btn" 
                                                    style={{ color: 'var(--danger-color)' }}
                                                    onClick={() => handleDeleteReport(report.id, report.name)}
                                                    title="Cancel Schedule"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Schedule modal */}
            {isScheduleModalOpen && (
                <Modal 
                    isOpen={isScheduleModalOpen} 
                    onClose={() => setIsScheduleModalOpen(false)}
                    title="Configure Automated Report Distribution"
                >
                    <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Report Name</label>
                            <input 
                                type="text" 
                                className="form-control"
                                placeholder="e.g. Sales Metrics & Drift Audit"
                                value={newReportName}
                                onChange={e => setNewReportName(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Output Format</label>
                                <select 
                                    value={newFormat} 
                                    onChange={e => setNewFormat(e.target.value as any)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="PDF">Portable Document Format (PDF)</option>
                                    <option value="Excel">Excel Spreadsheet (XLSX)</option>
                                    <option value="CSV">Comma Separated Values (CSV)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Frequency</label>
                                <select 
                                    value={newFrequency} 
                                    onChange={e => setNewFrequency(e.target.value as any)}
                                    style={{
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--surface-color)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="Daily">Daily</option>
                                    <option value="Weekly">Weekly</option>
                                    <option value="Monthly">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Distribution Time</label>
                                <input 
                                    type="text" 
                                    className="form-control"
                                    placeholder="e.g. 08:00 AM or 11:30 PM"
                                    value={newTime}
                                    onChange={e => setNewTime(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Verification Mode</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: '#10b981', fontSize: '0.85rem' }}>
                                    <ShieldCheck size={18} />
                                    <span>Pre-distribution data verification</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>Recipient Emails (comma-separated)</label>
                            <textarea 
                                className="form-control"
                                rows={2}
                                placeholder="data-steward@company.com, engineers@company.com"
                                value={newRecipients}
                                onChange={e => setNewRecipients(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" type="submit">Schedule Distribution</Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
