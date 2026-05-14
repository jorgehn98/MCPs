import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs';
import {
  createPost,
  getPost,
  getPostsByAuthor,
  deletePost,
  getMyProfile,
  initializeImageUpload,
  uploadImageBinary,
  initializeVideoUpload,
  uploadVideoParts,
  finalizeVideoUpload,
  pollVideoStatus,
} from '../client.js';
import type { Visibility } from '../types/linkedin.js';

function defaultDistribution() {
  return {
    feedDistribution: 'MAIN_FEED' as const,
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  };
}

export function registerPostTools(server: McpServer) {

  // ── Create Text Post ────────────────────────────────────────────────────────
  server.tool(
    'linkedin_create_text_post',
    'Create a LinkedIn text post on behalf of the authenticated member. Returns the post URN.',
    {
      text: z.string().min(1).max(3000).describe('Post text content (max 3000 chars). Supports #hashtags and @[Name](urn:li:organization:ID) mentions.'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).default('PUBLIC').describe('Who can see the post'),
      authorUrn: z.string().optional().describe('Override author URN (e.g. urn:li:organization:123). Defaults to your own person URN.'),
    },
    async ({ text, visibility, authorUrn }) => {
      try {
        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }
        const postUrn = await createPost({
          author,
          commentary: text,
          visibility: visibility as Visibility,
          distribution: defaultDistribution(),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        });
        return {
          content: [{ type: 'text', text: `✅ Post created!\nURN: ${postUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Create Image Post ───────────────────────────────────────────────────────
  server.tool(
    'linkedin_create_image_post',
    'Create a LinkedIn post with an image. Provide the local file path to the image (JPG, PNG or GIF). The image is uploaded to LinkedIn first, then the post is created.',
    {
      text: z.string().min(1).max(3000).describe('Post caption / commentary'),
      imagePath: z.string().describe('Absolute path to the local image file (JPG, PNG, GIF)'),
      altText: z.string().optional().describe('Accessibility alt text for the image'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).default('PUBLIC'),
      authorUrn: z.string().optional().describe('Override author URN. Defaults to your person URN.'),
    },
    async ({ text, imagePath, altText, visibility, authorUrn }) => {
      try {
        if (!fs.existsSync(imagePath)) {
          return { content: [{ type: 'text', text: `❌ File not found: ${imagePath}` }], isError: true };
        }

        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }

        // Step 1: Initialize upload
        const { uploadUrl, imageUrn } = await initializeImageUpload(author);

        // Step 2: Upload binary
        const imageBuffer = fs.readFileSync(imagePath);
        await uploadImageBinary(uploadUrl, imageBuffer);

        // Step 3: Create post with image URN
        const postUrn = await createPost({
          author,
          commentary: text,
          visibility: visibility as Visibility,
          distribution: defaultDistribution(),
          content: {
            media: {
              id: imageUrn,
              ...(altText ? { altText } : {}),
            },
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Image post created!\nPost URN: ${postUrn}\nImage URN: ${imageUrn}`,
          }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Create Video Post ───────────────────────────────────────────────────────
  server.tool(
    'linkedin_create_video_post',
    'Create a LinkedIn post with a video. Provide the absolute local path to an MP4 file (max 500 MB, 3s–30min). The video is chunked, uploaded, finalized, then posted.',
    {
      text: z.string().min(1).max(3000).describe('Post caption / commentary'),
      videoPath: z.string().describe('Absolute path to the local MP4 video file'),
      title: z.string().optional().describe('Title for the video'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).default('PUBLIC'),
      authorUrn: z.string().optional().describe('Override author URN. Defaults to your person URN.'),
    },
    async ({ text, videoPath, title, visibility, authorUrn }) => {
      try {
        if (!fs.existsSync(videoPath)) {
          return { content: [{ type: 'text', text: `❌ File not found: ${videoPath}` }], isError: true };
        }

        const videoBuffer = fs.readFileSync(videoPath);
        const fileSizeBytes = videoBuffer.length;

        if (fileSizeBytes < 75_000) {
          return { content: [{ type: 'text', text: '❌ Video is too small (minimum 75 KB)' }], isError: true };
        }
        if (fileSizeBytes > 500_000_000) {
          return { content: [{ type: 'text', text: '❌ Video is too large (maximum 500 MB)' }], isError: true };
        }

        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }

        // Step 1: Initialize upload
        const { videoUrn, uploadToken, uploadInstructions } = await initializeVideoUpload(
          author,
          fileSizeBytes
        );

        // Step 2: Upload chunks
        const etags = await uploadVideoParts(uploadInstructions, videoBuffer);

        // Step 3: Finalize
        await finalizeVideoUpload(videoUrn, uploadToken, etags);

        // Step 4: Poll until AVAILABLE
        const status = await pollVideoStatus(videoUrn);
        if (status === 'PROCESSING_FAILED') {
          return { content: [{ type: 'text', text: `❌ Video processing failed for URN: ${videoUrn}` }], isError: true };
        }

        // Step 5: Create post
        const postUrn = await createPost({
          author,
          commentary: text,
          visibility: visibility as Visibility,
          distribution: defaultDistribution(),
          content: {
            media: {
              id: videoUrn,
              ...(title ? { title } : {}),
            },
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        });

        return {
          content: [{
            type: 'text',
            text: `✅ Video post created!\nPost URN: ${postUrn}\nVideo URN: ${videoUrn}`,
          }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Create Article Post ─────────────────────────────────────────────────────
  server.tool(
    'linkedin_create_article_post',
    'Share an external article/URL on LinkedIn with a title, description, and optional thumbnail image.',
    {
      text: z.string().max(3000).default('').describe('Commentary about the article'),
      url: z.string().url().describe('The article URL to share'),
      title: z.string().min(1).max(200).describe('Article title'),
      description: z.string().max(500).optional().describe('Short article description'),
      thumbnailPath: z.string().optional().describe('Optional: absolute path to a thumbnail image file'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).default('PUBLIC'),
      authorUrn: z.string().optional().describe('Override author URN. Defaults to your person URN.'),
    },
    async ({ text, url, title, description, thumbnailPath, visibility, authorUrn }) => {
      try {
        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }

        let thumbnailUrn: string | undefined;
        if (thumbnailPath) {
          if (!fs.existsSync(thumbnailPath)) {
            return { content: [{ type: 'text', text: `❌ Thumbnail file not found: ${thumbnailPath}` }], isError: true };
          }
          const { uploadUrl, imageUrn } = await initializeImageUpload(author);
          const buf = fs.readFileSync(thumbnailPath);
          await uploadImageBinary(uploadUrl, buf);
          thumbnailUrn = imageUrn;
        }

        const article: Record<string, string> = { source: url, title };
        if (description) article.description = description;
        if (thumbnailUrn) article.thumbnail = thumbnailUrn;

        const postUrn = await createPost({
          author,
          commentary: text,
          visibility: visibility as Visibility,
          distribution: defaultDistribution(),
          content: { article },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        });

        return {
          content: [{ type: 'text', text: `✅ Article post created!\nPost URN: ${postUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Reshare Post ────────────────────────────────────────────────────────────
  server.tool(
    'linkedin_reshare_post',
    'Reshare an existing LinkedIn post (by URN) with optional commentary.',
    {
      parentPostUrn: z.string().describe('URN of the post to reshare (e.g. urn:li:share:123 or urn:li:ugcPost:123)'),
      text: z.string().max(3000).default('').describe('Optional commentary on the reshare'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).default('PUBLIC'),
      authorUrn: z.string().optional().describe('Override author URN. Defaults to your person URN.'),
    },
    async ({ parentPostUrn, text, visibility, authorUrn }) => {
      try {
        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }

        const postUrn = await createPost({
          author,
          commentary: text,
          visibility: visibility as Visibility,
          distribution: defaultDistribution(),
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
          reshareContext: { parent: parentPostUrn },
        });

        return {
          content: [{ type: 'text', text: `✅ Post reshared!\nNew post URN: ${postUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Get Post ────────────────────────────────────────────────────────────────
  server.tool(
    'linkedin_get_post',
    'Get the details of a specific LinkedIn post by its URN.',
    {
      postUrn: z.string().describe('Post URN (e.g. urn:li:share:123 or urn:li:ugcPost:123)'),
    },
    async ({ postUrn }) => {
      try {
        const post = await getPost(postUrn);
        return {
          content: [{ type: 'text', text: JSON.stringify(post, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Get My Posts ────────────────────────────────────────────────────────────
  server.tool(
    'linkedin_get_my_posts',
    'Get the most recent posts from the authenticated member or a specified organization.',
    {
      count: z.number().int().min(1).max(100).default(10).describe('Number of posts to fetch (max 100)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset'),
      sortBy: z.enum(['LAST_MODIFIED', 'CREATED']).default('LAST_MODIFIED'),
      authorUrn: z.string().optional().describe('Get posts for a specific author URN. Defaults to your own profile.'),
    },
    async ({ count, start, sortBy, authorUrn }) => {
      try {
        let author = authorUrn;
        if (!author) {
          const profile = await getMyProfile();
          author = `urn:li:person:${profile.id}`;
        }
        const result = await getPostsByAuthor(author, count, start, sortBy);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );

  // ── Delete Post ─────────────────────────────────────────────────────────────
  server.tool(
    'linkedin_delete_post',
    'Delete a LinkedIn post by its URN. This action is irreversible.',
    {
      postUrn: z.string().describe('URN of the post to delete (e.g. urn:li:share:123)'),
    },
    async ({ postUrn }) => {
      try {
        await deletePost(postUrn);
        return {
          content: [{ type: 'text', text: `✅ Post deleted: ${postUrn}` }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
