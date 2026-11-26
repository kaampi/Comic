type Invoke = (command: string, args: Record<string, unknown>) => Promise<string>;

export function desktopLocalAi() {
  const scope = globalThis as typeof globalThis & { __TAURI__?: { core?: { invoke?: Invoke } } };
  const invoke = scope.__TAURI__?.core?.invoke;
  if (!invoke) return undefined;

  return async (endpoint: string, init: RequestInit) => {
    const signal = init.signal;
    signal?.throwIfAborted();
    let abort: (() => void) | undefined;
    const request = invoke("local_ai_json", { endpoint, method: init.method, body: init.body ?? null });
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => reject(signal?.reason ?? new DOMException("Cancelled", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
    });
    try {
      const response = await Promise.race([request, cancelled]);
      return JSON.parse(response);
    } catch (error) {
      throw typeof error === "string" ? new Error(error) : error;
    } finally {
      if (abort) signal?.removeEventListener("abort", abort);
    }
  };
}
