import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import FormData from "form-data";
import fs from "fs";
import { META_API_BASE_URL, REQUEST_TIMEOUT_MS } from "./constants.js";
import type { MetaApiErrorResponse, PaginatedResponse } from "./types.js";

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "META_ACCESS_TOKEN environment variable is required. " +
      "Get your token from https://developers.facebook.com/tools/explorer/ " +
      "or Meta Business Manager > System Users."
    );
  }
  return token;
}

export function handleMetaError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response?.data) {
      const data = error.response.data as MetaApiErrorResponse;
      if (data.error) {
        const { code, message, type, error_subcode, error_user_msg, error_user_title } = data.error;
        const detail = [error_subcode ? `subcode=${error_subcode}` : null, error_user_title || null, error_user_msg || null].filter(Boolean).join(" | ");
        if (code === 190) return "Error: Access token expired or invalid. Please refresh your META_ACCESS_TOKEN.";
        if (code === 100) return `Error: Invalid parameter — ${message}${detail ? ` (${detail})` : ""}`;
        if (code === 200 || code === 273) return `Error: Permission denied — ${message}. Check your token has 'ads_management' and 'ads_read' permissions.`;
        if (code === 4 || code === 17 || code === 32) return `Error: Rate limit reached (${type}). Wait before retrying.`;
        if (code === 803) return `Error: Object not found. Check the ID is correct.`;
        return `Error [${code}]: ${message}${detail ? ` (${detail})` : ""}`;
      }
    }
    if (error.response?.status === 429) return "Error: Rate limit exceeded. Wait before making more requests.";
    if (error.code === "ECONNABORTED") return "Error: Request timed out. Try again.";
    if (error.code === "ENOTFOUND") return "Error: Network error. Check your internet connection.";
  }
  if (error instanceof Error) return `Error: ${error.message}`;
  return `Error: Unexpected error occurred`;
}

export async function metaGet<T>(
  path: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const token = getAccessToken();
  const config: AxiosRequestConfig = {
    method: "GET",
    url: `${META_API_BASE_URL}/${path}`,
    params: { access_token: token, ...params },
    timeout: REQUEST_TIMEOUT_MS,
  };
  const response = await axios(config);
  return response.data as T;
}

export async function metaPost<T>(
  path: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const token = getAccessToken();
  // Meta Graph API requiere form-urlencoded, no JSON body
  // Arrays/objetos se serializan como JSON strings dentro del form data
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formData.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  }
  const config: AxiosRequestConfig = {
    method: "POST",
    url: `${META_API_BASE_URL}/${path}`,
    params: { access_token: token },
    data: formData,
    timeout: REQUEST_TIMEOUT_MS,
  };
  const response = await axios(config);
  return response.data as T;
}

export async function metaPostForm<T>(
  path: string,
  form: FormData
): Promise<T> {
  const token = getAccessToken();
  const config: AxiosRequestConfig = {
    method: "POST",
    url: `${META_API_BASE_URL}/${path}`,
    params: { access_token: token },
    data: form,
    headers: form.getHeaders(),
    timeout: 120000,
  };
  const response = await axios(config);
  return response.data as T;
}

export async function metaDelete<T>(path: string): Promise<T> {
  const token = getAccessToken();
  const config: AxiosRequestConfig = {
    method: "DELETE",
    url: `${META_API_BASE_URL}/${path}`,
    params: { access_token: token },
    timeout: REQUEST_TIMEOUT_MS,
  };
  const response = await axios(config);
  return response.data as T;
}

export async function uploadImageFromPath(
  adAccountId: string,
  imagePath: string
): Promise<{ hash: string; url: string }> {
  const form = new FormData();
  form.append("filename", fs.createReadStream(imagePath));
  const result = await metaPostForm<{ images: Record<string, { hash: string; url: string }> }>(
    `act_${adAccountId}/adimages`,
    form
  );
  const images = result.images;
  const key = Object.keys(images)[0];
  return images[key];
}

export async function uploadImageFromUrl(
  adAccountId: string,
  imageUrl: string
): Promise<{ hash: string; url: string }> {
  const result = await metaPost<{ images: Record<string, { hash: string; url: string }> }>(
    `act_${adAccountId}/adimages`,
    { filename: imageUrl, bytes: "" }
  );
  const images = result.images;
  const key = Object.keys(images)[0];
  return images[key];
}

export function truncateIfNeeded(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  return truncated + `\n\n[Response truncated at ${limit} characters. Use filters or pagination to narrow results.]`;
}

export function formatPagination<T>(
  result: PaginatedResponse<T>,
  offset: number,
  limit: number
): { items: T[]; has_more: boolean; next_cursor?: string; count: number } {
  const items = result.data ?? [];
  const next_cursor = result.paging?.cursors?.after;
  const has_more = !!result.paging?.next;
  return { items, has_more, next_cursor, count: items.length };
}
