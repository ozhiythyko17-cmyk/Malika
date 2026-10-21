import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const listeners = new Set<() => void>();

/** Muat ulang semua data yang sedang tampil (dipanggil setelah menyimpan perubahan). */
export function invalidate() {
  listeners.forEach((l) => l());
}

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Tidak ada koneksi internet. Coba lagi.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized();
    throw new ApiError(res.status, data.error || "Terjadi kesalahan. Coba lagi.");
  }
  return data as T;
}

/** Simpan perubahan, lalu segarkan semua data di layar. */
export async function mutate<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const result = await api<T>(method, path, body);
  invalidate();
  return result;
}

/** Ambil data GET dan otomatis muat ulang setelah ada perubahan. `path` null = jangan ambil. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!path) return;
    let alive = true;
    api<T>("GET", path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: ApiError) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path]);

  useEffect(() => {
    const cancel = load();
    const listener = () => load();
    listeners.add(listener);
    return () => {
      cancel?.();
      listeners.delete(listener);
    };
  }, [load]);

  return { data, error, reload: load };
}
