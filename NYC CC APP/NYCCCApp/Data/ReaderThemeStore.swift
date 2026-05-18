import Foundation

final class ReaderThemeStore {
    private let defaults: UserDefaults
    private let key = "readerTheme"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> ReaderTheme {
        guard let data = defaults.data(forKey: key),
              let theme = try? JSONDecoder().decode(ReaderTheme.self, from: data) else {
            return .default
        }
        return theme
    }

    func save(_ theme: ReaderTheme) {
        guard let data = try? JSONEncoder().encode(theme) else { return }
        defaults.set(data, forKey: key)
    }
}
