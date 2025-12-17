'use client';

import { useState } from 'react';
import { useOffline } from '@/lib/use-offline';
import { offlineFetch } from '@/lib/offline-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showToast } from '@/lib/toast';

export function OfflineForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { isOnline } = useOffline();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await offlineFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });

      if (response.status === 202) {
        showToast({
          title: 'Data Queued',
          description: 'Your data will sync when you\'re back online.',
          variant: 'success'
        });
      } else {
        showToast({
          title: 'Success',
          description: 'Data saved successfully!',
          variant: 'success'
        });
      }

      setName('');
      setEmail('');
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to save data',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
      </div>
      
      <Input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Saving...' : 'Save Data'}
      </Button>
    </form>
  );
}