import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Clock,
  BookOpen,
  Target,
  Upload,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Stats = {
  streak: number;
  hoursToday: number; // hours
  documents: number;
  goalsMetPct: number; // percent 0-100
};

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ streak: 0, hoursToday: 0, documents: 0, goalsMetPct: 0 });
  const [recentDocs, setRecentDocs] = useState<Array<{ id: string; title: string; created_at: string }>>([]);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      const streakPromise = supabase.rpc('calculate_study_streak', { user_uuid: user.id });
      const hoursPromise = supabase
        .from('daily_study_logs')
        .select('total_minutes')
        .eq('user_id', user.id)
        .eq('study_date', today)
        .maybeSingle();
      const docsPromise = supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const goalsTotalPromise = supabase
        .from('study_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const goalsDonePromise = supabase
        .from('study_goals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_completed', true);
      const recentDocsPromise = supabase
        .from('documents')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      const [streakRes, hoursRes, docsRes, goalsTotalRes, goalsDoneRes, recentDocsRes] = await Promise.all([
        streakPromise,
        hoursPromise,
        docsPromise,
        goalsTotalPromise,
        goalsDonePromise,
        recentDocsPromise,
      ]);

      const streak = typeof streakRes.data === 'number' ? streakRes.data : 0;
      const totalMinutes = hoursRes.data?.total_minutes ?? 0;
      const hoursToday = Math.round((totalMinutes / 60) * 10) / 10;
      const documents = docsRes.count ?? 0;
      const totalGoals = goalsTotalRes.count ?? 0;
      const doneGoals = goalsDoneRes.count ?? 0;
      const goalsMetPct = totalGoals > 0 ? Math.round((doneGoals / totalGoals) * 100) : 0;

      setStats({ streak, hoursToday, documents, goalsMetPct });
      setRecentDocs(recentDocsRes.data ?? []);
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Your study overview</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Study Session
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `${stats.streak} day${stats.streak === 1 ? '' : 's'}`}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `${stats.hoursToday}h`}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : stats.documents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goals Met</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '—' : `${stats.goalsMetPct}%`}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest document uploads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && recentDocs.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
            {!loading && recentDocs.map((d) => (
              <div key={d.id} className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">Uploaded "{d.title}"</p>
                  <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your next study session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <BookOpen className="h-4 w-4 mr-2" />
              Start Study Session
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Target className="h-4 w-4 mr-2" />
              Set Study Goal
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              View Progress
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
