import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from 'dotenv';
import { loadTokens, isTokenExpired } from './auth/tokens.js';

config();

const API_VERSION = process.env.LINKEDIN_API_VERSION || '202601';

function getAccessToken(): string {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error('Not authenticated. Run `npm run auth` to set up LinkedIn OAuth.');
  }
  if (isTokenExpired(tokens)) {
    throw new Error('Access token expired. Run `npm run auth` to re-authenticate.');
  }
  return tokens.access_token;
}

function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    'LinkedIn-Version': API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
    ...extra,
  };
}

const REST_BASE = 'https://api.linkedin.com/rest';
const V2_BASE = 'https://api.linkedin.com/v2';

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getMyProfile() {
  const res = await axios.get(`${V2_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });
  return res.data;
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(body: object): Promise<string> {
  const res = await axios.post(`${REST_BASE}/posts`, body, {
    headers: baseHeaders(),
  });
  // The post URN is in the response header
  return (res.headers['x-restli-id'] as string) || '';
}

export async function getPost(postUrn: string) {
  const encoded = encodeURIComponent(postUrn);
  const res = await axios.get(`${REST_BASE}/posts/${encoded}`, {
    headers: baseHeaders(),
  });
  return res.data;
}

export async function getPostsByAuthor(
  authorUrn: string,
  count = 10,
  start = 0,
  sortBy: 'LAST_MODIFIED' | 'CREATED' = 'LAST_MODIFIED'
) {
  const encoded = encodeURIComponent(authorUrn);
  const res = await axios.get(`${REST_BASE}/posts`, {
    params: { author: encoded, q: 'author', count, start, sortBy },
    headers: baseHeaders({ 'X-RestLi-Method': 'FINDER' }),
  });
  return res.data;
}

export async function deletePost(postUrn: string): Promise<void> {
  const encoded = encodeURIComponent(postUrn);
  await axios.delete(`${REST_BASE}/posts/${encoded}`, {
    headers: baseHeaders({ 'X-RestLi-Method': 'DELETE' }),
  });
}

// ─── Images ───────────────────────────────────────────────────────────────────

export async function initializeImageUpload(ownerUrn: string): Promise<{
  uploadUrl: string;
  imageUrn: string;
  expiresAt: number;
}> {
  const res = await axios.post(
    `${REST_BASE}/images?action=initializeUpload`,
    { initializeUploadRequest: { owner: ownerUrn } },
    { headers: baseHeaders() }
  );
  const { value } = res.data;
  return {
    uploadUrl: value.uploadUrl,
    imageUrn: value.image,
    expiresAt: value.uploadUrlExpiresAt,
  };
}

export async function uploadImageBinary(uploadUrl: string, imageBuffer: Buffer): Promise<void> {
  await axios.put(uploadUrl, imageBuffer, {
    headers: { 'Content-Type': 'application/octet-stream' },
    maxBodyLength: Infinity,
  });
}

export async function getImage(imageUrn: string) {
  const encoded = encodeURIComponent(imageUrn);
  const res = await axios.get(`${REST_BASE}/images/${encoded}`, {
    headers: baseHeaders(),
  });
  return res.data;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 4_194_304; // 4 MB exactly

export async function initializeVideoUpload(
  ownerUrn: string,
  fileSizeBytes: number,
  options: { uploadCaptions?: boolean; uploadThumbnail?: boolean } = {}
): Promise<{
  videoUrn: string;
  uploadToken: string;
  uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }>;
  thumbnailUploadUrl?: string;
  captionsUploadUrl?: string;
}> {
  const res = await axios.post(
    `${REST_BASE}/videos?action=initializeUpload`,
    {
      initializeUploadRequest: {
        owner: ownerUrn,
        fileSizeBytes,
        uploadCaptions: options.uploadCaptions ?? false,
        uploadThumbnail: options.uploadThumbnail ?? false,
      },
    },
    { headers: baseHeaders() }
  );
  const { value } = res.data;
  return {
    videoUrn: value.video,
    uploadToken: value.uploadToken || '',
    uploadInstructions: value.uploadInstructions,
    thumbnailUploadUrl: value.thumbnailUploadUrl,
    captionsUploadUrl: value.captionsUploadUrl,
  };
}

export async function uploadVideoParts(
  uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }>,
  videoBuffer: Buffer
): Promise<string[]> {
  const etags: string[] = [];
  for (const instruction of uploadInstructions) {
    const chunk = videoBuffer.slice(instruction.firstByte, instruction.lastByte + 1);
    const res = await axios.put(instruction.uploadUrl, chunk, {
      headers: { 'Content-Type': 'application/octet-stream' },
      maxBodyLength: Infinity,
    });
    const etag = (res.headers['etag'] as string || '').replace(/"/g, '');
    etags.push(etag);
  }
  return etags;
}

export async function finalizeVideoUpload(
  videoUrn: string,
  uploadToken: string,
  uploadedPartIds: string[]
): Promise<void> {
  await axios.post(
    `${REST_BASE}/videos?action=finalizeUpload`,
    { finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds } },
    { headers: baseHeaders() }
  );
}

export async function getVideo(videoUrn: string) {
  const encoded = encodeURIComponent(videoUrn);
  const res = await axios.get(`${REST_BASE}/videos/${encoded}`, {
    headers: baseHeaders(),
  });
  return res.data;
}

export async function pollVideoStatus(
  videoUrn: string,
  maxWaitMs = 120_000
): Promise<'AVAILABLE' | 'PROCESSING_FAILED'> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const video = await getVideo(videoUrn);
    if (video.status === 'AVAILABLE') return 'AVAILABLE';
    if (video.status === 'PROCESSING_FAILED') return 'PROCESSING_FAILED';
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Video processing timed out after 2 minutes');
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(postUrn: string) {
  const encoded = encodeURIComponent(postUrn);
  const res = await axios.get(`${REST_BASE}/socialActions/${encoded}/comments`, {
    headers: baseHeaders(),
  });
  return res.data;
}

export async function createComment(
  postUrn: string,
  actorUrn: string,
  text: string,
  parentCommentUrn?: string
): Promise<string> {
  const encoded = encodeURIComponent(postUrn);
  const body: Record<string, unknown> = {
    actor: actorUrn,
    object: postUrn,
    message: { text },
  };
  if (parentCommentUrn) body.parentComment = parentCommentUrn;

  const res = await axios.post(`${REST_BASE}/socialActions/${encoded}/comments`, body, {
    headers: baseHeaders(),
  });
  return res.headers['x-restli-id'] as string || '';
}

export async function deleteComment(
  postUrn: string,
  commentId: string,
  actorUrn?: string
): Promise<void> {
  const encodedPost = encodeURIComponent(postUrn);
  const params = actorUrn ? { actor: encodeURIComponent(actorUrn) } : {};
  await axios.delete(`${REST_BASE}/socialActions/${encodedPost}/comments/${commentId}`, {
    headers: baseHeaders(),
    params,
  });
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function getReactions(entityUrn: string) {
  const encoded = encodeURIComponent(entityUrn);
  const res = await axios.get(`${REST_BASE}/reactions/(entity:${encoded})`, {
    params: { q: 'entity', sort: '(value:REVERSE_CHRONOLOGICAL)' },
    headers: baseHeaders(),
  });
  return res.data;
}

export async function createReaction(
  actorUrn: string,
  rootUrn: string,
  reactionType: string
): Promise<void> {
  const encodedActor = encodeURIComponent(actorUrn);
  await axios.post(
    `${REST_BASE}/reactions?actor=${encodedActor}`,
    { root: rootUrn, reactionType },
    { headers: baseHeaders() }
  );
}

export async function deleteReaction(actorUrn: string, entityUrn: string): Promise<void> {
  const encodedActor = encodeURIComponent(actorUrn);
  const encodedEntity = encodeURIComponent(entityUrn);
  await axios.delete(
    `${REST_BASE}/reactions/(actor:${encodedActor},entity:${encodedEntity})`,
    { headers: baseHeaders() }
  );
}
