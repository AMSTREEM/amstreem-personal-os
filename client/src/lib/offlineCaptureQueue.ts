export type OfflineCapture = {
  id: string;
  endpoint: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  queuedAt: string;
};

export type OfflineCaptureSend = (capture: OfflineCapture) => Promise<unknown>;
export type OfflineCaptureFlushResult = { sent: number; remaining: number; error?: unknown };

const storageKey = (userId: string) => 'atlas-offline-captures-v1:' + userId;
const activeFlushes = new Map<string, Promise<OfflineCaptureFlushResult>>();

function readQueue(userId: string): OfflineCapture[] {
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('The offline capture queue is unreadable.');
  return parsed.filter((item): item is OfflineCapture =>
    !!item && typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.endpoint === 'string' &&
    !!item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) &&
    typeof item.idempotencyKey === 'string' &&
    typeof item.queuedAt === 'string'
  );
}

function writeQueue(userId: string, queue: OfflineCapture[]) {
  if (queue.length) localStorage.setItem(storageKey(userId), JSON.stringify(queue));
  else localStorage.removeItem(storageKey(userId));
}

export function getOfflineCaptureCount(userId: string): number {
  try { return readQueue(userId).length; }
  catch { return 0; }
}

export function enqueueOfflineCapture(userId: string, endpoint: string, payload: Record<string, unknown>): number {
  if (!userId) throw new Error('A signed-in account is required to queue a capture.');
  const queue = readQueue(userId);
  queue.push({
    id: crypto.randomUUID(),
    endpoint,
    payload,
    idempotencyKey: crypto.randomUUID(),
    queuedAt: new Date().toISOString()
  });
  writeQueue(userId, queue);
  return queue.length;
}

export function flushOfflineCaptures(userId: string, send: OfflineCaptureSend): Promise<OfflineCaptureFlushResult> {
  if (!userId) return Promise.resolve({ sent: 0, remaining: 0 });
  const active = activeFlushes.get(userId);
  if (active) return active;

  const run = (async (): Promise<OfflineCaptureFlushResult> => {
    let queue = readQueue(userId);
    let sent = 0;
    for (const capture of [...queue]) {
      try {
        await send(capture);
        queue = queue.filter(item => item.id !== capture.id);
        writeQueue(userId, queue);
        sent += 1;
      } catch (error) {
        return { sent, remaining: queue.length, error };
      }
    }
    return { sent, remaining: queue.length };
  })();

  activeFlushes.set(userId, run);
  const cleanup = () => { if (activeFlushes.get(userId) === run) activeFlushes.delete(userId); };
  void run.then(cleanup, cleanup);
  return run;
}
