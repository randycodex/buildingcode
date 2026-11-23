import SwiftUI

enum ListSelectionMotion {
    static func run(reduceMotion: Bool, _ change: () -> Void) {
        withAnimation(reduceMotion ? nil : .smooth(duration: 0.36), change)
    }
}

struct ToolbarActionIcon: View {
    let systemImage: String

    var body: some View {
        Image(systemName: systemImage)
            .resizable()
            .scaledToFit()
            .frame(width: CodeScreenMetrics.toolbarIconPointSize, height: CodeScreenMetrics.toolbarIconPointSize)
            .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
            .contentShape(Rectangle())
            .accessibilityHidden(true)
    }
}

struct EditToolbarItem: ToolbarContent {
    let label: String
    let identifier: String
    var isDisabled = false
    let action: () -> Void

    @ToolbarContentBuilder
    var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            item.sharedBackgroundVisibility(.hidden)
        } else {
            item
        }
    }

    private var item: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button(action: action) {
                ToolbarActionIcon(systemImage: "pencil")
                    .foregroundStyle(Color.appChrome)
            }
            .buttonStyle(.plain)
            .codeLiquidGlassCircle()
            .disabled(isDisabled)
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier)
        }
    }
}

struct IconToolbarGroup<Actions: View>: ToolbarContent {
    @ViewBuilder let actions: () -> Actions

    var body: some ToolbarContent {
        if #available(iOS 26.0, *) {
            trailingItem.sharedBackgroundVisibility(.hidden)
        } else {
            trailingItem
        }
    }

    private var trailingItem: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: 0, content: actions)
                .buttonStyle(.plain)
                .codeLiquidGlassCapsule()
        }
    }
}

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
        IconToolbarGroup {
            Button(action: allSelected ? deselectAll : selectAll) {
                ToolbarActionIcon(systemImage: allSelected ? "circle" : "checkmark.circle")
            }
            .accessibilityLabel(allSelected ? "Deselect All" : "Select All")
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
            ToolbarActionIcon(systemImage: "checklist")
        }
        .accessibilityLabel(title)
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
            .transition(.opacity)
            .accessibilityHidden(true)
    }
}

struct CodeSearchBar<Field: View>: View {
    @Environment(\.colorScheme) private var colorScheme

    let showsClearButton: Bool
    let clearTitle: String
    let clear: () -> Void
    var whiteForegroundInDarkMode = false
    @ViewBuilder let field: (Color?) -> Field

    private var foreground: Color? {
        whiteForegroundInDarkMode && colorScheme == .dark ? .white : nil
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(foreground ?? .secondary)
                .accessibilityHidden(true)
            field(foreground)
                .foregroundColor(foreground)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if showsClearButton {
                SearchFieldClearButton(title: clearTitle, action: clear)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: CodeScreenMetrics.bottomControlHeight)
        .codeLiquidGlassCapsule()
        .accessibilityElement(children: .contain)
    }
}

extension View {
    @ViewBuilder
    func codeSoftTopScrollEdges() -> some View {
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.soft, for: .top)
        } else {
            self
        }
    }

    @ViewBuilder
    func codePinnedTopBar<Bar: View>(@ViewBuilder content: () -> Bar) -> some View {
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.soft, for: .top)
                .safeAreaBar(edge: .top, spacing: 0, content: content)
        } else {
            safeAreaInset(edge: .top, spacing: 0) {
                content().background {
                    CodeTopEdgeMaterial().ignoresSafeArea(.container, edges: .top)
                }
            }
        }
    }

    @ViewBuilder
    func codeNavigationTopScrollEdge() -> some View {
        if #available(iOS 26.0, *) {
            scrollEdgeEffectStyle(.soft, for: .top)
        } else {
            overlay(alignment: .top) {
                GeometryReader { proxy in
                    CodeTopEdgeMaterial()
                        .frame(height: proxy.safeAreaInsets.top)
                        .ignoresSafeArea(.container, edges: .top)
                }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
    }

    func bottomSearchBarPlacement() -> some View {
        self
        .accessibilityIdentifier("bottom-search-bar")
        .padding(.horizontal, CodeScreenMetrics.bottomControlHorizontalPadding)
        .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
    }
}

private struct CodeTopEdgeMaterial: View {
    var body: some View {
        Rectangle()
            .fill(.regularMaterial)
            .mask {
                LinearGradient(
                    stops: [
                        .init(color: .black, location: 0),
                        .init(color: .black, location: 0.42),
                        .init(color: .clear, location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
    }
}

private struct SearchFieldClearButton: View {
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
