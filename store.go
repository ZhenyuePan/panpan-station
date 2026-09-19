package main

import (
	"database/sql"
	_ "modernc.org/sqlite"
	"net/http"
	"strings"
	"time"
)

type store struct{ db *sql.DB }
type user struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
	Role   string `json:"role"`
}
type entry struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	Tags       string `json:"tags"`
	Status     string `json:"status"`
	AuthorID   string `json:"authorId"`
	Author     string `json:"author"`
	Created    string `json:"created"`
	Updated    string `json:"updated"`
	Likes      int    `json:"likes"`
	ReplyCount int    `json:"replyCount"`
	Liked      bool   `json:"liked"`
}
type reply struct {
	ID      string `json:"id"`
	Body    string `json:"body"`
	Author  string `json:"author"`
	Created string `json:"created"`
}

func openStore(path string) (*store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',role TEXT NOT NULL DEFAULT 'member');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_states(token TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',status TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),created TEXT NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS replies(id TEXT PRIMARY KEY,entry_id TEXT NOT NULL REFERENCES entries(id),author_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS likes(entry_id TEXT NOT NULL REFERENCES entries(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(entry_id,user_id));
 CREATE TABLE IF NOT EXISTS usage(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,model TEXT NOT NULL,tokens INTEGER NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS entries_lookup ON entries(kind,status,created);
 CREATE INDEX IF NOT EXISTS reply_lookup ON replies(entry_id,created);
 CREATE INDEX IF NOT EXISTS usage_actor ON usage(actor,created);
 INSERT OR IGNORE INTO users(id,name,role) VALUES('owner','潘潘','admin');`); err != nil {
		db.Close()
		return nil, err
	}
	st := &store{db: db}
	var n int
	if err = db.QueryRow("SELECT COUNT(*) FROM entries").Scan(&n); err != nil {
		return nil, err
	}
	if n == 0 {
		if err = st.seed(); err != nil {
			return nil, err
		}
	}
	return st, nil
}

const entrySelect = `SELECT e.id,e.kind,e.title,e.body,e.tags,e.status,e.author_id,u.name,e.created,e.updated,(SELECT COUNT(*) FROM likes l WHERE l.entry_id=e.id),(SELECT COUNT(*) FROM replies r WHERE r.entry_id=e.id) FROM entries e JOIN users u ON u.id=e.author_id `

type scanner interface{ Scan(...any) error }

func scanEntry(row scanner) (entry, error) {
	var e entry
	err := row.Scan(&e.ID, &e.Kind, &e.Title, &e.Body, &e.Tags, &e.Status, &e.AuthorID, &e.Author, &e.Created, &e.Updated, &e.Likes, &e.ReplyCount)
	return e, err
}
func (st *store) entries(kind, search string, all bool) ([]entry, error) {
	q := entrySelect + "WHERE e.status != 'deleted' "
	args := []any{}
	if kind != "" {
		q += "AND e.kind=? "
		args = append(args, kind)
	}
	if !all {
		q += "AND e.status='published' "
	}
	if search != "" {
		q += "AND (e.title LIKE ? OR e.body LIKE ? OR e.tags LIKE ?) "
		for range 3 {
			args = append(args, "%"+search+"%")
		}
	}
	q += "ORDER BY e.created DESC LIMIT 100"
	rows, err := st.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []entry{}
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
func (st *store) get(id string) (entry, error) {
	return scanEntry(st.db.QueryRow(entrySelect+"WHERE e.id=? AND e.status!='deleted'", id))
}
func (s *server) list(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		if len(q) > 200 {
			fail(w, 400, "搜索词过长")
			return
		}
		es, err := s.store.entries(kind, q, false)
		if err != nil {
			s.dbError(w, err)
			return
		}
		respond(w, 200, es)
	}
}
func (s *server) visible(w http.ResponseWriter, r *http.Request) (entry, bool) {
	e, err := s.store.get(r.PathValue("id"))
	if err != nil {
		if err != sql.ErrNoRows {
			s.dbError(w, err)
		} else {
			fail(w, 404, "内容不存在")
		}
		return e, false
	}
	u := s.user(r)
	if e.Status != "published" && (u == nil || u.Role != "admin" && u.ID != e.AuthorID) {
		fail(w, 404, "内容不存在")
		return e, false
	}
	return e, true
}
func (s *server) detail(w http.ResponseWriter, r *http.Request) {
	e, ok := s.visible(w, r)
	if !ok {
		return
	}
	rows, err := s.store.db.Query("SELECT r.id,r.body,u.name,r.created FROM replies r JOIN users u ON u.id=r.author_id WHERE r.entry_id=? ORDER BY r.created LIMIT 200", e.ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	replies := []reply{}
	for rows.Next() {
		var p reply
		if err = rows.Scan(&p.ID, &p.Body, &p.Author, &p.Created); err != nil {
			rows.Close()
			s.dbError(w, err)
			return
		}
		replies = append(replies, p)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		s.dbError(w, err)
		return
	}
	if u := s.user(r); u != nil {
		var n int
		_ = s.store.db.QueryRow("SELECT COUNT(*) FROM likes WHERE entry_id=? AND user_id=?", e.ID, u.ID).Scan(&n)
		e.Liked = n > 0
	}
	respond(w, 200, map[string]any{"entry": e, "replies": replies})
}

type entryInput struct {
	Kind   string `json:"kind"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Tags   string `json:"tags"`
	Status string `json:"status"`
}

func inputEntry(in entryInput) entry {
	return entry{Kind: in.Kind, Title: in.Title, Body: in.Body, Tags: in.Tags, Status: in.Status}
}
func (s *server) createEntry(w http.ResponseWriter, r *http.Request) {
	u := s.require(w, r, false)
	if u == nil {
		return
	}
	if !s.rate("post:"+u.ID, 12, time.Hour) {
		fail(w, 429, "发帖太快了，休息一下吧")
		return
	}
	var in entryInput
	if !decode(w, r, &in) {
		return
	}
	e := inputEntry(in)
	if err := validateEntry(&e); err != nil {
		fail(w, 400, err.Error())
		return
	}
	if e.Kind == "article" && u.Role != "admin" {
		fail(w, 403, "只有站长可以发布博客")
		return
	}
	e.ID = randomID()[:16]
	e.AuthorID = u.ID
	e.Created = time.Now().UTC().Format(time.RFC3339)
	e.Updated = e.Created
	_, err := s.store.db.Exec("INSERT INTO entries(id,kind,title,body,tags,status,author_id,created,updated) VALUES(?,?,?,?,?,?,?,?,?)", e.ID, e.Kind, e.Title, e.Body, e.Tags, e.Status, e.AuthorID, e.Created, e.Updated)
	if err != nil {
		s.dbError(w, err)
		return
	}
	e.Author = u.Name
	respond(w, 201, e)
}
func (s *server) updateEntry(w http.ResponseWriter, r *http.Request) {
	u := s.require(w, r, false)
	if u == nil {
		return
	}
	old, ok := s.visible(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && old.AuthorID != u.ID {
		fail(w, 403, "无法编辑他人的内容")
		return
	}
	var in entryInput
	if !decode(w, r, &in) {
		return
	}
	e := inputEntry(in)
	if e.Kind != old.Kind {
		fail(w, 400, "不能改变内容类型")
		return
	}
	if err := validateEntry(&e); err != nil {
		fail(w, 400, err.Error())
		return
	}
	_, err := s.store.db.Exec("UPDATE entries SET title=?,body=?,tags=?,status=?,updated=? WHERE id=?", e.Title, e.Body, e.Tags, e.Status, time.Now().UTC().Format(time.RFC3339), old.ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	updated, err := s.store.get(old.ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, updated)
}
func (s *server) deleteEntry(w http.ResponseWriter, r *http.Request) {
	u := s.require(w, r, false)
	if u == nil {
		return
	}
	e, ok := s.visible(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && e.AuthorID != u.ID {
		fail(w, 403, "无法删除他人的内容")
		return
	}
	if _, err := s.store.db.Exec("UPDATE entries SET status='deleted' WHERE id=?", e.ID); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (s *server) reply(w http.ResponseWriter, r *http.Request) {
	u := s.require(w, r, false)
	if u == nil {
		return
	}
	e, ok := s.visible(w, r)
	if !ok {
		return
	}
	if e.Status != "published" {
		fail(w, 400, "只能回复已发布内容")
		return
	}
	if !s.rate("reply:"+u.ID, 30, time.Hour) {
		fail(w, 429, "回复太快了，请稍后再试")
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Body = strings.TrimSpace(in.Body)
	if len(in.Body) == 0 || len(in.Body) > 10000 {
		fail(w, 400, "回复需要 1–10000 字节")
		return
	}
	p := reply{ID: randomID()[:16], Body: in.Body, Author: u.Name, Created: time.Now().UTC().Format(time.RFC3339)}
	if _, err := s.store.db.Exec("INSERT INTO replies VALUES(?,?,?,?,?)", p.ID, e.ID, u.ID, p.Body, p.Created); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 201, p)
}
func (s *server) like(w http.ResponseWriter, r *http.Request) {
	u := s.require(w, r, false)
	if u == nil {
		return
	}
	e, ok := s.visible(w, r)
	if !ok {
		return
	}
	var liked bool
	tx, err := s.store.db.Begin()
	if err != nil {
		s.dbError(w, err)
		return
	}
	defer tx.Rollback()
	res, err := tx.Exec("DELETE FROM likes WHERE entry_id=? AND user_id=?", e.ID, u.ID)
	if err != nil {
		s.dbError(w, err)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		if _, err = tx.Exec("INSERT INTO likes VALUES(?,?)", e.ID, u.ID); err != nil {
			s.dbError(w, err)
			return
		}
		liked = true
	}
	if err = tx.Commit(); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, map[string]bool{"liked": liked})
}
func (s *server) adminData(w http.ResponseWriter, r *http.Request) {
	if s.require(w, r, true) == nil {
		return
	}
	es, err := s.store.entries("", "", true)
	if err != nil {
		s.dbError(w, err)
		return
	}
	var calls, tokens, members int
	_ = s.store.db.QueryRow("SELECT COUNT(*),COALESCE(SUM(tokens),0) FROM usage").Scan(&calls, &tokens)
	_ = s.store.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&members)
	respond(w, 200, map[string]any{"entries": es, "calls": calls, "tokens": tokens, "members": members})
}
func (st *store) seed() error {
	now := time.Now().UTC()
	es := []entry{
		{ID: "hello-world", Kind: "article", Title: "Hello, world. 欢迎来到我的小宇宙", Tags: "小站日志,随笔", Body: "这里是潘潘的小站，一间漂浮在互联网里的工作室。\n\n## 留一块地方，给好奇心\n\n搭这个小站，是想把平时读源码、做实验、踩坑和偶尔冒出来的想法，放在一个能慢慢生长的地方。\n\n你可以在书架里读文章，在工作台看看项目，也可以去公告板留下一条自己的想法。\n\n## 和小潘打个招呼\n\n右下角的小机器人是这里的向导。试着问它「带我看看项目」或者「找找缓存相关的文章」。配置 DeepSeek 后，它还能结合站内文章和你深入讨论。\n\n> 这是一篇用来介绍小站的初始文章。站长可以在工作台编辑它。\n\n愿这里永远保留一点折腾的劲头。"},
		{ID: "kv-cache-notes", Kind: "article", Title: "从 KV Cache 开始，理解一次推理", Tags: "AI Infra,学习笔记", Body: "这是一份用于展示阅读体验的入门笔记。\n\n## 为什么需要 KV Cache？\n\n自回归模型逐个生成 token。在常见的因果自注意力实现中，已经处理过的 token 的 Key 和 Value 可以保留下来，后续生成时复用，避免重复计算。\n\n## Prefill 与 Decode\n\n- **Prefill**：处理输入序列，建立已有上下文的缓存。\n- **Decode**：逐个生成新 token，读取历史缓存并追加新内容。\n\n缓存节省计算，但也占用显存。请求变多、上下文变长时，缓存管理就会成为重要问题。\n\n## 接下来读什么\n\n可以从 vLLM 的缓存管理代码入手，再看看 SGLang 的前缀复用，以及 Mooncake 的缓存传输与存储。具体实现会随版本变化，阅读时记得记录 commit。\n\n```python\n# 简化的概念示意，不是实际模型接口\nfor token in output_tokens:\n    key, value = project(token)\n    kv_cache.append(key, value)\n```"},
		{ID: "station-design", Kind: "article", Title: "把个人主页，做成一间会回应的房间", Tags: "Build in public,Web", Body: "## 一个空间，几种入口\n\n博客是一面书架，项目是一张工作台，社区是一块公告板。把内容放回空间里，浏览就多了一点探索的感觉。\n\n## 让空间回应\n\n当访客问「有什么新文章」，助手搜索真实内容，再让书架亮起来。语言、内容与场景因此产生联系。\n\n## 保留直接的路径\n\n导航栏和快捷键始终可用。读文章时，内容面板展开；关闭它，又回到熟悉的房间。手机和不支持 WebGL 的设备也能通过普通界面访问所有内容。"},
		{ID: "welcome-lounge", Kind: "thread", Title: "新来的朋友，在这里打个招呼吧 👋", Tags: "闲聊", Body: "欢迎来到潘潘的小站！\n\n最近在折腾什么？看了什么有意思的项目？留下你的第一条回复吧。\n\n这是小站的初始欢迎帖。"},
		{ID: "source-reading", Kind: "thread", Title: "一起读源码：你想从哪个项目开始？", Tags: "技术交流", Body: "工作台上准备了 vLLM、SGLang、Mooncake、CacheLib、Folly 和 3FS 的入口。\n\n你更想研究推理调度、缓存管理、C++ 基础设施，还是分布式存储？欢迎分享阅读路线和问题。"},
	}
	tx, err := st.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, e := range es {
		date := now.Add(-time.Duration(i) * 24 * time.Hour).Format(time.RFC3339)
		if _, err = tx.Exec("INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?)", e.ID, e.Kind, e.Title, e.Body, e.Tags, "published", "owner", date, date); err != nil {
			return err
		}
	}
	return tx.Commit()
}
