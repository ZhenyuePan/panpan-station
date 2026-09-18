# 潘潘的小站

一套独立于旧 Next.js 博客的新站：React + Three.js 负责可探索的个人工作室，Go + SQLite 提供博客、论坛、QQ 登录、站长写作后台和小潘 Agent。

旧仓库 `ZhenyuePan.github.io` 不会被改动。它的 19 篇 MDX 已复制到 `legacy-content/`，服务首次启动时会将它们安全导入 SQLite；导入可重复执行，不会产生重复文章。

## 结构

```
web/              React 19 + Vite + React Three Fiber
main.go           同源 HTTP 服务与安全响应头
store.go          SQLite、博客、论坛、回复、点赞
auth.go           站长密钥与 QQ OAuth
agent.go          小潘：站内检索、导航、文章草稿工具
legacy.go          旧 MDX 导入器
legacy-content/   从旧站复制的文章快照
deploy/           systemd 部署单元
```

## 本地运行

```powershell
cd web
npm install
npm run build
cd ..
$env:PANPAN_IMPORT_DIR = 'legacy-content'
go run .
```

访问 `http://127.0.0.1:18080`。没有配置 DeepSeek 时，小潘会明确以本地导航/检索模式运行，不会假装调用模型。

## 配置

复制 `.env.example` 为 `.env`，然后只在服务器保存密钥：

- `PANPAN_SITE_URL`：最终 HTTPS 域名，例如 `https://panpan.example.com`。
- `QQ_APP_ID`、`QQ_APP_SECRET`、`QQ_ADMIN_OPENID`：QQ 互联审核完成后填写。回调地址为 `/api/auth/qq/callback`。
- `DEEPSEEK_API_KEY`：配置后使用 `DEEPSEEK_MODEL=deepseek-flash` 的 OpenAI 兼容 Chat Completions 接口。

若未设置 `PANPAN_ADMIN_KEY`，第一次启动会生成一个仅服务器可读的 `.data/admin.key`；登录站长后台时使用它。不要把它提交到 Git 或发到聊天里。

## 服务器部署

构建 Linux 二进制并上传项目到 `/home/ubuntu/workspace/panpan-station` 后：

```bash
sudo install -D -m 0644 deploy/panpan-station.service /etc/systemd/system/panpan-station.service
sudo systemctl daemon-reload
sudo systemctl enable --now panpan-station
sudo systemctl status panpan-station
```

服务默认只监听 `127.0.0.1:18080`。在域名、Nginx/Caddy 和 TLS 就绪前，使用 SSH 隧道预览；不要把明文站长后台直接暴露到公网。

## 验证

```powershell
go test ./...
cd web; npm run build
```

测试覆盖权限、CSRF、草稿隔离、论坛 CRUD、持久化、QQ state 防重放、Agent 工具边界、DeepSeek 工具循环和旧文章导入。
