import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Folder as FolderIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Folder } from '@/lib/types';
import { Link } from 'react-router-dom';

export function Workspace() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setFolders(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const createFolder = async () => {
    const title = prompt('Folder name');
    if (!title) return;
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user; if (!user) return;
    const { data, error } = await supabase
      .from('folders')
      .insert({ title, user_id: user.id })
      .select('*')
      .single();
    if (!error && data) setFolders((f) => [data as Folder, ...f]);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">Your AI-powered study environment</p>
        </div>
        <Button onClick={createFolder}>
          <Plus className="h-4 w-4 mr-2" />
          New Folder
        </Button>
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && folders.length === 0 && (
          <p className="text-sm text-muted-foreground">No folders yet. Create your first folder.</p>
        )}
        {folders.map((f) => (
          <Link key={f.id} to={`/folders/${f.id}`} className="block">
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderIcon className="h-5 w-5" />
                  {f.title}
                </CardTitle>
                <CardDescription>Updated {new Date(f.updated_at).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click to open
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
