import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Workspace } from './pages/Workspace';
import DocumentsPage from './pages/Documents';
import CalendarPage from './pages/Calendar';
import FolderPage from './pages/Folder';
import { Menu } from 'lucide-react';
import { Button } from './components/ui/button';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';
import { ToastProvider } from './components/ui/toast';
import { Toaster } from './components/ui/toaster';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <ToastProvider>
        <div className="min-h-screen bg-white">
          {/* Mobile menu button */}
          <div className="lg:hidden fixed top-4 left-4 z-50">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Sidebar */}
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Main content */}
          <div className="lg:ml-64 min-h-screen">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/workspace" element={<Workspace />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/folders/:id" element={<FolderPage />} />
              <Route path="/flashcards" element={<div className="p-6"><h1 className="text-3xl font-bold">Flashcards</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
              <Route path="/knowledge-map" element={<div className="p-6"><h1 className="text-3xl font-bold">Knowledge Map</h1><p className="text-muted-foreground">Coming soon...</p></div>} />
            </Routes>
          </div>
        </div>
        <Toaster />
      </ToastProvider>
    </Router>
  );
}

export default App;
