# 跨平台打包指南

Mini Postman 使用 Tauri 2 打包桌面应用。Tauri 依赖各操作系统的原生工具链，因此推荐在目标系统上构建对应安装包；不要默认认为在一台机器上可以完整交叉打包三个平台。

## 通用准备

所有平台都需要：

- Node.js 22 LTS（推荐；Vite 6 也支持 Node.js 20.x）
- npm 10 或更高版本
- Rust stable 工具链，可通过 [rustup](https://rustup.rs/) 安装
- Git

首次构建：

```bash
git clone <your-repository-url>
cd mini-postman
npm ci
rustup update stable
npm run tauri build
```

`tauri.conf.json` 中的 `bundle.targets` 当前为 `all`，因此最后一条命令会尝试生成当前平台支持的全部安装包。只需要一种格式时，可以通过 `--bundles` 缩短构建时间。

## Windows

### 前置依赖

1. 安装 [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)。在安装器中勾选“使用 C++ 的桌面开发”，并包含 Windows 10/11 SDK。
2. 安装或确认系统已有 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。现代 Windows 10/11 通常已经预装。
3. 安装 Rust 的 MSVC 工具链：

```powershell
rustup default stable-msvc
```

Windows 11 24H2 及更新版本在构建 MSI 时还可能需要 **VBScript** 可选功能（WiX 工具链依赖）。如果默认构建在 MSI 阶段报 `light.exe` 相关错误，可在“设置 → 系统 → 可选功能”中添加 VBScript，或改为只构建 NSIS。

### 构建

生成当前平台全部安装包：

```powershell
npm ci
npm run tauri build
```

也可以只生成指定格式：

```powershell
npm run tauri build -- --bundles nsis
npm run tauri build -- --bundles msi
```

产物通常位于：

```text
src-tauri/target/release/mini-postman.exe
src-tauri/target/release/bundle/nsis/*.exe
src-tauri/target/release/bundle/msi/*.msi
```

- NSIS `.exe` 适合普通用户交互式安装。
- MSI 适合企业部署和软件分发系统。
- 未签名安装包可能触发 SmartScreen 警告；正式公开分发时建议配置 Windows 代码签名证书。

## macOS

macOS 安装包必须在 macOS 上构建。

### 前置依赖

安装 Xcode Command Line Tools：

```bash
xcode-select --install
```

然后安装或更新 Node.js、npm 与 Rust stable。

### 构建当前架构

```bash
npm ci
npm run tauri build
```

在 Apple Silicon 机器上默认生成 ARM64 产物，在 Intel Mac 上默认生成 x86_64 产物。产物通常位于：

```text
src-tauri/target/release/bundle/macos/*.app
src-tauri/target/release/bundle/dmg/*.dmg
```

### 构建 Universal Binary

需要同时安装两个 Rust target：

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

指定 `--target` 后，产物目录会包含 target 名称，例如：

```text
src-tauri/target/universal-apple-darwin/release/bundle/
```

公开分发给其他用户时，应使用 Apple Developer 证书完成代码签名和 notarization。未签名或未公证的应用可能被 Gatekeeper 阻止；仅在本机开发验证时可使用未签名构建。

## Linux

Linux 安装包应在与目标用户相近的发行版和较旧的兼容基线上构建。不同发行版的 WebKitGTK 和系统库版本可能影响兼容性。

### Debian / Ubuntu

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Fedora

```bash
sudo dnf group install "C Development Tools and Libraries"
sudo dnf install \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

### Arch Linux

```bash
sudo pacman -Syu
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg
```

### 构建

```bash
npm ci
npm run tauri build
```

只构建某一种包：

```bash
npm run tauri build -- --bundles appimage
npm run tauri build -- --bundles deb
npm run tauri build -- --bundles rpm
```

产物通常位于：

```text
src-tauri/target/release/mini-postman
src-tauri/target/release/bundle/appimage/*.AppImage
src-tauri/target/release/bundle/deb/*.deb
src-tauri/target/release/bundle/rpm/*.rpm
```

| 格式 | 推荐场景 |
| --- | --- |
| AppImage | 不依赖系统包管理器的便携分发 |
| DEB | Debian、Ubuntu 及其衍生发行版 |
| RPM | Fedora、RHEL、openSUSE 等 RPM 系发行版 |

AppImage 仍依赖宿主系统内核和部分运行时能力，并不保证兼容所有 Linux 发行版。部分系统需要额外安装 FUSE 2 才能直接启动；遇到兼容问题时应同时提供对应发行版的 DEB 或 RPM。

## 架构说明

- 在普通构建中，产物架构与构建机器一致。
- Windows ARM64、Linux ARM64 等目标需要对应 Rust target、原生编译器和系统依赖；不能只添加一个 Rust target 就保证完成交叉打包。
- 最稳妥的发布方式是在 GitHub Actions 中使用 `windows-latest`、`macos-latest` 和 `ubuntu-latest` 三种原生 runner 分别构建。
- macOS 若同时支持 Intel 和 Apple Silicon，优先发布 Universal Binary，或明确分别标注 `x64` 与 `arm64`。

## 发布前同步版本号

发布新版本时，以下三个文件的版本号必须保持一致：

- `package.json` 的 `version`
- `src-tauri/tauri.conf.json` 的 `version`
- `src-tauri/Cargo.toml` 的 `package.version`

修改后运行：

```bash
npm install --package-lock-only
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

提交更新后的 `package-lock.json` 和 `src-tauri/Cargo.lock`，再在各目标系统上构建安装包。

## 发布前检查

1. 使用 `npm ci` 验证锁文件可以完成干净安装。
2. 运行 `npm run build`，确认 TypeScript 与前端生产构建通过。
3. 运行 `cargo check --manifest-path src-tauri/Cargo.toml`。
4. 在目标系统运行 `npm run tauri build`。
5. 安装生成的安装包，验证启动、发起请求、保存历史和重新打开应用。
6. 检查安装包文件名、版本号和 CPU 架构是否清晰。
7. 对公开发布的 Windows/macOS 产物完成代码签名；保存哈希值以便下载者校验。

生成 SHA-256：

```powershell
# Windows PowerShell
Get-FileHash .\path\to\installer.exe -Algorithm SHA256
```

```bash
# macOS
shasum -a 256 path/to/artifact
```

```bash
# Linux
sha256sum path/to/artifact
```

## 常见问题

### 只运行 `npm run dev` 后请求功能不可用

这是预期行为。Vite 开发服务器没有 Tauri 原生命令和 SQLite 插件，请改用：

```bash
npm run tauri dev
```

### Linux 报错找不到 WebKitGTK 或 `webkit2gtk-4.1`

确认安装的是 WebKitGTK 4.1 的开发包，而不是仅安装运行时；包名因发行版而异，可参考上面的系统依赖列表。

### Windows 构建时报 `link.exe` 或 Windows SDK 缺失

重新打开 Visual Studio Installer，确认已经安装“使用 C++ 的桌面开发”、MSVC 工具集和 Windows SDK，随后重新打开终端。

### macOS 构建成功但其他电脑无法打开

公开分发需要正确的签名、公证和 stapling。开发机上的未签名 `.app` 能运行，不代表可直接分发给其他用户。
