# 归灯 iOS

[English](./README.en.md)

归灯 iOS 是归灯前端的 iOS App 封装版本，基于 React、Vite 和 Capacitor 构建。应用用于家人位置共享：用户登录自己的归灯服务端后，App 会获取设备位置信息，并将位置上报到用户配置的自建服务器。

## 2.0 更新说明

- 重构 iOS 后台位置上报链路，避免原生服务与 WebView 定位重复上传。
- 增加位置上报的时间、距离和精度过滤，减少静止漂移产生的无效轨迹。
- 调整定位精度与系统自动暂停策略，降低后台定位的电量和网络消耗。
- 保留旧版原生壳的兼容回退，并为回退链路增加上报限频。

## 功能

- iOS App 封装现有归灯前端页面
- 获取设备位置并上报到归灯服务端
- 使用原生后台定位插件支持 iOS 后台位置更新
- 展示设备列表、最近位置和 7 天轨迹
- 支持高德地图展示和外部地图跳转
- 支持中文和英文界面

## 技术栈

- React 19
- Vite 8
- TypeScript
- Capacitor 7
- `@capacitor-community/background-geolocation`

## 环境要求

- Node.js 和 npm
- macOS
- Xcode
- iOS 真机或模拟器

后台定位能力需要在真机上完整验证。iOS 会要求用户授予定位权限，后台持续定位通常需要用户选择“始终允许”。

## 安装依赖

```sh
npm install
```

## 开发预览

```sh
npm run dev
```

默认 Vite 开发端口为 `5173`。

## 构建前端

```sh
npm run build
```

构建产物输出到 `dist/`。

## 同步 iOS 工程

```sh
npm run cap:sync
```

该命令会先执行前端构建，再把 `dist/` 同步到 iOS 工程。

## 打开 iOS 工程

```sh
npm run ios
```

该命令会同步前端资源并打开 Xcode 工程。打开后需要在 Xcode 中配置开发团队、Bundle Identifier 和签名证书，然后选择设备运行。

## iOS 权限

工程已在 [Info.plist](./ios/App/App/Info.plist) 中配置：

- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes` 的 `location` 后台模式

应用只有在用户授予定位权限后才能上报位置。用户登录后，归灯会使用后台定位把本机位置持续上报到用户填写的自建服务器，用于家人位置共享。即使启用了后台定位，iOS 仍可能根据系统策略、电量状态和用户设置管理后台运行行为。

## App Store 审核说明

如果审核因为 Guideline 2.5.4 询问后台定位用途，请在 App Review Information 的 Notes 中说明：

```text
Guideng is a family location sharing app. After the user signs in to their self-hosted Guideng server and grants Always location permission, the app continuously reports this device location to that configured server, including while the app is in the background. This is required so family members can see the device's latest location and recent track history without the user keeping the app open.
```

同时需要上传一段真机录屏：登录 App、授予“始终”定位权限、开始共享位置、切到后台一段时间，再回到 App 或服务端页面展示位置仍在更新。

## 服务端配置

登录时需要填写：

- 服务端地址
- Token

App 会调用服务端接口注册设备、上报位置、读取设备列表、读取轨迹和读取地图配置。数据保存位置取决于用户填写的自建归灯服务端。

## 常用脚本

```sh
npm run dev       # 启动本地开发服务器
npm run build     # 构建前端
npm run preview   # 预览构建产物
npm run cap:sync  # 构建并同步 iOS 工程
npm run ios       # 同步并打开 Xcode 工程
```

## 目录结构

```text
.
├── capacitor.config.ts
├── ios/
│   └── App/
├── public/
├── src/
├── index.html
├── package.json
└── README.md
```

## 隐私说明

归灯会在用户登录并授权后获取设备位置，并把设备名称、设备标识、当前位置、精度、速度、方向和时间等信息发送到用户填写的自建服务器。请只在自己拥有权限的设备上使用，并确保参与位置共享的成员已知情并同意。

## 开源协议

本项目使用 [MIT License](./LICENSE)。
