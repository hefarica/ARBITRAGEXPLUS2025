/**
 * ============================================================================
 * ARCHIVO: ./services/ts-executor/src/queues/queueManager.ts
 * SERVICIO: ts-executor
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ../exec/flash
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: QueueManager
 *   INTERFACES: QueueConfig, QueueItem
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: QueueConfig, QueueManager, QueueItem
 * 
 * 🔗 DEPENDENCIAS:
 *   - ../exec/flash
 * 
 * ============================================================================
 */

/**
 * Queue Manager - Gestión dinámica de colas de ejecución
 * 
 * Gestiona colas de operaciones de arbitraje consumiendo configuración desde Sheets.
 * Prioriza operaciones según profit, gas cost y configuración dinámica.
 * 
 * Premisas:
 * 1. Configuración de prioridades desde CONFIG_GENERAL en Sheets
 * 2. Arrays dinámicos para gestión de colas
 * 3. Consumido por flash.ts y el executor principal
 */

import type { ArbitrageRoute } from '../exec/flash';

export interface QueueConfig {
  maxSize: number;
  maxConcurrent: number;
  priorityWeights: { profit: number; gasEfficiency: number; age: number };
  timeoutMs: number;
  retryAttempts: number;
}

export interface QueueItem {
  id: string;
  route: ArbitrageRoute;
  priority: number;
  addedAt: number;
  attempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class QueueManager {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private completed: Map<string, QueueItem> = new Map();
  private failed: Map<string, QueueItem> = new Map();
  private config: QueueConfig;
  
  constructor(config: QueueConfig) {
    this.config = config;
  }
  
  async enqueue(routes: ArbitrageRoute[]): Promise<string[]> {
    const existingIds = new Set([
      ...this.queue.map(item => item.route.id),
      ...Array.from(this.processing),
      ...Array.from(this.completed.keys())
    ]);
    
    const newRoutes = routes.filter(route => !existingIds.has(route.id));
    
    if (newRoutes.length === 0) return [];
    
    const queueItems = newRoutes.map(route => ({
      id: route.id,
      route,
      priority: this.calculatePriority(route),
      addedAt: Date.now(),
      attempts: 0,
      status: 'pending' as const
    }));
    
    this.queue.push(...queueItems);
    this.sortQueue();
    
    if (this.queue.length > this.config.maxSize) {
      const removed = this.queue.splice(this.config.maxSize);
      removed.forEach(item => {
        this.failed.set(item.id, { ...item, status: 'failed', error: 'Queue overflow' });
      });
    }
    
    return queueItems.map(item => item.id);
  }
  
  private calculatePriority(route: ArbitrageRoute): number {
    const weights = this.config.priorityWeights;
    const profitScore = route.netProfit / 1000;
    const gasEfficiency = route.expectedProfit / Math.max(route.gasCost, 1);
    return (profitScore * weights.profit) + (gasEfficiency * weights.gasEfficiency);
  }
  
  private sortQueue(): void {
    this.queue.sort((a, b) => b.priority - a.priority);
  }
  
  async dequeue(): Promise<QueueItem | null> {
    if (this.processing.size >= this.config.maxConcurrent) return null;
    
    const pendingItems = this.queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) return null;
    
    const item = pendingItems[0];
    item.status = 'processing';
    this.processing.add(item.id);
    
    return item;
  }
  
  async complete(itemId: string): Promise<void> {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return;
    
    item.status = 'completed';
    this.processing.delete(itemId);
    this.completed.set(itemId, item);
    this.queue = this.queue.filter(i => i.id !== itemId);
  }
  
  async fail(itemId: string, error: string): Promise<boolean> {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return false;
    
    item.attempts++;
    this.processing.delete(itemId);
    
    if (item.attempts < this.config.retryAttempts) {
      item.priority *= 0.8;
      item.status = 'pending';
      this.sortQueue();
      return true;
    } else {
      item.status = 'failed';
      item.error = error;
      this.failed.set(itemId, item);
      this.queue = this.queue.filter(i => i.id !== itemId);
      return false;
    }
  }
  
  getByStatus(status: QueueItem['status']): QueueItem[] {
    if (status === 'completed') return Array.from(this.completed.values());
    if (status === 'failed') return Array.from(this.failed.values());
    return this.queue.filter(item => item.status === status);
  }
  
  size(): number {
    return this.queue.length;
  }
  
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}

export default QueueManager;
