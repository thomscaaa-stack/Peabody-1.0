import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Brain,
  Map,
  LogOut,
  X
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ConnectCanvas from '@/components/calendar/ConnectCanvas';
import UpcomingList from '@/components/calendar/UpcomingList';
import type { CalendarEvent } from '@/lib/calendar/date';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workspace', href: '/workspace', icon: BookOpen },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Flashcards', href: '/flashcards', icon: Brain },
  { name: 'Knowledge Map', href: '/knowledge-map', icon: Map },
];

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Load token on mount
  useEffect(() => {
    const t = localStorage.getItem('canvasIcsToken')
    if (t) setToken(t)
  }, [])

  const refreshEvents = async () => {
    const t = token || localStorage.getItem('canvasIcsToken')
    if (!t) return
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/feeds/events?token=${encodeURIComponent(t)}`)
      if (res.status === 401) {
        // expired/invalid
        localStorage.removeItem('canvasIcsToken')
        setToken(null)
        setEvents([])
        setError('Connection expired. Please reconnect.')
        return
      }
      if (!res.ok) throw new Error('Failed to load events')
      const data = await res.json()
      setEvents(Array.isArray(data?.events) ? data.events : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) refreshEvents() }, [token])

  const onConnected = (tkn: string) => {
    setToken(tkn)
    refreshEvents()
  }

  const disconnect = () => {
    localStorage.removeItem('canvasIcsToken')
    setToken(null)
    setEvents([])
    setError(null)
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 z-50 h-full w-64 bg-background border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <img src="/Banner.png" alt="Peabody logo" className="h-[7.5rem] w-auto object-contain" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  onClick={() => {
                    // Close sidebar on mobile when clicking a link
                    if (window.innerWidth < 1024) {
                      onToggle();
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Calendar Section */}
          <div className="p-4 border-t space-y-3">
            <h2 className="text-sm font-semibold">Calendar</h2>
            {!token ? (
              <div className="rounded-2xl border p-3">
                <div className="text-sm mb-2">Connect your Canvas Calendar</div>
                <ConnectCanvas onConnected={onConnected} />
              </div>
            ) : (
              <UpcomingList
                token={token}
                events={events}
                loading={loading}
                error={error}
                onRefresh={refreshEvents}
                onDisconnect={disconnect}
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
