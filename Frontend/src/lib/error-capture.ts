let lastCapturedError: unknown = null;

export function captureError(error: unknown): void {
  lastCapturedError = error;
}

export function consumeLastCapturedError(): unknown {
  const err = lastCapturedError;
  lastCapturedError = null;
  return err;
}

if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("unhandledRejection", (reason) => {
    captureError(reason);
  });
  process.on("uncaughtException", (error) => {
    captureError(error);
  });
}
