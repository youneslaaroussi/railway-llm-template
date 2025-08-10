import * as Comlink from 'comlink';

function createChatWorker() {
  console.log('[FACTORY] Creating new chat worker');
  const worker = new Worker(new URL('./chat.worker.ts', import.meta.url));
  console.log('[FACTORY] Worker created:', worker);
  const wrapped = Comlink.wrap<import('./chat.worker').ChatWorker>(worker);
  console.log('[FACTORY] Worker wrapped with Comlink:', wrapped);
  return wrapped;
}

let chatWorker: ReturnType<typeof createChatWorker> | undefined;

export function getChatWorker() {
  console.log('[FACTORY] getChatWorker called');
  
  if (typeof window === 'undefined') {
    console.log('[FACTORY] Window undefined, returning null');
    return null;
  }

  if (!chatWorker) {
    console.log('[FACTORY] No existing worker, creating new one');
    chatWorker = createChatWorker();
  } else {
    console.log('[FACTORY] Returning existing worker');
  }

  return chatWorker;
} 