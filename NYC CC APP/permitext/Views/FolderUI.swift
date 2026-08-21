import SwiftUI
import UIKit

// MARK: - Membership chips row (used inside the Reader)

/// Compact horizontal row showing every folder the current section belongs
/// to, with a tappable "✕" to remove this section from that folder. The
/// trailing "+ Folder" opens the picker sheet to add membership.
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
    let defaultFolderType: CodeFolderType
    /// Called on Save tap. Validation (non-empty name) is handled inside.
    let onSave: (_ name: String, _ address: String, _ description: String, _ colorHex: String, _ folderType: CodeFolderType) -> Void
    /// Called on Delete tap. Only invoked when `existing != nil`.
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var address: String = ""
    @State private var description: String = ""
    @State private var colorHex: String = CodeFolder.defaultColorHex
    @State private var showsDeleteConfirm = false

    private var isEditing: Bool { existing != nil }
    private var folderType: CodeFolderType { existing?.folderType ?? defaultFolderType }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !trimmedName.isEmpty }
    private var detents: Set<PresentationDetent> {
        isEditing ? [.large] : [.medium, .large]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(folderType == .project ? "Project name" : "Reference name") {
                    TextField(folderType == .project ? "e.g. Bronx R-2 Passive House" : "e.g. Egress research", text: $name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                }

                if folderType == .project {
                    Section("Project address") {
                        TextField("Address", text: $address, axis: .vertical)
                            .textInputAutocapitalization(.words)
                            .lineLimit(1...3)
                    }
                }

                Section("Description (optional)") {
                    TextField("Short description", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }

                if folderType == .project {
                    Section("Color") {
                        LazyVGrid(
                            columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 5),
                            spacing: 12
                        ) {
                            ForEach(CodeFolder.presetColorHexes, id: \.self) { hex in
                                colorSwatch(hex)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                if isEditing {
                    Section {
                        Button(role: .destructive) {
                            showsDeleteConfirm = true
                        } label: {
                            Label("Delete \(folderType == .project ? "project" : "reference")", systemImage: "trash")
                        }
                    } footer: {
                        Text("Saved sections in this folder keep their saved records.")
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit \(folderType.rawValue)" : "New \(folderType.rawValue)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(trimmedName, address, description, colorHex, folderType)
                        dismiss()
                    }
                    .disabled(!canSave)
                    .fontWeight(.semibold)
                }
            }
            .confirmationDialog(
                "Delete this folder?",
                isPresented: $showsDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Saved sections keep their saved records. Only this folder grouping is removed.")
            }
            .onAppear {
                if let existing {
                    name = existing.name
                    address = existing.address
                    description = existing.description
                    colorHex = existing.colorHex
                }
            }
        }
        .presentationDetents(detents)
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
    @Binding var selectedFolderIDs: Set<Int64>
    let canUseProjects: Bool
    let onSave: (Set<Int64>) -> Void
    let onCreateNew: (CodeFolderType) -> Void
    let onRequireProjectAccess: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button { onCreateNew(.reference) } label: {
                        Label("New reference", systemImage: "folder.badge.plus")
                            .foregroundStyle(Color.appChrome)
                    }
                    Button {
                        if canUseProjects {
                            onCreateNew(.project)
                        } else {
                            onRequireProjectAccess()
                        }
                    } label: {
                        HStack {
                            Label("New project", systemImage: "building.2.crop.circle")
                            Spacer()
                            if !canUseProjects { Text("Pro").font(.caption.weight(.semibold)) }
                        }
                        .foregroundStyle(canUseProjects ? Color.appChrome : Color.secondary)
                    }
                }

                Section("Your folders") {
                    if folders.isEmpty {
                        Text("Create a Reference or Project folder to save this section.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(folders) { folder in
                            let projectIsLocked = folder.folderType == .project &&
                                !canUseProjects &&
                                !selectedFolderIDs.contains(folder.id)
                            Button {
                                if projectIsLocked {
                                    onRequireProjectAccess()
                                    return
                                }
                                if selectedFolderIDs.contains(folder.id) {
                                    selectedFolderIDs.remove(folder.id)
                                } else {
                                    selectedFolderIDs.insert(folder.id)
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(folder.color)
                                        .frame(width: 12, height: 12)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(folder.name)
                                            .foregroundStyle(.primary)
                                        Text(folder.folderType == .project ? "Project" : "Reference")
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                        if !folder.description.isEmpty {
                                            Text(folder.description)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    if projectIsLocked {
                                        Text("Pro")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                    Image(systemName: selectedFolderIDs.contains(folder.id) ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(selectedFolderIDs.contains(folder.id) ? folder.color : Color.secondary.opacity(0.5))
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if selectedFolderIDs.isEmpty {
                    Text("Choose at least one destination to save.")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 8)
                }
            }
            .navigationTitle(memberFolderIDs.isEmpty ? "Save to folder" : "Edit folders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(memberFolderIDs.isEmpty ? "Save" : "Done") {
                        onSave(selectedFolderIDs)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .disabled(selectedFolderIDs.isEmpty)
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
