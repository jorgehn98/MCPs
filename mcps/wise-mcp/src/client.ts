import axios from 'axios';
import { config } from 'dotenv';

config();

const BASE_URL = 'https://api.wise.com';

function getToken(): string {
  const token = process.env.WISE_API_TOKEN;
  if (!token) {
    throw new Error('WISE_API_TOKEN is not set. Add it to your .env file.');
  }
  return token;
}

function baseHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

export async function wiseGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const res = await axios.get(`${BASE_URL}${path}`, {
      headers: baseHeaders(),
      params,
    });
    return res.data as T;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = (error.response?.data as Record<string, string>)?.message || error.message;
      if (status === 401) throw new Error('Invalid WISE_API_TOKEN. Check your credentials.');
      if (status === 403) throw new Error('Access denied. Your token may lack the required permissions.');
      if (status === 404) throw new Error(`Resource not found: ${path}`);
      if (status === 429) throw new Error('Rate limit reached. Try again in a few seconds.');
      throw new Error(`Wise API error ${status}: ${message}`);
    }
    throw error;
  }
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function getProfiles() {
  return wiseGet<unknown[]>('/v2/profiles');
}

// ─── Balances ────────────────────────────────────────────────────────────────

export async function getBalances(profileId: number) {
  return wiseGet<unknown[]>(`/v4/profiles/${profileId}/balances`, { types: 'STANDARD' });
}

// ─── Transactions / Activities ───────────────────────────────────────────────

export async function listActivities(
  profileId: number,
  params?: {
    intervalStart?: string;
    intervalEnd?: string;
    type?: string;
    size?: number;
  }
) {
  return wiseGet(`/v1/profiles/${profileId}/activities`, params as Record<string, unknown>);
}

// ─── Transfers ───────────────────────────────────────────────────────────────

export async function listTransfers(profileId: number, limit = 20) {
  return wiseGet('/v1/transfers', { profile: profileId, limit });
}

// ─── Exchange Rates ──────────────────────────────────────────────────────────

export async function getExchangeRates(source: string, target?: string) {
  return wiseGet<unknown[]>('/v1/rates', {
    source: source.toUpperCase(),
    ...(target ? { target: target.toUpperCase() } : {}),
  });
}
