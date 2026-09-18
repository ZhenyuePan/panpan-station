export type Section = 'home' | 'blog' | 'forum' | 'projects' | 'about' | 'dashboard';
export type User = { id: string; name: string; avatar: string; role: string };
export type Entry = { id: string; kind: 'article' | 'thread'; title: string; body: string; tags: string; status: string; authorId: string; author: string; created: string; updated: string; likes: number; replyCount: number; liked?: boolean };
export type Reply = { id: string; body: string; author: string; created: string };
export type SiteConfig = { qqEnabled: boolean; agentMode: 'local' | 'deepseek'; model: string };
export type Draft = { id?: string; kind: 'article' | 'thread'; title: string; body: string; tags: string; status: string };
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', 'X-Panpan-Request': '1', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '网络连接出了点问题');
  return data as T;
}
export const date = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
