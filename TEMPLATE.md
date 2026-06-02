# Tauri v2 + React 19 + TypeScript + HeroUI 高定桌面客户端模板
### 🚀 现代化、高性能、双色主题开箱即用的跨平台桌面应用样板工程

这是一个基于 **Tauri v2**、**React 19**、**TypeScript**、**Vite**、**Tailwind CSS v4** 和 **HeroUI** 构建的极高水准桌面应用样板工程（项目模板）。

它不仅封装了原生系统底层监控逻辑，更内置了一整套极具现代科技美学的 UI 框架与窗口机制，非常适合作为您下一个高质感桌面客户端的起跑点。

---

## ✨ 核心特性（已封装就绪）

1. **无边框高定窗口（Custom Titlebar & Frameless Window）**：
   * 采用自定义 HTML 标题栏，原生支持窗口无缝拖拽、关闭、最小化以及全功能事件响应。
2. **极净双色主题（Sleek Light/Dark Mode）**：
   * **彻底消除了 Tauri 经典的“底层窗口黑影透底”Bug**，亮色模式下使用 100% 不透明优雅浅灰底色搭配纯白高对比悬浮卡片；
   * 实色按钮与高阶文字对比度经过深度打磨，完美符合视觉无障碍与高端感官审美。
3. **极简扁平化单系统托盘（Unified System Tray）**：
   * 完全剥离了静态配置，采用 **Rust 编程式单托盘构建方案**，彻底杜绝了双重托盘或空白托盘的 Bug；
   * 通过 Rust 编译期 `include_bytes!` 宏**将高清 `.ico` 图标二进制嵌入程序内部**，即使绿色版单体文件脱离 assets 文件夹也绝不丢失图标；
   * 支持亮/暗色主题下 **Logo 自动智能反色（Auto-Invert）**，在侧边栏呈现无界扁平视觉体验。
4. **Rust 高性能系统数据桥接（IPC & Telemetry）**：
   * Rust 后端集成了高性能多线程系统指标收集器（CPU、内存、磁盘、网络、GPU），并通过 Tauri 强类型 Command 进行实时 IPC 桥接；
   * 前端配有 100% 纯手写、高性能 **HTML5 Canvas 渐变实时波形图**，渲染平滑且 CPU 占用极低。
5. **单实例运行约束（Single Instance Constraint）**：
   * 内置单实例检测插件，当用户尝试双击启动第二个程序时，会自动唤醒并聚焦到已在运行的窗口，防止重复启动。
6. **开机自启动（Autostart）**：
   * 原生集成开机自启插件，支持在设置面板中一键开关，无缝融入 Windows 启动项。

---

## 🛠️ 快速起步：基于本模板新建项目

要使用本模板创建您的新项目，只需遵循以下极简步骤：

### 第一步：克隆/复制本工程
直接将本文件夹复制为您的新项目目录，或在 GitHub 上点击 **"Use this template"**。

### 第二步：一键全局重命名（三处核心配置文件）
为了让您的新项目拥有独特的包名、产品名和描述，请在您的代码编辑器中搜索并修改以下三个文件中的相关元数据：

1. **前端配置文件**：[`package.json`](file:///d:/WinCatTaskManager/package.json)
   ```json
   {
     "name": "your-new-app-name",       // 改为您的新项目名称（小写、无空格）
     "version": "1.0.0"                 // 设定您的初始版本号
   }
   ```

2. **Rust 后端清单**：[`src-tauri/Cargo.toml`](file:///d:/WinCatTaskManager/src-tauri/Cargo.toml)
   ```toml
   [package]
   name = "your_new_app_name"           // 改为您的 Rust 内部 Crate 名称（蛇形下划线）
   version = "1.0.0"                    // 设定您的 Rust 部分版本号
   description = "Your App Description" // 您的程序描述
   ```

3. **Tauri 综合配置文件**：[`src-tauri/tauri.conf.json`](file:///d:/WinCatTaskManager/src-tauri/tauri.conf.json)
   ```json
   {
     "productName": "Your Product Name",  // 改为您的最终客户端产品名称（可带空格，如 "My Cool App"）
     "version": "1.0.0",                 // 设定桌面安装包生成的版本号
     "identifier": "com.yourdomain.app", // 极其重要！更改为您的独立开发者唯一标识符，这会影响安装路径和自启动项
     "app": {
       "windows": [
         {
           "title": "Your Product Name"   // 改为默认窗口标题
         }
       ]
     }
   }
   ```

### 第三步：替换品牌图标 (Icons)
* 将您的新 Logo 导出为 PNG/ICO 格式。
* 覆盖替换 [`src-tauri/icons/`](file:///d:/WinCatTaskManager/src-tauri/icons/) 下的相关图标文件，重点是：
  * `icon.png`：用于主程序和各种平台图标；
  * `icon.ico`：Windows 托盘与可执行程序图标（这会被 Rust 自动读取并内嵌编译）。

### 第四步：安装并启动开发
打开终端进入新项目目录，执行以下命令：

```bash
# 1. 安装前端所有依赖库
pnpm install

# 2. 启动热重载开发沙盒（支持前端与 Rust 后端同步热重载）
pnpm tauri dev
```

### 第五步：打包编译生产环境发行版
当您的应用开发完毕需要发布时，只需运行：

```bash
pnpm tauri build
```
编译完成后，Tauri 会在 `src-tauri/target/release/bundle/` 目录下自动生成：
* **`.exe` (NSIS 一键静默安装包)**
* **`.msi` (微软 MSI 标准分发安装包)**
* **`catinfo.exe` (绿色免安装单体版)**

---

## 📂 项目目录树指南

```text
├── src/                      # 前端 React 19 应用源代码
│   ├── assets/               # 静态资源与字体
│   ├── components/           # UI 选项卡组件 (Telemetry, Process, Network, Settings)
│   ├── hooks/                # 业务 Hooks (数据采集器、系统状态管理)
│   ├── App.tsx               # 应用主框架与侧边栏布局
│   ├── index.css             # 全局设计系统样式（包含双主题配色系统）
│   └── main.tsx              # React 入口
├── src-tauri/                # Rust 后端桌面底层代码
│   ├── icons/                # 应用与系统托盘图标（会被 Rust 静态编译内嵌）
│   ├── src/                  # Rust 源码
│   │   ├── collector.rs      # 多线程硬件数据高频轮询采集器
│   │   ├── sys_info.rs       # 硬件状态解析器（系统级 API）
│   │   ├── process.rs        # 进程读取、树形终止与提权控制逻辑
│   │   └── lib.rs            # Tauri 命令注册、窗口无边框拦截与单托盘构建核心
│   ├── Cargo.toml            # Rust 依赖与功能特性配置
│   └── tauri.conf.json       # Tauri 打包及运行时声明配置文件
├── package.json              # 前端配置与脚本入口
└── TEMPLATE.md               # 本模板开发指南
```

祝您在新模板的加持下，开发出下一款惊艳世人的高定桌面应用程序！🚀
