// Only side-effect-free preparation belongs here: never advance a scene or a save.
export function createPrefetchQueue({ concurrency = 2, capacity = 24 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError("Invalid prefetch limits");
  }
  const entries = new Map(), pending = [];
  let active = 0;
  function trim() {
    for (const [key, entry] of entries) {
      if (entries.size <= capacity) break;
      if (entry.done) entries.delete(key);
    }
  }
  function pump() {
    while (active < concurrency && pending.length) {
      const entry = pending.shift();
      active++;
      Promise.resolve().then(entry.prepare).then(value => {
        entry.done = true;
        entry.resolve(value);
      }, error => {
        entries.delete(entry.key); // Failed requests may be retried.
        entry.reject(error);
      }).finally(() => { active--; trim(); pump(); });
    }
  }
  return {
    prepare(key, prepare) {
      const existing = entries.get(key);
      if (existing) {
        entries.delete(key); entries.set(key, existing);
        return existing.promise;
      }
      // Bound pending work as well as retained results. Callers can retry later.
      trim();
      if (entries.size >= capacity) {
        const old = [...entries].find(([, entry]) => entry.done);
        if (old) entries.delete(old[0]);
        else return Promise.reject(new Error("Prefetch queue is full"));
      }
      const entry = { key, prepare, done: false };
      entry.promise = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
      entries.set(key, entry); pending.push(entry); pump();
      return entry.promise;
    },
    // Background callers must observe failure; foreground gates still receive it.
    warm(key, prepare) { return this.prepare(key, prepare).then(() => true, () => false); },
  };
}

/** Resolves with a decoded Image. Retaining it in the bounded queue avoids a second decode. */
export function prepareImage(src, { timeoutMs = 8000, signal } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timer;
    const finish = (error) => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(img);
    };
    const abort = () => finish(signal.reason || new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => finish(new Error(`Image preparation timed out: ${src}`)), timeoutMs);
    img.onerror = () => finish(new Error(`Image preparation failed: ${src}`));
    img.onload = () => Promise.resolve().then(() => img.decode?.()).then(() => finish(), finish);
    img.src = src;
  });
}

export const loadingPrefetch = createPrefetchQueue();
