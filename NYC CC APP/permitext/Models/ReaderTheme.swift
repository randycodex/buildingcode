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
    case sourceSerif4
    case sfPro
    case sfCompact
    case sfMono
    case newYork
    case sanFrancisco
    case serif
    case rounded
    case monospaced

    static var allCases: [ReaderFontChoice] {
        [.sourceSerif4]
    }

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .sourceSerif4:
            return "Source Serif 4"
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
        .sourceSerif4
    }
}

enum ReaderAccentPalette: String, Codable, Sendable {
    case codeBased
    case monochrome
}

struct ReaderTheme: Codable, Equatable, Hashable, Sendable {
    static let minimumFontSize: Double = 17
    static let maximumFontSize: Double = 26
    static let minimumLineSpacing: Double = 0
    static let maximumLineSpacing: Double = 12

    var fontChoice: ReaderFontChoice = .sourceSerif4
    var fontSize: Double = 17
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
    case energy
    case electrical
    case existingBuilding
    case fire
    case historical
    case housing
    case environmental
    case landUse
    case housingBuildings
    case currentConsolidation
    case localLaw

    init(codeSectionName: String?) {
        let normalizedName = (codeSectionName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        switch normalizedName {
        case let name where name.contains("ENERGY CONSERVATION"):
            self = .energy
        case let name where name.contains("ELECTRICAL"):
            self = .electrical
        case let name where name.contains("EXISTING BUILDING"):
            self = .existingBuilding
        case let name where name.contains("FIRE CODE"):
            self = .fire
        case let name where name.contains("1968 BUILDING"):
            self = .historical
        case let name where name.contains("HOUSING MAINTENANCE"):
            self = .housing
        case let name where name.contains("TITLE 24"):
            self = .environmental
        case let name where name.contains("TITLE 25"):
            self = .landUse
        case let name where name.contains("TITLE 26"):
            self = .housingBuildings
        case let name where name.contains("TITLE 28"):
            self = .currentConsolidation
        case let name where name.contains("LOCAL LAW"):
            self = .localLaw
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
        case .energy:
            return "#A15C00"
        case .electrical:
            return "#4338CA"
        case .existingBuilding:
            return "#A33A7C"
        case .fire:
            return "#BE123C"
        case .historical:
            return "#7A5A2E"
        case .housing:
            return "#2563A6"
        case .environmental:
            return "#087F5B"
        case .landUse:
            return "#6D28D9"
        case .housingBuildings:
            return "#475569"
        case .currentConsolidation:
            return "#1D4ED8"
        case .localLaw:
            return "#9A3412"
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
        case .energy:
            return "#FFC857"
        case .electrical:
            return "#9CA8FF"
        case .existingBuilding:
            return "#FF8DCF"
        case .fire:
            return "#FB7185"
        case .historical:
            return "#D6B27A"
        case .housing:
            return "#7CB7FF"
        case .environmental:
            return "#5EE0B0"
        case .landUse:
            return "#BFA3FF"
        case .housingBuildings:
            return "#A9B6C8"
        case .currentConsolidation:
            return "#7DA6FF"
        case .localLaw:
            return "#FB9B72"
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
        sourceSerifFont(size: size, weight: .regular, italic: false)
    }

    func boldFont(size: Double) -> PlatformFont {
        sourceSerifFont(size: size, weight: .semibold, italic: false)
    }

    func italicFont(size: Double) -> PlatformFont {
        sourceSerifFont(size: size, weight: .regular, italic: true)
    }

    private func sourceSerifFont(size: Double, weight: PlatformFont.Weight, italic: Bool) -> PlatformFont {
        #if canImport(UIKit)
        let postScriptName = italic ? "SourceSerif4Variable-Italic" : "SourceSerif4Variable-Roman"
        guard let registeredFont = UIFont(name: postScriptName, size: size) else {
            let fallbackDescriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body)
                .withDesign(.serif) ?? UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body)
            return UIFont(descriptor: fallbackDescriptor, size: size)
        }
        let descriptor = registeredFont.fontDescriptor.addingAttributes([
            .traits: [UIFontDescriptor.TraitKey.weight: weight]
        ])
        return UIFont(descriptor: descriptor, size: size)
        #else
        return NSFont(name: italic ? "Source Serif 4 Variable Italic" : "Source Serif 4 Variable", size: size)
            ?? .systemFont(ofSize: size, weight: weight)
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
