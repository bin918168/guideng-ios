import Capacitor
import CoreLocation

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginType(GuidengLocationPermission.self)
        bridge?.registerPluginType(GuidengBackgroundLocation.self)
    }
}

@objc(GuidengBackgroundLocation)
public class GuidengBackgroundLocation: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GuidengBackgroundLocation"
    public let jsName = "GuidengBackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    @objc public override func load() {
        GuidengLocationService.shared.restoreIfConfigured()
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let serverURL = call.getString("serverUrl"),
              let token = call.getString("token"),
              let deviceID = call.getString("deviceId") else {
            call.reject("serverUrl, token and deviceId are required")
            return
        }
        GuidengLocationService.shared.configure(serverURL: serverURL, token: token, deviceID: deviceID)
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        GuidengLocationService.shared.stop()
        call.resolve()
    }
}

/// Owns the critical tracking/upload path outside the WebView. Standard updates provide
/// precision while significant-change monitoring gives iOS a supported relaunch signal.
final class GuidengLocationService: NSObject, CLLocationManagerDelegate {
    static let shared = GuidengLocationService()

    private struct Configuration: Codable {
        let serverURL: String
        let token: String
        let deviceID: String
    }

    private struct PendingLocation: Codable {
        let latitude: Double
        let longitude: Double
        let accuracy: Double
        let altitude: Double
        let heading: Double
        let speed: Double
        let capturedAt: String
    }

    private let manager = CLLocationManager()
    private let defaults = UserDefaults.standard
    private let configurationKey = "guideng.nativeLocation.configuration"
    private let pendingKey = "guideng.nativeLocation.pending"
    private let queue = DispatchQueue(label: "com.guideng.location-upload")
    private let minimumUploadInterval: TimeInterval = 15
    private let stationaryUploadInterval: TimeInterval = 180
    private let minimumUploadDistance: CLLocationDistance = 10
    private let maximumHorizontalAccuracy: CLLocationAccuracy = 150
    private var configuration: Configuration?
    private var pending: [PendingLocation] = []
    private var uploading = false
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var lastAcceptedLocation: CLLocation?

    private override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = minimumUploadDistance
        manager.activityType = .other
        manager.pausesLocationUpdatesAutomatically = true
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
    }

    func restoreIfConfigured() {
        guard configuration == nil,
              let data = defaults.data(forKey: configurationKey),
              let saved = try? JSONDecoder().decode(Configuration.self, from: data) else { return }
        configuration = saved
        loadPending()
        startIfAuthorized()
        flush()
    }

    func configure(serverURL: String, token: String, deviceID: String) {
        let value = Configuration(serverURL: serverURL, token: token, deviceID: deviceID)
        configuration = value
        if let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: configurationKey)
        }
        loadPending()
        startIfAuthorized()
        flush()
    }

    func stop() {
        manager.stopUpdatingLocation()
        manager.stopMonitoringSignificantLocationChanges()
        configuration = nil
        pending = []
        lastAcceptedLocation = nil
        defaults.removeObject(forKey: configurationKey)
        defaults.removeObject(forKey: pendingKey)
    }

    private func startIfAuthorized() {
        DispatchQueue.main.async {
            guard CLLocationManager.authorizationStatus() == .authorizedAlways else { return }
            self.manager.startMonitoringSignificantLocationChanges()
            self.manager.startUpdatingLocation()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        startIfAuthorized()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let formatter = ISO8601DateFormatter()
        let additions = locations
            .sorted { $0.timestamp < $1.timestamp }
            .filter { shouldAccept($0) }
            .map { location in
                PendingLocation(latitude: location.coordinate.latitude,
                                longitude: location.coordinate.longitude,
                                accuracy: location.horizontalAccuracy,
                                altitude: location.altitude,
                                heading: location.course,
                                speed: location.speed,
                                capturedAt: formatter.string(from: location.timestamp))
            }
        guard !additions.isEmpty else { return }
        queue.async {
            self.pending.append(contentsOf: additions)
            if self.pending.count > 200 { self.pending.removeFirst(self.pending.count - 200) }
            self.savePending()
            self.flush()
        }
    }

    private func shouldAccept(_ location: CLLocation) -> Bool {
        guard location.horizontalAccuracy >= 0,
              location.horizontalAccuracy <= maximumHorizontalAccuracy,
              abs(location.timestamp.timeIntervalSinceNow) < 300 else { return false }

        guard let previous = lastAcceptedLocation else {
            lastAcceptedLocation = location
            return true
        }

        let elapsed = location.timestamp.timeIntervalSince(previous.timestamp)
        guard elapsed >= minimumUploadInterval else { return false }

        let distance = location.distance(from: previous)
        guard distance >= minimumUploadDistance || elapsed >= stationaryUploadInterval else {
            return false
        }

        lastAcceptedLocation = location
        return true
    }

    private func flush() {
        queue.async {
            guard !self.uploading, !self.pending.isEmpty, let config = self.configuration,
                  let baseURL = URL(string: config.serverURL) else { return }
            self.uploading = true
            DispatchQueue.main.async { self.beginBackgroundTask() }
            let item = self.pending[0]
            let url = baseURL.appendingPathComponent("api/devices/\(config.deviceID)/location")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(config.token)", forHTTPHeaderField: "Authorization")
            request.httpBody = try? JSONSerialization.data(withJSONObject: [
                "latitude": item.latitude, "longitude": item.longitude,
                "accuracy": item.accuracy, "altitude": item.altitude,
                "heading": item.heading, "speed": item.speed,
                "captured_at": item.capturedAt
            ])
            URLSession.shared.dataTask(with: request) { _, response, _ in
                self.queue.async {
                    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                    if (200..<300).contains(status) {
                        self.pending.removeFirst()
                        self.savePending()
                    }
                    self.uploading = false
                    if (200..<300).contains(status) { self.flush() }
                    else { DispatchQueue.main.async { self.endBackgroundTask() } }
                    if self.pending.isEmpty { DispatchQueue.main.async { self.endBackgroundTask() } }
                }
            }.resume()
        }
    }

    private func loadPending() {
        guard let data = defaults.data(forKey: pendingKey),
              let saved = try? JSONDecoder().decode([PendingLocation].self, from: data) else { return }
        pending = saved
    }

    private func savePending() {
        if let data = try? JSONEncoder().encode(pending) { defaults.set(data, forKey: pendingKey) }
    }

    private func beginBackgroundTask() {
        guard backgroundTask == .invalid else { return }
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "GuidengLocationUpload") {
            self.endBackgroundTask()
        }
    }

    private func endBackgroundTask() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }
}

@objc(GuidengLocationPermission)
public class GuidengLocationPermission: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "GuidengLocationPermission"
    public let jsName = "GuidengLocationPermission"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestWhenInUse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAlways", returnType: CAPPluginReturnPromise)
    ]

    private enum RequestKind {
        case whenInUse
        case always
    }

    private var locationManager: CLLocationManager?
    private var pendingCall: CAPPluginCall?
    private var requestKind: RequestKind?

    @objc func requestWhenInUse(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.pendingCall != nil {
                call.reject("Location permission request is already in progress", "IN_PROGRESS")
                return
            }

            let status = CLLocationManager.authorizationStatus()
            if status == .authorizedAlways {
                call.resolve(["status": "authorizedAlways"])
                return
            }

            if status == .authorizedWhenInUse {
                call.resolve(["status": "authorizedWhenInUse"])
                return
            }

            if status == .denied || status == .restricted {
                call.reject("Location permission has been denied or restricted", "NOT_AUTHORIZED")
                return
            }

            if status == .notDetermined {
                let manager = self.makeLocationManager(call: call, kind: .whenInUse)
                manager.requestWhenInUseAuthorization()
            } else {
                call.reject("Unsupported location authorization status", "NOT_AUTHORIZED")
                self.resetRequest()
            }
        }
    }

    @objc func requestAlways(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.pendingCall != nil {
                call.reject("Location permission request is already in progress", "IN_PROGRESS")
                return
            }

            let status = CLLocationManager.authorizationStatus()
            if status == .authorizedAlways {
                call.resolve(["status": "authorizedAlways"])
                return
            }

            if status == .denied || status == .restricted {
                call.reject("Location permission has been denied or restricted", "NOT_AUTHORIZED")
                return
            }

            let manager = self.makeLocationManager(call: call, kind: .always)
            manager.requestAlwaysAuthorization()
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthorization(CLLocationManager.authorizationStatus())
    }

    public func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        handleAuthorization(status)
    }

    private func handleAuthorization(_ status: CLAuthorizationStatus) {
        guard let call = pendingCall, let kind = requestKind else {
            return
        }

        switch status {
        case .authorizedAlways:
            call.resolve(["status": "authorizedAlways"])
            resetRequest()
        case .authorizedWhenInUse:
            if kind == .whenInUse {
                call.resolve(["status": "authorizedWhenInUse"])
                resetRequest()
            }
        case .denied, .restricted:
            call.reject("Location permission has been denied or restricted", "NOT_AUTHORIZED")
            resetRequest()
        case .notDetermined:
            break
        @unknown default:
            call.reject("Unknown location authorization status", "NOT_AUTHORIZED")
            resetRequest()
        }
    }

    private func resetRequest() {
        locationManager?.delegate = nil
        locationManager = nil
        pendingCall = nil
        requestKind = nil
    }

    private func makeLocationManager(call: CAPPluginCall, kind: RequestKind) -> CLLocationManager {
        let manager = CLLocationManager()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        locationManager = manager
        pendingCall = call
        requestKind = kind
        return manager
    }
}
