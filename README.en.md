# Guideng iOS

[中文](./README.md)

Guideng iOS is the iOS app wrapper for the Guideng frontend. It is built with React, Vite, and Capacitor. The app is designed for family location sharing: after signing in to a self-hosted Guideng server, it collects device location updates and sends them to the configured server.

## Version 2.0

- Reworked the iOS background reporting path to prevent duplicate uploads from native and WebView location services.
- Added time, distance, and accuracy filtering to reduce invalid tracks caused by stationary GPS drift.
- Tuned location accuracy and automatic pausing to reduce background battery and network usage.
- Kept compatibility with older native shells and added reporting limits to the fallback path.

## Features

- Wraps the existing Guideng frontend as an iOS app
- Collects device location and reports it to a Guideng server
- Uses a native background geolocation plugin for iOS background updates
- Shows devices, latest locations, and 7-day tracks
- Supports AMap display and external map links
- Supports Chinese and English UI

## Stack

- React 19
- Vite 8
- TypeScript
- Capacitor 7
- `@capacitor-community/background-geolocation`

## Requirements

- Node.js and npm
- macOS
- Xcode
- iOS device or simulator

Background location behavior should be fully verified on a real device. iOS requires user location permission, and continuous background location usually requires the user to choose “Always Allow”.

## Install

```sh
npm install
```

## Development Preview

```sh
npm run dev
```

The default Vite development port is `5173`.

## Build Frontend

```sh
npm run build
```

The built assets are emitted to `dist/`.

## Sync iOS Project

```sh
npm run cap:sync
```

This command builds the frontend first, then syncs `dist/` into the iOS project.

## Open iOS Project

```sh
npm run ios
```

This command syncs web assets and opens the Xcode project. In Xcode, configure the development team, bundle identifier, and signing certificate before running the app on a device.

## iOS Permissions

The project already configures the following keys in [Info.plist](./ios/App/App/Info.plist):

- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes` with `location`

The app can report location only after the user grants location permission. After sign-in, Guideng uses background location to continuously report this device position to the self-hosted server entered by the user for family location sharing. Even with background location enabled, iOS may still manage background execution according to system policy, battery state, and user settings.

## App Store Review Notes

If App Review asks about background location under Guideline 2.5.4, add this to the Notes field in App Review Information:

```text
Guideng is a family location sharing app. After the user signs in to their self-hosted Guideng server and grants Always location permission, the app continuously reports this device location to that configured server, including while the app is in the background. This is required so family members can see the device's latest location and recent track history without the user keeping the app open.
```

Also upload a physical-device screen recording that shows signing in, granting Always location permission, location sharing starting, the app moving to the background for a while, and the app or server view showing location updates continuing.

## Server Configuration

The login screen requires:

- Server URL
- Token

The app uses the server API to register the device, report location, read the device list, read tracks, and read map configuration. Data storage is controlled by the self-hosted Guideng server entered by the user.

## Scripts

```sh
npm run dev       # Start local development server
npm run build     # Build frontend
npm run preview   # Preview built assets
npm run cap:sync  # Build and sync iOS project
npm run ios       # Sync and open Xcode project
```

## Project Structure

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

## Privacy

After the user signs in and grants permission, Guideng collects the device location and sends device name, device ID, current location, accuracy, speed, heading, and timestamps to the self-hosted server entered by the user. Use the app only on devices you are authorized to use, and make sure every location-sharing participant is informed and has agreed.

## License

This project is licensed under the [MIT License](./LICENSE).
