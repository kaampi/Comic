type Pending<T, R> = {
  value: T;
  quietTimer?: ReturnType<typeof setTimeout>;
  deadline: ReturnType<typeof setTimeout>;
  promise: Promise<R>;
  resolve: (result: R | PromiseLike<R>) => void;
  reject: (error: unknown) => void;
};

export function createAutosave<T, R>(save: (value: T) => Promise<R>) {
  let pending: Pending<T, R> | undefined;

  function flush(value?: T): Promise<R> | undefined {
    const batch = pending;
    pending = undefined;
    if (!batch) return value === undefined ? undefined : save(value);
    clearTimeout(batch.quietTimer);
    clearTimeout(batch.deadline);
    void Promise.resolve().then(() => save(value ?? batch.value)).then(batch.resolve, batch.reject);
    return batch.promise;
  }

  function schedule(value: T): Promise<R> {
    if (!pending) {
      let resolve!: Pending<T, R>["resolve"];
      let reject!: Pending<T, R>["reject"];
      const promise = new Promise<R>((done, fail) => { resolve = done; reject = fail; });
      pending = { value, promise, resolve, reject, deadline: setTimeout(flush, 1000) };
    }
    pending.value = value;
    clearTimeout(pending.quietTimer);
    pending.quietTimer = setTimeout(flush, 200);
    return pending.promise;
  }

  return { schedule, flush };
}
