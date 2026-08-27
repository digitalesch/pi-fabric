import type { Aspect } from '../core/aspect.js';

export class AspectRegistry {
  private readonly aspects = new Map<string, Aspect>();

  register(aspect: Aspect): void {
    if (this.aspects.has(aspect.name)) {
      throw new Error(`Aspect already registered: ${aspect.name}`);
    }

    this.aspects.set(aspect.name, aspect);
  }

  get(name: string): Aspect {
    const aspect = this.aspects.get(name);

    if (!aspect) {
      throw new Error(`Unknown aspect: ${name}`);
    }

    return aspect;
  }

  has(name: string): boolean {
    return this.aspects.has(name);
  }

  list(): Aspect[] {
    return [...this.aspects.values()];
  }
}
