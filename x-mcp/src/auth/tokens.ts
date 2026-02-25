import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { TokenData } from '../types/x.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.resolve(__dirname, '../../.tokens.json');

export function saveTokens(data: Omit<TokenData, 'obtained_at'>): TokenData {
  const tokens: TokenData = { ...data, obtained_at: Date.now() };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  return tokens;
}

export function loadTokens(): TokenData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

export function isTokenExpired(tokens: TokenData): boolean {
  // Consider expired 5 minutes before actual expiry
  const expiresAt = tokens.obtained_at + (tokens.expires_in - 300) * 1000;
  return Date.now() > expiresAt;
}

export function clearTokens(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}
