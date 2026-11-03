import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import {
  LayoutDashboard,
  Radio,
  ListChecks,
  ShieldCheck,
  Boxes,
  KeyRound,
  Activity,
  Settings,
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FlaskConical,
  Search,
  ExternalLink,
  Server,
  Play,
  Command,
  HelpCircle,
  Users
} from 'lucide-react';
import { getContractAddress, getExplorerUrl } from '../services/contractService';
import api from '../services/api';
import { ThemeSelector } from './ThemeSelector';
import { NotificationCenter } from './NotificationCenter';
import { CommandPalette } from './CommandPalette';
import { DemoWorkflowModal } from './DemoWorkflowModal';

const navigationSections = [
  {
    title: 'Detection & Analysis',
    items: [
      { name: 'Overview', href: '/', icon: LayoutDashboard },
      { name: 'Threat Detection', href: '/threat-detection', icon: Radio, badge: 'Lab' },
      { name: 'Incidents', href: '/incidents', icon: ListChecks, badge: 'Live' },
    ]
  },
  {
    title: 'Blockchain & Attestation',
    items: [
      { name: 'Blockchain Explorer', href: '/explorer', icon: Boxes },
      { name: 'Verification Center', href: '/verify', icon: KeyRound },
      { name: 'Threat Intelligence', href: '/threat-intelligence', icon: ShieldCheck },
    ]
  },
  {
    title: 'System & Research',
    items: [
      { name: 'System Health', href: '/monitor', icon: Activity },
      { name: 'Research Lab', href: '/research-lab', icon: FlaskConical, badge: 'Eval' },
      { name: 'Settings', href: '/settings', icon: Settings },
      { name: 'Developed By', href: '/developed-by', icon: Users },
    ]
  }
];

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [backendStatus, setBackendStatus] = useState({ online: true, rpcUrl: 'http://127.0.0.1:8545' });

  const location = useLocation();
  const navigate = useNavigate();

  const {
    account,
    isConnected,
    connect,
    disconnect,
    chainId,
    switchNetwork
  } = useWallet();

  // Determine active environment strictly based on connected chain or local default
  const activeChainId = chainId || 31337;
  const isSepolia = activeChainId === 11155111;
  const isLocal = activeChainId === 31337;
  const isWrongNetwork = isConnected && !isLocal && !isSepolia;

  const environmentLabel = isSepolia
    ? 'SEPOLIA TESTNET'
    : isLocal
      ? 'LOCAL HARDHAT'
      : `CHAIN ${activeChainId}`;

  const networkName = isSepolia
    ? 'Ethereum Sepolia (11155111)'
    : isLocal
      ? 'Hardhat Local (31337)'
      : `Unsupported Chain (${activeChainId})`;

  const contractAddress = getContractAddress(activeChainId);
  const shortContract = contractAddress
    ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
    : 'Not configured';
  const contractExplorerUrl = getExplorerUrl(activeChainId, contractAddress, 'address');

  const walletLabel = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : 'Connect Wallet';

  // Listen to Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check backend health periodically
  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        if (mounted) {
          setBackendStatus({
            online: res.data?.status === 'ok',
            rpcUrl: res.data?.rpc_url || (isSepolia ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545')
          });
        }
      } catch {
        if (mounted) {
          setBackendStatus({ online: false, rpcUrl: 'Offline' });
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isSepolia]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Wallet disconnection failed:', error);
    } finally {
      setUserMenuOpen(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    const q = quickSearch.trim();
    if (q.toUpperCase().startsWith('INC-')) {
      navigate(`/incidents/${q.toUpperCase()}`);
    } else {
      navigate(`/incidents?search=${encodeURIComponent(q)}`);
    }
    setQuickSearch('');
  };

  // Determine current page title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Threat Operations Center';
    if (path === '/threat-detection') return 'Threat Analysis Workspace';
    if (path.startsWith('/incidents/')) return 'Incident Investigation';
    if (path === '/incidents') return 'Incident Management';
    if (path === '/explorer') return 'Blockchain Explorer';
    if (path === '/verify') return 'Verification Center';
    if (path === '/threat-intelligence') return 'Threat Intelligence Registry';
    if (path === '/monitor') return 'System Health & Metrics';
    if (path === '/research-lab') return 'Research Evaluation Lab';
    if (path === '/settings') return 'Platform Settings';
    if (path === '/developed-by') return 'Developed By';
    return 'BlockMineGuard SOC';
  };

  return (
    <div className="layout">
      {/* Global Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onStartDemo={() => {
          setCommandPaletteOpen(false);
          setDemoModalOpen(true);
        }}
      />

      {/* Guided Demonstration Modal */}
      <DemoWorkflowModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <ShieldCheck size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                BlockMineGuard
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Threat Intelligence
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Guided Demo Trigger in Sidebar */}
        <div style={{ padding: '0 4px 12px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSidebarOpen(false);
              setDemoModalOpen(true);
            }}
            style={{
              width: '100%',
              fontSize: '0.75rem',
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Play size={11} fill="currentColor" /> Guided Demonstration
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationSections.map((section, sIdx) => (
            <div key={section.title} style={{ marginBottom: sIdx !== navigationSections.length - 1 ? '16px' : '0' }}>
              <div
                style={{
                  padding: '4px 12px 6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {section.items.map(({ name, href, icon: Icon, badge }) => (
                  <NavLink
                    key={name}
                    to={href}
                    end={href === '/'}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSidebarOpen(false);
                      setUserMenuOpen(false);
                    }}
                  >
                    <Icon size={17} />
                    <span style={{ flex: 1 }}>{name}</span>
                    {badge && (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.62rem',
                          padding: '1px 6px',
                          background: 'rgba(148, 163, 184, 0.12)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Real Environment Indicator */}
        <div className="sidebar-footer">
          <div
            className="network-info"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="network-label" style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                ENVIRONMENT
              </span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isSepolia ? 'var(--accent-blockchain)' : 'var(--success)',
                  display: 'inline-block'
                }}
              />
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {environmentLabel}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Chain ID: {activeChainId}
            </div>
          </div>

          {/* Developed By Sidebar Summary */}
          <div
            style={{
              marginTop: '10px',
              padding: '10px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
                DEVELOPED BY
              </span>
              <span className="badge" style={{ fontSize: '0.6rem', padding: '1px 5px', background: 'rgba(88, 166, 255, 0.1)', color: 'var(--primary)', border: '1px solid rgba(88, 166, 255, 0.2)' }}>
                BTech CSE
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Vansh Sharma
                </span>
                <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--background)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>
                  25BCE1567
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Divyansh Bhatia
                </span>
                <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--background)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border)' }}>
                  25BCE1414
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Top Navigation Bar */}
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                BlockMineGuard / {location.pathname === '/' ? 'Dashboard' : location.pathname.slice(1).replace('-', ' ')}
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {getPageTitle()}
              </div>
            </div>
          </div>

          {/* Global Command Palette Trigger Button */}
          <button
            type="button"
            className="command-palette-trigger-btn"
            onClick={() => setCommandPaletteOpen(true)}
            title="Search commands, workloads, and pages (Cmd+K)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)',
              fontSize: '0.78125rem',
              cursor: 'pointer',
              minWidth: '200px',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <span>Search or command...</span>
            </div>
            <kbd className="kbd">⌘K</kbd>
          </button>

          <div className="header-spacer" />

          {/* Top Actions: Command Palette, Theme, Notifications, Network/API, Wallet */}
          <div className="header-actions">
            {/* Unified System & Network Status Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
              title={`API: ${backendStatus.online ? 'Operational' : 'Offline'} • Network: ${networkName}`}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: backendStatus.online ? 'var(--success)' : 'var(--danger)',
                  display: 'inline-block'
                }}
              />
              <span style={{ fontWeight: 500 }}>
                {isSepolia ? 'Sepolia' : isLocal ? 'Hardhat 31337' : `Chain ${activeChainId}`}
              </span>
            </div>

            {/* Light / Dark / System Theme Selector */}
            <ThemeSelector />

            {/* Real Notification Center */}
            <NotificationCenter />

            {/* Wrong Network Warning Banner */}
            {isWrongNetwork && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => switchNetwork(11155111)}
                  style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                >
                  Switch Sepolia
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => switchNetwork(31337)}
                  style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                >
                  Switch Local
                </button>
              </div>
            )}

            {/* Wallet Section */}
            <div className="wallet-section">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    className="wallet-btn"
                    onClick={() => setUserMenuOpen(open => !open)}
                    aria-expanded={userMenuOpen}
                    aria-label="Wallet menu"
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      fontSize: '0.78rem'
                    }}
                  >
                    <Wallet size={15} color="var(--primary)" />
                    <span>{walletLabel}</span>
                    <ChevronDown size={14} />
                  </button>

                  {userMenuOpen && (
                    <div className="user-dropdown">
                      <div className="dropdown-item">
                        <span className="dropdown-label">Wallet Address</span>
                        <span className="dropdown-value mono" style={{ fontSize: '0.75rem' }}>
                          {account || 'Unavailable'}
                        </span>
                      </div>

                      <div className="dropdown-item">
                        <span className="dropdown-label">Active Chain</span>
                        <span className="dropdown-value" style={{ fontSize: '0.78rem' }}>
                          {networkName}
                        </span>
                      </div>

                      <hr className="dropdown-divider" />

                      <div style={{ padding: '4px 10px 2px', fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Switch Target Chain
                      </div>

                      <button
                        type="button"
                        className="dropdown-btn"
                        style={{ fontSize: '0.74rem', padding: '6px 10px', color: 'var(--text-primary)' }}
                        onClick={() => {
                          switchNetwork(11155111);
                          setUserMenuOpen(false);
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blockchain)', display: 'inline-block', marginRight: 6 }} />
                        Ethereum Sepolia (11155111)
                      </button>

                      <button
                        type="button"
                        className="dropdown-btn"
                        style={{ fontSize: '0.74rem', padding: '6px 10px', color: 'var(--text-primary)' }}
                        onClick={() => {
                          switchNetwork(31337);
                          setUserMenuOpen(false);
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', marginRight: 6 }} />
                        Hardhat Local (31337)
                      </button>

                      <hr className="dropdown-divider" />

                      <button
                        type="button"
                        className="dropdown-btn"
                        onClick={handleDisconnect}
                      >
                        <LogOut size={14} />
                        Disconnect Wallet
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConnect}
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', height: '28px' }}
                >
                  <Wallet size={14} />
                  Connect
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="main">
          <div className="container">
            {children || <Outlet />}
          </div>
        </main>

        {/* Global Footer */}
        <footer className="app-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>BlockMineGuard</span>
            <span>•</span>
            <span>Academic Capstone &amp; Cybersecurity Research (BTech CSE 2026)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span>
              Developed by <strong style={{ color: 'var(--text-primary)' }}>Vansh Sharma</strong> (<code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>25BCE1567</code>) &amp; <strong style={{ color: 'var(--text-primary)' }}>Divyansh Bhatia</strong> (<code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>25BCE1414</code>)
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Layout;
