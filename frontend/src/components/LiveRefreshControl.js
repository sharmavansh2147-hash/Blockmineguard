import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  ChevronDown,
  Play,
  Pause,
  Zap,
  Radio,
  Timer
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

  // Compute circular progress for the countdown ring
  const progressRatio = intervalSec > 0 ? (countdown / intervalSec) : 0;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div style={{ position: 'relative' }} ref={menuRef}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '30px',
          padding: '4px 6px 4px 12px',
          gap: '10px',
          boxShadow: isPaused
            ? '0 2px 8px rgba(0, 0, 0, 0.4)'
            : '0 0 16px rgba(6, 182, 212, 0.25), 0 2px 8px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
      >
        {/* Animated Beacon & Mode Label */}
        <div
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
          title="Click to change refresh speed"
        >
          {isPaused ? (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#f59e0b',
                boxShadow: '0 0 6px #f59e0b'
              }}
            />
          ) : (
            <div style={{ position: 'relative', width: 8, height: 8 }}>
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                  opacity: 0.75
                }}
              />
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: isPaused ? '#f59e0b' : '#34d399'
                }}
              >
                {isPaused ? 'Paused' : 'Live Stream'}
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}
              >
                {isPaused ? 'Off' : `${intervalSec}s`}
              </span>
            </div>
            {lastUpdated && (
              <span style={{ fontSize: '0.64rem', color: '#64748b', marginTop: '-1px' }}>
                Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <ChevronDown
            size={14}
            style={{
              color: '#94a3b8',
              transform: menuOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              marginLeft: '2px'
            }}
          />
        </div>

        {/* Circular Countdown Gauge (when not paused) */}
        {!isPaused && (
          <div
            style={{
              position: 'relative',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={`Next refresh in ${countdown}s`}
          >
            <svg width="24" height="24" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="12"
                cy="12"
                r={radius}
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="2.5"
                fill="transparent"
              />
              <circle
                cx="12"
                cy="12"
                r={radius}
                stroke="#06b6d4"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ transition: 'stroke-dashoffset 0.8s linear' }}
              />
            </svg>
            <span
              style={{
                position: 'absolute',
                fontSize: '0.62rem',
                fontWeight: 800,
                color: '#38bdf8',
                fontFamily: 'monospace'
              }}
            >
              {countdown}
            </span>
          </div>
        )}

        {/* Manual Refresh Action Trigger Button */}
        <button
          type="button"
          onClick={handleManualClick}
          style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Instant Manual Refresh"
        >
          <RefreshCw
            size={13}
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
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '14px',
            padding: '8px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(6, 182, 212, 0.2)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div
            style={{
              padding: '6px 10px 8px',
              fontSize: '0.68rem',
              color: '#64748b',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '4px'
            }}
          >
            Telemetry Polling Frequency
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
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                    border: isSelected ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
                    color: isSelected ? '#38bdf8' : '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  className="refresh-interval-item"
                >
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: isSelected ? 700 : 500 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                      {item.desc}
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#06b6d4',
                        boxShadow: '0 0 6px #06b6d4'
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
