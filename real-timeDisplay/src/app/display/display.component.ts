import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedScheduleService } from '../shared-schedule.service';

interface Programme {
  title: string;
  startTime: string;
  duration: string;
  startDate?: Date;
  endDate?: Date;
}

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display.component.html',
  styleUrls: ['./display.component.css']
})
export class DisplayComponent implements OnInit, OnDestroy {
  @Input() schedule: Programme[] = [];
  currentTitle: string = '';
  remainingTime: string = '';
  remainingColor: string = 'green';
  private timer: any;

  constructor(private sharedSchedule: SharedScheduleService) {
    window.addEventListener('storage', this.handleStorageEvent);
  }

  ngOnInit() {
    this.updateCurrentProgramme();
    this.timer = setInterval(() => this.updateCurrentProgramme(), 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener('storage', this.handleStorageEvent);
  }

  handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'programme-schedule' || event.key === 'programme-refresh') {
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentProgramme();
    }
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

  endNow() {
    const now = new Date();
    const idx = this.schedule.findIndex(p => p.startDate && p.endDate && now >= p.startDate && now < p.endDate);
    if (idx !== -1) {
      // End current item now
      this.schedule[idx].endDate = now;
      // Start next item now
      if (this.schedule[idx + 1]) {
        this.schedule[idx + 1].startDate = now;
        // Recalculate endDate for next item
        this.schedule[idx + 1].endDate = this.addDuration(now, this.schedule[idx + 1].duration);
      }
      // Save to local storage
      this.sharedSchedule.setSchedule(this.schedule);
      // Reload schedule from local storage for all tabs
      this.schedule = this.sharedSchedule.getSchedule();
      this.updateCurrentProgramme();
    }
  }

  addDuration(start: Date, duration: string): Date {
    // Expects mm or mm:ss
    const [min, sec] = duration.split(':').map(Number);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + min);
    if (sec) end.setSeconds(end.getSeconds() + sec);
    return end;
  }
}
