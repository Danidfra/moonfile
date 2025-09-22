import * as Sentry from "@sentry/browser";

export function handleError(error: unknown, errorInfo?: Record<string, unknown>) {
  console.error(error);
  Sentry.captureException(error, { extra: errorInfo });
}

export function loadBinary(
  path: string,
  callback: (err: Error | null, data?: string) => void,
  handleProgress?: (this: XMLHttpRequest, ev: ProgressEvent<EventTarget>) => void
): XMLHttpRequest {
  const req = new XMLHttpRequest();
  req.open("GET", path);
  req.overrideMimeType("text/plain; charset=x-user-defined");

  req.onload = function () {
    if (this.status === 200) {
      if (req.responseText.match(/^<!doctype html>/i)) {
        return callback(new Error("Page not found"));
      }
      callback(null, this.responseText);
    } else if (this.status === 0) {
      // Aborted, so ignore error
    } else {
      callback(new Error(req.statusText));
    }
  };

  req.onerror = function () {
    callback(new Error(req.statusText));
  };

  req.onprogress = handleProgress ?? null;
  req.send();

  return req;
}