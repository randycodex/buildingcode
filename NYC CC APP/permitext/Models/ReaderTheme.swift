import Foundation
import SwiftUI

#if canImport(UIKit)
import UIKit
typealias PlatformFont = UIFont
typealias PlatformColor = UIColor
#elseif canImport(AppKit)
import AppKit
typealias PlatformFont = NSFont
typealias PlatformColor = NSColor
#endif

enum ReaderFontChoice: String, Codable, Identifiable, Sendable, CaseIterable {
    case sfPro
    case sfCompact
    case sfMono
    case newYork
    case sanFrancisco
    case serif
    case rounded
    case monospaced

    static var allCases: [ReaderFontChoice] {
        [.sfPro, .rounded, .newYork, .sfMono]
    }

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .sfPro:
            return "System"
        case .sfCompact:
            return "San Francisco"
        case .sfMono:
            return "Monospaced"
        case .newYork:
            return "Serif"
        case .sanFrancisco:
            return "San Francisco"
        case .serif:
            return "Serif"
        case .rounded:
            return "Rounded"
        case .monospaced:
            return "Monospaced"
        }
    }

    var normalizedChoice: ReaderFontChoice {
        switch self {
        case .sfPro, .sfMono, .newYork, .rounded:
            return self
        case .sanFrancisco:
            return .sfPro
        case .sfCompact:
            return .sfPro
        case .serif:
            return .newYork
        case .monospaced:
            return .sfMono
        }
    }
}

enum ReaderAccentPalette: String, Codable, Sendable {
    case codeBased
    case monochrome
}

struct ReaderTheme: Codable, Equatable, Hashable, Sendable {
    static let minimumFontSize: Double = 10
    static let maximumFontSize: Double = 26
    static let minimumLineSpacing: Double = 0
    static let maximumLineSpacing: Double = 12

    var fontChoice: ReaderFontChoice = .sfPro
    var fontSize: Double = minimumFontSize
    var lineSpacing: Double = minimumLineSpacing
    var paragraphSpacing: Double = 9
    var accentPalette: ReaderAccentPalette = .codeBased

    static let `default` = ReaderTheme()

    var normalized: ReaderTheme {
        var theme = self
        theme.fontChoice = theme.fontChoice.normalizedChoice
        theme.accentPalette = .codeBased
        theme.fontSize = min(max(theme.fontSize, Self.minimumFontSize), Self.maximumFontSize)
        theme.lineSpacing = min(max(theme.lineSpacing, Self.minimumLineSpacing), Self.maximumLineSpacing)
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

    func swiftUIFont(size: Double? = nil, emphasized: Bool = false) -> Font {
        let resolvedSize = size ?? fontSize
        let platformFont = emphasized
            ? fontChoice.boldFont(size: resolvedSize)
            : fontChoice.bodyFont(size: resolvedSize)
        #if canImport(UIKit)
        return Font(platformFont)
        #else
        return Font(platformFont)
        #endif
    }

    var accentColor: PlatformColor {
        return CodeSectionThemeProfile.building.accentColor
    }

    var highlightColor: PlatformColor {
        PlatformColor(hex: "#DCE7F2") ?? .systemBlueCompatible
    }

    var definedTermColor: PlatformColor {
        PlatformColor(hex: "#E8EEF3") ?? .systemBlueCompatible
    }

    var manualHighlightColor: PlatformColor {
        PlatformColor(hex: "#D4E2EF") ?? .systemBlueCompatible
    }
}

enum CodeSectionThemeProfile: Sendable {
    case building
    case fuelGas
    case administrative
    case mechanical
    case plumbing
    case zoning

    init(codeSectionName: String?) {
        let normalizedName = (codeSectionName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        switch normalizedName {
        case let name where name.contains("FUEL GAS"):
            self = .fuelGas
        case let name where name.contains("GENERAL ADMIN"):
            self = .administrative
        case let name where name.contains("MECHANICAL"):
            self = .mechanical
        case let name where name.contains("PLUMBING"):
            self = .plumbing
        case let name where name.contains("ZONING"):
            self = .zoning
        default:
            self = .building
        }
    }

    var lightAccentHex: String {
        switch self {
        case .building:
            return "#C96410"
        case .fuelGas:
            return "#C62828"
        case .administrative:
            return "#7C3AED"
        case .mechanical:
            return "#2F8F4E"
        case .plumbing:
            return "#0891B2"
        case .zoning:
            return "#2F6F68"
        }
    }

    var darkAccentHex: String {
        switch self {
        case .building:
            return "#FFB067"
        case .fuelGas:
            return "#FF7B7B"
        case .administrative:
            return "#C4A1FF"
        case .mechanical:
            return "#6EDC8C"
        case .plumbing:
            return "#67E8F9"
        case .zoning:
            return "#70C9BD"
        }
    }

    var accentColor: PlatformColor {
        dynamicColor(light: lightAccentHex, dark: darkAccentHex)
    }

    func accentHex(for colorScheme: ColorScheme) -> String {
        colorScheme == .dark ? darkAccentHex : lightAccentHex
    }

    private func dynamicColor(light: String, dark: String) -> PlatformColor {
        #if canImport(UIKit)
        return PlatformColor { trait in
            PlatformColor(hex: trait.userInterfaceStyle == .dark ? dark : light) ?? .systemBlueCompatible
        }
        #else
        return PlatformColor(hex: light) ?? .systemBlueCompatible
        #endif
    }
}

private extension ReaderFontChoice {
    func bodyFont(size: Double) -> PlatformFont {
        switch self {
        case .sfPro:
            #if canImport(UIKit)
            return UIFont(name: "SFProText-Regular", size: size)
                ?? UIFont(name: ".SFUIText-Regular", size: size)
                ?? .systemFont(ofSize: size)
            #else
            return .systemFont(ofSize: size)
            #endif
        case .sanFrancisco, .sfCompact:
            #if canImport(UIKit)
            return .systemFont(ofSize: size)
            #else
            return .systemFont(ofSize: size)
            #endif
        case .sfMono:
            #if canImport(UIKit)
            return UIFont(name: "SFMono-Regular", size: size)
                ?? .monospacedSystemFont(ofSize: size, weight: .regular)
            #else
            return .monospacedSystemFont(ofSize: size, weight: .regular)
            #endif
        case .newYork:
            #if canImport(UIKit)
            return UIFont(name: "NewYorkMedium-Regular", size: size)
                ?? UIFont(name: "NewYork-Regular", size: size)
                ?? UIFont(descriptor: UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body).withDesign(.serif) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body), size: size)
            #else
            return NSFont(name: "New York", size: size) ?? .systemFont(ofSize: size)
            #endif
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
        case .sfPro:
            #if canImport(UIKit)
            return UIFont(name: "SFProText-Semibold", size: size)
                ?? UIFont(name: ".SFUIText-Semibold", size: size)
                ?? .systemFont(ofSize: size, weight: .semibold)
            #else
            return .boldSystemFont(ofSize: size)
            #endif
        case .sanFrancisco, .sfCompact:
            #if canImport(UIKit)
            return .systemFont(ofSize: size, weight: .semibold)
            #else
            return .boldSystemFont(ofSize: size)
            #endif
        case .sfMono:
            #if canImport(UIKit)
            return UIFont(name: "SFMono-Semibold", size: size)
                ?? .monospacedSystemFont(ofSize: size, weight: .semibold)
            #else
            return .monospacedSystemFont(ofSize: size, weight: .semibold)
            #endif
        case .newYork:
            #if canImport(UIKit)
            return UIFont(name: "NewYorkMedium-Semibold", size: size)
                ?? UIFont(name: "NewYork-Semibold", size: size)
                ?? UIFont(descriptor: UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline).withDesign(.serif) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .headline), size: size)
            #else
            return NSFont(name: "New York Bold", size: size) ?? .boldSystemFont(ofSize: size)
            #endif
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

extension PlatformColor {
    static var systemBlueCompatible: PlatformColor {
        #if canImport(UIKit)
        return .systemBlue
        #else
        return .systemBlue
        #endif
    }

    static var labelCompatible: PlatformColor {
        #if canImport(UIKit)
        return .label
        #else
        return .labelColor
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

}
