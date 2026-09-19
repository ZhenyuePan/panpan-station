import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  Code2,
  Command,
  ExternalLink,
  Github,
  Heart,
  Home,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Moon,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, date } from "./types";
import type { Draft, Entry, Reply, Section, SiteConfig, User } from "./types";
const World = lazy(() => import("./World"));
const nav: { id: Section; label: string; en: string; icon: typeof Home }[] = [
  { id: "home", label: "工作室", en: "THE STUDIO", icon: Home },
  { id: "blog", label: "博客", en: "THE LIBRARY", icon: BookOpen },
  { id: "projects", label: "项目", en: "THE WORKBENCH", icon: Code2 },
  { id: "forum", label: "社区", en: "THE COMMUNITY", icon: MessageCircle },
  { id: "about", label: "关于我", en: "BEHIND THE STATION", icon: UserRound },
];
const projects = [
  {
    name: "vLLM",
    repo: "vllm-project/vllm",
    tag: "INFERENCE",
    text: "从调度器与 PagedAttention 出发，探索高吞吐的模型推理。",
    color: "#e9b286",
  },
  {
    name: "SGLang",
    repo: "sgl-project/sglang",
    tag: "SERVING",
    text: "结构化生成、前缀缓存，以及推理服务里的各种巧思。",
    color: "#bfa5e9",
  },
  {
    name: "Mooncake",
    repo: "kvcache-ai/Mooncake",
    tag: "KV CACHE",
    text: "围绕 KV Cache 的传输与存储，连接推理的不同阶段。",
    color: "#9ccfba",
  },
  {
    name: "CacheLib",
    repo: "facebook/CacheLib",
    tag: "CACHING",
    text: "深入缓存分配、淘汰策略和分层存储的实现。",
    color: "#b0c7df",
  },
  {
    name: "Folly",
    repo: "facebook/folly",
    tag: "C++ FOUNDATIONS",
    text: "从并发原语、协程到高性能容器，回到 Meta 的 C++ 基础设施。",
    color: "#ddae9b",
  },
  {
    name: "3FS",
    repo: "deepseek-ai/3FS",
    tag: "STORAGE",
    text: "从 AI 工作负载出发，阅读分布式文件系统的设计。",
    color: "#d1bc8b",
  },
];
const initialSection = (): Section =>
  nav.some((n) => n.id === location.pathname.slice(1)) ||
  location.pathname === "/dashboard"
    ? (location.pathname.slice(1) as Section)
    : "home";
const blank = (kind: "article" | "thread"): Draft => ({
  kind,
  title: "",
  body: "",
  tags: kind === "thread" ? "闲聊" : "",
  status: "draft",
});
type Chat = { role: "user" | "assistant"; content: string };
const introStorageKey = "panpan-station-intro-v1";
const shouldPlayIntro = () => {
  try {
    return (
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      (new URLSearchParams(location.search).get("intro") === "1" ||
        localStorage.getItem(introStorageKey) !== "seen")
    );
  } catch {
    return false;
  }
};

function Markdown({
  text,
  onEntry,
}: {
  text: string;
  onEntry: (id: string) => void;
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={(e) => {
                if (href?.startsWith("/?entry=")) {
                  e.preventDefault();
                  onEntry(
                    new URL(href, location.origin).searchParams.get("entry")!,
                  );
                }
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
function MiniBot({ large = false }: { large?: boolean }) {
  return (
    <span className={"mini-bot " + (large ? "large" : "")}>
      <i />
      <span className="bot-face">
        <b />
        <b />
      </span>
    </span>
  );
}
function StudioIntro({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 4100);
    return () => window.clearTimeout(timer);
  }, [onComplete]);
  return (
    <section className="studio-intro" aria-label="潘潘的小站开场动画">
      <div className="intro-red-field" />
      <div className="intro-ink-field" />
      <div className="intro-sun" />
      <i className="intro-magpie">
        <b />
      </i>
      <div className="intro-branch" />
      <div className="intro-title-card">
        <span>CHAPTER 01 · THE STUDIO</span>
        <h1>潘潘的小站</h1>
        <p>FOR CURIOUS MINDS, AFTER DARK</p>
      </div>
      <div className="intro-credit">
        A SMALL PLACE FOR BIG IDEAS <i>✦</i>
      </div>
      <button className="intro-skip" onClick={onComplete}>
        跳过开场
      </button>
    </section>
  );
}

export default function App() {
  const [section, setSection] = useState<Section>(initialSection);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [threads, setThreads] = useState<Entry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<SiteConfig>({
    qqEnabled: false,
    agentMode: "local",
    model: "",
  });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [entryId, setEntryId] = useState<string | null>(
    new URLSearchParams(location.search).get("entry"),
  );
  const [detail, setDetail] = useState<{
    entry: Entry;
    replies: Reply[];
  } | null>(null);
  const [detailError, setDetailError] = useState("");
  const [filter, setFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [login, setLogin] = useState(false);
  const [loginKey, setLoginKey] = useState("");
  const [loginError, setLoginError] = useState("");
  const [working, setWorking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [chatError, setChatError] = useState("");
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorError, setEditorError] = useState("");
  const [preview, setPreview] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  const [admin, setAdmin] = useState<{
    entries: Entry[];
    calls: number;
    tokens: number;
    members: number;
  } | null>(null);
  const [adminError, setAdminError] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [toast, setToast] = useState("");
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [introPlayed, setIntroPlayed] = useState(() => !shouldPlayIntro());
  const [introOpen, setIntroOpen] = useState(
    () =>
      shouldPlayIntro() &&
      initialSection() === "home" &&
      !new URLSearchParams(location.search).get("entry"),
  );
  const [panelLeaving, setPanelLeaving] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);
  const chatController = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelExitTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const [a, t, u, c] = await Promise.all([
        api<Entry[]>("/articles"),
        api<Entry[]>("/threads"),
        api<User | null>("/me"),
        api<SiteConfig>("/config"),
      ]);
      setEntries(a);
      setThreads(t);
      setUser(u);
      setConfig(c);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  const commitNavigation = useCallback((s: Section) => {
    setSection(s);
    setEntryId(null);
    setDetail(null);
    setFilter("");
    history.pushState(null, "", s === "home" ? "/" : "/" + s);
  }, []);
  const navigate = useCallback(
    (s: Section) => {
      if (panelExitTimer.current) {
        window.clearTimeout(panelExitTimer.current);
        panelExitTimer.current = null;
      }
      if (s === "home" && (section !== "home" || entryId)) {
        if (reduced) {
          commitNavigation("home");
          return;
        }
        setPanelLeaving(true);
        panelExitTimer.current = window.setTimeout(() => {
          panelExitTimer.current = null;
          setPanelLeaving(false);
          commitNavigation("home");
        }, 280);
        return;
      }
      setPanelLeaving(false);
      commitNavigation(s);
    },
    [commitNavigation, entryId, reduced, section],
  );
  const openEntry = useCallback((id: string) => {
    setEntryId(id);
    setDetail(null);
    setDetailError("");
    setReply("");
    setReplyError("");
    setSearchOpen(false);
    history.pushState(null, "", "/?entry=" + encodeURIComponent(id));
  }, []);
  const getDetail = useCallback(async (id: string) => {
    try {
      setDetail(await api("/entries/" + encodeURIComponent(id)));
    } catch (e) {
      setDetailError((e as Error).message);
    }
  }, []);
  const refreshAdmin = useCallback(async () => {
    setAdminError("");
    try {
      setAdmin(await api("/admin"));
    } catch (e) {
      setAdminError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      chatController.current?.abort();
      if (panelExitTimer.current) window.clearTimeout(panelExitTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (entryId) {
      let alive = true;
      setDetail(null);
      setDetailError("");
      api<{ entry: Entry; replies: Reply[] }>(
        "/entries/" + encodeURIComponent(entryId),
      )
        .then((d) => {
          if (alive) setDetail(d);
        })
        .catch((e) => {
          if (alive) setDetailError(e.message);
        });
      return () => {
        alive = false;
      };
    }
  }, [entryId]);
  useEffect(() => {
    if (section === "dashboard" && user?.role === "admin") void refreshAdmin();
  }, [section, user, refreshAdmin]);
  useEffect(() => {
    if (reduced) {
      setIntroOpen(false);
      setIntroPlayed(true);
      return;
    }
    if (section !== "home" || entryId || introPlayed) return;
    setIntroPlayed(true);
    setIntroOpen(true);
    try {
      localStorage.setItem(introStorageKey, "seen");
    } catch {
      /* storage is optional */
    }
  }, [entryId, introPlayed, reduced, section]);
  useEffect(() => {
    const pop = () => {
      setSection(initialSection());
      setEntryId(new URLSearchParams(location.search).get("entry"));
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  }, [reduced]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    chatBottom.current?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
    });
  }, [messages, thinking, agentStatus, chatOpen, reduced]);
  useEffect(() => {
    if (!draft) return;
    setSavedLocal(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("panpan-draft", JSON.stringify(draft));
        setSavedLocal(true);
      } catch {
        setSavedLocal(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        if (login) setLogin(false);
        else if (searchOpen) setSearchOpen(false);
        else if (draft) setDraft(null);
        else if (chatOpen) setChatOpen(false);
        else navigate("home");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [navigate, login, searchOpen, draft, chatOpen]);
  useEffect(() => {
    if (section !== "home" || entryId) panelRef.current?.focus();
  }, [section, entryId]);
  useEffect(() => {
    document.title =
      (detail?.entry.title ||
        (section === "home"
          ? "一起折腾点有意思的"
          : nav.find((n) => n.id === section)?.label || "站长工作台")) +
      " · 潘潘的小站";
  }, [section, detail]);

  function startDraft(kind: "article" | "thread", existing?: Entry) {
    if (!user) {
      setLogin(true);
      return;
    }
    setEditorError("");
    setPreview(false);
    if (existing) {
      setDraft({
        id: existing.id,
        kind: existing.kind,
        title: existing.title,
        body: existing.body,
        tags: existing.tags,
        status: existing.status,
      });
      return;
    }
    try {
      const saved = JSON.parse(
        localStorage.getItem("panpan-draft") || "null",
      ) as Draft | null;
      if (saved && saved.kind === kind && !saved.id) {
        setDraft(saved);
        return;
      }
    } catch {
      /* invalid local draft */
    }
    setDraft(blank(kind));
  }
  async function saveDraft(status: string) {
    if (!draft || working) return;
    setWorking(true);
    setEditorError("");
    try {
      const { id, ...body } = draft;
      const e = await api<Entry>(id ? "/entries/" + id : "/entries", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ ...body, status }),
      });
      setDraft(null);
      localStorage.removeItem("panpan-draft");
      setToast(
        status === "published"
          ? "已发布，新的灵感上线了！"
          : "草稿已保存到服务器",
      );
      await refresh();
      if (user?.role === "admin") void refreshAdmin();
      if (status === "published") openEntry(e.id);
      else navigate("dashboard");
    } catch (e) {
      setEditorError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setWorking(true);
    setLoginError("");
    try {
      const u = await api<User>("/auth/admin", {
        method: "POST",
        body: JSON.stringify({ key: loginKey }),
      });
      setUser(u);
      setLogin(false);
      setLoginKey("");
      setToast("欢迎回家，潘潘");
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setLogin(true);
      return;
    }
    if (!entryId) return;
    setWorking(true);
    setReplyError("");
    try {
      await api("/entries/" + entryId + "/replies", {
        method: "POST",
        body: JSON.stringify({ body: reply }),
      });
      setReply("");
      await getDetail(entryId);
      void refresh();
    } catch (e) {
      setReplyError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function toggleLike() {
    if (!user) {
      setLogin(true);
      return;
    }
    if (!entryId || working) return;
    setWorking(true);
    try {
      await api("/entries/" + entryId + "/like", {
        method: "POST",
        body: "{}",
      });
      await getDetail(entryId);
      void refresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function removeEntry(e: Entry) {
    if (!confirm("将「" + e.title + "」移出站点？数据会保留在数据库中。"))
      return;
    try {
      await api("/entries/" + e.id, { method: "DELETE" });
      await refreshAdmin();
      await refresh();
      setToast("内容已移出站点");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function sendChat(text = chatInput) {
    if (!text.trim() || thinking) return;
    setChatOpen(true);
    setChatInput("");
    setChatError("");
    setToolNames([]);
    const next: Chat[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setThinking(true);
    setAgentStatus("小潘正在接收你的消息…");
    const controller = new AbortController();
    chatController.current = controller;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Panpan-Request": "1",
        },
        body: JSON.stringify({
          messages: next.slice(-10),
          entryId: detail?.entry.id || "",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "暂时连不上小潘");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const packet = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = packet
            .split("\n")
            .find((l) => l.startsWith("event:"))
            ?.slice(6)
            .trim();
          const line = packet.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const data = JSON.parse(line.slice(5));
          if (event === "status") setAgentStatus(data.message);
          if (event === "tool") {
            const label: Record<string, string> = {
              search_content: "检索站内内容",
              read_content: "阅读文章",
              navigate: "前往工作室区域",
              draft_article: "整理博客草稿",
            };
            setToolNames((old) => [...old, label[data.name] || data.name]);
            setAgentStatus(label[data.name] || "正在处理…");
          }
          if (event === "action") {
            if (
              data.type === "navigate" &&
              ["blog", "forum", "projects", "about"].includes(data.target)
            )
              navigate(data.target);
            if (data.type === "draft" && user?.role === "admin") {
              setDraft({
                kind: "article",
                title: data.title,
                body: data.body,
                tags: data.tags,
                status: "draft",
              });
              setToast("小潘已准备好草稿，等你检查");
            }
          }
          if (event === "answer")
            setMessages((old) => [
              ...old,
              { role: "assistant", content: data.text },
            ]);
          if (event === "error") throw new Error(data.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setChatError((e as Error).message);
    } finally {
      setThinking(false);
      setAgentStatus("");
      chatController.current = null;
    }
  }
  const panelOpen = section !== "home" || !!entryId;
  const filtered = (section === "forum" ? threads : entries).filter((e) =>
    (e.title + e.tags + e.body).toLowerCase().includes(filter.toLowerCase()),
  );
  const searchResults = [...entries, ...threads]
    .filter((e) =>
      (e.title + e.tags + e.body).toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div
      className={
        "station " +
        (!panelOpen ? "minimal-home" : "") +
        (panelLeaving ? " panel-leaving" : "")
      }
    >
      <div className="sky-grain" />
      <div className="sky-stars">
        {Array.from({ length: 35 }, (_, i) => (
          <i
            key={i}
            style={{
              left: ((i * 37.3) % 100) + "%",
              top: ((i * 23.7) % 93) + "%",
              animationDelay: (i % 7) + "s",
              opacity: 0.15 + (i % 4) * 0.12,
            }}
          />
        ))}
      </div>
      {panelOpen && (
        <header className="topbar">
          <button
            className="brand"
            onClick={() => navigate("home")}
            aria-label="返回工作室"
          >
            <img className="brand-avatar" src="/panpan-avatar.jpg" alt="潘潘" />
            <span>
              潘潘的小站<small>PANPAN’S LITTLE UNIVERSE</small>
            </span>
          </button>
          <nav className="main-nav" aria-label="主导航">
            {nav.map((n) => (
              <button
                key={n.id}
                className={section === n.id && !entryId ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                {n.label}
                {n.id === "home" && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button search-trigger"
              aria-label="搜索小站"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <kbd>⌘ K</kbd>
            </button>
            <span className="divider" />
            {user ? (
              <button
                className="user-button"
                onClick={() => navigate("dashboard")}
              >
                <span className="avatar-small">{user.name[0]}</span>
                {user.name}
              </button>
            ) : (
              <button className="login-trigger" onClick={() => setLogin(true)}>
                <UserRound size={15} />
                登录 <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        </header>
      )}

      <main className={"universe " + (panelOpen ? "has-panel" : "")}>
        <Suspense
          fallback={<div className="scene-loading">正在打开工作室…</div>}
        >
          <World
            navigate={navigate}
            chat={() => setChatOpen(true)}
            chatting={thinking}
            reduced={reduced}
          />
        </Suspense>
      </main>
      {introOpen && <StudioIntro onComplete={() => setIntroOpen(false)} />}

      {panelOpen && (
        <div
          className={
            "panel-layer " +
            (entryId || section === "life" ? "reading-layer" : "") +
            (section === "life" ? " life-layer" : "")
          }
        >
          <button
            className="panel-backdrop"
            aria-label="回到房间"
            onClick={() => navigate("home")}
          />
          <section
            ref={panelRef}
            className={
              "content-panel " +
              (entryId || section === "life" ? "reading-panel" : "") +
              (section === "life" ? " life-panel" : "")
            }
            tabIndex={-1}
            aria-label={
              entryId
                ? "阅读内容"
                : section === "life"
                  ? "平行人生游戏"
                  : "小站内容"
            }
          >
            <div className="panel-topline">
              <button
                className="text-button"
                onClick={() =>
                  entryId
                    ? navigate(
                        detail?.entry.kind === "thread" ? "forum" : "blog",
                      )
                    : navigate("home")
                }
              >
                <ChevronLeft size={16} />
                {entryId ? "返回列表" : "回到工作室"}
              </button>
              <span className="mono">
                {entryId
                  ? "READ / EXPLORE / THINK"
                  : section === "life"
                    ? "ARCHIVE / SEALED / 00"
                    : nav.find((n) => n.id === section)?.en ||
                      "OWNER’S WORKSPACE"}
              </span>
              <button
                className="icon-button"
                aria-label="关闭内容面板"
                onClick={() => navigate("home")}
              >
                <X size={19} />
              </button>
            </div>
            {entryId ? (
              detail ? (
                <article className="article">
                  <div className="article-tags">
                    {detail.entry.tags
                      .split(",")
                      .filter(Boolean)
                      .map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                  </div>
                  <h2>{detail.entry.title}</h2>
                  <div className="article-meta">
                    <span className="avatar-small">
                      {detail.entry.author[0]}
                    </span>
                    {detail.entry.author}
                    <span>·</span>
                    {new Date(detail.entry.created).toLocaleDateString("zh-CN")}
                    <span>·</span>
                    {Math.max(
                      1,
                      Math.ceil(detail.entry.body.length / 450),
                    )}{" "}
                    分钟阅读
                    {detail.entry.status === "draft" && (
                      <span className="draft-badge">草稿</span>
                    )}
                  </div>
                  <Markdown text={detail.entry.body} onEntry={openEntry} />
                  <div className="article-actions">
                    <button
                      className={
                        "secondary " + (detail.entry.liked ? "liked" : "")
                      }
                      onClick={toggleLike}
                      disabled={working}
                    >
                      <Heart size={16} />
                      {detail.entry.likes} 喜欢
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setChatOpen(true);
                        setChatInput("帮我解释一下这篇文章的核心观点");
                      }}
                    >
                      <Sparkles size={16} />
                      和小潘聊聊这篇
                    </button>
                    {user &&
                      (user.role === "admin" ||
                        user.id === detail.entry.authorId) && (
                        <button
                          className="text-button"
                          onClick={() =>
                            startDraft(detail.entry.kind, detail.entry)
                          }
                        >
                          <Pencil size={15} />
                          编辑
                        </button>
                      )}
                  </div>
                  <section className="replies">
                    <h3>
                      一起聊聊 <span>{detail.replies.length}</span>
                    </h3>
                    {detail.replies.length === 0 && (
                      <p className="empty-small">
                        还没有回复。你的想法，会是这里的第一颗星。
                      </p>
                    )}
                    {detail.replies.map((r) => (
                      <div className="reply" key={r.id}>
                        <span className="avatar-small">{r.author[0]}</span>
                        <div>
                          <strong>
                            {r.author}
                            <small>{date(r.created)}</small>
                          </strong>
                          <Markdown text={r.body} onEntry={openEntry} />
                        </div>
                      </div>
                    ))}
                    <form onSubmit={submitReply}>
                      <textarea
                        placeholder={
                          user
                            ? "分享你的想法…（支持 Markdown）"
                            : "登录后，留下你的想法"
                        }
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        maxLength={5000}
                        rows={3}
                      />
                      <div className="form-bottom">
                        <span className="error">{replyError}</span>
                        <button
                          className="primary"
                          disabled={working || (!!user && !reply.trim())}
                        >
                          {working ? (
                            <LoaderCircle className="spin" size={16} />
                          ) : (
                            <Send size={15} />
                          )}
                          {user ? "发送回复" : "登录后回复"}
                        </button>
                      </div>
                    </form>
                  </section>
                </article>
              ) : (
                <div className="panel-empty">
                  {detailError || (
                    <>
                      <LoaderCircle className="spin" />
                      正在打开内容…
                    </>
                  )}
                </div>
              )
            ) : (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {section === "dashboard"
                        ? "JUST FOR PANPAN"
                        : nav.find((n) => n.id === section)?.en}
                    </span>
                    <h2>
                      {
                        {
                          blog: "灵感，慢慢堆成书架。",
                          forum: "有趣的想法，在这里碰面。",
                          projects: "保持好奇，持续折腾。",
                          life: "人生档案正在整理。",
                          about: "很高兴，在这里遇见你。",
                          dashboard: "欢迎回家，潘潘。",
                          home: "",
                        }[section]
                      }
                    </h2>
                    <p>
                      {
                        {
                          blog: "技术笔记、生活碎片，还有那些值得记录的瞬间。",
                          forum: "聊技术、分享发现，或者只是来打个招呼。",
                          projects:
                            "我的源码阅读清单。打开仓库，一起往里面走一走。",
                          life: "书架顶层的档案盒暂时封存。",
                          about: "一个人，一间工作室，一些正在生长的想法。",
                          dashboard: "写下新的灵感，照看你的互联网小角落。",
                          home: "",
                        }[section]
                      }
                    </p>
                  </div>
                  {section === "forum" && (
                    <button
                      className="primary"
                      onClick={() => startDraft("thread")}
                    >
                      <Plus size={16} />
                      发个帖子
                    </button>
                  )}
                  {section === "blog" && user?.role === "admin" && (
                    <button
                      className="primary"
                      onClick={() => startDraft("article")}
                    >
                      <Pencil size={16} />
                      写文章
                    </button>
                  )}
                </div>
                {(section === "blog" || section === "forum") && (
                  <>
                    <div className="list-toolbar">
                      <div className="filter-pills">
                        {(section === "forum"
                          ? ["", "技术交流", "闲聊"]
                          : ["", "AI Infra", "随笔", "Build in public"]
                        ).map((t) => (
                          <button
                            key={t}
                            className={filter === t ? "active" : ""}
                            onClick={() => setFilter(t)}
                          >
                            {t || "全部"}
                            {!t && (
                              <span>
                                {section === "forum"
                                  ? threads.length
                                  : entries.length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      <label className="inline-search">
                        <Search size={15} />
                        <input
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                          placeholder="搜索灵感…"
                        />
                      </label>
                    </div>
                    {loadError ? (
                      <div className="panel-empty">
                        {loadError}
                        <button
                          className="secondary"
                          onClick={() => void refresh()}
                        >
                          重新连接
                        </button>
                      </div>
                    ) : loading ? (
                      <div className="panel-empty">
                        <LoaderCircle className="spin" />
                        正在整理书架…
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="panel-empty">
                        没有找到相关内容。试试其他关键词？
                      </div>
                    ) : (
                      <div
                        className={
                          section === "forum" ? "thread-list" : "article-list"
                        }
                      >
                        {filtered.map((e, i) => (
                          <button
                            className="entry-card"
                            key={e.id}
                            onClick={() => openEntry(e.id)}
                          >
                            <span className="entry-index">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="entry-main">
                              <div className="entry-tags">
                                {e.tags
                                  .split(",")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((t) => (
                                    <span key={t}>{t}</span>
                                  ))}
                                <span className="entry-date">
                                  {date(e.created)}
                                </span>
                              </div>
                              <h3>{e.title}</h3>
                              <p>
                                {e.body.replace(/[#*>`\n]/g, " ").slice(0, 95)}
                              </p>
                              <div className="entry-stats">
                                <span>{e.author}</span>
                                <span>
                                  <Heart size={12} />
                                  {e.likes}
                                </span>
                                <span>
                                  <MessageCircle size={12} />
                                  {e.replyCount}
                                </span>
                              </div>
                            </div>
                            <ArrowUpRight className="entry-arrow" size={22} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {section === "projects" && (
                  <div className="project-grid">
                    {projects.map((p, i) => (
                      <a
                        className="project-card"
                        key={p.name}
                        href={"https://github.com/" + p.repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ "--project": p.color } as React.CSSProperties}
                      >
                        <div className="project-top">
                          <span className="project-icon">
                            <Code2 size={23} />
                          </span>
                          <span className="mono">
                            {String(i + 1).padStart(2, "0")} / {p.tag}
                          </span>
                          <ArrowUpRight size={18} />
                        </div>
                        <h3>{p.name}</h3>
                        <p>{p.text}</p>
                        <span className="repo-link">
                          <Github size={14} />
                          {p.repo}
                        </span>
                      </a>
                    ))}
                    <div className="project-card project-next">
                      <Sparkles size={28} />
                      <h3>下一个好主意？</h3>
                      <p>也许就来自你的一条留言。</p>
                      <button
                        className="text-button"
                        onClick={() => navigate("forum")}
                      >
                        去社区聊聊 <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {section === "life" && (
                  <div className="life-coming-soon">
                    <span className="eyebrow">ARCHIVE 00 / SEALED</span>
                    <span className="life-coming-mark" aria-hidden="true">
                      ✦
                    </span>
                    <h2>人生档案正在整理</h2>
                    <p>这里会在合适的时候，成为一场可以慢慢走进去的游戏。</p>
                    <small>UNDER CONSTRUCTION</small>
                  </div>
                )}
                {section === "about" && (
                  <div className="about-content">
                    <div className="about-portrait">
                      <img
                        className="profile-avatar"
                        src="/panpan-avatar.jpg"
                        alt="潘潘"
                      />
                      <span className="mono">HUMAN BEHIND THE CODE</span>
                    </div>
                    <div>
                      <h3>
                        Hi，我是潘潘 <span>✳</span>
                      </h3>
                      <p>
                        喜欢研究技术，也喜欢把想法变成能摸得到、用得上的东西。
                      </p>
                      <p>
                        这个小站用来存放学习笔记、源码阅读记录和各种小实验。最近的探索围绕
                        AI 推理、缓存和存储展开。
                      </p>
                      <blockquote>
                        保持好奇，把有意思的事一点点做出来。
                      </blockquote>
                      <div className="about-tags">
                        <span>AI Infrastructure</span>
                        <span>开源与源码</span>
                        <span>Build in public</span>
                        <span>持续折腾中</span>
                      </div>
                      <button
                        className="primary"
                        onClick={() => navigate("forum")}
                      >
                        来打个招呼 <ArrowUpRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
                {section === "dashboard" &&
                  (user?.role !== "admin" ? (
                    <div className="dashboard-lock">
                      <Terminal size={38} />
                      <h3>潘潘的专属工作台</h3>
                      <p>站长登录后，可以管理文章、草稿和社区。</p>
                      <button
                        className="primary"
                        onClick={() => setLogin(true)}
                      >
                        站长登录 <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      {adminError && <p className="error">{adminError}</p>}
                      <div className="stats-grid">
                        <div>
                          <span>文章 / 草稿</span>
                          <strong>
                            {admin?.entries.filter(
                              (e) =>
                                e.kind === "article" &&
                                e.status === "published",
                            ).length ?? "—"}
                            <small>
                              {" "}
                              /{" "}
                              {admin?.entries.filter(
                                (e) => e.status === "draft",
                              ).length ?? "—"}
                            </small>
                          </strong>
                        </div>
                        <div>
                          <span>社区帖子</span>
                          <strong>
                            {admin?.entries.filter((e) => e.kind === "thread")
                              .length ?? "—"}
                          </strong>
                        </div>
                        <div>
                          <span>Agent 调用</span>
                          <strong>{admin?.calls ?? "—"}</strong>
                        </div>
                        <div>
                          <span>累计 Token</span>
                          <strong>
                            {admin?.tokens.toLocaleString() ?? "—"}
                          </strong>
                        </div>
                      </div>
                      <div className="dashboard-actions">
                        <button
                          className="primary"
                          onClick={() => startDraft("article")}
                        >
                          <Plus size={16} />
                          开始写作
                        </button>
                        <button
                          className="secondary"
                          onClick={() => {
                            setChatOpen(true);
                            setChatInput("帮我起草一篇新文章，先和我讨论主题");
                          }}
                        >
                          <Sparkles size={16} />
                          和小潘一起写
                        </button>
                        <button
                          className="text-button"
                          onClick={async () => {
                            try {
                              await api("/auth/logout", { method: "POST" });
                              setUser(null);
                              setAdmin(null);
                              setToast("已退出登录");
                            } catch (e) {
                              setToast((e as Error).message);
                            }
                          }}
                        >
                          <LogOut size={14} />
                          退出登录
                        </button>
                      </div>
                      <div className="integration-note">
                        <span className="live-dot" />
                        DeepSeek：
                        {config.agentMode === "deepseek"
                          ? config.model
                          : "待配置 API Key"}
                        <span>·</span>QQ 登录：
                        {config.qqEnabled ? "已配置" : "待域名与应用审核"}
                      </div>
                      <div className="admin-table">
                        {admin?.entries.map((e) => (
                          <div key={e.id}>
                            <span className={"status-badge " + e.status}>
                              {e.status === "draft"
                                ? "草稿"
                                : e.kind === "article"
                                  ? "文章"
                                  : "帖子"}
                            </span>
                            <button
                              className="admin-title"
                              onClick={() => openEntry(e.id)}
                            >
                              {e.title}
                            </button>
                            <small>{date(e.updated)}</small>
                            <button
                              className="icon-button"
                              aria-label={"编辑 " + e.title}
                              onClick={() => startDraft(e.kind, e)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={"移除 " + e.title}
                              onClick={() => void removeEntry(e)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ))}
              </>
            )}
          </section>
        </div>
      )}

      {panelOpen && !chatOpen && (
        <button
          className={
            "agent-dock " + (section === "life" ? "life-agent-dock" : "")
          }
          aria-label="打开潘潘助手"
          onClick={() => setChatOpen(true)}
        >
          <MiniBot />
          <span>和潘潘聊聊</span>
        </button>
      )}

      {chatOpen && (
        <aside className="agent-panel" aria-label="小潘助手">
          <div className="agent-header">
            <MiniBot />
            <div>
              <strong>
                小潘
                <span className="live-dot" />
              </strong>
              <small>
                {config.agentMode === "local"
                  ? "本地向导 · 待连接 DeepSeek"
                  : "POWERED BY " + config.model.toUpperCase()}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="关闭助手"
              onClick={() => setChatOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="chat-scroll">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <span className="eyebrow">YOUR LITTLE CO-PILOT</span>
                <h3>嗨，要一起探索吗？</h3>
                <p>
                  找篇文章、逛逛工作台，
                  <br />
                  或者聊聊你正在想的事。
                </p>
                {[
                  "带我看看项目",
                  "找找 KV Cache 相关的文章",
                  "去社区打个招呼",
                ].map((q) => (
                  <button key={q} onClick={() => void sendChat(q)}>
                    {q}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div className={"chat-message " + m.role} key={i}>
                {m.role === "assistant" && (
                  <span className="chat-author">✦ 小潘</span>
                )}
                <Markdown text={m.content} onEntry={openEntry} />
              </div>
            ))}
            {toolNames.length > 0 && (
              <div className="tool-trail">
                {toolNames.map((t, i) => (
                  <span key={i}>
                    <Check size={12} />
                    {t}
                  </span>
                ))}
              </div>
            )}
            {thinking && (
              <div className="agent-thinking">
                <LoaderCircle size={14} className="spin" />
                {agentStatus}
              </div>
            )}
            {chatError && <div className="error chat-error">{chatError}</div>}
            <div ref={chatBottom} />
          </div>
          {detail && (
            <div className="chat-context">
              <BookOpen size={12} />
              <span>正在阅读：{detail.entry.title}</span>
            </div>
          )}
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat();
            }}
          >
            <textarea
              aria-label="发消息给小潘"
              placeholder="说说你想探索什么…"
              rows={2}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={3500}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
            />
            <div>
              <span>ENTER 发送 · SHIFT + ENTER 换行</span>
              {thinking ? (
                <button
                  type="button"
                  onClick={() => chatController.current?.abort()}
                  className="send-button"
                  aria-label="停止回答"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  className="send-button"
                  disabled={!chatInput.trim()}
                  aria-label="发送消息"
                >
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </form>
          <div className="agent-footnote">
            {config.agentMode === "local"
              ? "本地导航模式 · 不调用模型，不消耗 Token"
              : "回答可能有误，重要信息请结合引用核实"}
          </div>
        </aside>
      )}

      {searchOpen && (
        <div className="modal-scrim" onClick={() => setSearchOpen(false)}>
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="搜索小站"
            onClick={(e) => e.stopPropagation()}
          >
            <label>
              <Search size={21} />
              <input
                autoFocus
                placeholder="搜索文章、帖子，或前往某个角落…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="关闭搜索"
                onClick={() => setSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </label>
            <div className="search-results">
              <span className="eyebrow">
                {search ? "FOUND IN THIS LITTLE UNIVERSE" : "QUICK JUMP"}
              </span>
              {!search &&
                nav
                  .filter((n) => n.id !== "home")
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        navigate(n.id);
                        setSearchOpen(false);
                      }}
                    >
                      <n.icon size={16} />
                      {n.label}
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
              {searchResults.map((e) => (
                <button key={e.id} onClick={() => openEntry(e.id)}>
                  {e.kind === "article" ? (
                    <BookOpen size={16} />
                  ) : (
                    <MessageCircle size={16} />
                  )}
                  <span>{e.title}</span>
                  <small>{e.kind === "article" ? "文章" : "帖子"}</small>
                </button>
              ))}
              {search && !searchResults.length && (
                <p className="empty-small">
                  没有找到相关内容，换个关键词试试。
                </p>
              )}
            </div>
            <footer>
              <Command size={13} />K 随时打开<span>ESC 关闭</span>
            </footer>
          </section>
        </div>
      )}

      {login && (
        <div className="modal-scrim" onClick={() => setLogin(false)}>
          <section
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-label="登录小站"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="关闭登录"
              onClick={() => setLogin(false)}
            >
              <X size={20} />
            </button>
            <MiniBot large />
            <h2>欢迎来做客。</h2>
            <p>登录之后，把你的想法留在小站。</p>
            {config.qqEnabled ? (
              <a className="primary qq-login" href="/api/auth/qq">
                使用 QQ 登录 <ArrowUpRight size={17} />
              </a>
            ) : (
              <div className="qq-pending">
                <MessageCircle size={18} />
                <div>
                  <strong>QQ 登录准备中</strong>
                  <span>域名与 QQ 互联应用审核完成后开放</span>
                </div>
              </div>
            )}
            <details>
              <summary>
                我是站长，进入工作台 <Terminal size={14} />
              </summary>
              <form onSubmit={signIn}>
                <label className="field-label">
                  站长密钥
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={loginKey}
                    onChange={(e) => setLoginKey(e.target.value)}
                    placeholder="输入服务器生成的站长密钥"
                    required
                    minLength={24}
                  />
                </label>
                {loginError && <p className="error">{loginError}</p>}
                <button className="primary" disabled={working}>
                  {working ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                  进入小站
                </button>
              </form>
            </details>
            <small className="login-note">
              无需登录，也可以自由阅读与探索。
            </small>
          </section>
        </div>
      )}

      {draft && (
        <div className="editor-layer">
          <section
            className="editor"
            role="dialog"
            aria-modal="true"
            aria-label={draft.kind === "article" ? "文章编辑器" : "发帖编辑器"}
          >
            <header>
              <button className="text-button" onClick={() => setDraft(null)}>
                <ChevronLeft size={17} />
                返回
              </button>
              <span className="mono">
                {draft.kind === "article"
                  ? "A NEW THOUGHT STARTS HERE"
                  : "LET’S START A CONVERSATION"}
              </span>
              <div>
                <span className="save-indicator">
                  {savedLocal ? (
                    <>
                      <Check size={12} />
                      已暂存本机
                    </>
                  ) : (
                    "编辑中…"
                  )}
                </span>
                <button
                  className="secondary"
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? "继续编辑" : "预览"}
                </button>
                {draft.kind === "article" && (
                  <button
                    className="secondary"
                    disabled={working}
                    onClick={() => void saveDraft("draft")}
                  >
                    保存草稿
                  </button>
                )}
                <button
                  className="primary"
                  disabled={working}
                  onClick={() => void saveDraft("published")}
                >
                  {working ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <ArrowUpRight size={15} />
                  )}
                  发布
                </button>
              </div>
            </header>
            <div className="editor-body">
              <div className="eyebrow">
                {draft.kind === "article"
                  ? "来自潘潘的灵感书架"
                  : "来自小站社区"}
              </div>
              <input
                className="title-input"
                aria-label="内容标题"
                placeholder="给这个想法起个名字…"
                value={draft.title}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <label className="tags-input">
                标签
                <input
                  placeholder="用逗号分隔，例如 AI Infra,学习笔记"
                  value={draft.tags}
                  maxLength={180}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
              </label>
              {editorError && <p className="error">{editorError}</p>}
              {preview ? (
                <Markdown
                  text={draft.body || "预览会出现在这里。"}
                  onEntry={openEntry}
                />
              ) : (
                <textarea
                  className="body-input"
                  aria-label="Markdown 正文"
                  placeholder="从这里开始…\n\n支持 Markdown、代码块、列表和图片链接。"
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              )}
            </div>
            <footer>
              <span>MARKDOWN ENABLED</span>
              <span>{draft.body.length} 字符</span>
              <button
                className="text-button"
                onClick={() => {
                  setChatOpen(true);
                  setChatInput(
                    "帮我润色这段内容：\n" + draft.body.slice(0, 2400),
                  );
                }}
              >
                <Sparkles size={14} />
                找小潘一起写
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {panelOpen && (
        <button
          className="dashboard-entry"
          aria-label="站长工作台"
          title="站长工作台"
          onClick={() => navigate("dashboard")}
        >
          <Settings2 size={14} />
        </button>
      )}
    </div>
  );
}
