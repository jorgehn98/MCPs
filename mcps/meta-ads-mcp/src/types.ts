export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  error_user_msg?: string;
  error_user_title?: string;
  fbtrace_id?: string;
}

export interface MetaApiErrorResponse {
  error: MetaApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
    previous?: string;
  };
}

export interface AdAccount {
  [key: string]: unknown;
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent?: string;
  balance?: string;
  spend_cap?: string;
}

export interface Campaign {
  [key: string]: unknown;
  id: string;
  name: string;
  status: string;
  objective: string;
  buying_type?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
  updated_time?: string;
  effective_status?: string;
}

export interface AdSet {
  [key: string]: unknown;
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  billing_event?: string;
  optimization_goal?: string;
  bid_amount?: number;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  created_time?: string;
  updated_time?: string;
  effective_status?: string;
}

export interface Ad {
  [key: string]: unknown;
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative?: { id: string };
  created_time?: string;
  updated_time?: string;
  effective_status?: string;
}

export interface AdCreative {
  [key: string]: unknown;
  id: string;
  name?: string;
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  object_story_spec?: Record<string, unknown>;
  asset_feed_spec?: Record<string, unknown>;
  effective_instagram_story_id?: string;
  effective_object_story_id?: string;
}

export interface InsightData {
  [key: string]: unknown;
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  frequency?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  cpp?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
}

export interface CustomAudience {
  [key: string]: unknown;
  id: string;
  name: string;
  description?: string;
  subtype: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  data_source?: Record<string, unknown>;
  created_time?: string;
  updated_time?: string;
}

export type ResponseFormat = "markdown" | "json";
