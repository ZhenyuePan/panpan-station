package main

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *server) user(r *http.Request) *user {
	c, err := r.Cookie("panpan_session")
	if err != nil || len(c.Value) != 64 {
		return nil
	}
	var u user
	err = s.store.db.QueryRow("SELECT u.id,u.name,u.avatar,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?", hash(c.Value), time.Now().Unix()).Scan(&u.ID, &u.Name, &u.Avatar, &u.Role)
	if err != nil {
		return nil
	}
	return &u
}
func (s *server) require(w http.ResponseWriter, r *http.Request, admin bool) *user {
	u := s.user(r)
	if u == nil {
		fail(w, 401, "先登录，再一起参与讨论吧")
		return nil
	}
	if admin && u.Role != "admin" {
		fail(w, 403, "这里是潘潘的专属工作台")
		return nil
	}
	return u
}
func (s *server) cookie(w http.ResponseWriter, name, value string, age int) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", MaxAge: age, HttpOnly: true, Secure: strings.HasPrefix(s.cfg.SiteURL, "https://"), SameSite: http.SameSiteLaxMode})
}
func (s *server) session(w http.ResponseWriter, uid string) error {
	token := randomID()
	_, err := s.store.db.Exec("INSERT INTO sessions VALUES(?,?,?)", hash(token), uid, time.Now().Add(7*24*time.Hour).Unix())
	if err != nil {
		return err
	}
	s.cookie(w, "panpan_session", token, 7*86400)
	_, _ = s.store.db.Exec("DELETE FROM sessions WHERE expires<?", time.Now().Unix())
	return nil
}
func (s *server) adminLogin(w http.ResponseWriter, r *http.Request) {
	if !s.rate("login:"+ip(r), 8, 15*time.Minute) {
		fail(w, 429, "尝试次数过多，请 15 分钟后重试")
		return
	}
	var in struct {
		Key string `json:"key"`
	}
	if !decode(w, r, &in) {
		return
	}
	if subtle.ConstantTimeCompare([]byte(hash(strings.TrimSpace(in.Key))), []byte(hash(s.cfg.AdminKey))) != 1 {
		fail(w, 401, "站长密钥不正确")
		return
	}
	if err := s.session(w, "owner"); err != nil {
		s.dbError(w, err)
		return
	}
	respond(w, 200, user{ID: "owner", Name: "潘潘", Role: "admin"})
}
func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("panpan_session"); err == nil {
		_, _ = s.store.db.Exec("DELETE FROM sessions WHERE token=?", hash(c.Value))
	}
	s.cookie(w, "panpan_session", "", -1)
	respond(w, 200, map[string]bool{"ok": true})
}
func (s *server) qqLogin(w http.ResponseWriter, r *http.Request) {
	if s.cfg.QQID == "" || s.cfg.QQSecret == "" {
		fail(w, 503, "QQ 登录将在域名与应用审核完成后开放")
		return
	}
	state := randomID()
	_, _ = s.store.db.Exec("DELETE FROM oauth_states WHERE expires<?", time.Now().Unix())
	if _, err := s.store.db.Exec("INSERT INTO oauth_states VALUES(?,?)", hash(state), time.Now().Add(10*time.Minute).Unix()); err != nil {
		s.dbError(w, err)
		return
	}
	s.cookie(w, "panpan_oauth", state, 600)
	q := url.Values{"response_type": {"code"}, "client_id": {s.cfg.QQID}, "redirect_uri": {s.cfg.SiteURL + "/api/auth/qq/callback"}, "scope": {"get_user_info"}, "state": {state}}
	http.Redirect(w, r, "https://graph.qq.com/oauth2.0/authorize?"+q.Encode(), 302)
}
func (s *server) getJSON(r *http.Request, endpoint string, out any) error {
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	res, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("QQ network error")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("QQ HTTP %d", res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out)
}
func (s *server) qqCallback(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("panpan_oauth")
	state := r.URL.Query().Get("state")
	if err != nil || len(state) != 64 || subtle.ConstantTimeCompare([]byte(state), []byte(c.Value)) != 1 {
		fail(w, 400, "登录校验失效，请重新发起 QQ 登录")
		return
	}
	s.cookie(w, "panpan_oauth", "", -1)
	res, err := s.store.db.Exec("DELETE FROM oauth_states WHERE token=? AND expires>?", hash(state), time.Now().Unix())
	if err != nil {
		s.dbError(w, err)
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 || s.cfg.QQID == "" || s.cfg.QQSecret == "" || r.URL.Query().Get("code") == "" {
		fail(w, 400, "登录已取消或已过期")
		return
	}
	q := url.Values{"grant_type": {"authorization_code"}, "client_id": {s.cfg.QQID}, "client_secret": {s.cfg.QQSecret}, "code": {r.URL.Query().Get("code")}, "redirect_uri": {s.cfg.SiteURL + "/api/auth/qq/callback"}, "fmt": {"json"}, "need_openid": {"1"}}
	var tok struct {
		AccessToken string `json:"access_token"`
		OpenID      string `json:"openid"`
	}
	if s.getJSON(r, "https://graph.qq.com/oauth2.0/token?"+q.Encode(), &tok) != nil || tok.AccessToken == "" || tok.OpenID == "" {
		fail(w, 502, "QQ 授权失败，请重试")
		return
	}
	var profile struct {
		Ret      int    `json:"ret"`
		Nickname string `json:"nickname"`
		Avatar   string `json:"figureurl_qq_2"`
	}
	q = url.Values{"access_token": {tok.AccessToken}, "oauth_consumer_key": {s.cfg.QQID}, "openid": {tok.OpenID}}
	if s.getJSON(r, "https://graph.qq.com/user/get_user_info?"+q.Encode(), &profile) != nil || profile.Ret != 0 || profile.Nickname == "" {
		fail(w, 502, "获取 QQ 资料失败")
		return
	}
	uid := "qq:" + hash(s.cfg.QQID + ":" + tok.OpenID)[:32]
	role := "member"
	if s.cfg.QQAdmin != "" && tok.OpenID == s.cfg.QQAdmin {
		role = "admin"
	}
	if !strings.HasPrefix(profile.Avatar, "https://") {
		profile.Avatar = ""
	}
	_, err = s.store.db.Exec("INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar=excluded.avatar,role=excluded.role", uid, profile.Nickname, profile.Avatar, role)
	if err != nil {
		s.dbError(w, err)
		return
	}
	if err = s.session(w, uid); err != nil {
		s.dbError(w, err)
		return
	}
	http.Redirect(w, r, "/", 302)
}
