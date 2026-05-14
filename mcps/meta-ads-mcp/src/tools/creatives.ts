import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import FormData from "form-data";
import fs from "fs";
import axios from "axios";
import { metaGet, metaPost, metaPostForm, handleMetaError, truncateIfNeeded } from "../client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT } from "../constants.js";
import type { AdCreative, PaginatedResponse } from "../types.js";

const CREATIVE_FIELDS = "id,name,title,body,image_url,thumbnail_url,object_story_spec,asset_feed_spec,effective_instagram_story_id,effective_object_story_id,call_to_action_type,status";

export function registerCreativeTools(server: McpServer): void {
  server.registerTool(
    "meta_get_ad_creatives",
    {
      title: "Get Ad Creatives",
      description: `List or get ad creatives for an ad account or specific ad.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix (list mode)
  - ad_id: Get creative for a specific ad (optional — use instead of ad_account_id for single ad)
  - limit: Max results (default: 25)
  - after: Pagination cursor

Returns creative details: name, title, body, image_url, object_story_spec.`,
      inputSchema: {
        ad_account_id: z.string().optional().describe("Ad account ID without 'act_' prefix"),
        ad_id: z.string().optional().describe("Get creatives for a specific ad"),
        limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
        after: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ ad_account_id, ad_id, limit, after }) => {
      try {
        const params: Record<string, unknown> = { fields: CREATIVE_FIELDS, limit };
        if (after) params.after = after;

        let endpoint: string;
        if (ad_id) {
          endpoint = `${ad_id}/adcreatives`;
        } else if (ad_account_id) {
          endpoint = `act_${ad_account_id}/adcreatives`;
        } else {
          return { content: [{ type: "text", text: "Error: Provide either ad_account_id or ad_id" }] };
        }

        const result = await metaGet<PaginatedResponse<AdCreative>>(endpoint, params);
        const creatives = result.data ?? [];
        const output = {
          count: creatives.length,
          has_more: !!result.paging?.next,
          next_cursor: result.paging?.cursors?.after,
          creatives,
        };
        return {
          content: [{ type: "text", text: truncateIfNeeded(JSON.stringify(output, null, 2), CHARACTER_LIMIT) }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_get_ad_image",
    {
      title: "Get Ad Image",
      description: `Get the image URL of an ad or creative. Returns the image URL for preview.

Args:
  - creative_id: Ad creative ID
  - ad_id: Ad ID (alternative to creative_id)

Returns: { image_url, thumbnail_url, name }`,
      inputSchema: {
        creative_id: z.string().optional().describe("Ad creative ID"),
        ad_id: z.string().optional().describe("Ad ID (fetches its creative image)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ creative_id, ad_id }) => {
      try {
        let id = creative_id;
        if (!id && ad_id) {
          const ad = await metaGet<{ creative: { id: string } }>(ad_id, { fields: "creative{id}" });
          id = ad.creative?.id;
        }
        if (!id) return { content: [{ type: "text", text: "Error: Provide either creative_id or ad_id" }] };

        const result = await metaGet<AdCreative>(id, {
          fields: "id,name,image_url,thumbnail_url,object_story_spec",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_upload_ad_image",
    {
      title: "Upload Ad Image",
      description: `Upload an image to use in ad creatives. Supports local file path or URL.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - image_path: Absolute local path to image file (e.g., "C:/Users/jorge/image.jpg")
  - image_url: Public URL of image to import (alternative to image_path)

Returns: { hash: image_hash, url: preview_url }
Use the hash in meta_create_ad_creative as the image_hash parameter.

Supported formats: JPG, PNG, GIF. Max size: 30MB.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        image_path: z.string().optional().describe("Absolute local path to image file"),
        image_url: z.string().url().optional().describe("Public URL of image to import"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, image_path, image_url }) => {
      try {
        if (!image_path && !image_url) {
          return { content: [{ type: "text", text: "Error: Provide either image_path or image_url" }] };
        }

        const form = new FormData();
        if (image_path) {
          if (!fs.existsSync(image_path)) {
            return { content: [{ type: "text", text: `Error: File not found at path: ${image_path}` }] };
          }
          form.append("filename", fs.createReadStream(image_path));
        } else if (image_url) {
          const response = await axios.get(image_url, { responseType: "stream" });
          const filename = image_url.split("/").pop() ?? "image.jpg";
          form.append("filename", response.data, { filename });
        }

        const result = await metaPostForm<{ images: Record<string, { hash: string; url: string }> }>(
          `act_${ad_account_id}/adimages`,
          form
        );
        const images = result.images;
        const key = Object.keys(images)[0];
        const imageData = images[key];
        return {
          content: [{ type: "text", text: JSON.stringify(imageData, null, 2) }],
          structuredContent: imageData,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_upload_ad_video",
    {
      title: "Upload Ad Video",
      description: `Upload a video to use in ad creatives.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - video_path: Absolute local path to video file
  - title: Video title (optional)

Returns: { video_id, upload_session_id }
Use the video_id when creating video ad creatives.

Supported formats: MP4, MOV, AVI. Max size: 4GB. Recommended: H.264, square/vertical format.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        video_path: z.string().describe("Absolute local path to video file"),
        title: z.string().optional().describe("Video title"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, video_path, title }) => {
      try {
        if (!fs.existsSync(video_path)) {
          return { content: [{ type: "text", text: `Error: File not found at path: ${video_path}` }] };
        }
        const form = new FormData();
        form.append("source", fs.createReadStream(video_path));
        if (title) form.append("title", title);

        const result = await metaPostForm<{ video_id: string; upload_session_id?: string }>(
          `act_${ad_account_id}/advideos`,
          form
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_create_ad_creative",
    {
      title: "Create Ad Creative",
      description: `Create an ad creative for a single image or video ad.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - name: Creative name
  - page_id: Facebook Page ID (use meta_get_account_pages to find)
  - message: Ad primary text / message body
  - link: Destination URL for the ad
  - image_hash: Image hash (from meta_upload_ad_image)
  - video_id: Video ID (from meta_upload_ad_video) — use instead of image_hash for video ads
  - title: Ad headline (optional)
  - description: Link description (optional)
  - call_to_action: CTA type (LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, CONTACT_US, APPLY_NOW, GET_QUOTE, SUBSCRIBE, WATCH_MORE, etc.)
  - instagram_actor_id: Instagram account ID for Instagram placement (optional)

Returns: { id: creative_id }
Use this creative_id when creating ads with meta_create_ad.`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        name: z.string().min(1).describe("Creative name"),
        page_id: z.string().describe("Facebook Page ID"),
        message: z.string().describe("Primary ad text"),
        link: z.string().url().describe("Destination URL"),
        image_hash: z.string().optional().describe("Image hash from meta_upload_ad_image"),
        video_id: z.string().optional().describe("Video ID from meta_upload_ad_video"),
        title: z.string().optional().describe("Ad headline"),
        description: z.string().optional().describe("Link description"),
        call_to_action: z.string().default("LEARN_MORE")
          .describe("CTA: LEARN_MORE, SHOP_NOW, SIGN_UP, BOOK_TRAVEL, CONTACT_US, APPLY_NOW, GET_QUOTE, SUBSCRIBE, WATCH_MORE, GET_OFFER, BUY_NOW, DOWNLOAD"),
        instagram_actor_id: z.string().optional().describe("Instagram account ID for Instagram ads"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, name, page_id, message, link, image_hash, video_id, title, description, call_to_action, instagram_actor_id }) => {
      try {
        if (!image_hash && !video_id) {
          return { content: [{ type: "text", text: "Error: Provide either image_hash or video_id" }] };
        }

        const linkData: Record<string, unknown> = {
          message,
          link,
          call_to_action: { type: call_to_action, value: { link } },
        };
        if (title) linkData.name = title;
        if (description) linkData.description = description;
        if (image_hash) linkData.image_hash = image_hash;
        if (video_id) {
          linkData.video_id = video_id;
          delete linkData.image_hash;
        }

        const objectStorySpec: Record<string, unknown> = {
          page_id,
          link_data: linkData,
        };
        if (instagram_actor_id) objectStorySpec.instagram_actor_id = instagram_actor_id;

        const data: Record<string, unknown> = { name, object_story_spec: objectStorySpec };

        const result = await metaPost<{ id: string }>(`act_${ad_account_id}/adcreatives`, data);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_create_carousel_ad_creative",
    {
      title: "Create Carousel Ad Creative",
      description: `Create a carousel ad creative with multiple images/videos and links.

Args:
  - ad_account_id: Ad account ID without 'act_' prefix
  - name: Creative name
  - page_id: Facebook Page ID
  - message: Primary ad text
  - cards: Array of carousel cards (2-10 cards required)
    - title: Card headline
    - description: Card description (optional)
    - link: Card destination URL
    - image_hash: Image hash (from meta_upload_ad_image)
    - video_id: Video ID (alternative to image_hash)
    - call_to_action: CTA for this card (optional, defaults to LEARN_MORE)
  - call_to_action: Default CTA for all cards
  - instagram_actor_id: Instagram account ID (optional)

Returns: { id: creative_id }`,
      inputSchema: {
        ad_account_id: z.string().describe("Ad account ID without 'act_' prefix"),
        name: z.string().min(1).describe("Creative name"),
        page_id: z.string().describe("Facebook Page ID"),
        message: z.string().describe("Primary ad text"),
        cards: z.array(z.object({
          title: z.string().describe("Card headline"),
          description: z.string().optional(),
          link: z.string().url().describe("Card destination URL"),
          image_hash: z.string().optional().describe("Image hash"),
          video_id: z.string().optional().describe("Video ID"),
          call_to_action: z.string().optional().describe("CTA for this card"),
        })).min(2).max(10).describe("Carousel cards (2-10)"),
        call_to_action: z.string().default("LEARN_MORE").describe("Default CTA type"),
        instagram_actor_id: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ ad_account_id, name, page_id, message, cards, call_to_action, instagram_actor_id }) => {
      try {
        const childAttachments = cards.map((card) => {
          const attachment: Record<string, unknown> = {
            link: card.link,
            name: card.title,
            call_to_action: { type: card.call_to_action ?? call_to_action, value: { link: card.link } },
          };
          if (card.description) attachment.description = card.description;
          if (card.image_hash) attachment.image_hash = card.image_hash;
          if (card.video_id) attachment.video_id = card.video_id;
          return attachment;
        });

        const linkData: Record<string, unknown> = {
          message,
          link: cards[0].link,
          child_attachments: childAttachments,
          multi_share_end_card: false,
        };

        const objectStorySpec: Record<string, unknown> = { page_id, link_data: linkData };
        if (instagram_actor_id) objectStorySpec.instagram_actor_id = instagram_actor_id;

        const result = await metaPost<{ id: string }>(
          `act_${ad_account_id}/adcreatives`,
          { name, object_story_spec: objectStorySpec }
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );

  server.registerTool(
    "meta_update_ad_creative",
    {
      title: "Update Ad Creative",
      description: `Update an existing ad creative's name or status.
Note: Meta restricts what can be changed on live creatives. For major changes, create a new creative and update the ad.

Args:
  - creative_id: Creative ID to update
  - name: New name (optional)

Returns: { success: true }`,
      inputSchema: {
        creative_id: z.string().describe("Creative ID to update"),
        name: z.string().optional().describe("New creative name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ creative_id, name }) => {
      try {
        const data: Record<string, unknown> = {};
        if (name) data.name = name;
        if (Object.keys(data).length === 0) {
          return { content: [{ type: "text", text: "Error: No fields to update provided" }] };
        }
        const result = await metaPost<{ success: boolean }>(creative_id, data);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleMetaError(error) }] };
      }
    }
  );
}
