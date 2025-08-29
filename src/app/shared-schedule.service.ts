import { Injectable } from '@angular/core';

interface Programme {
  title: string;
  startTime: string;
  duration: string;
  startDate?: Date;
  endDate?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  paused?: boolean;
  pausedAt?: Date;
  totalPausedMs?: number;
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
      endDate: p.endDate ? p.endDate.toISOString() : undefined,
      actualStart: p.actualStart ? p.actualStart.toISOString() : undefined,
  actualEnd: p.actualEnd ? p.actualEnd.toISOString() : undefined,
  pausedAt: p.pausedAt ? p.pausedAt.toISOString() : undefined,
  totalPausedMs: p.totalPausedMs || 0
    }))));
  }

  getSchedule(): Programme[] {
    if (this._schedule.length === 0) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._schedule = JSON.parse(raw).map((p: any) => ({
          ...p,
          startDate: p.startDate ? new Date(p.startDate) : undefined,
          endDate: p.endDate ? new Date(p.endDate) : undefined,
          actualStart: p.actualStart ? new Date(p.actualStart) : undefined,
          actualEnd: p.actualEnd ? new Date(p.actualEnd) : undefined,
          pausedAt: p.pausedAt ? new Date(p.pausedAt) : undefined,
          totalPausedMs: p.totalPausedMs || 0
        }));
      }
    }
    return this._schedule;
  }
}
