import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  Trash2,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const formatRelativeTime = (isoString) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now - past;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 45) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      return past.toLocaleDateString();
    } catch {
      return 'Recent';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={15} style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />;
      case 'critical':
        return <AlertOctagon size={15} style={{ color: 'var(--critical)' }} />;
      case 'info':
      default:
        return <Info size={15} style={{ color: 'var(--primary)' }} />;
    }
  };

  const handleNotificationClick = (item) => {
    markAsRead(item.id);
    if (item.link) {
      navigate(item.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="notification-center-container" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-sm btn-outline notification-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        title="Event Notification Center"
        style={{
          position: 'relative',
          padding: '4px 8px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '16px',
              height: '16px',
              borderRadius: '8px',
              background: 'var(--critical)',
              color: '#FFFFFF',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="notification-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '320px',
            maxWidth: 'calc(100vw - 24px)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-critical" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  style={{ padding: '2px 6px', fontSize: '0.6875rem', height: 'auto' }}
                >
                  <Check size={12} /> Read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearNotifications}
                  title="Clear all"
                  style={{ padding: '2px 6px', fontSize: '0.6875rem', height: 'auto' }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Bell size={24} style={{ opacity: 0.35, margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>No notifications yet</div>
                <div style={{ fontSize: '0.6875rem', marginTop: '2px' }}>
                  Real application events will appear here.
                </div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: n.link ? 'pointer' : 'default',
                    background: n.read ? 'transparent' : 'var(--surface-hover)',
                    transition: 'background 0.15s ease',
                  }}
                  className="notification-item"
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>{getTypeIcon(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <div
                        style={{
                          fontSize: '0.78125rem',
                          fontWeight: n.read ? 600 : 700,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.title}
                      </div>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatRelativeTime(n.timestamp)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.71875rem',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
