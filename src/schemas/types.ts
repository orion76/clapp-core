/**
 * Violation of a data schema: what a validator reports for data that does not conform.
 *
 * The fields are the ones a JSON Schema validator reports. Both are optional, because a
 * validator may reject the document as a whole without a pointer or a message.
 */
export interface ISchemaViolation {
  /** JSON Pointer of the offending value inside the document; empty for the document itself. */
  instancePath?: string;
  /** Human readable reason of the violation. */
  message?: string;
}

/**
 * Compiled validator of one data schema: it reports the violations of a document, or `null`
 * when the document conforms to the schema.
 */
export type TSchemaValidator = (document: unknown) => readonly ISchemaViolation[] | null;

/**
 * Data schema of the application, registered by its `$id`.
 *
 * The file of a schema lives in a `schemas/` directory of a configured source; the entry keeps
 * its absolute path so a start-up error can name the file the broken schema came from.
 */
export interface ISchemaEntry {
  /** `$id` of the schema file — the identifier a command declares in `dataSchema`. */
  id: string;
  /** Absolute path of the schema file the entry was loaded from. */
  path: string;
  /** Compiled validator of the schema. */
  validate: TSchemaValidator;
}

/**
 * Data schemas of the application by their `$id`.
 *
 * The registry is built once during bootstrap and shared by the engines, so a host validates
 * command data against the same compiled schema wherever the data is produced.
 */
export interface ISchemaRegistry {
  /**
   * Finds a registered schema.
   * @param id `$id` of the schema
   * @returns Schema entry, or `undefined` when the application has no schema with this id
   */
  get(id: string): ISchemaEntry | undefined;
}
