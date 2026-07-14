# Mini Postman

一款轻量、离线优先的桌面 API 调试工具。无需登录或云同步，通过 Tauri 原生网络层发送请求，不受浏览器 CORS 限制。

> Mini Postman is a lightweight, local-first desktop API client built with React and Tauri 2.

> 本项目是独立社区项目，与 Postman, Inc. 及其产品不存在隶属、授权或官方关联。

## 功能特性

- 支持 `GET`、`POST`、`PUT`、`PATCH`、`DELETE` 和 `HEAD` 请求。
- 编辑查询参数、请求头以及 JSON、纯文本、`application/x-www-form-urlencoded` 请求体。
- 支持 Basic Auth、Bearer Token、API Key 和集合级认证继承。
- 支持环境、集合和全局变量，并按环境 > 集合 > 全局的优先级解析 `{{变量}}`。
- 展示响应状态、耗时、大小、响应头和格式化后的响应体。
- 管理多个工作区、集合、文件夹和已保存请求。
- 使用本地 SQLite 保存集合、请求历史、响应快照和应用设置。
- 从历史记录重新打开请求，或为当前请求生成 cURL 命令。
- 支持中文、英文界面以及多套深色和浅色主题。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面容器 | Tauri 2 |
| 前端 | React 18、TypeScript、Vite 6、Ant Design 5 |
| 原生端 | Rust、Reqwest、Tokio |
| 本地存储 | SQLite（Tauri SQL 插件） |

## 开发运行

### 环境要求

- Node.js 22 LTS（推荐）
- npm 10 或更高版本
- Rust stable 工具链
- 当前操作系统所需的 Tauri 系统依赖，详见[跨平台打包指南](docs/PACKAGING.md)

克隆并安装依赖：

```bash
git clone <your-repository-url>
cd mini-postman
npm ci
```

启动完整桌面应用：

```bash
npm run tauri dev
```

`npm run dev` 只会启动 Vite 前端。请求发送、SQLite 等功能依赖 Tauri，日常开发应使用 `npm run tauri dev`。

## 构建安装包

在当前操作系统上执行：

```bash
npm run tauri build
```

安装包默认生成在 `src-tauri/target/release/bundle/`。Windows、macOS、Linux 的前置依赖、产物类型、架构选择与签名说明见[跨平台打包指南](docs/PACKAGING.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run tauri dev` | 启动带热更新的桌面应用 |
| `npm run dev` | 仅启动 Vite 开发服务器 |
| `npm run build` | 执行 TypeScript 检查并构建前端 |
| `npm run preview` | 预览已构建的前端资源 |
| `npm run tauri build` | 构建原生程序和当前平台安装包 |

## 本地数据与隐私

- Mini Postman 不要求账户，也不会将工作区数据同步到云端。
- 应用数据保存在 Tauri 的应用数据目录中，数据库文件名为 `mini_postman.db`。
- 请求只会发往用户输入的目标地址；应用本身不依赖远程中转服务。
- 请求历史和认证配置会存入本机数据库。数据库当前未额外加密，请勿在不可信或多人共用设备上保存敏感凭据。
- Basic 密码、Bearer Token、API Key 值会以 JSON 明文写入 `auth_config`，历史记录中的请求快照也可能包含这些字段。`is_secret` 当前仅是数据标记，不提供加密能力。
- 单次响应体在原生网络层最多读取 5 MiB；历史记录每个工作区最多保留 200 条，每条响应快照最多保存 512 KiB。截断后的响应会在界面中明确标记。

## 项目结构

```text
mini-postman/
├─ src/                     React/TypeScript 前端
│  ├─ components/          请求、响应、侧边栏和布局组件
│  ├─ contexts/            工作区、标签页和环境状态
│  ├─ services/            SQLite、认证、变量与 Tauri 调用
│  └─ i18n/                中文和英文文案
├─ src-tauri/
│  ├─ src/commands/        HTTP 请求和 cURL 原生命令
│  ├─ migrations/          SQLite 数据库迁移
│  ├─ capabilities/        Tauri 权限配置
│  └─ tauri.conf.json      应用与安装包配置
└─ docs/                   构建和发布文档
```

## 发布到 GitHub

首次创建仓库、检查待提交文件、配置远程地址以及发布 Release 的步骤见[GitHub 发布指南](docs/GITHUB_PUBLISHING.md)。根目录已提供 `.gitignore`，不会提交依赖目录和本机构建产物。

## 当前范围

Mini Postman 当前面向 Windows、macOS 和 Linux 桌面端，支持 HTTP/HTTPS API 调试。账户系统、云同步、团队协作及 Postman 数据导入不在当前版本范围内。

## 参与贡献

欢迎通过 GitHub Issues 报告可复现的问题或提出功能建议。提交 Pull Request 前，请至少运行：

```bash
npm ci
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 许可证

仓库当前尚未添加开源许可证。公开发布前请由项目所有者选择并添加合适的许可证；在此之前，源代码默认保留全部权利。
