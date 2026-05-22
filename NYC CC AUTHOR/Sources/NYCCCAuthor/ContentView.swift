import SwiftUI

struct ContentView: View {
    private enum AddEntityKind: String, Identifiable {
        case jurisdiction
        case codeVersion
        case codeSection

        var id: String { rawValue }

        var title: String {
            switch self {
            case .jurisdiction: return "Add Jurisdiction"
            case .codeVersion: return "Add Code Version"
            case .codeSection: return "Add Code Section"
            }
        }

        var fieldLabel: String {
            switch self {
            case .jurisdiction: return "Jurisdiction name"
            case .codeVersion: return "Code version name"
            case .codeSection: return "Code section name"
            }
        }
    }

    private enum SearchMode: String, CaseIterable, Identifiable {
        case navigate = "Find One"
        case highlightAll = "Highlight All"

        var id: String { rawValue }
    }

    private enum DeleteEntityKind: String, Identifiable {
        case jurisdiction
        case codeVersion
        case codeSection

        var id: String { rawValue }

        var title: String {
            switch self {
            case .jurisdiction: return "Delete Jurisdiction"
            case .codeVersion: return "Delete Code Version"
            case .codeSection: return "Delete Code Section"
            }
        }
    }

    private struct DeleteEntityTarget: Identifiable {
        let kind: DeleteEntityKind
        let name: String

        var id: String { "\(kind.rawValue):\(name)" }
    }

    @ObservedObject var viewModel: AuthoringViewModel
    @State private var isOutlineCollapsed = false
    @State private var isSourceVisible = false
    @State private var editorZoom = 1.0
    @State private var collapsedOrganizerGroupIDs: Set<String> = []
    @State private var addEntityKind: AddEntityKind?
    @State private var addEntityName = ""
    @State private var searchText = ""
    @State private var searchVersion = 0
    @State private var searchMode: SearchMode = .highlightAll
    @State private var searchStepDirection = 1
    @State private var selectedTableReferenceID: String?
    @State private var selectedTableReferenceVersion = 0
    @State private var deleteEntityTarget: DeleteEntityTarget?
    @State private var deleteEntityConfirmationText = ""
    @State private var pendingFinalDeleteTarget: DeleteEntityTarget?
    @State private var showFinalDeleteConfirmation = false

    var body: some View {
        VStack(spacing: 0) {
            header
                .frame(height: 132)

            VStack(spacing: 0) {
                HSplitView {
                    if !isOutlineCollapsed {
                        outlineSidebar
                            .frame(minWidth: 220, idealWidth: 320, maxWidth: 420)
                    }

                    HTMLEditorView(
                        bodyContent: selectedBodyBinding,
                        fullHTMLContent: selectedHTMLBinding,
                        isSourceVisible: isSourceVisible,
                        zoomScale: editorZoom,
                        scrollTargetID: viewModel.selectedOutlineItemID,
                        scrollToTableReferenceID: selectedTableReferenceID,
                        insertTableReferenceID: selectedTableReferenceID,
                        insertTableReferenceVersion: selectedTableReferenceVersion,
                        searchQuery: searchText,
                        searchVersion: searchVersion,
                        searchMode: searchMode.rawValue,
                        searchStepDirection: searchStepDirection
                    )
                        .frame(minWidth: 520)
                        .overlay(alignment: .center) {
                            if viewModel.hasSelection && viewModel.selectedDocumentIsEmpty {
                                ContentUnavailableView(
                                    "Empty HTML File",
                                    systemImage: "doc.text.magnifyingglass",
                                    description: Text("The selected chapter file has no HTML content on disk. Open the non-empty source HTML file before adding markers.")
                                )
                                .padding(24)
                            }
                        }
                }
                Divider()
                footer
            }
        }
        .alert("Could Not Complete Request", isPresented: errorBinding) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "An unknown error occurred.")
        }
        .alert(
            pendingFinalDeleteTarget.map { $0.kind.title } ?? "Confirm Delete",
            isPresented: $showFinalDeleteConfirmation,
            presenting: pendingFinalDeleteTarget
        ) { target in
            Button("Cancel", role: .cancel) {
                pendingFinalDeleteTarget = nil
            }
            Button("Delete", role: .destructive) {
                performDelete(target)
            }
        } message: { target in
            Text("Delete \"\(target.name)\"? This cannot be undone.")
        }
        .sheet(item: $addEntityKind) { kind in
            addEntitySheet(kind: kind)
        }
        .sheet(item: $deleteEntityTarget) { target in
            deleteEntitySheet(target: target)
        }
        .onDeleteCommand {
            guard let tableID = selectedTableReferenceID else { return }
            viewModel.deleteTableManifestEntry(id: tableID)
            self.selectedTableReferenceID = nil
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(viewModel.documentTitle)
                    .font(.title2.weight(.semibold))
                Text("Edit marked HTML visually, navigate the section tree, then publish the authored JSON for the iOS app.")
                    .foregroundStyle(.secondary)
                Spacer()
            }

            HStack(alignment: .center, spacing: 16) {
                HStack(spacing: 6) {
                    Button(isOutlineCollapsed ? "Show Outline" : "Hide Outline") {
                        isOutlineCollapsed.toggle()
                    }
                    Button(isSourceVisible ? "Hide HTML" : "Show HTML") {
                        isSourceVisible.toggle()
                    }
                    Button("Import Table Manifest…") {
                        viewModel.importTableManifest()
                    }
                    if viewModel.tableManifest != nil {
                        Button("Clear Table Manifest") {
                            viewModel.clearTableManifest()
                        }
                    }
                }

                Divider()
                    .frame(height: 22)

                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Search text", text: $searchText)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 220)
                        .onSubmit { searchVersion += 1 }
                        .onChange(of: searchText) { searchVersion += 1 }
                    Picker("Search mode", selection: $searchMode) {
                        ForEach(SearchMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 130)
                    .onChange(of: searchMode) {
                        searchStepDirection = 1
                        searchVersion += 1
                    }
                    if searchMode == .navigate {
                        Button("Prev") {
                            searchStepDirection = -1
                            searchVersion += 1
                        }
                        .disabled(searchText.isEmpty)
                        Button("Next") {
                            searchStepDirection = 1
                            searchVersion += 1
                        }
                        .disabled(searchText.isEmpty)
                    }
                    Button("Clear") {
                        searchText = ""
                        searchStepDirection = 1
                        searchVersion += 1
                    }
                    .disabled(searchText.isEmpty)
                }
                Spacer(minLength: 0)
            }

            HStack(alignment: .center, spacing: 16) {
                HStack(spacing: 6) {
                    Button {
                        editorZoom = max(0.75, editorZoom - 0.1)
                    } label: {
                        Image(systemName: "minus.magnifyingglass")
                    }
                    .help("Zoom out")

                    Text("\(Int(editorZoom * 100))%")
                        .font(.callout.monospacedDigit())
                        .frame(width: 46)

                    Button {
                        editorZoom = min(2.5, editorZoom + 0.1)
                    } label: {
                        Image(systemName: "plus.magnifyingglass")
                    }
                    .help("Zoom in")
                }

                Divider()
                    .frame(height: 22)

                HStack(spacing: 6) {
                    Button("Open…") { viewModel.openDocuments() }
                    Button("Save") { viewModel.saveSelectedDocument() }
                        .disabled(!viewModel.hasSelection)
                    Button("Save All") { viewModel.saveAllDocuments() }
                        .disabled(!viewModel.hasDocuments)
                }

                HStack(spacing: 6) {
                    Button("Export HTML") { viewModel.exportSelectedAsHTML() }
                        .disabled(!viewModel.hasSelection)
                    Button("Export JSON") { viewModel.exportSelectedAsStructuredJSON() }
                        .disabled(!viewModel.hasSelection)
                    Button(viewModel.isPublishing ? "Publishing..." : "Publish iOS") {
                        viewModel.publishAllToIOSApp()
                    }
                    .disabled(!viewModel.hasDocuments || viewModel.isPublishing)
                    Button(viewModel.isExportingPack ? "Exporting Pack..." : "Export Pack") {
                        viewModel.exportInstallablePack()
                    }
                    .disabled(!viewModel.hasDocuments || viewModel.isExportingPack)
                }

                HStack(spacing: 6) {
                    Button("Apply Selected") { viewModel.applyHeadingPrefixesToSelected() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!viewModel.hasSelection)
                    Button("Apply All") { viewModel.applyHeadingPrefixesToAll() }
                        .disabled(!viewModel.hasDocuments)
                }

                Spacer()
            }
        }
        .padding(20)
    }

    private var outlineSidebar: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("JURISDICTIONS")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    organizerPickerRow(
                        selection: selectedJurisdictionBinding,
                        options: viewModel.jurisdictions.map { ($0.name, Optional($0.id)) },
                        addKind: .jurisdiction,
                        deleteKind: .jurisdiction,
                        deleteName: selectedJurisdictionName,
                        canDelete: viewModel.selectedJurisdictionID != nil,
                        requestDelete: requestDelete
                    )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("CODE VERSIONS")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    organizerPickerRow(
                        selection: selectedCodeBinding,
                        options: viewModel.codeVersions.map { ($0.name, Optional($0.id)) },
                        addKind: .codeVersion,
                        deleteKind: .codeVersion,
                        deleteName: selectedCodeVersionName,
                        canDelete: viewModel.selectedCodeID != nil,
                        requestDelete: requestDelete
                    )
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("CODE SECTIONS")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    organizerPickerRow(
                        selection: selectedCodeSectionBinding,
                        options: viewModel.codeSectionsForSelectedCode.map { ($0.name, Optional($0.id)) },
                        addKind: .codeSection,
                        deleteKind: .codeSection,
                        deleteName: selectedCodeSectionName,
                        canDelete: viewModel.selectedCodeSectionID != nil,
                        requestDelete: requestDelete
                    )
                }

                organizerGroup(
                    id: "chapters",
                    title: "Chapters"
                ) {
                    if viewModel.visibleDocuments.isEmpty {
                        Text("Open HTML files for this code section to populate chapters.")
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 10)
                    } else {
                        Picker("", selection: selectedDocumentMenuBinding) {
                            ForEach(viewModel.visibleDocuments) { document in
                                let statusSuffix = document.hasUnsavedChanges ? "Modified" : "Ready"
                                Text("\(document.displayName) - \(statusSuffix)").tag(Optional(document.id))
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }

                organizerGroup(
                    id: "chapter-sections",
                    title: "Chapter Sections"
                ) {
                    if viewModel.selectedDocumentID == nil {
                        Text("Select a chapter to see its titles.")
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 10)
                    } else {
                        let outline = viewModel.selectedOutline
                        if outline.isEmpty {
                            Text("No sections loaded yet.")
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 10)
                        } else {
                            HStack(spacing: 8) {
                                Button("Expand All") {
                                    viewModel.collapsedOutlineItemIDs.subtract(collectExpandableIDs(in: outline))
                                }
                                Button("Collapse All") {
                                    viewModel.collapsedOutlineItemIDs.formUnion(collectExpandableIDs(in: outline))
                                }
                            }
                            .font(.caption)
                            .buttonStyle(.bordered)

                            OutlineTree(
                                items: outline,
                                selectedOutlineItemID: $viewModel.selectedOutlineItemID,
                                collapsedOutlineItemIDs: $viewModel.collapsedOutlineItemIDs
                            )
                            .padding(.leading, 8)
                        }
                    }
                }

                if viewModel.tableManifest != nil {
                    organizerGroup(
                        id: "table-manifest",
                        title: "Table Manifest"
                    ) {
                        if let manifest = viewModel.tableManifest {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(manifest.workbook)
                                    .font(.headline)
                                HStack(spacing: 8) {
                                    Button("Insert Table Marker") {
                                        selectedTableReferenceVersion += 1
                                    }
                                    .disabled(selectedTableReferenceID == nil || viewModel.selectedDocumentID == nil)
                                    Button("Clear Table Manifest") {
                                        viewModel.clearTableManifest()
                                        selectedTableReferenceID = nil
                                    }
                                }
                                ForEach(manifest.tables) { table in
                                    organizerCard(
                                        title: table.id,
                                        subtitle: "\(table.sheet) • \(table.range)"
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(selectedTableReferenceID == table.id ? Color.accentColor : Color.clear, lineWidth: 2)
                                    )
                                    .onTapGesture {
                                        selectedTableReferenceID = table.id
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.secondary.opacity(0.05))
    }

    private func organizerGroup<Content: View>(
        id: String,
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                if collapsedOrganizerGroupIDs.contains(id) {
                    collapsedOrganizerGroupIDs.remove(id)
                } else {
                    collapsedOrganizerGroupIDs.insert(id)
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: collapsedOrganizerGroupIDs.contains(id) ? "chevron.right" : "chevron.down")
                        .font(.caption2)
                    Text(title.uppercased())
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Spacer()
                }
            }
            .buttonStyle(.plain)

            if !collapsedOrganizerGroupIDs.contains(id) {
                content()
            }
        }
    }

    private func organizerCard(title: String, subtitle: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(subtitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.headline)
            }
            Spacer()
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentColor.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var footer: some View {
        HStack {
            Text(viewModel.documentCountText)
                .foregroundStyle(.secondary)
            Spacer()
            Text(viewModel.statusMessage)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    private var selectedHTMLBinding: Binding<String> {
        Binding(
            get: { viewModel.selectedHTMLContent },
            set: { viewModel.updateSelectedHTML($0) }
        )
    }

    private var selectedBodyBinding: Binding<String> {
        Binding(
            get: { viewModel.selectedBodyContent },
            set: { viewModel.updateSelectedBody($0) }
        )
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )
    }

    private var selectedJurisdictionBinding: Binding<Int64?> {
        Binding(
            get: { viewModel.selectedJurisdictionID },
            set: { if let id = $0 { viewModel.selectJurisdiction(id) } }
        )
    }

    private var selectedCodeBinding: Binding<Int64?> {
        Binding(
            get: { viewModel.selectedCodeID },
            set: { if let id = $0 { viewModel.selectCodeVersion(id) } }
        )
    }

    private var selectedCodeSectionBinding: Binding<Int64?> {
        Binding(
            get: { viewModel.selectedCodeSectionID },
            set: { if let id = $0 { viewModel.selectCodeSection(id) } }
        )
    }

    private var selectedDocumentMenuBinding: Binding<UUID?> {
        Binding(
            get: { viewModel.selectedDocumentID },
            set: { if let id = $0 { viewModel.selectDocument(id) } }
        )
    }

    private var selectedJurisdictionName: String {
        viewModel.jurisdictions.first(where: { $0.id == viewModel.selectedJurisdictionID })?.name ?? ""
    }

    private var selectedCodeVersionName: String {
        viewModel.codeVersions.first(where: { $0.id == viewModel.selectedCodeID })?.name ?? ""
    }

    private var selectedCodeSectionName: String {
        viewModel.codeSectionsForSelectedCode.first(where: { $0.id == viewModel.selectedCodeSectionID })?.name ?? ""
    }

    private func organizerPickerRow(
        selection: Binding<Int64?>,
        options: [(String, Int64?)],
        addKind: AddEntityKind,
        deleteKind: DeleteEntityKind,
        deleteName: String,
        canDelete: Bool,
        requestDelete: @escaping (DeleteEntityKind, String) -> Void
    ) -> some View {
        HStack(spacing: 8) {
            Picker("", selection: selection) {
                ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                    Text(option.0).tag(option.1)
                }
            }
            .pickerStyle(.menu)

            Button {
                addEntityName = ""
                addEntityKind = addKind
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.bordered)

            Button(role: .destructive) {
                requestDelete(deleteKind, deleteName)
            } label: {
                Image(systemName: "trash")
            }
            .buttonStyle(.bordered)
            .disabled(!canDelete || deleteName.isEmpty)
        }
    }

    private func addEntitySheet(kind: AddEntityKind) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(kind.title)
                .font(.headline)

            TextField(kind.fieldLabel, text: $addEntityName)
                .textFieldStyle(.roundedBorder)
                .onSubmit {
                    submitAddEntity(kind: kind)
                }

            HStack {
                Spacer()
                Button("Cancel") {
                    addEntityKind = nil
                    addEntityName = ""
                }
                Button("Add") {
                    submitAddEntity(kind: kind)
                }
                .keyboardShortcut(.defaultAction)
                .disabled(addEntityName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 360)
    }

    private func submitAddEntity(kind: AddEntityKind) {
        let name = addEntityName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        switch kind {
        case .jurisdiction:
            viewModel.createJurisdiction(name: name)
        case .codeVersion:
            viewModel.createCodeVersion(name: name)
        case .codeSection:
            viewModel.createCodeSection(name: name)
        }

        addEntityName = ""
        addEntityKind = nil
    }

    private func requestDelete(kind: DeleteEntityKind, name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        deleteEntityConfirmationText = ""
        deleteEntityTarget = DeleteEntityTarget(kind: kind, name: trimmed)
    }

    private func deleteEntitySheet(target: DeleteEntityTarget) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(target.kind.title)
                .font(.headline)

            Text("Type the exact name below to continue:")
                .foregroundStyle(.secondary)

            Text(target.name)
                .font(.body.weight(.semibold))
                .textSelection(.enabled)

            TextField("Type exactly: \(target.name)", text: $deleteEntityConfirmationText)
                .textFieldStyle(.roundedBorder)

            HStack {
                Spacer()
                Button("Cancel") {
                    deleteEntityTarget = nil
                    deleteEntityConfirmationText = ""
                }
                Button("Continue") {
                    deleteEntityTarget = nil
                    pendingFinalDeleteTarget = target
                    showFinalDeleteConfirmation = true
                }
                .keyboardShortcut(.defaultAction)
                .disabled(deleteEntityConfirmationText != target.name)
            }
        }
        .padding(20)
        .frame(width: 420)
    }

    private func performDelete(_ target: DeleteEntityTarget) {
        switch target.kind {
        case .jurisdiction:
            viewModel.deleteSelectedJurisdiction()
        case .codeVersion:
            viewModel.deleteSelectedCodeVersion()
        case .codeSection:
            viewModel.deleteSelectedCodeSection()
        }
        pendingFinalDeleteTarget = nil
        deleteEntityConfirmationText = ""
    }

    private func collectExpandableIDs(in items: [OutlineItem]) -> Set<String> {
        items.reduce(into: Set<String>()) { result, item in
            if !item.children.isEmpty {
                result.insert(item.id)
                result.formUnion(collectExpandableIDs(in: item.children))
            }
        }
    }
}

private struct OutlineTree: View {
    let items: [OutlineItem]
    @Binding var selectedOutlineItemID: String?
    @Binding var collapsedOutlineItemIDs: Set<String>

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(items) { item in
                OutlineTreeRow(
                    item: item,
                    selectedOutlineItemID: $selectedOutlineItemID,
                    collapsedOutlineItemIDs: $collapsedOutlineItemIDs
                )
            }
        }
    }
}

private struct OutlineTreeRow: View {
    let item: OutlineItem
    @Binding var selectedOutlineItemID: String?
    @Binding var collapsedOutlineItemIDs: Set<String>

    private var isExpanded: Bool {
        !collapsedOutlineItemIDs.contains(item.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                selectedOutlineItemID = item.id
                if !item.children.isEmpty {
                    toggleBranch(item)
                }
            } label: {
                HStack(spacing: 8) {
                    if !item.children.isEmpty {
                        Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                            .font(.caption2)
                    } else {
                        Color.clear.frame(width: 10, height: 10)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        if let marker = item.marker {
                            Text(marker)
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        Text(item.title)
                            .font(font(for: item.kind))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .background(selectedOutlineItemID == item.id ? Color.accentColor.opacity(0.14) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.leading, CGFloat(max(item.level - 1, 0)) * 14)
            }
            .buttonStyle(.plain)

            if isExpanded {
                ForEach(item.children) { child in
                    OutlineTreeRow(
                        item: child,
                        selectedOutlineItemID: $selectedOutlineItemID,
                        collapsedOutlineItemIDs: $collapsedOutlineItemIDs
                    )
                }
            }
        }
    }

    private func font(for kind: OutlineItem.Kind) -> Font {
        switch kind {
        case .chapter:
            return .headline
        case .section:
            return .subheadline.weight(.semibold)
        case .table:
            return .caption.weight(.medium)
        default:
            return .body
        }
    }

    private func toggleBranch(_ item: OutlineItem) {
        if collapsedOutlineItemIDs.contains(item.id) {
            collapsedOutlineItemIDs.remove(item.id)
        } else {
            collapsedOutlineItemIDs.insert(item.id)
        }
    }
}
