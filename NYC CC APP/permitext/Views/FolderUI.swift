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
    @State private var pendingPropertyLookup: PropertyLookup?
    @State private var propertyWarnings: [String] = []

    private struct PropertyLookup {
        let id = UUID()
        let address: String
        let task: Task<BackendProjectPropertyContext, Error>
    }
    @FocusState private var addressIsFocused: Bool

    private var isEditing: Bool { existing != nil }
    private var folderType: CodeFolderType { existing?.folderType ?? .project }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { !trimmedName.isEmpty && !isSaving }
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
                    Section("Project address (optional)") {
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
                        if let matchedAddress = propertyContext?.normalizedAddress,
                           !matchedAddress.isEmpty,
                           matchedAddress.caseInsensitiveCompare(address.trimmingCharacters(in: .whitespacesAndNewlines)) != .orderedSame {
                            Text("Matched tax-lot address: \(matchedAddress)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(propertyWarnings, id: \.self) { warning in
                            Label(warning, systemImage: "exclamationmark.triangle")
                                .font(.caption)
                                .foregroundStyle(.primary)
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
            .disabled(isSaving)
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
                let trimmedAddress = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                if let pendingPropertyLookup, pendingPropertyLookup.address != trimmedAddress {
                    pendingPropertyLookup.task.cancel()
                    self.pendingPropertyLookup = nil
                }
                if trimmedAddress != propertyLookupAddress, pendingPropertyLookup?.address != trimmedAddress {
                    propertyContext = nil
                    propertyLookupAddress = ""
                    propertyLookupStatus = ""
                    propertyLookupSucceeded = false
                    propertyWarnings = []
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
        let lookup: PropertyLookup
        if let pendingPropertyLookup, pendingPropertyLookup.address == trimmedAddress {
            lookup = pendingPropertyLookup
        } else {
            pendingPropertyLookup?.task.cancel()
            lookup = PropertyLookup(address: trimmedAddress, task: Task {
                try await library.projectPropertyContext(address: trimmedAddress)
            })
            pendingPropertyLookup = lookup
            propertyLookupStatus = "Looking up official NYC property data…"
            propertyLookupSucceeded = false
        }
        let outcome = await lookup.task.result
        guard address.trimmingCharacters(in: .whitespacesAndNewlines) == trimmedAddress else { return nil }
        guard pendingPropertyLookup?.id == lookup.id else {
            return propertyLookupAddress == trimmedAddress ? propertyContext : nil
        }
        pendingPropertyLookup = nil
        propertyLookupAddress = trimmedAddress
        switch outcome {
        case .success(let result):
            propertyContext = result
            var seenWarnings: Set<String> = []
            propertyWarnings = result.warnings.filter { !$0.isEmpty && seenWarnings.insert($0).inserted }
            let count = result.structuredFacts.filter { $0.status == "sourced" }.count
            let facts = count == 1 ? "1 sourced fact" : "\(count) sourced facts"
            propertyLookupStatus = result.isPartialImport
                ? "Partial import. Imported \(facts) from NYC Planning."
                : "Imported \(facts) from NYC Planning."
            propertyLookupSucceeded = !result.isPartialImport
            return result
        case .failure:
            propertyContext = nil
            propertyWarnings = []
            propertyLookupStatus = "NYC property facts could not be imported. The Project can still be saved."
            return nil
        }
    }

    @MainActor
    private func save() async {
        guard canSave else { return }
        isSaving = true
        defer { isSaving = false }
        let enteredAddress = address.trimmingCharacters(in: .whitespacesAndNewlines)
        let partialResultWasVisible = propertyLookupAddress == enteredAddress && propertyContext?.isPartialImport == true
        let property = await lookupPropertyContext()
        // Let people read an incomplete import before committing it.
        if !partialResultWasVisible && property?.isPartialImport == true { return }
        let addressChanged = enteredAddress != (existing?.address.trimmingCharacters(in: .whitespacesAndNewlines) ?? "")
        let existingFacts = existing?.structuredFacts ?? []
        let retainedFacts = addressChanged ? existingFacts.filter { $0.source != "nyc-planning" } : existingFacts
        let retainedKeys = Set(retainedFacts.map(\.key))
        let savedFacts = retainedFacts + (property?.structuredFacts ?? []).filter { !retainedKeys.contains($0.key) }
        let savedDescription = folderType == .project
            ? existing.flatMap { library.folder(id: $0.id) }?.description ?? existing?.description ?? ""
            : description
        onSave(trimmedName, enteredAddress, savedDescription, savedFacts, colorHex, folderType)
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

    private var projectFolders: [CodeFolder] { folders.filter { $0.folderType == .project } }

    var body: some View {
        NavigationStack {
            List {
                Section {
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

                Section("Projects") {
                    if projectFolders.isEmpty {
                        Text("Create a Project to add this saved passage.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(projectFolders) { folder in
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


func formattedProjectContext(_ source: String) -> AttributedString {
    var result = AttributedString()
    for (index, line) in source.components(separatedBy: .newlines).enumerated() {
        if index > 0 { result += AttributedString("\n") }
        let hashes = line.prefix { $0 == "#" }.count
        let heading = (1...6).contains(hashes) && line.dropFirst(hashes).first == " "
        let content = heading ? String(line.dropFirst(hashes + 1)) : line
        var text = (try? AttributedString(markdown: content, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(content)
        if heading { text.font = .headline }
        result += text
    }
    return result
}

/// Edits the Project's context without replacing its other saved fields.
struct ProjectContextView: View {
    let folderID: Int64
    @Binding var isEditing: Bool

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var editingFolder: CodeFolder?
    @State private var editingSessionID: UUID?
    @State private var draft = ""
    @State private var saveError: String?

    private var folder: CodeFolder? { library.folder(id: folderID) }
    private var savedContext: String { folder?.description.trimmingCharacters(in: .whitespacesAndNewlines) ?? "" }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isEditing {
                ProjectContextEditor(text: $draft)
                    .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                    .padding(.top, CodeScreenMetrics.topTitlePadding)
            } else {
                ScrollView {
                    Text(savedContext.isEmpty ? AttributedString("No context yet.") : formattedProjectContext(savedContext))
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                        .padding(.top, CodeScreenMetrics.topTitlePadding)
                        .accessibilityIdentifier("project-context-text")
                }
                .scrollIndicators(.hidden)
                .codeSoftTopScrollEdges()
                .codeTransparentBottomScrollEdge()
            }
            if let saveError {
                Text(saveError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
            } else {
                EditToolbarItem(label: "Edit context", identifier: "project-context-edit", action: beginEditing)
            }
        }
        .onChange(of: library.privateSessionID) { _, _ in finishEditing() }
        .onChange(of: folder?.clientID) { _, _ in finishEditing() }
    }

    private func beginEditing() {
        guard let folder, library.requireProjectAccess() else { return }
        draft = folder.description
        editingFolder = folder
        editingSessionID = library.privateSessionID
        saveError = nil
        isEditing = true
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
        isEditing = false
        editingFolder = nil
        editingSessionID = nil
        draft = ""
        saveError = nil
    }
}

private struct ProjectContextEditor: UIViewRepresentable {
    @Binding var text: String

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.backgroundColor = .clear
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        view.textColor = .label
        view.tintColor = UIColor(Color.appChrome)
        view.textContainerInset = UIEdgeInsets(top: 0, left: 0, bottom: 8, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.contentInsetAdjustmentBehavior = .never
        view.keyboardDismissMode = .interactive
        view.showsVerticalScrollIndicator = false
        view.showsHorizontalScrollIndicator = false
        if #available(iOS 26.0, *) {
            view.topEdgeEffect.style = .soft
            view.bottomEdgeEffect.isHidden = true
        }
        view.text = text
        view.selectedRange = NSRange(location: 0, length: 0)
        view.accessibilityLabel = "Project context"
        view.accessibilityIdentifier = "project-context-editor"
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        view.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        view.delegate = context.coordinator
        Task { @MainActor [weak view] in view?.becomeFirstResponder() }
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        // Reassigning text on every SwiftUI update would reset native selection
        // and scroll position as the keyboard appears or the user types.
        if view.text != text {
            let selection = view.selectedRange
            view.text = text
            let length = (text as NSString).length
            let location = min(selection.location, length)
            view.selectedRange = NSRange(location: location, length: min(selection.length, length - location))
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ProjectContextEditor

        init(parent: ProjectContextEditor) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
        }
    }
}

/// Shows shared provenance once, beneath the fact list.
struct ProjectStructuredFactsSources: View {
    let facts: [ProjectStructuredFact]
    @State private var isExpanded = false

    var body: some View {
        let notes = ProjectFactSourceNote.grouped(from: facts)
        if !notes.isEmpty {
            DisclosureGroup(isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: 12) {
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
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 8)
            } label: {
                Text("Source information")
                    .font(.caption.weight(.semibold))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .tint(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 16)
            .accessibilityIdentifier("project-facts-sources")
        }
    }
}

struct ProjectStructuredFactRow: View {
    let fact: ProjectStructuredFact

    var body: some View {
        ProjectFactRowLayout {
            Text(fact.label)
        } value: { alignment in
            VStack(alignment: alignment, spacing: 4) {
                Text(fact.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Not provided" : fact.value)
                    .fixedSize(horizontal: false, vertical: true)
                ProjectStructuredFactStatus(status: fact.status)
            }
        }
    }
}

struct ProjectStructuredFactStatus: View {
    let status: String

    private var label: String? {
        switch status.lowercased() {
        case "sourced", "stated": return nil
        case "confirmed": return "Confirmed"
        case "rejected": return "Rejected"
        default: return "Unknown"
        }
    }

    var body: some View {
        if let label {
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct ProjectFactRowLayout<Label: View, Value: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    var verticalAlignment: VerticalAlignment = .firstTextBaseline
    @ViewBuilder let label: () -> Label
    @ViewBuilder let value: (HorizontalAlignment) -> Value

    var body: some View {
        let stacksVertically = dynamicTypeSize.isAccessibilitySize
        let layout = stacksVertically ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: verticalAlignment, spacing: 12))
        layout {
            label()
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            value(stacksVertically ? .leading : .trailing)
                .font(.subheadline)
                .multilineTextAlignment(stacksVertically ? .leading : .trailing)
                .frame(maxWidth: .infinity, alignment: stacksVertically ? .leading : .trailing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
    }
}

/// Edits the Project's context without replacing its other saved fields.
