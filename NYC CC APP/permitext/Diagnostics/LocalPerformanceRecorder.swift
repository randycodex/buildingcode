import Foundation
#if PERMITEXT_LOCAL_PERFORMANCE
import Darwin
#if canImport(UIKit)
import UIKit
#endif
#endif

/// Local development timing only. No text, source identifiers, account data, or network transport.
/// Milestones measure application callbacks, not display-server presentation or CPU/memory cost.
enum LocalPerformanceRecorder {
    enum Milestone: String, Codable, Sendable {
        case searchInputScheduled, allEditionSearchStarted, allEditionSearchFinished
        case allEditionSearchCancelled, firstSearchResultsReady, completedSearchCacheHit
        case allEditionSearchPublishedComplete, allEditionSearchPublishedPartial, allEditionSearchFailed
        case searchResultOpenRequested, searchResultDestinationPrepared
        case passageDataReady, passageContentAppeared, passageReferencesReady
        case chapterOpenRequested, chapterDestinationPrepared, nativeChapterContentAppeared, nativeChapterRestorationCompleted
    }

    static func record(_ milestone: Milestone) {
        #if PERMITEXT_LOCAL_PERFORMANCE
        storage.record(milestone)
        #endif
    }

    #if PERMITEXT_LOCAL_PERFORMANCE
    private static let storage = Storage(
        directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PermitextPerformance", isDirectory: true),
        build: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    )

    /// The lock protects a strictly bounded buffer; disk work runs only on a utility queue.
    /// There is at most one pending flush, rather than one queued closure per event.
    final class Storage: @unchecked Sendable {
        struct Event: Codable {
            let sequence: UInt64
            let uptimeSeconds: Double
            let milestone: Milestone
        }
        struct Snapshot: Codable {
            let schemaVersion: Int
            let runUUID: String
            let appBuild: String
            let eventCapacity: Int
            let droppedEvents: UInt64
            let events: [Event]
            let resourceCapacity: Int
            let resourceDroppedSamples: UInt64
            let resourceSamples: [ResourceSample]
        }
        struct ResourceSample: Codable {
            let sequence: UInt64
            let uptimeSeconds: Double
            let kind: String
            let thermalState: Int?
            let residentBytes: UInt64?
            let residentPeakBytes: UInt64?
            let physicalFootprintBytes: UInt64?
            let machError: Int32?
        }
        struct MemoryReading {
            let residentBytes: UInt64?
            let residentPeakBytes: UInt64?
            let physicalFootprintBytes: UInt64?
            let machError: Int32?
        }
        /// Reads this process only. The SDK count guard prevents reading unavailable fields.
        static func readMemory() -> MemoryReading {
            var info = task_vm_info_data_t()
            var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
            let result = withUnsafeMutablePointer(to: &info) { pointer in
                pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                    task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
                }
            }
            let footprintEnd = MemoryLayout<task_vm_info_data_t>.offset(of: \.phys_footprint)! + MemoryLayout<UInt64>.size
            guard result == KERN_SUCCESS, Int(count) * MemoryLayout<integer_t>.size >= footprintEnd else {
                return MemoryReading(residentBytes: nil, residentPeakBytes: nil,
                                     physicalFootprintBytes: nil, machError: result == KERN_SUCCESS ? KERN_INVALID_ARGUMENT : result)
            }
            return MemoryReading(residentBytes: info.resident_size, residentPeakBytes: info.resident_size_peak,
                                 physicalFootprintBytes: info.phys_footprint, machError: nil)
        }
        static let resourceCapacity = 600
        static let capacity = 2048
        private let lock = NSLock()
        private let queue = DispatchQueue(label: "com.permitext.local-performance", qos: .utility)
        private let directory: URL
        private let build: String
        private let runUUID = UUID().uuidString
        private let flushDelay: TimeInterval
        private var events: [Event] = []
        private var sequence: UInt64 = 0
        private var dropped: UInt64 = 0
        private var pending = false
        private var resourceSamples: [ResourceSample] = []
        private var resourceDropped: UInt64 = 0
        private var resourceSequence: UInt64 = 0
        private var resourceActive = false
        private var resourceGeneration: UInt64 = 0
        private var resourceTimer: DispatchSourceTimer?
        private var observers: [NSObjectProtocol] = []

        init(directory: URL, build: String, flushDelay: TimeInterval = 1, startResourceCapture: Bool = true) {
            self.directory = directory
            self.build = String(build.prefix(64))
            self.flushDelay = max(0.01, flushDelay)
            events.reserveCapacity(Self.capacity)
            resourceSamples.reserveCapacity(Self.resourceCapacity)
            if startResourceCapture { startResources() }
        }

        private func startResources() {
            #if canImport(UIKit)
            // Initial state and notifications use the main queue, but Mach reads and persistence do not.
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let center = NotificationCenter.default
                observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                    object: nil, queue: .main) { [weak self] _ in self?.setResourceActive(true) })
                observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification,
                                                    object: nil, queue: .main) { [weak self] _ in self?.setResourceActive(false) })
                setResourceActive(UIApplication.shared.applicationState == .active)
            }
            #else
            setResourceActive(true)
            #endif
            let timer = DispatchSource.makeTimerSource(queue: queue)
            timer.schedule(deadline: .now() + 1, repeating: 1, leeway: .milliseconds(100))
            timer.setEventHandler { [weak self] in self?.sampleResources() }
            resourceTimer = timer
            timer.resume()
        }

        deinit {
            resourceTimer?.cancel()
            for observer in observers { NotificationCenter.default.removeObserver(observer) }
        }

        func setResourceActive(_ active: Bool) {
            lock.lock()
            defer { lock.unlock() }
            // First transition is recorded even when initialization finds an inactive app.
            guard resourceSequence == 0 || resourceActive != active else { return }
            resourceActive = active
            resourceGeneration &+= 1
            appendResourceLocked(kind: active ? "active" : "inactive", memory: nil, thermal: nil)
        }

        func sampleResources(readMemory: () -> MemoryReading = Storage.readMemory) {
            lock.lock()
            let active = resourceActive
            let generation = resourceGeneration
            lock.unlock()
            guard active else { return }
            let memory = readMemory()
            let thermal = ProcessInfo.processInfo.thermalState.rawValue
            lock.lock()
            defer { lock.unlock() }
            guard resourceActive, resourceGeneration == generation else { return }
            appendResourceLocked(kind: "sample", memory: memory, thermal: thermal)
        }

        private func appendResourceLocked(kind: String, memory: MemoryReading?, thermal: Int?) {
            resourceSequence &+= 1
            if resourceSamples.count < Self.resourceCapacity {
                resourceSamples.append(ResourceSample(sequence: resourceSequence,
                    uptimeSeconds: ProcessInfo.processInfo.systemUptime, kind: kind, thermalState: thermal,
                    residentBytes: memory?.residentBytes, residentPeakBytes: memory?.residentPeakBytes,
                    physicalFootprintBytes: memory?.physicalFootprintBytes, machError: memory?.machError))
            } else {
                resourceDropped &+= 1
            }
            scheduleFlushLocked()
        }

        private func scheduleFlushLocked() {
            if !pending {
                pending = true
                queue.asyncAfter(deadline: .now() + flushDelay) { [self] in flush() }
            }
        }

        func record(_ milestone: Milestone) {
            lock.lock()
            sequence &+= 1
            if events.count < Self.capacity {
                events.append(Event(sequence: sequence,
                                    uptimeSeconds: ProcessInfo.processInfo.systemUptime,
                                    milestone: milestone))
            } else {
                dropped &+= 1
            }
            scheduleFlushLocked()
            lock.unlock()
        }

        private func flush() {
            lock.lock()
            let snapshot = Snapshot(schemaVersion: 1, runUUID: runUUID, appBuild: build,
                                    eventCapacity: Self.capacity, droppedEvents: dropped, events: events,
                                    resourceCapacity: Self.resourceCapacity, resourceDroppedSamples: resourceDropped,
                                    resourceSamples: resourceSamples)
            pending = false
            lock.unlock()
            // A single replaced file bounds disk usage across process launches. Atomic writes
            // temporarily require a second bounded snapshot. Failures never affect app behavior.
            do {
                let data = try JSONEncoder().encode(snapshot)
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try data.write(to: directory.appendingPathComponent("current.json"), options: .atomic)
            } catch {
                // Best effort; an absent/stale file is not evidence of a successful capture.
            }
        }
    }
    #endif
}
