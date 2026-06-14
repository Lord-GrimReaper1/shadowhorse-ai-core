export class MemoryStore {
  constructor() {
    this.items = [];
  }

  add(entry) {
    this.items.push({
      id: this.items.length + 1,
      ...entry
    });
  }

  list() {
    return [...this.items];
  }

  clear() {
    this.items.length = 0;
  }
}
