/**
 * Desktop & In-App Web Notification Service for Dispatch Web App
 * Supports HTML5 Web Notifications, synthesized Audio Chimes, and click-to-focus.
 */

class WebNotificationService {
  private audioCtx: AudioContext | null = null;

  /**
   * Check if the browser supports notifications
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Current permission status: 'default' | 'granted' | 'denied'
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request permission from the user in browser
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        this.playChime();
        this.showDesktopNotification('Notifications Enabled', {
          body: 'You will now receive desktop notifications for incoming driver and operations messages.',
        });
      }
      return result;
    } catch (e) {
      console.warn('Failed to request notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Synthesize a pleasant two-tone audio chime (880Hz -> 1320Hz)
   */
  playChime(): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx = new AudioCtxClass();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.setValueAtTime(1320, now + 0.08); // E6 note

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio playback may be restricted until user interacts with the page
    }
  }

  /**
   * Display native Desktop System Notification (pops up in Windows/Mac notification tray)
   */
  showDesktopNotification(
    title: string,
    options: {
      body: string;
      icon?: string;
      tag?: string;
      onClick?: () => void;
    }
  ): Notification | null {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const notif = new Notification(title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag || 'dispatch-chat',
        badge: '/favicon.ico',
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      return notif;
    } catch (err) {
      console.warn('Failed to display desktop notification:', err);
      return null;
    }
  }
}

export const notificationService = new WebNotificationService();
