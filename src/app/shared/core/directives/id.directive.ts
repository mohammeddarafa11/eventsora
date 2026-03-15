// src/app/shared/core/directives/id.directive.ts
import { Directive, ElementRef, Input, OnInit, signal } from '@angular/core';
import { generateId } from '@shared/utils/merge-classes';

@Directive({
  selector: '[zardId]',
  exportAs: 'zardId',
  standalone: true,
})
export class ZardIdDirective implements OnInit {
  @Input() zardId?: string;

  // Add a signal to store the generated ID
  private _id = signal<string>('');

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {
    // Generate or use provided ID
    const elementId = this.zardId || generateId('zard');
    this._id.set(elementId);
    this.elementRef.nativeElement.id = elementId;
  }

  // Expose id as a method that returns the signal value
  id(): string {
    return this._id();
  }
}
