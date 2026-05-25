import Foundation
import SwiftUI

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

    static func storedCodeSectionID(for context: BrowserContextID) -> Int64? {
        let key = context.codeSectionDefaultsKey
        guard UserDefaults.standard.object(forKey: key) != nil else { return nil }
        let storedValue = UserDefaults.standard.integer(forKey: key)
        return storedValue < 0 ? nil : Int64(storedValue)
    }

    static func persistCodeSectionID(_ id: Int64?, for context: BrowserContextID) {
        UserDefaults.standard.set(id ?? -1, forKey: context.codeSectionDefaultsKey)
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
