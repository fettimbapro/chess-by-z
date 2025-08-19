export function logError(err, context) {
  console.error(`[${context}]`, err);
}

if (typeof window !== "undefined") {
  window.logError = logError;
}
