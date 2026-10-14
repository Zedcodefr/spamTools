/**
 * Donnée externe non conforme au format attendu.
 */
export class InvalidSourceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Lecture typée d'un document JSON externe : chaque erreur indique
 * le chemin du champ fautif (ex. `$.cards[3].abilities[0].cooldown`).
 */
export class JsonReader {
  constructor(
    readonly value: unknown,
    readonly path = '$',
  ) {}

  get(key: string): JsonReader {
    return new JsonReader(this.object()[key], `${this.path}.${key}`);
  }

  /** `undefined` si le champ est absent ou nul. */
  optional(key: string): JsonReader | undefined {
    const value = this.object()[key];
    return value === undefined || value === null ? undefined : new JsonReader(value, `${this.path}.${key}`);
  }

  object(key?: string): Readonly<Record<string, unknown>> {
    const { value } = this.at(key);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw this.at(key).error('un objet');
    }
    return value as Readonly<Record<string, unknown>>;
  }

  string(key?: string): string {
    const { value } = this.at(key);
    if (typeof value !== 'string') {
      throw this.at(key).error('une chaîne');
    }
    return value;
  }

  nullableString(key: string): string | null {
    return this.optional(key)?.string() ?? null;
  }

  number(key?: string): number {
    const { value } = this.at(key);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.at(key).error('un nombre');
    }
    return value;
  }

  boolean(key: string, fallback: boolean): boolean {
    const field = this.optional(key);
    if (field === undefined) {
      return fallback;
    }
    if (typeof field.value !== 'boolean') {
      throw field.error('un booléen');
    }
    return field.value;
  }

  array(key?: string): JsonReader[] {
    const reader = this.at(key);
    if (!Array.isArray(reader.value)) {
      throw reader.error('un tableau');
    }
    return reader.value.map((item, index) => new JsonReader(item, `${reader.path}[${index}]`));
  }

  entries(key?: string): [string, JsonReader][] {
    const reader = this.at(key);
    return Object.entries(reader.object()).map(([name, value]) => [name, new JsonReader(value, `${reader.path}.${name}`)]);
  }

  private at(key: string | undefined): JsonReader {
    return key === undefined ? this : this.get(key);
  }

  private error(expected: string): InvalidSourceDataError {
    return new InvalidSourceDataError(`${this.path} : ${expected} attendu`);
  }
}
