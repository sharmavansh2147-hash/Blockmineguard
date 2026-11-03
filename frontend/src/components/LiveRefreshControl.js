import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  ChevronDown
} from 'lucide-react';

const REFRESH_INTERVALS = [
  { label: '3s Ultra-Fast', value: 3, desc: 'High frequency live stream' },
  { label: '5s Optimal', value: 5, desc: 'Balanced SOC telemetry' },
  { label: '10s Relaxed', value: 10, desc: 'Low overhead polling' },
  { label: '30s Low Impact', value: 30, desc: 'Periodic refresh' },
  { label: 'Paused', value: 0, desc: 'Manual refresh only' }
];

export function LiveRefreshControl({ onRefresh, lastUpdated }) {
  const [intervalSec, setIntervalSec] = useState(5);
  const [countdown, setCountdown] = useState(5);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Countdown timer loop
  useEffect(() => {
    if (intervalSec === 0) {
      setCountdown(0);
      return;
    }

    setCountdown(intervalSec);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerRefresh();
          return intervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSec]);

  const triggerRefresh = () => {
    setIsSpinning(true);
    if (onRefresh) {
      onRefresh();
    }
    setTimeout(() => {
      setIsSpinning(false);
    }, 600);
  };

  const handleManualClick = (e) => {
    e.stopPropagation();
    triggerRefresh();
    if (intervalSec > 0) {
      setCountdown(intervalSec);
    }
  };

  const selectInterval = (val) => {
    setIntervalSec(val);
    setCountdown(val);
    setMenuOpen(false);
    if (val > 0) {
      triggerRefresh();
    }
  };

  const isPaused = intervalSec === 0;

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '4px 8px 4px 10px',
          gap: '8px',
          boxShadow: 'var(--shadow-sm)',
          userSelect: 'none'
        }}
      >
        {/* Status Dot & Mode Label */}
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
          title="Configure polling interval"
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isPaused ? 'var(--warning)' : 'var(--success)',
              flexShrink: 0
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: isPaused ? 'var(--warning)' : 'var(--text-primary)'
                }}
              >
                {isPaused ? 'Paused' : 'Live Stream'}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {isPaused ? 'Manual' : `${intervalSec}s`}
              </span>
            </div>
            {lastUpdated && (
              <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <ChevronDown
            size={12}
            style={{
              color: 'var(--text-secondary)',
              transform: menuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
              marginLeft: '2px'
            }}
          />
        </div>

        {/* Circular Countdown Gauge (when not paused) */}
        {!isPaused && (
          <div
            style={{
              position: 'relative',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={`Next poll in ${countdown}s`}
          >
            <svg width="20" height="20" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="10"
                cy="10"
                r={8}
                stroke="var(--border)"
                strokeWidth="2"
                fill="transparent"
              />
              <circle
                cx="10"
                cy="10"
                r={8}
                stroke="var(--primary)"
                strokeWidth="2"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 8}
                strokeDashoffset={2 * Math.PI * 8 * (1 - (intervalSec > 0 ? countdown / intervalSec : 0))}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                fontSize: '0.5625rem',
                fontFamily: 'monospace',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}
            >
              {countdown}
            </span>
          </div>
        )}

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={handleManualClick}
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 0
          }}
          title="Refresh now"
        >
          <RefreshCw
            size={12}
            style={{
              transform: isSpinning ? 'rotate(360deg)' : 'none',
              transition: isSpinning ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
        </button>
      </div>

      {/* Speed Configuration Dropdown Popover */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '230px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '6px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000
          }}
        >
          <div
            style={{
              padding: '4px 8px 6px',
              fontSize: '0.625rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderBottom: '1px solid var(--border)',
              marginBottom: '4px'
            }}
          >
            Polling Frequency
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {REFRESH_INTERVALS.map((item) => {
              const isSelected = intervalSec === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectInterval(item.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--surface-card)' : 'transparent',
                    border: isSelected ? '1px solid var(--border)' : '1px solid transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 500 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      {item.desc}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--primary)'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
