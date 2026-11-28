import SwiftUI
import UIKit
import UniformTypeIdentifiers

private struct ProjectCardDrag {
    let id: Int64
    let sessionID: UUID
}

private struct ReferenceCardEditMenu: ViewModifier {
    let isReference: Bool
    let edit: () -> Void

    @ViewBuilder
    func body(content: Content) -> some View {
        if isReference {
            content.contextMenu {
                Button(action: edit) { Label("Edit reference", systemImage: "pencil") }
            }
        } else {
            content
        }
    }
}

private struct ProjectCardDropDelegate: DropDelegate {
    static let contentType = UTType(exportedAs: "com.randycodex.permitext.project-card")
    let isLocalDrag: () -> Bool
    let move: () -> Void
    let finish: () -> Void

    func validateDrop(info: DropInfo) -> Bool {
        isLocalDrag() && info.hasItemsConforming(to: [Self.contentType])
    }

    func dropEntered(info: DropInfo) {
        guard validateDrop(info: info) else { return }
        move()
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: validateDrop(info: info) ? .move : .cancel)
    }

    func performDrop(info: DropInfo) -> Bool {
        guard validateDrop(info: info) else { return false }
        finish()
        return true
    }
}

struct NativeEntitlementStatusView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if library.initialEntitlementPresentation == .checking {
                ProgressView("Checking your plan…")
            } else {
                Text("Your plan could not be checked").font(.headline)
                Text("Connect and try again. Your saved work is preserved.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button("Try again") { Task { await library.retryInitialEntitlementCheck() } }
                    .disabled(library.isAccountBusy)
                    .accessibilityIdentifier("native-entitlement-retry")
            }
        }
        .accessibilityIdentifier("native-entitlement-status")
    }
}

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var savedFilterCodeSectionIDs: Set<String>
    @State private var savedFilterFolderIDs: Set<Int64>
    @State private var folderEditorTarget: FolderEditorTarget?
    @State private var savedSortMode: BookmarkSortMode = .codeOrder
    @ScaledMetric(relativeTo: .headline) private var preferredProjectTileHeight: CGFloat = 140
    @State private var cachedFilteredBookmarks: [BookmarkedSection] = []
    @State private var cachedBookmarkCodeGroups: [BookmarkCodeGroup] = []
    @State private var cachedBookmarksByFolderID: [Int64: [BookmarkedSection]] = [:]
    @State private var pendingExport: BookmarkExportRequest?
    @State private var showingSettings = false
    @State private var showingAccessSettings = false
    @State private var projectCardDrag: ProjectCardDrag?

    private static let filterCodeSectionIDsDefaultsKey = "BookmarksView.sourceFilters.v2"
    private static let filterFolderIDsDefaultsKey = "BookmarksView.filterFolderIDs"
    private let filterDefaults: UserDefaults
    private let tabBarClearance: CGFloat = CodeScreenMetrics.tabBarClearance
    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let onOpenProject: ((Int64) -> Void)?
    private let onOpenLibrary: (() -> Void)?
    private let projectTransitionNamespace: Namespace.ID?
    private let embedsNavigationStack: Bool
    private var screenTitle: String { onOpenProject == nil ? "Saved" : "Projects" }

    init(filterDefaults: UserDefaults = .standard, onOpenProject: ((Int64) -> Void)? = nil,
         onOpenLibrary: (() -> Void)? = nil, projectTransitionNamespace: Namespace.ID? = nil,
         embedsNavigationStack: Bool = true) {
        self.filterDefaults = filterDefaults
        self.onOpenProject = onOpenProject
        self.onOpenLibrary = onOpenLibrary
        self.projectTransitionNamespace = projectTransitionNamespace
        self.embedsNavigationStack = embedsNavigationStack
        _savedFilterCodeSectionIDs = State(initialValue: Set(filterDefaults.stringArray(forKey: Self.filterCodeSectionIDsDefaultsKey) ?? []))
        _savedFilterFolderIDs = State(
            initialValue: FilterIDsStorage.load(
                key: Self.filterFolderIDsDefaultsKey,
                defaults: filterDefaults
            )
        )
    }

    /// Sheet routing for the folder editor — `.new` for create, `.edit` to
    /// modify an existing project. The case carries the model so the sheet
    /// closure can disambiguate without a separate boolean.
    enum FolderEditorTarget: Identifiable {
        case new
        case edit(CodeFolder)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let folder): return "edit-\(folder.id)"
            }
        }

        var folder: CodeFolder? {
            if case .edit(let f) = self { return f }
            return nil
        }
    }

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var exportButton: some View {
        Menu {
            exportMenuContent
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(library.bookmarks.isEmpty)
        .opacity(library.bookmarks.isEmpty ? 0 : 1)
        .accessibilityHidden(library.bookmarks.isEmpty)
        .accessibilityLabel("Export saved sections as PDF")
    }

    private var sortButton: some View {
        Menu {
            ForEach(BookmarkSortMode.allCases) { mode in
                Button {
                    savedSortMode = mode
                } label: {
                    Label(mode.label, systemImage: mode.systemImage)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort saved sections")
    }

    private var accountButton: some View {
        Button {
            showingSettings = true
        } label: {
            ToolbarActionIcon(systemImage: library.signedInAccount == nil ? "person.crop.circle" : "person.crop.circle.fill")
                .foregroundStyle(Color.appChrome)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open Account")
    }

    private var showsSavedInlineFilters: Bool {
        !availableFilterSections.isEmpty
    }

    private var hasSavedHeaderContentBelowTitle: Bool {
        showsSavedInlineFilters
    }

    private var showsProjectsSection: Bool {
        library.hasProjectAccess
    }

    var body: some View {
        if library.defersEntitlementPresentation {
            NativeEntitlementStatusView()
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(alignment: .topLeading) {
                    CodeScreenTitleRow(title: "Saved", minimumHeight: CodeScreenMetrics.mainHeaderHeight)
                        .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                        .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
                }
        } else if !library.hasCapability(.savedWork), onOpenLibrary == nil {
            VStack(spacing: 14) {
                Image(systemName: "lock")
                    .font(.largeTitle)
                    .frame(width: 44, height: 44)
                    .accessibilityHidden(true)
                Text("Saved work requires Pro").font(.title3.weight(.semibold))
                Text("Save sections and organize Projects with Pro. Any existing saved work is preserved.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button { showingAccessSettings = true } label: {
                    Text(library.signedInAccount == nil ? "Open Account" : "View Plans")
                        .font(.body.weight(.semibold))
                        .padding(.horizontal, 20)
                        .frame(minHeight: 44)
                        .foregroundStyle(Color(uiColor: .systemBackground))
                        .background(Color.primary, in: Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .topLeading) {
                CodeScreenTitleRow(title: "Saved", minimumHeight: CodeScreenMetrics.mainHeaderHeight)
                    .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                    .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
            }
            .permitextAccountSheet(isPresented: $showingAccessSettings) {
                PermitextAccountEntryView(initialSection: library.signedInAccount == nil ? .account : .plan)
                    .environmentObject(library)
            }
        } else {
            Group {
                if embedsNavigationStack { NavigationStack { savedContent } }
                else { savedContent }
            }
            .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        }
    }

    private var savedContent: some View {
        ScrollView {
            savedScreenContent
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.contentSpacingBelowTitle)
                .padding(.bottom, tabBarClearance)
        }
        .accessibilityIdentifier("projects-root")
        .codePinnedTopBar {
            pinnedSavedHeader
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
        }
        .overlay {
            if showsProjectsSection && projectFolders.isEmpty {
                Text("Use + to create a Project for your notes, evidence, and Assistant conversations.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, contentHorizontalInset)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .ignoresSafeArea(.container, edges: .vertical)
            }
        }
        .background { CodeAppBackdrop(accent: accentColor).ignoresSafeArea() }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Reader bookmark actions publish the updated bookmark list
            // synchronously. Rebuild from that state instead of reading
            // and grouping the entire Saved library again when switching
            // tabs.
            rebuildBookmarkCaches()
        }
        .onDisappear { projectCardDrag = nil }
        .onChange(of: library.privateSessionID) { _, _ in projectCardDrag = nil }
        .onChange(of: savedFilterCodeSectionIDs) { _, newValue in
            filterDefaults.set(newValue.sorted(), forKey: Self.filterCodeSectionIDsDefaultsKey)
            rebuildBookmarkCaches()
        }
        .onChange(of: savedFilterFolderIDs) { _, newValue in
            FilterIDsStorage.persist(
                newValue,
                key: Self.filterFolderIDsDefaultsKey,
                defaults: filterDefaults
            )
            rebuildBookmarkCaches()
        }
        .onChange(of: savedSortMode) { _, _ in
            rebuildBookmarkCaches()
        }
        .onChange(of: library.bookmarks) { _, _ in
            rebuildBookmarkCaches()
        }
        .onChange(of: library.projectBookmarksByFolderID) { _, _ in
            rebuildBookmarkCaches()
        }
        .onChange(of: library.folderMembership) { _, _ in
            rebuildBookmarkCaches()
        }
        .onChange(of: library.codeSections) { _, _ in
            rebuildBookmarkCaches()
        }
        .onChange(of: library.folders) { _, newFolders in
            // If a folder was deleted while it was in the active filter
            // set, prune the now-orphaned ID so the filter pipeline
            // doesn't keep filtering against a missing folder.
            let liveIDs = Set(newFolders.map(\.id))
            let pruned = savedFilterFolderIDs.intersection(liveIDs)
            if pruned != savedFilterFolderIDs {
                savedFilterFolderIDs = pruned
            } else {
                rebuildBookmarkCaches()
            }
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                defaultFolderType: target.folder?.folderType ?? .project,
                onSave: { name, address, description, structuredFacts, colorHex, folderType in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, address: address, description: description, structuredFacts: structuredFacts, colorHex: colorHex)
                    } else {
                        let created = library.createFolder(
                            name: name,
                            address: address,
                            description: description,
                            structuredFacts: structuredFacts,
                            colorHex: colorHex,
                            folderType: folderType
                        )
                        if let created {
                            if let onOpenProject { onOpenProject(created.id) }
                            else { library.noteProjectOpened(created.id) }
                        }
                    }
                },
                onDelete: {
                    if let existing = target.folder {
                        savedFilterFolderIDs.remove(existing.id)
                        library.deleteFolder(id: existing.id)
                    }
                }
            )
        }
        .sheet(item: $pendingExport) { request in
            BookmarkExportPreviewSheet(request: request) {
                pendingExport = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    library.startBookmarkExport(bookmarks: request.bookmarks, contextLabel: request.contextLabel)
                }
            }
        }
        .permitextAccountSheet(isPresented: $showingSettings) {
            NavigationStack { SettingsView() }
                .environmentObject(library)
        }
    }

    private var newProjectLabel: String {
        library.hasProjectAccess ? "New project" : "New project · Pro"
    }

    private func openNewProject() {
        if library.hasProjectAccess { folderEditorTarget = .new }
        else { library.requireProjectAccess() }
    }

    private var savedHeaderActions: some View {
        HStack(spacing: 8) {
            Button(action: openNewProject) {
                Label(newProjectLabel, systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.appChrome)
                    .padding(.horizontal, 12)
                    .frame(minHeight: CodeScreenMetrics.toolbarButtonSize)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .codeLiquidGlassCapsule()

            accountButton
                .codeLiquidGlassCircle()
        }
    }

    @ViewBuilder
    private var savedScreenContent: some View {
        if showsProjectsSection { folderGrid(projectFolders) }
        else if let onOpenLibrary {
            Button(action: onOpenLibrary) {
                CodeSurface(accent: accentColor, showsBorder: false) {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "book")
                            .font(.title2)
                        Text("Code Library").font(.title3.weight(.semibold))
                        Text("Read and search codes")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("projects-code-library")
        }
    }

    @ViewBuilder
    private var pinnedSavedHeader: some View {
        if onOpenProject != nil {
            HStack {
                Button(action: openNewProject) {
                    ToolbarActionIcon(systemImage: "plus")
                        .foregroundStyle(Color.appChrome)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(newProjectLabel)
                .codeLiquidGlassCircle()

                Spacer(minLength: 0)
                CodeMainScreenTitleLabel(title: screenTitle, animatesChanges: false, alignment: .center)
                Spacer(minLength: 0)

                accountButton
                    .codeLiquidGlassCircle()
            }
            .frame(height: CodeScreenMetrics.mainHeaderHeight)
            .padding(.bottom, 8)
        } else {
            CodeScreenTitleRow(title: screenTitle, minimumHeight: CodeScreenMetrics.mainHeaderHeight) {
                savedHeaderActions
            }
        }
    }

private var savedBookmarkList: some View {
    VStack(alignment: .leading, spacing: 0) {
        ForEach(Array(cachedBookmarkCodeGroups.enumerated()), id: \.element.id) { index, codeGroup in
            codeSectionHeader(
                codeGroup,
                isFirst: index == 0,
                followsSavedHeader: hasSavedHeaderContentBelowTitle,
                hasFiltersAbove: showsSavedInlineFilters
            )

            ForEach(codeGroup.chapterGroups) { group in
                chapterHeader(group)

                ForEach(group.items, id: \.rowID) { bookmark in
                    NavigationLink {
                        bookmarkDestination(for: bookmark)
                    } label: {
                        bookmarkRow(bookmark)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("projects-bookmark-\(bookmark.id)")

                    CodeHairline()
                }
            }
        }
    }
}

private var filteredSavedEmptyState: some View {
    VStack(alignment: .leading, spacing: 14) {
        CodeEmptyStateCard(
            title: "No Saved Sections Match",
            systemImage: "line.3.horizontal.decrease.circle",
            description: "Clear the active code filters to see your Project saves.",
            accent: accentColor
        )

        Button("Clear Filters") {
            savedFilterCodeSectionIDs.removeAll()
            savedFilterFolderIDs.removeAll()
        }
        .font(.subheadline.weight(.semibold))
        .buttonStyle(.plain)
        .foregroundStyle(accentColor)
    }
    .padding(.top, CodeScreenMetrics.contentSpacingBelowTitle)
}

    // MARK: - Export

    /// Modal shown while the builder runs. Progress bar + cancel.
    @ViewBuilder
    private var exportProgressSheet: some View {
        if case let .building(progress, sectionTitle) = library.exportState {
            VStack(spacing: 20) {
                ExportProgressLine(progress: progress)
                    .padding(.horizontal, 24)

                VStack(spacing: 4) {
                    Text("Building PDF")
                        .font(.headline)
                    Text(sectionTitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                Button(role: .cancel) {
                    library.cancelBookmarkExport()
                } label: {
                    Text("Cancel")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            Capsule().fill(Color.secondary.opacity(0.15))
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
            }
            .padding(.vertical, 32)
            .presentationDetents([.height(220)])
            .interactiveDismissDisabled()
        }
    }

    /// Action-sheet buttons for the Export toolbar. Offers up to three
    /// options: current filter (only if a filter is active and narrows
    /// the list), all saved sections, and per-folder exports for each
    /// existing project.
    @ViewBuilder
    private var exportMenuContent: some View {
        let filteredCount = cachedFilteredBookmarks.count
        let totalCount = projectSavedBookmarks.count
        let isFiltered = filteredCount > 0 && filteredCount < totalCount

        if isFiltered {
            Button("Export current filter (\(filteredCount))") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: cachedFilteredBookmarks,
                    contextLabel: currentFilterContextLabel,
                    scopeLabel: "Current filter"
                )
            }
        }

        Button("Export all Project saves (\(totalCount))") {
            pendingExport = BookmarkExportRequest(
                bookmarks: projectSavedBookmarks,
                contextLabel: nil,
                scopeLabel: "All Project saves"
            )
        }

        // Per-folder shortcuts only show when the folder has content;
        // empty folders aren't useful as export targets.
        ForEach(projectFolders.filter { folderHasBookmarks($0) }) { folder in
            Button("Export “\(folder.name)”") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: bookmarks(inFolder: folder),
                    contextLabel: folder.name,
                    scopeLabel: folder.name
                )
            }
        }
    }

    private func folderHasBookmarks(_ folder: CodeFolder) -> Bool {
        !(cachedBookmarksByFolderID[folder.id]?.isEmpty ?? true)
    }

    private func bookmarks(inFolder folder: CodeFolder) -> [BookmarkedSection] {
        cachedBookmarksByFolderID[folder.id] ?? []
    }

    /// Short label for the "Current filter" export so its PDF header shows
    /// something meaningful instead of a blank context. Combines whichever
    /// filter dimensions are active.
    private var currentFilterContextLabel: String? {
        var parts: [String] = []
        if !savedFilterCodeSectionIDs.isEmpty {
            let names = availableFilterSections
                .filter { savedFilterCodeSectionIDs.contains(sourceKey($0)) }
                .map(sourceLabel)
            if !names.isEmpty { parts.append(names.joined(separator: ", ")) }
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var projectFolders: [CodeFolder] {
        library.folders.filter { $0.folderType == .project && $0.deletedAt == nil }
    }

    private var referenceFolders: [CodeFolder] {
        library.folders.filter { $0.folderType == .reference }
    }

    private var referenceTilesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            CodeScreenSectionEyebrow(text: "References", accent: accentColor)
            folderGrid(referenceFolders)
        }
    }

    private func folderGrid(_ folders: [CodeFolder]) -> some View {
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: 12, alignment: .top),
            count: dynamicTypeSize.isAccessibilitySize ? 1 : 2
        )
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
            ForEach(folders) { folder in
                if folder.folderType == .project && library.hasProjectAccess {
                    projectTileSlot(folder, tileHeight: dynamicTypeSize.isAccessibilitySize ? nil : preferredProjectTileHeight)
                        .contentShape(.interaction, RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .contentShape(.dragPreview, RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .onDrag {
                            projectCardDrag = ProjectCardDrag(id: folder.id, sessionID: library.privateSessionID)
                            let provider = NSItemProvider()
                            provider.registerDataRepresentation(forTypeIdentifier: ProjectCardDropDelegate.contentType.identifier,
                                visibility: .ownProcess) { completion in
                                completion(Data(folder.clientID.utf8), nil)
                                return nil
                            }
                            return provider
                        }
                        .onDrop(of: [ProjectCardDropDelegate.contentType], delegate: ProjectCardDropDelegate(
                            isLocalDrag: {
                                projectCardDrag?.sessionID == library.privateSessionID && library.hasProjectAccess
                            },
                            move: { moveDraggedProject(to: folder.id) },
                            finish: { projectCardDrag = nil }
                        ))
                        .accessibilityHint("Open Project. Touch and hold, then drag to reorder.")
                        .accessibilityAction(named: "Move earlier") { moveProject(folder, offset: -1) }
                        .accessibilityAction(named: "Move later") { moveProject(folder, offset: 1) }
                } else {
                    projectTileSlot(folder)
                }
            }
        }
    }

    private func moveDraggedProject(to targetID: Int64) {
        guard let drag = projectCardDrag else { return }
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
            _ = library.moveProject(id: drag.id, to: targetID, sessionID: drag.sessionID)
        }
    }

    private func moveProject(_ folder: CodeFolder, offset: Int) {
        guard let index = projectFolders.firstIndex(where: { $0.id == folder.id }),
              projectFolders.indices.contains(index + offset) else { return }
        _ = library.moveProject(id: folder.id, to: projectFolders[index + offset].id, sessionID: library.privateSessionID)
    }

    @ViewBuilder
    private func projectTileSlot(_ folder: CodeFolder, tileHeight: CGFloat? = nil) -> some View {
        if library.hasProjectAccess {
            Group {
                if let onOpenProject, folder.folderType == .project {
                    Button { onOpenProject(folder.id) } label: {
                        if let projectTransitionNamespace {
                            projectTile(folder, tileHeight: tileHeight)
                                .cardZoomSource(id: folder.id, in: projectTransitionNamespace, reduceMotion: reduceMotion)
                        } else {
                            projectTile(folder, tileHeight: tileHeight)
                        }
                    }
                } else {
                    NavigationLink {
                        ProjectView(folderID: folder.id)
                            .id(library.privateSessionID)
                    } label: {
                        projectTile(folder, tileHeight: tileHeight)
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("saved-folder-\(folder.id)")
            .modifier(ReferenceCardEditMenu(isReference: folder.folderType == .reference,
                edit: { folderEditorTarget = .edit(folder) }))
        } else {
            Button { library.requireProjectAccess() } label: { projectTile(folder, tileHeight: tileHeight) }
                .buttonStyle(.plain)
        }
    }

    private func projectTile(_ folder: CodeFolder, tileHeight: CGFloat? = nil) -> some View {
        VStack(alignment: .leading, spacing: tileHeight == nil ? 8 : 6) {
            if folder.folderType == .reference {
                HStack {
                    Text("\(library.bookmarkCount(inFolder: folder.id)) saved")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "books.vertical")
                        .font(.title3.weight(.medium))
                }
                Spacer(minLength: tileHeight == nil ? 12 : 0)
            }
            Text(folder.name)
                .font(.headline)
                .lineLimit(tileHeight == nil ? nil : 2)
                .fixedSize(horizontal: false, vertical: true)
                .multilineTextAlignment(.leading)
            if folder.folderType == .project {
                Spacer(minLength: 12)
            }
            if !folder.address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(folder.address)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                    .multilineTextAlignment(.leading)
            }
        }
        .foregroundStyle(Color.primary)
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: tileHeight ?? 140, maxHeight: tileHeight, alignment: .leading)
        .background(projectTileBackgroundColor(for: folder.colorHex), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func sourceKey(_ bookmark: BookmarkedSection) -> String {
        SavedEvidenceIdentity.source(version: bookmark.codeVersion, codeID: bookmark.codeSectionID, codeName: bookmark.codeSectionName)
    }

    private func sourceLabel(_ bookmark: BookmarkedSection) -> String {
        let name = bookmark.codeSectionName.isEmpty ? "Unknown code" : bookmark.codeSectionName
        if let year = name.range(of: #"^\d{4} "#, options: .regularExpression) {
            return "\(name[year.upperBound...]) · \(name[year].trimmingCharacters(in: .whitespaces))"
        }
        return "\(name) · \(NativeReaderEditionLabel.label(for: bookmark.codeVersion))"
    }

    private var projectSavedBookmarks: [BookmarkedSection] {
        let ids = Set(library.folders.filter { $0.folderType == .project && $0.deletedAt == nil }.map(\.id))
        let linked = Set(ids.flatMap { library.projectBookmarksByFolderID[$0] ?? [] }
            .map { SavedEvidenceIdentity.section(version: $0.codeVersion, sectionID: $0.id) })
        return library.bookmarks.filter { linked.contains(SavedEvidenceIdentity.section(version: $0.codeVersion, sectionID: $0.id)) }
    }

    private var availableFilterSections: [BookmarkedSection] {
        var seen = Set<String>()
        return projectSavedBookmarks
            .filter { seen.insert(sourceKey($0)).inserted }
            .sorted { sourceLabel($0).localizedStandardCompare(sourceLabel($1)) == .orderedAscending }
    }

    private func makeFilteredBookmarks() -> [BookmarkedSection] {
        projectSavedBookmarks.filter { bookmark in
            savedFilterCodeSectionIDs.isEmpty || savedFilterCodeSectionIDs.contains(sourceKey(bookmark))
        }
    }

    private var savedInlineFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button("All codes") { savedFilterCodeSectionIDs.removeAll() }
                    .buttonStyle(.bordered)
                ForEach(availableFilterSections, id: \.rowID) { bookmark in
                    Button {
                        let key = sourceKey(bookmark)
                        if savedFilterCodeSectionIDs.contains(key) { savedFilterCodeSectionIDs.remove(key) }
                        else { savedFilterCodeSectionIDs.insert(key) }
                    } label: {
                        Text(sourceLabel(bookmark))
                            .font(.caption)
                            .padding(.horizontal, 12).frame(minHeight: 44)
                            .background(savedFilterCodeSectionIDs.contains(sourceKey(bookmark)) ? Color.primary.opacity(0.18) : Color.clear, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityValue(savedFilterCodeSectionIDs.contains(sourceKey(bookmark)) ? "Selected" : "Not selected")
                }
            }
        }
    }

    private func rebuildBookmarkCaches() {
        let filtered = makeFilteredBookmarks()
        cachedFilteredBookmarks = filtered
        cachedBookmarkCodeGroups = makeBookmarkCodeGroups(from: filtered)
        cachedBookmarksByFolderID = makeBookmarksByFolderID()
    }

    private func makeBookmarksByFolderID() -> [Int64: [BookmarkedSection]] {
        var grouped: [Int64: [BookmarkedSection]] = [:]
        for bookmark in library.bookmarks {
            for folderID in library.folderMembership[bookmark.id] ?? [] {
                grouped[folderID, default: []].append(bookmark)
            }
        }
        return grouped
    }

    private func makeBookmarkCodeGroups(from bookmarks: [BookmarkedSection]) -> [BookmarkCodeGroup] {
        let sortedBookmarks = BookmarkSorter.sorted(
            bookmarks,
            mode: savedSortMode,
            codeSectionName: { library.codeSectionName(id: $0) }
        )
        let order = Dictionary(uniqueKeysWithValues: sortedBookmarks.enumerated().map { ($0.element.rowID, $0.offset) })
        let groupedByCodeSection = Dictionary(grouping: sortedBookmarks) { bookmark in
            sourceKey(bookmark)
        }

        return groupedByCodeSection.map { codeKey, codeItems in
            let groupedByChapter = Dictionary(grouping: codeItems) { bookmark in
                BookmarkChapterGroupKey(chapterNumber: bookmark.chapterNumber)
            }
            let chapterGroups = groupedByChapter.map { chapterKey, chapterItems in
                BookmarkChapterGroup(
                    chapterNumber: chapterKey.chapterNumber,
                    chapterTitle: chapterItems.first?.chapterTitle ?? "",
                    items: chapterItems.sorted {
                        (order[$0.rowID] ?? 0) < (order[$1.rowID] ?? 0)
                    }
                )
            }
            .sorted {
                let lhsOrder = $0.items.first.map { order[$0.rowID] ?? 0 } ?? 0
                let rhsOrder = $1.items.first.map { order[$0.rowID] ?? 0 } ?? 0
                return lhsOrder < rhsOrder
            }

            return BookmarkCodeGroup(
                sourceID: codeKey,
                codeSectionID: codeItems.first?.codeSectionID,
                codeSectionName: codeItems.first.map(sourceLabel) ?? "Unknown code",
                chapterGroups: chapterGroups
            )
        }
        .sorted {
            let lhsOrder = $0.chapterGroups.first?.items.first.map { order[$0.rowID] ?? 0 } ?? 0
            let rhsOrder = $1.chapterGroups.first?.items.first.map { order[$0.rowID] ?? 0 } ?? 0
            return lhsOrder < rhsOrder
        }
    }

    private func codeSectionHeader(
        _ group: BookmarkCodeGroup,
        isFirst: Bool,
        followsSavedHeader: Bool,
        hasFiltersAbove: Bool
    ) -> some View {
        let groupAccent = Color(uiColor: CodeSectionThemeProfile(codeSectionName: group.codeSectionName).accentColor)
        let topPadding: CGFloat = {
            guard isFirst else { return 18 }
            if !followsSavedHeader { return CodeScreenMetrics.contentSpacingBelowTitle }
            if hasFiltersAbove { return CodeScreenMetrics.sectionSpacingBelowEyebrow }
            return CodeScreenMetrics.sectionSpacingBelowEyebrow
        }()

        return Text(group.codeSectionName)
            .font(.caption.weight(.semibold))
            .foregroundStyle(groupAccent)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, topPadding)
            .padding(.bottom, 10)
    }

    private func chapterHeader(_ group: BookmarkChapterGroup) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("Chapter \(group.chapterNumber)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .fixedSize(horizontal: true, vertical: false)

            Text(group.chapterTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary.opacity(0.9))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, CodeScreenMetrics.savedChapterHeaderTopPadding)
        .padding(.bottom, CodeScreenMetrics.savedChapterHeaderBottomPadding)
    }

    @ViewBuilder
    private func bookmarkDestination(for bookmark: BookmarkedSection) -> some View {
        // Bookmarks open the single-section detail directly so tapping a
        // bookmarked subsection goes straight to the saved passage
        // rather than landing inside the full chapter reader.
        ReaderView(
            sectionID: bookmark.id,
            codeVersion: bookmark.codeVersion,
            codeSectionID: bookmark.codeSectionID,
            returnsToProjectsAfterRemoval: true
        )
    }

    private func resolvedChapter(for bookmark: BookmarkedSection) -> CodeChapter? {
        if let chapter = library.chapters.first(where: {
            $0.chapterNumber.caseInsensitiveCompare(bookmark.chapterNumber) == .orderedSame
        }) {
            return chapter
        }

        return CodeChapter(
            id: bookmark.id,
            codeSectionID: nil,
            chapterNumber: bookmark.chapterNumber,
            title: bookmark.chapterTitle
        )
    }

    private func bookmarkRow(_ bookmark: BookmarkedSection) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(bookmark.sectionNumber)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text(bookmark.evidenceDisplayTitle)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)

                if !bookmark.nonRepeatingPreviewText.isEmpty {
                    Text(bookmark.nonRepeatingPreviewText)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }

            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
    }

}

private struct BookmarkChapterGroupKey: Hashable {
    let chapterNumber: String
}

private struct BookmarkCodeGroup: Identifiable {
    let sourceID: String
    let codeSectionID: Int64?
    let codeSectionName: String
    let chapterGroups: [BookmarkChapterGroup]

    var id: String { sourceID }
}

private struct BookmarkChapterGroup: Identifiable {
    let chapterNumber: String
    let chapterTitle: String
    let items: [BookmarkedSection]

    var id: String { chapterNumber }
}

/// Hoists the three export-related modal modifiers out of BookmarksView's
/// body so SwiftUI's compile-time type checker doesn't choke on the long
/// modifier chain. Behaviorally identical to inlining the modifiers.
struct BookmarkExportModifier<Progress: View>: ViewModifier {
    @ObservedObject var library: CodeLibraryViewModel
    @ViewBuilder var progressSheet: () -> Progress

    private var isBuilding: Bool {
        if case .building = library.exportState { return true }
        return false
    }

    private var isReady: Bool {
        if case .ready = library.exportState { return true }
        return false
    }

    private var failureMessage: String? {
        if case .failed(let message) = library.exportState { return message }
        return nil
    }

    private var readyURL: URL? {
        if case .ready(let url, _) = library.exportState { return url }
        return nil
    }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: Binding(
                get: { isBuilding },
                set: { if !$0 { library.cancelBookmarkExport() } }
            )) {
                progressSheet()
            }
            .fullScreenCover(isPresented: Binding(
                get: { isReady },
                set: { if !$0 { library.clearBookmarkExportState() } }
            )) {
                if let url = readyURL {
                    ProjectReportPDFPreviewSheet(fileURL: url) {
                        library.clearBookmarkExportState()
                    }
                    .ignoresSafeArea()
                }
            }
            .alert(
                "Export failed",
                isPresented: Binding(
                    get: { failureMessage != nil },
                    set: { _ in library.clearBookmarkExportState() }
                ),
                presenting: failureMessage
            ) { _ in
                Button("OK", role: .cancel) { library.clearBookmarkExportState() }
            } message: { message in
                Text(message)
            }
    }
}

private struct BookmarkExportRequest: Identifiable {
    let id = UUID()
    let bookmarks: [BookmarkedSection]
    let contextLabel: String?
    let scopeLabel: String
}

private struct BookmarkExportPreviewSheet: View {
    let request: BookmarkExportRequest
    let onConfirm: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(request.scopeLabel)
                            .font(.title2.weight(.bold))
                        Text("\(request.bookmarks.count) \(request.bookmarks.count == 1 ? "section" : "sections") will be included in the PDF.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(request.bookmarks.prefix(12).enumerated()), id: \.element.rowID) { index, bookmark in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(bookmark.sectionNumber)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Text(bookmark.title)
                                    .font(.body.weight(.semibold))
                                    .lineLimit(2)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                            if index < min(request.bookmarks.count, 12) - 1 {
                                Divider()
                            }
                        }
                    }

                    if request.bookmarks.count > 12 {
                        Text("And \(request.bookmarks.count - 12) more sections")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    Text("The export uses the canonical code text and clearly separates your private notes. Review the finished PDF before relying on or sharing it.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
            }
            .navigationTitle("Export Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Build PDF", action: onConfirm)
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

enum ProjectOverviewSection: String, CaseIterable, Hashable {
    case overview, review, notebook, evidence, calculator, reports

    fileprivate var cardLabel: (title: String, systemImage: String) {
        switch self {
        case .overview: ("Overview", "list.bullet.rectangle")
        case .review: ("Review", "checklist")
        case .notebook: ("Notes", "note.text")
        case .evidence: ("Evidence", "bookmark")
        case .calculator: ("Calculator", "plus.forwardslash.minus")
        case .reports: ("Reports", "doc.richtext")
        }
    }
}

enum ProjectOverviewTab: String, Hashable {
    case context, zoning
}

private enum FactPresentation {
    typealias Field = (key: String, label: String)

    // Matches projectFactPresentationGroups in the web Facts sheet.
    static let sections: [(title: String, fields: [Field])] = [
        ("Property", [
            ("address", "Address"),
            ("bbl", "BBL"),
            ("borough", "Borough"),
            ("block", "Block"),
            ("tax-lots", "Tax Lot(s)"),
            ("zip-code", "ZIP Code"),
            ("tax-lot-area", "Tax Lot Area"),
            ("land-use-code", "Land Use Code"),
            ("community-district", "Community District")
        ]),
        ("Building", [
            ("occupancy", "Occupancy"),
            ("construction-type", "Construction Type"),
            ("stories-above-grade", "Stories Above Grade"),
            ("levels-below-grade", "Levels Below Grade"),
            ("building-height", "Building Height"),
            ("sprinkler-protection", "Sprinkler Protection"),
            ("building-area", "Building Area"),
            ("building-count", "Number of Buildings"),
            ("residential-units", "Residential Units"),
            ("total-units", "Total Units"),
            ("year-built", "Year Built"),
            ("years-altered", "Year(s) Altered"),
            ("building-class", "Building Class")
        ]),
        ("Work & code basis", [
            ("project-status", "Project Status"),
            ("work-filing-type", "Work / Filing Type"),
            ("code-basis", "Code Basis")
        ]),
        ("Zoning", [
            ("zoning-lot-composition", "Zoning Lot Composition"),
            ("zoning-districts", "Zoning District(s)"),
            ("commercial-overlays", "Commercial Overlay(s)"),
            ("zoning-map", "Zoning Map"),
            ("zoning-lot-area", "Zoning Lot Area"),
            ("lot-width", "Lot Width"),
            ("lot-depth", "Lot Depth"),
            ("lot-type", "Lot Type"),
            ("street-frontages", "Street Frontage(s)"),
            ("transit-zone", "Transit Zone (Legacy Record)")
        ]),
        ("Special designations", [
            ("special-purpose-district", "Special Purpose District(s)"),
            ("special-purpose-subdistrict", "Special Purpose Subdistrict / Subarea"),
            ("mih-area-options", "MIH Area / Applicable Option(s)"),
            ("affordable-housing-zoning-status", "Affordable Housing Zoning Status"),
            ("greater-transit-zone", "Greater Transit Zone"),
            ("parking-geography", "Transit Zones Parking Geography"),
            ("appendix-i-transit-zone", "Appendix I Transit Zone"),
            ("zoning-for-accessibility", "Zoning for Accessibility"),
            ("limited-height-district", "Limited Height District"),
            ("landmark-status", "Landmark Designations"),
            ("historic-district", "Historic District"),
            ("flood-zone-effective-2007", "Flood Zone — Effective FIRM 2007"),
            ("flood-zone-preliminary-2015", "Flood Zone — Preliminary FIRM 2015"),
            ("environmental-designations", "Environmental E-Designations"),
            ("coastal-zone", "Coastal Zone"),
            ("waterfront-status", "Waterfront Status / Waterfront Access Plan"),
            ("lower-density-growth-management-area", "Lower Density Growth Management Area"),
            ("fresh-program-area", "FRESH Program Area"),
            ("appendix-j-designated-m-district", "Appendix J Designated M District"),
            ("adopted-zoning-map-amendments", "Adopted Zoning Map Amendments"),
            ("pending-zoning-map-amendments", "Pending Zoning Map Amendments")
        ]),
        ("Other facts", [])
    ]

    // The former transit field is only shown for Projects that already have it.
    static let standardFields = sections.flatMap { $0.fields }.filter { $0.key != "transit-zone" }
    private static let standardKeysByLabel = Dictionary(uniqueKeysWithValues: standardFields.map {
        ($0.label.lowercased(), $0.key)
    })
    private static let aliases = [
        "stories": "stories-above-grade",
        "sprinkler-status": "sprinkler-protection",
        "work-type": "work-filing-type",
        "special-purpose-districts": "special-purpose-district"
    ]
    private static let positions = Dictionary(uniqueKeysWithValues: sections.enumerated().flatMap { section, entry in
        entry.fields.enumerated().map { index, field in (field.key, (section, index)) }
    })
    private static let emptyValues: Set<String> = [
        "", "-", "–", "—", "unknown", "not provided", "not available", "no information", "no data", "n/a"
    ]

    static func presentationKey(for fact: ProjectStructuredFact) -> String {
        if fact.key.hasPrefix("manual-"),
           let key = standardKeysByLabel[fact.label.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] {
            return key
        }
        return aliases[fact.key] ?? fact.key
    }

    static func position(_ key: String?) -> (Int, Int) {
        key.flatMap { positions[$0] } ?? (sections.count - 1, 0)
    }

    static func ordered<Rows: Collection>(_ rows: Rows, by key: (Rows.Element) -> String?) -> [Rows.Element] {
        rows.sorted { position(key($0)) < position(key($1)) }
    }

    static func hasRecordedValue(_ fact: ProjectStructuredFact) -> Bool {
        fact.status.caseInsensitiveCompare("unknown") != .orderedSame &&
            !emptyValues.contains(fact.value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }
}

private struct ProjectFactDraft: Identifiable {
    let id: String
    let key: String?
    var label: String
    var value: String
    let initialValue: String
    let original: ProjectStructuredFact?

    init(id: String, key: String? = nil, label: String, value: String, original: ProjectStructuredFact? = nil) {
        self.id = id
        self.key = key
        self.label = label
        self.value = value
        self.initialValue = value
        self.original = original
    }
}

private struct ProjectEvidenceRowButtonStyle: PrimitiveButtonStyle {
    var onTrigger: () -> Void = {}

    func makeBody(configuration: Configuration) -> some View {
        // The standard NavigationLink can activate on a horizontal drag in a
        // vertical ScrollView. Require a recognized tap for Evidence rows.
        configuration.label
            .onTapGesture { onTrigger(); configuration.trigger() }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { onTrigger(); configuration.trigger() }
    }
}

private struct ProjectSectionScreen<Content: View>: View {
    let title: String
    let accentColor: Color
    @ViewBuilder let content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12, content: content)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .codeNavigationTopScrollEdge()
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
    }
}

private struct ProjectOverviewView: View {
    let folderID: Int64
    let accentColor: Color
    private let library: CodeLibraryViewModel

    @State private var tab: ProjectOverviewTab
    @State private var isEditing = false

    init(folderID: Int64, accentColor: Color, library: CodeLibraryViewModel) {
        self.folderID = folderID
        self.accentColor = accentColor
        self.library = library
        _tab = State(initialValue: library.projectOverviewTab(for: folderID))
    }

    var body: some View {
        Group {
            switch tab {
            case .context:
                ProjectContextView(folderID: folderID, isEditing: $isEditing)
            case .zoning:
                ProjectFactsView(folderID: folderID, isEditing: $isEditing)
            }
        }
        .codePinnedTopBar {
            Picker("Overview section", selection: $tab) {
                Text("Context").tag(ProjectOverviewTab.context)
                Text("Zoning").tag(ProjectOverviewTab.zoning)
            }
            .codeOpaqueSegmentedPicker()
            .disabled(isEditing)
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, 8)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("Overview")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(isEditing)
        .tint(Color.appChrome)
        .onChange(of: tab) { _, selection in
            library.setProjectOverviewTab(selection, for: folderID)
        }
    }
}

private struct ProjectFactsView: View {
    let folderID: Int64
    @Binding var isEditing: Bool

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var editingFolder: CodeFolder?
    @State private var editingSessionID: UUID?
    @State private var factsDraft: [ProjectFactDraft] = []
    @State private var saveError: String?

    private var folder: CodeFolder? { library.folder(id: folderID) }
    private var editAnimation: Animation? { reduceMotion ? nil : .easeInOut(duration: 0.2) }

    private var recordedFacts: [ProjectStructuredFact] {
        guard let folder else { return [] }
        var facts = folder.structuredFacts
        if !facts.contains(where: { FactPresentation.presentationKey(for: $0) == "address" }) {
            facts.append(ProjectStructuredFact(id: "project-fact:address", key: "address", label: "Address",
                value: folder.address, status: "stated", source: "", sourceText: "", updatedAt: nil))
        }
        return facts.filter(FactPresentation.hasRecordedValue)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if isEditing {
                    LazyVStack(alignment: .leading, spacing: 0) { factsEditor }
                } else {
                    savedFacts
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .scrollIndicators(.hidden)
        .codeSoftTopScrollEdges()
        .codeTransparentBottomScrollEdge()
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            if isEditing {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: cancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save", action: save).fontWeight(.semibold)
                }
            } else {
                EditToolbarItem(label: "Edit zoning", identifier: "project-zoning-edit",
                                isDisabled: folder == nil, action: beginEditing)
            }
        }
        .onChange(of: library.privateSessionID) { _, _ in cancel() }
        .onChange(of: folder?.clientID) { _, _ in cancel() }
    }

    @ViewBuilder
    private var savedFacts: some View {
        let facts = recordedFacts
        if facts.isEmpty {
            Text("No facts yet.").font(.subheadline).foregroundStyle(.secondary)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                let ordered = FactPresentation.ordered(facts, by: FactPresentation.presentationKey(for:))
                ForEach(Array(ordered.enumerated()), id: \.element.id) { index, fact in
                    let section = FactPresentation.position(FactPresentation.presentationKey(for: fact)).0
                    if index == 0 || FactPresentation.position(FactPresentation.presentationKey(for: ordered[index - 1])).0 != section {
                        factHeading(section)
                    }
                    ProjectStructuredFactRow(fact: fact)
                    if index + 1 < ordered.count { Divider() }
                }
                ProjectStructuredFactsSources(facts: facts)
            }
        }
    }

    private func factHeading(_ section: Int) -> some View {
        Text(FactPresentation.sections[section].title)
            .font(.headline)
            .padding(.top, 12)
            .padding(.bottom, 4)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var factsEditor: some View {
        let ordered = FactPresentation.ordered($factsDraft, by: { $0.wrappedValue.key })
        ForEach(Array(ordered.enumerated()), id: \.element.wrappedValue.id) { index, binding in
            let draft = binding.wrappedValue
            let section = FactPresentation.position(draft.key).0
            if index == 0 || FactPresentation.position(ordered[index - 1].wrappedValue.key).0 != section {
                factHeading(section)
            }
            // An empty multiline field does not report the placeholder's baseline.
            ProjectFactRowLayout(verticalAlignment: draft.value.isEmpty ? .center : .firstTextBaseline) {
                if draft.key == nil {
                    TextField("Fact name", text: binding.label, axis: .vertical)
                        .textFieldStyle(.plain)
                        .accessibilityIdentifier("project-fact-label-\(draft.id)")
                } else {
                    Text(draft.label)
                }
            } value: { alignment in
                VStack(alignment: alignment, spacing: 4) {
                    TextField("Add value", text: binding.value,
                              prompt: Text("Add value").foregroundColor(.secondary), axis: .vertical)
                        .textFieldStyle(.plain)
                        .accessibilityLabel(draft.label.isEmpty ? "Fact value" : draft.label)
                        .accessibilityIdentifier("project-fact-value-\(draft.id)")
                    if !draft.value.isEmpty, draft.value == draft.initialValue, let original = draft.original {
                        ProjectStructuredFactStatus(status: original.status)
                    }
                }
            }
            .transition(.opacity)
            if index + 1 < ordered.count { Divider() }
        }
        addFactButton
        if let saveError {
            Text(saveError).font(.footnote).foregroundStyle(.secondary)
        }
    }

    private var addFactButton: some View {
        Button {
            withAnimation(editAnimation) {
                factsDraft.append(ProjectFactDraft(id: UUID().uuidString, label: "", value: ""))
            }
        } label: { Label("Add fact", systemImage: "plus") }
        .font(.subheadline)
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .accessibilityIdentifier("project-fact-add")
    }

    private func beginEditing() {
        guard let folder, library.requireProjectAccess() else { return }
        editingFolder = folder
        editingSessionID = library.privateSessionID
        saveError = nil
        let existingKeys = Set(folder.structuredFacts.map(FactPresentation.presentationKey(for:)))
        factsDraft = folder.structuredFacts.map { fact in
            let value = FactPresentation.hasRecordedValue(fact) ? fact.value : ""
            return ProjectFactDraft(id: fact.id, key: FactPresentation.presentationKey(for: fact), label: fact.label,
                                    value: value, original: fact)
        }
        factsDraft += FactPresentation.standardFields.filter { !existingKeys.contains($0.key) }.map { field in
            ProjectFactDraft(id: "project-fact:\(field.key)", key: field.key, label: field.label,
                             value: field.key == "address" ? folder.address : "")
        }
        isEditing = true
    }

    private func save() {
        guard let original = editingFolder, let session = editingSessionID else { return }
        var facts: [ProjectStructuredFact] = []
        for draft in factsDraft {
            let label = draft.label.trimmingCharacters(in: .whitespacesAndNewlines)
            let value = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
            if value == draft.initialValue.trimmingCharacters(in: .whitespacesAndNewlines) {
                if let fact = draft.original { facts.append(fact) }
                continue
            }
            if value.isEmpty && draft.key != "address" { continue }
            guard !label.isEmpty else {
                saveError = "Give each fact a name."
                return
            }
            facts.append(ProjectStructuredFact(id: draft.id, key: draft.original?.key ?? draft.key ?? "manual-\(draft.id)",
                label: label, value: value, status: value.isEmpty ? "unknown" : "stated", source: "manual",
                sourceText: draft.original == nil ? "Entered on iPhone." : "Edited on iPhone.", updatedAt: Date()))
        }
        if facts == original.structuredFacts || library.updateProjectFacts(folderID: folderID, facts: facts,
            expectedClientID: original.clientID, expectedFacts: original.structuredFacts, sessionID: session) {
            cancel()
        } else {
            saveError = library.statusMessage ?? "Your changes could not be saved. Try again."
        }
    }

    private func cancel() {
        isEditing = false
        editingFolder = nil
        editingSessionID = nil
        factsDraft = []
        saveError = nil
    }
}

struct ProjectView: View {
    let folderID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.scenePhase) private var scenePhase
    @State private var sortMode: BookmarkSortMode = .codeOrder
    @State private var removedProjectSections: [ProjectEvidenceRemoval] = []
    @State private var removalSessionID: UUID?
    @State private var removalFolderID: Int64?
    @State private var undoFailed = false
    @State private var isSelecting = false
    @State private var selectedBookmarkRowIDs: Set<String> = []
    @State private var folderEditorTarget: ProjectFolderEditorTarget?
    @State private var pendingExport: BookmarkExportRequest?
    @State private var projectHubSnapshot: ProjectHubSnapshot?
    @State private var projectHubLoadTask: Task<Void, Never>?
    @State private var projectHubError: String?
    @State private var isProjectHubVisible = false
    @State private var isProjectDescriptionExpanded = false
    @State private var lastProjectHubLoadAt: Date?
    @State private var projectReportPreviewURL: URL?
    @State private var isProjectReportBuilding = false
    @State private var projectReportBuildError: String?
    @State private var collapsedEvidenceGroupIDs: Set<String> = []
    @State private var evidenceSearchQuery = ""
    @State private var isEvidenceSearchPresented = false
    @State private var showsResearchSelectionLimit = false

    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let automaticProjectHubRefreshInterval: TimeInterval = 30
    private var isProjectHubLoading: Bool { projectHubLoadTask != nil }

    private var folder: CodeFolder? {
        library.folder(id: folderID)
    }

    private var isProjectFolder: Bool {
        folder?.folderType == .project
    }

    private var projectBookmarks: [BookmarkedSection] {
        BookmarkSorter.sorted(
            library.bookmarks(inFolder: folderID),
            mode: sortMode,
            title: \.evidenceDisplayTitle,
            codeSectionName: { library.codeSectionName(id: $0) }
        )
    }

    private var visibleProjectBookmarks: [BookmarkedSection] {
        let query = evidenceSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return projectBookmarks.filter { bookmark in
            guard !query.isEmpty else { return true }
            return [
                bookmark.sectionNumber,
                bookmark.displayTitle,
                bookmark.previewText,
                bookmark.chapterTitle,
                bookmark.codeSectionName
            ].contains { $0.lowercased().contains(query) }
        }
    }

    private var accentColor: Color {
        Color(uiColor: PlatformColor(hex: folder?.colorHex ?? CodeFolder.defaultColorHex) ?? library.accentColor())
    }

    private var projectCodeQuestions: [ProjectCodeQuestionRecord] {
        ProjectCodeQuestionRecord.records(
            artifacts: projectHubSnapshot?.foundationArtifacts ?? [],
            researchAnswers: projectHubSnapshot?.researchAnswers ?? []
        )
    }

    private var nativeNotebookReferenceCandidates: [NativeNotebookReferenceCandidate] {
        let evidence = projectBookmarks.map { bookmark in
            NativeNotebookReferenceCandidate(
                kind: "canonicalSection",
                referenceID: String(bookmark.id),
                label: "\(bookmark.codeSectionName) · \(NativeReaderEditionLabel.label(for: bookmark.codeVersion)) · § \(bookmark.sectionNumber) · \(bookmark.displayTitle)",
                detail: "Saved Evidence",
                sectionID: String(bookmark.id),
                codeVersion: bookmark.codeVersion
            )
        }
        let research = (projectHubSnapshot?.researchAnswers ?? []).map { answer in
            NativeNotebookReferenceCandidate(
                kind: "researchAnswer",
                referenceID: answer.id,
                label: answer.question,
                detail: "per codes Assistant",
                conversationID: answer.conversationID
            )
        }
        return evidence + research
    }

    var body: some View {
        Group {
            if isProjectFolder {
                projectDashboard
            } else {
                projectEvidenceDestination
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("project-folder-root")
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: ProjectOverviewSection.self) { section in
            projectSectionDestination(section)
        }
        .toolbar {
            if isProjectFolder {
                EditToolbarItem(label: "Edit project", identifier: "project-edit") {
                    if let folder { folderEditorTarget = .edit(folder) }
                }
            }
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                defaultFolderType: target.folder?.folderType ?? .project,
                onSave: { name, address, description, structuredFacts, colorHex, _ in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, address: address, description: description, structuredFacts: structuredFacts, colorHex: colorHex)
                    }
                },
                onDelete: {
                    if let existing = target.folder {
                        library.deleteFolder(id: existing.id)
                        dismiss()
                    }
                }
            )
        }

        .onChange(of: library.privateSessionID) { _, _ in
            resetProjectHub()
        }
        .onChange(of: folderID) { _, _ in
            resetProjectHub()
        }
        .refreshable {
            library.refreshBookmarks()
            await loadProjectHub()
        }
        .onAppear {
            isProjectHubVisible = true
            // Reader and save-sheet mutations already publish bookmark and
            // Project rows optimistically. Avoid re-reading and rebuilding the
            // full Saved library simply because this destination appeared;
            // pull-to-refresh remains the explicit reconciliation path.
            if isProjectFolder {
                library.noteProjectOpened(folderID)
            }
        }
        .onDisappear {
            isProjectHubVisible = false
        }
        .task(id: "\(library.privateSessionID):\(folder?.clientID ?? "missing")") {
            // This task starts again when a section pops back to the overview.
            // Keep the current Project's previews visible during reconciliation.
            await loadProjectHub()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, isProjectHubVisible else { return }
            Task { await refreshProjectHubAfterForegroundingIfNeeded() }
        }
        .onChange(of: projectBookmarks) { _, _ in
            selectedBookmarkRowIDs = selectedBookmarkRowIDs.intersection(Set(projectBookmarks.map(\.rowID)))
        }
        .onChange(of: visibleProjectBookmarks) { _, visibleBookmarks in
            selectedBookmarkRowIDs = selectedBookmarkRowIDs.intersection(Set(visibleBookmarks.map(\.rowID)))
        }
        .onChange(of: folder?.id) { _, newFolderID in
            finishSelectingEvidence()
            if let newFolderID {
                if isProjectFolder {
                    library.noteProjectOpened(newFolderID)
                }
            } else {
                dismiss()
            }
        }
    }

    private var selectedBookmarks: [BookmarkedSection] {
        visibleProjectBookmarks.filter { selectedBookmarkRowIDs.contains($0.rowID) }
    }

    @ViewBuilder
    private var projectHubStatus: some View {
        if let snapshot = projectHubSnapshot, snapshot.loadedFromCache {
            Label(
                "Saved offline copy from \(projectHubDate(snapshot.cachedAt ?? "")). Connect to check for updates.",
                systemImage: "icloud.slash"
            )
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.secondary.opacity(0.10))
            )
        }

        if isProjectHubLoading && projectHubSnapshot == nil {
            HStack(spacing: 8) {
                ProgressView()
                    .accessibilityLabel("Loading Project")
            }
            .padding(.vertical, 8)
        }

        if let projectHubError {
            Text(projectHubError)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.secondary.opacity(0.10))
                )
        }
    }

    @ViewBuilder
    private var projectCodeQuestionSummary: some View {
        projectHubSection(title: "Code Questions", systemImage: "questionmark.bubble") {
            CodeQuestionProjectHubList(
                records: projectCodeQuestions,
                accent: accentColor,
                onOpenReport: { manifestID in
                    buildProjectCodeMemoPDF(manifestID: manifestID)
                }
            )
        }
    }

    private func projectNotebookDestination(projectID: String, cardID: String? = nil, startNewNote: Bool = false) -> some View {
        ProjectNotebookView(
            projectID: projectID,
            projectName: folder?.name ?? "Project",
            accentColor: accentColor,
            referenceCandidates: nativeNotebookReferenceCandidates,
            initialCardID: cardID,
            startNewNote: startNewNote,
            onChanged: { Task { await loadProjectHub() } }
        )
        .environmentObject(library)
    }

    @ViewBuilder
    private var projectReportSummary: some View {
        let reports = projectHubSnapshot?.reports ?? []
        VStack(alignment: .leading, spacing: 8) {
            ForEach(reports) { report in
                VStack(alignment: .leading, spacing: 7) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("REPORT V\(report.reportVersion)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(accentColor)
                        Spacer(minLength: 8)
                        Text(ListTimestamp.date(from: report.createdAt)?.formatted(date: .abbreviated, time: .shortened) ?? "")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Text(report.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text("\(report.itemCount) \(report.itemCount == 1 ? "item" : "items") · \(report.author.displayName)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    if let files = report.files, !files.isEmpty {
                        Text(
                            "Stored: " + Array(Set(
                                files.map { $0.format == "ios-pdf" ? "iOS PDF" : "Web PDF" }
                            ))
                                .sorted()
                                .joined(separator: " · ")
                        )
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    Button {
                        buildProjectReportPDF(report)
                    } label: {
                        Label(
                            isProjectReportBuilding ? "Opening PDF…" : "Open PDF",
                            systemImage: "doc.richtext"
                        )
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(accentColor)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            Capsule(style: .continuous)
                                .fill(accentColor.opacity(0.14))
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(isProjectReportBuilding)
                    if let url = SavedProjectReportLink(projectID: report.projectID, manifestID: report.id).url {
                        Button("Copy link", systemImage: "link") {
                            UIPasteboard.general.url = url
                            UIAccessibility.post(notification: .announcement, argument: "Link copied for version \(report.reportVersion)")
                        }
                        .font(.footnote.weight(.semibold))
                        .accessibilityIdentifier("reports-copy-version-link")
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(accentColor.opacity(0.08))
                )
            }
            if let projectReportBuildError {
                Text(projectReportBuildError)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func projectHubSection<Content: View>(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(.primary)
            content()
        }
        .padding(.top, 4)
    }

    private func projectHubEmpty(_ message: String) -> some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.secondary.opacity(0.08))
            )
    }

    private var permitextWebURL: URL? {
        guard let value = PermitextBackendConfiguration.load().apiBaseURLString else {
            return nil
        }
        return URL(string: value)
    }

    private func projectReviewStatus(_ value: String) -> String {
        value.replacingOccurrences(of: "-", with: " ").capitalized
    }

    private func projectHubDate(_ value: String) -> String {
        let date = ListTimestamp.date(from: value)
        return date?.formatted(date: .abbreviated, time: .omitted) ?? ""
    }

    private func buildProjectReportPDF(_ report: ProjectReportSummary) {
        guard !isProjectReportBuilding else { return }
        isProjectReportBuilding = true
        projectReportBuildError = nil
        Task {
            do {
                projectReportPreviewURL = try await library.projectReportPDF(manifestID: report.id)
                await loadProjectHub()
            } catch {
                projectReportBuildError = error.localizedDescription
            }
            isProjectReportBuilding = false
        }
    }

    private func buildProjectCodeMemoPDF(manifestID: String) {
        guard !isProjectReportBuilding else { return }
        isProjectReportBuilding = true
        projectReportBuildError = nil
        Task {
            do {
                projectReportPreviewURL = try await library.projectReportPDF(manifestID: manifestID)
                await loadProjectHub()
            } catch {
                projectReportBuildError = error.localizedDescription
            }
            isProjectReportBuilding = false
        }
    }

    @MainActor
    private func loadProjectHub() async {
        let identity = library.privateRequestIdentity
        guard identity != nil else { projectHubSnapshot = nil; return }
        guard isProjectFolder else {
            projectHubSnapshot = nil
            projectHubError = nil
            return
        }
        if let projectHubLoadTask {
            await projectHubLoadTask.value
            return
        }
        lastProjectHubLoadAt = Date()
        // Keep the in-flight load available to a section pushed from the overview.
        let task = Task {
            defer { if !Task.isCancelled { projectHubLoadTask = nil } }
            do {
                try Task.checkCancellation()
                let snapshot = try await library.projectHubSnapshot(folderID: folderID)
                guard identity == library.privateRequestIdentity, !Task.isCancelled else { return }
                projectHubSnapshot = snapshot
                projectHubError = nil
            } catch {
                guard identity == library.privateRequestIdentity, !Task.isCancelled else { return }
                if NativePrivateCachePolicy.requiresInvalidation(after: error) { projectHubSnapshot = nil }
                projectHubError = error.localizedDescription
            }
        }
        projectHubLoadTask = task
        await task.value
    }

    private func resetProjectHub() {
        projectHubLoadTask?.cancel()
        projectHubLoadTask = nil
        isProjectDescriptionExpanded = false
        removedProjectSections = []
        projectReportPreviewURL = nil
        projectHubSnapshot = nil
        projectHubError = nil
        lastProjectHubLoadAt = nil
    }

    @MainActor
    private func refreshProjectHubAfterForegroundingIfNeeded() async {
        let now = Date()
        if let lastProjectHubLoadAt,
           now.timeIntervalSince(lastProjectHubLoadAt) < automaticProjectHubRefreshInterval {
            return
        }
        await loadProjectHub()
    }

    private var projectDashboard: some View {
        ViewThatFits(in: .vertical) {
            if !dynamicTypeSize.isAccessibilitySize {
                projectDashboardContent(compact: false, expandsCards: true)
                projectDashboardContent(compact: true, expandsCards: true)
            }
            ScrollView {
                projectDashboardContent(compact: !dynamicTypeSize.isAccessibilitySize, expandsCards: false)
            }
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // The floating tab bar can cover part of the proposed content area.
        .safeAreaPadding(.bottom, projectDashboardTabBarInset)
    }

    private var projectDashboardTabBarInset: CGFloat {
        if #available(iOS 26.0, *) { return 16 }
        return 0
    }

    private func projectDashboardContent(compact: Bool, expandsCards: Bool) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : CodeScreenMetrics.contentSpacingBelowTitle) {
            projectHeader
                .fixedSize(horizontal: false, vertical: true)
            projectDeviceSyncIssue
            projectSectionCards(compact: compact, expandsCards: expandsCards)
        }
        .padding(.horizontal, contentHorizontalInset)
        .padding(.top, compact ? 6 : 12)
        .padding(.bottom, compact ? 4 : 12)
    }

    private var projectHeader: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
            HStack(alignment: .top, spacing: 10) {
                if !isProjectFolder {
                    Circle()
                        .fill(accentColor)
                        .frame(width: 12, height: 12)
                }
                Text(folder?.name ?? (isProjectFolder ? "Project" : "Reference"))
                    .accessibilityIdentifier("project-workspace-name")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                if !isProjectFolder {
                    Button {
                        if let folder {
                            folderEditorTarget = .edit(folder)
                        }
                    } label: {
                        Image(systemName: "pencil")
                            .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                            .foregroundStyle(Color.appChrome)
                            .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Edit reference")
                }
            }

            if isProjectFolder, let folder {
                projectSummary(for: folder)
            }

            if !isProjectFolder,
               let description = folder?.description.trimmingCharacters(in: .whitespacesAndNewlines),
               !description.isEmpty {
                DisclosureGroup("Reference context", isExpanded: $isProjectDescriptionExpanded) {
                    Text(description).font(.subheadline).foregroundStyle(.secondary)
                }
                .tint(.primary)
            }
        }
    }

    private func projectSummary(for folder: CodeFolder) -> some View {
        let fields = [
            (key: "address", label: "Address"),
            (key: "tax-lot-area", label: "Tax Lot Area"),
            (key: "occupancy", label: "Occupancy"),
            (key: "construction-type", label: "Construction Type"),
            (key: "building-area", label: "Building Area"),
            (key: "zoning-districts", label: "Zoning District")
        ]
        let address = folder.address.trimmingCharacters(in: .whitespacesAndNewlines)

        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .topLeading),
                                        count: dynamicTypeSize.isAccessibilitySize ? 1 : 2),
                         alignment: .leading, spacing: 8) {
            ForEach(fields, id: \.key) { field in
                let fact = folder.structuredFacts.lazy
                    .filter { $0.key == field.key }
                    .map { $0.value.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .first { !$0.isEmpty }
                let value = field.key == "address" && !address.isEmpty ? address : fact
                VStack(alignment: .leading, spacing: 2) {
                    Text(field.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(value ?? "—")
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(field.label)
                .accessibilityValue(value ?? "Not provided")
                .accessibilityIdentifier("project-summary-\(field.key)")
            }
        }
    }

    private func projectSectionCards(compact: Bool, expandsCards: Bool) -> some View {
        let sections = ProjectOverviewSection.allCases
        let columns = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        let rowStarts = Array(stride(from: 0, to: sections.count, by: columns))
        return VStack(spacing: compact ? 8 : 10) {
            ForEach(rowStarts, id: \.self) { start in
                HStack(alignment: .top, spacing: 8) {
                    ForEach(sections[start..<min(start + columns, sections.count)], id: \.self) { section in
                        projectSectionLink(section, compact: compact, expands: expandsCards)
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .tint(Color.appChrome)
    }

    private func projectSectionLink(_ section: ProjectOverviewSection, compact: Bool, expands: Bool) -> some View {
        let label = section.cardLabel
        let minimumHeight: CGFloat = dynamicTypeSize.isAccessibilitySize ? 140 : (compact ? 74 : 116)
        return NavigationLink(value: section) {
            HStack(spacing: 8) {
                Image(systemName: label.systemImage)
                    .font(.body.weight(.medium))
                    .accessibilityHidden(true)
                Text(label.title).font(.headline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .foregroundStyle(.primary)
            .padding(compact ? 8 : 14)
            .frame(maxWidth: .infinity, minHeight: minimumHeight, maxHeight: expands ? .infinity : nil, alignment: .topLeading)
            .background(projectTileBackgroundColor(for: folder?.colorHex ?? CodeFolder.defaultColorHex),
                        in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        }
        .accessibilityIdentifier("project-section-\(section.rawValue)")
    }

    @ViewBuilder
    private func projectSectionDestination(_ section: ProjectOverviewSection) -> some View {
        switch section {
        case .review:
            ProjectWorkflowView(folderID: folderID, initialTab: library.projectReviewTab(for: folderID))
        case .overview:
            ProjectOverviewView(folderID: folderID, accentColor: accentColor, library: library)
        case .notebook:
            if let projectID = library.backendProjectID(for: folderID) {
                projectNotebookDestination(projectID: projectID)
                    .task { if projectHubSnapshot == nil { await loadProjectHub() } }
            } else {
                ProjectSectionScreen(title: "Notes", accentColor: accentColor) {
                    projectHubEmpty("Connect to sync this Project’s Notebook.")
                }
                .scrollIndicators(.hidden, axes: .vertical)
            }
        case .evidence:
            projectEvidenceDestination
        case .calculator:
            ProjectCalculatorView(folderID: folderID, accentColor: accentColor)
        case .reports:
            ProjectSectionScreen(title: "Reports", accentColor: accentColor) {
                projectHubStatus
                if projectHubSnapshot != nil || (!isProjectHubLoading && projectHubError == nil) {
                    projectReportSummary
                    if !projectCodeQuestions.isEmpty { projectCodeQuestionSummary }
                }
            }
            .fullScreenCover(
                isPresented: Binding(
                    get: { projectReportPreviewURL != nil },
                    set: { if !$0 { projectReportPreviewURL = nil } }
                )
            ) {
                if let projectReportPreviewURL {
                    ProjectReportPDFPreviewSheet(fileURL: projectReportPreviewURL) {
                        self.projectReportPreviewURL = nil
                    }
                }
            }
            .task { await loadProjectHub() }
            .refreshable { await loadProjectHub() }
        }
    }

    @ViewBuilder
    private var projectEvidenceDestination: some View {
        if isProjectFolder {
            evidenceScreen
        } else {
            evidenceScreen
                .sheet(item: $pendingExport) { request in
                    BookmarkExportPreviewSheet(request: request) {
                        pendingExport = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            library.startBookmarkExport(bookmarks: request.bookmarks, contextLabel: request.contextLabel)
                        }
                    }
                }
                .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        }
    }

    private var evidenceScreen: some View {
        ProjectSectionScreen(title: isProjectFolder ? "Evidence" : folder?.name ?? "Reference", accentColor: accentColor) {
            if !isProjectFolder { projectHeader }
            if isProjectFolder { projectDeviceSyncIssue }
            if projectBookmarks.isEmpty {
                projectHubEmpty("No Saved Evidence yet.")
            } else if visibleProjectBookmarks.isEmpty {
                ContentUnavailableView("No matching evidence", systemImage: "bookmark.slash",
                    description: Text("Change the search to see saved evidence."))
            } else {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if sortMode == .recentlySaved || sortMode == .title {
                        ForEach(visibleProjectBookmarks, id: \.rowID) { bookmark in
                            projectBookmarkRow(bookmark, showsSource: true)
                            CodeHairline()
                        }
                    } else {
                        let groups = ProjectEvidenceOrganizer.codeGroups(
                            visibleProjectBookmarks,
                            alphabetizeCodeBooks: sortMode == .codeBook
                        )
                        ForEach(groups) { group in
                            projectEvidenceGroup(group)
                        }
                    }
                }
            }
        }
        .scrollIndicators(isProjectFolder ? .hidden : .automatic, axes: .vertical)
        .searchable(text: $evidenceSearchQuery, isPresented: $isEvidenceSearchPresented,
                    prompt: "Search saved evidence")
        .navigationBarBackButtonHidden(isSelecting)
        .toolbar {
            if isSelecting {
                ListSelectionToolbar(
                    selectedCount: selectedBookmarks.count,
                    availableCount: visibleProjectBookmarks.count,
                    cancel: finishSelectingEvidence,
                    selectAll: { selectedBookmarkRowIDs = Set(visibleProjectBookmarks.map(\.rowID)) },
                    deselectAll: { selectedBookmarkRowIDs = [] }
                ) {
                    selectedEvidenceActions
                }
            } else if isProjectFolder {
                IconToolbarGroup {
                    if !visibleProjectBookmarks.isEmpty {
                        ListSelectButton(title: "Select sections", action: startSelectingEvidence)
                    }
                    projectEvidenceSortMenu
                }
            } else {
                ToolbarItem(placement: .topBarTrailing) {
                    evidenceActionsMenu
                }
            }
        }
        .safeAreaInset(edge: .bottom) { projectEvidenceUndo }
        .alert("Select fewer passages", isPresented: $showsResearchSelectionLimit) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Assistant can take up to 24 passages at once, with 12,000 characters per passage.")
        }
        .refreshable { library.refreshBookmarks() }
    }

    @ViewBuilder
    private var projectDeviceSyncIssue: some View {
        if let status = library.projectDeviceSyncIssue {
            Label(status, systemImage: "arrow.triangle.2.circlepath")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Device sync: \(status)")
                .accessibilityIdentifier("project-device-sync-status")
        }
    }

    @ViewBuilder
    private var projectEvidenceUndo: some View {
        if !removedProjectSections.isEmpty {
            HStack {
                Text(undoFailed ? "Could not restore all items. Try Undo again." : "Removed from this project.")
                    .font(.subheadline)
                Spacer()
                Button("Undo") {
                    guard removalSessionID == library.privateSessionID, removalFolderID == folderID else {
                        removedProjectSections = []
                        return
                    }
                    removedProjectSections = library.restoreProjectSections(removedProjectSections, toFolder: folderID)
                    undoFailed = !removedProjectSections.isEmpty
                }
                .frame(minWidth: 44, minHeight: 44)
                Button { removedProjectSections = [] } label: { Image(systemName: "xmark") }
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel("Dismiss Undo")
            }
            .buttonStyle(.plain)
            .padding(.horizontal)
        }
    }

    private var projectEvidenceSortMenu: some View {
        Menu {
            evidenceSortPicker
        } label: {
            ToolbarActionIcon(systemImage: "arrow.up.arrow.down")
                .foregroundStyle(Color.appChrome)
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .accessibilityLabel("Sort evidence")
        .disabled(projectBookmarks.isEmpty)
    }

    private var evidenceSortPicker: some View {
        Picker("Sort evidence", selection: $sortMode) {
            ForEach(BookmarkSortMode.allCases.filter { !isProjectFolder || $0 != .codeBook }) { mode in
                Label(mode.label, systemImage: mode.systemImage).tag(mode)
            }
        }
        .pickerStyle(.inline)
    }

    private var evidenceActionsMenu: some View {
        let bookmarks = projectBookmarks
        return Menu {
            Menu("Sort", systemImage: "arrow.up.arrow.down") {
                evidenceSortPicker
            }
            .disabled(bookmarks.isEmpty)
            if !isProjectFolder {
                Button("Export project (\(bookmarks.count))", systemImage: "square.and.arrow.up") {
                    pendingExport = BookmarkExportRequest(
                        bookmarks: bookmarks,
                        contextLabel: folder?.name,
                        scopeLabel: folder?.name ?? "Project"
                    )
                }
                .disabled(bookmarks.isEmpty)
                Button("Select sections", systemImage: "checklist", action: startSelectingEvidence)
                    .disabled(visibleProjectBookmarks.isEmpty)
            }
        } label: {
            ToolbarActionIcon(systemImage: "line.3.horizontal.decrease")
                .foregroundStyle(Color.appChrome)
        }
        .menuStyle(.button)
        .menuIndicator(.hidden)
        .accessibilityLabel("Evidence actions")
    }

    @ViewBuilder
    private func projectEvidenceGroup(_ group: ProjectEvidenceCodeGroup) -> some View {
        let groupAccent = Color(uiColor: CodeSectionThemeProfile(codeSectionName: group.codeSectionName).accentColor)
        let isCollapsed = collapsedEvidenceGroupIDs.contains(group.id)

        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    if isCollapsed {
                        collapsedEvidenceGroupIDs.remove(group.id)
                    } else {
                        collapsedEvidenceGroupIDs.insert(group.id)
                    }
                }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(group.displayTitle)
                        .font(CodeTypography.sectionLabel)
                        .foregroundStyle(groupAccent)
                        .textCase(.uppercase)
                        .tracking(0.2)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 12)
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(groupAccent)
                        .rotationEffect(.degrees(isCollapsed ? -90 : 0))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(group.displayTitle)
            .accessibilityValue(isCollapsed ? "Collapsed" : "Expanded")

            if !isCollapsed {
                ForEach(group.chapters) { chapter in
                    Text(chapter.displayTitle)
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(groupAccent)
                        .textCase(.uppercase)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 24)
                        .padding(.bottom, 8)

                    ForEach(chapter.items, id: \.rowID) { bookmark in
                        projectBookmarkRow(bookmark)
                        CodeHairline()
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.top, 28)
    }

    @ViewBuilder
    private var exportProgressSheet: some View {
        if case let .building(progress, sectionTitle) = library.exportState {
            VStack(spacing: 20) {
                ExportProgressLine(progress: progress)
                    .padding(.horizontal, 24)

                VStack(spacing: 4) {
                    Text("Building PDF")
                        .font(.headline)
                    Text(sectionTitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                Button(role: .cancel) {
                    library.cancelBookmarkExport()
                } label: {
                    Text("Cancel")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color.secondary.opacity(0.15)))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
            }
            .padding(.vertical, 32)
            .presentationDetents([.height(220)])
            .interactiveDismissDisabled()
        }
    }

    @ViewBuilder
    private var selectedEvidenceActions: some View {
        if isProjectFolder && library.hasResearchAccess {
            Button {
                if askAssistant(about: selectedBookmarks) { finishSelectingEvidence() }
            } label: {
                ToolbarActionIcon(systemImage: "sparkle")
            }
            .accessibilityLabel("Ask Assistant about selected evidence")
            .disabled(selectedBookmarks.isEmpty)
        }
        if !isProjectFolder {
            Button {
                pendingExport = BookmarkExportRequest(
                    bookmarks: selectedBookmarks,
                    contextLabel: folder?.name,
                    scopeLabel: "Selected in \(folder?.name ?? "Project")"
                )
            } label: {
                ToolbarActionIcon(systemImage: "square.and.arrow.up")
            }
            .accessibilityLabel("Export selected passages")
        }
        Button {
            removeProjectEvidence(selectedBookmarks)
            finishSelectingEvidence()
        } label: {
            ToolbarActionIcon(systemImage: "trash")
                .foregroundStyle(Color.appChrome)
        }
        .accessibilityLabel("Remove from project")
        .disabled(selectedBookmarks.isEmpty)
    }

    @discardableResult
    private func askAssistant(about bookmarks: [BookmarkedSection]) -> Bool {
        let selections = bookmarks.flatMap { bookmark -> [ResearchSelectionRequest] in
            let excerpts = bookmark.selectedExcerpts.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            if excerpts.isEmpty {
                return [.sectionReference(id: bookmark.id, codeVersion: bookmark.codeVersion)]
            }
            let edition = UserContentSyncCodeVersion.server(bookmark.codeVersion)
            return excerpts.map {
                ResearchSelectionRequest(sectionID: String(bookmark.id), selectedText: $0, codeVersion: edition)
            }
        }
        guard !selections.isEmpty else { return false }
        guard selections.count <= 24, selections.allSatisfy({ $0.selectedText.utf16.count <= 12_000 }),
              selections.reduce(0, { $0 + $1.selectedText.utf16.count }) <= 48_000 else {
            showsResearchSelectionLimit = true
            return false
        }
        library.askAssistant(in: folderID, about: selections)
        return true
    }

    private func removeProjectEvidence(_ sections: [BookmarkedSection]) {
        if removalSessionID != library.privateSessionID || removalFolderID != folderID { removedProjectSections = [] }
        removalSessionID = library.privateSessionID
        removalFolderID = folderID
        let removed = library.removeSections(sections, fromFolder: folderID)
        guard !removed.isEmpty else { return }
        removedProjectSections = removed
        undoFailed = false
    }

    private func startSelectingEvidence() {
        ListSelectionMotion.run(reduceMotion: reduceMotion) { isSelecting = true }
    }

    private func finishSelectingEvidence() {
        guard isSelecting else { return }
        ListSelectionMotion.run(reduceMotion: reduceMotion) {
            isSelecting = false
            selectedBookmarkRowIDs.removeAll()
        }
    }

    @ViewBuilder
    private func projectBookmarkRow(_ bookmark: BookmarkedSection, showsSource: Bool = false) -> some View {
        let isSelected = selectedBookmarkRowIDs.contains(bookmark.rowID)
        Group {
            if isSelecting {
                Button { toggleSelection(bookmark.rowID) } label: {
                    HStack(alignment: .top, spacing: 12) {
                        ListSelectionIndicator(isSelected: isSelected)
                        projectBookmarkContent(bookmark, showsSource: showsSource)
                    }
                    .frame(minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            } else {
                NavigationLink {
                    if isProjectFolder {
                        LinkedChapterReaderDestination(sectionID: bookmark.id, codeVersion: bookmark.codeVersion,
                            codeSectionID: bookmark.codeSectionID, passages: bookmark.selectedExcerpts.map {
                                NotebookEvidencePassage(exact: $0, prefix: "", suffix: "", start: nil, end: nil)
                            }, evidenceFolderID: folderID, sharedLibrary: library)
                    } else {
                        ReaderView(sectionID: bookmark.id, codeVersion: bookmark.codeVersion, codeSectionID: bookmark.codeSectionID,
                            returnsToProjectsAfterRemoval: true, selectedExcerpts: bookmark.selectedExcerpts)
                    }
                } label: {
                    projectBookmarkContent(bookmark, showsSource: showsSource)
                        .contentShape(Rectangle())
                }
                .contextMenu {
                    if isProjectFolder && library.hasResearchAccess {
                        Button("Ask Assistant", systemImage: "sparkle") { askAssistant(about: [bookmark]) }
                    }
                }
            }
        }
        .buttonStyle(ProjectEvidenceRowButtonStyle(onTrigger: {
            if isProjectFolder && !isSelecting { LocalPerformanceRecorder.record(.evidencePassageOpenRequested) }
        }))
        .accessibilityIdentifier("project-bookmark-\(bookmark.rowID)")
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
    }

    private func projectBookmarkContent(_ bookmark: BookmarkedSection, showsSource: Bool) -> some View {
        let bookmarkAccent = bookmark.codeSectionName.isEmpty
            ? Color(uiColor: library.accentColor(for: bookmark.codeSectionID))
            : Color(uiColor: CodeSectionThemeProfile(codeSectionName: bookmark.codeSectionName).accentColor)

        return VStack(alignment: .leading, spacing: 4) {
            Text(bookmark.sectionNumber)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(bookmark.evidenceDisplayTitle)
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
            if showsSource {
                let codeName = bookmark.codeSectionName.isEmpty
                    ? library.codeSectionName(id: bookmark.codeSectionID)
                    : bookmark.codeSectionName
                let source = ProjectEvidenceOrganizer.displayTitle(codeVersion: bookmark.codeVersion, codeSectionName: codeName)
                let edition = NativeReaderEditionLabel.label(for: bookmark.codeVersion)
                Text(source.localizedCaseInsensitiveContains(edition) ? source : "\(source) · \(edition)")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(bookmarkAccent)
            }
            let preview = bookmark.selectedExcerpts.last ?? bookmark.nonRepeatingPreviewText
            if !preview.isEmpty {
                Text(preview)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
        }
        .multilineTextAlignment(.leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func toggleSelection(_ rowID: String) {
        if selectedBookmarkRowIDs.contains(rowID) {
            selectedBookmarkRowIDs.remove(rowID)
        } else {
            selectedBookmarkRowIDs.insert(rowID)
        }
    }
}

private struct ExportProgressLine: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            Capsule()
                .fill(Color.appChrome)
                .frame(
                    width: max(0, proxy.size.width * min(max(progress, 0), 1)),
                    height: 5
                )
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Export progress")
        .accessibilityValue("\(Int((min(max(progress, 0), 1) * 100).rounded())) percent")
    }
}

private enum ProjectFolderEditorTarget: Identifiable {
    case edit(CodeFolder)

    var id: String {
        switch self {
        case .edit(let folder): return "edit-\(folder.id)"
        }
    }

    var folder: CodeFolder? {
        if case .edit(let folder) = self { return folder }
        return nil
    }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}

#Preview("Project") {
    ProjectView(folderID: 1)
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}
#endif

private func projectTileBackgroundColor(for hex: String) -> Color {
    let project = PlatformColor(hex: hex) ?? .systemBlue
    return Color(uiColor: UIColor { traits in
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        project.resolvedColor(with: traits).getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        let surface: CGFloat = traits.userInterfaceStyle == .dark ? 0 : 1
        return UIColor(
            red: red * 0.42 + surface * 0.58,
            green: green * 0.42 + surface * 0.58,
            blue: blue * 0.42 + surface * 0.58,
            alpha: 1
        )
    })
}
