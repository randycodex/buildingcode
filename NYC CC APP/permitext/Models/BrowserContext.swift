import Foundation
import SwiftUI

enum AppTab: Hashable {
    case browse
    case browseSecondary
    case search
    case bookmarks
    case research
}

struct ContinuityStore {
    static let shared = ContinuityStore()

    private let contextDefaultsKey = "continuityContext"
    private let selectedVersionDefaultsKey = "selectedCodeVersionFileName"
    private let selectedJurisdictionDefaultsKey = "selectedJurisdictionKey"
    private let selectedCodeSectionDefaultsKey = "selectedCodeSectionID"
    private let lastOpenedChapterIDDefaultsKey = "lastOpenedChapterID"
    private let comparisonModeDefaultsKey = "comparisonModeEnabled"
    private let recentlyViewedSectionsDefaultsKey = "recentlyViewedSections"

    func load() -> ContinuityContext {
        if let data = UserDefaults.standard.data(forKey: contextDefaultsKey),
           var decoded = try? JSONDecoder().decode(ContinuityContext.self, from: data) {
            decoded.comparisonModeEnabled = true
            return decoded
        }

        return ContinuityContext(
            selectedJurisdictionKey: UserDefaults.standard.string(forKey: selectedJurisdictionDefaultsKey) ?? "",
            selectedVersionFileName: UserDefaults.standard.string(forKey: selectedVersionDefaultsKey) ?? "",
            selectedCodeSectionID: legacyInt64(forKey: selectedCodeSectionDefaultsKey),
            lastOpenedChapterID: legacyInt64(forKey: lastOpenedChapterIDDefaultsKey),
            activeProjectID: nil,
            comparisonModeEnabled: true,
            recentlyViewedSections: loadLegacyRecentlyViewedSections()
        )
    }

    func save(_ context: ContinuityContext) {
        guard let data = try? JSONEncoder().encode(context) else { return }
        UserDefaults.standard.set(data, forKey: contextDefaultsKey)
        persistLegacyMirror(context)
    }

    func update(_ mutate: (inout ContinuityContext) -> Void) {
        var context = load()
        mutate(&context)
        save(context)
    }

    #if DEBUG
    func debugValidationMessages() -> [String] {
        let context = load()
        guard let data = try? JSONEncoder().encode(context) else {
            return ["ContinuityContext failed to encode."]
        }
        guard let decoded = try? JSONDecoder().decode(ContinuityContext.self, from: data) else {
            return ["ContinuityContext failed to decode."]
        }
        guard decoded == context else {
            return ["ContinuityContext did not round-trip cleanly."]
        }
        return []
    }
    #endif

    private func persistLegacyMirror(_ context: ContinuityContext) {
        if context.selectedJurisdictionKey.isEmpty {
            UserDefaults.standard.removeObject(forKey: selectedJurisdictionDefaultsKey)
        } else {
            UserDefaults.standard.set(context.selectedJurisdictionKey, forKey: selectedJurisdictionDefaultsKey)
        }

        if context.selectedVersionFileName.isEmpty {
            UserDefaults.standard.removeObject(forKey: selectedVersionDefaultsKey)
        } else {
            UserDefaults.standard.set(context.selectedVersionFileName, forKey: selectedVersionDefaultsKey)
        }

        if let selectedCodeSectionID = context.selectedCodeSectionID {
            UserDefaults.standard.set(selectedCodeSectionID, forKey: selectedCodeSectionDefaultsKey)
        } else {
            UserDefaults.standard.removeObject(forKey: selectedCodeSectionDefaultsKey)
        }

        if let lastOpenedChapterID = context.lastOpenedChapterID {
            UserDefaults.standard.set(lastOpenedChapterID, forKey: lastOpenedChapterIDDefaultsKey)
        } else {
            UserDefaults.standard.removeObject(forKey: lastOpenedChapterIDDefaultsKey)
        }

        UserDefaults.standard.set(context.comparisonModeEnabled, forKey: comparisonModeDefaultsKey)

        if let data = try? JSONEncoder().encode(context.recentlyViewedSections) {
            UserDefaults.standard.set(data, forKey: recentlyViewedSectionsDefaultsKey)
        }
    }

    private func legacyInt64(forKey key: String) -> Int64? {
        if let number = UserDefaults.standard.object(forKey: key) as? NSNumber {
            return number.int64Value
        }
        if let value = UserDefaults.standard.object(forKey: key) as? Int64 {
            return value
        }
        return nil
    }

    private func loadLegacyRecentlyViewedSections() -> [RecentlyViewedEntry] {
        guard let data = UserDefaults.standard.data(forKey: recentlyViewedSectionsDefaultsKey),
              let decoded = try? JSONDecoder().decode([RecentlyViewedEntry].self, from: data)
        else {
            return []
        }
        return decoded.sorted { $0.viewedAt > $1.viewedAt }
    }
}

enum BrowserContextID: String, Hashable, CaseIterable, Identifiable {
    case primary
    case secondary

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .primary:
            return "Browser 1"
        case .secondary:
            return "Browser 2"
        }
    }

    var codeSectionDefaultsKey: String {
        switch self {
        case .primary:
            return "browseLeftCodeSectionID"
        case .secondary:
            return "browseRightCodeSectionID"
        }
    }

    var versionDefaultsKey: String {
        switch self {
        case .primary:
            return "browseLeftVersionFileName"
        case .secondary:
            return "browseRightVersionFileName"
        }
    }

    func chapterSectionDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterSection." + String(chapterID)
    }

    func chapterAnchorDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterAnchor." + String(chapterID)
    }

    func chapterNativeBlockDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterNativeBlock." + String(chapterID)
    }

    func chapterScrollOffsetDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterScrollOffset." + String(chapterID)
    }

    static func storedCodeSectionID(for context: BrowserContextID) -> Int64? {
        let key = context.codeSectionDefaultsKey
        guard UserDefaults.standard.object(forKey: key) != nil else { return nil }
        let storedValue = UserDefaults.standard.integer(forKey: key)
        return storedValue < 0 ? nil : Int64(storedValue)
    }

    static func persistCodeSectionID(_ id: Int64?, for context: BrowserContextID) {
        UserDefaults.standard.set(id ?? -1, forKey: context.codeSectionDefaultsKey)
    }

    static func storedVersionFileName(for context: BrowserContextID) -> String? {
        let value = UserDefaults.standard.string(forKey: context.versionDefaultsKey)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }

    static func persistVersionFileName(_ fileName: String, for context: BrowserContextID) {
        UserDefaults.standard.set(fileName, forKey: context.versionDefaultsKey)
    }

    static func storedSectionID(for chapterID: Int64, context: BrowserContextID) -> Int64? {
        let key = context.chapterSectionDefaultsKey(for: chapterID)
        guard UserDefaults.standard.object(forKey: key) != nil else { return nil }
        let storedValue = UserDefaults.standard.integer(forKey: key)
        return storedValue < 0 ? nil : Int64(storedValue)
    }

    static func persistSectionID(_ id: Int64?, for chapterID: Int64, context: BrowserContextID) {
        UserDefaults.standard.set(id ?? -1, forKey: context.chapterSectionDefaultsKey(for: chapterID))
    }

    static func storedAnchorID(for chapterID: Int64, context: BrowserContextID) -> String? {
        let key = context.chapterAnchorDefaultsKey(for: chapterID)
        let value = UserDefaults.standard.string(forKey: key)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (value?.isEmpty == false) ? value : nil
    }

    static func persistAnchorID(_ anchorID: String?, for chapterID: Int64, context: BrowserContextID) {
        let trimmed = anchorID?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty {
            UserDefaults.standard.set(trimmed, forKey: context.chapterAnchorDefaultsKey(for: chapterID))
        } else {
            UserDefaults.standard.removeObject(forKey: context.chapterAnchorDefaultsKey(for: chapterID))
        }
    }

    static func storedNativeBlockID(for chapterID: Int64, context: BrowserContextID) -> String? {
        let key = context.chapterNativeBlockDefaultsKey(for: chapterID)
        let value = UserDefaults.standard.string(forKey: key)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (value?.isEmpty == false) ? value : nil
    }

    static func persistNativeBlockID(_ blockID: String?, for chapterID: Int64, context: BrowserContextID) {
        let trimmed = blockID?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty {
            UserDefaults.standard.set(trimmed, forKey: context.chapterNativeBlockDefaultsKey(for: chapterID))
        } else {
            UserDefaults.standard.removeObject(forKey: context.chapterNativeBlockDefaultsKey(for: chapterID))
        }
    }

    static func storedScrollOffset(for chapterID: Int64, context: BrowserContextID) -> Double? {
        let key = context.chapterScrollOffsetDefaultsKey(for: chapterID)
        guard UserDefaults.standard.object(forKey: key) != nil else { return nil }
        let value = UserDefaults.standard.double(forKey: key)
        return value >= 0 ? value : nil
    }

    static func persistScrollOffset(_ offset: Double?, for chapterID: Int64, context: BrowserContextID) {
        if let offset, offset >= 0 {
            UserDefaults.standard.set(offset, forKey: context.chapterScrollOffsetDefaultsKey(for: chapterID))
        } else {
            UserDefaults.standard.removeObject(forKey: context.chapterScrollOffsetDefaultsKey(for: chapterID))
        }
    }
}

private struct BrowserTabActiveKey: EnvironmentKey {
    static let defaultValue = true
}

extension EnvironmentValues {
    /// Whether this browse tab is the selected comparison-mode browser tab.
    var isBrowserTabActive: Bool {
        get { self[BrowserTabActiveKey.self] }
        set { self[BrowserTabActiveKey.self] = newValue }
    }
}
