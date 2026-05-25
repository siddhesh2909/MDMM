'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Save, Database, ChevronDown, ChevronUp, ArrowUpDown,
    Send, Sparkles, Filter, X, Trash2, PlusCircle
} from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { apiClient } from '@/lib/apiClient';

/* ── Types ── */
interface DataRow { [key: string]: any; _rid: string; _flag?: boolean; _reason?: string; _field?: string; _fix?: string | number; }
interface DatasetMeta { id: string; name: string; }
interface ChatAction { label: string; id: string; }
interface ChatMsg { role: 'user' | 'ai'; text: string; actions?: ChatAction[]; }

export default function PreprocessingPage() {
    const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
    const [dsId, setDsId] = useState('');
    const [dsName, setDsName] = useState('');
    const [data, setData] = useState<DataRow[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [chatBusy, setChatBusy] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [sortCol, setSortCol] = useState<string | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [editCell, setEditCell] = useState<{ rid: string; col: string } | null>(null);
    const [editVal, setEditVal] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [doneOps, setDoneOps] = useState<Set<string>>(new Set());
    const chatEndRef = useRef<HTMLDivElement>(null);
    const dataRef = useRef<DataRow[]>([]);
    const colsRef = useRef<string[]>([]);
    const doneRef = useRef<Set<string>>(new Set());
    const anomaliesRef = useRef<any[]>([]);
    const { showToast } = useToast();

    dataRef.current = data;
    colsRef.current = columns;
    doneRef.current = doneOps;

    const getdc = () => colsRef.current.filter(c => c !== 'id');

    const push = useCallback((msg: ChatMsg) => {
        setChatMsgs(p => [...p, msg]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }, []);

    const markDone = (op: string) => setDoneOps(p => { const n = new Set(p); n.add(op); doneRef.current = n; return n; });

    /* ── Helpers for computing issues from fresh data ── */
    function countNulls(d: DataRow[], dc: string[]) {
        return dc.reduce((s, c) => s + d.filter(r => r[c] == null || String(r[c]).trim() === '').length, 0);
    }
    function countDupes(d: DataRow[], dc: string[]) {
        const seen = new Set<string>(); let n = 0;
        d.forEach(r => { const k = dc.map(c => String(r[c] ?? '')).join('|'); if (seen.has(k)) n++; else seen.add(k); });
        return n;
    }
    function countNumStr(d: DataRow[], dc: string[]) {
        return dc.reduce((s, c) => s + d.filter(r => typeof r[c] === 'string' && r[c].trim() !== '' && !isNaN(Number(r[c]))).length, 0);
    }
    function countUntrimmed(d: DataRow[], dc: string[]) {
        return dc.reduce((s, c) => s + d.filter(r => typeof r[c] === 'string' && r[c] !== r[c].trim()).length, 0);
    }

    /* ── Build next actions based on data state (max 3, skip done) ── */
    function buildNextActions(): ChatAction[] {
        const d = dataRef.current; const dc = getdc(); const done = doneRef.current;
        const acts: ChatAction[] = [];
        // Data cleaning actions (only if issues remain)
        if (!done.has('nulls') && countNulls(d, dc) > 0) acts.push({ label: 'Handle Missing Values', id: 'nulls' });
        if (!done.has('dupes') && countDupes(d, dc) > 0) acts.push({ label: 'Remove Duplicates', id: 'dupes' });
        if (!done.has('types') && countNumStr(d, dc) > 0) acts.push({ label: 'Convert Data Types', id: 'types' });
        if (!done.has('text') && countUntrimmed(d, dc) > 0) acts.push({ label: 'Clean Text', id: 'text' });
        if (!done.has('scan')) acts.push({ label: 'Detect Outliers', id: 'scan' });
        // If no cleaning needed, offer analysis actions
        if (acts.length === 0) {
            acts.push({ label: 'Show Data Summary', id: 'summary' });
            acts.push({ label: 'Generate Insights', id: 'insights' });
            acts.push({ label: 'Save Dataset', id: 'save' });
        } else {
            acts.push({ label: 'Show Data Summary', id: 'summary' });
        }
        return acts.slice(0, 3);
    }

    /* ── Load ── */
    useEffect(() => {
        (async () => {
            try {
                const r = await apiClient.get('/data/datasets');
                if (r?.length) { setDatasets(r.map((d: any) => ({ id: d.id, name: d.name }))); loadDs(r[0]); }
                else showToast('No datasets found.', 'info');
            } catch { showToast('Failed to load.', 'error'); }
            finally { setLoading(false); }
        })();
    }, []);

    const loadDs = useCallback((ds: any) => {
        setDsId(ds.id); setDsName(ds.name);
        setSelectedRows(new Set()); setSortCol(null); setColFilters({});
        const newDone = new Set<string>();
        setDoneOps(newDone); doneRef.current = newDone;
        const raw: any[] = typeof ds.rawData === 'string' ? JSON.parse(ds.rawData) : ds.rawData;
        if (raw.length) {
            const keys = new Set<string>();
            raw.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
            const cols = Array.from(keys).filter(k => !k.startsWith('_'));
            if (!cols.includes('id')) cols.unshift('id');
            setColumns(cols); colsRef.current = cols;
            const rows = raw.map((r, i) => ({ ...r, _rid: r.id?.toString() ?? `r${i}` }));
            setData(rows); dataRef.current = rows;

            // Welcome
            const dc = cols.filter(c => c !== 'id');
            const nulls = countNulls(rows, dc);
            const dupes = countDupes(rows, dc);
            const numStr = countNumStr(rows, dc);
            const untrimmed = countUntrimmed(rows, dc);

            const issues: string[] = [];
            if (nulls > 0) issues.push(`• **${nulls}** missing values across columns`);
            if (dupes > 0) issues.push(`• **${dupes}** duplicate rows`);
            if (numStr > 0) issues.push(`• **${numStr}** numbers stored as text`);
            if (untrimmed > 0) issues.push(`• **${untrimmed}** cells with extra whitespace`);

            const text = `👋 Hi! I've loaded your dataset **"${ds.name}"**.\n\n📊 **Dataset Overview:**\n• **${rows.length}** rows and **${dc.length}** columns\n• Columns: ${dc.map(c => `\`${c}\``).join(', ')}\n\n${issues.length ? `⚠️ **Issues Found:**\n${issues.join('\n')}\n\nI recommend we start by cleaning the most critical issues first. What would you like to do?` : '✅ Your data looks clean! No obvious issues found.\n\nWould you like me to run a deeper analysis?'}`;

            const acts: ChatAction[] = [];
            if (nulls > 0) acts.push({ label: 'Handle Missing Values', id: 'nulls' });
            if (dupes > 0) acts.push({ label: 'Remove Duplicates', id: 'dupes' });
            if (numStr > 0) acts.push({ label: 'Convert Data Types', id: 'types' });
            if (acts.length === 0) acts.push({ label: 'Detect Outliers', id: 'scan' });
            acts.push({ label: 'Show Data Summary', id: 'summary' });

            setChatMsgs([{ role: 'ai', text, actions: acts.slice(0, 3) }]);
        } else { setColumns([]); setData([]); setChatMsgs([{ role: 'ai', text: 'No data loaded. Please ingest a dataset from the Ingestion page first.' }]); }
    }, []);

    const switchDs = async (id: string) => {
        setLoading(true);
        try { const r = await apiClient.get('/data/datasets'); const d = r.find((x: any) => x.id === id); if (d) loadDs(d); }
        catch { showToast('Failed.', 'error'); }
        finally { setLoading(false); }
    };

    /* ── Handle action button click: show as user msg → then execute ── */
    function handleAction(action: ChatAction) {
        push({ role: 'user', text: action.label });
        setTimeout(() => executeAction(action.id), 50);
    }

    function executeAction(id: string) {
        switch (id) {
            case 'nulls': suggestNullOptions(); break;
            case 'dupes': execDupes(); break;
            case 'types': execTypes(); break;
            case 'text': execText(); break;
            case 'scan': doAnalysis(); break;
            case 'summary': showSummary(); break;
            case 'fill-default': execFillDefaults(); break;
            case 'fill-mean': execFillMean(); break;
            case 'fill-mode': execFillMode(); break;
            case 'trim': execTrim(); break;
            case 'lowercase': execLower(); break;
            case 'fix-all': execAcceptAll(); break;
            case 'dismiss-all': execDismissAll(); break;
            case 'save': handleSave(); break;
            case 'insights': generateInsights(); break;
            case 'query': startCustomQuery(); break;
            default: break;
        }
    }

    /* ════════════════════════════════════
       OPERATIONS
    ════════════════════════════════════ */

    function suggestNullOptions() {
        const d = dataRef.current; const dc = getdc();
        const total = countNulls(d, dc);
        if (total === 0) {
            markDone('nulls');
            push({ role: 'ai', text: '✅ Great news! There are **no missing values** in your dataset. Everything looks complete.\n\nWhat would you like to do next?', actions: buildNextActions() });
            return;
        }
        const colInfo = dc.map(c => ({ col: c, n: d.filter(r => r[c] == null || String(r[c]).trim() === '').length })).filter(x => x.n > 0);
        const details = colInfo.map(x => `  • \`${x.col}\`: **${x.n}** missing`).join('\n');

        push({
            role: 'ai',
            text: `📋 **Missing Values Analysis**\n\nI found **${total} missing values** in your dataset:\n\n${details}\n\nThere are several ways to handle this. Which approach would you prefer?`,
            actions: [
                { label: 'Fill with Defaults (0 / N/A)', id: 'fill-default' },
                { label: 'Fill with Column Average', id: 'fill-mean' },
                { label: 'Fill with Most Common Value', id: 'fill-mode' },
            ]
        });
    }

    function execFillDefaults() {
        const dc = getdc(); const d = dataRef.current; let n = 0;
        const out = d.map(r => {
            const u = { ...r };
            dc.forEach(c => {
                if (u[c] == null || String(u[c]).trim() === '') {
                    const sample = d.find(x => x[c] != null && String(x[c]).trim() !== '')?.[c];
                    u[c] = (sample !== undefined && !isNaN(Number(sample))) ? 0 : 'N/A'; n++;
                }
            }); return u;
        });
        setData(out); dataRef.current = out; markDone('nulls');
        push({ role: 'ai', text: `✅ **Done!** I filled **${n} missing cells** with default values.\n\n📊 **Impact:**\n• Numeric columns → filled with **0**\n• Text columns → filled with **"N/A"**\n• Your dataset now has **0 missing values**\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execFillMean() {
        const dc = getdc(); const d = dataRef.current; let n = 0;
        const means: Record<string, number> = {};
        dc.forEach(c => {
            const nums = d.map(r => r[c]).filter(v => v != null && String(v).trim() !== '' && !isNaN(Number(v))).map(Number);
            if (nums.length) means[c] = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
        });
        const out = d.map(r => {
            const u = { ...r };
            dc.forEach(c => { if (u[c] == null || String(u[c]).trim() === '') { u[c] = means[c] !== undefined ? means[c] : 'N/A'; n++; } });
            return u;
        });
        const meanInfo = Object.entries(means).map(([k, v]) => `  • \`${k}\` → **${v}**`).join('\n');
        setData(out); dataRef.current = out; markDone('nulls');
        push({ role: 'ai', text: `✅ **Done!** I filled **${n} missing cells** using column averages.\n\n📊 **Values used:**\n${meanInfo || '  • Non-numeric columns → "N/A"'}\n\nThis helps maintain the statistical distribution of your data.\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execFillMode() {
        const dc = getdc(); const d = dataRef.current; let n = 0;
        const modes: Record<string, any> = {};
        dc.forEach(c => {
            const freq: Record<string, number> = {};
            d.forEach(r => { const v = r[c]; if (v != null && String(v).trim() !== '') { const k = String(v); freq[k] = (freq[k] || 0) + 1; } });
            const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
            if (sorted.length) modes[c] = sorted[0][0];
        });
        const out = d.map(r => {
            const u = { ...r };
            dc.forEach(c => {
                if (u[c] == null || String(u[c]).trim() === '') {
                    if (modes[c] !== undefined) { u[c] = !isNaN(Number(modes[c])) ? Number(modes[c]) : modes[c]; n++; }
                    else { u[c] = 'N/A'; n++; }
                }
            }); return u;
        });
        setData(out); dataRef.current = out; markDone('nulls');
        push({ role: 'ai', text: `✅ **Done!** I filled **${n} missing cells** using the most frequently occurring value in each column.\n\n📊 **Impact:** The mode-fill strategy preserves the most common patterns in your data.\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execDupes() {
        const dc = getdc(); const d = dataRef.current;
        const dupeCount = countDupes(d, dc);
        if (dupeCount === 0) {
            markDone('dupes');
            push({ role: 'ai', text: '✅ **No duplicates found!** Every row in your dataset is unique.\n\nWhat would you like to do next?', actions: buildNextActions() });
            return;
        }
        const seen = new Set<string>();
        const unique = d.filter(r => { const k = dc.map(c => String(r[c] ?? '')).join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
        const removed = d.length - unique.length;
        setData(unique); dataRef.current = unique; markDone('dupes');
        push({ role: 'ai', text: `✅ **Done!** I removed **${removed} duplicate rows** from your dataset.\n\n📊 **Impact:**\n• Before: **${d.length}** rows\n• After: **${unique.length}** rows\n• Removed: **${removed}** exact duplicates\n\nYour dataset now contains only unique records.\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execTypes() {
        const dc = getdc(); const d = dataRef.current; let n = 0;
        const count = countNumStr(d, dc);
        if (count === 0) {
            markDone('types');
            push({ role: 'ai', text: '✅ All data types are already correct!\n\nWhat would you like to do next?', actions: buildNextActions() });
            return;
        }
        const out = d.map(r => { const u = { ...r }; dc.forEach(c => { if (typeof u[c] === 'string' && u[c].trim() !== '' && !isNaN(Number(u[c]))) { u[c] = Number(u[c]); n++; } }); return u; });
        setData(out); dataRef.current = out; markDone('types');
        push({ role: 'ai', text: `✅ **Done!** I converted **${n} cells** from text to proper numeric format.\n\n📊 **Impact:** Values like "42" are now stored as the number 42, enabling proper calculations and analysis.\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execText() {
        const dc = getdc();
        const d = dataRef.current;
        const untrimmed = countUntrimmed(d, dc);
        if (untrimmed === 0) {
            markDone('text');
            push({ role: 'ai', text: '✅ All text values are already clean!\n\nWhat would you like to do next?', actions: buildNextActions() });
            return;
        }
        push({
            role: 'ai',
            text: `📋 **Text Cleaning**\n\nI found **${untrimmed} cells** with extra leading or trailing spaces.\n\nHow would you like to clean the text?`,
            actions: [
                { label: 'Trim Whitespace', id: 'trim' },
                { label: 'Convert to Lowercase', id: 'lowercase' },
            ]
        });
    }

    function execTrim() {
        const dc = getdc(); const d = dataRef.current; let n = 0;
        const out = d.map(r => { const u = { ...r }; dc.forEach(c => { if (typeof u[c] === 'string' && u[c] !== u[c].trim()) { u[c] = u[c].trim(); n++; } }); return u; });
        setData(out); dataRef.current = out; markDone('text');
        push({ role: 'ai', text: `✅ **Done!** I trimmed extra whitespace from **${n} cells**.\n\n📊 **Impact:** All text values are now clean — no hidden spaces that could cause matching issues.\n\nWhat would you like to do next?`, actions: buildNextActions() });
    }

    function execLower() {
        const dc = getdc(); const d = dataRef.current;
        const out = d.map(r => { const u = { ...r }; dc.forEach(c => { if (typeof u[c] === 'string') u[c] = u[c].toLowerCase(); }); return u; });
        setData(out); dataRef.current = out; markDone('text');
        push({ role: 'ai', text: '✅ **Done!** All text values have been converted to lowercase.\n\n📊 **Impact:** This ensures consistent text formatting — "Apple", "APPLE", and "apple" are now all treated the same.\n\nWhat would you like to do next?', actions: buildNextActions() });
    }

    function showSummary() {
        const d = dataRef.current; const dc = getdc();
        const nulls = countNulls(d, dc);
        const dupes = countDupes(d, dc);
        const numStr = countNumStr(d, dc);
        const untrimmed = countUntrimmed(d, dc);
        const clean = nulls === 0 && dupes === 0 && numStr === 0 && untrimmed === 0;

        const stats: string[] = [];
        dc.forEach(c => {
            const nums = d.map(r => r[c]).filter(v => v != null && !isNaN(Number(v))).map(Number);
            if (nums.length > 0) {
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                const avg = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
                stats.push(`  • \`${c}\`: min **${min}**, max **${max}**, avg **${avg}**`);
            }
        });
        const statsBlock = stats.length > 0 ? `\n📈 **Column Statistics:**\n${stats.join('\n')}\n` : '';

        push({
            role: 'ai',
            text: `📊 **Data Summary**\n\n• **Rows:** ${d.length}\n• **Columns:** ${dc.length} (${dc.map(c => `\`${c}\``).join(', ')})\n• **Missing Values:** ${nulls === 0 ? '✅ None' : `⚠️ ${nulls}`}\n• **Duplicates:** ${dupes === 0 ? '✅ None' : `⚠️ ${dupes}`}\n• **Type Issues:** ${numStr === 0 ? '✅ None' : `⚠️ ${numStr} numeric strings`}\n• **Whitespace:** ${untrimmed === 0 ? '✅ Clean' : `⚠️ ${untrimmed} cells`}${statsBlock}\n${clean ? '🎉 **Your dataset is clean and well-structured!** No issues detected.\n\nIf you have any additional analysis or transformations in mind, I\'m here to help.' : 'There are still some issues to address. I recommend fixing them before analysis.'}\n\nWhat would you like to do?`,
            actions: clean
                ? [{ label: 'Generate Insights', id: 'insights' }, { label: 'Save Dataset', id: 'save' }]
                : buildNextActions()
        });
    }

    /* ── AI Deep Scan ── */
    async function doAnalysis() {
        // Prevent repeated scans — AI is non-deterministic and keeps inventing new anomalies
        if (doneRef.current.has('scan')) {
            push({
                role: 'ai',
                text: '✅ Your data has already been scanned and all detected anomalies were addressed.\n\nThe dataset is clean — no further anomaly detection is needed.\n\nWhat would you like to do?',
                actions: [
                    { label: 'Show Data Summary', id: 'summary' },
                    { label: 'Generate Insights', id: 'insights' },
                    { label: 'Save Dataset', id: 'save' },
                ]
            });
            return;
        }
        setChatBusy(true);
        push({ role: 'ai', text: '🔍 Running AI-powered anomaly detection on your data. This may take a moment...' });
        const d = dataRef.current;
        const cleaned = d.map(r => { const u = { ...r }; delete u._flag; delete u._reason; delete u._field; delete u._fix; return u; });
        try {
            const payload = cleaned.map(r => { const c: any = {}; colsRef.current.forEach(k => c[k] = r[k]); return c; });
            const result = await apiClient.post('/ai/analyze', { rawData: payload });
            if (result?.anomalies?.length) {
                anomaliesRef.current = result.anomalies;
                // Match anomalies to rows by id, 0-based index, or 1-based index
                const updated = cleaned.map((r, idx) => {
                    const f = result.anomalies.find((a: any) =>
                        String(a.id) === String(r.id ?? r._rid) ||
                        String(a.id) === String(idx) ||
                        String(a.id) === String(idx + 1)
                    );
                    return f ? { ...r, _flag: true, _reason: f.reason, _field: f.field, _fix: f.suggestedFix } : r;
                });
                setData(updated); dataRef.current = updated;
                const total = result.anomalies.length;
                const shown = result.anomalies.slice(0, 5);
                const list = shown.map((a: any) =>
                    `  • **Row ${a.id}**, column \`${a.field}\`: ${a.reason}${a.suggestedFix !== undefined ? `\n    → Suggested fix: \`${a.suggestedFix}\`` : ''}`
                ).join('\n');
                const moreText = total > 5 ? `\n\n_...and **${total - 5} more** anomalies detected._` : '';
                markDone('scan');
                push({
                    role: 'ai',
                    text: `🔍 **Anomaly Detection Complete**\n\nI detected **${total} anomal${total > 1 ? 'ies' : 'y'}** in your dataset:\n\n${list}${moreText}\n\nI can apply all the suggested fixes automatically, or you can dismiss them and review manually.\n\nWhat would you like to do?`,
                    actions: [
                        { label: 'Accept All Fixes', id: 'fix-all' },
                        { label: 'Dismiss All', id: 'dismiss-all' },
                    ]
                });
            } else {
                anomaliesRef.current = [];
                setData(cleaned); dataRef.current = cleaned;
                markDone('scan');
                push({
                    role: 'ai',
                    text: '✅ **Anomaly Detection Complete**\n\nYour dataset looks clean — no anomalies or outliers were detected. The data is consistent and well-structured.\n\nIf you have any additional analysis or transformations in mind, you can ask me.\n\nWhat would you like to do next?',
                    actions: [
                        { label: 'Show Data Summary', id: 'summary' },
                        { label: 'Generate Insights', id: 'insights' },
                        { label: 'Save Dataset', id: 'save' },
                    ]
                });
            }
        } catch { push({ role: 'ai', text: '⚠️ The AI service is currently unavailable. Please try again in a moment.' }); }
        finally { setChatBusy(false); }
    }

    function execAcceptAll() {
        const d = dataRef.current;
        const anomalies = anomaliesRef.current;
        let n = 0;
        // Apply fixes: try matching by _flag first, then by anomaly id/index
        const out = d.map((r, idx) => {
            // Check if row has a flag from doAnalysis
            if (r._flag && r._field && r._fix !== undefined) {
                n++;
                const u = { ...r, [r._field]: r._fix };
                delete u._flag; delete u._reason; delete u._field; delete u._fix;
                return u;
            }
            // Fallback: match from stored anomalies by id or index
            const a = anomalies.find((an: any) =>
                String(an.id) === String(r.id ?? r._rid) ||
                String(an.id) === String(idx) ||
                String(an.id) === String(idx + 1)
            );
            if (a && a.field && a.suggestedFix !== undefined) {
                n++;
                const u = { ...r, [a.field]: a.suggestedFix };
                delete u._flag; delete u._reason; delete u._field; delete u._fix;
                return u;
            }
            // Clean up any leftover flags
            const u = { ...r }; delete u._flag; delete u._reason; delete u._field; delete u._fix;
            return u;
        });
        setData(out); dataRef.current = out;
        anomaliesRef.current = [];

        const dc = getdc();
        const stillDirty = countNulls(out, dc) > 0 || countDupes(out, dc) > 0 || countNumStr(out, dc) > 0;

        const cleanMsg = stillDirty
            ? 'There are still some data quality issues remaining. Would you like to address them?'
            : 'Your dataset now contains **no detected anomalies** and is ready for analysis.';

        push({
            role: 'ai',
            text: `✅ **Fixes Applied!**\n\nI corrected **${n} anomalous value${n !== 1 ? 's' : ''}** in your dataset.\n\n📊 **Impact:** Each flagged value has been replaced with an AI-suggested correction to improve data quality.\n\n${cleanMsg}\n\nWhat would you like to do next?`,
            actions: stillDirty ? buildNextActions() : [
                { label: 'Show Data Summary', id: 'summary' },
                { label: 'Generate Insights', id: 'insights' },
                { label: 'Save Dataset', id: 'save' },
            ]
        });
    }

    function execDismissAll() {
        const d = dataRef.current;
        const out = d.map(r => { const u = { ...r }; delete u._flag; delete u._reason; delete u._field; delete u._fix; return u; });
        setData(out); dataRef.current = out;
        push({
            role: 'ai',
            text: 'Understood! I\'ve dismissed all flagged anomalies. No changes were made to your data.\n\nIf you\'d like to perform any other analysis or transformations, just let me know.\n\nWhat would you like to do next?',
            actions: [
                { label: 'Show Data Summary', id: 'summary' },
                { label: 'Generate Insights', id: 'insights' },
                { label: 'Save Dataset', id: 'save' },
            ]
        });
    }

    /* ── Manual tools ── */
    function manualDelete() {
        if (!selectedRows.size) { showToast('Select rows first.', 'info'); return; }
        const n = selectedRows.size;
        const newData = dataRef.current.filter(r => !selectedRows.has(r._rid));
        setData(newData); dataRef.current = newData;
        setSelectedRows(new Set());
        push({ role: 'ai', text: `✅ Deleted **${n} selected row(s)**. Your dataset now has **${newData.length}** rows.` });
    }
    function manualAddRow() {
        const dc = getdc();
        const nr: DataRow = { _rid: `new-${Date.now()}`, id: `new-${Date.now()}` };
        dc.forEach(c => nr[c] = '');
        const newData = [...dataRef.current, nr];
        setData(newData); dataRef.current = newData;
        push({ role: 'ai', text: '✅ Added a new empty row at the bottom. You can click any cell to edit it.' });
    }

    /* ── Generate Insights (AI-powered) ── */
    async function generateInsights() {
        setChatBusy(true);
        push({ role: 'ai', text: '💡 Analyzing your data to generate insights...' });
        try {
            const d = dataRef.current; const dc = getdc();
            const sample = d.slice(0, 10).map(r => { const c: any = {}; dc.forEach(k => c[k] = r[k]); return c; });
            const ctx = `You are an AI data analyst. Dataset: "${dsName}", ${d.length} rows, columns: ${dc.join(', ')}. Sample data: ${JSON.stringify(sample)}. Provide 3-4 key insights about this data. Be specific with numbers and patterns you observe. Format each insight as a bullet point. Keep it concise.`;
            const result = await apiClient.post('/ai/chat', { message: ctx });
            push({
                role: 'ai',
                text: `💡 **Data Insights**\n\n${result?.reply || 'Unable to generate insights at this time.'}\n\nWould you like to explore further?`,
                actions: [
                    { label: 'Show Data Summary', id: 'summary' },
                    { label: 'Save Dataset', id: 'save' },
                ]
            });
        } catch { push({ role: 'ai', text: '⚠️ AI service unavailable. Please try again.' }); }
        finally { setChatBusy(false); }
    }

    /* ── Custom Query placeholder ── */
    function startCustomQuery() {
        push({
            role: 'ai',
            text: '💬 Sure! Just type your question about the data in the chat below.\n\nFor example:\n• "What is the average age?"\n• "How many active users?"\n• "Show me rows where total_spent > 5000"\n\nI\'ll analyze your data and respond.',
        });
    }

    /* ── Free-form chat + command detection ── */
    async function handleSend() {
        if (!chatInput.trim()) return;
        const raw = chatInput.trim(); const msg = raw.toLowerCase();
        push({ role: 'user', text: raw }); setChatInput('');

        // Command matching
        if (msg.includes('missing') || msg.includes('null') || msg.includes('empty')) { suggestNullOptions(); return; }
        if (msg.includes('duplicate') || msg.includes('dupe')) { execDupes(); return; }
        if (msg.includes('type') || msg.includes('convert') || msg.includes('numeric')) { execTypes(); return; }
        if (msg.includes('trim') || msg.includes('whitespace') || msg.includes('clean text')) { execText(); return; }
        if (msg.includes('lowercase') || msg.includes('lower case')) { execLower(); return; }
        if (msg.includes('outlier') || msg.includes('anomal') || msg.includes('scan') || msg.includes('detect') || msg.includes('analyz')) { doAnalysis(); return; }
        if (msg.includes('delete') || msg.includes('remove selected')) { manualDelete(); return; }
        if (msg.includes('add row') || msg.includes('new row')) { manualAddRow(); return; }
        if (msg.includes('save') || msg.includes('persist')) { handleSave(); return; }
        if (msg.includes('summary') || msg.includes('status') || msg.includes('overview')) { showSummary(); return; }
        if (msg.includes('insight') || msg.includes('pattern') || msg.includes('trend')) { generateInsights(); return; }
        if (msg.includes('help') || msg.includes('what can') || msg.includes('option')) {
            push({ role: 'ai', text: 'Here\'s what I can help you with right now:', actions: buildNextActions() }); return;
        }

        // Free-form AI
        setChatBusy(true);
        try {
            const ctx = `You are an AI data preprocessing assistant. Dataset: "${dsName}", ${dataRef.current.length} rows, columns: ${colsRef.current.join(', ')}. Sample: ${JSON.stringify(dataRef.current.slice(0, 3).map(r => { const c: any = {}; colsRef.current.forEach(k => c[k] = r[k]); return c; }))}. Respond conversationally. Available commands the user can type: "handle missing values", "remove duplicates", "convert data types", "clean text", "detect outliers", "show data summary", "save". Guide them naturally.`;
            const result = await apiClient.post('/ai/chat', { message: `${ctx}\n\nUser: ${raw}` });
            push({ role: 'ai', text: result?.reply || 'I couldn\'t process that request. Could you rephrase?', actions: buildNextActions() });
        } catch { push({ role: 'ai', text: '⚠️ AI service is currently unavailable. Please try again.' }); }
        finally { setChatBusy(false); }
    }

    /* ── Save ── */
    async function handleSave() {
        if (!dsId) return; setSaving(true);
        try {
            const clean = dataRef.current.map(r => { const c: any = {}; colsRef.current.forEach(k => c[k] = r[k]); return c; });
            await apiClient.patch(`/data/datasets/${dsId}`, { rawData: clean });
            push({ role: 'ai', text: `💾 **Dataset saved successfully!**\n\nYour cleaned data has been persisted to the database. You can now use it across other platform features like Contracts and Analytics.` });
            showToast('Saved!', 'success');
        } catch { push({ role: 'ai', text: '⚠️ Failed to save. Please try again.' }); showToast('Save failed.', 'error'); }
        finally { setSaving(false); }
    }

    /* ── View helpers ── */
    const dataCols = columns.filter(c => c !== 'id');
    const viewData = useMemo(() => {
        let d = [...data];
        Object.entries(colFilters).forEach(([col, val]) => { if (val.trim()) d = d.filter(r => String(r[col] ?? '').toLowerCase().includes(val.toLowerCase())); });
        if (sortCol) d.sort((a, b) => {
            const va = a[sortCol!], vb = b[sortCol!];
            if (va == null) return 1; if (vb == null) return -1;
            if (!isNaN(Number(va)) && !isNaN(Number(vb))) return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
            return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        return d;
    }, [data, colFilters, sortCol, sortAsc]);

    function startEdit(rid: string, col: string, val: any) { if (col === 'id') return; setEditCell({ rid, col }); setEditVal(val ?? ''); }
    function saveEdit(rid: string, col: string) { setData(prev => prev.map(r => r._rid !== rid ? r : { ...r, [col]: editVal })); setEditCell(null); }
    function togRow(rid: string) { setSelectedRows(p => { const n = new Set(p); n.has(rid) ? n.delete(rid) : n.add(rid); return n; }); }
    function togAll() { setSelectedRows(selectedRows.size === viewData.length ? new Set() : new Set(viewData.map(r => r._rid))); }

    /* ── RENDER ── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 4rem)', gap: '0.5rem' }}>
            {/* Top */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} color="var(--primary-color)" />
                    <select className="input-field" style={{ maxWidth: '250px', fontWeight: 600, fontSize: '0.82rem' }} value={dsId} onChange={e => switchDs(e.target.value)}>
                        {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{data.length} rows · {dataCols.length} cols</span>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button onClick={manualDelete} disabled={!selectedRows.size} title="Delete selected"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.3rem 0.5rem', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', cursor: !selectedRows.size ? 'not-allowed' : 'pointer', opacity: !selectedRows.size ? 0.4 : 1 }}>
                        <Trash2 size={11} />{selectedRows.size > 0 ? ` ${selectedRows.size}` : ''}
                    </button>
                    <button onClick={manualAddRow} title="Add row" style={{ display: 'flex', alignItems: 'center', padding: '0.3rem 0.5rem', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', cursor: 'pointer' }}>
                        <PlusCircle size={11} />
                    </button>
                    <button onClick={() => setShowFilters(!showFilters)} title="Toggle filters" style={{ display: 'flex', alignItems: 'center', padding: '0.3rem 0.5rem', fontSize: '0.72rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: showFilters ? 'var(--primary-light)' : 'var(--bg-color)', cursor: 'pointer' }}>
                        <Filter size={11} />
                    </button>
                    {Object.values(colFilters).some(v => v) && <button onClick={() => setColFilters({})} style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)', cursor: 'pointer' }}><X size={11} /></button>}
                    <Button variant="primary" icon={<Save size={13} />} onClick={handleSave} disabled={saving} style={{ fontSize: '0.78rem' }}>{saving ? '...' : 'Save'}</Button>
                </div>
            </div>

            {/* Main */}
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minHeight: 0 }}>
                {/* Table */}
                <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <CardContent style={{ flex: 1, padding: 0, overflow: 'auto', minHeight: 0 }}>
                        {loading ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div> :
                            !data.length ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No data available.</div> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 3 }}>
                                            <th style={{ padding: '0.4rem', borderBottom: '2px solid var(--border-color)', width: '30px', textAlign: 'center' }}>
                                                <input type="checkbox" checked={selectedRows.size === viewData.length && viewData.length > 0} onChange={togAll} style={{ accentColor: 'var(--primary-color)' }} />
                                            </th>
                                            <th style={{ padding: '0.4rem', borderBottom: '2px solid var(--border-color)', width: '26px', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>#</th>
                                            {columns.map(c => (
                                                <th key={c} onClick={() => { setSortCol(c); setSortAsc(sortCol === c ? !sortAsc : true); }}
                                                    style={{ padding: '0.4rem 0.5rem', borderBottom: '2px solid var(--border-color)', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', fontSize: '0.72rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                        {c} {sortCol === c ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : <ArrowUpDown size={8} color="var(--text-secondary)" />}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                        {showFilters && (
                                            <tr style={{ position: 'sticky', top: '30px', backgroundColor: 'var(--bg-color)', zIndex: 2 }}>
                                                <th colSpan={2} />
                                                {columns.map(c => (
                                                    <th key={c} style={{ padding: '0.2rem 0.3rem' }}>
                                                        <input className="input-field" placeholder="..." style={{ fontSize: '0.68rem', padding: '0.2rem 0.35rem', width: '100%' }}
                                                            value={colFilters[c] || ''} onChange={e => setColFilters(p => ({ ...p, [c]: e.target.value }))} />
                                                    </th>
                                                ))}
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {viewData.map((row, idx) => (
                                            <tr key={row._rid} style={{ backgroundColor: selectedRows.has(row._rid) ? 'rgba(79,70,229,0.04)' : row._flag ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                                                <td style={{ padding: '0.3rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                                                    <input type="checkbox" checked={selectedRows.has(row._rid)} onChange={() => togRow(row._rid)} style={{ accentColor: 'var(--primary-color)' }} />
                                                </td>
                                                <td style={{ padding: '0.3rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{idx + 1}</td>
                                                {columns.map(c => {
                                                    const editing = editCell?.rid === row._rid && editCell.col === c;
                                                    const flagged = row._flag && row._field === c;
                                                    const empty = row[c] == null || String(row[c]).trim() === '';
                                                    return (
                                                        <td key={c} onClick={() => startEdit(row._rid, c, row[c])}
                                                            style={{
                                                                padding: editing ? 0 : '0.3rem 0.5rem', borderBottom: '1px solid var(--border-color)',
                                                                color: flagged ? 'var(--danger-color)' : empty ? 'var(--text-secondary)' : 'inherit',
                                                                fontWeight: flagged ? 600 : 400, fontStyle: empty ? 'italic' : 'normal',
                                                                cursor: c === 'id' ? 'default' : 'text',
                                                                outline: editing ? '2px solid var(--primary-color)' : 'none', outlineOffset: '-2px',
                                                                whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis'
                                                            }}>
                                                            {editing ? (
                                                                <input autoFocus style={{ width: '100%', padding: '0.3rem 0.5rem', border: 'none', outline: 'none', background: 'transparent', fontSize: 'inherit' }}
                                                                    value={editVal} onChange={e => setEditVal(e.target.value)}
                                                                    onBlur={() => saveEdit(row._rid, c)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(row._rid, c); if (e.key === 'Escape') setEditCell(null); }} />
                                                            ) : empty ? 'null' : String(row[c])}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                    </CardContent>
                </Card>

                {/* Chat */}
                <Card style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <CardHeader style={{ padding: '0.6rem 0.75rem', flexShrink: 0, borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                            <Sparkles size={15} color="var(--primary-color)" /> AI Data Assistant
                        </div>
                    </CardHeader>
                    <CardContent style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {chatMsgs.map((m, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.3rem' }}>
                                    <div style={{
                                        maxWidth: '95%', padding: '0.5rem 0.65rem',
                                        borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                                        fontSize: '0.76rem', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                                        backgroundColor: m.role === 'user' ? 'var(--primary-color)' : 'var(--bg-secondary)',
                                        color: m.role === 'user' ? 'white' : 'inherit'
                                    }}>
                                        {m.text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
                                            part.startsWith('**') && part.endsWith('**')
                                                ? <strong key={j}>{part.slice(2, -2)}</strong>
                                                : part.split(/(`[^`]+`)/g).map((sub, k) =>
                                                    sub.startsWith('`') && sub.endsWith('`')
                                                        ? <code key={k} style={{ backgroundColor: m.role === 'user' ? 'rgba(255,255,255,0.2)' : 'var(--bg-color)', padding: '0 3px', borderRadius: '3px', fontSize: '0.72rem' }}>{sub.slice(1, -1)}</code>
                                                        : sub
                                                )
                                        )}
                                    </div>
                                    {m.actions && m.actions.length > 0 && (
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '95%' }}>
                                            {m.actions.map((a, j) => (
                                                <button key={j} onClick={() => handleAction(a)}
                                                    style={{ padding: '0.3rem 0.55rem', fontSize: '0.7rem', borderRadius: '8px', border: '1px solid var(--primary-color)', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', transition: 'all 0.12s' }}>
                                                    {a.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {chatBusy && (
                                <div style={{ padding: '0.5rem 0.65rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', fontSize: '0.75rem', alignSelf: 'flex-start' }}>
                                    <span className="spinner" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--primary-color)', borderTopColor: 'transparent', borderRadius: '50%', marginRight: '0.3rem', verticalAlign: 'middle' }} /> Analyzing...
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={e => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '0.3rem', padding: '0.4rem 0.5rem', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                            <input className="input-field" style={{ flex: 1, fontSize: '0.76rem', padding: '0.4rem 0.6rem' }}
                                placeholder="Ask me anything about your data..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={chatBusy} />
                            <button type="submit" disabled={chatBusy || !chatInput.trim()}
                                style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', cursor: chatBusy || !chatInput.trim() ? 'not-allowed' : 'pointer', opacity: chatBusy || !chatInput.trim() ? 0.5 : 1 }}>
                                <Send size={13} />
                            </button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
