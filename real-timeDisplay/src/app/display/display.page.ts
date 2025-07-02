import { Component, ChangeDetectorRef } from '@angular/core';
import { DisplayComponent } from './display.component';
import { SharedScheduleService } from '../shared-schedule.service';

@Component({
  selector: 'app-display-page',
  standalone: true,
  imports: [DisplayComponent],
  template: `
    <app-display [schedule]="schedule"></app-display>
  `
})
export class DisplayPageComponent {
  schedule;
  constructor(private sharedSchedule: SharedScheduleService, private cdr: ChangeDetectorRef) {
    this.schedule = this.sharedSchedule.getSchedule();
  }

  ngOnInit() {
    window.addEventListener('storage', this.handleStorageEvent);
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.handleStorageEvent);
  }

  handleStorageEvent = (event: StorageEvent) => {
    if (event.key === 'programme-schedule' || event.key === 'programme-refresh') {
      this.schedule = this.sharedSchedule.getSchedule();
      this.cdr.detectChanges();
    }
  }
}
