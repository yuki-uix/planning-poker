import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface MessageBatch {
  sessionId: string;
  messages: Array<{
    type: string;
    data: Record<string, unknown>;
    timestamp: number;
  }>;
  batchId: string;
}

export interface OptimizedMessage {
  compressed: boolean;
  data: Buffer | string;
  originalSize?: number;
  compressedSize?: number;
}

export class MessageOptimizer {
  private messageBuffer: Map<string, Array<{ type: string; data: Record<string, unknown>; timestamp: number; }>> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchInterval: number;
  private enableCompression: boolean;
  private compressionThreshold: number; // 超过此大小的消息才压缩

  constructor(options: {
    batchInterval?: number;
    enableCompression?: boolean;
    compressionThreshold?: number;
  } = {}) {
    this.batchInterval = options.batchInterval || 100; // 100ms 批处理间隔
    this.enableCompression = options.enableCompression !== false;
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
  }

  // 消息压缩
  async compressMessage(message: Record<string, unknown>): Promise<OptimizedMessage> {
    try {
      const messageStr = JSON.stringify(message);
      const originalSize = Buffer.byteLength(messageStr, 'utf8');

      // 只有超过阈值才压缩
      if (originalSize < this.compressionThreshold) {
        return {
          compressed: false,
          data: messageStr,
          originalSize
        };
      }

      const compressed = await gzipAsync(messageStr);
      const compressedSize = compressed.length;

      // 只有压缩后更小才使用压缩
      if (compressedSize >= originalSize) {
        return {
          compressed: false,
          data: messageStr,
          originalSize
        };
      }

      return {
        compressed: true,
        data: compressed,
        originalSize,
        compressedSize
      };
    } catch (error) {
      console.error('Failed to compress message:', error);
      // 压缩失败时返回原始消息
      const messageStr = JSON.stringify(message);
      return {
        compressed: false,
        data: messageStr,
        originalSize: Buffer.byteLength(messageStr, 'utf8')
      };
    }
  }

  // 消息解压
  async decompressMessage(optimizedMessage: OptimizedMessage): Promise<Record<string, unknown>> {
    try {
      if (!optimizedMessage.compressed) {
        return JSON.parse(optimizedMessage.data as string);
      }

      const decompressed = await gunzipAsync(optimizedMessage.data as Buffer);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('Failed to decompress message:', error);
      throw error;
    }
  }

  // 添加消息到批处理队列
  addToBatch(sessionId: string, message: Record<string, unknown>, callback?: (batch: MessageBatch) => void): void {
    if (!this.messageBuffer.has(sessionId)) {
      this.messageBuffer.set(sessionId, []);
      
      // 设置批处理定时器
      const timer = setTimeout(() => {
        this.flushBatch(sessionId, callback);
      }, this.batchInterval);
      
      this.batchTimers.set(sessionId, timer);
    }

    this.messageBuffer.get(sessionId)!.push({
      type: (message.type as string) || 'unknown',
      data: message,
      timestamp: Date.now()
    });
  }

  // 立即刷新批处理
  flushBatch(sessionId: string, callback?: (batch: MessageBatch) => void): void {
    const messages = this.messageBuffer.get(sessionId);
    const timer = this.batchTimers.get(sessionId);
    
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(sessionId);
    }

    if (messages && messages.length > 0) {
      const batch: MessageBatch = {
        sessionId,
        messages,
        batchId: this.generateBatchId()
      };

      this.messageBuffer.delete(sessionId);
      
      if (callback) {
        callback(batch);
      }
    }
  }

  // 批量发送消息
  async sendBatch(batch: MessageBatch, sendFunction: (sessionId: string, message: Record<string, unknown>) => Promise<void>): Promise<void> {
    try {
      // 如果只有一条消息，直接发送
      if (batch.messages.length === 1) {
        await sendFunction(batch.sessionId, batch.messages[0]);
        return;
      }

      // 多条消息，发送批量消息
      const batchMessage = {
        type: 'batch',
        sessionId: batch.sessionId,
        batchId: batch.batchId,
        messages: batch.messages,
        timestamp: Date.now()
      };

      await sendFunction(batch.sessionId, batchMessage);
      
      console.log(`Sent batch ${batch.batchId} with ${batch.messages.length} messages to session ${batch.sessionId}`);
    } catch (error) {
      console.error('Failed to send batch:', error);
      // 批量发送失败，尝试逐个发送
      for (const message of batch.messages) {
        try {
          await sendFunction(batch.sessionId, message);
        } catch (err) {
          console.error('Failed to send individual message:', err);
        }
      }
    }
  }

  // 处理批量消息
  async processBatchMessage(batchMessage: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    if (batchMessage.type !== 'batch') {
      return [batchMessage];
    }

    return (batchMessage.messages as Record<string, unknown>[]) || [];
  }

  // 生成批处理ID
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取批处理统计信息
  getBatchStats(): {
    activeBatches: number;
    totalBufferedMessages: number;
    batchSizes: number[];
  } {
    const batchSizes: number[] = [];
    let totalBufferedMessages = 0;

    this.messageBuffer.forEach((messages) => {
      batchSizes.push(messages.length);
      totalBufferedMessages += messages.length;
    });

    return {
      activeBatches: this.messageBuffer.size,
      totalBufferedMessages,
      batchSizes
    };
  }

  // 清理所有批处理
  clearAllBatches(): void {
    this.messageBuffer.clear();
    
    this.batchTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.batchTimers.clear();
  }

  // 更新配置
  updateConfig(newConfig: {
    batchInterval?: number;
    enableCompression?: boolean;
    compressionThreshold?: number;
  }): void {
    if (newConfig.batchInterval !== undefined) {
      this.batchInterval = newConfig.batchInterval;
    }
    if (newConfig.enableCompression !== undefined) {
      this.enableCompression = newConfig.enableCompression;
    }
    if (newConfig.compressionThreshold !== undefined) {
      this.compressionThreshold = newConfig.compressionThreshold;
    }
  }

  // 获取压缩统计信息
  async getCompressionStats(messages: Record<string, unknown>[]): Promise<{
    totalOriginalSize: number;
    totalCompressedSize: number;
    compressionRatio: number;
    compressedCount: number;
    totalCount: number;
  }> {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let compressedCount = 0;

    for (const message of messages) {
      const optimized = await this.compressMessage(message);
      totalOriginalSize += optimized.originalSize || 0;
      
      if (optimized.compressed) {
        totalCompressedSize += optimized.compressedSize || 0;
        compressedCount++;
      } else {
        totalCompressedSize += optimized.originalSize || 0;
      }
    }

    return {
      totalOriginalSize,
      totalCompressedSize,
      compressionRatio: totalOriginalSize > 0 ? (1 - totalCompressedSize / totalOriginalSize) * 100 : 0,
      compressedCount,
      totalCount: messages.length
    };
  }
}

// 导出单例实例
export const messageOptimizer = new MessageOptimizer({
  batchInterval: 100,
  enableCompression: true,
  compressionThreshold: 1024
}); 