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
  selectedTab: 'input' | 'schedule' | 'current' = 'input';

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

  constructor(private sharedSchedule: SharedScheduleService) {
    // Listen for storage events for real-time refresh
    window.addEventListener('storage', this.handleStorageEvent);
  }

  ngOnInit() {
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
    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length === 3) {
        const startTime = parts[1].trim();
        const duration = parts[2].trim();
        const startDate = this.parseStartTime(startTime);
        const endDate = this.addDuration(startDate, duration);
        this.schedule.push({
          title: parts[0].trim(),
          startTime,
          duration,
          startDate,
          endDate
        });
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
    if (!this.newTitle || !this.newStartTime || !this.newDuration) {
      this.showConfirmationPopup('Please fill in all fields.');
      return;
    }
    // Format start time as HH:mm
    const startTime = this.newStartTime;
    const duration = this.newDuration.toString();
    const startDate = this.parseStartTime(startTime);
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
    }
  }

  saveEditCurrent() {
    const now = new Date();
    const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (idx !== -1) {
      this.schedule[idx].title = this.editTitle;
      this.schedule[idx].startTime = this.editStartTime;
      this.schedule[idx].duration = this.editDuration;
      // Recalculate startDate/endDate for current and following
      this.schedule[idx].startDate = this.parseStartTime(this.editStartTime);
      this.schedule[idx].endDate = this.addDuration(this.schedule[idx].startDate!, this.editDuration);
      // Update following items' start/end
      for (let i = idx + 1; i < this.schedule.length; i++) {
        this.schedule[i].startDate = this.schedule[i-1].endDate;
        this.schedule[i].endDate = this.addDuration(this.schedule[i].startDate!, this.schedule[i].duration);
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
    if (!this.multiTitle || !this.multiStartTime || !this.multiDuration) {
      this.showConfirmationPopup('Please fill in all fields.');
      return;
    }
    const startDate = this.parseStartTime(this.multiStartTime);
    const endDate = this.addDuration(startDate, this.multiDuration.toString());
    this.schedule.push({
      title: this.multiTitle,
      startTime: this.multiStartTime,
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
    this.inputText = data;
    this.parseAndStoreSchedule();
    this.updateFutureItems();
    this.showConfirmationPopup('Programme loaded!');
  }

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
}
