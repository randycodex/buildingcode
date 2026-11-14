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
    @State private var scrollOffset: CGFloat = 0
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

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
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
            Image(systemName: library.signedInAccount == nil ? "person.crop.circle" : "person.crop.circle.fill")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open Account")
    }

    private func bookmarkAccentColor(for codeSectionID: Int64?) -> Color {
        Color(uiColor: library.accentColor(for: codeSectionID))
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
            .sheet(isPresented: $showingAccessSettings) {
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
            GeometryReader { proxy in
                Color.clear
                    .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("savedScroll")).minY)
            }
            .frame(height: 0)

            VStack(alignment: .leading, spacing: 0) {
                savedScreenHeader


            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.horizontal, contentHorizontalInset)
            .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
            .padding(.bottom, tabBarClearance)
        }
        .accessibilityIdentifier("projects-root")
        .overlay(alignment: .top) {
            CodeTopContentFade(title: screenTitle, progress: collapseProgress)
        }
        .overlay(alignment: .top) {
            pinnedSavedHeader
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
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
        .sheet(isPresented: $showingSettings) {
            NavigationStack { SettingsView() }
                .environmentObject(library)
        }
        .coordinateSpace(name: "savedScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var savedHeaderActionButtons: some View {
        HStack(spacing: 0) {
            Button {
                if library.hasProjectAccess { folderEditorTarget = .new }
                else { library.requireProjectAccess() }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                    .foregroundStyle(Color.appChrome)
                    .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("New project")
            accountButton
        }
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private var savedHeaderActions: some View {
        if #available(iOS 26.0, *) {
            savedHeaderActionButtons.glassEffect(.regular, in: Capsule())
        } else {
            savedHeaderActionButtons.background(.regularMaterial, in: Capsule())
        }
    }

    private var savedScreenHeader: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
            pinnedSavedHeader
                .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
                .hidden()
                .accessibilityHidden(true)
            if showsProjectsSection { projectTilesSection }
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
    }

    private var pinnedSavedHeader: some View {
        CodeScreenTitleRow(title: screenTitle, minimumHeight: CodeScreenMetrics.mainHeaderHeight) {
            savedHeaderActions
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

    @ViewBuilder
    private var projectTilesSection: some View {
        if !projectFolders.isEmpty {
            folderGrid(projectFolders)
        } else {
            CodeEmptyStateCard(
                title: "Create your first Project",
                systemImage: "folder.badge.plus",
                description: "Use + to create a Project for your notes, evidence, and Research.",
                accent: accentColor
            )
        }
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
        let bookmarkAccent = bookmarkAccentColor(for: bookmark.codeSectionID)

        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(bookmark.sectionNumber)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)

                    if bookmark.hasNote {
                        Image(systemName: "note.text")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 16, height: 16)
                            .accessibilityLabel("Has note")
                    }

                }

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

                if bookmark.hasNote {
                    Text(bookmark.noteBody)
                        .font(.body)
                        .foregroundStyle(bookmarkAccent.opacity(0.88))
                        .multilineTextAlignment(.leading)
                        .padding(.top, 4)
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

enum ProjectOverviewSection: Hashable {
    case context, structuredFacts, questions, checklist, notebook, evidence, reports
}

private struct ProjectFactDraft: Identifiable {
    let id: String
    var label: String
    var value: String
    let original: ProjectStructuredFact?
}

private struct ProjectInlineContextEditor: UIViewRepresentable {
    @Binding var text: String
    let requestsFocus: Bool
    let onCancel: () -> Void
    let onSave: () -> Void

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.backgroundColor = .clear
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        view.textColor = .label
        view.tintColor = UIColor(Color.appChrome)
        view.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 12, right: 0)
        view.textContainer.lineFragmentPadding = 0
        view.isScrollEnabled = false
        view.isEditable = false
        view.text = text
        view.selectedRange = NSRange(location: 0, length: 0)
        view.delegate = context.coordinator
        let toolbar = UIToolbar()
        toolbar.sizeToFit()
        toolbar.autoresizingMask = .flexibleWidth
        let cancel = UIBarButtonItem(title: "Cancel", style: .plain,
                                     target: context.coordinator, action: #selector(Coordinator.cancel))
        cancel.accessibilityIdentifier = "project-inline-keyboard-cancel"
        let save = UIBarButtonItem(title: "Save", style: .done,
                                   target: context.coordinator, action: #selector(Coordinator.save))
        save.accessibilityIdentifier = "project-inline-keyboard-save"
        toolbar.items = [cancel, UIBarButtonItem(systemItem: .flexibleSpace), save]
        view.inputAccessoryView = toolbar
        view.accessibilityIdentifier = "project-context-editor"
        view.accessibilityLabel = "Project context"
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        view.font = .preferredFont(forTextStyle: .body)
        if view.text != text {
            let selection = view.selectedRange
            view.text = text
            let length = (text as NSString).length
            view.selectedRange = NSRange(location: min(selection.location, length), length: 0)
        }
        view.isEditable = requestsFocus
        if requestsFocus && !context.coordinator.didRequestFocus {
            context.coordinator.didRequestFocus = true
            // The first insertion point stays at the beginning of the expanded
            // text, so keyboard avoidance does not take the page to its end.
            view.selectedRange = NSRange(location: 0, length: 0)
            view.becomeFirstResponder()
        } else if !requestsFocus && view.isFirstResponder {
            view.resignFirstResponder()
        }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0 else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: max(180, fitted.height))
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ProjectInlineContextEditor
        var didRequestFocus = false

        init(parent: ProjectInlineContextEditor) { self.parent = parent }

        @objc func cancel() { parent.onCancel() }
        @objc func save() { parent.onSave() }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
        }
    }
}

struct ProjectView: View {
    let folderID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var sortMode: BookmarkSortMode = .codeOrder
    @State private var removedProjectSections: [BookmarkedSection] = []
    @State private var removalSessionID: UUID?
    @State private var removalFolderID: Int64?
    @State private var undoFailed = false
    @State private var isSelecting = false
    @State private var selectedBookmarkRowIDs: Set<String> = []
    @State private var folderEditorTarget: ProjectFolderEditorTarget?
    @State private var pendingExport: BookmarkExportRequest?
    @State private var projectHubSnapshot: ProjectHubSnapshot?
    @State private var isProjectHubLoading = false
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
    @State private var inlineEditingSection: ProjectOverviewSection?
    @State private var inlineEditingFolder: CodeFolder?
    @State private var inlineEditingSessionID: UUID?
    @State private var contextDraft = ""
    @State private var factsDraft: [ProjectFactDraft] = []
    @State private var inlineSaveError: String?
    @State private var isContextEditorFocused = false

    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let automaticProjectHubRefreshInterval: TimeInterval = 30

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
                bookmark.noteBody,
                bookmark.chapterTitle,
                bookmark.codeSectionName
            ].contains { $0.lowercased().contains(query) }
        }
    }

    private var projectEvidenceGroups: [ProjectEvidenceCodeGroup] {
        ProjectEvidenceOrganizer.codeGroups(visibleProjectBookmarks)
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
                detail: "per codes Research",
                conversationID: answer.conversationID
            )
        }
        return evidence + research
    }

    var body: some View {
        Group {
            if isProjectFolder {
                GeometryReader { geometry in
                    ScrollViewReader { scroll in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 20) {
                                projectHeader
                                projectContextOverview
                                    .id(ProjectOverviewSection.context)
                                if inlineEditingSection == .structuredFacts {
                                    projectFactsOverview
                                        .id(ProjectOverviewSection.structuredFacts)
                                }
                                projectSectionCards
                            }
                            .frame(minHeight: max(0, geometry.size.height - CodeScreenMetrics.topTitlePadding - 16),
                                   alignment: .top)
                            .padding(.horizontal, contentHorizontalInset)
                            .padding(.top, CodeScreenMetrics.topTitlePadding)
                            .padding(.bottom, 16)
                        }
                        .scrollBounceBehavior(.basedOnSize)
                        .scrollDismissesKeyboard(.interactively)
                        .task(id: inlineEditingSection) {
                            guard let section = inlineEditingSection else { return }
                            withAnimation(inlineExpansionAnimation) {
                                scroll.scrollTo(section, anchor: .top)
                            }
                            guard section == .context else { return }
                            do {
                                try await Task.sleep(nanoseconds: reduceMotion ? 100_000_000 : 650_000_000)
                            } catch { return }
                            guard !Task.isCancelled, inlineEditingSection == .context else { return }
                            isContextEditorFocused = true
                        }
                    }
                }
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
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit project", systemImage: "pencil") {
                        if let folder { folderEditorTarget = .edit(folder) }
                    }
                    .labelStyle(.iconOnly)
                    .tint(Color.appChrome)
                    .accessibilityIdentifier("project-edit")
                    .disabled(inlineEditingSection != nil)
                }
                if inlineEditingSection == .structuredFacts {
                    ToolbarItemGroup(placement: .keyboard) {
                        Button("Cancel", action: finishInlineEditing)
                            .accessibilityIdentifier("project-inline-keyboard-cancel")
                        Spacer()
                        Button("Save", action: saveInlineEditing).fontWeight(.semibold)
                            .accessibilityIdentifier("project-inline-keyboard-save")
                    }
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
        .sheet(item: $pendingExport) { request in
            BookmarkExportPreviewSheet(request: request) {
                pendingExport = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    library.startBookmarkExport(bookmarks: request.bookmarks, contextLabel: request.contextLabel)
                }
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
        .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        .onChange(of: library.privateSessionID) { _, _ in
            finishInlineEditing()
            contextDraft = ""
            factsDraft = []
            removedProjectSections = []
            projectReportPreviewURL = nil
            projectHubSnapshot = nil
            projectHubError = nil
            lastProjectHubLoadAt = nil
        }
        .onChange(of: folderID) { _, _ in
            finishInlineEditing()
            contextDraft = ""
            factsDraft = []
            removedProjectSections = []
            projectHubSnapshot = nil
            projectHubError = nil
            lastProjectHubLoadAt = nil
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
            if selectedBookmarkRowIDs.isEmpty {
                isSelecting = false
            }
        }
        .onChange(of: visibleProjectBookmarks) { _, visibleBookmarks in
            selectedBookmarkRowIDs = selectedBookmarkRowIDs.intersection(Set(visibleBookmarks.map(\.rowID)))
            if selectedBookmarkRowIDs.isEmpty {
                isSelecting = false
            }
        }
        .onChange(of: folder?.id) { _, newFolderID in
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
        projectBookmarks.filter { selectedBookmarkRowIDs.contains($0.rowID) }
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
            if reports.isEmpty {
                projectHubEmpty("No immutable Project Reports have been generated yet.")
            } else {
                ForEach(reports) { report in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("REPORT V\(report.reportVersion)")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(accentColor)
                            Spacer(minLength: 8)
                            Text(projectHubDate(report.createdAt))
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
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(accentColor.opacity(0.08))
                    )
                }
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
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
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
        guard !isProjectHubLoading else { return }
        lastProjectHubLoadAt = Date()
        isProjectHubLoading = true
        defer { isProjectHubLoading = false }
        do {
#if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--native-project-overview-fixture"),
               ProcessInfo.processInfo.arguments.contains("--native-project-overview-delayed-load") {
                try await Task.sleep(nanoseconds: 2_000_000_000)
            }
#endif
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

    @MainActor
    private func refreshProjectHubAfterForegroundingIfNeeded() async {
        let now = Date()
        if let lastProjectHubLoadAt,
           now.timeIntervalSince(lastProjectHubLoadAt) < automaticProjectHubRefreshInterval {
            return
        }
        await loadProjectHub()
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

    private var projectContextOverview: some View {
        VStack(alignment: .leading, spacing: 10) {
            if inlineEditingSection == .context {
                inlineEditorHeader("Context")
                ProjectInlineContextEditor(text: $contextDraft, requestsFocus: isContextEditorFocused,
                                           onCancel: finishInlineEditing, onSave: saveInlineEditing)
                    .frame(maxWidth: .infinity)
                    .transition(.opacity)
                inlineEditorError
            } else {
                Button { beginInlineEditing(.context) } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Context").font(.headline).foregroundStyle(.primary)
                        let description = folder?.description.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                        Text(description.isEmpty ? "No context yet." : description)
                            .font(.body).foregroundStyle(.secondary)
                            .lineLimit(dynamicTypeSize.isAccessibilitySize ? 5 : 3)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("project-overview-context")
                        Text(description.isEmpty ? "Add context" : "Read more")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(inlineEditingSection != nil)
                .accessibilityIdentifier("project-section-context")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 20)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.primary.opacity(0.15)).frame(height: 0.5)
        }
    }

    private var overviewFacts: [ProjectStructuredFact] {
        Array((folder?.structuredFacts ?? []).filter {
            !$0.value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            $0.status.lowercased() != "rejected"
        }.prefix(4))
    }

    private var projectFactsOverview: some View {
        VStack(alignment: .leading, spacing: 12) {
            if inlineEditingSection == .structuredFacts {
                inlineEditorHeader("Facts")
                ForEach($factsDraft) { $draft in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text("\((factsDraft.firstIndex { $0.id == draft.id } ?? 0) + 1).")
                                .monospacedDigit()
                                .accessibilityIdentifier("project-fact-number-\(draft.id)")
                            if draft.original == nil {
                                TextField("Fact name", text: $draft.label)
                                    .accessibilityIdentifier("project-fact-label-\(draft.id)")
                            } else {
                                Text(draft.label)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        HStack(alignment: .center, spacing: 12) {
                            TextField("Value", text: $draft.value, axis: .vertical)
                                .font(.subheadline)
                                .lineLimit(1...4)
                                .textFieldStyle(.plain)
                                .frame(minHeight: 44)
                                .accessibilityLabel(draft.label.isEmpty ? "Fact value" : draft.label)
                                .accessibilityIdentifier("project-fact-value-\(draft.id)")
                            Button(role: .destructive) {
                                withAnimation(inlineExpansionAnimation) {
                                    factsDraft.removeAll { $0.id == draft.id }
                                }
                            } label: {
                                Image(systemName: "minus.circle").frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Remove \(draft.label.isEmpty ? "fact" : draft.label)")
                        }
                    }
                    .transition(.opacity)
                }
                factsEditorFooter
                inlineEditorError
            } else {
                Button { beginInlineEditing(.structuredFacts) } label: {
                    HStack {
                        Text("Facts").font(.headline).foregroundStyle(.primary)
                        Spacer(minLength: 12)
                        Text(overviewFacts.isEmpty ? "Add facts" : "See all")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(inlineEditingSection != nil)
                .accessibilityIdentifier("project-section-structured-facts")
                if overviewFacts.isEmpty {
                    Text("No facts yet.").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .topLeading),
                                             count: dynamicTypeSize.isAccessibilitySize ? 1 : 2),
                              alignment: .leading, spacing: 14) {
                        ForEach(overviewFacts) { fact in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(fact.label).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                                Text(fact.value).font(.subheadline.weight(.medium)).foregroundStyle(.primary).lineLimit(2)
                                if !["sourced", "confirmed"].contains(fact.status.lowercased()) {
                                    Text(fact.status.lowercased() == "stated" ? "Stated" : "Unknown")
                                        .font(.caption2).foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .accessibilityIdentifier("project-overview-facts")
                }
            }
        }
        .padding(.bottom, 4)
    }

    private func inlineEditorHeader(_ title: String) -> some View {
        HStack {
            Text(title).font(.headline)
                .accessibilityIdentifier("project-inline-editor-title")
            Spacer(minLength: 12)
            Button("Cancel", action: finishInlineEditing)
                .accessibilityIdentifier("project-inline-cancel")
            Button("Save", action: saveInlineEditing)
                .fontWeight(.semibold)
                .accessibilityIdentifier("project-inline-save")
        }
        .font(.subheadline)
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }

    private var inlineExpansionAnimation: Animation? {
        reduceMotion ? nil : .easeInOut(duration: 0.55)
    }

    private var addFactButton: some View {
        Button {
            withAnimation(inlineExpansionAnimation) {
                factsDraft.append(ProjectFactDraft(id: UUID().uuidString, label: "", value: "", original: nil))
            }
        } label: { Label("Add fact", systemImage: "plus") }
        .frame(minHeight: 44)
        .accessibilityIdentifier("project-fact-add")
    }

    private var factsEditorFooter: some View {
        VStack(alignment: .leading, spacing: 8) {
            if dynamicTypeSize.isAccessibilitySize {
                addFactButton
                HStack { Spacer(); factsBottomSaveControls }
            } else {
                HStack(spacing: 16) { addFactButton; Spacer(); factsBottomSaveControls }
            }
        }
        .font(.subheadline)
        .buttonStyle(.plain)
    }

    private var factsBottomSaveControls: some View {
        HStack(spacing: 16) {
            Button("Cancel", action: finishInlineEditing)
                .frame(minHeight: 44)
                .accessibilityIdentifier("project-inline-bottom-cancel")
            Button("Save", action: saveInlineEditing)
                .fontWeight(.semibold)
                .frame(minHeight: 44)
                .accessibilityIdentifier("project-inline-bottom-save")
        }
    }

    @ViewBuilder
    private var inlineEditorError: some View {
        if let inlineSaveError {
            Text(inlineSaveError).font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func beginInlineEditing(_ section: ProjectOverviewSection) {
        guard inlineEditingSection == nil, let folder, library.requireProjectAccess() else { return }
        inlineEditingFolder = folder
        inlineEditingSessionID = library.privateSessionID
        inlineSaveError = nil
        contextDraft = folder.description
        factsDraft = folder.structuredFacts.map {
            ProjectFactDraft(id: $0.id, label: $0.label, value: $0.value, original: $0)
        }
        withAnimation(inlineExpansionAnimation) { inlineEditingSection = section }
    }

    private func saveInlineEditing() {
        guard let original = inlineEditingFolder, let session = inlineEditingSessionID else { return }
        let saved: Bool
        if inlineEditingSection == .context {
            saved = library.updateProjectContext(folderID: folderID, description: contextDraft,
                expectedClientID: original.clientID, expectedDescription: original.description, sessionID: session)
        } else if inlineEditingSection == .structuredFacts {
            var facts: [ProjectStructuredFact] = []
            for draft in factsDraft {
                let label = draft.label.trimmingCharacters(in: .whitespacesAndNewlines)
                let value = draft.value.trimmingCharacters(in: .whitespacesAndNewlines)
                if draft.original == nil && label.isEmpty && value.isEmpty { continue }
                guard !label.isEmpty else {
                    inlineSaveError = "Give each fact a name."
                    return
                }
                if let fact = draft.original, label == fact.label, value == fact.value {
                    facts.append(fact)
                } else {
                    facts.append(ProjectStructuredFact(id: draft.id, key: draft.original?.key ?? "manual-\(draft.id)",
                        label: label, value: value, status: value.isEmpty ? "unknown" : "stated", source: "manual",
                        sourceText: draft.original == nil ? "Entered on iPhone." : "Edited on iPhone.", updatedAt: Date()))
                }
            }
            saved = library.updateProjectFacts(folderID: folderID, facts: facts,
                expectedClientID: original.clientID, expectedFacts: original.structuredFacts, sessionID: session)
        } else {
            return
        }
        if saved { finishInlineEditing() }
        else { inlineSaveError = library.statusMessage ?? "Your changes could not be saved. Try again." }
    }

    private func finishInlineEditing() {
        isContextEditorFocused = false
        withAnimation(inlineExpansionAnimation) { inlineEditingSection = nil }
        inlineEditingFolder = nil
        inlineEditingSessionID = nil
        inlineSaveError = nil
    }

    private var latestProjectNote: ProjectNotebookCardSummary? {
        projectHubSnapshot?.notebookCards.max { $0.updatedAt < $1.updatedAt }
    }

    private var latestProjectReport: ProjectReportSummary? {
        projectHubSnapshot?.reports.max { $0.createdAt < $1.createdAt }
    }

    private var projectSectionCards: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), alignment: .topLeading),
                                 count: dynamicTypeSize.isAccessibilitySize ? 1 : 2), spacing: 12) {
            Button { beginInlineEditing(.structuredFacts) } label: {
                let facts = folder?.structuredFacts ?? []
                projectSectionCard("Facts", systemImage: "building.2",
                    count: "\(facts.count) \(facts.count == 1 ? "fact" : "facts")",
                    preview: facts.first.map { "\($0.label): \($0.value)" } ?? "No facts yet.")
            }
            .disabled(inlineEditingSection != nil)
            .accessibilityIdentifier("project-section-structured-facts")

            NavigationLink(value: ProjectOverviewSection.questions) {
                let questions = folder?.openQuestions ?? []
                projectSectionCard("Questions", systemImage: "questionmark.bubble",
                    count: folder?.openQuestions.map { "\($0.count) \($0.count == 1 ? "question" : "questions")" },
                    preview: questions.first(where: { !$0.question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?.question
                        ?? (folder?.openQuestions == nil ? "" : "No questions yet."))
            }
            .accessibilityIdentifier("project-section-questions")

            NavigationLink(value: ProjectOverviewSection.checklist) {
                let records = folder?.recordsChecklist ?? []
                projectSectionCard("Checklist", systemImage: "checklist",
                    count: folder?.recordsChecklist.map { "\($0.filter { $0.status == .reviewed }.count)/\($0.count) reviewed" },
                    preview: records.first(where: { $0.status != .reviewed && $0.status != .notApplicable })?.label
                        ?? (folder?.recordsChecklist == nil ? "" : records.isEmpty ? "No records yet." : "All records reviewed or not applicable."))
            }
            .accessibilityIdentifier("project-section-checklist")

            NavigationLink(value: ProjectOverviewSection.notebook) {
                projectSectionCard("Notes", systemImage: "note.text",
                    count: projectHubSnapshot.map { "\($0.notebookCards.count) \($0.notebookCards.count == 1 ? "note" : "notes")" },
                    preview: latestProjectNote.map { $0.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled note" : $0.title }
                        ?? (projectHubSnapshot == nil ? "Open Notebook" : "No notes yet."))
            }
            .accessibilityIdentifier("project-section-notebook")

            NavigationLink(value: ProjectOverviewSection.evidence) {
                projectSectionCard("Evidence", systemImage: "bookmark",
                    count: "\(library.bookmarkCount(inFolder: folderID)) saved",
                    preview: projectBookmarks.first.map { "\($0.sectionNumber) · \($0.displayTitle)" }
                        ?? "No saved evidence yet.")
            }
            .accessibilityIdentifier("project-section-evidence")

            NavigationLink(value: ProjectOverviewSection.reports) {
                projectSectionCard("Reports", systemImage: "doc.richtext",
                    count: projectHubSnapshot.map { "\($0.reports.count) \($0.reports.count == 1 ? "report" : "reports")" },
                    preview: latestProjectReport.map { "\($0.title) · V\($0.reportVersion)" }
                        ?? (projectHubSnapshot == nil ? "Open Reports" : "No reports yet."))
            }
            .accessibilityIdentifier("project-section-reports")
        }
        .buttonStyle(.plain)
        .tint(Color.appChrome)
    }

    @ViewBuilder
    private func projectSectionDestination(_ section: ProjectOverviewSection) -> some View {
        switch section {
        case .questions, .checklist:
            ProjectWorkflowView(folderID: folderID, section: section)
        case .context:
            ProjectContextView(folderID: folderID, accentColor: accentColor)
        case .structuredFacts:
            projectSectionScreen(title: "Structured Facts") {
                let facts = folder?.structuredFacts ?? []
                if facts.isEmpty {
                    projectHubEmpty("No Structured facts yet.")
                } else {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(facts) { fact in
                            ProjectStructuredFactRow(fact: fact)
                            if fact.id != facts.last?.id { Divider() }
                        }
                        ProjectStructuredFactsSources(facts: facts)
                            .padding(.top, 16)
                    }
                }
            }
        case .notebook:
            if let projectID = library.backendProjectID(for: folderID) {
                projectNotebookDestination(projectID: projectID)
            } else {
                projectSectionScreen(title: "Notebook") {
                    projectHubEmpty("Connect to sync this Project’s Notebook.")
                }
            }
        case .evidence:
            projectEvidenceDestination
        case .reports:
            projectSectionScreen(title: "Reports") {
                projectHubStatus
                if projectHubSnapshot != nil || (!isProjectHubLoading && projectHubError == nil) {
                    projectReportSummary
                    if !projectCodeQuestions.isEmpty { projectCodeQuestionSummary }
                }
            }
            .refreshable { await loadProjectHub() }
        }
    }

    private func projectSectionCard(_ title: String, systemImage: String,
                                    count: String?, preview: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.body.weight(.medium))
                    .accessibilityHidden(true)
                Text(title).font(.headline)
            }
            Spacer(minLength: 8)
            Text(preview)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
            if let count { Text(count).font(.caption).foregroundStyle(.secondary) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(.primary)
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 140, alignment: .topLeading)
        .background(projectTileBackgroundColor(for: folder?.colorHex ?? CodeFolder.defaultColorHex),
                    in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var projectEvidenceDestination: some View {
        projectSectionScreen(title: isProjectFolder ? "Evidence" : folder?.name ?? "Reference") {
            if !isProjectFolder { projectHeader }
            savedEvidenceHeader
            if projectBookmarks.isEmpty {
                projectHubEmpty("No Saved Evidence yet.")
            } else if visibleProjectBookmarks.isEmpty {
                ContentUnavailableView("No matching evidence", systemImage: "bookmark.slash",
                    description: Text("Change the search to see saved evidence."))
            } else {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(projectEvidenceGroups) { group in projectEvidenceGroup(group) }
                }
            }
        }
        .searchable(text: $evidenceSearchQuery, isPresented: $isEvidenceSearchPresented,
                    prompt: "Search saved evidence")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) { sortMenu; exportButton }
        }
        .safeAreaInset(edge: .bottom) { projectEvidenceUndo }
        .refreshable { library.refreshBookmarks() }
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
            .padding(.horizontal)
            .background(.regularMaterial)
        }
    }

    private func projectSectionScreen<Content: View>(
        title: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12, content: content)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
    }

    private var sortMenu: some View {
        Menu {
            ForEach(BookmarkSortMode.allCases) { mode in
                Button {
                    sortMode = mode
                } label: {
                    Label(mode.label, systemImage: mode.systemImage)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort project")
    }

    private var exportButton: some View {
        Menu {
            projectExportMenuContent
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel("Export project")
    }

    private var savedEvidenceSelectionButton: some View {
        Button {
            toggleSelectionMode()
        } label: {
            Image(systemName: isSelecting ? "checkmark.circle.fill" : "checklist")
                .font(.body.weight(.semibold))
                .foregroundStyle(accentColor)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel(isSelecting ? "Finish selecting" : "Select sections")
    }

    private var savedEvidenceHeader: some View {
        HStack(spacing: 4) {
            Spacer(minLength: 12)
            Button {
                isEvidenceSearchPresented = true
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(accentColor)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Search saved evidence")

            savedEvidenceSelectionButton
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    private var projectExportMenuContent: some View {
        if isSelecting && !selectedBookmarkRowIDs.isEmpty {
            Button("Export selected (\(selectedBookmarkRowIDs.count))") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: selectedBookmarks,
                    contextLabel: folder?.name,
                    scopeLabel: "Selected in \(folder?.name ?? "Project")"
                )
            }
            Button("Remove selected from project", role: .destructive) {
                removeProjectEvidence(selectedBookmarks)
                selectedBookmarkRowIDs.removeAll()
                isSelecting = false
            }
        }

        Button("Export project (\(projectBookmarks.count))") {
            pendingExport = BookmarkExportRequest(
                bookmarks: projectBookmarks,
                contextLabel: folder?.name,
                scopeLabel: folder?.name ?? "Project"
            )
        }
    }

    private func removeProjectEvidence(_ sections: [BookmarkedSection]) {
        if removalSessionID != library.privateSessionID || removalFolderID != folderID { removedProjectSections = [] }
        removalSessionID = library.privateSessionID
        removalFolderID = folderID
        let removed = library.removeSections(sections, fromFolder: folderID)
        let existing = Set(removedProjectSections.map(\.rowID))
        removedProjectSections.append(contentsOf: removed.filter { !existing.contains($0.rowID) })
        undoFailed = false
    }

    private func toggleSelectionMode() {
        withAnimation(.easeInOut(duration: 0.18)) {
            isSelecting.toggle()
            if !isSelecting {
                selectedBookmarkRowIDs.removeAll()
            }
        }
    }

    private func projectBookmarkRow(_ bookmark: BookmarkedSection) -> some View {
        let bookmarkAccent = bookmark.codeSectionName.isEmpty
            ? Color(uiColor: library.accentColor(for: bookmark.codeSectionID))
            : Color(uiColor: CodeSectionThemeProfile(codeSectionName: bookmark.codeSectionName).accentColor)
        let isSelected = selectedBookmarkRowIDs.contains(bookmark.rowID)

        return HStack(alignment: .top, spacing: 12) {
            if isSelecting {
                Button {
                    toggleSelection(bookmark.rowID)
                } label: {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(isSelected ? accentColor : Color.secondary.opacity(0.6))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isSelected ? "Deselect section" : "Select section")
            }

            NavigationLink {
                ReaderView(
                    sectionID: bookmark.id,
                    codeVersion: bookmark.codeVersion,
                    codeSectionID: bookmark.codeSectionID,
                    returnsToProjectsAfterRemoval: true
                )
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(bookmark.sectionNumber)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)

                        if bookmark.hasNote {
                            Image(systemName: "note.text")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }

                    }

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

                    if bookmark.hasNote {
                        Text(bookmark.noteBody)
                            .font(.body)
                            .foregroundStyle(bookmarkAccent.opacity(0.88))
                            .multilineTextAlignment(.leading)
                            .padding(.top, 4)
                    }

                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("project-bookmark-\(bookmark.rowID)")
            .disabled(isSelecting)
        }
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelecting {
                toggleSelection(bookmark.rowID)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                removeProjectEvidence([bookmark])
            } label: {
                Label("Remove from project", systemImage: "minus.circle")
            }
        }
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
