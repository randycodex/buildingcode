import Foundation

#if canImport(UIKit)
import UIKit
typealias PlatformFont = UIFont
typealias PlatformColor = UIColor
#elseif canImport(AppKit)
import AppKit
typealias PlatformFont = NSFont
typealias PlatformColor = NSColor
#endif

enum ReaderFontChoice: String, CaseIterable, Codable, Identifiable, Sendable {
    case system
    case serif
    case rounded
    case monospaced

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system:
            return "System"
        case .serif:
            return "Serif"
        case .rounded:
            return "Rounded"
        case .monospaced:
            return "Monospaced"
        }
    }
}

enum ReaderAccentPalette: String, CaseIterable, Codable, Identifiable, Sendable {
    case civicBlue
    case graphite
    case forest
    case brick

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .civicBlue:
            return "Civic Blue"
        case .graphite:
            return "Graphite"
        case .forest:
            return "Forest"
        case .brick:
            return "Brick"
        }
    }

    var hexColor: String {
        switch self {
        case .civicBlue:
            return "#1D4F91"
        case .graphite:
            return "#43464B"
        case .forest:
            return "#2E6B4C"
        case .brick:
            return "#914535"
        }
    }
}

struct ReaderTheme: Codable, Equatable, Hashable, Sendable {
    static let minimumFontSize: Double = 10
    static let maximumFontSize: Double = 26

    var fontChoice: ReaderFontChoice = .system
    var fontSize: Double = 17
    var lineSpacing: Double = 5
    var paragraphSpacing: Double = 9
    var accentPalette: ReaderAccentPalette = .civicBlue

    static let `default` = ReaderTheme()

    var normalized: ReaderTheme {
        var theme = self
        theme.fontSize = min(max(theme.fontSize, Self.minimumFontSize), Self.maximumFontSize)
        return theme
    }

    var bodyFont: PlatformFont {
        fontChoice.bodyFont(size: fontSize)
    }

    var boldFont: PlatformFont {
        fontChoice.boldFont(size: fontSize)
    }

    var italicFont: PlatformFont {
        fontChoice.italicFont(size: fontSize)
    }

    var accentColor: PlatformColor {
        PlatformColor(hex: accentPalette.hexColor) ?? .systemBlueCompatible
    }

    var highlightColor: PlatformColor {
        accentColor.withAlphaComponentCompatible(0.18)
    }

    var definedTermColor: PlatformColor {
        accentColor.withAlphaComponentCompatible(0.10)
    }

    var manualHighlightColor: PlatformColor {
        accentColor.withAlphaComponentCompatible(0.28)
    }
}

private extension ReaderFontChoice {
    func bodyFont(size: Double) -> PlatformFont {
        switch self {
        case .system:
            return .systemFont(ofSize: size)
        case .serif:
            #if canImport(UIKit)
            return UIFont(descriptor: UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body).withDesign(.serif) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body), size: size)
            #else
            return NSFont(name: "Times New Roman", size: size) ?? .systemFont(ofSize: size)
            #endif
        case .rounded:
            #if canImport(UIKit)
            return UIFont(descriptor: UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body).withDesign(.rounded) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body), size: size)
            #else
            return .systemFont(ofSize: size, weight: .regular)
            #endif
        case .monospaced:
            return .monospacedSystemFont(ofSize: size, weight: .regular)
        }
    }

    func boldFont(size: Double) -> PlatformFont {
        switch self {
        case .system:
            return .systemFont(ofSize: size, weight: .semibold)
        case .serif:
            #if canImport(UIKit)
            let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline).withDesign(.serif) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline)
            return UIFont(descriptor: descriptor, size: size)
            #else
            return NSFont(name: "Times New Roman Bold", size: size) ?? .boldSystemFont(ofSize: size)
            #endif
        case .rounded:
            #if canImport(UIKit)
            let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline).withDesign(.rounded) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline)
            return UIFont(descriptor: descriptor, size: size)
            #else
            return .boldSystemFont(ofSize: size)
            #endif
        case .monospaced:
            return .monospacedSystemFont(ofSize: size, weight: .semibold)
        }
    }

    func italicFont(size: Double) -> PlatformFont {
        bodyFont(size: size).withItalicTrait()
    }
}

private extension PlatformFont {
    func withItalicTrait() -> PlatformFont {
        #if canImport(UIKit)
        guard let descriptor = fontDescriptor.withSymbolicTraits(.traitItalic) else { return self }
        return PlatformFont(descriptor: descriptor, size: pointSize)
        #else
        let descriptor = fontDescriptor.withSymbolicTraits(.italic)
        return PlatformFont(descriptor: descriptor, size: pointSize) ?? self
        #endif
    }
}

private extension PlatformColor {
    static var systemBlueCompatible: PlatformColor {
        #if canImport(UIKit)
        return .systemBlue
        #else
        return .systemBlue
        #endif
    }

    convenience init?(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard cleaned.count == 6, let value = Int(cleaned, radix: 16) else { return nil }
        let red = CGFloat((value >> 16) & 0xFF) / 255
        let green = CGFloat((value >> 8) & 0xFF) / 255
        let blue = CGFloat(value & 0xFF) / 255
        #if canImport(UIKit)
        self.init(red: red, green: green, blue: blue, alpha: 1)
        #else
        self.init(calibratedRed: red, green: green, blue: blue, alpha: 1)
        #endif
    }

    func withAlphaComponentCompatible(_ alpha: CGFloat) -> PlatformColor {
        #if canImport(UIKit)
        return withAlphaComponent(alpha)
        #else
        return withAlphaComponent(alpha)
        #endif
    }
}
