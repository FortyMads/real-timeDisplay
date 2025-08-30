import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SharedScheduleService } from '../shared-schedule.service';

interface Programme {
  title: string;
  startTime: string;
  duration: string;
  startDate?: Date;
  endDate?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  // Pause support
  paused?: boolean;
  pausedAt?: Date;
  totalPausedMs?: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnDestroy, OnInit {
  inputText: string = '';
  schedule: Programme[] = [];
  showModal: boolean = false;
  currentTitle: string = '';
  remainingTime: string = '';
  remainingColor: string = 'white';
  private timer: any;

  // For skip-to-any-item
  selectedSkipIndex: number | null = null;
  futureItems: { index: number; title: string; startTime: string }[] = [];
  // For go-to-previous
  selectedPreviousIndex: number | null = null;
  previousItems: { index: number; title: string; startTime: string }[] = [];

  // Tab selection for UI (default to current activity)
  selectedTab: 'input' | 'schedule' | 'current' | 'announcements' = 'current';

  // Reference for the display iframe
  displayIframe: HTMLIFrameElement | null = null;

  // Beginner-friendly form fields
  newTitle: string = '';
  newStartTime: string = '';
  newDuration: number | null = null;

  // For editing current activity
  editingCurrent: boolean = false;
  editTitle: string = '';
  editStartTime: string = '';
  editDuration: string = '';

  // Control the add activity modal popup
  showAddActivityModal: boolean = false;
  // Control the add multiple activities modal popup
  showMultiActivityModal: boolean = false;
  // For multi-activity entry (single set of fields)
  multiTitle: string = '';
  multiStartTime: string = '';
  multiDuration: number | null = null;

  // Confirmation popup
  confirmationMessage: string = '';
  showConfirmation: boolean = false;

  // List of saved programmes (filenames)
  savedProgrammes: string[] = [];

  // Default sample programmes to populate localStorage if none exist
  defaultProgrammes: { name: string; data: string }[] = [
    {
      name: 'Morning Routine',
      data: 'Breakfast;07:00;30\nExercise;07:30;45\nShower;08:15;15\nCommute;08:30;30'
    },
    {
      name: 'Conference Day',
      data: 'Opening Remarks;09:00;15\nKeynote;09:15;45\nBreak;10:00;15\nSession 1;10:15;60\nLunch;11:15;60'
    },
    {
      // Assumptions: durations derived from typical service flow and the provided start times
      // 09:15 Prayer (35m), 09:50 Worship (30m), 10:20 Word (70m), 11:30 Admin and Announcements (15m)
      name: 'Default Sunday',
      data: 'Prayer;09:15;35\nWorship;09:50;30\nWord;10:20;70\nAdmin and Announcements;11:30;15'
    }
  ];

  // Announcement logic
  announcementText: string = '';
  activeAnnouncement: string | null = null;
  announcementTimeout: any = null;

  // Announcement duration in minutes (default 1)
  announcementDuration: number | null = null;

  constructor(private sharedSchedule: SharedScheduleService) {
    // Listen for storage events for real-time refresh
    window.addEventListener('storage', this.handleStorageEvent);
    // Listen for fullscreen confirmation from display windows
    window.addEventListener('message', this.handleDisplayMessage);
  }

  /**
   * Build an absolute URL to a route within this app, honoring the <base href>.
   */
  private buildAppUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(path.replace(/^\//, ''), document.baseURI);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    }
    return url.toString();
  }

  // Handle messages from display windows (fullscreen confirmation)
  handleDisplayMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'fullscreenStatus') {
      if (event.data.status === 'entered') {
        this.showConfirmationPopup('Display entered fullscreen.');
      } else if (event.data.status === 'exited') {
        this.showConfirmationPopup('Display exited fullscreen.');
      }
    }
  }

  ngOnInit() {
    this.populateDefaultProgrammes();
    this.loadSavedProgrammes();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
    window.removeEventListener('storage', this.handleStorageEvent);
    window.removeEventListener('message', this.handleDisplayMessage);
  }

  handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'programme-schedule' || event.key === 'programme-refresh') {
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
      this.updateFutureItems();
    }
  }

  onInputChange(): void {
    this.parseAndStoreSchedule();
    this.updateFutureItems();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.inputText = reader.result as string;
        this.parseAndStoreSchedule();
        this.updateFutureItems();
      };
      reader.readAsText(file);
    }
  }

  processInput(): void {
    this.parseAndStoreSchedule();
    
    // Auto-start the first activity when schedule is processed
    if (this.schedule.length > 0) {
      const now = new Date();
      const firstActivity = this.schedule[0];
      firstActivity.actualStart = now;
      firstActivity.startDate = now;
      firstActivity.endDate = this.addDuration(now, firstActivity.duration);
      this.sharedSchedule.setSchedule(this.schedule);
    }
    
    // Trigger refresh for all displays
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.showModal = this.schedule.length > 0;
    this.updateCurrentActivity();
    this.updateFutureItems();
    this.startTimer();
  }

  parseAndStoreSchedule(): void {
    this.schedule = [];
    const lines = this.inputText.split('\n');
    let lastEndDate: Date | null = null;
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length === 3) {
        const duration = parts[2].trim();
        let startDate: Date;
        if (lastEndDate) {
          startDate = new Date(lastEndDate);
        } else {
          const now = new Date();
          startDate = new Date(now);
        }
        const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endDate = this.addDuration(startDate, duration);
        this.schedule.push({
          title: parts[0].trim(),
          startTime,
          duration,
          startDate,
          endDate
        });
        lastEndDate = endDate;
      }
    }
    this.sharedSchedule.setSchedule(this.schedule);
  }

  parseStartTime(time: string): Date {
    // Expects HH:mm or HH:mm:ss
    const now = new Date();
    const [h, m, s] = time.split(':').map(Number);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s || 0);
    return date;
  }

  addDuration(start: Date, duration: string): Date {
    // Expects mm or mm:ss
    const parts = duration.split(':').map(Number);
    
    // Validate input
    if (parts.length === 0 || parts.some(isNaN)) {
      console.warn('Invalid duration format:', duration);
      return new Date(start); // Return original date if invalid
    }
    
    const min = parts[0] || 0;
    const sec = parts[1] || 0;
    
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + min);
    end.setSeconds(end.getSeconds() + sec);
    return end;
  }

  updateCurrentActivity(): void {
    const now = new Date();
    console.log('[Admin] updateCurrentActivity() called at', now.toLocaleTimeString());
    
    // Log all activities and their states
    this.schedule.forEach((activity, index) => {
      console.log(`[Admin] Activity ${index}: ${activity.title}, actualStart: ${activity.actualStart?.toLocaleTimeString()}, actualEnd: ${activity.actualEnd?.toLocaleTimeString()}, endDate: ${activity.endDate?.toLocaleTimeString()}`);
    });
    
    // COMMENTED OUT: Auto-switching logic - now using manual switching only
    // const current = this.schedule.find(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    
    // NEW: Manual switching - find currently running activity (may be overrunning)
    const runningActivityIndex = this.schedule.findIndex(p => 
      p.actualStart && !p.actualEnd
    );
    
    console.log('[Admin] Running activity index:', runningActivityIndex);
    
    if (runningActivityIndex !== -1) {
      const current = this.schedule[runningActivityIndex];
      this.currentTitle = current.title;
      // Calculate time remaining with pause compensation
      const totalPaused = (current.totalPausedMs || 0) + (current.paused && current.pausedAt ? (now.getTime() - new Date(current.pausedAt).getTime()) : 0);
      const effectiveNow = now.getTime() - totalPaused;
      const ms = current.endDate! ? (current.endDate!.getTime() - effectiveNow) : 0;
      this.remainingTime = this.formatMs(ms);
      this.remainingColor = current.paused ? 'gray' : this.getColor(ms);
      console.log('[Admin] Manual activity running:', this.currentTitle, 'Remaining:', this.remainingTime, 'ms:', ms, 'paused:', !!current.paused);
    } else {
      // No manually started activity is running
      // In manual control mode, just show that no activity is active
      // Don't fall back to scheduled activities to avoid confusion
      this.currentTitle = 'No active activity';
      this.remainingTime = 'Use "Start Next" to begin next activity';
      this.remainingColor = 'gray';
      console.log('[Admin] No active activity - waiting for manual start');
    }
    this.updateFutureItems();
  }

  updateFutureItems(): void {
    const now = new Date();
    this.futureItems = this.schedule
      .map((item, idx) => ({ index: idx, title: item.title, startTime: item.startTime, startDate: item.startDate, actualEnd: item.actualEnd }))
      .filter(item => {
        // Only show items that are after the current time and not completed
        return item.startDate && (!item.actualEnd || (item.startDate > now));
      });
    // Default to first future item if available
    if (this.futureItems.length > 0 && (this.selectedSkipIndex === null || !this.futureItems.some(f => f.index === this.selectedSkipIndex))) {
      this.selectedSkipIndex = this.futureItems[0].index;
    } else if (this.futureItems.length === 0) {
      this.selectedSkipIndex = null;
    }

    // Also compute previous items (completed or already started in the past)
    this.previousItems = this.schedule
      .map((item, idx) => ({ index: idx, title: item.title, startTime: item.startTime, startDate: item.startDate, actualStart: item.actualStart, actualEnd: item.actualEnd }))
      .filter(item => {
        return !!item.actualEnd || (!!item.actualStart) || (!!item.startDate && item.startDate <= now);
      })
      .map(item => ({ index: item.index, title: item.title, startTime: item.startTime }));

    // Default to most recent previous item
    if (this.previousItems.length > 0 && (this.selectedPreviousIndex === null || !this.previousItems.some(p => p.index === this.selectedPreviousIndex))) {
      this.selectedPreviousIndex = this.previousItems[this.previousItems.length - 1].index;
    } else if (this.previousItems.length === 0) {
      this.selectedPreviousIndex = null;
    }
  }

  skipToSelected(): void {
    if (this.selectedSkipIndex === null) return;
    const now = new Date();
    const targetIdx = this.selectedSkipIndex;
    
    // COMMENTED OUT: Auto-switching skip logic - now using manual switching only
    // // Find current item
    // const currentIdx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    // // End current and all skipped items
    // for (let i = 0; i < this.schedule.length; i++) {
    //   if (i < targetIdx && (!this.schedule[i].actualEnd || this.schedule[i].endDate! > now)) {
    //     this.schedule[i].actualEnd = now;
    //     this.schedule[i].endDate = now;
    //     if (!this.schedule[i].actualStart) {
    //       this.schedule[i].actualStart = this.schedule[i].startDate;
    //     }
    //   }
    // }
    // // Set target item as current
    // const target = this.schedule[targetIdx];
    // target.startDate = now;
    // target.actualStart = now;
    // target.endDate = this.addDuration(now, target.duration);
    // target.actualEnd = undefined;
    // // All items after target: clear actualStart/actualEnd
    // for (let i = targetIdx + 1; i < this.schedule.length; i++) {
    //   this.schedule[i].actualStart = undefined;
    //   this.schedule[i].actualEnd = undefined;
    //   // Reset startDate/endDate based on previous
    //   if (i === targetIdx + 1) {
    //     this.schedule[i].startDate = target.endDate;
    //   } else {
    //     this.schedule[i].startDate = this.addDuration(this.schedule[i - 1].startDate!, this.schedule[i - 1].duration);
    //   }
    //   this.schedule[i].endDate = this.addDuration(this.schedule[i].startDate!, this.schedule[i].duration);
    // }
    
    // NEW: Manual skip - just update the selection, don't auto-start
    this.selectedSkipIndex = targetIdx;
    this.showConfirmationPopup(`Selected activity: ${this.schedule[targetIdx].title}. Use "Start Next" to begin.`);
    
    // Save and broadcast
    this.sharedSchedule.setSchedule(this.schedule);
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateCurrentActivity();
    this.updateFutureItems();
  }

  // Add a programme from the beginner-friendly form
  addProgramme(): void {
    if (!this.newTitle || !this.newDuration || (this.schedule.length === 0 && !this.newStartTime)) {
      this.showConfirmationPopup('Please fill in all required fields.');
      return;
    }

    const isFirstActivity = this.schedule.length === 0;
    const now = new Date();

    let startDate: Date;
    let startTime: string;

    if (isFirstActivity) {
      // Validate and use the user's specified start time
      if (!this.newStartTime || !this.newStartTime.includes(':')) {
        this.showConfirmationPopup('Please enter a valid start time.');
        return;
      }
      const timeParts = this.newStartTime.split(':').map(Number);
      if (timeParts.some(isNaN) || timeParts[0] < 0 || timeParts[0] > 23 || timeParts[1] < 0 || timeParts[1] > 59) {
        this.showConfirmationPopup('Please enter a valid start time (HH:MM format).');
        return;
      }
      const [hours, minutes] = timeParts;
      startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      // If start time is in the past, schedule for tomorrow
      if (startDate < now) {
        startDate.setDate(startDate.getDate() + 1);
      }
      startTime = this.newStartTime;
    } else {
      // Auto-schedule after the last activity's end time
      const last = this.schedule[this.schedule.length - 1];
      if (!last.endDate) {
        last.startDate = last.startDate || now;
        last.endDate = this.addDuration(last.startDate, last.duration);
      }
      startDate = new Date(last.endDate!);
      startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    }

    const duration = this.newDuration.toString();
    const endDate = this.addDuration(startDate, duration);

    const newActivity: Programme = {
      title: this.newTitle,
      startTime,
      duration,
      startDate,
      endDate
    };

    // If this is the first activity, auto-start it now
    if (isFirstActivity) {
      newActivity.actualStart = now;
      newActivity.startDate = now;
      newActivity.endDate = this.addDuration(now, duration);
    }

    this.schedule.push(newActivity);
    this.sharedSchedule.setSchedule(this.schedule);
    // Notify other windows/iframes to refresh
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateFutureItems();

    // Reset form
    this.newTitle = '';
    this.newStartTime = '';
    this.newDuration = null;
    this.showAddActivityModal = false;

    this.showConfirmationPopup(isFirstActivity ? 'First activity added and started!' : 'Activity added successfully!');
  }

  // For editing current activity
  startEditCurrent() {
    const now = new Date();
    
    // First try to find manually started activity
    let runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    
    // If no manually started activity, try to find time-based current activity
    if (runningIdx === -1) {
      runningIdx = this.schedule.findIndex(p => 
        p.startDate && p.endDate && 
        now >= p.startDate && now < p.endDate
      );
    }
    
    if (runningIdx !== -1) {
      const prog = this.schedule[runningIdx];
      this.editTitle = prog.title;
      this.editStartTime = prog.startTime;
      this.editDuration = prog.duration;
      this.editingCurrent = true;
      // Do NOT stop or restart timer; timer continues running
    } else {
      this.showConfirmationPopup('No currently running activity to edit.');
    }
  }

  saveEditCurrent() {
    const now = new Date();
    
    // First try to find manually started activity
    let runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    
    // If no manually started activity, try to find time-based current activity
    if (runningIdx === -1) {
      runningIdx = this.schedule.findIndex(p => 
        p.startDate && p.endDate && 
        now >= p.startDate && now < p.endDate
      );
    }
    
    if (runningIdx !== -1) {
      // Update current activity
      this.schedule[runningIdx].title = this.editTitle;
      this.schedule[runningIdx].startTime = this.editStartTime;
      this.schedule[runningIdx].duration = this.editDuration;
      
      // Update the end time based on new duration
      if (this.schedule[runningIdx].actualStart) {
        // For manually started activities, use actual start time
        this.schedule[runningIdx].endDate = this.addDuration(this.schedule[runningIdx].actualStart!, this.editDuration);
      } else {
        // For time-based activities, use scheduled start time
        this.schedule[runningIdx].endDate = this.addDuration(this.schedule[runningIdx].startDate!, this.editDuration);
      }
      
      // Save changes
      this.sharedSchedule.setSchedule(this.schedule);
      localStorage.setItem('programme-refresh', Date.now().toString());
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
      this.updateFutureItems();
      this.editingCurrent = false;
      this.showConfirmationPopup('Current activity updated successfully!');
    } else {
      this.showConfirmationPopup('No currently running activity to save.');
    }
  }

  cancelEditCurrent() {
    this.editingCurrent = false;
  }

  // Add another activity from the multi-activity modal
  addAnotherActivity() {
    // Validation changes based on whether this is first activity or not
    const isFirstActivity = this.schedule.length === 0;
    
    if (!this.multiTitle || !this.multiDuration || (isFirstActivity && !this.multiStartTime)) {
      const missingField = !this.multiTitle ? 'title' : !this.multiDuration ? 'duration' : 'start time';
      this.showConfirmationPopup(`Please fill in the ${missingField} field.`);
      return;
    }
    const now = new Date();
    
    let startDate: Date;
    let startTime: string;
    
    if (isFirstActivity) {
      // First activity: Validate and use user's specified start time
      if (!this.multiStartTime || !this.multiStartTime.includes(':')) {
        this.showConfirmationPopup('Please enter a valid start time.');
        return;
      }
      
      const timeParts = this.multiStartTime.split(':').map(Number);
      if (timeParts.some(isNaN) || timeParts[0] < 0 || timeParts[0] > 23 || timeParts[1] < 0 || timeParts[1] > 59) {
        this.showConfirmationPopup('Please enter a valid start time (HH:MM format).');
        return;
      }
      
      const [hours, minutes] = timeParts;
      startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);
      
      // If start time is in the past, schedule for tomorrow
      if (startDate < now) {
        startDate.setDate(startDate.getDate() + 1);
      }
      startTime = this.multiStartTime;
    } else {
      // Subsequent activities: Schedule after the last activity's end time
      const lastActivity = this.schedule[this.schedule.length - 1];
      if (!lastActivity.endDate) {
        // Fallback if endDate is missing
        lastActivity.endDate = this.addDuration(lastActivity.startDate || now, lastActivity.duration);
      }
      startDate = lastActivity.endDate;
      startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    }
    
  const endDate = this.addDuration(startDate, this.multiDuration.toString());
    
    const newActivity: Programme = {
      title: this.multiTitle,
      startTime,
      duration: this.multiDuration.toString(),
      startDate,
      endDate
    };
    
    // If this is the first activity, auto-start it
    if (isFirstActivity) {
      newActivity.actualStart = now;
      newActivity.startDate = now;
      newActivity.endDate = this.addDuration(now, this.multiDuration.toString());
    }
    
    this.schedule.push(newActivity);
    this.sharedSchedule.setSchedule(this.schedule);
  this.updateFutureItems();
  // Broadcast update for other windows
  localStorage.setItem('programme-refresh', Date.now().toString());
    // Clear fields for next entry
    this.multiTitle = '';
    this.multiStartTime = '';
    this.multiDuration = null;
    
    if (isFirstActivity) {
      this.showConfirmationPopup('First activity added and started! Enter another or click Done.');
    } else {
      this.showConfirmationPopup('Activity added! Enter another or click Done.');
    }
  }

  // Optionally, close modal and clear fields
  closeMultiActivityModal() {
    this.showMultiActivityModal = false;
    this.multiTitle = '';
    this.multiStartTime = '';
    this.multiDuration = null;
  }

  formatMs(ms: number): string {
    // Handle negative time (overrun)
    const isNegative = ms < 0;
    const absMs = Math.abs(ms);
    const totalSec = Math.floor(absMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const timeString = hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeString}` : timeString;
  }

  getColor(ms: number): string {
    const min = ms / 60000;
    if (min < 0) return 'red'; // Overrun - show red for negative time
    if (min > 5) return 'white';
    if (min > 2) return 'orange';
    return 'red';
  }

  startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => this.updateCurrentActivity(), 1000);
  }

  stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
  }

  closeModal(): void {
    this.showModal = false;
    this.stopTimer();
  }

  endNow() {
    const now = new Date();
    // COMMENTED OUT: Old auto-switching logic
    // const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    // if (idx !== -1) {
    //   // End current item now
    //   this.schedule[idx].endDate = now;
    //   this.schedule[idx].actualEnd = now;
    //   if (!this.schedule[idx].actualStart) {
    //     this.schedule[idx].actualStart = this.schedule[idx].startDate;
    //   }
    // }
    
    // NEW: Manual end current activity
    const runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    if (runningIdx !== -1) {
      this.schedule[runningIdx].actualEnd = now;
      this.showConfirmationPopup(`Ended: ${this.schedule[runningIdx].title}`);
    }
      
    // Save to local storage
    this.sharedSchedule.setSchedule(this.schedule);
    // Trigger refresh for all displays
    localStorage.setItem('programme-refresh', Date.now().toString());
    // Reload schedule from local storage for all tabs
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateCurrentActivity();
  }

  // NEW: Manual activity control methods
  startNextActivity() {
    const now = new Date();
    // End any currently running activity first
    const runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    if (runningIdx !== -1) {
      this.schedule[runningIdx].actualEnd = now;
    }
    
    // Find the next activity to start (next chronologically or first unstarted)
    let nextIdx = -1;
    
    // First try to find the next scheduled activity that should be running now or next
    const currentOrNextActivities = this.schedule
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.actualStart && !item.actualEnd && item.startDate)
      .sort((a, b) => a.item.startDate!.getTime() - b.item.startDate!.getTime());
    
    if (currentOrNextActivities.length > 0) {
      nextIdx = currentOrNextActivities[0].index;
    }
    
    if (nextIdx !== -1) {
      this.schedule[nextIdx].actualStart = now;
      this.schedule[nextIdx].startDate = now;
      this.schedule[nextIdx].endDate = this.addDuration(now, this.schedule[nextIdx].duration);
      
      // Update subsequent activities' scheduled times to prevent overlap confusion
      // This ensures that future activities have realistic scheduled times
      let currentEndTime = this.schedule[nextIdx].endDate!;
      for (let i = nextIdx + 1; i < this.schedule.length; i++) {
        if (!this.schedule[i].actualStart && !this.schedule[i].actualEnd) {
          this.schedule[i].startDate = new Date(currentEndTime);
          this.schedule[i].endDate = this.addDuration(currentEndTime, this.schedule[i].duration);
          currentEndTime = this.schedule[i].endDate!;
          
          // Update the display time string
          this.schedule[i].startTime = `${this.schedule[i].startDate!.getHours().toString().padStart(2, '0')}:${this.schedule[i].startDate!.getMinutes().toString().padStart(2, '0')}`;
        }
      }
      
      // Save and broadcast changes
      this.sharedSchedule.setSchedule(this.schedule);
      localStorage.setItem('programme-refresh', Date.now().toString());
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
      this.showConfirmationPopup(`Started: ${this.schedule[nextIdx].title}`);
    } else {
      this.showConfirmationPopup('No more activities to start.');
    }
  }

  endCurrentActivity() {
    const now = new Date();
    const runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    if (runningIdx !== -1) {
      this.schedule[runningIdx].actualEnd = now;
      
      // Save and broadcast changes
      this.sharedSchedule.setSchedule(this.schedule);
      localStorage.setItem('programme-refresh', Date.now().toString());
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
      this.showConfirmationPopup(`Ended: ${this.schedule[runningIdx].title}`);
    }
  }

  // Start the selected previous item now
  goToPreviousSelected() {
    if (this.selectedPreviousIndex === null) return;
    const now = new Date();
    const targetIdx = this.selectedPreviousIndex;

    // End any currently running activity
    const runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    if (runningIdx !== -1) {
      this.schedule[runningIdx].actualEnd = now;
    }

    // Start the selected previous item now
    const target = this.schedule[targetIdx];
    target.actualStart = now;
    target.startDate = now;
    // Reset pause state when restarting
    target.paused = false;
    target.pausedAt = undefined;
    target.totalPausedMs = 0;
    target.endDate = this.addDuration(now, target.duration);

    // For items before targetIdx, mark them as completed if they were in progress without end
    for (let i = 0; i < targetIdx; i++) {
      const item = this.schedule[i];
      if (item.actualStart && !item.actualEnd) {
        item.actualEnd = now;
      }
    }

    // For items after targetIdx that haven't started yet, leave them pending; don't recalculate times here
    // This preserves the plan; operator can Start Next when ready.

    // Persist and broadcast
    this.sharedSchedule.setSchedule(this.schedule);
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateCurrentActivity();
    this.updateFutureItems();
    this.showConfirmationPopup(`Re-started: ${target.title}`);
  }

  // End the entire programme and clear the table
  endProgramme() {
    this.schedule = [];
    this.sharedSchedule.setSchedule(this.schedule);
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.updateCurrentActivity();
    this.updateFutureItems();
    this.showConfirmationPopup('Programme ended and cleared.');
  }

  // Pause/Resume current activity without changing its original duration
  togglePauseCurrent() {
    const now = new Date();
    const runningIdx = this.schedule.findIndex(p => p.actualStart && !p.actualEnd);
    if (runningIdx === -1) return;
    const current = this.schedule[runningIdx];
    if (current.paused) {
      // Resume: accumulate paused duration
      const pausedAtMs = current.pausedAt ? new Date(current.pausedAt).getTime() : now.getTime();
      const delta = now.getTime() - pausedAtMs;
      current.totalPausedMs = (current.totalPausedMs || 0) + delta;
      current.paused = false;
      current.pausedAt = undefined;
      this.showConfirmationPopup('Resumed');
    } else {
      // Pause: mark paused and timestamp
      current.paused = true;
      current.pausedAt = now;
      this.showConfirmationPopup('Paused');
    }
    // Persist and broadcast
    this.sharedSchedule.setSchedule(this.schedule);
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateCurrentActivity();
  }

  

  openDisplayInNewWindow() {
    // Try to detect secondary monitor and use it
    this.detectAndUseSecondaryMonitor();
  }

  /**
   * Detect secondary monitor and open display there, like EasyWorship
   */
  detectAndUseSecondaryMonitor() {
    const screenWidth = screen.width;
    const screenHeight = screen.height;
    
    // Get stored preferences
    const prefs = this.getDisplayPreferences();
    
    // Calculate position for secondary monitor
    // Most common setup: primary monitor at 0,0 and secondary to the right
    let targetX = screenWidth; // Start on second monitor
    let targetY = 0;
    let targetWidth = screenWidth;
    let targetHeight = screenHeight;
    
    // If we have stored preferences, use them
    if (prefs.preferredMonitor) {
      targetX = prefs.preferredMonitor.x;
      targetY = prefs.preferredMonitor.y;
      targetWidth = prefs.preferredMonitor.width;
      targetHeight = prefs.preferredMonitor.height;
    } else {
      // Try to detect if we have multiple monitors
      // If window can be moved beyond primary screen width, we likely have secondary monitor
      const testWindow = window.open('about:blank', 'test', 'width=1,height=1,left=' + (screenWidth + 100) + ',top=100');
      if (testWindow) {
        // We can open windows on secondary monitor
        testWindow.close();
        // Store this as preferred monitor
        prefs.preferredMonitor = {
          x: screenWidth,
          y: 0,
          width: screenWidth,
          height: screenHeight
        };
        this.saveDisplayPreferences(prefs);
      } else {
        // Fallback to primary monitor
        targetX = 100;
        targetY = 100;
        targetWidth = Math.min(1200, screenWidth - 200);
        targetHeight = Math.min(800, screenHeight - 200);
      }
    }

    // Open the display window (respect repository base path when hosted on GitHub Pages)
    const displayUrl = this.buildAppUrl('display', { fullscreen: true, autostart: true });
    const displayWindow = window.open(
      displayUrl,
      'displayWindow',
      `width=${targetWidth},height=${targetHeight},left=${targetX},top=${targetY},menubar=no,toolbar=no,location=no,status=no,scrollbars=no`
    );

    // If successful, save the position
    if (displayWindow) {
      console.log('[Admin] Display window opened on secondary monitor');
      
      // Store this position for future use
      setTimeout(() => {
        try {
          const pos = {
            left: displayWindow.screenX || targetX,
            top: displayWindow.screenY || targetY,
            width: displayWindow.outerWidth || targetWidth,
            height: displayWindow.outerHeight || targetHeight
          };
          localStorage.setItem('displayWindowPos', JSON.stringify(pos));
        } catch (e) {
          // Cross-origin restrictions may prevent access
        }
      }, 1000);
    }
  }

  /**
   * Get display preferences (shared with display component)
   */
  getDisplayPreferences() {
    try {
      const stored = localStorage.getItem('display-preferences');
      return stored ? JSON.parse(stored) : {
        alwaysFullscreen: true,
        preferredMonitor: null,
        windowPosition: null
      };
    } catch (e) {
      return {
        alwaysFullscreen: true,
        preferredMonitor: null,
        windowPosition: null
      };
    }
  }

  /**
   * Save display preferences
   */
  saveDisplayPreferences(prefs: any) {
    try {
      localStorage.setItem('display-preferences', JSON.stringify(prefs));
    } catch (e) {
      console.warn('[Admin] Could not save display preferences');
    }
  }

  downloadSchedule() {
    // Convert schedule to text in the format: Title;Start Time;Duration\n
    const lines = this.schedule.map(item => `${item.title};${item.startTime};${item.duration}`);
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity-schedule.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  // Open Add Activity modal and close the other
  openAddActivityModal() {
    this.showAddActivityModal = true;
    this.showMultiActivityModal = false;
  }
  // Open Add Multiple Activities modal and close the other
  openMultiActivityModal() {
    this.showMultiActivityModal = true;
    this.showAddActivityModal = false;
  }
  // Toggle Add Activity modal
  toggleAddActivityModal() {
    this.showAddActivityModal = !this.showAddActivityModal;
    if (this.showAddActivityModal) this.showMultiActivityModal = false;
  }

  // Toggle Add Multiple Activities modal
  toggleMultiActivityModal() {
    this.showMultiActivityModal = !this.showMultiActivityModal;
    if (this.showMultiActivityModal) this.showAddActivityModal = false;
  }
  // Show confirmation popup
  showConfirmationPopup(message: string) {
    this.confirmationMessage = message;
    this.showConfirmation = true;
    setTimeout(() => { this.showConfirmation = false; }, 2000);
  }

  // Load list of saved programmes from localStorage
  loadSavedProgrammes() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('programme-'));
    this.savedProgrammes = keys.map(k => k.replace('programme-', ''));
  }
  // Save current schedule as a programme in localStorage
  saveProgrammeToLocal(name: string) {
    const lines = this.schedule.map(item => `${item.title};${item.startTime};${item.duration}`);
    localStorage.setItem('programme-' + name, lines.join('\n'));
    this.loadSavedProgrammes();
  }
  // Load a saved programme into the schedule
  loadProgramme(name: string) {
    const data = localStorage.getItem('programme-' + name);
    if (!data) {
      this.showConfirmationPopup('Programme not found.');
      return;
    }
    // Parse activities for editing
    const items: Programme[] = [];
    const lines = data.split('\n');
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length === 3) {
        items.push({
          title: parts[0].trim(),
          startTime: parts[1].trim(),
          duration: parts[2].trim()
        });
      }
    }
    this.editProgrammeItems = items;
    this.editProgrammeName = name;
    this.showEditProgrammeModal = true;
  }

  // Confirm and load edited programme
  confirmEditProgramme() {
    // Validate edited items
    if (this.editProgrammeItems.some(item => !item.title || !item.duration)) {
      this.showConfirmationPopup('Please fill in all fields for every activity.');
      return;
    }
    // Set start time of first item to current time, and schedule all after previous
    const now = new Date();
    let currentDate = new Date(now);
    this.editProgrammeItems[0].startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    this.editProgrammeItems[0].startDate = new Date(currentDate);
    this.editProgrammeItems[0].endDate = this.addDuration(currentDate, this.editProgrammeItems[0].duration);
    // Recalculate start/end for all subsequent items
    for (let i = 1; i < this.editProgrammeItems.length; i++) {
      currentDate = this.editProgrammeItems[i-1].endDate!;
      this.editProgrammeItems[i].startTime = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;
      this.editProgrammeItems[i].startDate = new Date(currentDate);
      this.editProgrammeItems[i].endDate = this.addDuration(currentDate, this.editProgrammeItems[i].duration);
    }
    // Convert to text and process
    const text = this.editProgrammeItems.map(item => `${item.title};${item.startTime};${item.duration}`).join('\n');
    this.inputText = text;
    this.parseAndStoreSchedule();
    this.updateFutureItems();
    
    // Auto-start the first activity when programme is loaded
    if (this.schedule.length > 0) {
      const firstActivity = this.schedule[0];
      firstActivity.actualStart = now;
      firstActivity.startDate = now;
      firstActivity.endDate = this.addDuration(now, firstActivity.duration);
      this.sharedSchedule.setSchedule(this.schedule);
    }
    
    // Force refresh for all displays so the current activity updates immediately
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.showEditProgrammeModal = false;
    this.showConfirmationPopup('Programme loaded and first activity started!');
  }

  // Cancel editing
  cancelEditProgramme() {
    this.showEditProgrammeModal = false;
    this.editProgrammeItems = [];
    this.editProgrammeName = '';
  }

  // Prompt and save programme (used by Save Programme button)
  promptAndSaveProgramme() {
    const programmeName = prompt('Enter a name for this programme:');
    if (!programmeName) {
      this.showConfirmationPopup('Programme name is required.');
      return;
    }
    // Save all activities as one programme
    const lines = this.schedule.map(item => `${item.title};${item.startTime};${item.duration}`);
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${programmeName}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
    this.saveProgrammeToLocal(programmeName);
    this.showConfirmationPopup('Programme saved!');
  }


  // Populate localStorage with default sample programmes if none exist
  populateDefaultProgrammes() {
    // Ensure each default exists once; don't overwrite user changes
    this.defaultProgrammes.forEach(prog => {
      const key = 'programme-' + prog.name;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, prog.data);
      }
    });
  }

  // For editing loaded programme (add missing properties)
  showEditProgrammeModal: boolean = false;
  editProgrammeItems: Programme[] = [];
  editProgrammeName: string = '';

  // Add a blank activity to the edit modal
  addEditProgrammeActivity() {
    this.editProgrammeItems.push({ title: '', startTime: '', duration: '' });
  }

  sendAnnouncement() {
    if (!this.announcementText.trim()) return;
    this.activeAnnouncement = this.announcementText.trim();
    // Use custom duration if provided, else default to 1 minute
    const durationMs = (this.announcementDuration && this.announcementDuration > 0)
      ? this.announcementDuration * 60000
      : 60000;
    localStorage.setItem('programme-announcement', JSON.stringify({
      text: this.activeAnnouncement,
      durationMs
    }));
    // Hide after duration
    if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
    this.announcementTimeout = setTimeout(() => {
      this.activeAnnouncement = null;
      localStorage.removeItem('programme-announcement');
    }, durationMs);
    this.announcementText = '';
    this.announcementDuration = null;
  }

  deleteProgramme(name: string) {
    if (!confirm(`Delete programme '${name}'? This cannot be undone.`)) return;
    localStorage.removeItem('programme-' + name);
    this.loadSavedProgrammes();
    this.showConfirmationPopup('Programme deleted!');
  }

  /**
   * Toggle always fullscreen setting
   */
  toggleAlwaysFullscreen(event: any) {
    const prefs = this.getDisplayPreferences();
    prefs.alwaysFullscreen = event.target.checked;
    this.saveDisplayPreferences(prefs);
    
    console.log('[Admin] Always fullscreen set to:', prefs.alwaysFullscreen);
    
    if (prefs.alwaysFullscreen) {
      this.showConfirmationPopup('Display will now always start in fullscreen mode');
    } else {
      this.showConfirmationPopup('Display will start in windowed mode');
    }
  }
}
