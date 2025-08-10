// src/lib/agent-message-queue.ts

type MessageSender = (message: string) => Promise<void>;

interface QueuedMessage {
  message: string;
  resolve: () => void;
  reject: (reason?: any) => void;
}

class AgentMessageQueue {
  private queue: QueuedMessage[] = [];
  private isProcessing = false;
  private messageSender: MessageSender | null = null;
  private isStreamActive = false;

  private static instance: AgentMessageQueue;

  private constructor() {}

  public static getInstance(): AgentMessageQueue {
    if (!AgentMessageQueue.instance) {
      AgentMessageQueue.instance = new AgentMessageQueue();
    }
    return AgentMessageQueue.instance;
  }

  public initialize(messageSender: MessageSender) {
    this.messageSender = messageSender;
  }

  public setStreamActive(active: boolean) {
    this.isStreamActive = active;
    if (!active) {
      // When stream becomes inactive, process any queued messages
      this.processQueue();
    }
  }

  public add(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ message, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    // Don't process if a stream is active or already processing
    if (this.isProcessing || this.isStreamActive || this.queue.length === 0 || !this.messageSender) {
      return;
    }

    this.isProcessing = true;
    const { message, resolve, reject } = this.queue.shift()!;

    try {
      await this.messageSender(message);
      resolve();
    } catch (error) {
      console.error('Failed to send message:', error);
      reject(error);
    } finally {
      this.isProcessing = false;
      // Process next message if no stream is active
      if (!this.isStreamActive) {
        this.processQueue();
      }
    }
  }

  public onMessageStreamStart() {
    this.setStreamActive(true);
  }

  public onMessageStreamEnd() {
    this.setStreamActive(false);
  }
}

export const agentMessageQueue = AgentMessageQueue.getInstance(); 