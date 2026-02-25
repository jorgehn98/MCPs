export type Visibility = 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';
export type FeedDistribution = 'MAIN_FEED' | 'NONE';
export type LifecycleState = 'PUBLISHED' | 'DRAFT';
export type ReactionType = 'LIKE' | 'PRAISE' | 'EMPATHY' | 'INTEREST' | 'APPRECIATION' | 'ENTERTAINMENT';
export type SortBy = 'LAST_MODIFIED' | 'CREATED';

export interface Distribution {
  feedDistribution: FeedDistribution;
  targetEntities: string[];
  thirdPartyDistributionChannels: string[];
}

export interface PostBase {
  author: string;
  commentary: string;
  visibility: Visibility;
  distribution: Distribution;
  lifecycleState: LifecycleState;
  isReshareDisabledByAuthor: boolean;
}

export interface MediaContent {
  media: {
    altText?: string;
    title?: string;
    id: string;
  };
}

export interface ArticleContent {
  article: {
    source: string;
    thumbnail?: string;
    title: string;
    description?: string;
  };
}

export interface TextPost extends PostBase {}

export interface ImagePost extends PostBase {
  content: MediaContent;
}

export interface VideoPost extends PostBase {
  content: MediaContent;
}

export interface ArticlePost extends PostBase {
  content: ArticleContent;
}

export interface ResharePost extends PostBase {
  reshareContext: {
    parent: string;
  };
}

export interface TokenData {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope: string;
  obtained_at: number;
}

export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  localizedHeadline?: string;
  vanityName?: string;
}
