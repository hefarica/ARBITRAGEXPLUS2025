/**
 * @file alert-manager.ts
 * @description Sistema de alertas multi-canal para ARBITRAGEXPLUS2025
 * 
 * Soporta múltiples canales:
 * - Google Sheets (ALERTS sheet)
 * - Telegram
 * - Discord
 * - Email
 * - Webhooks
 */

import axios from 'axios';
import { GoogleSheetsClient } from './google-sheets-client';
import { Logger } from './logger';

// ==================================================================================
// TIPOS
// ==================================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  chainId?: number;
  txHash?: string;
  metadata?: Record<string, any>;
}

export interface AlertChannel {
  name: string;
  enabled: boolean;
  send(alert: Alert): Promise<void>;
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class AlertManager {
  private logger: Logger;
  private sheetsClient: GoogleSheetsClient;
  private channels: AlertChannel[];
  
  // Configuración
  private config: {
    telegramBotToken?: string;
    telegramChatId?: string;
    discordWebhookUrl?: string;
    emailEnabled: boolean;
    webhookUrl?: string;
  };
  
  // Rate limiting
  private alertCounts: Map<string, number>;
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
  private readonly MAX_ALERTS_PER_WINDOW = 10;
  
  constructor() {
    this.logger = new Logger('AlertManager');
    this.sheetsClient = new GoogleSheetsClient();
    this.channels = [];
    this.alertCounts = new Map();
    
    // Cargar configuración desde env
    this.config = {
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId: process.env.TELEGRAM_CHAT_ID,
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
      emailEnabled: process.env.EMAIL_ENABLED === 'true',
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
    };
    
    // Inicializar canales
    this.initializeChannels();
  }
  
  /**
   * Inicializa los canales de alerta
   */
  private initializeChannels(): void {
    // Canal: Google Sheets
    this.channels.push({
      name: 'Google Sheets',
      enabled: true,
      send: async (alert: Alert) => {
        await this.sendToSheets(alert);
      },
    });
    
    // Canal: Telegram
    if (this.config.telegramBotToken && this.config.telegramChatId) {
      this.channels.push({
        name: 'Telegram',
        enabled: true,
        send: async (alert: Alert) => {
          await this.sendToTelegram(alert);
        },
      });
    }
    
    // Canal: Discord
    if (this.config.discordWebhookUrl) {
      this.channels.push({
        name: 'Discord',
        enabled: true,
        send: async (alert: Alert) => {
          await this.sendToDiscord(alert);
        },
      });
    }
    
    // Canal: Webhook
    if (this.config.webhookUrl) {
      this.channels.push({
        name: 'Webhook',
        enabled: true,
        send: async (alert: Alert) => {
          await this.sendToWebhook(alert);
        },
      });
    }
    
    this.logger.info('Alert channels initialized', {
      channels: this.channels.map((c) => c.name),
    });
  }
  
  /**
   * Envía una alerta a todos los canales habilitados
   */
  async sendAlert(alert: Alert): Promise<void> {
    // Verificar rate limiting
    if (!this.checkRateLimit(alert)) {
      this.logger.warn('Alert rate limit exceeded, skipping', {
        severity: alert.severity,
        title: alert.title,
      });
      return;
    }
    
    this.logger.info('Sending alert', {
      severity: alert.severity,
      title: alert.title,
      channels: this.channels.length,
    });
    
    // Enviar a todos los canales en paralelo
    const promises = this.channels
      .filter((channel) => channel.enabled)
      .map(async (channel) => {
        try {
          await channel.send(alert);
          this.logger.debug(`Alert sent to ${channel.name}`);
        } catch (error) {
          this.logger.error(`Failed to send alert to ${channel.name}`, error);
        }
      });
    
    await Promise.all(promises);
  }
  
  /**
   * Verifica rate limiting
   */
  private checkRateLimit(alert: Alert): boolean {
    const key = `${alert.severity}:${alert.title}`;
    const now = Date.now();
    
    // Limpiar contadores antiguos
    for (const [k, timestamp] of this.alertCounts.entries()) {
      if (now - timestamp > this.RATE_LIMIT_WINDOW_MS) {
        this.alertCounts.delete(k);
      }
    }
    
    // Verificar límite
    const count = this.alertCounts.get(key) || 0;
    if (count >= this.MAX_ALERTS_PER_WINDOW) {
      return false;
    }
    
    // Incrementar contador
    this.alertCounts.set(key, count + 1);
    
    return true;
  }
  
  // ==================================================================================
  // CANALES DE ALERTA
  // ==================================================================================
  
  /**
   * Envía alerta a Google Sheets
   */
  private async sendToSheets(alert: Alert): Promise<void> {
    await this.sheetsClient.addAlert({
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      chain: alert.chainId ? `Chain ${alert.chainId}` : 'System',
      txHash: alert.txHash,
      timestamp: Date.now(),
      metadata: alert.metadata,
    });
  }
  
  /**
   * Envía alerta a Telegram
   */
  private async sendToTelegram(alert: Alert): Promise<void> {
    const emoji = this.getSeverityEmoji(alert.severity);
    const text = this.formatTelegramMessage(alert, emoji);
    
    await axios.post(
      `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`,
      {
        chat_id: this.config.telegramChatId,
        text,
        parse_mode: 'HTML',
      },
      {
        timeout: 5000,
      }
    );
  }
  
  /**
   * Envía alerta a Discord
   */
  private async sendToDiscord(alert: Alert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const embed = {
      title: alert.title,
      description: alert.message,
      color,
      fields: [
        {
          name: 'Severity',
          value: alert.severity.toUpperCase(),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };
    
    if (alert.chainId) {
      embed.fields.push({
        name: 'Chain',
        value: `Chain ID: ${alert.chainId}`,
        inline: true,
      });
    }
    
    if (alert.txHash) {
      embed.fields.push({
        name: 'Transaction',
        value: `\`${alert.txHash}\``,
        inline: false,
      });
    }
    
    await axios.post(
      this.config.discordWebhookUrl!,
      {
        embeds: [embed],
      },
      {
        timeout: 5000,
      }
    );
  }
  
  /**
   * Envía alerta a webhook personalizado
   */
  private async sendToWebhook(alert: Alert): Promise<void> {
    await axios.post(
      this.config.webhookUrl!,
      {
        ...alert,
        timestamp: Date.now(),
      },
      {
        timeout: 5000,
      }
    );
  }
  
  // ==================================================================================
  // HELPERS
  // ==================================================================================
  
  /**
   * Obtiene emoji según severidad
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    const emojis: Record<AlertSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    };
    
    return emojis[severity];
  }
  
  /**
   * Obtiene color según severidad (para Discord)
   */
  private getSeverityColor(severity: AlertSeverity): number {
    const colors: Record<AlertSeverity, number> = {
      info: 0x3498db, // Azul
      warning: 0xf39c12, // Naranja
      error: 0xe74c3c, // Rojo
      critical: 0x992d22, // Rojo oscuro
    };
    
    return colors[severity];
  }
  
  /**
   * Formatea mensaje para Telegram
   */
  private formatTelegramMessage(alert: Alert, emoji: string): string {
    let message = `${emoji} <b>${alert.title}</b>\n\n`;
    message += `${alert.message}\n\n`;
    message += `<b>Severity:</b> ${alert.severity.toUpperCase()}\n`;
    
    if (alert.chainId) {
      message += `<b>Chain:</b> ${alert.chainId}\n`;
    }
    
    if (alert.txHash) {
      message += `<b>TX:</b> <code>${alert.txHash}</code>\n`;
    }
    
    message += `\n<i>${new Date().toISOString()}</i>`;
    
    return message;
  }
}

