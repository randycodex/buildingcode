import SwiftUI
import UIKit

// MARK: - Filter chips row (used in the Saved bottom dock)

/// Horizontal scroll of folder filter chips for the Saved screen. Always
/// renders an "All" chip on the left and a "+ New" affordance on the right
/// so the user can create folders without leaving the screen.
struct FolderFilterChipsRow: View {
    let folders: [CodeFolder]
    @Binding var selectedIDs: Set<Int64>
    let onNew: () -> Void
    /// Called when the user long-presses a folder chip and chooses Edit.
    /// Optional so callers that don't need editing (e.g. a read-only
    /// display) can omit it.
    var onEdit: ((CodeFolder) -> Void)? = nil

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip(
                    title: "All Projects",
                    accent: Color.secondary,
                    isSelected: selectedIDs.isEmpty,
                    minWidth: CodeFilterChipMetrics.savedPrimaryChipWidth
                ) {
                    selectedIDs = []
                }

                ForEach(folders) { folder in
                    filterChip(
                        title: folder.name,
                        accent: folder.color,
                        isSelected: selectedIDs.contains(folder.id),
                        leadingDot: folder.color
                    ) {
                        toggle(folder.id)
                    }
                    .contextMenu {
                        if let onEdit {
                            Button {
                                onEdit(folder)
                            } label: {
                                Label("Edit project", systemImage: "pencil")
                            }
                        }
                    }
                }

                Button(action: onNew) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.caption.weight(.bold))
                        Text("New")
                            .font(.subheadline.weight(.semibold))
                    }
                    .foregroundStyle(Color.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(
                        Capsule(style: .continuous)
                            .strokeBorder(Color.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    )
                }
                .buttonStyle(.plain)
            }
            .padding(.vertical, 2)
        }
    }

    private func toggle(_ id: Int64) {
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
        leadingDot: Color? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let leadingDot {
                    Circle()
                        .fill(isSelected ? Color.appChromeOnFill : leadingDot)
                        .frame(width: 6, height: 6)
                }
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(isSelected ? Color.appChromeOnFill : accent)
            .frame(width: minWidth)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(isSelected ? accent : accent.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Membership chips row (used inside the Reader)

/// Compact horizontal row showing every folder the current section belongs
/// to, with a tappable "✕" to remove this section from that folder. The
/// trailing "+ Project" opens the picker sheet to add membership.
struct FolderMembershipRow: View {
    let memberFolders: [CodeFolder]
    let onRemove: (CodeFolder) -> Void
    let onAdd: () -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(memberFolders) { folder in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(folder.color)
                            .frame(width: 6, height: 6)
                        Text(folder.name)
                            .font(.caption.weight(.semibold))
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            onRemove(folder)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(folder.color.opacity(0.7))
                                .frame(width: 16, height: 16)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove from \(folder.name)")
                    }
                    .padding(.leading, 10)
                    .padding(.trailing, 4)
                    .padding(.vertical, 5)
                    .background(
                        Capsule(style: .continuous)
                            .fill(folder.color.opacity(0.12))
                    )
                    .foregroundStyle(folder.color)
                }

                Button(action: onAdd) {
                    HStack(spacing: 4) {
                        Image(systemName: "folder.badge.plus")
                            .font(.caption.weight(.semibold))
                        Text(memberFolders.isEmpty ? "Add to project" : "Project")
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(Color.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule(style: .continuous)
                            .strokeBorder(Color.secondary.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Editor sheet (create or edit a folder)

struct FolderEditorSheet: View {
    /// Existing folder when editing; nil when creating new.
    let existing: CodeFolder?
    /// Called on Save tap. Validation (non-empty name) is handled inside.
    let onSave: (_ name: String, _ description: String, _ colorHex: String) -> Void
    /// Called on Delete tap. Only invoked when `existing != nil`.
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var description: String = ""
    @State private var colorHex: String = CodeFolder.defaultColorHex
    @State private var showsDeleteConfirm = false

    private var isEditing: Bool { existing != nil }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !trimmedName.isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Project name") {
                    TextField("e.g. Bronx R-2 Passive House", text: $name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                }

                Section("Color") {
                    HStack(spacing: 12) {
                        ForEach(CodeFolder.presetColorHexes, id: \.self) { hex in
                            colorSwatch(hex)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 4)
                }

                Section("Notes (optional)") {
                    TextField("Short description", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }

                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            showsDeleteConfirm = true
                        } label: {
                            Label("Delete project", systemImage: "trash")
                        }
                    } footer: {
                        Text("Bookmarked sections in this project will keep their bookmarks.")
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit project" : "New project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(trimmedName, description, colorHex)
                        dismiss()
                    }
                    .disabled(!canSave)
                    .fontWeight(.semibold)
                }
            }
            .confirmationDialog(
                "Delete this project?",
                isPresented: $showsDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Sections in this project keep their bookmarks. Only the project grouping is removed.")
            }
            .onAppear {
                if let existing {
                    name = existing.name
                    description = existing.description
                    colorHex = existing.colorHex
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func colorSwatch(_ hex: String) -> some View {
        let swatchColor = Color(uiColor: PlatformColor(hex: hex) ?? .systemBlue)
        let isSelected = hex.lowercased() == colorHex.lowercased()
        return Button {
            colorHex = hex
        } label: {
            ZStack {
                Circle()
                    .fill(swatchColor)
                    .frame(width: 32, height: 32)
                if isSelected {
                    Circle()
                        .strokeBorder(Color.appChrome, lineWidth: 2.5)
                        .frame(width: 38, height: 38)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Color")
    }
}

// MARK: - Picker sheet (assign current section to folders)

struct FolderPickerSheet: View {
    let folders: [CodeFolder]
    let memberFolderIDs: Set<Int64>
    /// Tap on a folder row toggles its membership for the current section.
    let onToggle: (CodeFolder) -> Void
    /// Tap on "+ New project" — caller opens FolderEditorSheet.
    let onCreateNew: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button(action: onCreateNew) {
                        Label("New project", systemImage: "folder.badge.plus")
                            .foregroundStyle(Color.appChrome)
                    }
                }

                Section("Your projects") {
                    if folders.isEmpty {
                        Text("No projects yet — tap “New project” above.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(folders) { folder in
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                onToggle(folder)
                            } label: {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(folder.color)
                                        .frame(width: 12, height: 12)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(folder.name)
                                            .foregroundStyle(.primary)
                                        if !folder.description.isEmpty {
                                            Text(folder.description)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: memberFolderIDs.contains(folder.id) ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(memberFolderIDs.contains(folder.id) ? folder.color : Color.secondary.opacity(0.5))
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .navigationTitle("Add to project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Shared color bridge

extension CodeFolder {
    var color: Color {
        Color(uiColor: PlatformColor(hex: colorHex) ?? .systemBlue)
    }
}
