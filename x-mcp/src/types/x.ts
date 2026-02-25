export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
  obtained_at: number;
}

export interface XPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count?: number;
  impression_count?: number;
}

export interface XUserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  created_at?: string;
  description?: string;
  location?: string;
  pinned_tweet_id?: string;
  profile_image_url?: string;
  protected?: boolean;
  public_metrics?: XUserPublicMetrics;
  url?: string;
  verified?: boolean;
  verified_type?: string;
}

export interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  conversation_id?: string;
  created_at?: string;
  public_metrics?: XPublicMetrics;
  referenced_tweets?: Array<{
    type: 'retweeted' | 'quoted' | 'replied_to';
    id: string;
  }>;
  attachments?: {
    media_keys?: string[];
    poll_ids?: string[];
  };
  in_reply_to_user_id?: string;
  possibly_sensitive?: boolean;
  reply_settings?: string;
  source?: string;
  lang?: string;
}

export interface XList {
  id: string;
  name: string;
  owner_id?: string;
  description?: string;
  private?: boolean;
  created_at?: string;
  follower_count?: number;
  member_count?: number;
}

export interface XSpace {
  id: string;
  title?: string;
  state: string;
  host_ids?: string[];
  creator_id?: string;
  created_at?: string;
  started_at?: string;
  scheduled_start?: string;
  ended_at?: string;
  participant_count?: number;
  is_ticketed?: boolean;
  lang?: string;
}

export interface XMediaUploadResponse {
  media_id: number;
  media_id_string: string;
  expires_after_secs?: number;
  processing_info?: {
    state: 'pending' | 'in_progress' | 'succeeded' | 'failed';
    check_after_secs?: number;
    progress_percent?: number;
    error?: {
      code: number;
      name: string;
      message: string;
    };
  };
}

export interface XApiResponse<T> {
  data?: T;
  errors?: Array<{ message: string; type: string }>;
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
    previous_token?: string;
  };
  includes?: {
    users?: XUser[];
    tweets?: XTweet[];
    media?: unknown[];
  };
}
