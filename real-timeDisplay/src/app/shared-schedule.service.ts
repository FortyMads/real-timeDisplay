import { Injectable } from '@angular/core';

interface Programme {
  title: string;
  startTime: string;
  duration: string;
  startDate?: Date;
  endDate?: Date;
  actualStart?: Date;
  actualEnd?: Date;
}

const STORAGE_KEY = 'programme-schedule';

@Injectable({ providedIn: 'root' })
export class SharedScheduleService {
  private _schedule: Programme[] = [];

  setSchedule(schedule: Programme[]) {
    this._schedule = schedule;
    // Save to local storage (dates as ISO strings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule.map(p => ({
      ...p,
      startDate: p.startDate ? p.startDate.toISOString() : undefined,
      endDate: p.endDate ? p.endDate.toISOString() : undefined
    }))));
  }

  getSchedule(): Programme[] {
    if (this._schedule.length === 0) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._schedule = JSON.parse(raw).map((p: any) => ({
          ...p,
          startDate: p.startDate ? new Date(p.startDate) : undefined,
          endDate: p.endDate ? new Date(p.endDate) : undefined
        }));
      }
    }
    return this._schedule;
  }
}
