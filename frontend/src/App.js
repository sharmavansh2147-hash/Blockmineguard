
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

import api from './services/api';
import { WalletProvider } from './context/WalletContext';

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();

    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  return (
    <AppContext.Provider value={{ showToast }}>
      {children}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            {toast.message}
          </div>
        ))}
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
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </WalletProvider>
  );
}

export { useApp };
export default App;
