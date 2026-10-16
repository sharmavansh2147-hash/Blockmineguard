
import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useWallet } from '../context/WalletContext';
import {
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Search,
  Settings,
  Activity,
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronDown,
  FlaskConical
} from 'lucide-react';

const navigationSections = [
  {
    title: 'Detection & Ops',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Incidents', href: '/incidents', icon: ListChecks, badge: 'Live' },
    ]
  },
  {
    title: 'Research & Innovation',
    items: [
      { name: 'Research Lab & Benchmarks', href: '/research-lab', icon: FlaskConical, badge: 'Phase 1-6' },
    ]
  },
  {
    title: 'Blockchain & Integrity',
    items: [
      { name: 'Verify Evidence', href: '/verify', icon: Search },
      { name: 'Threat Intelligence', href: '/threat-intelligence', icon: ShieldCheck },
    ]
  },
  {
    title: 'System & Governance',
    items: [
      { name: 'System Monitor & Audit', href: '/monitor', icon: Activity },
      { name: 'Settings', href: '/settings', icon: Settings },
    ]
  }
];

export function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const location = useLocation();

  const {
    account,
    isConnected,
    connect,
    disconnect,
    chainId,
    switchNetwork
  } = useWallet();

  const isWrongNetwork = isConnected && chainId !== 31337;

  const networkName =
    chainId === 31337
      ? 'Hardhat Local'
      : chainId === 11155111
        ? 'Sepolia'
        : chainId
          ? `Chain ${chainId}`
          : 'Not connected';

  const walletLabel = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : 'Connected wallet';

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

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <ShieldCheck size={28} />
            <div>
              <span>BlockMineGuard</span>
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
                Threat Defense <span style={{ color: '#10b981' }}>● Active</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationSections.map((section, sIdx) => (
            <div key={section.title} style={{ marginBottom: sIdx !== navigationSections.length - 1 ? '16px' : '0' }}>
              <div
                style={{
                  padding: '4px 12px 6px',
                  color: '#475569',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    <Icon size={18} />
                    <span style={{ flex: 1 }}>{name}</span>
                    {badge && (
                      <span
                        className="badge badge-info"
                        style={{ fontSize: '0.65rem', padding: '1px 6px', height: '18px' }}
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

        <div className="sidebar-footer">
          <div className="network-info">
            <span className="network-label">Blockchain Network</span>
            <span className="network-value">{networkName}</span>
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

      <div className="main-wrapper">
        <header className="header">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="badge badge-low"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                fontSize: '0.72rem',
                textTransform: 'none',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              <strong>Smart Contract:</strong> 0x5FbD...80aa3
            </div>
            <div
              className="badge badge-info"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                fontSize: '0.72rem',
                textTransform: 'none',
              }}
            >
              <strong>EIP-1559 RPC:</strong> Active
            </div>
          </div>

          <div className="header-spacer" />

          <div className="header-actions">
            {isWrongNetwork && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => switchNetwork(31337)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="Click to switch to Hardhat Local (Chain ID 31337)"
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                Wrong Network (Switch to Hardhat 31337)
              </button>
            )}

            <div className="wallet-section">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    className="wallet-btn"
                    onClick={() => setUserMenuOpen(open => !open)}
                    aria-expanded={userMenuOpen}
                    aria-label="Wallet options"
                  >
                    <Wallet size={17} />
                    <span>{walletLabel}</span>
                    <ChevronDown size={15} />
                  </button>

                  {userMenuOpen && (
                    <div className="user-dropdown">
                      <div className="dropdown-item">
                        <span className="dropdown-label">
                          Wallet Address
                        </span>
                        <span className="dropdown-value mono">
                          {account || 'Unavailable'}
                        </span>
                      </div>

                      <div className="dropdown-item">
                        <span className="dropdown-label">Network</span>
                        <span className="dropdown-value">
                          {networkName}
                        </span>
                      </div>

                      <hr className="dropdown-divider" />

                      <button
                        type="button"
                        className="dropdown-btn"
                        onClick={handleDisconnect}
                      >
                        <LogOut size={16} />
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
                >
                  <Wallet size={17} />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="main">
          <div className="container">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
