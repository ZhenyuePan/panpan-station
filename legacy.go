package main

// The importer reads a copy of the former Next.js MDX posts. It never touches
// the old repository and can run repeatedly without creating duplicate posts.
import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type legacyPost struct{ ID, Title, Body, Tags, Created string }

func legacyID(name string) string {
	sum := sha256.Sum256([]byte(name))
	return "legacy-" + hex.EncodeToString(sum[:])[:12]
}
func frontmatter(src string) (map[string]string, string, bool) {
	src = strings.ReplaceAll(src, "\r\n", "\n")
	if !strings.HasPrefix(src, "---\n") {
		return nil, "", false
	}
	end := strings.Index(src[4:], "\n---\n")
	if end < 0 {
		return nil, "", false
	}
	end += 4
	meta := map[string]string{}
	for _, line := range strings.Split(src[4:end], "\n") {
		if k, v, ok := strings.Cut(line, ":"); ok {
			meta[strings.TrimSpace(k)] = strings.Trim(strings.TrimSpace(v), "\"'")
		}
	}
	return meta, src[end+5:], true
}
func legacyDate(s string) string {
	for _, layout := range []string{"2006-1-2", "2006-01-02", time.RFC3339} {
		if d, err := time.Parse(layout, strings.TrimSpace(s)); err == nil {
			return d.UTC().Add(12 * time.Hour).Format(time.RFC3339)
		}
	}
	return time.Now().UTC().Format(time.RFC3339)
}
func legacyTags(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "bitcask"):
		return "旧站归档,存储,Bitcask"
	case strings.Contains(lower, "tiny"):
		return "旧站归档,C++,WebServer"
	case strings.Contains(lower, "824") || strings.Contains(lower, "mapreduce"):
		return "旧站归档,分布式系统,MIT 6.824"
	case strings.Contains(lower, "linux"):
		return "旧站归档,Linux"
	default:
		return "旧站归档,学习笔记"
	}
}
func cleanLegacyBody(body string) string {
	lines := strings.Split(body, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "![") && (strings.Contains(line, `:\`) || strings.Contains(line, `:/`)) {
			continue
		}
		out = append(out, line)
	}
	return strings.TrimSpace(strings.Join(out, "\n"))
}
func readLegacy(dir string) ([]legacyPost, error) {
	files, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	posts := make([]legacyPost, 0, len(files))
	for _, f := range files {
		if f.IsDir() || filepath.Ext(f.Name()) != ".mdx" {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, f.Name()))
		if err != nil {
			return nil, err
		}
		meta, body, ok := frontmatter(string(raw))
		if !ok {
			continue
		}
		title, body := strings.TrimSpace(meta["title"]), cleanLegacyBody(body)
		if len([]rune(title)) < 2 || len([]rune(body)) < 2 {
			continue
		}
		posts = append(posts, legacyPost{ID: legacyID(f.Name()), Title: title, Body: body, Tags: legacyTags(f.Name()), Created: legacyDate(meta["publishedAt"])})
	}
	return posts, nil
}
func (st *store) importLegacy(dir string) (int, error) {
	posts, err := readLegacy(dir)
	if err != nil {
		return 0, err
	}
	tx, err := st.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	n := 0
	for _, p := range posts {
		res, err := tx.Exec("INSERT OR IGNORE INTO entries(id,kind,title,body,tags,status,author_id,created,updated) VALUES(?,?,?,?,?,'published','owner',?,?)", p.ID, "article", p.Title, p.Body, p.Tags, p.Created, p.Created)
		if err != nil {
			return 0, fmt.Errorf("%s: %w", p.Title, err)
		}
		added, _ := res.RowsAffected()
		n += int(added)
	}
	return n, tx.Commit()
}
