import { Entity } from './Entity.js';
import type { Identifier } from './Identifier.js';

export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}

/**
 * Racine d'agrégat : seule porte d'entrée pour modifier l'agrégat,
 * collecte les événements métier à publier après persistance.
 */
export abstract class AggregateRoot<TId extends Identifier> extends Entity<TId> {
  private domainEvents: DomainEvent[] = [];

  protected addEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullEvents(): DomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
