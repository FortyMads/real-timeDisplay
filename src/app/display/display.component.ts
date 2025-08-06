import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedScheduleService } from '../shared-schedule.service';

interface Activity {
  title: string;
  startTime: string;
  duration: string;
  startDate?: Date;
  endDate?: Date;
  actualStart?: Date;
  actualEnd?: Date;
}

/**
 * DisplayComponent
 * Handles real-time display of the current programme schedule.
 * - Syncs schedule from localStorage and across tabs/windows
 * - Shows current activity and remaining time
 * - Supports fullscreen and window position persistence
 * - Listens for admin commands via postMessage
 */
@Component({
  selector: 'app-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display.component.html',
  styleUrls: ['./display.component.css']
})
export class DisplayComponent implements OnInit, OnDestroy {
  /**
   * The current schedule to display (array of activities)
   */
  @Input() schedule: Activity[] = [];
  /** Current activity title */
  currentTitle: string = '';
  /** Remaining time for current activity */
  remainingTime: string = '';
  /** Color for remaining time (green/orange/red/gray) */
  remainingColor: string = 'green';
  /** Timer interval for updating current activity */
  private timer: any;

  /** Current announcement text */
  announcement: string = '';
  /** Announcement expiration timestamp */
  announcementExpires: number = 0;

  constructor(private sharedSchedule: SharedScheduleService) {
    // Listen for storage events (across tabs)
    window.addEventListener('storage', this.handleStorageEvent);
    // Listen for fullscreen command from admin
    window.addEventListener('message', this.handleAdminMessage);
  }

  /**
   * On component init, load schedule and start timer
   * Also listen for announcements in preview iframe
   */
  ngOnInit() {
    this.loadScheduleFromLocalStorage();
    this.updateCurrentActivity();
    this.timer = setInterval(() => {
      this.updateCurrentActivity();
      this.checkAnnouncementExpiry();
    }, 1000);
    // Save window position on move/close
    window.addEventListener('beforeunload', this.saveWindowPosition);
    // Listen for announcement events (main window and iframe)
    window.addEventListener('storage', this.handleAnnouncementStorageEvent);
    
    // Auto-fullscreen if opened in a new window (detected by URL parameter or window name)
    this.checkAutoFullscreen();
  }

  /**
   * Cleanup listeners and timer on destroy
   */
  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener('storage', this.handleStorageEvent);
    window.removeEventListener('message', this.handleAdminMessage);
    window.removeEventListener('beforeunload', this.saveWindowPosition);
    window.removeEventListener('storage', this.handleAnnouncementStorageEvent);
  }

  /**
   * Load schedule from localStorage (used for real-time sync)
   */
  loadScheduleFromLocalStorage() {
    const raw = localStorage.getItem('programme-schedule');
    if (raw) {
      try {
        const parsed = JSON.parse(raw).map((p: any) => ({
          ...p,
          startDate: p.startDate ? new Date(p.startDate) : undefined,
          endDate: p.endDate ? new Date(p.endDate) : undefined
        }));
        this.schedule = parsed;
        console.log('[Display] Loaded schedule from localStorage:', this.schedule);
      } catch (e) {
        console.error('[Display] Failed to parse schedule from localStorage', e);
      }
    } else {
      this.schedule = [];
      console.log('[Display] No schedule found in localStorage.');
    }
  }

  /**
   * Handle admin fullscreen toggle command via postMessage
   * Supports both opening and closing fullscreen
   */
  handleAdminMessage = (event: MessageEvent) => {
    console.log('[Display] Received message event:', event);
    if (event.data && event.data.action === 'toggleFullScreen') {
      if (window === window.top) {
        if (!document.fullscreenElement) {
          this.goFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
    } else if (event.data && event.data.action === 'goFullScreen') {
      if (window === window.top) {
        this.goFullscreen();
      }
    }
  }

  /**
   * Handle localStorage changes for real-time schedule sync and fullscreen commands
   */
  handleStorageEvent = (event: StorageEvent) => {
    console.log('[Display] Storage event fired:', event);
    if (event.key === 'programme-schedule' || event.key === 'programme-refresh') {
      this.loadScheduleFromLocalStorage();
      this.updateCurrentActivity();
    } else if (event.key === 'fullscreen-command') {
      // Handle fullscreen toggle command from admin
      const command = JSON.parse(event.newValue || '{}');
      console.log('[Display] Received fullscreen command:', command);
      
      if (command.action === 'toggle') {
        if (!document.fullscreenElement) {
          this.goFullscreen();
        } else {
          document.exitFullscreen();
        }
      }
      
      // Clear the command after processing
      setTimeout(() => {
        localStorage.removeItem('fullscreen-command');
      }, 1000);
    }
  }

  /**
   * Update the current activity and remaining time
   */
  updateCurrentActivity(): void {
    const now = new Date();
    
    // First check for manually started activities (highest priority)
    let current = this.schedule.find(p => p.actualStart && !p.actualEnd);
    
    if (current) {
      // Manual activity in progress - show overrun/remaining time from actual start
      this.currentTitle = current.title;
      if (current.startDate && current.endDate) {
        // Calculate time from when it was supposed to end vs now
        const ms = (current.endDate!.getTime() - now.getTime());
        this.remainingTime = this.formatMs(ms);
        this.remainingColor = this.getColor(ms);
      } else {
        this.remainingTime = 'Manual';
        this.remainingColor = 'blue';
      }
      console.log('[Display] Manual activity in progress:', this.currentTitle, 'Remaining:', this.remainingTime);
    } else {
      // No manually started activity is running
      // In manual control mode, don't show scheduled activities to avoid confusion
      this.currentTitle = 'No active activity';
      this.remainingTime = 'Waiting for manual start';
      this.remainingColor = 'gray';
      console.log('[Display] No active activity - waiting for manual start');
    }
  }

  /**
   * Format milliseconds to mm:ss string (supports negative time)
   */
  formatMs(ms: number): string {
    const isNegative = ms < 0;
    const absMs = Math.abs(ms);
    const totalSec = Math.floor(absMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeStr}` : timeStr;
  }

  /**
   * Get color for remaining time based on minutes left
   */
  getColor(ms: number): string {
    const min = ms / 60000;
    if (min > 5) return 'green';
    if (min > 2) return 'orange';
    return 'red';
  }

  /**
   * Request fullscreen for the display container
   */
  goFullscreen() {
    const elem = document.getElementById('displayContainer');
    if (elem && elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem && (elem as any).webkitRequestFullscreen) { /* Safari */
      (elem as any).webkitRequestFullscreen();
    } else if (elem && (elem as any).msRequestFullscreen) { /* IE11 */
      (elem as any).msRequestFullscreen();
    }
  }

  /**
   * End the current activity immediately and start the next
   * COMMENTED OUT: Auto-switching logic - now using manual control only
   */
  endNow() {
    // COMMENTED OUT: Auto-switching logic
    // const now = new Date();
    // const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    // if (idx !== -1) {
    //   // End current item now
    //   this.schedule[idx].endDate = now;
    //   // Start next item now
    //   if (this.schedule[idx + 1]) {
    //     this.schedule[idx + 1].startDate = now;
    //     // Recalculate endDate for next item
    //     this.schedule[idx + 1].endDate = this.addDuration(now, this.schedule[idx + 1].duration);
    //   }
    //   // Save to local storage
    //   this.sharedSchedule.setSchedule(this.schedule);
    //   // Reload schedule from local storage for all tabs
    //   this.schedule = this.sharedSchedule.getSchedule();
    //   this.updateCurrentActivity();
    // }
    
    console.log('[Display] endNow() called but auto-switching disabled - use admin manual controls');
  }

  /**
   * Add duration (mm or mm:ss) to a start Date
   */
  addDuration(start: Date, duration: string): Date {
    // Expects mm or mm:ss
    const [min, sec] = duration.split(':').map(Number);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + min);
    if (sec) end.setSeconds(end.getSeconds() + sec);
    return end;
  }

  /**
   * Save window position to localStorage for multi-window support
   */
  saveWindowPosition = () => {
    try {
      localStorage.setItem('displayWindowPos', JSON.stringify({
        left: window.screenX,
        top: window.screenY
      }));
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Listen for new announcements via localStorage (for preview iframe)
   */
  handleAnnouncementStorageEvent = (event: StorageEvent) => {
    if (event.key === 'programme-announcement') {
      const raw = localStorage.getItem('programme-announcement');
      if (raw) {
        const data = JSON.parse(raw);
        this.announcement = data.text;
        this.announcementExpires = Date.now() + (data.durationMs || 120000); // default 2 min
      }
    }
  }

  /**
   * Check if announcement expired and clear overlay
   */
  checkAnnouncementExpiry() {
    if (this.announcement && Date.now() > this.announcementExpires) {
      this.announcement = '';
      this.announcementExpires = 0;
    }
  }

  /**
   * Check if this window should auto-fullscreen (new window or URL parameter)
   */
  checkAutoFullscreen() {
    setTimeout(() => {
      // Check if opened in new window by checking URL parameters or window properties
      const urlParams = new URLSearchParams(window.location.search);
      const isNewWindow = urlParams.get('fullscreen') === 'true' || 
                         window.name === 'displayWindow' ||
                         window.opener !== null; // Has parent window

      if (isNewWindow && !document.fullscreenElement) {
        console.log('[Display] Auto-entering fullscreen for new window');
        this.goFullscreen();
      }
    }, 500); // Small delay to ensure DOM is ready
  }
}
