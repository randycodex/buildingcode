import SwiftUI

enum CodeFilterChipMetrics {
    static let primaryChipWidth: CGFloat = 86
    static let savedPrimaryChipWidth: CGFloat = 104
}

struct CodeSectionMultiFilterChips: View {
    let sections: [CodeSectionCategory]
    @Binding var selectedIDs: Set<Int64>
    let accentForSection: (Int64) -> Color
    var primaryChipWidth: CGFloat = CodeFilterChipMetrics.primaryChipWidth

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // The "All Sections" chip uses a neutral grey rather than the
                // library's accent so it reads as a non-state (no code section
                // picked), matching how the All Tags chip behaves on Saved.
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
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color.appChromeOnFill : accent)
                .frame(width: minWidth)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
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
    static func load(key: String) -> Set<Int64> {
        guard let numbers = UserDefaults.standard.array(forKey: key) as? [NSNumber] else {
            return []
        }
        return Set(numbers.map(\.int64Value))
    }

    static func persist(_ ids: Set<Int64>, key: String) {
        if ids.isEmpty {
            UserDefaults.standard.removeObject(forKey: key)
        } else {
            UserDefaults.standard.set(Array(ids), forKey: key)
        }
    }
}
