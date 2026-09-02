export interface QueuedAction {
  id: string;
  type: 'checkin' | 'photoupload';
  payload: any;
  timestamp: string;
}

// Simple event listener registry for queue changes
type QueueListener = (queue: QueuedAction[]) => void;
const listeners = new Set<QueueListener>();

export const getOfflineQueue = (): QueuedAction[] => {
  try {
    const raw = localStorage.getItem('event_connect_offline_queue');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading offline queue', e);
    return [];
  }
};

const saveOfflineQueue = (queue: QueuedAction[]): void => {
  try {
    localStorage.setItem('event_connect_offline_queue', JSON.stringify(queue));
    listeners.forEach(listener => listener(queue));
  } catch (e) {
    console.error('Error writing offline queue. Storage might be full.', e);
  }
};

export const subscribeToQueue = (listener: QueueListener): (() => void) => {
  listeners.add(listener);
  // Initial call
  listener(getOfflineQueue());
  return () => {
    listeners.delete(listener);
  };
};

export const queueAction = (type: 'checkin' | 'photoupload', payload: any): void => {
  const queue = getOfflineQueue();
  const action: QueuedAction = {
    id: 'act-' + Math.random().toString(36).substring(2, 9),
    type,
    payload,
    timestamp: new Date().toISOString()
  };
  queue.push(action);
  saveOfflineQueue(queue);
};

export const removeQueuedAction = (id: string): void => {
  const queue = getOfflineQueue();
  const filtered = queue.filter(a => a.id !== id);
  saveOfflineQueue(filtered);
};

export const clearOfflineQueue = (): void => {
  saveOfflineQueue([]);
};

// Process / Synchronize queue with server
export const syncOfflineQueue = async (token: string, onProgress?: (msg: string) => void): Promise<boolean> => {
  const queue = getOfflineQueue();
  if (queue.length === 0) return true;

  onProgress?.(`Syncing ${queue.length} offline action(s)...`);

  let successCount = 0;
  for (const action of queue) {
    try {
      if (action.type === 'checkin') {
        const res = await fetch('/api/events/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(action.payload)
        });
        if (res.ok) {
          removeQueuedAction(action.id);
          successCount++;
        }
      } else if (action.type === 'photoupload') {
        const { eventId, fileUrl, caption } = action.payload;
        const res = await fetch(`/api/events/${eventId}/photos/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ fileUrl, caption })
        });
        if (res.ok) {
          removeQueuedAction(action.id);
          successCount++;
        }
      }
    } catch (err) {
      console.error('Failed to sync action', action, err);
      // Stop syncing rest if network failed again
      onProgress?.('Sync failed. Connection still offline or unstable.');
      return false;
    }
  }

  onProgress?.(`Successfully synced ${successCount} action(s)!`);
  return true;
};
