import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Smile, Image, AtSign, X, Search, MessageCircle, Zap, Reply, ArrowDown } from 'lucide-react';
import { getGameName } from '@/lib/game-registry';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

interface GifItem {
  id: string;
  title: string;
  preview: string;
  url: string;
  width: number;
  height: number;
}

function mapGiphyItem(g: any): GifItem {
  return {
    id: g.id,
    title: g.title ?? '',
    preview: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url ?? '',
    url: g.images?.fixed_width?.url ?? g.images?.downsized_medium?.url ?? '',
    width: Number(g.images?.fixed_width?.width ?? 200),
    height: Number(g.images?.fixed_width?.height ?? 200),
  };
}

async function searchGifs(query: string): Promise<GifItem[]> {
  if (!GIPHY_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=pg`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map(mapGiphyItem);
  } catch { return []; }
}

async function getTrendingGifs(): Promise<GifItem[]> {
  if (!GIPHY_API_KEY) return [];
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data ?? []).map(mapGiphyItem);
  } catch { return []; }
}

const QUICK_EMOJIS = [
  '😀','😂','🤣','😍','🥰','😎','🤩','🥳',
  '😤','🔥','💪','👏','🙌','❤️','💜','⭐',
  '🎮','🎲','🏆','🥇','🍜','☕','🎯','🧠',
  '👍','👎','🤝','✌️','🫡','💀','😭','🫠',
];

// WhatsApp-style default reaction row.
const REACTION_QUICK = ['👍','❤️','😂','😮','😢','🔥'];

const LEGACY_STICKER_MAP: Record<string, string> = {
  happy: '🎉', gg: '🎮', fire: '🔥', clap: '👏',
  lol: '😂', love: '❤️', cool: '😎', sad: '😢',
  wow: '🤯', think: '🤔', noodle: '🍜', brain: '🧠',
};

interface MentionSuggestion {
  id: string;
  name: string;
  avatar: string;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// Deterministic per-author palette. Same author → same name colour + stripe
// across every message, so a long burst stays recognisable even without
// re-showing the avatar/name.
const AUTHOR_PALETTE = [
  { name: 'text-sky-300', stripe: 'bg-sky-400' },
  { name: 'text-emerald-300', stripe: 'bg-emerald-400' },
  { name: 'text-amber-300', stripe: 'bg-amber-400' },
  { name: 'text-rose-300', stripe: 'bg-rose-400' },
  { name: 'text-teal-300', stripe: 'bg-teal-400' },
  { name: 'text-cyan-300', stripe: 'bg-cyan-400' },
  { name: 'text-orange-300', stripe: 'bg-orange-400' },
  { name: 'text-lime-300', stripe: 'bg-lime-400' },
  { name: 'text-yellow-300', stripe: 'bg-yellow-400' },
  { name: 'text-red-300', stripe: 'bg-red-400' },
];

function authorColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AUTHOR_PALETTE[h % AUTHOR_PALETTE.length];
}

// One-line summary of a quoted message — used both inside reply quote
// strips on rendered bubbles and in the compose-bar reply preview.
function quotedPreview(type: string | undefined, content: string | undefined): string {
  if (!content) return '';
  if (type === 'gif_url') return '🖼️ GIF';
  if (type === 'gif') return '🖼️ Sticker';
  const trimmed = content.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed;
}

interface Reaction { id: string; playerId: string; playerName: string; emoji: string; }

// Group reactions by emoji and compute count + whether the current viewer
// is one of the reactors (so we can highlight their chip).
function groupReactions(reactions: Reaction[] | undefined, viewerId: string | undefined) {
  if (!reactions || reactions.length === 0) return [];
  const map = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
  for (const r of reactions) {
    const cur = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
    cur.count += 1;
    cur.names.push(r.playerName);
    if (viewerId && r.playerId === viewerId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return [...map.values()];
}

function renderTextContent(content: string) {
  const parts = content.split(/(@\w+|https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('@')) {
      return <span key={i} className="font-bold text-accent">{part}</span>;
    }
    if (/^https?:\/\//i.test(part)) {
      if (/\.(gif|jpg|jpeg|png|webp)(\?.*)?$/i.test(part)) {
        return <img key={i} src={part} alt="" className="mt-1 rounded-xl max-w-[240px] w-full" loading="lazy" />;
      }
      return <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all opacity-80">{part}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function Feed() {
  const { player } = useAuth();
  const kidMode = !!player?.kidMode;
  const [tab, setTab] = useState<'chat' | 'activity'>(kidMode ? 'activity' : 'chat');

  useEffect(() => {
    if (kidMode) setTab('activity');
  }, [kidMode]);
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifSearchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  // Per-message actions popover (reactions + reply). Holds the post id of
  // the currently-tapped bubble, or null when nothing is open.
  const [actionsForPost, setActionsForPost] = useState<string | null>(null);
  // When set, the next message sent will quote this post (WhatsApp-style).
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only follows new messages while the reader is parked at
  // the bottom; scrolling up to read history pins them in place.
  const nearBottomRef = useRef(true);
  const lastPostCountRef = useRef(0);
  const [newBelow, setNewBelow] = useState(0);

  const chatData = useQuery(
    api.feed.getChatMessages,
    player?.sessionToken ? { limit: 100, sessionToken: player.sessionToken } : 'skip',
  );
  const activityData = useQuery(api.feed.getActivity, { limit: 50 });
  const searchResults = useQuery(
    api.auth.searchPlayers as any,
    mentionQuery.length >= 2 && player ? { query: mentionQuery, sessionToken: player.sessionToken } : 'skip' as any
  );
  const createPost = useMutation(api.feed.createPost);
  const toggleReaction = useMutation(api.feed.toggleReaction);

  const loadGifs = useCallback(async (query: string) => {
    setGifLoading(true);
    const results = query.trim() ? await searchGifs(query.trim()) : await getTrendingGifs();
    setGifResults(results);
    setGifLoading(false);
  }, []);

  useEffect(() => {
    if (!showGif || !GIPHY_API_KEY) return;
    if (gifSearchTimer.current) clearTimeout(gifSearchTimer.current);
    gifSearchTimer.current = setTimeout(() => loadGifs(gifQuery), gifQuery ? 400 : 0);
    return () => { if (gifSearchTimer.current) clearTimeout(gifSearchTimer.current); };
  }, [showGif, gifQuery, loadGifs]);

  useEffect(() => {
    if (searchResults) {
      setMentionSuggestions(searchResults.map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar })));
    }
  }, [searchResults]);

  const scrollToBottom = useCallback((smooth = true) => {
    feedEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    nearBottomRef.current = true;
    setNewBelow(0);
  }, []);

  const handleFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    if (near) setNewBelow(0);
  }, []);

  useEffect(() => {
    const count = chatData?.length ?? 0;
    const prev = lastPostCountRef.current;
    lastPostCountRef.current = count;
    if (count === 0) return;
    if (prev === 0) {
      // First load — land on the latest messages without animation.
      scrollToBottom(false);
    } else if (count > prev) {
      if (nearBottomRef.current) scrollToBottom();
      else setNewBelow(n => n + (count - prev));
    }
  }, [chatData, scrollToBottom]);

  const handleSend = async () => {
    if (!message.trim() || !player || !createPost) return;
    try {
      await createPost({
        sessionToken: player.sessionToken,
        type: 'chat',
        content: message.trim(),
        ...(replyTo ? { replyToId: replyTo.id as any } : {}),
      });
      setMessage('');
      setShowEmoji(false);
      setShowGif(false);
      setReplyTo(null);
      scrollToBottom();
    } catch { /* send failed */ }
  };

  const handleToggleReaction = async (postId: string, emoji: string) => {
    if (!player || !toggleReaction) return;
    setActionsForPost(null);
    try {
      await toggleReaction({ postId: postId as any, sessionToken: player.sessionToken, emoji });
    } catch { /* toggle failed */ }
  };

  const handleStartReply = (post: any) => {
    setReplyTo(post);
    setActionsForPost(null);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === val.length - 1) {
      setShowMention(true); setMentionQuery('');
    } else if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(' ')) { setShowMention(true); setMentionQuery(afterAt); }
      else setShowMention(false);
    } else {
      setShowMention(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = message.lastIndexOf('@');
    setMessage(message.slice(0, lastAt) + `@${name} `);
    setShowMention(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const sendGif = async (gifUrl: string) => {
    if (!player || !createPost) return;
    try {
      await createPost({
        sessionToken: player.sessionToken,
        type: 'gif_url',
        content: gifUrl,
        ...(replyTo ? { replyToId: replyTo.id as any } : {}),
      });
      setShowGif(false); setGifQuery('');
      setReplyTo(null);
      scrollToBottom();
    } catch { /* send failed */ }
  };

  const chatPosts = [...(chatData ?? [])].reverse();
  const activityPosts = activityData ?? [];

  const renderChatContent = (post: any) => {
    if (post.type === 'gif_url') {
      return <img src={post.content} alt="GIF" className="mt-1 rounded-xl max-w-[200px] w-full" loading="lazy" />;
    }
    if (post.type === 'gif') {
      const emoji = LEGACY_STICKER_MAP[post.content];
      if (emoji) return <span className="text-4xl leading-none inline-block mt-1">{emoji}</span>;
      return <span className="text-sm italic opacity-60">{post.content}</span>;
    }
    return renderTextContent(post.content);
  };

  const formatActivityContent = (content: string) => {
    const slugMatch = content.match(/on\s+([a-z0-9-]+)!/);
    if (slugMatch) {
      const gameName = getGameName(slugMatch[1]);
      return content.replace(slugMatch[1], gameName.replace(/^\S+\s/, ''));
    }
    return content;
  };

  // Mark chat as read while it's on screen (drives the nav unread dot).
  // Keyed on the newest timestamp so unrelated re-renders don't re-fire.
  const newestChatTs = chatPosts.length > 0
    ? Math.max(...chatPosts.map((p: any) => p.createdAt ?? 0))
    : 0;
  useEffect(() => {
    if (tab !== 'chat' || newestChatTs === 0) return;
    localStorage.setItem('nq_chat_read', String(newestChatTs));
    window.dispatchEvent(new Event('nq-chat-read'));
  }, [tab, newestChatTs]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-0 bg-surface flex-shrink-0">
        <h1 className="text-lg font-bold">{kidMode ? 'Activity' : 'Chat'}</h1>
        <p className="text-text-muted text-xs mt-0.5 mb-3">
          {kidMode
            ? 'Stars, challenges, and game highlights — chat is off in Kid mode'
            : 'Chat with other players and track activity'}
        </p>

        {/* Tab bar */}
        {!kidMode && (
        <div className="flex gap-1">
          {([
            { id: 'chat', icon: MessageCircle, label: 'Chat' },
            { id: 'activity', icon: Zap, label: 'Activity' },
          ] as const).map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold transition-all border-b-2 ${
                  active
                    ? 'text-accent border-accent bg-accent/8'
                    : 'text-text-muted border-transparent hover:text-text hover:bg-white/4'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Divider under tabs */}
      <div className="h-px bg-white/5 flex-shrink-0" />

      {/* Feed area */}
      <div className="flex-1 relative min-h-0">
      <div ref={feedScrollRef} onScroll={handleFeedScroll} className="h-full overflow-y-auto">
        {tab === 'chat' && (
          chatPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted pb-8">
              <MessageCircle size={40} strokeWidth={1.5} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm font-semibold">No messages yet</p>
                <p className="text-xs opacity-60 mt-0.5">Say hello to other players!</p>
              </div>
            </div>
          ) : (
            <div className="px-3 py-4 space-y-1">
              {chatPosts.map((post: any, idx: number) => {
                const isMe = post.authorName === player?.name;
                const prev = chatPosts[idx - 1] as any;
                const next = chatPosts[idx + 1] as any;
                // Groups also break on a >5min gap, not just author changes —
                // a same-author burst hours apart shouldn't share one header.
                const GROUP_GAP = 5 * 60 * 1000;
                const isSameAuthorAsPrev = prev && prev.authorName === post.authorName
                  && post.createdAt - prev.createdAt < GROUP_GAP;
                const isSameAuthorAsNext = next && next.authorName === post.authorName
                  && next.createdAt - post.createdAt < GROUP_GAP;
                const isFirstInGroup = !isSameAuthorAsPrev;
                const isLastInGroup = !isSameAuthorAsNext;
                const addGap = isFirstInGroup && idx > 0;
                const color = authorColor(post.authorName || '');
                const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(post.createdAt);

                return (
                  <div key={post.id}>
                  {newDay && (
                    <div className="flex items-center gap-3 py-2" aria-hidden>
                      <div className="flex-1 h-px bg-white/5" />
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{dayLabel(post.createdAt)}</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                  )}
                  <div
                    className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${addGap && !newDay ? 'mt-3' : ''}`}
                  >
                    {/* Avatar column (others only) — anchored to the last
                        bubble in a group, WhatsApp-style; space is always
                        reserved so bubbles line up. */}
                    {!isMe && (
                      <div className="w-8 flex-shrink-0 flex items-end justify-center">
                        {isLastInGroup && (
                          <span className="text-2xl leading-none pb-0.5">{post.authorAvatar || '🎮'}</span>
                        )}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {isFirstInGroup && (
                        <span className={`text-[11px] font-bold mb-1 ${isMe ? 'mr-1 text-accent' : `ml-2 ${color.name}`}`}>
                          {isMe ? 'You' : post.authorName}
                        </span>
                      )}
                      <div className={`relative ${!isMe ? 'pl-2' : ''}`}>
                        {/* Per-author colour stripe on others' bubbles — persistent identifier */}
                        {!isMe && (
                          <span
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${color.stripe}`}
                            aria-hidden
                          />
                        )}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            // Let links/images inside the bubble keep their own click semantics.
                            if ((e.target as HTMLElement).closest('a, img')) return;
                            setActionsForPost(prev => prev === post.id ? null : post.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActionsForPost(prev => prev === post.id ? null : post.id);
                            }
                          }}
                          className={`rounded-2xl px-3 py-2 text-sm break-words leading-relaxed cursor-pointer transition-shadow ${
                            isMe
                              ? `bg-accent text-bg ${isFirstInGroup ? 'rounded-tr-sm' : ''} ${isLastInGroup ? 'rounded-br-sm' : ''}`
                              : `bg-card text-text ${isFirstInGroup ? 'rounded-tl-sm' : ''} ${isLastInGroup ? 'rounded-bl-sm' : ''}`
                          } ${actionsForPost === post.id ? 'ring-2 ring-accent/50' : ''}`}
                        >
                          {/* Quoted reply preview at top of bubble */}
                          {post.replyToId && post.replyToContent && (
                            <div className={`mb-1.5 rounded-lg pl-2 pr-2 py-1 border-l-2 ${
                              isMe
                                ? 'bg-black/15 border-bg/40'
                                : 'bg-white/5 border-white/20'
                            }`}>
                              <div className={`text-[10px] font-bold ${isMe ? 'opacity-80' : authorColor(post.replyToAuthorName || '').name}`}>
                                {post.replyToAuthorName === player?.name ? 'You' : post.replyToAuthorName}
                              </div>
                              <div className={`text-[11px] truncate ${isMe ? 'opacity-70' : 'opacity-60'}`}>
                                {quotedPreview(post.replyToType, post.replyToContent)}
                              </div>
                            </div>
                          )}
                          {renderChatContent(post)}
                        </div>
                      </div>

                      {/* Reactions row */}
                      {post.reactions && post.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end mr-1' : 'ml-2'}`}>
                          {groupReactions(post.reactions, player?.playerId).map(g => (
                            <button
                              key={g.emoji}
                              type="button"
                              onClick={() => handleToggleReaction(post.id, g.emoji)}
                              title={g.names.join(', ')}
                              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] border transition-colors ${
                                g.mine
                                  ? 'bg-accent/15 border-accent/50 text-accent'
                                  : 'bg-card border-white/10 text-text hover:bg-card-hover'
                              }`}
                            >
                              <span className="text-sm leading-none">{g.emoji}</span>
                              {g.count > 1 && <span className="font-semibold">{g.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Actions popover (reactions row + reply) — shown when bubble tapped */}
                      {actionsForPost === post.id && (
                        <div className={`mt-1.5 flex items-center gap-1 bg-card border border-white/10 rounded-full px-1.5 py-1 shadow-lg ${
                          isMe ? 'self-end mr-1' : 'self-start ml-2'
                        }`}>
                          {REACTION_QUICK.map(e => (
                            <button
                              key={e}
                              type="button"
                              onClick={() => handleToggleReaction(post.id, e)}
                              className="text-lg w-7 h-7 flex items-center justify-center rounded-full hover:bg-card-hover active:scale-90 transition-all"
                            >
                              {e}
                            </button>
                          ))}
                          <span className="w-px h-5 bg-white/10 mx-0.5" aria-hidden />
                          <button
                            type="button"
                            onClick={() => handleStartReply(post)}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full text-text-muted hover:text-text hover:bg-card-hover transition-colors"
                            title="Reply"
                          >
                            <Reply size={13} />
                            Reply
                          </button>
                        </div>
                      )}

                      {/* Time — show only on last in a group */}
                      {isLastInGroup && (
                        <span className="text-[10px] text-text-muted mt-1 mx-1">{formatTime(post.createdAt)}</span>
                      )}
                    </div>
                  </div>
                  </div>
                );
              })}
              <div ref={feedEndRef} />
            </div>
          )
        )}

        {tab === 'activity' && (
          activityPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted pb-8">
              <Zap size={40} strokeWidth={1.5} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm font-semibold">No activity yet</p>
                <p className="text-xs opacity-60 mt-0.5">Play games to see your achievements here</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {activityPosts.map((post: any) => {
                const isMe = post.authorName === player?.name;
                const hasStars = /star/i.test(post.content);
                return (
                  <div
                    key={post.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      isMe
                        ? 'bg-accent/8 border-accent/20'
                        : 'bg-card border-white/5'
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">{post.authorAvatar || '🎮'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${isMe ? 'text-accent' : 'text-text'}`}>
                          {post.authorName}
                        </span>
                        {isMe && (
                          <span className="text-[10px] bg-accent text-bg font-bold px-1.5 py-0.5 rounded-full">YOU</span>
                        )}
                        <span className="text-[10px] text-text-muted">{formatTime(post.createdAt)}</span>
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isMe ? 'text-text' : 'text-text-muted'}`}>
                        {formatActivityContent(post.content)}
                      </p>
                    </div>
                    {hasStars && <span className="text-lg flex-shrink-0">⭐</span>}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* New-messages pill — appears when new posts land while the reader
          is scrolled up in history. */}
      {tab === 'chat' && newBelow > 0 && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-accent text-bg text-xs font-bold pl-3 pr-4 py-2 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <ArrowDown size={13} />
          {newBelow} new message{newBelow === 1 ? '' : 's'}
        </button>
      )}
      </div>

      {/* Compose bar (chat only) */}
      {tab === 'chat' && (
        <div className="flex-shrink-0 bg-surface border-t border-white/5 p-3 space-y-2">
          {/* Reply preview — shown above the input when replying to a message */}
          {replyTo && (
            <div className="flex items-center gap-2 bg-card border border-white/10 rounded-xl pl-2 pr-1.5 py-1.5">
              <Reply size={14} className="text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0 border-l-2 border-accent pl-2">
                <div className="text-[10px] font-bold text-accent">
                  Replying to {replyTo.authorName === player?.name ? 'yourself' : replyTo.authorName}
                </div>
                <div className="text-[11px] text-text-muted truncate">
                  {quotedPreview(replyTo.type, replyTo.content)}
                </div>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-card-hover transition-colors flex-shrink-0"
                title="Cancel reply"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Mention dropdown */}
          {showMention && mentionSuggestions.length > 0 && (
            <div className="bg-card rounded-xl border border-white/10 overflow-hidden max-h-32 overflow-y-auto">
              {mentionSuggestions.map(s => (
                <button
                  key={s.id}
                  onClick={() => insertMention(s.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card-hover text-left text-sm"
                >
                  <span>{s.avatar}</span>
                  <span className="font-medium">{s.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Emoji picker */}
          {showEmoji && (
            <div className="bg-card rounded-xl border border-white/10 p-3">
              <div className="grid grid-cols-8 gap-1">
                {QUICK_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => insertEmoji(e)}
                    className="text-xl p-1.5 rounded-lg hover:bg-card-hover active:scale-90 transition-all"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* GIF picker */}
          {showGif && (
            <div className="bg-card rounded-xl border border-white/10 overflow-hidden">
              {GIPHY_API_KEY ? (
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-2 bg-surface rounded-lg px-3 py-2">
                    <Search size={14} className="text-text-muted flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Search GIFs..."
                      value={gifQuery}
                      onChange={e => setGifQuery(e.target.value)}
                      enterKeyHint="search"
                      className="flex-1 bg-transparent text-base text-text placeholder-text-muted outline-none"
                      autoFocus
                    />
                    {gifQuery && (
                      <button onClick={() => setGifQuery('')} className="text-text-muted hover:text-text">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg">
                    {gifLoading ? (
                      <div className="text-center text-text-muted text-xs py-8 animate-pulse">Loading...</div>
                    ) : gifResults.length === 0 ? (
                      <div className="text-center text-text-muted text-xs py-8">
                        {gifQuery ? 'No GIFs found — try a different search' : 'Loading trending GIFs...'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1">
                        {gifResults.map(g => (
                          <button
                            key={g.id}
                            onClick={() => sendGif(g.url)}
                            className="rounded-lg overflow-hidden hover:ring-2 ring-accent active:scale-95 transition-all bg-surface"
                          >
                            <img src={g.preview} alt={g.title} loading="lazy" className="w-full h-auto" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1.5 pr-1">
                    <span className="text-[9px] text-text-muted/50">Powered by</span>
                    <img src="https://giphy.com/static/img/giphy_logo_square.png" alt="GIPHY" className="h-3 opacity-40" />
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center">
                  <Image size={24} className="mx-auto text-text-muted mb-2" />
                  <p className="text-sm text-text-muted">GIF search is not configured</p>
                  <p className="text-xs text-text-muted/60 mt-1">Add VITE_GIPHY_API_KEY to enable</p>
                </div>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-2">
            {/* Tool buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
                className={`p-2 rounded-xl transition-colors ${showEmoji ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-white/5'}`}
                title="Emoji"
              >
                <Smile size={18} />
              </button>
              <button
                onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
                className={`p-2 rounded-xl transition-colors ${showGif ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-white/5'}`}
                title="GIF"
              >
                <Image size={18} />
              </button>
              <button
                onClick={() => {
                  setMessage(prev => prev + '@');
                  setShowMention(true); setMentionQuery('');
                  inputRef.current?.focus();
                }}
                className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-white/5 transition-colors"
                title="Mention"
              >
                <AtSign size={18} />
              </button>
            </div>

            {/* Text input — 16px minimum so iOS doesn't auto-zoom on focus */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Say something..."
                value={message}
                onChange={handleInputChange}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                enterKeyHint="send"
                autoComplete="off"
                className="w-full bg-card rounded-2xl px-4 py-2.5 text-base text-text placeholder-text-muted outline-none focus:ring-1 ring-accent/50 transition-all"
                maxLength={500}
              />
              {message.length > 450 && (
                <span className="absolute -top-5 right-2 text-[10px] font-semibold text-text-muted">
                  {500 - message.length}
                </span>
              )}
            </div>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              className="w-10 h-10 rounded-2xl bg-accent text-bg flex items-center justify-center hover:opacity-90 active:scale-95 disabled:opacity-25 transition-all flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
