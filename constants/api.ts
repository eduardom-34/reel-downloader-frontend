/**
 * Backend API configuration.
 * Change API_BASE_URL to match your server's IP and port.
 *
 * - Telefono fisico: usa la IP de tu computadora en la red (ej. 192.168.1.10)
 * - Emulador Android: usa 10.0.2.2
 * - Simulador iOS: usa 127.0.0.1
 *
 * @format
 */

export const API_BASE_URL = "http://192.168.1.10:8000";

const HEALTH_TIMEOUT_MS = 5_000;
const INFO_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export type ReelInfo = {
  title: string;
  thumbnail: string;
  duration: number;
  video_url: string;
  uploader: string;
};

export type ApiErrorResponse = {
  detail: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.name = "ApiError";
  }
}

function getErrorMessage(status: number, fallback: string): string {
  switch (status) {
    case 422:
      return "URL no valida. Asegurate de que sea un enlace de Instagram Reel.";
    case 403:
      return "Este Reel es privado o requiere inicio de sesion.";
    case 404:
      return "Reel no encontrado. Verifica el enlace e intenta de nuevo.";
    case 500:
      return "Error en el servidor. Intenta de nuevo mas tarde.";
    default:
      return fallback;
  }
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const base = API_BASE_URL.replace(/\/+$/, "");
    const response = await fetchWithTimeout(
      `${base}/`,
      { method: "GET" },
      HEALTH_TIMEOUT_MS,
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function fetchReelInfo(url: string): Promise<ReelInfo> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/info`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      },
      INFO_TIMEOUT_MS,
    );
  } catch {
    throw new ApiError(
      0,
      "No se pudo conectar al servidor. Verifica que este encendido y en la misma red.",
    );
  }

  if (!response.ok) {
    let detail = "Error desconocido.";
    try {
      const errorData: ApiErrorResponse = await response.json();
      detail = errorData.detail;
    } catch {
      // response was not JSON
    }
    throw new ApiError(
      response.status,
      getErrorMessage(response.status, detail),
    );
  }

  return response.json();
}

export async function downloadReelBinary(
  url: string,
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/download`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      },
      DOWNLOAD_TIMEOUT_MS,
    );
  } catch {
    throw new ApiError(
      0,
      "No se pudo conectar al servidor. Verifica que este encendido y en la misma red.",
    );
  }

  if (!response.ok) {
    let detail = "Error desconocido.";
    try {
      const errorData: ApiErrorResponse = await response.json();
      detail = errorData.detail;
    } catch {
      // response was not JSON
    }
    throw new ApiError(
      response.status,
      getErrorMessage(response.status, detail),
    );
  }

  const disposition = response.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
  const filename = filenameMatch?.[1] || `reel_${Date.now()}.mp4`;

  const blob = await response.blob();
  return { blob, filename };
}
