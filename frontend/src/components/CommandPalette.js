import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import {
  Search,
  LayoutDashboard,
  Radio,
  ListChecks,
  Boxes,
  KeyRound,
  ShieldCheck,
  Activity,
  Settings,
  Play,
  Sun,
  Moon,
  Laptop,
  Zap,
  ArrowRight,
  X,
  Users
} from 'lucide-react';

export function CommandPalette({ isOpen, onClose, onStartDemo }) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { changeTheme } = useTheme();

  const commandItems = [
    // Navigation
    { id: 'nav-dash', category: 'Navigation', label: 'Go to Dashboard', desc: 'Threat Operations Center overview', icon: LayoutDashboard, action: () => navigate('/') },
    { id: 'nav-threat', category: 'Navigation', label: 'Go to Threat Analysis', desc: 'Inspect workloads & heuristics', icon: Radio, action: () => navigate('/threat-detection') },
    { id: 'nav-incidents', category: 'Navigation', label: 'Go to Incidents', desc: 'Manage cryptojacking records', icon: ListChecks, action: () => navigate('/incidents') },
    { id: 'nav-explorer', category: 'Navigation', label: 'Go to Blockchain Explorer', desc: 'Inspect on-chain transactions', icon: Boxes, action: () => navigate('/explorer') },
    { id: 'nav-verify', category: 'Navigation', label: 'Go to Verification Center', desc: 'Cryptographic hash attestation', icon: KeyRound, action: () => navigate('/verify') },
    { id: 'nav-intel', category: 'Navigation', label: 'Go to Threat Intelligence', desc: 'Decentralized IOC repository', icon: ShieldCheck, action: () => navigate('/threat-intelligence') },
    { id: 'nav-health', category: 'Navigation', label: 'Go to System Health', desc: 'Service & RPC diagnostics', icon: Activity, action: () => navigate('/monitor') },
    { id: 'nav-settings', category: 'Navigation', label: 'Go to Settings', desc: 'Configure RPC & contract address', icon: Settings, action: () => navigate('/settings') },
    { id: 'nav-developed-by', category: 'Navigation', label: 'Go to Developed By', desc: 'Project team and development contributors', icon: Users, action: () => navigate('/developed-by') },

    // Workload & Demonstration
    { id: 'act-demo', category: 'Demonstration', label: 'Launch Guided Demonstration', desc: '5-minute academic presentation walkthrough', icon: Play, action: () => { if (onStartDemo) onStartDemo(); } },
    { id: 'act-normal', category: 'Workloads', label: 'Load Normal Workload Sample', desc: 'Test benign process telemetry', icon: Zap, action: () => navigate('/threat-detection?sample=normal') },
    { id: 'act-crypto', category: 'Workloads', label: 'Load Cryptojacking Sample', desc: 'Test XMRig high-load telemetry', icon: Zap, action: () => navigate('/threat-detection?sample=cryptojacking') },

    // Appearance
    { id: 'thm-dark', category: 'Theme', label: 'Switch to Dark Theme', desc: 'Dark cybersecurity SOC aesthetic', icon: Moon, action: () => changeTheme('dark') },
    { id: 'thm-light', category: 'Theme', label: 'Switch to Light Theme', desc: 'Clean enterprise dashboard aesthetic', icon: Sun, action: () => changeTheme('light') },
    { id: 'thm-sys', category: 'Theme', label: 'Switch to System Theme', desc: 'Follow operating system theme', icon: Laptop, action: () => changeTheme('system') },
  ];

  const filteredItems = commandItems.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 16px 20px',
      }}
    >
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'paletteSlideDown 0.15s ease-out',
        }}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            gap: '10px',
            background: 'var(--surface-card)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search action (e.g., 'Normal Sample', 'Verify', 'Light')..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>No matching commands</div>
              <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Try searching for a page, workload, or theme.</div>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius)',
                    background: isSelected ? 'var(--surface-hover)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  className={`command-item ${isSelected ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: isSelected ? 'var(--primary)' : 'var(--surface-card)',
                        color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: 'var(--surface-card)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-card)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd className="kbd">↑↓</kbd> to navigate</span>
            <span><kbd className="kbd">↵</kbd> to select</span>
            <span><kbd className="kbd">esc</kbd> to close</span>
          </div>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>BlockMineGuard Command</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
