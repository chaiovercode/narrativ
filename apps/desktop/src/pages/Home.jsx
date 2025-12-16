import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../App.css';

function Home() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="home-page">
            {/* Animated background */}
            <div className="home-bg">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
                <div className="grid-overlay"></div>
            </div>

            {/* Main content */}
            <main className={`home-main ${mounted ? 'mounted' : ''}`}>
                {/* Hero Section */}
                <section className="hero-section">
                    <div className="hero-brand">Revelio</div>
                    <div className="hero-badge">
                        <span className="badge-dot"></span>
                        AI-Powered Storytelling
                    </div>

                    <h1 className="hero-title">
                        <span className="title-line">Transform Ideas Into</span>
                        <span className="title-accent">Visual Stories</span>
                    </h1>

                    <p className="hero-description">
                        Create stunning, research-backed visual narratives in minutes.
                        From topic to polished carousel — powered by AI.
                    </p>

                    <div className="hero-cta-group">
                        <Link to="/create" className="cta-primary">
                            <span>Start Creating</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </Link>
                        <a href="#features" className="cta-secondary">
                            See How It Works
                        </a>
                    </div>

                    {/* Stats */}
                    <div className="hero-stats">
                        <div className="stat-item">
                            <span className="stat-value">10x</span>
                            <span className="stat-label">Faster Creation</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">100%</span>
                            <span className="stat-label">AI Research</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">∞</span>
                            <span className="stat-label">Style Options</span>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="features-section" id="features">
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <circle cx="11" cy="11" r="8"/>
                                    <path d="M21 21l-4.35-4.35"/>
                                    <path d="M11 8v6M8 11h6"/>
                                </svg>
                            </div>
                            <h3>Deep Research</h3>
                            <p>AI scours the web for facts, statistics, and insights to back your story with credibility.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <path d="M21 15l-5-5L5 21"/>
                                </svg>
                            </div>
                            <h3>Stunning Visuals</h3>
                            <p>Generate cohesive, on-brand imagery that captures attention and tells your story visually.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                    <path d="M2 17l10 5 10-5"/>
                                    <path d="M2 12l10 5 10-5"/>
                                </svg>
                            </div>
                            <h3>Style Consistency</h3>
                            <p>Every slide maintains visual harmony with customizable palettes and aesthetic presets.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-icon-wrapper">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                                    <path d="M8 21h8M12 17v4"/>
                                </svg>
                            </div>
                            <h3>Social Ready</h3>
                            <p>Export optimized carousels for Instagram, LinkedIn, Twitter — ready to engage your audience.</p>
                        </div>
                    </div>
                </section>

                {/* Bottom CTA */}
                <section className="bottom-cta">
                    <h2>Ready to create something amazing?</h2>
                    <Link to="/create" className="cta-primary large">
                        <span>Get Started Free</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </Link>
                </section>
            </main>

            {/* Footer */}
            <footer className="home-footer">
                <div className="footer-brand">REVELIO</div>
                <div className="footer-tagline">AI-Powered Visual Storytelling</div>
            </footer>
        </div>
    );
}

export default Home;
