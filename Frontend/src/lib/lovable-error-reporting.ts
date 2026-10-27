export function reportLovableError(error: unknown, context?: Record<string, unknown>): void {
  try {
    console.error("[JobNex Error Reporting]", error, context);
  } catch {
    // ignore
  }
}
