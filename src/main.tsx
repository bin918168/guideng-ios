import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BackgroundGeolocationPlugin, CallbackError, Location as NativeLocation } from '@capacitor-community/background-geolocation';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ExternalLink, Languages, LocateFixed, LogOut, MapPinned, RefreshCw, Route, Save, Server, Smartphone } from 'lucide-react';
import './styles.css';

type Lang = 'zh' | 'en';

type Device = {
  id: string;
  name: string;
  platform?: string | null;
  created_at: string;
  updated_at: string;
  last_location?: Location | null;
};

type Location = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  battery_level?: number | null;
  captured_at: string;
  received_at: string;
};

type Session = {
  serverUrl: string;
  token: string;
  deviceId: string;
  deviceName: string;
};

type RuntimeInfo = {
  isNative: boolean;
  platform: string;
};

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  captured_at: string;
};

type AppConfig = {
  provider: 'amap';
  amap_web_js_api_key?: string | null;
  amap_web_js_security_code?: string | null;
  amap_android_key?: string | null;
  amap_ios_key?: string | null;
};

type RawAppConfig = Partial<AppConfig> & Record<string, unknown>;

type GuidengLocationPermissionPlugin = {
  requestWhenInUse(): Promise<{ status: 'authorizedAlways' | 'authorizedWhenInUse' }>;
  requestAlways(): Promise<{ status: 'authorizedAlways' | 'authorizedWhenInUse' }>;
};

type GuidengBackgroundLocationPlugin = {
  configure(options: { serverUrl: string; token: string; deviceId: string }): Promise<void>;
  stop(): Promise<void>;
};

declare global {
  interface Window {
    AMap?: any;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

const storageKey = 'guideng.session';
const langKey = 'guideng.lang';
const locationPromptKey = 'guideng.location_prompt_shown';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
const GuidengLocationPermission = registerPlugin<GuidengLocationPermissionPlugin>('GuidengLocationPermission');
const GuidengBackgroundLocation = registerPlugin<GuidengBackgroundLocationPlugin>('GuidengBackgroundLocation');

const i18n = {
  zh: {
    app: '归灯',
    subtitle: '家人位置共享',
    serverUrl: '服务器网址',
    token: 'Token',
    deviceName: '设备名称',
    login: '进入',
    loginConsent: '我已阅读并同意隐私规则和使用许可协议',
    privacyTitle: '隐私规则',
    privacyText:
      '归灯会在你登录后请求定位权限，并把设备名称、设备标识、当前位置、精度、速度、方向、时间和最近 7 天轨迹发送到你填写的自建服务器。iOS 授予“始终”定位权限后，归灯可在后台持续共享本机位置，用于家人位置共享。数据由你的服务器保存，应用不会把数据发送到其他归灯官方服务。FM619 TECHNOLOG 联系方式：4722522@gmail.com。',
    licenseTitle: '使用许可协议',
    licenseText:
      '你应只在自己拥有权限的设备上使用归灯，并确保参与共享位置的家人知情同意。你需要自行保管服务器地址和 Token；任何持有 Token 的人都可能访问位置数据。归灯按现状提供，不承诺适用于紧急救援、医疗、执法或其他高风险场景。FM619 TECHNOLOG 联系方式：4722522@gmail.com。',
    logout: '退出',
    locating: '定位中',
    sharing: '正在共享',
    paused: '未共享',
    refresh: '刷新',
    save: '保存',
    editName: '改名',
    provider: '地图',
    openMap: '打开地图',
    mapKeyMissing: '请先在服务端配置高德 Web JS API Key。',
    mapLoading: '地图加载中',
    track: '轨迹',
    trackPoints: '轨迹点',
    accuracy: '精度',
    updated: '更新',
    noLocation: '还没有位置',
    nativePermissionHint: 'iOS 需要定位权限；如需后台持续上报，请在系统定位设置中允许“始终”。',
    webPermissionHint: '浏览器需要位置权限；移动端正式部署通常需要 HTTPS。',
    nativeLocationError: '无法启动 iOS 后台定位，请检查系统定位权限是否允许“始终”。',
    webLocationError: '当前浏览器无法获取定位。',
    invalidServerUrl: '服务器网址不正确，请填写 http:// 或 https:// 开头的网址。',
    errorPrefix: '出错了',
    locationPromptTitle: '后台位置共享',
    locationPromptBody1: '归灯使用定位来把本机位置共享到你配置的服务器，让家人了解彼此所在。',
    locationPromptBody2: '后台持续共享需要 iOS 定位权限设置为“始终”。你可以在系统弹窗中选择权限级别。',
    locationPromptBody3: '你可以随时前往「设置 → 隐私与安全性 → 定位服务 → 归灯」修改此设置。',
    locationPromptContinue: '继续',
    locationPromptAlwaysTitle: '后台共享设置',
    locationPromptAlwaysBody: '如果你希望归灯在后台继续共享本机位置，iOS 可能会再次显示定位权限弹窗。',
    locationPromptAlwaysContinue: '下一步',
  },
  en: {
    app: 'Guideng',
    subtitle: 'Family location sharing',
    serverUrl: 'Server URL',
    token: 'Token',
    deviceName: 'Device name',
    login: 'Enter',
    loginConsent: 'I have read and agree to the privacy rules and license agreement',
    privacyTitle: 'Privacy Rules',
    privacyText:
      'After login, Guideng requests location permission and sends device name, device ID, current location, accuracy, speed, heading, timestamps, and the latest 7 days of tracks to the self-hosted server you enter. When Always location permission is granted on iOS, Guideng can continue sharing this device location in the background for family location sharing. The data is stored by your server. The app does not send data to any official Guideng service. FM619 TECHNOLOG Contact: 4722522@gmail.com.',
    licenseTitle: 'License Agreement',
    licenseText:
      'Use Guideng only on devices you are authorized to use, and make sure family members who share location are informed and have agreed. You are responsible for protecting the server URL and token; anyone with the token may access location data. Guideng is provided as is and is not intended for emergency rescue, medical, law enforcement, or other high-risk use. FM619 TECHNOLOG Contact: 4722522@gmail.com.',
    logout: 'Log out',
    locating: 'Locating',
    sharing: 'Sharing',
    paused: 'Not sharing',
    refresh: 'Refresh',
    save: 'Save',
    editName: 'Rename',
    provider: 'Map',
    openMap: 'Open map',
    mapKeyMissing: 'Configure the AMap Web JS API key on the server first.',
    mapLoading: 'Loading map',
    track: 'Track',
    trackPoints: 'Track points',
    accuracy: 'Accuracy',
    updated: 'Updated',
    noLocation: 'No location yet',
    nativePermissionHint: 'iOS location permission is required. For continuous background reporting, allow Always in system location settings.',
    webPermissionHint: 'Location permission is required; production mobile deployments usually need HTTPS.',
    nativeLocationError: 'Unable to start iOS background location updates. Check that location permission is set to Always.',
    webLocationError: 'Location is not available in this browser.',
    invalidServerUrl: 'Enter a valid server URL beginning with http:// or https://.',
    errorPrefix: 'Error',
    locationPromptTitle: 'Background Location Sharing',
    locationPromptBody1: 'Guideng uses location to share this device position with your configured server so family members can see each other.',
    locationPromptBody2: 'Continuous background sharing requires iOS location access to be set to Always. You can choose the permission level in the system dialogs.',
    locationPromptBody3: 'You can change this at any time in Settings → Privacy & Security → Location Services → Guideng.',
    locationPromptContinue: 'Continue',
    locationPromptAlwaysTitle: 'Background Sharing Setup',
    locationPromptAlwaysBody: 'If you want Guideng to keep sharing this device location in the background, iOS may show another location permission dialog.',
    locationPromptAlwaysContinue: 'Next',
  },
} satisfies Record<Lang, Record<string, string>>;

function App() {
  const runtime = useMemo<RuntimeInfo>(() => ({ isNative: Capacitor.isNativePlatform(), platform: Capacitor.getPlatform() }), []);
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(langKey) as Lang) || preferredLang());
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig | null | undefined>(undefined);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [tracks, setTracks] = useState<Location[]>([]);
  const [editingName, setEditingName] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'sharing'>('idle');
  const [error, setError] = useState('');
  const t = i18n[lang];

  useEffect(() => {
    localStorage.setItem(langKey, lang);
  }, [lang]);

  useEffect(() => {
    if (!session || showLocationPrompt) return;
    setEditingName(session.deviceName);
    registerDevice(session)
      .then(() => Promise.all([refreshDevices(session), refreshConfig(session)]))
      .catch(showError);
  }, [session, showLocationPrompt]);

  useEffect(() => {
    if (!session || !selectedDeviceId) return;
    refreshTracks(session, selectedDeviceId).catch(showError);
  }, [session, selectedDeviceId]);

  useEffect(() => {
    if (!session || showLocationPrompt) return;
    const activeSession = session;
    let cancelled = false;
    let stopLocationSharing: (() => void | Promise<void>) | null = null;

    async function startLocationSharing() {
      setStatus('locating');
      stopLocationSharing = runtime.isNative
        ? await startNativeLocationSharing(activeSession, handleLocationShared, handleLocationError)
        : startBrowserLocationSharing(activeSession, handleLocationShared, handleLocationError);
    }

    async function handleLocationShared() {
      if (cancelled) return;
      setStatus('sharing');
      await refreshDevices(activeSession);
      setError('');
    }

    function handleLocationError(err: unknown) {
      if (cancelled) return;
      setStatus('idle');
      showError(locationErrorMessage(err, runtime.isNative, t));
    }

    startLocationSharing().catch(handleLocationError);

    const timer = window.setInterval(() => refreshDevices(activeSession).catch(showError), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void stopLocationSharing?.();
    };
  }, [runtime.isNative, session, showLocationPrompt, t]);

  async function refreshDevices(activeSession = session) {
    if (!activeSession) return;
    const nextDevices = await api<Device[]>(activeSession, '/api/devices');
    setDevices(nextDevices);
    setSelectedDeviceId((current) => current || newestLocatedDevice(nextDevices)?.id || nextDevices[0]?.id || '');
  }

  async function refreshTracks(activeSession = session, deviceId = selectedDeviceId) {
    if (!activeSession || !deviceId) return;
    const nextTracks = await api<Location[]>(activeSession, `/api/devices/${deviceId}/tracks?days=7`);
    setTracks(nextTracks);
  }

  async function refreshConfig(activeSession = session) {
    if (!activeSession) return;
    try {
      const nextConfig = await api<RawAppConfig>(activeSession, '/api/config');
      setAppConfig(normalizeAppConfig(nextConfig));
    } catch (err) {
      setAppConfig(null);
      throw err;
    }
  }

  async function saveName() {
    if (!session) return;
    const name = editingName.trim();
    if (!name) return;
    const updated = { ...session, deviceName: name };
    await api<Device>(updated, `/api/devices/${updated.deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    writeSession(updated);
    setSession(updated);
    await refreshDevices(updated);
  }

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  }

  if (!session) {
    return (
      <Login
        lang={lang}
        setLang={setLang}
        onLogin={(next) => {
          writeSession(next);
          setSession(next);
          if (runtime.isNative) {
            setShowLocationPrompt(true);
          }
        }}
      />
    );
  }

  if (showLocationPrompt) {
    return (
      <LocationPrompt
        lang={lang}
        onContinue={() => {
          localStorage.setItem(locationPromptKey, '1');
          setShowLocationPrompt(false);
        }}
      />
    );
  }

  const selected = selectedLocatedDevice(devices, selectedDeviceId) || newestLocatedDevice(devices) || devices.find((device) => device.id === selectedDeviceId);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src="/assets/guideng-logo.png" alt="" />
          <div>
          <h1>{t.app}</h1>
          <p>{t.subtitle}</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-button" title="Language" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
            <Languages size={18} />
          </button>
          <button
            className="icon-button"
            title={t.logout}
            onClick={() => {
              localStorage.removeItem(storageKey);
              if (runtime.isNative && Capacitor.isPluginAvailable('GuidengBackgroundLocation')) {
                void GuidengBackgroundLocation.stop();
              }
              setSession(null);
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="control-band">
        <div className="server-pill">
          <Server size={16} />
          <span>{session.serverUrl}</span>
        </div>
        <div className={`status-dot ${status}`}>
          <LocateFixed size={16} />
          <span>{status === 'sharing' ? t.sharing : status === 'locating' ? t.locating : t.paused}</span>
        </div>
      </section>

      {error && <div className="error">{t.errorPrefix}: {error}</div>}

      <section className="workspace">
        <div className="map-pane">
          <div className="map-toolbar">
            <label>
              {t.provider}
              <span className="map-provider-name">高德地图</span>
            </label>
            <button onClick={() => refreshDevices()} title={t.refresh}>
              <RefreshCw size={16} />
              {t.refresh}
            </button>
          </div>
          {selected?.last_location ? (
            <AmapView
              config={appConfig}
              devices={devices}
              selectedDeviceId={selected.id}
              tracks={tracks}
              lang={lang}
              onSelectDevice={setSelectedDeviceId}
            />
          ) : (
            <div className="empty-map">
              <MapPinned size={44} />
              <span>{t.noLocation}</span>
            </div>
          )}
        </div>

        <aside className="side-panel">
          <section className="profile-panel">
            <div className="panel-title">
              <Smartphone size={18} />
              <span>{t.deviceName}</span>
            </div>
            <div className="name-edit">
              <input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
              <button onClick={saveName} title={t.save}>
                <Save size={16} />
              </button>
            </div>
            <p className="hint">{runtime.isNative ? t.nativePermissionHint : t.webPermissionHint}</p>
          </section>

          <section className="device-list">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                active={device.id === selected?.id}
                device={device}
                lang={lang}
                trackCount={device.id === selected?.id ? tracks.length : undefined}
                onSelect={() => setSelectedDeviceId(device.id)}
              />
            ))}
          </section>
        </aside>
      </section>
    </main>
  );
}

function Login({ lang, setLang, onLogin }: { lang: Lang; setLang: (lang: Lang) => void; onLogin: (session: Session) => void }) {
  const t = i18n[lang];
  const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_DEFAULT_SERVER_URL || '');
  const [token, setToken] = useState('');
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [error, setError] = useState('');
  const deviceId = useMemo(() => randomDeviceId(), []);
  const canLogin = Boolean(serverUrl.trim() && token.trim() && acceptedAgreement);

  return (
    <main className="login-screen">
      <div className="login-head">
        <div className="brand-lockup">
          <img src="/assets/guideng-logo.png" alt="" />
          <div>
          <h1>{t.app}</h1>
          <p>{t.subtitle}</p>
          </div>
        </div>
        <button className="icon-button" title="Language" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          <Languages size={18} />
        </button>
      </div>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedServerUrl = normalizeServerUrl(serverUrl);
          if (!normalizedServerUrl) {
            setError(t.invalidServerUrl);
            return;
          }
          setError('');
          onLogin({
            serverUrl: normalizedServerUrl,
            token: token.trim(),
            deviceId,
            deviceName: defaultDeviceName(),
          });
        }}
      >
        <label>
          {t.serverUrl}
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="https://guideng.example.com" required />
        </label>
        <label>
          {t.token}
          <input value={token} onChange={(event) => setToken(event.target.value)} type="password" required />
        </label>

        {error && <div className="error inline-error">{t.errorPrefix}: {error}</div>}

        <section className="agreement-panel">
          <h2>{t.privacyTitle}</h2>
          <p>{t.privacyText}</p>
          <h2>{t.licenseTitle}</h2>
          <p>{t.licenseText}</p>
        </section>

        <label className="agreement-check">
          <input type="checkbox" checked={acceptedAgreement} onChange={(event) => setAcceptedAgreement(event.target.checked)} />
          <span>{t.loginConsent}</span>
        </label>

        <button className="primary-button" type="submit" disabled={!canLogin}>
          <LocateFixed size={18} />
          {t.login}
        </button>
      </form>
    </main>
  );
}

function LocationPrompt({ lang, onContinue }: { lang: Lang; onContinue: () => void }) {
  const t = i18n[lang];
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'whenInUse' | 'always'>('whenInUse');
  const [promptError, setPromptError] = useState('');

  async function handleContinue() {
    setLoading(true);
    setPromptError('');
    try {
      if (step === 'whenInUse') {
        await triggerNativeLocationPermissionPrompt({ background: false });
        setStep('always');
        return;
      }
      await triggerNativeLocationPermissionPrompt({ background: true });
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : String(err));
      return;
    } finally {
      setLoading(false);
    }
    onContinue();
  }

  const title = step === 'whenInUse' ? t.locationPromptTitle : t.locationPromptAlwaysTitle;
  const primaryBody = step === 'whenInUse' ? t.locationPromptBody1 : t.locationPromptAlwaysBody;
  const secondaryBody = step === 'whenInUse' ? t.locationPromptBody2 : t.locationPromptBody3;
  const buttonLabel = step === 'whenInUse' ? t.locationPromptContinue : t.locationPromptAlwaysContinue;

  return (
    <main className="location-prompt-screen">
      <div className="location-prompt-card">
        <div className="location-prompt-icon">
          <LocateFixed size={36} />
        </div>
        <h1 className="location-prompt-title">{title}</h1>
        <p className="location-prompt-body">{primaryBody}</p>
        <p className="location-prompt-body">{secondaryBody}</p>
        {step === 'whenInUse' && <p className="location-prompt-note">{t.locationPromptBody3}</p>}
        {promptError && <div className="error inline-error">{t.errorPrefix}: {promptError}</div>}
        <button
          id="location-prompt-continue"
          className="primary-button location-prompt-btn"
          onClick={handleContinue}
          disabled={loading}
        >
          {buttonLabel}
        </button>
      </div>
    </main>
  );
}

async function triggerNativeLocationPermissionPrompt({ background }: { background: boolean }) {
  let watcherId = '';
  let settled = false;

  await new Promise<void>(async (resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, 12_000);

    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'Guideng',
          ...(background ? { backgroundMessage: 'Guideng is requesting background location permission.' } : {}),
          requestPermissions: true,
          stale: true,
          distanceFilter: 10,
        },
        (_position?: NativeLocation, error?: CallbackError) => {
          if (settled) return;
          if (error) {
            settled = true;
            window.clearTimeout(timeout);
            reject(error);
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          resolve();
        },
      );
    } catch (err) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(err);
    }
  });

  if (watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined);
  }
}


function AmapView({
  config,
  devices,
  selectedDeviceId,
  tracks,
  lang,
  onSelectDevice,
}: {
  config: AppConfig | null | undefined;
  devices: Device[];
  selectedDeviceId: string;
  tracks: Location[];
  lang: Lang;
  onSelectDevice: (deviceId: string) => void;
}) {
  const t = i18n[lang];
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<any>(null);
  const amapRef = React.useRef<any>(null);
  const markersRef = React.useRef<Map<string, any>>(new Map());
  const polylineRef = React.useRef<any>(null);
  const hasInitialViewportRef = React.useRef(false);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const key = config?.amap_web_js_api_key?.trim();
  const securityCode = config?.amap_web_js_security_code?.trim();
  const locatedDevices = useMemo(() => devices.filter((device) => device.last_location), [devices]);
  const selectedDevice = locatedDevices.find((device) => device.id === selectedDeviceId) || locatedDevices[0];
  const location = selectedDevice?.last_location;

  useEffect(() => {
    if (!containerRef.current || !location || !key || !selectedDevice) return;
    let cancelled = false;
    setLoading(true);

    loadAmap(key, securityCode)
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const center = mapCoordinate(location);
        amapRef.current = AMap;
        mapRef.current = new AMap.Map(containerRef.current, {
          center: [center.longitude, center.latitude],
          zoom: 15,
          viewMode: '2D',
        });
        setMapReady(true);
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      setMapReady(false);
      markersRef.current.clear();
      polylineRef.current = null;
      hasInitialViewportRef.current = false;
      mapRef.current?.destroy();
      mapRef.current = null;
      amapRef.current = null;
    };
  }, [key, securityCode]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = amapRef.current;
    if (!mapReady || !map || !AMap) return;

    const currentDeviceIds = new Set(locatedDevices.map((device) => device.id));
    for (const [deviceId, marker] of markersRef.current) {
      if (!currentDeviceIds.has(deviceId)) {
        map.remove(marker);
        markersRef.current.delete(deviceId);
      }
    }

    for (const device of locatedDevices) {
      const point = mapCoordinate(device.last_location!);
      const position = [point.longitude, point.latitude];
      const active = device.id === selectedDeviceId;
      const existingMarker = markersRef.current.get(device.id);
      if (existingMarker) {
        existingMarker.setPosition(position);
        existingMarker.setTitle(device.name);
        existingMarker.setContent(createDeviceMarker(device.name, active));
      } else {
        const marker = new AMap.Marker({
          position,
          title: device.name,
          content: createDeviceMarker(device.name, active),
          offset: new AMap.Pixel(-18, -46),
          map,
        });
        marker.on('click', () => onSelectDevice(device.id));
        markersRef.current.set(device.id, marker);
      }
    }

    const trackPath = tracks.map(mapCoordinate).map((point) => [point.longitude, point.latitude]);
    if (trackPath.length > 1) {
      if (polylineRef.current) {
        polylineRef.current.setPath(trackPath);
      } else {
        polylineRef.current = new AMap.Polyline({
          path: trackPath,
          strokeColor: '#2f8f4e',
          strokeWeight: 6,
          strokeOpacity: 0.9,
          map,
        });
      }
    } else if (polylineRef.current) {
      map.remove(polylineRef.current);
      polylineRef.current = null;
    }

    if (!hasInitialViewportRef.current) {
      const overlays = [...markersRef.current.values()];
      if (polylineRef.current) overlays.unshift(polylineRef.current);
      if (overlays.length) map.setFitView(overlays, false, [60, 60, 60, 60]);
      hasInitialViewportRef.current = true;
    }
  }, [locatedDevices, mapReady, onSelectDevice, selectedDeviceId, tracks]);

  if (config === undefined) {
    return (
      <div className="empty-map">
        <MapPinned size={44} />
        <span>{t.mapLoading}</span>
      </div>
    );
  }

  if (!key) {
    return (
      <div className="empty-map">
        <MapPinned size={44} />
        <span>{t.mapKeyMissing}</span>
      </div>
    );
  }

  return (
    <div className="amap-wrap">
      {loading && <div className="map-loading">{t.mapLoading}</div>}
      <div ref={containerRef} className="amap-view" />
    </div>
  );
}

function createDeviceMarker(name: string, active: boolean) {
  const marker = document.createElement('div');
  marker.className = `device-map-marker ${active ? 'active' : ''}`;

  const pin = document.createElement('div');
  pin.className = 'device-map-pin';

  const label = document.createElement('div');
  label.className = 'device-map-label';
  label.textContent = name;

  marker.append(pin, label);
  return marker;
}

function loadAmap(key: string, securityCode?: string) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (securityCode) {
    window._AMapSecurityConfig = {
      securityJsCode: securityCode,
    };
  }

  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-guideng-amap="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.AMap));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.dataset.guidengAmap = 'true';
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => resolve(window.AMap);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function DeviceCard({
  active,
  device,
  lang,
  trackCount,
  onSelect,
}: {
  active: boolean;
  device: Device;
  lang: Lang;
  trackCount?: number;
  onSelect: () => void;
}) {
  const t = i18n[lang];
  const location = device.last_location;
  return (
    <article className={`device-card ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="device-card-head">
        <div>
          <h2>{device.name}</h2>
          <p>{location ? formatTime(location.received_at, lang) : t.noLocation}</p>
        </div>
        {location && (
          <a title={t.openMap} href={mapLink(location, device.name)} target="_blank" rel="noreferrer">
            <ExternalLink size={17} />
          </a>
        )}
      </div>
      {location && (
        <dl>
          <div>
            <dt>{t.track}</dt>
            <dd>
              <Route size={14} />
              {trackCount ?? '-'}
            </dd>
          </div>
          <div>
            <dt>{t.accuracy}</dt>
            <dd>{location.accuracy ? `${Math.round(location.accuracy)} m` : '-'}</dd>
          </div>
          <div>
            <dt>Lat</dt>
            <dd>{location.latitude.toFixed(5)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

async function api<T>(session: Session, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${session.serverUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizeAppConfig(config: RawAppConfig): AppConfig {
  return {
    provider: 'amap',
    amap_web_js_api_key: firstString(
      config.amap_web_js_api_key,
      config.amapWebJsApiKey,
      config.web_js_api_key,
      config.webJsApiKey,
      config.web_api_key,
      config.webApiKey,
      config.amap_key,
      config.amapKey,
      import.meta.env.VITE_AMAP_WEB_JS_API_KEY,
    ),
    amap_web_js_security_code: firstString(
      config.amap_web_js_security_code,
      config.amapWebJsSecurityCode,
      config.web_js_security_code,
      config.webJsSecurityCode,
      config.security_code,
      config.securityCode,
      import.meta.env.VITE_AMAP_WEB_JS_SECURITY_CODE,
    ),
    amap_android_key: firstString(config.amap_android_key, config.amapAndroidKey),
    amap_ios_key: firstString(config.amap_ios_key, config.amapIosKey),
  };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

async function registerDevice(session: Session) {
  return api<Device>(session, '/api/devices', {
    method: 'POST',
    body: JSON.stringify({
      id: session.deviceId,
      name: session.deviceName,
      platform: navigator.userAgent,
    }),
  });
}

async function startNativeLocationSharing(session: Session, onShared: () => Promise<void>, onError: (err: unknown) => void) {
  // The native service persists configuration and owns an independent upload queue,
  // so tracking survives WebView suspension and supported Core Location relaunches.
  // Older native shells do not contain this service. Keep the community watcher
  // working until the user installs a build that includes the native plugin.
  if (Capacitor.isPluginAvailable('GuidengBackgroundLocation')) {
    await GuidengBackgroundLocation.configure({
      serverUrl: session.serverUrl,
      token: session.token,
      deviceId: session.deviceId,
    });
    await onShared();
    return () => undefined;
  }

  let lastFallbackUploadAt = 0;
  const initialPosition = await getNativeInitialLocation();
  if (initialPosition) {
    try {
      await sendLocation(session, nativeLocationPayload(initialPosition));
      lastFallbackUploadAt = Date.now();
      await onShared();
    } catch (err) {
      onError(err);
    }
  }

  const watcherId = await BackgroundGeolocation.addWatcher(
    {
      backgroundTitle: 'Guideng',
      backgroundMessage: 'Guideng is sharing this device location with your server.',
      requestPermissions: false,
      stale: true,
      distanceFilter: 15,
    },
    async (position?: NativeLocation, error?: CallbackError) => {
      if (error) {
        onError(error);
        return;
      }
      if (!position) return;
      const now = Date.now();
      if (now - lastFallbackUploadAt < 15_000) return;
      lastFallbackUploadAt = now;
      try {
        await sendLocation(session, nativeLocationPayload(position));
        await onShared();
      } catch (err) {
        onError(err);
      }
    },
  );

  return () => BackgroundGeolocation.removeWatcher({ id: watcherId });
}

async function getNativeInitialLocation() {
  let watcherId = '';
  let lastPosition: NativeLocation | undefined;
  let settled = false;

  await new Promise<void>(async (resolve) => {
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(finish, 3_000);
    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          requestPermissions: false,
          stale: false,
          distanceFilter: 15,
        },
        (position?: NativeLocation) => {
          if (position) lastPosition = position;
          finish();
        },
      );
    } catch {
      finish();
    }
  });

  if (watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined);
  }

  return lastPosition;
}

function startBrowserLocationSharing(session: Session, onShared: () => Promise<void>, onError: (err: unknown) => void) {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation is not available in this browser.'));
    return null;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await sendLocation(session, browserLocationPayload(position));
        await onShared();
      } catch (err) {
        onError(err);
      }
    },
    onError,
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );

  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      try {
        await sendLocation(session, browserLocationPayload(position));
        await onShared();
      } catch (err) {
        onError(err);
      }
    },
    onError,
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

function nativeLocationPayload(position: NativeLocation): LocationPayload {
  return {
    latitude: position.latitude,
    longitude: position.longitude,
    accuracy: position.accuracy,
    altitude: position.altitude,
    heading: position.bearing,
    speed: position.speed,
    captured_at: new Date(position.time ?? Date.now()).toISOString(),
  };
}

function browserLocationPayload(position: GeolocationPosition): LocationPayload {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
    captured_at: new Date(position.timestamp).toISOString(),
  };
}

async function sendLocation(session: Session, location: LocationPayload) {
  return api<Device>(session, `/api/devices/${session.deviceId}/location`, {
    method: 'POST',
    body: JSON.stringify(location),
  });
}

function mapLink(location: Location, name: string) {
  const { latitude: lat, longitude: lng } = mapCoordinate(location);
  const label = encodeURIComponent(name);
  return `https://uri.amap.com/marker?position=${lng},${lat}&name=${label}`;
}

function mapCoordinate(location: Location) {
  const wgs84 = { latitude: location.latitude, longitude: location.longitude };
  return wgs84ToGcj02(wgs84);
}

function wgs84ToGcj02(point: { latitude: number; longitude: number }) {
  if (isOutsideChina(point.latitude, point.longitude)) return point;

  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dLat = transformLat(point.longitude - 105.0, point.latitude - 35.0);
  let dLng = transformLng(point.longitude - 105.0, point.latitude - 35.0);
  const radLat = (point.latitude / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

  return {
    latitude: point.latitude + dLat,
    longitude: point.longitude + dLng,
  };
}

function isOutsideChina(latitude: number, longitude: number) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

function newestLocatedDevice(devices: Device[]) {
  return devices.find((device) => device.last_location) || null;
}

function selectedLocatedDevice(devices: Device[], selectedDeviceId: string) {
  return devices.find((device) => device.id === selectedDeviceId && device.last_location) || null;
}

function readSession(): Session | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function writeSession(session: Session) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

function normalizeServerUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function preferredLang(): Lang {
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function defaultDeviceName() {
  return navigator.platform || 'My device';
}

function randomDeviceId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function locationErrorMessage(err: unknown, isNative: boolean, t: Record<string, string>) {
  const fallback = isNative ? t.nativeLocationError : t.webLocationError;
  if (!err) return fallback;
  if (err instanceof GeolocationPositionError) return `${fallback} ${err.message}`;
  if (err instanceof Error) return `${fallback} ${err.message}`;
  return `${fallback} ${String(err)}`;
}

function formatTime(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

createRoot(document.getElementById('root')!).render(<App />);
