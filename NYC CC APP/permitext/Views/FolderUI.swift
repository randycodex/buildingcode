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
    let onSave: (_ name: String, _ address: String, _ description: String, _ structuredFacts: [ProjectStructuredFact], _ colorHex: String, _ folderType: CodeFolderType) -> Void
    /// Called on Delete tap. Only invoked when `existing != nil`.
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var name: String = ""
    @State private var address: String = ""
    @State private var description: String = ""
    @State private var colorHex: String = CodeFolder.defaultColorHex
    @State private var showsDeleteConfirm = false
    @State private var isSaving = false
    @State private var propertyLookupStatus = ""
    @State private var propertyLookupSucceeded = false
    @State private var propertyLookupAddress = ""
    @State private var propertyContext: BackendProjectPropertyContext?
    @FocusState private var addressIsFocused: Bool

    private var isEditing: Bool { existing != nil }
    private var folderType: CodeFolderType { existing?.folderType ?? defaultFolderType }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool {
        !trimmedName.isEmpty && !isSaving &&
        (folderType != .project || !address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
    private var detents: Set<PresentationDetent> {
        isEditing || folderType == .project ? [.large] : [.medium, .large]
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
                            .accessibilityIdentifier("project-editor-address")
                            .textInputAutocapitalization(.words)
                            .lineLimit(1...3)
                            .focused($addressIsFocused)
                            .onSubmit { Task { _ = await lookupPropertyContext() } }
                        if !propertyLookupStatus.isEmpty {
                            HStack(spacing: 6) {
                                if isSaving && propertyContext == nil {
                                    ProgressView()
                                        .controlSize(.small)
                                }
                                Text(propertyLookupStatus)
                            }
                            .font(.caption)
                            .foregroundStyle(propertyLookupSucceeded ? Color.green : Color.secondary)
                        }
                    }
                }

                if folderType == .reference {
                    Section("Description (optional)") {
                        TextField("Short description", text: $description, axis: .vertical)
                            .accessibilityIdentifier("project-editor-description")
                            .lineLimit(2...4)
                    }
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
                        Task { await save() }
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
            .onChange(of: address) { _, newValue in
                if newValue.trimmingCharacters(in: .whitespacesAndNewlines) != propertyLookupAddress {
                    propertyContext = nil
                    propertyLookupAddress = ""
                    propertyLookupStatus = ""
                    propertyLookupSucceeded = false
                }
            }
            .onChange(of: addressIsFocused) { _, isFocused in
                if !isFocused {
                    Task { _ = await lookupPropertyContext() }
                }
            }
        }
        .presentationDetents(detents)
    }

    @MainActor
    private func lookupPropertyContext() async -> BackendProjectPropertyContext? {
        let trimmedAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let existingAddress = existing?.address.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard folderType == .project,
              !trimmedAddress.isEmpty,
              !isEditing || trimmedAddress != existingAddress
        else { return nil }
        if propertyLookupAddress == trimmedAddress, let propertyContext { return propertyContext }
        guard library.signedInAccount != nil else {
            propertyLookupStatus = "Sign in to import official NYC property facts. The Project can still be saved."
            propertyLookupSucceeded = false
            return nil
        }
        propertyLookupStatus = "Looking up official NYC property data…"
        propertyLookupSucceeded = false
        do {
            let result = try await library.projectPropertyContext(address: trimmedAddress)
            guard address.trimmingCharacters(in: .whitespacesAndNewlines) == trimmedAddress else { return nil }
            propertyContext = result
            propertyLookupAddress = result.normalizedAddress
            address = result.normalizedAddress
            let sourcedCount = result.structuredFacts.filter { $0.status == "sourced" }.count
            propertyLookupStatus = "Imported \(sourcedCount) sourced facts from NYC Planning."
            propertyLookupSucceeded = true
            return result
        } catch {
            guard address.trimmingCharacters(in: .whitespacesAndNewlines) == trimmedAddress else { return nil }
            propertyContext = nil
            propertyLookupAddress = trimmedAddress
            propertyLookupStatus = "NYC property facts could not be imported. The Project can still be saved."
            propertyLookupSucceeded = false
            return nil
        }
    }

    @MainActor
    private func save() async {
        guard canSave else { return }
        isSaving = true
        let property = await lookupPropertyContext()
        let savedAddress = property?.normalizedAddress ?? address
        let addressChanged = savedAddress.trimmingCharacters(in: .whitespacesAndNewlines) !=
            (existing?.address.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
        let savedFacts = property?.structuredFacts ?? (addressChanged ? [] : existing?.structuredFacts ?? [])
        let savedDescription = folderType == .project
            ? existing.flatMap { library.folder(id: $0.id) }?.description ?? existing?.description ?? ""
            : description
        onSave(trimmedName, savedAddress, savedDescription, savedFacts, colorHex, folderType)
        dismiss()
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


/// Edits the Project's context without replacing its other saved fields.
struct ProjectContextView: View {
    let folderID: Int64
    let accentColor: Color

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var editingFolder: CodeFolder?
    @State private var editingSessionID: UUID?
    @State private var draft = ""
    @State private var saveError: String?

    private var folder: CodeFolder? { library.folder(id: folderID) }
    private var isEditing: Bool { editingFolder != nil }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topLeading) {
                ProjectContextTextView(
                    text: isEditing ? draft : folder?.description ?? "",
                    isEditing: isEditing,
                    onBeginEditing: beginEditing,
                    onTextChange: { draft = $0 }
                )
                if !isEditing && (folder?.description.isEmpty ?? true) {
                    Text("Tap to add Project context.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .allowsHitTesting(false)
                }
            }
            if let saveError {
                Text(saveError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
        .padding(.top, CodeScreenMetrics.topTitlePadding)
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("Project Context")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(isEditing)
        .tint(Color.appChrome)
        .toolbar {
            if isEditing {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: finishEditing)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save", action: save)
                        .fontWeight(.semibold)
                        .accessibilityIdentifier("project-context-save")
                }
            }
        }
        .onChange(of: library.privateSessionID) { _, _ in
            finishEditing()
            dismiss()
        }
        .onChange(of: folder?.clientID) { _, _ in
            finishEditing()
            dismiss()
        }
    }

    private func beginEditing() -> Bool {
        guard let folder, library.requireProjectAccess() else { return false }
        draft = folder.description
        editingFolder = folder
        editingSessionID = library.privateSessionID
        saveError = nil
        return true
    }

    private func save() {
        guard let editingFolder, let editingSessionID else { return }
        if library.updateProjectContext(
            folderID: folderID, description: draft,
            expectedClientID: editingFolder.clientID,
            expectedDescription: editingFolder.description,
            sessionID: editingSessionID
        ) {
            finishEditing()
        } else {
            saveError = library.statusMessage ?? "Project context could not be saved. Try again."
        }
    }

    private func finishEditing() {
        editingFolder = nil
        editingSessionID = nil
        draft = ""
        saveError = nil
    }
}

/// Keep the same text surface and native tap-to-caret behavior in both modes.
private struct ProjectContextTextView: UIViewRepresentable {
    let text: String
    let isEditing: Bool
    let onBeginEditing: () -> Bool
    let onTextChange: (String) -> Void

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.backgroundColor = .clear
        view.font = .preferredFont(forTextStyle: .subheadline)
        view.adjustsFontForContentSizeCategory = true
        view.textColor = .secondaryLabel
        view.tintColor = UIColor(Color.appChrome)
        view.textContainerInset = UIEdgeInsets(top: 0, left: 0, bottom: 8, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.contentInsetAdjustmentBehavior = .never
        view.keyboardDismissMode = .interactive
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        view.delegate = context.coordinator
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        if !isEditing && view.isFirstResponder { view.resignFirstResponder() }
        // Reassigning text on every SwiftUI update would reset native selection
        // and scroll position as the keyboard appears or the user types.
        if view.text != text {
            let selection = view.selectedRange
            view.text = text
            let length = (text as NSString).length
            let location = min(selection.location, length)
            view.selectedRange = NSRange(location: location, length: min(selection.length, length - location))
        }
        view.accessibilityLabel = "Project context"
        view.accessibilityHint = "Edit Project context"
        view.accessibilityIdentifier = isEditing ? "project-context-editor" : "project-context-text"
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ProjectContextTextView

        init(parent: ProjectContextTextView) { self.parent = parent }

        func textViewShouldBeginEditing(_ textView: UITextView) -> Bool {
            parent.isEditing || parent.onBeginEditing()
        }

        func textViewDidChange(_ textView: UITextView) {
            parent.onTextChange(textView.text)
        }
    }
}

/// Shows shared provenance once, beneath the fact list.
struct ProjectStructuredFactsSources: View {
    let facts: [ProjectStructuredFact]

    var body: some View {
        let notes = ProjectFactSourceNote.grouped(from: facts)
        if !notes.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Source information")
                    .font(.caption.weight(.semibold))
                ForEach(notes) { note in
                    VStack(alignment: .leading, spacing: 4) {
                        if notes.count > 1 {
                            Text(note.factLabels.joined(separator: ", "))
                                .fontWeight(.semibold)
                        }
                        Text(note.message)
                            .textSelection(.enabled)
                        let dates = note.updatedDates.reduce(into: [String]()) { result, date in
                            let text = date.formatted(date: .abbreviated, time: .omitted)
                            if !result.contains(text) { result.append(text) }
                        }
                        if !dates.isEmpty {
                            Text("Updated \(dates.joined(separator: "; "))")
                        }
                    }
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 16)
            .accessibilityIdentifier("project-facts-sources")
        }
    }
}

struct ProjectStructuredFactRow: View {
    let fact: ProjectStructuredFact

    private var statusLabel: String {
        switch fact.status.lowercased() {
        case "sourced": return "Sourced"
        case "confirmed": return "Confirmed"
        case "stated": return "Stated"
        case "rejected": return "Rejected"
        default: return "Unknown"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(fact.label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(fact.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Not provided" : fact.value)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Text(statusLabel)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
    }
}
