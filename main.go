package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

type config struct{ Addr, Data, Static, SiteURL, ImportDir, AdminKey, QQID, QQSecret, QQAdmin, DeepKey, DeepURL, Model string }
type server struct {
	cfg        config
	store      *store
	client     *http.Client
	limits     sync.Map
	agentSlots chan struct{}
}
type bucket struct {
	mu    sync.Mutex
	start time.Time
	count int
}

func env(k, fallback string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return fallback
}
func randomID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func hash(s string) string { v := sha256.Sum256([]byte(s)); return hex.EncodeToString(v[:]) }
func main() {
	c := config{Addr: env("PANPAN_ADDR", "127.0.0.1:18080"), Data: env("PANPAN_DATA", ".data"), Static: env("PANPAN_STATIC", "web/dist"), ImportDir: os.Getenv("PANPAN_IMPORT_DIR"), SiteURL: strings.TrimRight(env("PANPAN_SITE_URL", "http://127.0.0.1:18080"), "/"), AdminKey: os.Getenv("PANPAN_ADMIN_KEY"), QQID: os.Getenv("QQ_APP_ID"), QQSecret: os.Getenv("QQ_APP_SECRET"), QQAdmin: os.Getenv("QQ_ADMIN_OPENID"), DeepKey: os.Getenv("DEEPSEEK_API_KEY"), DeepURL: strings.TrimRight(env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"), "/"), Model: env("DEEPSEEK_MODEL", "deepseek-flash")}
	if err := os.MkdirAll(c.Data, 0700); err != nil {
		log.Fatal(err)
	}
	if c.AdminKey == "" {
		p := filepath.Join(c.Data, "admin.key")
		b, err := os.ReadFile(p)
		if errors.Is(err, os.ErrNotExist) {
			b = []byte(randomID())
			err = os.WriteFile(p, b, 0600)
		}
		if err != nil {
			log.Fatal(err)
		}
		c.AdminKey = strings.TrimSpace(string(b))
	}
	if len(c.AdminKey) < 24 {
		log.Fatal("PANPAN_ADMIN_KEY must contain at least 24 characters")
	}
	st, err := openStore(filepath.Join(c.Data, "station.db"))
	if err != nil {
		log.Fatal(err)
	}
	defer st.db.Close()
	if c.ImportDir != "" {
		n, err := st.importLegacy(c.ImportDir)
		if err != nil {
			log.Fatalf("import legacy posts: %v", err)
		}
		if n > 0 {
			log.Printf("imported %d legacy posts", n)
		}
	}
	s := &server{cfg: c, store: st, client: &http.Client{Timeout: 90 * time.Second}, agentSlots: make(chan struct{}, 3)}
	h := &http.Server{Addr: c.Addr, Handler: s.routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 150 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = h.Shutdown(shutdown)
	}()
	log.Printf("Panpan station listening on %s (agent configured: %t)", c.Addr, c.DeepKey != "")
	if err = h.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
func respond(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, code int, msg string) {
	respond(w, code, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		fail(w, 400, "请求内容不正确或过长")
		return false
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		fail(w, 400, "请求格式不正确")
		return false
	}
	return true
}
func (s *server) rate(key string, n int, period time.Duration) bool {
	now := time.Now()
	if cnt := s.limitCount(); cnt > 10000 {
		s.limits.Range(func(k, v any) bool {
			b := v.(*bucket)
			b.mu.Lock()
			old := now.Sub(b.start) > 24*time.Hour
			b.mu.Unlock()
			if old {
				s.limits.Delete(k)
			}
			return true
		})
	}
	v, _ := s.limits.LoadOrStore(key, &bucket{start: now})
	b := v.(*bucket)
	b.mu.Lock()
	defer b.mu.Unlock()
	if now.Sub(b.start) >= period {
		b.start = now
		b.count = 0
	}
	b.count++
	return b.count <= n
}
func (s *server) limitCount() int {
	n := 0
	s.limits.Range(func(_, _ any) bool { n++; return n < 10001 })
	return n
}
func ip(r *http.Request) string {
	h, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return h
}
func (s *server) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]string{"status": "ok", "version": "0.1.0"})
	})
	m.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]any{"qqEnabled": s.cfg.QQID != "" && s.cfg.QQSecret != "", "agentMode": map[bool]string{true: "deepseek", false: "local"}[s.cfg.DeepKey != ""], "model": s.cfg.Model})
	})
	m.HandleFunc("GET /api/me", func(w http.ResponseWriter, r *http.Request) { respond(w, 200, s.user(r)) })
	m.HandleFunc("POST /api/auth/admin", s.adminLogin)
	m.HandleFunc("POST /api/auth/logout", s.logout)
	m.HandleFunc("GET /api/auth/qq", s.qqLogin)
	m.HandleFunc("GET /api/auth/qq/callback", s.qqCallback)
	m.HandleFunc("GET /api/articles", s.list("article"))
	m.HandleFunc("GET /api/threads", s.list("thread"))
	m.HandleFunc("GET /api/entries/{id}", s.detail)
	m.HandleFunc("POST /api/entries", s.createEntry)
	m.HandleFunc("PUT /api/entries/{id}", s.updateEntry)
	m.HandleFunc("DELETE /api/entries/{id}", s.deleteEntry)
	m.HandleFunc("POST /api/entries/{id}/replies", s.reply)
	m.HandleFunc("POST /api/entries/{id}/like", s.like)
	m.HandleFunc("GET /api/admin", s.adminData)
	m.HandleFunc("POST /api/agent", s.agent)
	m.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "接口不存在") })
	root := http.FileServer(http.Dir(s.cfg.Static))
	m.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			fail(w, 405, "不支持此请求方法")
			return
		}
		p := filepath.Join(s.cfg.Static, filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/")))
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			root.ServeHTTP(w, r)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/assets/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(s.cfg.Static, "index.html"))
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://graph.qq.com")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if !s.rate("all:"+ip(r), 240, time.Minute) {
				fail(w, 429, "访问太频繁，请稍后再试")
				return
			}
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			if r.Header.Get("X-Panpan-Request") != "1" || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				fail(w, 403, "请求来源无效")
				return
			}
			if o := r.Header.Get("Origin"); o != "" {
				u, e := url.Parse(o)
				allowed, e2 := url.Parse(s.cfg.SiteURL)
				if e != nil || e2 != nil || u.Host != r.Host && u.Host != allowed.Host {
					fail(w, 403, "请求来源无效")
					return
				}
			}
		}
		defer func() {
			if v := recover(); v != nil {
				log.Printf("request panic: %v", v)
				fail(w, 500, "服务暂时遇到问题")
			}
		}()
		m.ServeHTTP(w, r)
	})
}
func (s *server) dbError(w http.ResponseWriter, err error) {
	log.Printf("database: %v", err)
	fail(w, 500, "保存失败，请稍后重试")
}
func validateEntry(e *entry) error {
	e.Title = strings.TrimSpace(e.Title)
	e.Body = strings.TrimSpace(e.Body)
	e.Tags = strings.TrimSpace(e.Tags)
	if len([]rune(e.Title)) < 2 || len([]rune(e.Title)) > 120 {
		return fmt.Errorf("标题需要 2–120 个字")
	}
	if len([]rune(e.Body)) < 2 || len(e.Body) > 100000 {
		return fmt.Errorf("正文需要至少 2 个字，且不超过 100 KB")
	}
	if len(e.Tags) > 200 {
		return fmt.Errorf("标签过长")
	}
	if e.Kind != "article" && e.Kind != "thread" {
		return fmt.Errorf("内容类型无效")
	}
	if e.Status != "draft" && e.Status != "published" {
		return fmt.Errorf("发布状态无效")
	}
	return nil
}
