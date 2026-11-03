import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Laptop, Check } from 'lucide-react';

export function ThemeSelector() {
  const { preference, changeTheme, theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const themeOptions = [
    { id: 'dark', label: 'Dark Mode', icon: Moon, desc: 'Cybersecurity SOC theme' },
    { id: 'light', label: 'Light Mode', icon: Sun, desc: 'Clean enterprise dashboard' },
    { id: 'system', label: 'System', icon: Laptop, desc: 'Follows OS appearance' },
  ];

  const currentIcon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Laptop;
  const CurrentIconComponent = currentIcon;

  return (
    <div className="theme-selector-container" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-sm btn-outline theme-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Theme: ${preference} (current: ${theme}). Click to switch.`}
        aria-expanded={isOpen}
        title={`Theme: ${preference.toUpperCase()}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          fontSize: '0.75rem',
          height: '28px',
        }}
      >
        <CurrentIconComponent size={14} />
        <span style={{ textTransform: 'capitalize', display: 'none' }} className="theme-label-desktop">
          {preference}
        </span>
      </button>

      {isOpen && (
        <div
          className="theme-dropdown-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '210px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            padding: '4px',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Theme Preference
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {themeOptions.map(({ id, label, icon: Icon, desc }) => {
              const isSelected = preference === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    changeTheme(id);
                    setIsOpen(false);
                  }}
                  className={`theme-option-btn ${isSelected ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: isSelected ? 'var(--surface-hover)' : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    fontSize: '0.78125rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={14} style={{ color: isSelected ? 'var(--primary)' : 'var(--text-secondary)' }} />
                    <div>
                      <div style={{ fontWeight: isSelected ? 600 : 500 }}>{label}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                  </div>
                  {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeSelector;
