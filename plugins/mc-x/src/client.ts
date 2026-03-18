/**
 * Lightweight X/Twitter API v2 client using native fetch with Bearer token auth.
 */

const API_BASE = "https://api.twitter.com/2";

export interface Tweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
}

export interface PostTweetResult {
  id: string;
  text: string;
}

export interface TimelineResult {
  tweets: Tweet[];
  meta?: Record<string, unknown>;
}

export class XClient {
  private bearerToken: string;

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.bearerToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Post a new tweet.
   */
  async postTweet(text: string): Promise<PostTweetResult> {
    const res = await fetch(`${API_BASE}/tweets`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { data: { id: string; text: string } };
    return json.data;
  }

  /**
   * Read recent tweets from the authenticated user's timeline.
   * Uses the "reverse chronological" home timeline endpoint.
   */
  async getTimeline(userId: string, count = 10): Promise<TimelineResult> {
    const url = new URL(`${API_BASE}/users/${userId}/tweets`);
    url.searchParams.set("max_results", String(Math.min(Math.max(count, 5), 100)));
    url.searchParams.set("tweet.fields", "created_at,author_id");

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { data?: Tweet[]; meta?: Record<string, unknown> };
    return { tweets: json.data ?? [], meta: json.meta };
  }

  /**
   * Reply to an existing tweet.
   */
  async replyToTweet(tweetId: string, text: string): Promise<PostTweetResult> {
    const res = await fetch(`${API_BASE}/tweets`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        text,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`X API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as { data: { id: string; text: string } };
    return json.data;
  }
}
