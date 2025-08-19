export function logError(err, context = "") {
  console.error(err);
  const send = globalThis.logToWorker;
  if (typeof send !== "function") return;

  try {
    send(JSON.stringify({ error: err, context }));
  } catch (_e) {
    const safe = {
      error:
        err && typeof err === "object"
          ? { message: err.message, stack: err.stack, name: err.name }
          : String(err),
      context,
    };
    try {
      send(JSON.stringify(safe));
    } catch (_) {
      /* swallow */
    }
  }
}

if (typeof globalThis !== "undefined") {
  globalThis.logError = logError;
}

export default logError;
