import Foundation

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
        }
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

        init(directory: URL, build: String, flushDelay: TimeInterval = 1) {
            self.directory = directory
            self.build = String(build.prefix(64))
            self.flushDelay = max(0.01, flushDelay)
            events.reserveCapacity(Self.capacity)
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
            if !pending {
                pending = true
                queue.asyncAfter(deadline: .now() + flushDelay) { [self] in flush() }
            }
            lock.unlock()
        }

        private func flush() {
            lock.lock()
            let snapshot = Snapshot(schemaVersion: 1, runUUID: runUUID, appBuild: build,
                                    eventCapacity: Self.capacity, droppedEvents: dropped, events: events)
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
