# GitHub 发布指南

本文包含首次将项目推送到 GitHub，以及后续创建版本 Release 的基本流程。示例中的 `<owner>`、仓库地址和版本号需要替换为实际值。

## 1. 发布前检查

确认依赖和构建可以从锁文件复现：

```bash
npm ci
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

提交前还应检查：

- `git status` 中没有 `node_modules/`、`dist/`、`src-tauri/target/`、日志或本机数据库。
- 源码和文档中没有 API Token、密码、私钥、签名证书或真实业务接口凭据。
- `src-tauri/Cargo.toml` 中的 `authors` 已替换为项目维护者信息。
- 已由项目所有者选择并添加开源许可证。没有许可证的公开仓库默认保留全部权利。
- README 中的功能描述和当前版本一致。

根目录 `.gitignore` 已排除常见依赖、构建产物、编辑器缓存和系统临时文件。
项目当前使用的 `src-tauri/.cargo/config.toml` 包含开发者本机的 `rsproxy.cn` Cargo 镜像配置，也已被忽略；这样不会强制 GitHub Contributors 或 CI 使用特定地区的镜像。需要该镜像的开发者可继续保留自己的本地文件。

## 2. 初始化本地仓库

如果当前目录还不是 Git 仓库：

```bash
git init -b main
git add .
git status
git commit -m "chore: prepare Mini Postman for GitHub"
```

务必在执行 `git commit` 前检查 `git status`，尤其不要提交 `src-tauri/target/` 和任何凭据。

## 3. 创建并推送 GitHub 仓库

### 使用 GitHub 网页

1. 在 GitHub 新建名为 `mini-postman` 的空仓库。
2. 如果本地已经有 README、`.gitignore`，创建仓库时不要再次生成这些文件。
3. 添加远程地址并推送：

```bash
git remote add origin https://github.com/<owner>/mini-postman.git
git push -u origin main
```

使用 SSH 时，将远程地址改为：

```bash
git remote add origin git@github.com:<owner>/mini-postman.git
```

### 使用 GitHub CLI

已安装并登录 `gh` 时，可以直接创建公开仓库并推送：

```bash
gh auth login
gh repo create mini-postman --public --source=. --remote=origin --push
```

项目暂不公开时，将 `--public` 改为 `--private`。

## 4. 准备版本发布

发布前同步以下文件中的版本号：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

然后更新锁文件并验证：

```bash
npm install --package-lock-only
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

按照[跨平台打包指南](PACKAGING.md)分别在 Windows、macOS、Linux 上生成并实际安装测试对应产物。

## 5. 创建标签与 Release

提交版本变更后创建带注释的标签：

```bash
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: release v0.1.0"
git tag -a v0.1.0 -m "Mini Postman v0.1.0"
git push origin main
git push origin v0.1.0
```

在 GitHub 仓库的 **Releases** 页面选择 **Draft a new release**，选择刚推送的标签并上传安装包。建议至少提供：

- Windows x64：NSIS `.exe` 或 `.msi`
- macOS：已签名和公证的 Universal `.dmg`，或分别提供 arm64/x64 文件
- Linux x64：`.AppImage`，并按需提供 `.deb`、`.rpm`
- 每个产物的 SHA-256 校验值
- 本版本的重要变更、升级说明和已知问题

也可以使用 GitHub CLI：

```bash
gh release create v0.1.0 <artifact-files...> --generate-notes --title "Mini Postman v0.1.0"
```

## 6. 推荐的仓库设置

- 开启 Issues，用于缺陷与功能需求跟踪。
- 为 `main` 配置分支保护，要求 Pull Request 和构建检查通过后再合并。
- 开启 Dependabot 或其他依赖更新机制。
- 在仓库 About 中填写简介、主题标签和实际 Release 下载入口。
- 后续增加 GitHub Actions，在三个原生 runner 上构建；代码签名密钥只存放在 GitHub Actions Secrets 中。

不要把签名证书、私钥、Apple 密码或 Token 直接写入工作流文件或提交到仓库。
