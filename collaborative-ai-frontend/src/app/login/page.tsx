'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import './login.css';

export default function LoginPage() {
    const { login, register, isLoading } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('Data Engineer');
    const [department, setDepartment] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        let result;
        if (mode === 'login') {
            result = await login(email, password);
        } else {
            if (!name.trim()) {
                setError('Name is required');
                setSubmitting(false);
                return;
            }
            result = await register(name, email, password, role, department || undefined);
        }

        if (!result.success) {
            setError(result.error || 'Something went wrong');
        }
        setSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="login-page">
                <div className="login-card" style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 40, height: 40, border: '3px solid #6366f1', borderTopColor: 'transparent', margin: '2rem auto' }} />
                    <p style={{ color: '#94a3b8' }}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand">
                    <h1>CollabAI Platform</h1>
                    <p>{mode === 'login' ? 'Sign in to your account' : 'Create a new account'}</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {mode === 'register' && (
                        <div className="login-field">
                            <label>Full Name</label>
                            <input
                                type="text"
                                placeholder="Alice Engineer"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="login-field">
                        <label>Email Address</label>
                        <input
                            type="email"
                            placeholder="alice@ecommerce.ai"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="login-field">
                                <label>Role</label>
                                <select value={role} onChange={e => setRole(e.target.value)}>
                                    <option>Data Engineer</option>
                                    <option>Data Analyst</option>
                                    <option>Business User</option>
                                    <option>Admin</option>
                                </select>
                            </div>
                            <div className="login-field">
                                <label>Department (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Engineering"
                                    value={department}
                                    onChange={e => setDepartment(e.target.value)}
                                />
                            </div>
                        </>
                    )}

                    {error && <div className="login-error">{error}</div>}

                    <button
                        type="submit"
                        className="login-submit"
                        disabled={submitting}
                    >
                        {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="login-toggle">
                    {mode === 'login' ? (
                        <>
                            Don&apos;t have an account?
                            <button onClick={() => { setMode('register'); setError(''); }}>Sign up</button>
                        </>
                    ) : (
                        <>
                            Already have an account?
                            <button onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
                        </>
                    )}
                </div>

                {mode === 'login' && (
                    <div className="login-demo-info">
                        <p style={{ marginBottom: '0.75rem' }}>Quick Login (Dev Mode):</p>
                        <div className="login-quick-btns">
                            <button type="button" onClick={() => login('alice@ecommerce.ai', 'password123')} title="Data Engineer">
                                Alice (Engineer)
                            </button>
                            <button type="button" onClick={() => login('bob@ecommerce.ai', 'password123')} title="Data Analyst">
                                Bob (Analyst)
                            </button>
                            <button type="button" onClick={() => login('charlie@ecommerce.ai', 'password123')} title="Business User">
                                Charlie (Biz)
                            </button>
                            <button type="button" onClick={() => login('admin@ecommerce.ai', 'password123')} title="Admin">
                                Admin Root
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
