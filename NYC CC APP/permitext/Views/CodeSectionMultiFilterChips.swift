import SwiftUI

enum CodeFilterChipMetrics {
    static let primaryChipWidth: CGFloat = 86
    static let savedPrimaryChipWidth: CGFloat = 104
    static let spacing: CGFloat = 8
    static let horizontalPadding: CGFloat = 14
    static let verticalPadding: CGFloat = 7
    static let compactHorizontalPadding: CGFloat = 12
    static let minHeight: CGFloat = 32
    static let font = Font.subheadline.weight(.semibold)
}

struct CodeSectionMultiFilterChips: View {
    let sections: [CodeSectionCategory]
    @Binding var selectedIDs: Set<Int64>
    let accentForSection: (Int64) -> Color
    var primaryChipWidth: CGFloat = CodeFilterChipMetrics.primaryChipWidth

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: CodeFilterChipMetrics.spacing) {
                // The "All Sections" chip uses a neutral grey rather than the
                // library's accent so it reads as a non-state (no code section
                // picked), matching the inclusive multi-filter behavior on Saved.
                filterChip(
                    title: "All Sections",
                    accent: Color.secondary,
                    isSelected: selectedIDs.isEmpty,
                    minWidth: primaryChipWidth
                ) {
                    selectedIDs = []
                }

                ForEach(sections) { codeSection in
                    let isSelected = selectedIDs.contains(codeSection.id)
                    filterChip(
                        title: CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                        accent: accentForSection(codeSection.id),
                        isSelected: isSelected
                    ) {
                        toggleSection(codeSection.id)
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func toggleSection(_ id: Int64) {
        if selectedIDs.isEmpty {
            selectedIDs = [id]
            return
        }

        if selectedIDs.contains(id) {
            selectedIDs.remove(id)
        } else {
            selectedIDs.insert(id)
        }
    }

    private func filterChip(
        title: String,
        accent: Color,
        isSelected: Bool,
        minWidth: CGFloat? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(CodeFilterChipMetrics.font)
                .foregroundStyle(isSelected ? Color.appChromeOnFill : accent)
                .frame(width: minWidth)
                .padding(.horizontal, CodeFilterChipMetrics.horizontalPadding)
                .padding(.vertical, CodeFilterChipMetrics.verticalPadding)
                .frame(minHeight: CodeFilterChipMetrics.minHeight)
                .background(
                    Capsule(style: .continuous)
                        .fill(isSelected ? accent : accent.opacity(0.12))
                )
        }
        .buttonStyle(.plain)
    }
}

/// Shared `UserDefaults` persistence for `Set<Int64>` filter selections.
/// Used by Search and Saved (Bookmarks) to keep their chip selections sticky.
enum FilterIDsStorage {
    static func load(key: String, defaults: UserDefaults = .standard) -> Set<Int64> {
        guard let numbers = defaults.array(forKey: key) as? [NSNumber] else {
            return []
        }
        return Set(numbers.map(\.int64Value))
    }

    static func persist(
        _ ids: Set<Int64>,
        key: String,
        defaults: UserDefaults = .standard
    ) {
        if ids.isEmpty {
            defaults.removeObject(forKey: key)
        } else {
            defaults.set(Array(ids), forKey: key)
        }
    }
}
