import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { handleApiError, UPLOAD_BASE } from '../client.js';
import { loadTokens, isTokenExpired } from '../auth/tokens.js';
import type { XMediaUploadResponse } from '../types/x.js';

const CHUNK_SIZE = 4_194_304; // 4 MB

async function getUploadToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new Error('Not authenticated. Run `npm run auth` to set up X OAuth 2.0.');
  if (isTokenExpired(tokens)) throw new Error('Access token expired. Run `npm run auth` to re-authenticate.');
  return tokens.access_token;
}

async function mediaUploadRequest<T>(
  method: 'GET' | 'POST',
  params?: Record<string, unknown>,
  formData?: FormData
): Promise<T> {
  const token = await getUploadToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(formData ? formData.getHeaders() : { 'Content-Type': 'application/x-www-form-urlencoded' }),
  };

  const res = await axios({
    method,
    url: `${UPLOAD_BASE}/media/upload.json`,
    params,
    data: formData ?? undefined,
    headers,
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return res.data as T;
}

async function pollMediaStatus(mediaId: string): Promise<'succeeded' | 'failed'> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const status = await mediaUploadRequest<XMediaUploadResponse>('GET', {
      command: 'STATUS',
      media_id: mediaId,
    });

    const processingInfo = status.processing_info;
    if (!processingInfo) return 'succeeded'; // No processing needed

    if (processingInfo.state === 'succeeded') return 'succeeded';
    if (processingInfo.state === 'failed') return 'failed';

    const waitMs = (processingInfo.check_after_secs ?? 3) * 1000;
    await new Promise(r => setTimeout(r, waitMs));
  }
  throw new Error('Media processing timed out after 90 seconds.');
}

export function registerMediaTools(server: McpServer) {

  // ── Upload Media ─────────────────────────────────────────────────────────────
  server.tool(
    'x_upload_media',
    'Upload a media file (image, GIF, or video) to X. Returns a media_id to attach to tweets with x_create_tweet. Supports chunked upload for large files. Max sizes: images 5MB, GIFs 15MB, videos 512MB.',
    {
      file_path: z.string().describe('Absolute path to the media file (JPEG, PNG, GIF, WEBP, MP4, MOV)'),
      media_type: z.string().describe('MIME type of the media. Examples: "image/jpeg", "image/png", "image/gif", "video/mp4"'),
      media_category: z.enum(['tweet_image', 'tweet_gif', 'tweet_video']).default('tweet_image').describe('Category: tweet_image for photos, tweet_gif for GIFs, tweet_video for videos'),
      alt_text: z.string().max(1000).optional().describe('Accessibility alt text for images (recommended, max 1000 chars)'),
    },
    async ({ file_path, media_type, media_category, alt_text }) => {
      try {
        if (!fs.existsSync(file_path)) {
          return { content: [{ type: 'text', text: `Error: File not found: ${file_path}` }], isError: true };
        }

        const fileBuffer = fs.readFileSync(file_path);
        const fileSizeBytes = fileBuffer.length;

        // Validate size limits
        if (media_category === 'tweet_image' && fileSizeBytes > 5_242_880) {
          return { content: [{ type: 'text', text: 'Error: Image exceeds 5MB limit.' }], isError: true };
        }
        if (media_category === 'tweet_gif' && fileSizeBytes > 15_728_640) {
          return { content: [{ type: 'text', text: 'Error: GIF exceeds 15MB limit.' }], isError: true };
        }
        if (media_category === 'tweet_video' && fileSizeBytes > 536_870_912) {
          return { content: [{ type: 'text', text: 'Error: Video exceeds 512MB limit.' }], isError: true };
        }

        // INIT
        const initForm = new FormData();
        initForm.append('command', 'INIT');
        initForm.append('media_type', media_type);
        initForm.append('total_bytes', String(fileSizeBytes));
        initForm.append('media_category', media_category);

        const initData = await mediaUploadRequest<XMediaUploadResponse>('POST', undefined, initForm);
        const mediaId = initData.media_id_string;

        // APPEND (chunked)
        let segmentIndex = 0;
        let offset = 0;

        while (offset < fileSizeBytes) {
          const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
          const appendForm = new FormData();
          appendForm.append('command', 'APPEND');
          appendForm.append('media_id', mediaId);
          appendForm.append('segment_index', String(segmentIndex));
          appendForm.append('media', chunk, { filename: 'chunk', contentType: 'application/octet-stream' });

          await mediaUploadRequest<void>('POST', undefined, appendForm);

          offset += chunk.length;
          segmentIndex++;
        }

        // FINALIZE
        const finalizeForm = new FormData();
        finalizeForm.append('command', 'FINALIZE');
        finalizeForm.append('media_id', mediaId);

        const finalizeData = await mediaUploadRequest<XMediaUploadResponse>('POST', undefined, finalizeForm);

        // Poll for async processing (videos/GIFs)
        if (finalizeData.processing_info) {
          const result = await pollMediaStatus(mediaId);
          if (result === 'failed') {
            return { content: [{ type: 'text', text: `Error: Media processing failed for media_id ${mediaId}.` }], isError: true };
          }
        }

        // Add alt text if provided and supported (images)
        if (alt_text && media_category === 'tweet_image') {
          try {
            const token = await getUploadToken();
            await axios.post(
              `${UPLOAD_BASE}/media/metadata/create.json`,
              {
                media_id: mediaId,
                alt_text: { text: alt_text },
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );
          } catch {
            // Alt text failure is non-fatal
          }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Media uploaded successfully!\nmedia_id: ${mediaId}\nSize: ${(fileSizeBytes / 1024).toFixed(1)} KB\nCategory: ${media_category}\n\nUse this media_id with x_create_tweet in the media_ids parameter.`,
          }],
        };
      } catch (err) {
        return { content: [{ type: 'text', text: handleApiError(err) }], isError: true };
      }
    }
  );
}
