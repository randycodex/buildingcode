import SwiftUI

struct ListSelectionToolbar<Actions: View>: ToolbarContent {
    let selectedCount: Int
    let availableCount: Int
    var isBusy = false
    let cancel: () -> Void
    let selectAll: () -> Void
    let deselectAll: () -> Void
    @ViewBuilder let actions: () -> Actions

    private var allSelected: Bool { availableCount > 0 && selectedCount == availableCount }

    @ToolbarContentBuilder var body: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Cancel", action: cancel)
                .tint(Color.appChrome)
                .disabled(isBusy)
        }
        ToolbarItem(placement: .principal) {
            Text("\(selectedCount) selected")
                .font(.headline)
                .lineLimit(1)
                .accessibilityIdentifier("list-selection-count")
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button(action: allSelected ? deselectAll : selectAll) {
                Label(allSelected ? "Deselect All" : "Select All",
                      systemImage: allSelected ? "circle" : "checkmark.circle")
                    .labelStyle(.iconOnly)
            }
            .tint(Color.appChrome)
            .disabled(availableCount == 0 || isBusy)

            actions()
                .disabled(selectedCount == 0 || isBusy)
        }
    }
}

struct ListSelectButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: "checklist")
                .labelStyle(.iconOnly)
        }
        .tint(Color.appChrome)
    }
}

struct ListSelectionIndicator: View {
    let isSelected: Bool

    var body: some View {
        Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
            .font(.body.weight(.semibold))
            .foregroundStyle(isSelected ? Color.appChrome : Color.secondary)
            .frame(width: 24, height: 24)
            .accessibilityHidden(true)
    }
}

struct SearchFieldClearButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct SheetCloseButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button("Close", action: action)
            .accessibilityLabel(title)
    }
}
