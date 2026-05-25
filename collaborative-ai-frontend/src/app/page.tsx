'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    Database,
    FileJson,
    Wand2,
    GitMerge,
    Network,
    BarChart3,
    Shield,
    Bot,
    ArrowRight,
    ChevronRight,
    Layers,
    Server,
    Cpu,
    HardDrive,
    Code2,
    Zap,
    Users,
    Lock,
    CheckCircle2,
    Sparkles

} from 'lucide-react';
import './landing.css';

export default function LandingPage() {
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
        );

        document.querySelectorAll('.animate-on-scroll').forEach((el) => {
            observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, []);

    return (
        <div className="landing">
            {/* Background Effects */}
            <div className="landing-grid-bg" />
            <div className="landing-orb landing-orb--1" />
            <div className="landing-orb landing-orb--2" />
            <div className="landing-orb landing-orb--3" />

            {/* ── Navbar ── */}
            <nav className="landing-nav" id="landing-navbar">
                <div className="landing-nav-logo">
                    <div className="landing-nav-logo-icon">
                        <Sparkles size={18} />
                    </div>
                    <span className="landing-nav-logo-text">CollabAI</span>
                </div>

                <ul className="landing-nav-links">
                    <li><a href="#features">Features</a></li>
                    <li><a href="#architecture">Architecture</a></li>
                    <li><a href="#roles">Roles</a></li>
                    <li><a href="#tech-stack">Tech Stack</a></li>
                    <li>
                        <Link href="/login" className="landing-nav-cta" id="nav-get-started-btn">
                            Get Started
                        </Link>
                    </li>
                </ul>

                <button className="landing-nav-toggle" aria-label="Toggle menu">
                    <span /><span /><span />
                </button>
            </nav>

            {/* ── Hero ── */}
            <section className="landing-hero" id="hero">
                <div className="landing-hero-badge">
                    <span className="landing-hero-badge-dot" />
                    Multi-Role Collaborative Data Management
                </div>

                <h1>
                    Intelligent Data Platform
                    <br />
                    <span className="gradient-text">Powered by AI</span>
                </h1>

                <p className="landing-hero-sub">
                    A role-based collaborative platform for data ingestion, contract management,
                    AI-powered preprocessing, workflow orchestration, and real-time analytics —
                    all with an intelligent AI assistant built in.
                </p>

                <div className="landing-hero-ctas">
                    <Link href="/login" className="landing-btn-primary" id="hero-launch-btn">
                        Launch Platform <ArrowRight size={18} />
                    </Link>
                    <a href="#features" className="landing-btn-secondary" id="hero-explore-btn">
                        Explore Features <ChevronRight size={18} />
                    </a>
                </div>

                <div className="landing-hero-metrics">
                    <div className="landing-hero-metric">
                        <div className="landing-hero-metric-value">4</div>
                        <div className="landing-hero-metric-label">User Roles</div>
                    </div>
                    <div className="landing-hero-metric">
                        <div className="landing-hero-metric-value">7+</div>
                        <div className="landing-hero-metric-label">Core Modules</div>
                    </div>
                    <div className="landing-hero-metric">
                        <div className="landing-hero-metric-value">AI</div>
                        <div className="landing-hero-metric-label">Groq Powered</div>
                    </div>
                    <div className="landing-hero-metric">
                        <div className="landing-hero-metric-value">RBAC</div>
                        <div className="landing-hero-metric-label">Access Control</div>
                    </div>
                </div>
            </section>

            {/* ── Features Section ── */}
            <section className="landing-section" id="features">
                <div className="landing-section-header animate-on-scroll">
                    <span className="landing-section-label">Platform Features</span>
                    <h2 className="landing-section-title">Everything You Need for Data Collaboration</h2>
                    <p className="landing-section-desc">
                        From raw data ingestion to AI-driven insights — a complete pipeline managed through
                        role-based access and intelligent automation.
                    </p>
                </div>

                <div className="landing-features-grid">
                    <div className="landing-feature-card animate-on-scroll stagger-1">
                        <div className="landing-feature-icon landing-feature-icon--indigo">
                            <Database size={22} />
                        </div>
                        <h3>Data Ingestion</h3>
                        <p>
                            Upload CSV and Excel files with drag-and-drop. AI automatically infers
                            schema, detects data types, and flags quality issues in real time.
                        </p>
                    </div>

                    <div className="landing-feature-card animate-on-scroll stagger-2">
                        <div className="landing-feature-icon landing-feature-icon--cyan">
                            <FileJson size={22} />
                        </div>
                        <h3>Data Contracts</h3>
                        <p>
                            Define, version, and manage data contracts with AI-suggested schemas.
                            Enforce data quality standards across your organization.
                        </p>
                    </div>

                    <div className="landing-feature-card animate-on-scroll stagger-3">
                        <div className="landing-feature-icon landing-feature-icon--violet">
                            <Wand2 size={22} />
                        </div>
                        <h3>AI Preprocessing</h3>
                        <p>
                            Intelligent data cleaning, transformation, and anomaly detection.
                            Get AI-powered suggestions for data quality improvements.
                        </p>
                    </div>

                    <div className="landing-feature-card animate-on-scroll stagger-4">
                        <div className="landing-feature-icon landing-feature-icon--emerald">
                            <GitMerge size={22} />
                        </div>
                        <h3>Workflow Management</h3>
                        <p>
                            Create, assign, and track tasks across your team. Kanban-style board
                            with priorities, categories, and real-time progress tracking.
                        </p>
                    </div>

                    <div className="landing-feature-card animate-on-scroll stagger-5">
                        <div className="landing-feature-icon landing-feature-icon--amber">
                            <Network size={22} />
                        </div>
                        <h3>Data Lineage</h3>
                        <p>
                            Visualize end-to-end data flow from source to consumption. Track
                            transformations and dependencies across your data pipeline.
                        </p>
                    </div>

                    <div className="landing-feature-card animate-on-scroll stagger-6">
                        <div className="landing-feature-icon landing-feature-icon--rose">
                            <BarChart3 size={22} />
                        </div>
                        <h3>Analytics Dashboard</h3>
                        <p>
                            Rich charts and KPI tracking with Recharts. Monitor data quality,
                            user activity, revenue trends, and system health at a glance.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Architecture Section ── */}
            <section className="landing-section" id="architecture">
                <div className="landing-section-header animate-on-scroll">
                    <span className="landing-section-label">System Design</span>
                    <h2 className="landing-section-title">Modern Full-Stack Architecture</h2>
                    <p className="landing-section-desc">
                        Built with a decoupled frontend-backend design, JWT authentication,
                        and AI integration via Groq for intelligent data operations.
                    </p>
                </div>

                <div className="landing-arch">
                    <div className="landing-arch-visual animate-on-scroll">
                        <div className="landing-arch-diagram">
                            <div className="landing-arch-layers">
                                <div className="landing-arch-layer landing-arch-layer--frontend">
                                    <div className="landing-arch-layer-icon landing-arch-layer-icon--frontend">
                                        <Layers size={16} />
                                    </div>
                                    <div className="landing-arch-layer-info">
                                        <div className="landing-arch-layer-title">Frontend Layer</div>
                                        <div className="landing-arch-layer-tech">Next.js 16 · React 19 · TypeScript</div>
                                    </div>
                                </div>

                                <div className="landing-arch-connector" />

                                <div className="landing-arch-layer landing-arch-layer--api">
                                    <div className="landing-arch-layer-icon landing-arch-layer-icon--api">
                                        <Server size={16} />
                                    </div>
                                    <div className="landing-arch-layer-info">
                                        <div className="landing-arch-layer-title">API Layer</div>
                                        <div className="landing-arch-layer-tech">Python (FastAPI)  · JWT · Zod Validation</div>
                                    </div>
                                </div>

                                <div className="landing-arch-connector" />

                                <div className="landing-arch-layer landing-arch-layer--ai">
                                    <div className="landing-arch-layer-icon landing-arch-layer-icon--ai">
                                        <Cpu size={16} />
                                    </div>
                                    <div className="landing-arch-layer-info">
                                        <div className="landing-arch-layer-title">AI Engine</div>
                                        <div className="landing-arch-layer-tech">Groq SDK · Schema Inference · Anomaly Detection</div>
                                    </div>
                                </div>

                                <div className="landing-arch-connector" />

                                <div className="landing-arch-layer landing-arch-layer--db">
                                    <div className="landing-arch-layer-icon landing-arch-layer-icon--db">
                                        <HardDrive size={16} />
                                    </div>
                                    <div className="landing-arch-layer-info">
                                        <div className="landing-arch-layer-title">Data Layer</div>
                                        <div className="landing-arch-layer-tech">Prisma ORM · SQLite · Multi-Tenant</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="landing-arch-info animate-on-scroll">
                        <h3>Enterprise-Grade Foundation</h3>
                        <p>
                            The platform follows a clean separation of concerns with a modern
                            Next.js frontend communicating via RESTful APIs to a Python FastAPI backend.
                            AI capabilities are powered by Groq for blazing-fast inference.
                        </p>
                        <ul className="landing-arch-list">
                            <li>
                                <span className="landing-arch-list-icon"><CheckCircle2 size={14} /></span>
                                JWT-based authentication with bcrypt password hashing
                            </li>
                            <li>
                                <span className="landing-arch-list-icon"><CheckCircle2 size={14} /></span>
                                Role-based access control with fine-grained permissions
                            </li>
                            <li>
                                <span className="landing-arch-list-icon"><CheckCircle2 size={14} /></span>
                                Multi-organization tenancy with data isolation
                            </li>
                            <li>
                                <span className="landing-arch-list-icon"><CheckCircle2 size={14} /></span>
                                AI-powered chat, data analysis, and schema suggestions
                            </li>
                            <li>
                                <span className="landing-arch-list-icon"><CheckCircle2 size={14} /></span>
                                Comprehensive audit logging for compliance tracking
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ── Roles Section ── */}
            <section className="landing-section" id="roles">
                <div className="landing-section-header animate-on-scroll">
                    <span className="landing-section-label">Access Control</span>
                    <h2 className="landing-section-title">Role-Based Collaboration</h2>
                    <p className="landing-section-desc">
                        Four distinct roles with granular permissions ensure every team member
                        has the right access to the right data at the right time.
                    </p>
                </div>

                <div className="landing-roles-grid">
                    <div className="landing-role-card animate-on-scroll stagger-1">
                        <div className="landing-role-avatar landing-role-avatar--engineer">
                            <Code2 size={28} />
                        </div>
                        <h3>Data Engineer</h3>
                        <p>Full pipeline control — ingestion, contracts, preprocessing, and workflows.</p>
                        <div className="landing-role-perms">
                            <span className="landing-role-perm">dataset:manage</span>
                            <span className="landing-role-perm">contract:edit</span>
                            <span className="landing-role-perm">workflow:edit</span>
                        </div>
                    </div>

                    <div className="landing-role-card animate-on-scroll stagger-2">
                        <div className="landing-role-avatar landing-role-avatar--analyst">
                            <BarChart3 size={28} />
                        </div>
                        <h3>Data Analyst</h3>
                        <p>Analyze data, create contracts, and track workflows with view access.</p>
                        <div className="landing-role-perms">
                            <span className="landing-role-perm">dataset:view</span>
                            <span className="landing-role-perm">contract:edit</span>
                            <span className="landing-role-perm">workflow:view</span>
                        </div>
                    </div>

                    <div className="landing-role-card animate-on-scroll stagger-3">
                        <div className="landing-role-avatar landing-role-avatar--business">
                            <Users size={28} />
                        </div>
                        <h3>Business User</h3>
                        <p>View datasets, monitor analytics, and track workflow progress.</p>
                        <div className="landing-role-perms">
                            <span className="landing-role-perm">dataset:view</span>
                            <span className="landing-role-perm">workflow:view</span>
                        </div>
                    </div>

                    <div className="landing-role-card animate-on-scroll stagger-4">
                        <div className="landing-role-avatar landing-role-avatar--admin">
                            <Shield size={28} />
                        </div>
                        <h3>Admin</h3>
                        <p>Full platform control — user management, audit logs, and system config.</p>
                        <div className="landing-role-perms">
                            <span className="landing-role-perm">all permissions</span>
                            <span className="landing-role-perm">user:manage</span>
                            <span className="landing-role-perm">audit:view</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Tech Stack Section ── */}
            <section className="landing-section" id="tech-stack">
                <div className="landing-section-header animate-on-scroll">
                    <span className="landing-section-label">Technology</span>
                    <h2 className="landing-section-title">Built with Modern Technologies</h2>
                    <p className="landing-section-desc">
                        Leveraging the latest frameworks and tools for performance, scalability, and developer experience.
                    </p>
                </div>

                <div className="landing-tech-grid animate-on-scroll">
                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
                            <Layers size={22} style={{ color: '#818cf8' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">Next.js 16</div>
                            <div className="landing-tech-role">Frontend Framework</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(14,165,233,0.12)' }}>
                            <Zap size={22} style={{ color: '#38bdf8' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">React 19</div>
                            <div className="landing-tech-role">UI Library</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                            <Server size={22} style={{ color: '#34d399' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">Python(FastAPI)</div>
                            <div className="landing-tech-role">Backend API</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
                            <Cpu size={22} style={{ color: '#a78bfa' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">Groq AI</div>
                            <div className="landing-tech-role">AI Engine</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(245,158,11,0.12)' }}>
                            <HardDrive size={22} style={{ color: '#fbbf24' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">Prisma ORM</div>
                            <div className="landing-tech-role">Database Layer</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(244,63,94,0.12)' }}>
                            <Lock size={22} style={{ color: '#fb7185' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">JWT + bcrypt</div>
                            <div className="landing-tech-role">Authentication</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(99,102,241,0.12)' }}>
                            <Code2 size={22} style={{ color: '#818cf8' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">TypeScript</div>
                            <div className="landing-tech-role">Type Safety</div>
                        </div>
                    </div>

                    <div className="landing-tech-item">
                        <div className="landing-tech-icon" style={{ background: 'rgba(14,165,233,0.12)' }}>
                            <Bot size={22} style={{ color: '#38bdf8' }} />
                        </div>
                        <div className="landing-tech-info">
                            <div className="landing-tech-name">Recharts</div>
                            <div className="landing-tech-role">Data Visualization</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA Section ── */}
            <section className="landing-cta-section" id="cta">
                <div className="landing-cta-box animate-on-scroll">
                    <h2>Ready to Transform Your Data Workflow?</h2>
                    <p>
                        Experience the power of AI-driven data collaboration.
                        Sign in to explore the full platform.
                    </p>
                    <Link href="/login" className="landing-btn-primary" id="cta-get-started-btn">
                        Get Started Now <ArrowRight size={18} />
                    </Link>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <p>&copy; {new Date().getFullYear()} Collaborative AI Platform. All rights reserved.</p>
                    <ul className="landing-footer-links">
                        <li><a href="#features">Features</a></li>
                        <li><a href="#architecture">Architecture</a></li>
                        <li><a href="#roles">Roles</a></li>
                        <li><a href="#tech-stack">Tech Stack</a></li>
                    </ul>
                </div>
            </footer>
        </div>
    );
}
