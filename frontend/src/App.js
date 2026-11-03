
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';

import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Incidents } from './pages/Incidents';
import { IncidentDetail } from './pages/IncidentDetail';
import { ThreatIntelligence } from './pages/ThreatIntelligence';
import { VerifyEvidence } from './pages/VerifyEvidence';
import { SystemMonitor } from './pages/SystemMonitor';
import { Settings } from './pages/Settings';
import { ResearchLab } from './pages/ResearchLab';
import { ThreatDetection } from './pages/ThreatDetection';
import { BlockchainExplorer } from './pages/BlockchainExplorer';
import { DevelopedByPage } from './pages/DevelopedByPage';

import api from './services/api';
import { WalletProvider } from './context/WalletContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearToasts = (category = null) => {
    if (category) {
      setToasts((prev) => prev.filter((t) => t.category !== category));
    } else {
      setToasts([]);
    }
  };

  const showToast = (message, type = 'info', options = {}) => {
    const id = Date.now() + Math.random();
    const category = typeof options === 'string' ? options : (options?.category || null);
    const duration = options?.duration || 4500;

    setToasts((prev) => {
      // If category is provided, remove prior toasts of the same category to prevent contradictory messages
      let filtered = category ? prev.filter((t) => t.category !== category) : [...prev];
      if (filtered.length >= 3) {
        filtered = filtered.slice(filtered.length - 2);
      }
      return [...filtered, { id, message, type, category }];
    });

    setTimeout(() => {
      dismissToast(id);
    }, duration);
  };

  return (
    <AppContext.Provider value={{ showToast, dismissToast, clearToasts }}>
      {children}

      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => {
          let IconComp = Info;
          let iconColor = '#58A6FF';
          if (toast.type === 'success') {
            IconComp = CheckCircle2;
            iconColor = '#3FB950';
          } else if (toast.type === 'error') {
            IconComp = AlertCircle;
            iconColor = '#F85149';
          } else if (toast.type === 'warning') {
            IconComp = AlertTriangle;
            iconColor = '#D29922';
          }

          return (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
              role="alert"
            >
              <IconComp size={16} color={iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, wordBreak: 'break-word' }}>
                {toast.message}
              </div>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </AppContext.Provider>
  );
}

function useApp() {
  return useContext(AppContext);
}

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkBackend = async () => {
      try {
        await api.get('/health');

        if (mounted) {
          setBackendConnected(true);
        }
      } catch (error) {
        console.error('Backend health check failed:', error);

        if (mounted) {
          setBackendConnected(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkBackend();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--background)',
        }}
      >
        <div
          className="spinner"
          style={{ width: 48, height: 48 }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {!backendConnected && (
        <div className="toast toast-warning">
          Backend is unavailable. Some features may not work.
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />

        <Route
          path="/threat-detection"
          element={
            <Layout>
              <ThreatDetection />
            </Layout>
          }
        />

        <Route
          path="/explorer"
          element={
            <Layout>
              <BlockchainExplorer />
            </Layout>
          }
        />

        <Route
          path="/incidents"
          element={
            <Layout>
              <Incidents />
            </Layout>
          }
        />

        <Route
          path="/incidents/:id"
          element={
            <Layout>
              <IncidentDetail />
            </Layout>
          }
        />

        <Route
          path="/threat-intelligence"
          element={
            <Layout>
              <ThreatIntelligence />
            </Layout>
          }
        />

        <Route
          path="/verify"
          element={
            <Layout>
              <VerifyEvidence />
            </Layout>
          }
        />

        <Route
          path="/monitor"
          element={
            <Layout>
              <SystemMonitor />
            </Layout>
          }
        />

        <Route
          path="/settings"
          element={
            <Layout>
              <Settings />
            </Layout>
          }
        />

        <Route
          path="/research-lab"
          element={
            <Layout>
              <ResearchLab />
            </Layout>
          }
        />

        <Route
          path="/developed-by"
          element={
            <Layout>
              <DevelopedByPage />
            </Layout>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <NotificationProvider>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </NotificationProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}

export { useApp };
export default App;
