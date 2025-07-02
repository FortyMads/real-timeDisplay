import { Component, OnDestroy } from '@angular/core';
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
export class AdminComponent implements OnDestroy {
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

  constructor(private sharedSchedule: SharedScheduleService) {
    // Listen for storage events for real-time refresh
    window.addEventListener('storage', this.handleStorageEvent);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    window.removeEventListener('storage', this.handleStorageEvent);
  }

  handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'programme-schedule' || event.key === 'programme-refresh') {
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentProgramme();
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
    this.updateCurrentProgramme();
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

  updateCurrentProgramme(): void {
    const now = new Date();
    const current = this.schedule.find(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (current) {
      this.currentTitle = current.title;
      const ms = (current.endDate!.getTime() - now.getTime());
      this.remainingTime = this.formatMs(ms);
      this.remainingColor = this.getColor(ms);
    } else {
      this.currentTitle = 'No active programme';
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
    this.updateCurrentProgramme();
    this.updateFutureItems();
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
    this.timer = setInterval(() => this.updateCurrentProgramme(), 1000);
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
      this.updateCurrentProgramme();
    }
  }
}
