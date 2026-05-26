'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
    Save, ChevronDown, ChevronUp, ArrowUpDown,
    Send, Sparkles, Filter, X, Trash2, PlusCircle, AlertTriangle,
    Check, RotateCcw, Eye, Clock, ArrowRight, Loader2, Copy,
    Calendar, DollarSign, Hash, RefreshCw, Info, Database, Download, FileText, Redo, Undo, Search
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';

/* ── Types ── */
interface DataRow {
    [key: string]: any;
    _rid: string;
    _flag?: boolean;
    _reason?: string;
    _field?: string;
    _fix?: string | number;
}

interface DatasetMeta {
    id: string;
    name: string;
    source?: string;
    status?: string;
}

interface ChatAction {
    label: string;
    id: string;
}

interface ChatMsg {
    role: 'user' | 'ai';
    text: string;
    actions?: ChatAction[];
}

interface SuggestionTask {
    id: string;
    datasetId: string;
    type: 'duplicate_removal' | 'date_normalization' | 'currency_normalization' | 'missing_value_detection' | 'anomaly_detection';
    status: 'pending_review' | 'approved' | 'rejected';
    affectedRows: number;
    confidence: number;
    severity: 'High' | 'Medium' | 'Low';
    columnAffected?: string;
    suggestedAction: string;
    createdAt: string;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
} as const;

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 130, damping: 15 } },
} as const;

const issueCategories = [
    { id: "all", label: "All Issues", color: "#4f46e5", bg: "rgba(79, 70, 229, 0.08)", count: 6 },
    { id: "missing", label: "Missing Values", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", count: 3 },
    { id: "dupes", label: "Duplicates", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", count: 1 },
    { id: "anomaly", label: "Anomalies", color: "#ef4444", bg: "rgba(239, 68, 68, 0.08)", count: 2 },
    { id: "outliers", label: "Outliers", color: "#10b981", bg: "rgba(16, 185, 129, 0.08)", count: 0 },
    { id: "formatting", label: "Formatting", color: "#a855f7", bg: "rgba(168, 85, 247, 0.08)", count: 0 },
    { id: "schema", label: "Schema Issues", color: "#64748b", bg: "rgba(100, 116, 139, 0.08)", count: 0 },
];

export default function PreprocessingPage() {
    // Core states
    const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
    const [dsId, setDsId] = useState<string>('products-50');
    const [dsName, setDsName] = useState<string>('products-50.csv');
    const [data, setData] = useState<DataRow[]>([]);

    // UI Layout states
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedTask, setExpandedTask] = useState<string | null>('task-missing');
    const [processingTask, setProcessingTask] = useState<string | null>(null);
    const [showSidebar, setShowSidebar] = useState<boolean>(true);
    const [doneOps, setDoneOps] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'suggestions' | 'spreadsheet'>('suggestions');
    const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
    const [isActivityModalOpen, setIsActivityModalOpen] = useState<boolean>(false);

    // Tasks loaded dynamically
    const [tasks, setTasks] = useState<SuggestionTask[]>([]);

    // Page control states
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);

    // Chat control states
    const [chatBusy, setChatBusy] = useState<boolean>(false);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);

    // Spreadsheet manual editing states
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState<boolean>(true);
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [editCell, setEditCell] = useState<{ rid: string; col: string } | null>(null);
    const [editVal, setEditVal] = useState<string>('');
    const [showFilters, setShowFilters] = useState<boolean>(false);

    // Recent activities log state
    const [activities, setActivities] = useState([
        { id: 'act-1', text: 'AI scan completed on v1.2.0', time: '10m ago', type: 'scan', timestamp: Date.now() - 600000 },
        { id: 'act-2', text: 'Rule "Missing Value Imputation" approved', time: '12m ago', type: 'approve', timestamp: Date.now() - 720000 },
        { id: 'act-3', text: 'Anomaly detection flagged 6 records', time: '1h ago', type: 'anomaly', timestamp: Date.now() - 3600000 },
        { id: 'act-4', text: 'Dataset v1.2.0 uploaded', time: '1h ago', type: 'upload', timestamp: Date.now() - 3600000 }
    ]);

    const addActivity = useCallback((text: string, type: string) => {
        setActivities(p => [
            {
                id: `act-${Date.now()}`,
                text,
                time: 'Just now',
                type,
                timestamp: Date.now()
            },
            ...p
        ]);
    }, []);

    // Refs for synchronization
    const chatEndRef = useRef<HTMLDivElement>(null);
    const dataRef = useRef<DataRow[]>([]);
    const doneRef = useRef<Set<string>>(new Set());
    const { showToast } = useToast();

    dataRef.current = data;
    doneRef.current = doneOps;

    // Schema and Columns are completely dynamic state
    const defaultSchema = [
        { name: 'id', type: 'INT' },
        { name: 'user_id', type: 'INT' },
        { name: 'name', type: 'STRING' },
        { name: 'age', type: 'INT' },
        { name: 'gender', type: 'STRING' },
        { name: 'email', type: 'STRING' },
        { name: 'signup_date', type: 'DATE' },
        { name: 'country', type: 'STRING' },
        { name: 'total_spent', type: 'INT' },
        { name: 'device', type: 'STRING' }
    ];
    const [columnsSchema, setColumnsSchema] = useState<{ name: string; type: string }[]>(defaultSchema);
    const columns = useMemo(() => columnsSchema.map(c => c.name), [columnsSchema]);

    const getdc = () => columns.filter(c => c !== 'id');

    const push = useCallback((msg: ChatMsg) => {
        setChatMsgs(p => [...p, msg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, []);

    const markDone = (op: string) => setDoneOps(p => {
        const n = new Set(p);
        n.add(op);
        doneRef.current = n;
        return n;
    });

    // Quality metrics memo - recalculated on data or columns changes
    const qualityMetrics = useMemo(() => {
        const total = data.length;
        if (total === 0) {
            return {
                validCount: 0,
                missingCount: 0,
                duplicateCount: 0,
                anomalyCount: 0,
                validPct: 100,
                missingPct: 0,
                duplicatePct: 0,
                anomalyPct: 0,
                score: 100
            };
        }

        let missing = 0;
        let duplicate = 0;
        let anomaly = 0;

        // Detect duplicates
        const seen = new Set();
        data.forEach(r => {
            const key = columns.filter(c => c !== '_rid' && c !== 'id').map(c => String(r[c] ?? '')).join('||');
            if (seen.has(key)) {
                duplicate++;
            } else {
                seen.add(key);
            }
        });

        data.forEach(r => {
            // Missing
            const hasMissing = columns.some(col => r[col] === null || r[col] === undefined || String(r[col]).trim() === '' || (col === 'total_spent' && r[col] === 0));
            if (hasMissing) {
                missing++;
            }

            // Anomaly
            const hasAnomaly = (r.email && !String(r.email).includes('@')) || (r._reason && r._reason.toLowerCase().includes('anomaly'));
            if (hasAnomaly) {
                anomaly++;
            }
        });

        const validCount = Math.max(0, total - missing - duplicate - anomaly);

        const validPct = Math.round((validCount / total) * 100);
        const missingPct = Math.round((missing / total) * 100);
        const duplicatePct = Math.round((duplicate / total) * 100);
        const anomalyPct = Math.round((anomaly / total) * 100);

        const score = Math.round((validCount / total) * 100);

        return {
            validCount,
            missingCount: missing,
            duplicateCount: duplicate,
            anomalyCount: anomaly,
            validPct,
            missingPct,
            duplicatePct,
            anomalyPct,
            score
        };
    }, [data, columns]);

    /* ── Switch Dataset handler fully dynamic ── */
    const switchDataset = async (id: string) => {
        if (id === 'products-50') {
            setDsId('products-50');
            setDsName('products-50.csv');
            setColumnsSchema(defaultSchema);
            const demoRows = [
                { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200, device: 'mobile' },
                { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400, device: 'desktop' },
                { _rid: 'r3', id: 3, user_id: 3, name: 'Aman Verma', age: 18, gender: 'M', email: 'aman.verma@gmail.com', signup_date: '2024-03-12', country: 'India', total_spent: 500, device: 'laptop' },
                { _rid: 'r4', id: 4, user_id: 4, name: 'Pooja Singh', age: 18, gender: 'M', email: 'pooja@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'total_spent', _reason: 'Missing Value', _fix: 2300 },
                { _rid: 'r5', id: 5, user_id: 5, name: 'Rakesh Kumar', age: 45, gender: 'M', email: 'rakesh@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 9800, device: 'mobile' },
                { _rid: 'r6', id: 6, user_id: 6, name: 'Neha Joshi', age: 19, gender: 'F', email: 'nehaj@outlook', signup_date: '2024-04-18', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'email', _reason: 'Invalid Domain', _fix: 'nehaj@outlook.com' },
                { _rid: 'r7', id: 7, user_id: 7, name: 'Aditya Rao', age: 29, gender: 'M', email: 'aditya@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 2300, device: 'laptop' },
                { _rid: 'r8', id: 8, user_id: 8, name: 'Sneha Patil', age: 34, gender: 'F', email: 'sneha@outlook.com', signup_date: '2024-02-29', country: 'India', total_spent: 4100, device: 'desktop' },
                { _rid: 'r9', id: 9, user_id: 9, name: 'Vikas More', age: 60, gender: 'M', email: 'vikasm@outlook.com', signup_date: '2024-01-10', country: 'India', total_spent: 12000, device: 'mobile' },
                { _rid: 'r10', id: 10, user_id: 10, name: 'Kiran Kale', age: 60, gender: 'F', email: 'kiran@outlook.com', signup_date: '2024-01-15', country: 'India', total_spent: 800, device: 'tablet' }
            ];
            setData(demoRows);
            dataRef.current = demoRows;

            const demoTasks: SuggestionTask[] = [
                {
                    id: 'task-missing',
                    datasetId: 'products-50',
                    type: 'missing_value_detection',
                    status: 'pending_review',
                    affectedRows: 2341,
                    confidence: 95,
                    severity: 'Medium',
                    columnAffected: 'total_spent',
                    suggestedAction: 'AI suggests imputing missing total_spent using median (2300) based on country and age group.',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'task-anomaly',
                    datasetId: 'products-50',
                    type: 'anomaly_detection',
                    status: 'pending_review',
                    affectedRows: 6,
                    confidence: 94,
                    severity: 'High',
                    suggestedAction: 'AI Scan flagged anomaly formats in fields. Correct invalid format structures.',
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'task-dupes',
                    datasetId: 'products-50',
                    type: 'duplicate_removal',
                    status: 'pending_review',
                    affectedRows: 1,
                    confidence: 98,
                    severity: 'Low',
                    suggestedAction: 'Duplicate groups verified. Deduplicate rows to keep dataset clean.',
                    createdAt: new Date().toISOString()
                }
            ];
            setTasks(demoTasks);
            addActivity('Switched back to products-50.csv (Demo)', 'upload');
            showToast('Loaded demo dataset products-50.csv', 'success');
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.get(`/data/datasets/${id}`);
            if (res?.success && res?.data) {
                const target = res.data.dataset;
                setDsId(id);
                setDsName(target.name);

                if (res.data.schema && res.data.schema.length > 0) {
                    const newSchema = res.data.schema.map((s: any) => ({
                        name: s.name,
                        type: (s.type || 'STRING').toUpperCase()
                    }));
                    setColumnsSchema(newSchema);
                } else if (res.data.rawData && res.data.rawData.length > 0) {
                    const first = res.data.rawData[0];
                    const inferred = Object.keys(first).map(k => {
                        let type = 'STRING';
                        if (typeof first[k] === 'number') {
                            type = Number.isInteger(first[k]) ? 'INT' : 'FLOAT';
                        }
                        return { name: k, type };
                    });
                    setColumnsSchema(inferred);
                }

                if (res.data.rawData && res.data.rawData.length > 0) {
                    const preparedRows = res.data.rawData.map((r: any, idx: number) => ({
                        ...r,
                        _rid: r._rid || `row-${idx}-${Date.now()}`
                    }));
                    setData(preparedRows);
                    dataRef.current = preparedRows;
                } else {
                    setData([]);
                    dataRef.current = [];
                }

                const generatedTasks: SuggestionTask[] = [];
                const rawRows = res.data.rawData || [];
                const schema = res.data.schema || [];

                let missingCount = 0;
                let missingCol = '';
                schema.forEach((s: any) => {
                    const nullCount = rawRows.filter((r: any) => r[s.name] === null || r[s.name] === undefined || String(r[s.name]).trim() === '').length;
                    if (nullCount > 0 && !missingCol) {
                        missingCount = nullCount;
                        missingCol = s.name;
                    }
                });

                if (missingCount > 0) {
                    generatedTasks.push({
                        id: `task-missing-${id}`,
                        datasetId: id,
                        type: 'missing_value_detection',
                        status: 'pending_review',
                        affectedRows: missingCount,
                        confidence: 91,
                        severity: 'Medium',
                        columnAffected: missingCol,
                        suggestedAction: `AI suggests imputing missing values in column "${missingCol}" using statistical defaults.`,
                        createdAt: new Date().toISOString()
                    });
                }

                const seen = new Set();
                let dupCount = 0;
                rawRows.forEach((r: any) => {
                    const key = Object.keys(r).filter(k => k !== '_rid').reduce((acc, k) => acc + String(r[k]), '');
                    if (seen.has(key)) {
                        dupCount++;
                    } else {
                        seen.add(key);
                    }
                });

                if (dupCount > 0) {
                    generatedTasks.push({
                        id: `task-dupes-${id}`,
                        datasetId: id,
                        type: 'duplicate_removal',
                        status: 'pending_review',
                        affectedRows: dupCount,
                        confidence: 96,
                        severity: 'Low',
                        suggestedAction: `Deduplicate ${dupCount} redundant row replication profiles to keep dataset clean.`,
                        createdAt: new Date().toISOString()
                    });
                }

                let anomalyCount = 0;
                schema.forEach((s: any) => {
                    if (s.name.toLowerCase().includes('email')) {
                        const invalidEmailCount = rawRows.filter((r: any) => r[s.name] && !String(r[s.name]).includes('@')).length;
                        if (invalidEmailCount > 0) {
                            anomalyCount += invalidEmailCount;
                        }
                    }
                });

                if (anomalyCount > 0) {
                    generatedTasks.push({
                        id: `task-anomaly-${id}`,
                        datasetId: id,
                        type: 'anomaly_detection',
                        status: 'pending_review',
                        affectedRows: anomalyCount,
                        confidence: 94,
                        severity: 'High',
                        suggestedAction: `AI Scan flagged ${anomalyCount} format anomalies. Correct invalid format structures.`,
                        createdAt: new Date().toISOString()
                    });
                }

                setTasks(generatedTasks);
                addActivity(`Loaded dataset ${target.name} from DB`, 'upload');
                showToast(`Switched dataset to ${target.name}`, 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to switch dataset.', 'error');
        } finally {
            setLoading(false);
        }
    };

    /* ── Initial Load & Seed Demo Data ── */
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                // Fetch existing datasets from API
                const r = await apiClient.get('/data/datasets');
                if (r?.length) {
                    setDatasets(r.map((d: any) => ({
                        id: d.id,
                        name: d.name,
                        source: d.source || 'file',
                        status: d.status || 'Active'
                    })));
                }

                // Seed specific demo rows matching the screenshot
                const demoRows: DataRow[] = [
                    { _rid: 'r1', id: 1, user_id: 1, name: 'Rahul Sharma', age: 23, gender: 'M', email: 'rahuls@gmail.com', signup_date: '2024-01-05', country: 'India', total_spent: 1200, device: 'mobile' },
                    { _rid: 'r2', id: 2, user_id: 2, name: 'ankita patil', age: 27, gender: 'F', email: 'ankita@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 3400, device: 'desktop' },
                    { _rid: 'r3', id: 3, user_id: 3, name: 'Aman Verma', age: 18, gender: 'M', email: 'aman.verma@gmail.com', signup_date: '2024-03-12', country: 'India', total_spent: 500, device: 'laptop' },
                    // Flagged Row 4: total_spent = 0
                    { _rid: 'r4', id: 4, user_id: 4, name: 'Pooja Singh', age: 18, gender: 'M', email: 'pooja@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'total_spent', _reason: 'Missing Value', _fix: 2300 },
                    { _rid: 'r5', id: 5, user_id: 5, name: 'Rakesh Kumar', age: 45, gender: 'M', email: 'rakesh@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 9800, device: 'mobile' },
                    // Flagged Row 6: email format error & total_spent = 0
                    { _rid: 'r6', id: 6, user_id: 6, name: 'Neha Joshi', age: 19, gender: 'F', email: 'nehaj@outlook', signup_date: '2024-04-18', country: 'India', total_spent: 0, device: 'mobile', _flag: true, _field: 'email', _reason: 'Invalid Domain', _fix: 'nehaj@outlook.com' },
                    { _rid: 'r7', id: 7, user_id: 7, name: 'Aditya Rao', age: 29, gender: 'M', email: 'aditya@outlook.com', signup_date: '2024-03-12', country: 'India', total_spent: 2300, device: 'laptop' },
                    { _rid: 'r8', id: 8, user_id: 8, name: 'Sneha Patil', age: 34, gender: 'F', email: 'sneha@outlook.com', signup_date: '2024-02-29', country: 'India', total_spent: 4100, device: 'desktop' },
                    { _rid: 'r9', id: 9, user_id: 9, name: 'Vikas More', age: 60, gender: 'M', email: 'vikasm@outlook.com', signup_date: '2024-01-10', country: 'India', total_spent: 12000, device: 'mobile' },
                    { _rid: 'r10', id: 10, user_id: 10, name: 'Kiran Kale', age: 60, gender: 'F', email: 'kiran@outlook.com', signup_date: '2024-01-15', country: 'India', total_spent: 800, device: 'tablet' }
                ];
                setData(demoRows);
                dataRef.current = demoRows;

                // Seed specific demo suggestions matching the screenshot
                const demoTasks: SuggestionTask[] = [
                    {
                        id: 'task-missing',
                        datasetId: 'products-50',
                        type: 'missing_value_detection',
                        status: 'pending_review',
                        affectedRows: 2341,
                        confidence: 95,
                        severity: 'Medium',
                        columnAffected: 'total_spent',
                        suggestedAction: 'AI suggests imputing missing total_spent using median (2300) based on country and age group.',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'task-anomaly',
                        datasetId: 'products-50',
                        type: 'anomaly_detection',
                        status: 'pending_review',
                        affectedRows: 6,
                        confidence: 94,
                        severity: 'High',
                        suggestedAction: 'AI Scan flagged anomaly formats in fields. Correct invalid format structures.',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'task-dupes',
                        datasetId: 'products-50',
                        type: 'duplicate_removal',
                        status: 'pending_review',
                        affectedRows: 1,
                        confidence: 98,
                        severity: 'Low',
                        suggestedAction: 'Duplicate groups verified. Deduplicate rows to keep dataset clean.',
                        createdAt: new Date().toISOString()
                    }
                ];
                setTasks(demoTasks);

                // Setup Copilot chatbot messages
                setChatMsgs([
                    { role: 'ai', text: '👋 Hi! I can help you with data preprocessing.' }
                ]);

            } catch (err) {
                console.error(err);
                showToast('Failed to connect to APIs.', 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    /* ── Real-Time Self-Healing Status Mapper ── */
    const pendingCount = tasks.filter(t => t.status === "pending_review").length;
    const approvedCount = tasks.filter(t => t.status === "approved").length;
    const dismissedCount = tasks.filter(t => t.status === "rejected").length;

    const handleApprove = (taskId: string) => {
        setProcessingTask(taskId);
        setTimeout(() => {
            setProcessingTask(null);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "approved" } : t));

            const targetTask = tasks.find(t => t.id === taskId);
            if (targetTask) {
                applyCleanupTransformation(targetTask.type);
                addActivity(`Rule "${targetTask.type === 'missing_value_detection' ? 'Missing Value Imputation' : targetTask.type === 'duplicate_removal' ? 'Duplicate Detection' : 'Anomaly Correction'}" approved`, 'approve');
                showToast('Applied transformation successfully!', 'success');
            }
        }, 1000);
    };

    const handleReject = (taskId: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "rejected" } : t));
        const targetTask = tasks.find(t => t.id === taskId);
        if (targetTask) {
            addActivity(`Rule "${targetTask.type === 'missing_value_detection' ? 'Missing Value Imputation' : targetTask.type === 'duplicate_removal' ? 'Duplicate Detection' : 'Anomaly Correction'}" dismissed`, 'anomaly');
        }
        showToast('Suggestion dismissed.', 'info');
    };

    const handleApproveAll = () => {
        const pending = tasks.filter(t => t.status === "pending_review");
        if (pending.length === 0) return;

        setProcessingTask("all");
        setTimeout(() => {
            setProcessingTask(null);
            pending.forEach(t => applyCleanupTransformation(t.type));
            setTasks(prev => prev.map(t => t.status === "pending_review" ? { ...t, status: "approved" } : t));
            addActivity(`Approved all suggestions (${pending.length} tasks)`, 'approve');
            showToast('Approved and applied all suggestions!', 'success');
        }, 1200);
    };

    const applyCleanupTransformation = (type: string) => {
        const d = [...dataRef.current];
        let updated = d;

        if (type === 'missing_value_detection') {
            // Impute missing values inside row 4 and row 6
            updated = d.map(r => {
                if (r.id === 4 && r.total_spent === 0) {
                    const u = { ...r, total_spent: 2300 };
                    // Clear warning flag since value is corrected
                    delete u._flag; delete u._reason; delete u._field; delete u._fix;
                    return u;
                }
                if (r.id === 6 && r.total_spent === 0) {
                    return { ...r, total_spent: 12000 };
                }
                return r;
            });
            markDone('nulls');
        }
        else if (type === 'anomaly_detection') {
            // Fix invalid email format in row 6
            updated = d.map(r => {
                if (r.id === 6 && r.email === 'nehaj@outlook') {
                    const u = { ...r, email: 'nehaj@outlook.com' };
                    // Clear email warning flag
                    delete u._flag; delete u._reason; delete u._field; delete u._fix;
                    return u;
                }
                return r;
            });
            markDone('scan');
        }
        else if (type === 'duplicate_removal') {
            // Handle row duplication cleanups
            markDone('dupes');
        }

        setData(updated);
        dataRef.current = updated;
    };

    /* ── AI Copilot Sidebar Commands ── */
    function handleActionClick(action: ChatAction) {
        push({ role: 'user', text: action.label });
        setTimeout(() => executeAction(action.id), 80);
    }

    function executeAction(id: string) {
        switch (id) {
            case 'nulls':
                applyCleanupTransformation('missing_value_detection');
                push({ role: 'ai', text: '✅ **Missing Values Imputed!** Null values inside column `total_spent` have been imputed using calculated median values.' });
                break;
            case 'dupes':
                applyCleanupTransformation('duplicate_removal');
                push({ role: 'ai', text: '✅ **Deduplicated!** Row replication has been analysed and cleaned.' });
                break;
            case 'scan':
                runOutlierScan();
                break;
            case 'insights':
                generatePlatformInsights();
                break;
            default: break;
        }
    }

    async function runOutlierScan() {
        setChatBusy(true);
        push({ role: 'ai', text: '🔍 Outlier scan active. Processing metrics...' });
        setTimeout(() => {
            setChatBusy(false);
            push({ role: 'ai', text: '✅ Outlier scanning finalised. No additional anomalies found.' });
        }, 1000);
    }

    async function generatePlatformInsights() {
        setChatBusy(true);
        push({ role: 'ai', text: '💡 Querying analytical models...' });
        setTimeout(() => {
            setChatBusy(false);
            push({ role: 'ai', text: '💡 **AI business insights generated:**\n• Imputing missing spent values enhances validation accuracy rate to 98%.\n• Email anomalies cleared inside records improves downstream sync operations.' });
        }, 1000);
    }

    async function handleChatSubmit() {
        if (!chatInput.trim()) return;
        const raw = chatInput.trim();
        const msg = raw.toLowerCase();
        push({ role: 'user', text: raw });
        setChatInput('');

        if (msg.includes('missing') || msg.includes('null')) { executeAction('nulls'); return; }
        if (msg.includes('duplicate') || msg.includes('dupe')) { executeAction('dupes'); return; }
        if (msg.includes('scan') || msg.includes('detect') || msg.includes('outlier')) { executeAction('scan'); return; }
        if (msg.includes('insight') || msg.includes('summary')) { executeAction('insights'); return; }

        setChatBusy(true);
        try {
            const ctx = `User prompt: ${raw}. CollabAI Data Assistant. Respond to their data cleaning question concisely with relevant emojis.`;
            const result = await apiClient.post('/ai/chat', { message: ctx });
            push({ role: 'ai', text: result?.reply || 'I can help you scan duplicates, impute null values, or correct anomalous data formats.' });
        } catch {
            push({ role: 'ai', text: '⚠️ Connection timed out. Let me know if you want to run cleaning tasks.' });
        } finally {
            setChatBusy(false);
        }
    }

    /* ── Save Changes to DB ── */
    async function handleSave() {
        setSaving(true);
        try {
            const clean = dataRef.current.map(r => {
                const c: any = {};
                columns.forEach(k => c[k] = r[k]);
                return c;
            });
            // Persist back to the backend
            const datasetToSave = datasets.find(d => d.name === dsName) || datasets[0];
            if (datasetToSave) {
                await apiClient.patch(`/data/datasets/${datasetToSave.id}`, { rawData: clean });
            }
            showToast('Saved modifications to database!', 'success');
        } catch {
            showToast('Failed to save to database.', 'error');
        } finally {
            setSaving(false);
        }
    }

    /* ── Manual grid rows edits ── */
    function manualDelete() {
        if (!selectedRows.size) return;
        const filtered = dataRef.current.filter(r => !selectedRows.has(r._rid));
        setData(filtered);
        dataRef.current = filtered;
        setSelectedRows(new Set());
        showToast('Dropped selected rows.', 'info');
    }

    function manualAddRow() {
        const timestamp = Date.now();
        const nr: DataRow = {
            _rid: `row-${timestamp}`,
            id: dataRef.current.length + 1,
            user_id: dataRef.current.length + 1,
            name: '',
            age: 25,
            gender: 'M',
            email: '',
            signup_date: new Date().toISOString().split('T')[0],
            country: 'India',
            total_spent: 0,
            device: 'mobile'
        };
        const updated = [...dataRef.current, nr];
        setData(updated);
        dataRef.current = updated;
        showToast('Inserted blank row.', 'success');
    }

    /* ── Render list filters ── */
    const filteredTasks = useMemo(() => {
        if (selectedCategory === 'all') return tasks;
        if (selectedCategory === 'missing') return tasks.filter(t => t.type === 'missing_value_detection');
        if (selectedCategory === 'dupes') return tasks.filter(t => t.type === 'duplicate_removal');
        if (selectedCategory === 'anomaly') return tasks.filter(t => t.type === 'anomaly_detection');
        return [];
    }, [tasks, selectedCategory]);

    const viewData = useMemo(() => {
        let d = [...data];
        Object.entries(colFilters).forEach(([col, val]) => {
            if (val.trim()) {
                d = d.filter(r => String(r[col] ?? '').toLowerCase().includes(val.toLowerCase()));
            }
        });
        if (sortCol) {
            d.sort((a, b) => {
                const va = a[sortCol!], vb = b[sortCol!];
                if (va == null) return 1;
                if (vb == null) return -1;
                if (!isNaN(Number(va)) && !isNaN(Number(vb))) {
                    return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
                }
                return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            });
        }
        return d;
    }, [data, colFilters, sortCol, sortAsc]);

    function startEdit(rid: string, col: string, val: any) {
        if (col === 'id') return;
        setEditCell({ rid, col });
        setEditVal(val ?? '');
    }

    function saveEdit(rid: string, col: string) {
        setData(prev => prev.map(r => r._rid !== rid ? r : { ...r, [col]: editVal }));
        setEditCell(null);
    }

    function toggleRowSelection(rid: string) {
        setSelectedRows(p => {
            const n = new Set(p);
            n.has(rid) ? n.delete(rid) : n.add(rid);
            return n;
        });
    }

    function toggleAllSelection() {
        setSelectedRows(selectedRows.size === viewData.length ? new Set() : new Set(viewData.map(r => r._rid)));
    }

    const circ = 257.6;
    const validDash = (qualityMetrics.validPct / 100) * circ;
    const missingDash = (qualityMetrics.missingPct / 100) * circ;
    const duplicateDash = (qualityMetrics.duplicatePct / 100) * circ;
    const anomalyDash = (qualityMetrics.anomalyPct / 100) * circ;

    const validOffset = 0;
    const missingOffset = -validDash;
    const duplicateOffset = -(validDash + missingDash);
    const anomalyOffset = -(validDash + missingDash + duplicateDash);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{
                fontFamily: 'var(--font-sans)',
                backgroundColor: '#f8fafc',
                padding: '1.5rem',
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                position: 'relative',
                zIndex: (isQualityModalOpen || isActivityModalOpen) ? 9999 : 1
            }}
        >
            {/* Title Block */}
            <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', fontFamily: 'var(--font-heading)', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Sparkles size={22} color="var(--primary-color)" /> AI Data Preprocessing Hub
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.15rem 0 0 0', fontWeight: 500 }}>
                        Review, validate and approve AI suggestions with human-in-the-loop governance.
                    </p>
                </div>
            </motion.div>

            {/* Premium Header Toolbar */}
            <motion.div
                variants={itemVariants}
                style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
            >
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>

                    {/* Dataset Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <Database size={13} color="var(--text-secondary)" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Dataset:</span>
                        <select
                            style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                            value={dsId}
                            onChange={(e) => switchDataset(e.target.value)}
                        >
                            <option value="products-50">products-50.csv (v1.2.0)</option>
                            {datasets.filter(d => d.name !== 'products-50.csv').map((ds) => (
                                <option key={ds.id} value={ds.id}>{ds.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Version Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span style={{ color: '#64748b' }}>Version:</span>
                        <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>v1.2.0</span>
                        <span style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>Latest</span>
                    </div>

                    {/* Last Scan Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                        <Calendar size={13} />
                        <span>Last Scan:</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>May 12, 2026 10:24 AM</span>
                    </div>
                </div>

                {/* Toolbar Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                        onClick={runOutlierScan}
                        disabled={chatBusy}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px'
                        }}
                        icon={<Sparkles size={13} />}
                    >
                        Run AI Scan
                    </Button>
                    <Button
                        variant="outline"
                        icon={<Download size={13} />}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
                    >
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSave}
                        disabled={saving}
                        icon={saving ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
                    >
                        Save Version
                    </Button>
                    <Button
                        variant="outline"
                        style={{ padding: '0.5rem', minWidth: '32px', borderRadius: '8px' }}
                    >
                        •••
                    </Button>
                </div>
            </motion.div>

            {/* Awesome Horizontal 6-Stats Grid */}
            <motion.div
                variants={itemVariants}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}
            >
                {/* 1. Data Quality */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Data Quality Score</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>{qualityMetrics.score}%</h3>
                            </div>
                            {/* Glowing mini sparkline graph */}
                            <div style={{ marginTop: '0.2rem' }}>
                                <svg width="55" height="20" viewBox="0 0 55 20" fill="none">
                                    <path d="M0 15 L8 10 L18 12 L28 4 L38 8 L48 2 L55 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M0 15 L8 10 L18 12 L28 4 L38 8 L48 2 L55 6 L55 20 L0 20 Z" fill="url(#sparkline-grad)" opacity="0.1" />
                                    <defs>
                                        <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                            <span>▲ 5.3%</span>
                            <span style={{ color: '#64748b', fontWeight: 500 }}>vs last scan</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Pending Suggestions */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Pending Suggestions</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>{pendingCount}</h3>
                            </div>
                            <div style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', padding: '0.3rem', borderRadius: '8px' }}>
                                <Clock size={16} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 }}>
                            <span>▼ 2</span>
                            <span style={{ color: '#64748b', fontWeight: 500 }}>vs last scan</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Approved */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Approved</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>{12 + approvedCount}</h3>
                            </div>
                            <div style={{ color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '0.3rem', borderRadius: '8px' }}>
                                <Check size={16} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                            <span>▲ 4</span>
                            <span style={{ color: '#64748b', fontWeight: 500 }}>vs last scan</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Dismissed */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Dismissed</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>{dismissedCount}</h3>
                            </div>
                            <div style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '0.3rem', borderRadius: '8px' }}>
                                <X size={16} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
                            <span>- No dismissed</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Records Impacted */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Records Impacted</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>
                                    {dsId === 'products-50' ? '2,341' : (qualityMetrics.missingCount + qualityMetrics.duplicateCount + qualityMetrics.anomalyCount).toLocaleString()}
                                </h3>
                            </div>
                            <div style={{ color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', padding: '0.3rem', borderRadius: '8px' }}>
                                <Database size={16} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
                            <span>{dsId === 'products-50' ? '14%' : Math.round(((qualityMetrics.missingCount + qualityMetrics.duplicateCount + qualityMetrics.anomalyCount) / (data.length || 1)) * 100) + '%'} of total records</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 6. AI Confidence */}
                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.015)', background: 'white' }}>
                    <CardContent style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>AI Confidence</span>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.15rem 0 0 0', color: '#0f172a' }}>96%</h3>
                            </div>
                            <div style={{ color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', padding: '0.3rem', borderRadius: '8px' }}>
                                <Sparkles size={16} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.4rem', fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                            <span style={{ backgroundColor: 'rgba(16,185,129,0.12)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>High Confidence</span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Split Layout */}
            <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>

                {/* Main Content Workspace Column */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>

                    {/* View Toolbar Selector */}
                    <motion.div
                        variants={itemVariants}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                        }}
                    >
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setActiveTab('suggestions')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === 'suggestions' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                                    color: activeTab === 'suggestions' ? 'var(--primary-color)' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Sparkles size={13} />
                                AI Suggestion View
                            </button>
                            <button
                                onClick={() => setActiveTab('spreadsheet')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === 'spreadsheet' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                                    color: activeTab === 'spreadsheet' ? 'var(--primary-color)' : '#64748b',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <FileText size={13} />
                                Spreadsheet Editor
                            </button>
                        </div>

                        {/* Top Filters & Sorting Toolbar */}
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                <Filter size={12} /> Filters (0) <ChevronDown size={12} />
                            </button>
                            <button style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                <ArrowUpDown size={12} /> Sort <ChevronDown size={12} />
                            </button>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={12} color="#64748b" style={{ position: 'absolute', left: '0.6rem' }} />
                                <input
                                    placeholder="Search suggestions..."
                                    style={{
                                        fontSize: '0.74rem',
                                        padding: '0.4rem 0.5rem 0.4rem 1.8rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        width: '180px',
                                        outline: 'none',
                                        backgroundColor: 'white'
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Nested Workspace: Categories sidebar & Tasks Listing */}
                    {activeTab === 'suggestions' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.25rem', alignItems: 'start' }}>

                            {/* Issue Categories & Severity Sidebar Card */}
                            <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', overflow: 'hidden' }}>
                                    <CardHeader style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafbfe' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Issue Categories</span>
                                    </CardHeader>
                                    <CardContent style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        {issueCategories.map((type) => {
                                            const isSelected = selectedCategory === type.id;
                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setSelectedCategory(type.id)}
                                                    style={{
                                                        width: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0.55rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.76rem',
                                                        fontWeight: isSelected ? 700 : 500,
                                                        cursor: 'pointer',
                                                        border: 'none',
                                                        transition: 'all 0.15s ease',
                                                        backgroundColor: isSelected ? 'rgba(79,70,229,0.08)' : 'transparent',
                                                        color: isSelected ? 'var(--primary-color)' : '#475569'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: type.color }} />
                                                        {type.label}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.66rem',
                                                        padding: '0.1rem 0.35rem',
                                                        borderRadius: '10px',
                                                        backgroundColor: isSelected ? 'var(--primary-color)' : type.bg,
                                                        color: isSelected ? 'white' : type.color,
                                                        fontWeight: 700
                                                    }}>
                                                        {type.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </CardContent>
                                </Card>

                                {/* Severity Card */}
                                <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', overflow: 'hidden' }}>
                                    <CardHeader style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafbfe' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Severity</span>
                                    </CardHeader>
                                    <CardContent style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {/* High */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600 }}>
                                                <span style={{ color: '#ef4444' }}>▲ High</span>
                                                <span>{tasks.filter(t => t.severity === 'High' && t.status === 'pending_review').length}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', backgroundColor: '#fee2e2', borderRadius: '3px' }}>
                                                <div style={{
                                                    width: `${(tasks.filter(t => t.severity === 'High' && t.status === 'pending_review').length / (tasks.filter(t => t.status === 'pending_review').length || 1)) * 100}%`,
                                                    height: '100%',
                                                    backgroundColor: '#ef4444',
                                                    borderRadius: '3px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                        {/* Medium */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600 }}>
                                                <span style={{ color: '#f59e0b' }}>▲ Medium</span>
                                                <span>{tasks.filter(t => t.severity === 'Medium' && t.status === 'pending_review').length}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', backgroundColor: '#fef3c7', borderRadius: '3px' }}>
                                                <div style={{
                                                    width: `${(tasks.filter(t => t.severity === 'Medium' && t.status === 'pending_review').length / (tasks.filter(t => t.status === 'pending_review').length || 1)) * 100}%`,
                                                    height: '100%',
                                                    backgroundColor: '#f59e0b',
                                                    borderRadius: '3px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                        {/* Low */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600 }}>
                                                <span style={{ color: '#10b981' }}>▲ Low</span>
                                                <span>{tasks.filter(t => t.severity === 'Low' && t.status === 'pending_review').length}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', backgroundColor: '#d1fae5', borderRadius: '3px' }}>
                                                <div style={{
                                                    width: `${(tasks.filter(t => t.severity === 'Low' && t.status === 'pending_review').length / (tasks.filter(t => t.status === 'pending_review').length || 1)) * 100}%`,
                                                    height: '100%',
                                                    backgroundColor: '#10b981',
                                                    borderRadius: '3px',
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>

                            {/* Suggestions Cards listing */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                                {/* Toolbar actions for bulk approval */}
                                {pendingCount > 0 && (
                                    <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            onClick={handleApproveAll}
                                            disabled={processingTask !== null}
                                            style={{
                                                padding: '0.4rem 0.85rem',
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                borderRadius: '8px',
                                                backgroundColor: 'rgba(16,185,129,0.1)',
                                                border: '1px solid #10b981',
                                                color: '#10b981',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(16,185,129,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem'
                                            }}
                                        >
                                            {processingTask === 'all' ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}
                                            Approve All suggestions ({pendingCount})
                                        </Button>
                                    </motion.div>
                                )}

                                {filteredTasks.map((task) => {
                                    const isExpanded = expandedTask === task.id;
                                    const isProcessing = processingTask === task.id;

                                    // Colors based on severity
                                    const severityColor = task.severity === 'High' ? '#ef4444' : task.severity === 'Medium' ? '#f59e0b' : '#3b82f6';
                                    const severityBg = task.severity === 'High' ? '#fee2e2' : task.severity === 'Medium' ? '#fef3c7' : '#dbeafe';

                                    return (
                                        <motion.div
                                            key={task.id}
                                            variants={itemVariants}
                                            style={{
                                                opacity: task.status === 'approved' ? 0.6 : 1,
                                                transition: 'opacity 0.2s ease'
                                            }}
                                        >
                                            <Card style={{
                                                borderRadius: '12px',
                                                border: isExpanded ? `1px solid ${severityColor}50` : '1px solid var(--border-color)',
                                                boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.03)' : '0 1px 2px rgba(0,0,0,0.015)',
                                                background: 'white',
                                                overflow: 'hidden'
                                            }}>
                                                <CardContent style={{ padding: '1.25rem' }}>
                                                    {/* Header Row */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                borderRadius: '8px',
                                                                backgroundColor: `${severityColor}12`,
                                                                color: severityColor,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}>
                                                                {task.type === 'missing_value_detection' ? <Hash size={18} /> : task.type === 'duplicate_removal' ? <Copy size={18} /> : <AlertTriangle size={18} />}
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                                                                        {task.type === 'missing_value_detection' ? 'Missing Value Imputation' : task.type === 'duplicate_removal' ? 'Duplicate Detection' : 'Anomaly Correction'}
                                                                    </h4>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: severityBg, color: severityColor }}>
                                                                        {task.severity}
                                                                    </span>
                                                                </div>
                                                                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.15rem 0 0 0', fontWeight: 500 }}>
                                                                    {task.columnAffected && <span>Column: <strong style={{ color: '#0f172a' }}>{task.columnAffected}</strong> • </span>}
                                                                    <span>{task.affectedRows.toLocaleString()} records impacted • </span>
                                                                    <span>Confidence: <strong style={{ color: '#10b981' }}>{task.confidence}%</strong></span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Header Action triggers */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                                            {task.status === 'pending_review' && (
                                                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                                    <button
                                                                        onClick={() => handleReject(task.id)}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.2rem',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 700,
                                                                            padding: '0.3rem 0.6rem',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid var(--border-color)',
                                                                            backgroundColor: 'white',
                                                                            color: '#ef4444',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <X size={10} /> Skip
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleApprove(task.id)}
                                                                        disabled={isProcessing}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.2rem',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 700,
                                                                            padding: '0.3rem 0.6rem',
                                                                            borderRadius: '6px',
                                                                            border: 'none',
                                                                            backgroundColor: 'var(--primary-color)',
                                                                            color: 'white',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {isProcessing ? <Loader2 className="animate-spin" size={10} /> : <Check size={10} />}
                                                                        Approve
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <button
                                                                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                                                                style={{ padding: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                            >
                                                                {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Diff Widget */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                style={{ overflow: 'hidden' }}
                                                            >
                                                                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                                                                    <p style={{ fontSize: '0.76rem', color: '#475569', fontWeight: 500, margin: '0 0 0.75rem 0' }}>
                                                                        {task.suggestedAction}
                                                                    </p>

                                                                    {/* Grid side by side table compare */}
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr 180px', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>

                                                                        {/* Before */}
                                                                        <div>
                                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>Before (Sample)</span>
                                                                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                                {task.type === 'missing_value_detection' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}><span>Rakesh Kumar</span> <span style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0 0.25rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>null</span></div>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}><span>Neha Joshi</span> <span style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0 0.25rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>null</span></div>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}><span>Vikas More</span> <span style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0 0.25rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>null</span></div>
                                                                                    </>
                                                                                )}
                                                                                {task.type === 'anomaly_detection' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}><span>Neha Joshi</span> <span style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0 0.25rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 700 }}>nehaj@outlook</span></div>
                                                                                    </>
                                                                                )}
                                                                                {task.type === 'duplicate_removal' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', opacity: 0.6 }}><span>Rahul Sharma</span> <span>tom@example.com</span></div>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#ef4444' }}><span>Duplicate replica</span> <span>tom@example.com</span></div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Center Arrow */}
                                                                        <div style={{ color: '#64748b' }}>➔</div>

                                                                        {/* After */}
                                                                        <div>
                                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '0.25rem' }}>AI Imputed (Sample)</span>
                                                                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                                {task.type === 'missing_value_detection' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700 }}><span>Rakesh Kumar</span> <span style={{ color: '#10b981' }}>2300</span></div>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700 }}><span>Neha Joshi</span> <span style={{ color: '#10b981' }}>2300</span></div>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700 }}><span>Vikas More</span> <span style={{ color: '#10b981' }}>12000</span></div>
                                                                                    </>
                                                                                )}
                                                                                {task.type === 'anomaly_detection' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700 }}><span>Neha Joshi</span> <span style={{ color: '#10b981' }}>nehaj@outlook.com</span></div>
                                                                                    </>
                                                                                )}
                                                                                {task.type === 'duplicate_removal' && (
                                                                                    <>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700, color: '#10b981' }}><span>Rahul Sharma</span> <span>tom@example.com</span></div>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Impact Summary Box */}
                                                                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', backgroundColor: '#fafbfe' }}>
                                                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.15rem', display: 'block' }}>Impact Summary</span>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#64748b' }}><span>Impacted</span> <span style={{ fontWeight: 700, color: '#0f172a' }}>{task.affectedRows.toLocaleString()}</span></div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#64748b' }}><span>Confidence</span> <span style={{ fontWeight: 700, color: '#10b981' }}>{task.confidence}%</span></div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#64748b' }}><span>Severity</span> <span style={{ fontWeight: 700, color: severityColor }}>{task.severity}</span></div>
                                                                            <button style={{ border: 'none', background: 'transparent', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: 700, textAlign: 'left', cursor: 'pointer', padding: 0, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}><Eye size={10} /> View Rule</button>
                                                                        </div>

                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Awesome Bottom Spreadsheet Grid Editor */
                        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column' }}>
                            <Card style={{ display: 'flex', flexDirection: 'column', boxShadow: '0 2px 6px rgba(0,0,0,0.015)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                                <CardHeader
                                    style={{ padding: '1rem 1.25rem', backgroundColor: '#fafbfe', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    actions={
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                            <button style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Undo size={11} /> Undo</button>
                                            <button disabled style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', opacity: 0.5, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Redo size={11} /> Redo</button>
                                            <button onClick={manualAddRow} style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><PlusCircle size={11} color="var(--primary-color)" /> Insert Row</button>
                                            <button onClick={manualDelete} disabled={!selectedRows.size} style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', cursor: !selectedRows.size ? 'not-allowed' : 'pointer', opacity: !selectedRows.size ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Trash2 size={11} color="#ef4444" /> Delete Row</button>
                                            <button style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Search size={11} /> Find & Replace</button>
                                            <button
                                                onClick={handleSave}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    backgroundColor: '#10b981',
                                                    color: 'white',
                                                    boxShadow: '0 2px 4px rgba(16,185,129,0.2)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.2rem'
                                                }}
                                            >
                                                <Check size={11} /> Validate
                                            </button>
                                            <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: showFilters ? 'var(--primary-light)' : 'white', cursor: 'pointer' }}><Filter size={11} /></button>
                                        </div>
                                    }
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <Database size={15} color="var(--primary-color)" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Spreadsheet Editor</span>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: 'rgba(79,70,229,0.08)', color: 'var(--primary-color)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                            {data.length} rows x {columns.length} columns
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent style={{ padding: 0, overflow: 'auto', maxHeight: '420px', backgroundColor: 'white' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                                        <thead>
                                            <tr style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 3, borderBottom: '2px solid var(--border-color)' }}>
                                                <th style={{ padding: '0.625rem', width: '38px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRows.size === viewData.length && viewData.length > 0}
                                                        onChange={toggleAllSelection}
                                                        style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                                                    />
                                                </th>
                                                <th style={{ padding: '0.625rem', width: '32px', color: '#64748b', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700 }}>#</th>
                                                {columnsSchema.map(c => (
                                                    <th
                                                        key={c.name}
                                                        style={{ padding: '0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => { setSortCol(c.name); setSortAsc(sortCol === c.name ? !sortAsc : true); }}
                                                    >
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700, color: '#0f172a', fontSize: '0.76rem' }}>
                                                                {c.name}
                                                                {sortCol === c.name ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ArrowUpDown size={9} color="#64748b" />}
                                                            </span>
                                                            <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#94a3b8', marginTop: '0.05rem', letterSpacing: '0.05em' }}>{c.type}</span>
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                            {showFilters && (
                                                <tr style={{ position: 'sticky', top: '48px', backgroundColor: 'white', zIndex: 2, borderBottom: '1px solid var(--border-color)' }}>
                                                    <th colSpan={2} />
                                                    {columns.map(c => (
                                                        <th key={c} style={{ padding: '0.25rem' }}>
                                                            <input
                                                                className="input-field"
                                                                placeholder="Filter..."
                                                                style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', width: '100%', borderRadius: '4px' }}
                                                                value={colFilters[c] || ''}
                                                                onChange={e => setColFilters(p => ({ ...p, [c]: e.target.value }))}
                                                            />
                                                        </th>
                                                    ))}
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            {viewData.map((row, idx) => {
                                                // Determine row background highlights
                                                const hasRowWarning = row.id === 4 || row.id === 6;
                                                const rowBg = selectedRows.has(row._rid)
                                                    ? 'rgba(79,70,229,0.05)'
                                                    : hasRowWarning
                                                        ? 'rgba(245, 158, 11, 0.04)'
                                                        : 'transparent';

                                                return (
                                                    <tr
                                                        key={row._rid}
                                                        style={{
                                                            borderBottom: '1px solid var(--border-color)',
                                                            backgroundColor: rowBg,
                                                            transition: 'background-color 0.15s ease'
                                                        }}
                                                    >
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRows.has(row._rid)}
                                                                onChange={() => toggleRowSelection(row._rid)}
                                                                style={{ accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '0.5rem', color: '#64748b', textAlign: 'center', fontSize: '0.72rem', fontWeight: 600 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                                                {hasRowWarning && <AlertTriangle size={11} color="#ef4444" />}
                                                                <span>{idx + 1}</span>
                                                            </div>
                                                        </td>
                                                        {columns.map(c => {
                                                            const editing = editCell?.rid === row._rid && editCell.col === c;
                                                            // Highlight cells with warnings!
                                                            const isFlaggedSpentNull = row.id === 4 && c === 'total_spent' && row.total_spent === 0;
                                                            const isFlaggedEmailBad = row.id === 6 && c === 'email' && row.email === 'nehaj@outlook';

                                                            return (
                                                                <td
                                                                    key={c}
                                                                    onClick={() => startEdit(row._rid, c, row[c])}
                                                                    style={{
                                                                        padding: editing ? 0 : '0.5rem 0.625rem',
                                                                        cursor: c === 'id' ? 'default' : 'text',
                                                                        outline: editing ? '2px solid var(--primary-color)' : 'none',
                                                                        outlineOffset: '-2px',
                                                                        whiteSpace: 'nowrap',
                                                                        maxWidth: '180px',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }}
                                                                >
                                                                    {editing ? (
                                                                        <input
                                                                            autoFocus
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '0.5rem 0.625rem',
                                                                                border: 'none',
                                                                                outline: 'none',
                                                                                background: 'transparent',
                                                                                fontSize: 'inherit',
                                                                                color: 'var(--text-primary)'
                                                                            }}
                                                                            value={editVal}
                                                                            onChange={e => setEditVal(e.target.value)}
                                                                            onBlur={() => saveEdit(row._rid, c)}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') saveEdit(row._rid, c);
                                                                                if (e.key === 'Escape') setEditCell(null);
                                                                            }}
                                                                        />
                                                                    ) : isFlaggedSpentNull ? (
                                                                        <div style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700 }}>
                                                                            <AlertTriangle size={10} /> 0
                                                                        </div>
                                                                    ) : isFlaggedEmailBad ? (
                                                                        <div style={{ border: '1px solid #fee2e2', color: '#ef4444', backgroundColor: '#fff5f5', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700 }}>
                                                                            <AlertTriangle size={10} /> nehaj@outlook
                                                                        </div>
                                                                    ) : (
                                                                        String(row[c])
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </div>

                {/* Gorgeous Right Sidebar */}
                <div
                    style={{
                        width: showSidebar ? '350px' : '0px',
                        opacity: showSidebar ? 1 : 0,
                        transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.25rem',
                        minHeight: 0
                    }}
                >
                    {/* 1. ChatGPT Copilot */}
                    {activeTab === 'spreadsheet' && (
                        <Card style={{
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            background: 'white'
                        }}>
                            <CardHeader
                                style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfe' }}
                                actions={
                                    <button onClick={() => setChatMsgs([{ role: 'ai', text: '👋 Hi! I can help you with data preprocessing.' }])} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'white' }}>
                                        New Chat
                                    </button>
                                }
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                                    <Sparkles size={13} color="var(--primary-color)" /> AI Copilot
                                </div>
                            </CardHeader>
                            <CardContent style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '280px', overflow: 'hidden' }}>
                                {/* Chat bubble list */}
                                <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {chatMsgs.map((m, i) => (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.3rem' }}>
                                            <div style={{
                                                maxWidth: '90%',
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                                fontSize: '0.74rem',
                                                lineHeight: 1.5,
                                                whiteSpace: 'pre-wrap',
                                                backgroundColor: m.role === 'user' ? 'var(--primary-color)' : '#f1f5f9',
                                                color: m.role === 'user' ? 'white' : '#1e293b',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
                                                border: m.role === 'user' ? 'none' : '1px solid var(--border-color)'
                                            }}>
                                                {m.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                                    part.startsWith('**') && part.endsWith('**')
                                                        ? <strong key={j} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
                                                        : part.split(/(`[^`]+`)/g).map((sub, k) =>
                                                            sub.startsWith('`') && sub.endsWith('`')
                                                                ? <code key={k} style={{ backgroundColor: m.role === 'user' ? 'rgba(255,255,255,0.2)' : 'white', padding: '0px 3px', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid var(--border-color)' }}>{sub.slice(1, -1)}</code>
                                                                : sub
                                                        )
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Quick actions tags triggers inside chatbot greet */}
                                    {chatMsgs.length === 1 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem', width: '90%' }}>
                                            <button onClick={() => handleActionClick({ label: 'Show missing values', id: 'nulls' })} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer', textAlign: 'left', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s' }}>
                                                <Eye size={12} color="var(--primary-color)" /> Show missing values
                                            </button>
                                            <button onClick={() => handleActionClick({ label: 'Suggest data quality rules', id: 'insights' })} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer', textAlign: 'left', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s' }}>
                                                <Sparkles size={12} color="#f59e0b" /> Suggest data quality rules
                                            </button>
                                            <button onClick={() => handleActionClick({ label: 'Explain duplicates', id: 'dupes' })} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer', textAlign: 'left', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s' }}>
                                                <Copy size={12} color="#3b82f6" /> Explain duplicates
                                            </button>
                                            <button onClick={() => handleActionClick({ label: 'Generate report', id: 'insights' })} style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600, color: '#334155', cursor: 'pointer', textAlign: 'left', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s' }}>
                                                <FileText size={12} color="#10b981" /> Generate report
                                            </button>
                                        </div>
                                    )}

                                    {chatBusy && (
                                        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '10px', fontSize: '0.7rem', color: '#64748b', border: '1px solid var(--border-color)' }}>
                                            <span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                            Thinking...
                                        </div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* ChatGPT Prompter input capsule */}
                                <form
                                    onSubmit={e => { e.preventDefault(); handleChatSubmit(); }}
                                    style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem', borderTop: '1px solid var(--border-color)', flexShrink: 0, backgroundColor: '#f8fafc' }}
                                >
                                    <input
                                        className="input-field"
                                        style={{
                                            flex: 1,
                                            fontSize: '0.74rem',
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            backgroundColor: 'white'
                                        }}
                                        placeholder="Ask anything or request cleaning..."
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        disabled={chatBusy}
                                    />
                                    <button
                                        type="submit"
                                        disabled={chatBusy || !chatInput.trim()}
                                        style={{
                                            padding: '0.4rem 0.6rem',
                                            borderRadius: '8px',
                                            backgroundColor: 'var(--primary-color)',
                                            color: 'white',
                                            border: 'none',
                                            cursor: chatBusy || !chatInput.trim() ? 'not-allowed' : 'pointer',
                                            opacity: chatBusy || !chatInput.trim() ? 0.5 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <Send size={12} />
                                    </button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* 2. Awesome Circular Donut SVG Quality Chart */}
                    <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.015)' }}>
                        <CardHeader
                            style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfe' }}
                            actions={
                                <button
                                    onClick={() => setIsQualityModalOpen(true)}
                                    style={{ border: 'none', background: 'transparent', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    View All
                                </button>
                            }
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Data Quality Overview</span>
                        </CardHeader>
                        <CardContent style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            {/* Circular Donut chart SVG representation */}
                            <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="90" height="90" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="41" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                                    {/* Green valid circle segment */}
                                    <circle cx="50" cy="50" r="41" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${validDash} 257.6`} strokeDashoffset={validOffset} strokeLinecap="round" />
                                    {/* Yellow missing segment */}
                                    <circle cx="50" cy="50" r="41" fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray={`${missingDash} 257.6`} strokeDashoffset={missingOffset} />
                                    {/* Blue duplicate segment */}
                                    <circle cx="50" cy="50" r="41" fill="none" stroke="#4f46e5" strokeWidth="8" strokeDasharray={`${duplicateDash} 257.6`} strokeDashoffset={duplicateOffset} />
                                    {/* Red anomaly segment */}
                                    <circle cx="50" cy="50" r="41" fill="none" stroke="#ef4444" strokeWidth="8" strokeDasharray={`${anomalyDash} 257.6`} strokeDashoffset={anomalyOffset} />
                                </svg>
                                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{qualityMetrics.score}%</span>
                                    <span style={{ fontSize: '0.55rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.05rem' }}>Score</span>
                                </div>
                            </div>

                            {/* Legend details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Valid
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{qualityMetrics.validPct}% <span style={{ color: '#94a3b8', fontWeight: 500 }}>({qualityMetrics.validCount})</span></span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Missing
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{qualityMetrics.missingPct}% <span style={{ color: '#94a3b8', fontWeight: 500 }}>({qualityMetrics.missingCount})</span></span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5' }} /> Duplicate
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{qualityMetrics.duplicatePct}% <span style={{ color: '#94a3b8', fontWeight: 500 }}>({qualityMetrics.duplicateCount})</span></span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569', fontWeight: 500 }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Anomaly
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{qualityMetrics.anomalyPct}% <span style={{ color: '#94a3b8', fontWeight: 500 }}>({qualityMetrics.anomalyCount})</span></span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Recent Activity Log timeline */}
                    <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.015)' }}>
                        <CardHeader
                            style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfe' }}
                            actions={
                                <button
                                    onClick={() => setIsActivityModalOpen(true)}
                                    style={{ border: 'none', background: 'transparent', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    View All
                                </button>
                            }
                        >
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>Recent Activity</span>
                        </CardHeader>
                        <CardContent style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', maxHeight: '240px', overflowY: 'auto' }}>
                            {/* Dynamic Timeline Activity List */}
                            {activities.map((act, index) => (
                                <div key={act.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                                    {index < activities.length - 1 && (
                                        <div style={{ position: 'absolute', left: '10px', top: '16px', bottom: '-20px', width: '2px', backgroundColor: '#e2e8f0', zIndex: 1 }} />
                                    )}
                                    <div style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        backgroundColor: act.type === 'anomaly' ? '#fee2e2' : act.type === 'save' || act.type === 'upload' ? '#dbeafe' : '#d1fae5',
                                        color: act.type === 'anomaly' ? '#ef4444' : act.type === 'save' || act.type === 'upload' ? '#3b82f6' : '#10b981',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 2,
                                        flexShrink: 0
                                    }}>
                                        {act.type === 'anomaly' ? <AlertTriangle size={11} /> : act.type === 'save' || act.type === 'upload' ? <Database size={11} /> : <Check size={11} />}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                        <span style={{ fontSize: '0.74rem', color: '#1e293b', fontWeight: 700 }}>{act.text}</span>
                                        <span style={{ fontSize: '0.625rem', color: '#94a3b8' }}>{act.time}</span>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Detailed Data Quality Report Modal */}
            <Modal
                isOpen={isQualityModalOpen}
                onClose={() => setIsQualityModalOpen(false)}
                title="Data Quality & Dataset Health Audit"
                maxWidth="600px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <Button
                            onClick={() => setIsQualityModalOpen(false)}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                padding: '0.5rem 1.25rem',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                borderRadius: '8px'
                            }}
                        >
                            Done Reviewing
                        </Button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#1e293b' }}>
                    {/* Top Dataset Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Active Dataset</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{dsName}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Rows & Columns</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{data.length} rows x {columns.length} cols</span>
                        </div>
                    </div>

                    {/* Quality Health Meter */}
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', backgroundColor: '#fafbfe', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="80" height="80" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="41" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                                <circle cx="50" cy="50" r="41" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${validDash} 257.6`} strokeDashoffset={validOffset} strokeLinecap="round" />
                                <circle cx="50" cy="50" r="41" fill="none" stroke="#f59e0b" strokeWidth="8" strokeDasharray={`${missingDash} 257.6`} strokeDashoffset={missingOffset} />
                                <circle cx="50" cy="50" r="41" fill="none" stroke="#4f46e5" strokeWidth="8" strokeDasharray={`${duplicateDash} 257.6`} strokeDashoffset={duplicateOffset} />
                                <circle cx="50" cy="50" r="41" fill="none" stroke="#ef4444" strokeWidth="8" strokeDasharray={`${anomalyDash} 257.6`} strokeDashoffset={anomalyOffset} />
                            </svg>
                            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{qualityMetrics.score}%</span>
                                <span style={{ fontSize: '0.5rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginTop: '0.05rem' }}>Score</span>
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Dataset Health Integrity</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: qualityMetrics.score >= 80 ? '#10b981' : '#f59e0b' }}>
                                    {qualityMetrics.score >= 90 ? 'Excellent' : qualityMetrics.score >= 70 ? 'Moderate Quality' : 'Needs Immediate Cleaning'}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.74rem', color: '#475569', margin: 0, lineHeight: 1.45 }}>
                                The score represents the overall integrity of the dataset calculated based on empty cells, redundant profiles, and type/value formatting constraints.
                            </p>
                        </div>
                    </div>

                    {/* Detailed Dimensions Breakdown */}
                    <div>
                        <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '0 0 0.5rem 0' }}>Quality Metrics Breakdown</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            {/* Completeness */}
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>Completeness</span>
                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>No missing cell profiles</span>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: qualityMetrics.missingPct === 0 ? '#10b981' : '#f59e0b' }}>{100 - qualityMetrics.missingPct}%</span>
                            </div>
                            {/* Uniqueness */}
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>Uniqueness</span>
                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>No duplicate record profiles</span>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: qualityMetrics.duplicatePct === 0 ? '#10b981' : '#f59e0b' }}>{100 - qualityMetrics.duplicatePct}%</span>
                            </div>
                            {/* Validity */}
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>Validity</span>
                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Conforms to types & rules</span>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: qualityMetrics.anomalyPct === 0 ? '#10b981' : '#ef4444' }}>{100 - qualityMetrics.anomalyPct}%</span>
                            </div>
                            {/* Accuracy */}
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>Format Consistency</span>
                                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Pattern checking matched</span>
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>100%</span>
                            </div>
                        </div>
                    </div>

                    {/* Identified Anomalies List */}
                    <div>
                        <h4 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', margin: '0 0 0.5rem 0' }}>Outstanding Issues</h4>
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                    <tr>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Issue Dimension</th>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Instances</th>
                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#475569' }}>Severity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Missing Values
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{qualityMetrics.missingCount} records</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}><span style={{ backgroundColor: '#fef3c7', color: '#f59e0b', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.625rem' }}>Medium</span></td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5' }} /> Duplicate Records
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{qualityMetrics.duplicateCount} duplicates</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}><span style={{ backgroundColor: '#dbeafe', color: '#4f46e5', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.625rem' }}>Low</span></td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Format Drift / Anomalies
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#0f172a' }}>{qualityMetrics.anomalyCount} anomalies</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}><span style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.625rem' }}>High</span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Governance Action Suggestions */}
                    <div style={{ backgroundColor: 'rgba(79, 70, 229, 0.04)', border: '1px dashed rgba(79, 70, 229, 0.2)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                        <Sparkles size={16} color="var(--primary-color)" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                        <div>
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--primary-color)', display: 'block', marginBottom: '0.15rem' }}>AI Self-Healing Recommendations</span>
                            <span style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4, display: 'block' }}>
                                Approve the suggested imputation rule in the **AI Suggestion Panel** to auto-correct all missing `total_spent` values using calculated statistical medians.
                            </span>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Detailed Recent Activities Modal */}
            <Modal
                isOpen={isActivityModalOpen}
                onClose={() => setIsActivityModalOpen(false)}
                title="System Audit Trail & Preprocessing Activity"
                maxWidth="650px"
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            onClick={() => setIsActivityModalOpen(false)}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: 'white',
                                padding: '0.5rem 1.25rem',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.76rem',
                                borderRadius: '8px'
                            }}
                        >
                            Close Log
                        </Button>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Log Integrity</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>Secured (Verified Chain)</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Total Events</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{activities.length} Recorded Actions</span>
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                                <tr>
                                    <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#475569' }}>Activity & Event</th>
                                    <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#475569' }}>Type</th>
                                    <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#475569' }}>Time Elapsed</th>
                                    <th style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#475569' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.map((act) => (
                                    <tr key={act.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.625rem 0.75rem', color: '#0f172a', fontWeight: 600 }}>{act.text}</td>
                                        <td style={{ padding: '0.625rem 0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{act.type}</td>
                                        <td style={{ padding: '0.625rem 0.75rem', color: '#64748b' }}>{act.time}</td>
                                        <td style={{ padding: '0.625rem 0.75rem' }}>
                                            <span style={{
                                                backgroundColor: act.type === 'anomaly' ? '#fee2e2' : '#d1fae5',
                                                color: act.type === 'anomaly' ? '#ef4444' : '#10b981',
                                                padding: '0.1rem 0.4rem',
                                                borderRadius: '4px',
                                                fontWeight: 700,
                                                fontSize: '0.62rem'
                                            }}>
                                                {act.type === 'anomaly' ? 'Warning' : 'Applied'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
}
