import Foundation

final class ReaderThemeStore {
    private let defaults: UserDefaults
    private let key = "readerTheme"
    private let defaultTextMetricsMigrationKey = "readerTheme.defaultTextMetricsMigration.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> ReaderTheme {
        guard let data = defaults.data(forKey: key),
              var theme = try? JSONDecoder().decode(ReaderTheme.self, from: data) else {
            return .default
        }
        if !defaults.bool(forKey: defaultTextMetricsMigrationKey),
           theme.fontSize == 17,
           theme.lineSpacing == 5 {
            theme.fontSize = ReaderTheme.default.fontSize
            theme.lineSpacing = ReaderTheme.default.lineSpacing
            save(theme)
            defaults.set(true, forKey: defaultTextMetricsMigrationKey)
        }
        return theme
    }

    func save(_ theme: ReaderTheme) {
        guard let data = try? JSONEncoder().encode(theme) else { return }
        defaults.set(data, forKey: key)
    }
}
