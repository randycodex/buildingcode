import Foundation
import SwiftUI

enum AppTab: Hashable {
    case browse
    case browseSecondary
    case search
    case bookmarks
    case settings
}

enum AppTabLayout {
    static func orderedTabs(comparisonModeEnabled: Bool) -> [AppTab] {
        var tabs: [AppTab] = [.browse]
        if comparisonModeEnabled {
            tabs.append(.browseSecondary)
        }
        tabs.append(contentsOf: [.search, .bookmarks, .settings])
        return tabs
    }

    static func index(for tab: AppTab, comparisonModeEnabled: Bool) -> Int? {
        orderedTabs(comparisonModeEnabled: comparisonModeEnabled).firstIndex(of: tab)
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

    func chapterSectionDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterSection." + String(chapterID)
    }

    func chapterAnchorDefaultsKey(for chapterID: Int64) -> String {
        rawValue + ".chapterAnchor." + String(chapterID)
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
