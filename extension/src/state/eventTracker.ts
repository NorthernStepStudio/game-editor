import { NssEvent } from "../models/api.types";

export class EventTracker {
  private static instance: EventTracker;
  private events: NssEvent[] = [];
  private readonly MAX_EVENTS = 50;

  private constructor() {}

  public static getInstance(): EventTracker {
    if (!EventTracker.instance) {
      EventTracker.instance = new EventTracker();
    }
    return EventTracker.instance;
  }

  public track(type: string, metadata: Record<string, any> = {}): void {
    const event: NssEvent = {
      type,
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.events.unshift(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.pop();
    }
    
    console.log(`[EventTracker] Tracked: ${type}`, metadata);
  }

  public getEvents(): readonly NssEvent[] {
    return this.events;
  }

  public clear(): void {
    this.events = [];
  }
}

export const eventTracker = EventTracker.getInstance();
