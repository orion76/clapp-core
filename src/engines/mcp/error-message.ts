/**
 * Describes a thrown value as the text of a reason.
 *
 * The surfaces and the engine report failures of a command, of the SDK and of the plugin
 * manager, and not every one of them arrives as an `Error` — the SDK throws plain values on
 * some paths, and a rejected promise may carry anything. Every report needs a string with the
 * reason, so the value is turned into one here instead of leaking a raw object into a message
 * of the client.
 * @param error Thrown value
 * @returns Text of the reason
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
