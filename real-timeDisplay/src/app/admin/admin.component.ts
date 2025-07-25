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
  remainingColor: string = 'green';
  private timer: any;

  // For skip-to-any-item
  selectedSkipIndex: number | null = null;
  futureItems: { index: number; title: string; startTime: string }[] = [];

  // Tab selection for UI (now supports 3 tabs)
  selectedTab: 'input' | 'schedule' | 'current' | 'announcements' = 'input';

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
    window.removeEventListener('storage', this.handleStorageEvent);
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
    const [min, sec] = duration.split(':').map(Number);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + min);
    if (sec) end.setSeconds(end.getSeconds() + sec);
    return end;
  }

  updateCurrentActivity(): void {
    const now = new Date();
    const current = this.schedule.find(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (current) {
      this.currentTitle = current.title;
      const ms = (current.endDate!.getTime() - now.getTime());
      this.remainingTime = this.formatMs(ms);
      this.remainingColor = this.getColor(ms);
    } else {
      this.currentTitle = 'No active activity';
      this.remainingTime = '';
      this.remainingColor = 'gray';
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
  }

  skipToSelected(): void {
    if (this.selectedSkipIndex === null) return;
    const now = new Date();
    const targetIdx = this.selectedSkipIndex;
    // Find current item
    const currentIdx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    // End current and all skipped items
    for (let i = 0; i < this.schedule.length; i++) {
      if (i < targetIdx && (!this.schedule[i].actualEnd || this.schedule[i].endDate! > now)) {
        this.schedule[i].actualEnd = now;
        this.schedule[i].endDate = now;
        if (!this.schedule[i].actualStart) {
          this.schedule[i].actualStart = this.schedule[i].startDate;
        }
      }
    }
    // Set target item as current
    const target = this.schedule[targetIdx];
    target.startDate = now;
    target.actualStart = now;
    target.endDate = this.addDuration(now, target.duration);
    target.actualEnd = undefined;
    // All items after target: clear actualStart/actualEnd
    for (let i = targetIdx + 1; i < this.schedule.length; i++) {
      this.schedule[i].actualStart = undefined;
      this.schedule[i].actualEnd = undefined;
      // Reset startDate/endDate based on previous
      if (i === targetIdx + 1) {
        this.schedule[i].startDate = target.endDate;
      } else {
        this.schedule[i].startDate = this.addDuration(this.schedule[i - 1].startDate!, this.schedule[i - 1].duration);
      }
      this.schedule[i].endDate = this.addDuration(this.schedule[i].startDate!, this.schedule[i].duration);
    }
    // Save and broadcast
    this.sharedSchedule.setSchedule(this.schedule);
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.schedule = this.sharedSchedule.getSchedule();
    this.updateCurrentActivity();
    this.updateFutureItems();
  }

  // Add a programme from the beginner-friendly form
  addProgramme(): void {
    if (!this.newTitle || !this.newDuration) {
      this.showConfirmationPopup('Please fill in all fields.');
      return;
    }
    // Always schedule after last activity
    let startDate: Date;
    if (this.schedule.length > 0) {
      startDate = this.schedule[this.schedule.length - 1].endDate!;
    } else {
      const now = new Date();
      startDate = new Date(now);
    }
    const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const duration = this.newDuration.toString();
    const endDate = this.addDuration(startDate, duration);
    this.schedule.push({
      title: this.newTitle,
      startTime,
      duration,
      startDate,
      endDate
    });
    this.sharedSchedule.setSchedule(this.schedule);
    this.updateFutureItems();
    this.newTitle = '';
    this.newStartTime = '';
    this.newDuration = null;
    this.showAddActivityModal = false;
    this.showConfirmationPopup('Activity added successfully!');
  }

  // For editing current activity
  startEditCurrent() {
    const now = new Date();
    const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (idx !== -1) {
      const prog = this.schedule[idx];
      this.editTitle = prog.title;
      this.editStartTime = prog.startTime;
      this.editDuration = prog.duration;
      this.editingCurrent = true;
      // Do NOT stop or restart timer; timer continues running
    }
  }

  saveEditCurrent() {
    const now = new Date();
    const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (idx !== -1) {
      // Update current activity
      this.schedule[idx].title = this.editTitle;
      this.schedule[idx].startTime = this.editStartTime;
      this.schedule[idx].duration = this.editDuration;
      this.schedule[idx].startDate = this.parseStartTime(this.editStartTime);
      this.schedule[idx].endDate = this.addDuration(this.schedule[idx].startDate!, this.editDuration);
      // Sequentially schedule all following activities
      let prevEnd = this.schedule[idx].endDate;
      for (let i = idx + 1; i < this.schedule.length; i++) {
        this.schedule[i].startDate = new Date(prevEnd!);
        this.schedule[i].startTime = `${prevEnd!.getHours().toString().padStart(2, '0')}:${prevEnd!.getMinutes().toString().padStart(2, '0')}`;
        this.schedule[i].endDate = this.addDuration(this.schedule[i].startDate!, this.schedule[i].duration);
        if (this.schedule[i].endDate) {
          prevEnd = this.schedule[i].endDate as Date;
        }
      }
      this.sharedSchedule.setSchedule(this.schedule);
      localStorage.setItem('programme-refresh', Date.now().toString());
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
      this.updateFutureItems();
      this.editingCurrent = false;
    }
  }

  cancelEditCurrent() {
    this.editingCurrent = false;
  }

  // Add another activity from the multi-activity modal
  addAnotherActivity() {
    if (!this.multiTitle || !this.multiDuration) {
      this.showConfirmationPopup('Please fill in all fields.');
      return;
    }
    // Always schedule after last activity
    let startDate: Date;
    if (this.schedule.length > 0) {
      startDate = this.schedule[this.schedule.length - 1].endDate!;
    } else {
      const now = new Date();
      startDate = new Date(now);
    }
    const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endDate = this.addDuration(startDate, this.multiDuration.toString());
    this.schedule.push({
      title: this.multiTitle,
      startTime,
      duration: this.multiDuration.toString(),
      startDate,
      endDate
    });
    this.sharedSchedule.setSchedule(this.schedule);
    this.updateFutureItems();
    // Clear fields for next entry
    this.multiTitle = '';
    this.multiStartTime = '';
    this.multiDuration = null;
    this.showConfirmationPopup('Activity added! Enter another or click Done.');
  }

  // Optionally, close modal and clear fields
  closeMultiActivityModal() {
    this.showMultiActivityModal = false;
    this.multiTitle = '';
    this.multiStartTime = '';
    this.multiDuration = null;
  }

  formatMs(ms: number): string {
    if (ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  getColor(ms: number): string {
    const min = ms / 60000;
    if (min > 5) return 'green';
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
    const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (idx !== -1) {
      // End current item now
      this.schedule[idx].endDate = now;
      this.schedule[idx].actualEnd = now;
      if (!this.schedule[idx].actualStart) {
        this.schedule[idx].actualStart = this.schedule[idx].startDate;
      }
      // Start next item now
      if (this.schedule[idx + 1]) {
        this.schedule[idx + 1].startDate = now;
        this.schedule[idx + 1].actualStart = now;
        // Recalculate endDate for next item
        this.schedule[idx + 1].endDate = this.addDuration(now, this.schedule[idx + 1].duration);
      }
      // Save to local storage
      this.sharedSchedule.setSchedule(this.schedule);
      // Trigger refresh for all displays
      localStorage.setItem('programme-refresh', Date.now().toString());
      // Reload schedule from local storage for all tabs
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentActivity();
    }
  }

  // Called when Full Screen button is clicked in Preview tab
  sendFullscreenToDisplay() {
    // Find the iframe
    const iframe = document.querySelector('iframe[src="/display"]') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ action: 'goFullScreen' }, '*');
    }
  }

  // Trigger fullscreen on the real display from the mini preview
  sendMiniFullscreenToDisplay() {
    // This should send a message to all open /display pages (not the preview iframe itself)
    window.postMessage({ action: 'goFullScreen' }, '*');
  }

  openDisplayInNewWindow() {
    const pos = JSON.parse(localStorage.getItem('displayWindowPos') || '{}');
    const left = typeof pos.left === 'number' ? pos.left : 100;
    const top = typeof pos.top === 'number' ? pos.top : 100;
    const width = 900;
    const height = 600;
    window.open(
      '/display',
      '_blank',
      `width=${width},height=${height},left=${left},top=${top}`
    );
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
    // Force refresh for all displays so the current activity updates immediately
    localStorage.setItem('programme-refresh', Date.now().toString());
    this.showEditProgrammeModal = false;
    this.showConfirmationPopup('Programme loaded!');
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

  // Toggle fullscreen for all open display windows (not preview iframe)
  toggleFullscreenOnDisplays() {
    window.postMessage({ action: 'toggleFullScreen' }, '*');
  }

  // Populate localStorage with default sample programmes if none exist
  populateDefaultProgrammes() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('programme-'));
    if (keys.length === 0) {
      this.defaultProgrammes.forEach(prog => {
        localStorage.setItem('programme-' + prog.name, prog.data);
      });
    }
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
}
