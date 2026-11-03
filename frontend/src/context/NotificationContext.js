import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NotificationContext = createContext(null);

const STORAGE_KEY = 'bmg_notifications_history';

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parse error
    }
    // Realistic system initial notifications
    return [
      {
        id: 'notif-init-1',
        title: 'System Initialized',
        message: 'BlockMineGuard threat monitoring & blockchain registry online.',
        type: 'info',
        timestamp: new Date().toISOString(),
        read: true,
      },
      {
        id: 'notif-init-2',
        title: 'Smart Contract Attestation',
        message: 'ThreatRegistry.sol ready for tamper-evident incident recording.',
        type: 'success',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        read: false,
      }
    ];
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 30)));
    } catch (e) {
      // Ignore storage error
    }
  }, [notifications]);

  const addNotification = useCallback((notif) => {
    const item = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: notif.title || 'System Notification',
      message: notif.message,
      type: notif.type || 'info', // 'info' | 'success' | 'warning' | 'critical'
      timestamp: new Date().toISOString(),
      read: false,
      link: notif.link || null,
      meta: notif.meta || null,
    };

    setNotifications((prev) => [item, ...prev.slice(0, 49)]); // Keep last 50
    return item;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
