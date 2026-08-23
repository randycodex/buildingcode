import Foundation
import AuthenticationServices
import ClerkKit
import CryptoKit
import Network
import os
import os.signpost
import Security
import StoreKit
import SwiftUI

extension Notification.Name {
    static let permitextSavedWorkDidChange = Notification.Name("permitext.savedWorkDidChange")
}

enum PermitextReleaseSurfaceVisibility {
    static let firmCollaboration = false
    static let coordination = false
}

func permitextUpgradeCallToActionTitle(
    isStoreKitTestProActive: Bool,
    currentPlan: AppPlan,
    proProductDisplayPrice: String?,
    isStoreKitBusy: Bool
) -> String {
    if isStoreKitTestProActive { return "Pro (Test) Active" }
    if currentPlan == .pro { return "Pro Active" }
    if isStoreKitBusy { return "Starting Apple purchase..." }
    if let displayPrice = proProductDisplayPrice?.trimmingCharacters(in: .whitespacesAndNewlines),
       !displayPrice.isEmpty {
        return "Upgrade to Pro - \(displayPrice)/month"
    }
    return "Upgrade to Pro"
}

func permitextProfessionalWorkspaceRequirementMessage() -> String {
    "Upgrade to Pro to unlock unlimited saved work and notes, Projects, professional exports, and offline access."
}

enum ProjectHubLoadError: LocalizedError {
    case projectUnavailable
    case signInRequired

    var errorDescription: String? {
        switch self {
        case .projectUnavailable:
            return "This Project is no longer available."
        case .signInRequired:
            return "Sign in from Settings to load the synced Notebook and Research history."
        }
    }
}

enum SectionDetailLoadResult {
    case loaded(ReaderSectionDetail)
    case missing
    case failed(String)
}

enum NoteSaveResult: Equatable {
    case saved
    case failed(persistedBody: String, message: String)
}

@MainActor
final class CodeLibraryViewModel: ObservableObject {
    private enum PostClerkAuthenticationAction: Equatable {
        case none
        case purchasePro
        case restorePurchases
    }

    private struct AuthoredContentSnapshot: Sendable {
        let store: AuthoredCodeStore
        let codeSections: [CodeSectionCategory]
        let resolvedCodeSectionID: Int64?
        let chapters: [CodeChapter]
    }

    private struct SQLiteContentSnapshot: Sendable {
        let database: CodeDatabase
        let loader: SQLiteChapterLoader
        let chapters: [CodeChapter]
    }

    struct ChapterBlockDescriptor: Identifiable, Sendable {
        let sectionID: Int64
        let groupLabel: String?

        var id: Int64 { sectionID }
    }

    struct ChapterReaderBlockSummary: Identifiable, Hashable {
        let id: Int64
        let sectionNumber: String
        let title: String
        let displayTitle: String
        let kind: CodeSectionKind
        let groupLabel: String?
    }

    @Published private(set) var availableVersions: [BundledCodeVersion] = []
    @Published private(set) var availableJurisdictions: [BundledJurisdiction] = []
    @Published private(set) var codeSections: [CodeSectionCategory] = []
    @Published private(set) var chapters: [CodeChapter] = []
    @Published private(set) var searchResults: [CodeSearchResult] = []
    @Published private(set) var isSearchInProgress = false
    @Published private(set) var recentSearches: [String] = []
    @Published private(set) var pinnedSearches: [String] = []
    @Published private(set) var recentlyViewedSections: [RecentlyViewedEntry] = []
    @Published private(set) var searchTabRetapCount = 0
    @Published private(set) var bookmarks: [BookmarkedSection] = []
    @Published private(set) var projectBookmarksByFolderID: [Int64: [BookmarkedSection]] = [:]
    @Published private(set) var projectEvidenceRecordCountByFolderID: [Int64: Int] = [:]
    @Published private(set) var exportState: BookmarkExportState = .idle
    @Published private(set) var folders: [CodeFolder] = []
    @Published private(set) var activeProjectID: Int64?
    @Published private(set) var currentPlan: AppPlan
    @Published private(set) var currentEntitlementSource: EntitlementSource
    @Published private(set) var currentCapabilityContract: PermitextCapabilityContract? = nil
    @Published private(set) var entitlementPrompt: EntitlementRequirement?
    @Published private(set) var signedInAccount: SignedInAccount?
    @Published private(set) var isAccountBusy = false
    @Published private(set) var accountAuthenticationMessage: String?
    @Published var isClerkAuthenticationPresented = false
    @Published var isProSubscriptionStorePresented = false
    @Published private(set) var organizations: [PermitextOrganization] = []
    @Published private(set) var isOrganizationWorkspaceLoading = false
    @Published private(set) var pendingOrganizationInvitationToken: String?
    @Published private(set) var pendingUserContentSyncCount = 0
    @Published private(set) var userContentSyncConflicts: [UserContentSyncConflict] = []
    @Published private(set) var proProductDisplayPrice: String?
    @Published private(set) var researchProductDisplayPrice: String?
    @Published private(set) var isStoreKitResearchActive = false
    @Published private(set) var storeKitLoadedProductIDs: [String] = []
    @Published private(set) var storeKitDebugSummary: String = "not checked"
    @Published private(set) var storeKitTransactionEnvironment: String?
    @Published private(set) var isStoreKitBusy = false
    @Published private(set) var isStoreKitRestoreInProgress = false
    @Published private(set) var storeKitOperationMessage: String?
    /// sectionID → ordered list of folderIDs containing that section. Cached
    /// up front so the Reader and Saved screens don't make per-section DB
    /// round trips when rendering the Projects row.
    @Published private(set) var folderMembership: [Int64: [Int64]] = [:]
    @Published var selectedVersionFileName: String = ""
    @Published var selectedJurisdictionKey: String = ""
    @Published var selectedCodeSectionID: Int64?
    @Published var statusMessage: String?
    @Published var readerTheme: ReaderTheme
    @Published private(set) var isInitialContentLoaded: Bool = false {
        didSet {
            guard isInitialContentLoaded, !oldValue, !hasRecordedFirstUsableContent else {
                return
            }
            hasRecordedFirstUsableContent = true
            let elapsedMilliseconds = max(
                0,
                Int((ProcessInfo.processInfo.systemUptime - startupBeganAt) * 1_000)
            )
            startupFirstUsableDurationMilliseconds = elapsedMilliseconds
            os_signpost(
                .end,
                log: AppSignpost.startup,
                name: "firstUsableContent",
                signpostID: startupSignpostID,
                "milliseconds=%{public}d",
                elapsedMilliseconds
            )
            os_log(
                .info,
                log: AppSignpost.startup,
                "firstUsableContent milliseconds=%{public}d",
                elapsedMilliseconds
            )
        }
    }
    @Published private(set) var initialLoadProgress: Double = 0
    @Published private(set) var startupFirstUsableDurationMilliseconds: Int?
    @Published var selectedTab: AppTab = .browse
    @Published var browserTabSwitchRequest: BrowserContextID?
    @Published var activeResearchConversationID: String?
    @Published private(set) var pendingResearchSelections: [ResearchSelectionRequest] = []
    @Published private(set) var pendingDeepLinkedSectionID: Int64? = nil

    private let locator: BundleDatabaseLocator
    private let formattingEngine: FormattingEngine
    private let referenceResolver = CodeReferenceResolver()
    private var userContentRepository: UserContentRepository?
    private var syncEngine: UserContentSyncEngine
    private let userContentSyncBackend: UserContentSyncBackend
    private let accountUserDataProfiles: AccountUserDataProfileStore?
    private let continuityStore: ContinuityStore
    private let readerThemeStore: ReaderThemeStore
    private let preferencesDefaults: UserDefaults
    private let entitlementService: EntitlementService
    private let lifetimeGrantLookupClient: LifetimeGrantLookupClient
    private let accountBackendClient: AccountBackendClient
    private let ownsAccountSync: Bool
    private let projectHubOfflineCache = ProjectHubOfflineCache()
    private let storeKitSubscriptionService = StoreKitSubscriptionService()
    private let startupBeganAt = ProcessInfo.processInfo.systemUptime
    private let startupSignpostID = OSSignpostID(log: AppSignpost.startup)
    private var postClerkAuthenticationAction: PostClerkAuthenticationAction = .none
    private var clerkAuthenticationAttemptID: UUID?
    private var accountMutationGeneration: UInt64 = 0
    private var hasRecordedFirstUsableContent = false
    private let recentSearchesDefaultsKey = "recentSearches"
    private let pinnedSearchesDefaultsKey = "pinnedSearches"
    private let recentlyViewedSectionsDefaultsKey = "recentlyViewedSections"
    private var codeDatabase: CodeDatabase?
    private var sqliteChapterLoader: SQLiteChapterLoader?
    private var authoredCodeStore: AuthoredCodeStore?
    private let projectPresentationBuilder = ProjectPresentationBuilder()
    private let projectPresentationSnapshotBuilder = ProjectPresentationSnapshotBuilder()
    private let selectedVersionDefaultsKey = "selectedCodeVersionFileName"
    private let selectedJurisdictionDefaultsKey = "selectedJurisdictionKey"
    private let selectedCodeSectionDefaultsKey = "selectedCodeSectionID"
    private let lastOpenedChapterIDDefaultsKey = "lastOpenedChapterID"
    private var lastChapterPreloadTask: Task<Void, Never>?
    private var codeSectionWarmupTask: Task<Void, Never>?
    private var chapterWarmupTasks: [Int64: Task<Void, Never>] = [:]
    private var warmedChapterIDs: Set<Int64> = []
    private var sectionsCache: [Int64: [CodeSectionSummary]] = [:]
    private var sectionGroupsCache: [Int64: [CodeSectionGroup]] = [:]
    private let sectionDetailCache: NSCache<NSNumber, CachedReaderSectionDetail> = {
        let cache = NSCache<NSNumber, CachedReaderSectionDetail>()
        cache.countLimit = 192
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()
    private let formattedNSTextCache: NSCache<NSString, NSAttributedString> = {
        let cache = NSCache<NSString, NSAttributedString>()
        cache.countLimit = 192
        cache.totalCostLimit = 16 * 1024 * 1024
        return cache
    }()
    private let chapterBodyNSTextCache: NSCache<NSString, NSAttributedString> = {
        let cache = NSCache<NSString, NSAttributedString>()
        cache.countLimit = 192
        cache.totalCostLimit = 16 * 1024 * 1024
        return cache
    }()
    private var bookmarkedSectionIDs: Set<Int64> = []
    private var versionLoadTask: Task<Void, Never>?
    private var contentLoadTask: Task<Void, Never>?
    private var startupWarmupTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?
    // Tracks the active inner search task so it can be cancelled independently
    // when a new search starts. Without this, Task.detached bodies accumulate
    // concurrently because cancelling the outer Task does not propagate to a
    // detached child.
    private var activeSearchWorkTask: Task<[CodeSearchResult], Never>?
    private var activeExportTask: Task<Void, Never>?
    private var userContentAutoSyncTask: Task<Void, Never>?
    private var savedPresentationRefreshTask: Task<Void, Never>?
    private var projectPresentationRefreshTask: Task<Void, Never>?
    private var projectPresentationRefreshGeneration: UInt64 = 0
    private var foregroundAutomaticSyncTask: Task<Void, Never>?
    private var storeKitUpdatesTask: Task<Void, Never>?
    private let networkMonitor = NWPathMonitor()
    private let networkMonitorQueue = DispatchQueue(label: "com.permitext.foreground-sync-network")
    private var isNetworkAvailable = false
    private var didRunStartupAccountSync = false
    private var lastForegroundAccountSyncAt: Date?
    private var accountAuthorizedStoreKitPlan: AppPlan = .free
    private var activeStoreKitResearch = false
    private var hasActiveBackendProEntitlement = false
    private let foregroundAccountSyncInterval: TimeInterval = 30
    private let automaticSyncRetryDelays: [TimeInterval] = [5, 10, 20, 40, 80]
    @Published private(set) var bookmarkRevision: Int = 0
    @Published private(set) var userContentSyncCheckpoint: UserContentSyncCheckpoint?

#if DEBUG
    var ownsAccountSyncForTesting: Bool { ownsAccountSync }
#endif

    init(
        locator: BundleDatabaseLocator = BundleDatabaseLocator(),
        formattingEngine: FormattingEngine = FormattingEngine(),
        userContentRepository: UserContentRepository? = nil,
        continuityStore: ContinuityStore = .shared,
        readerThemeStore: ReaderThemeStore = ReaderThemeStore(),
        preferencesDefaults: UserDefaults = .standard,
        entitlementService: EntitlementService = LocalEntitlementService(),
        lifetimeGrantLookupClient: LifetimeGrantLookupClient = LocalLifetimeGrantLookupClient(),
        accountBackendClient: AccountBackendClient = PermitextBackendFactory.makeClient(),
        syncBackend: UserContentSyncBackend? = nil,
        loadsInitialContent: Bool = true,
        loadsPersistedAccount: Bool = true,
        initialSignedInAccount: SignedInAccount? = nil,
        ownsAccountSync: Bool = true
    ) {
        let loadedSignedInAccount = initialSignedInAccount
            ?? (loadsPersistedAccount ? Self.loadSignedInAccount() : nil)
        if let storedLifetimeUserID = preferencesDefaults.string(
            forKey: LocalEntitlementService.lifetimeGrantUserIDDefaultsKey
        ), loadedSignedInAccount == nil
            || (storedLifetimeUserID != loadedSignedInAccount?.appUserID
                && storedLifetimeUserID != loadedSignedInAccount?.appleUserID) {
            // Migrate away device-global lifetime state left by older builds.
            // A grant is re-applied only after the matching account is
            // authenticated and the backend confirms it.
            LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
        }
        let resolvedSyncBackend = syncBackend
            ?? (accountBackendClient as? UserContentSyncBackend)
            ?? NoOpUserContentSyncBackend()
        let resolvedProfiles: AccountUserDataProfileStore?
        let resolvedRepository: UserContentRepository?
        if let userContentRepository {
            resolvedProfiles = nil
            resolvedRepository = userContentRepository
        } else if let profiles = try? AccountUserDataProfileStore(defaults: preferencesDefaults),
                  let databaseURL = try? profiles.databaseURL(accountID: loadedSignedInAccount?.appUserID) {
            resolvedProfiles = profiles
            resolvedRepository = try? UserDataStore(databaseURL: databaseURL)
        } else {
            resolvedProfiles = nil
            resolvedRepository = try? UserDataStore()
        }

        self.locator = locator
        self.formattingEngine = formattingEngine
        self.userContentRepository = resolvedRepository
        self.userContentSyncBackend = resolvedSyncBackend
        self.accountUserDataProfiles = resolvedProfiles
        self.syncEngine = UserContentSyncEngine(
            repository: resolvedRepository,
            backend: resolvedSyncBackend,
            continuityStore: continuityStore
        )
        self.continuityStore = continuityStore
        self.readerThemeStore = readerThemeStore
        self.preferencesDefaults = preferencesDefaults
        self.entitlementService = entitlementService
        self.lifetimeGrantLookupClient = lifetimeGrantLookupClient
        self.accountBackendClient = accountBackendClient
        self.ownsAccountSync = ownsAccountSync
        self.currentPlan = entitlementService.currentPlan
        self.currentEntitlementSource = entitlementService.currentEntitlement.source
        self.signedInAccount = loadedSignedInAccount
        self.userContentSyncCheckpoint = syncEngine.checkpoint(account: loadedSignedInAccount)
        if resolvedProfiles != nil, let loadedSignedInAccount {
            // A profile may be new even when this account already has a saved
            // server checkpoint from the legacy shared database. Start with a
            // full pull so the isolated profile is never left falsely empty.
            self.syncEngine.resetCheckpoint(account: loadedSignedInAccount)
            self.userContentSyncCheckpoint = self.syncEngine.checkpoint(account: loadedSignedInAccount)
        }
        self.readerTheme = readerThemeStore.load()
        self.recentSearches = Self.loadRecentSearches(defaults: preferencesDefaults)
        self.pinnedSearches = Self.loadPinnedSearches(defaults: preferencesDefaults)
        let continuityContext = continuityStore.load()
        self.recentlyViewedSections = continuityContext.recentlyViewedSections
        self.activeProjectID = continuityContext.activeProjectID
        os_signpost(
            .begin,
            log: AppSignpost.startup,
            name: "firstUsableContent",
            signpostID: startupSignpostID
        )
        prepareCanonicalCodeVersionMigration(for: loadedSignedInAccount)
        refreshPendingUserContentSyncCount()
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let becameAvailable = !self.isNetworkAvailable && path.status == .satisfied
                self.isNetworkAvailable = path.status == .satisfied
                if becameAvailable,
                   self.isInitialContentLoaded,
                   self.signedInAccount != nil,
                   !self.isAccountBusy {
                    await self.performAutomaticUserContentSync()
                }
            }
        }
        if ownsAccountSync {
            networkMonitor.start(queue: networkMonitorQueue)
        }
        statusMessage = "Loading code library..."
        isInitialContentLoaded = false
        initialLoadProgress = 0
        #if DEBUG
        runStartupDiagnostics()
        #endif
        if loadsInitialContent {
            reload()
        }
    }

    deinit {
        userContentAutoSyncTask?.cancel()
        savedPresentationRefreshTask?.cancel()
        projectPresentationRefreshTask?.cancel()
        foregroundAutomaticSyncTask?.cancel()
        storeKitUpdatesTask?.cancel()
        startupWarmupTask?.cancel()
        networkMonitor.cancel()
    }

    #if DEBUG
    static func preview() -> CodeLibraryViewModel {
        let model = CodeLibraryViewModel(loadsInitialContent: false)
        let version = BundledCodeVersion(
            fileName: "preview-authored-content",
            fileURL: URL(fileURLWithPath: "/dev/null"),
            codeVersion: "2022 Construction Codes",
            contentKind: .authored,
            authoredCodeID: 1,
            jurisdictionID: 1,
            jurisdictionName: "New York City",
            authoredHTMLBundlePath: nil
        )
        let buildingSectionID: Int64 = 1
        let plumbingSectionID: Int64 = 2

        model.availableVersions = [version]
        model.availableJurisdictions = [
            BundledJurisdiction(id: "new-york-city", jurisdictionID: 1, name: "New York City")
        ]
        model.codeSections = [
            CodeSectionCategory(id: buildingSectionID, codeID: 1, name: "Building Code"),
            CodeSectionCategory(id: plumbingSectionID, codeID: 1, name: "Plumbing Code")
        ]
        model.chapters = [
            CodeChapter(id: 101, codeSectionID: buildingSectionID, chapterNumber: "1", title: "Administration"),
            CodeChapter(id: 102, codeSectionID: buildingSectionID, chapterNumber: "3", title: "Occupancy Classification and Use"),
            CodeChapter(id: 103, codeSectionID: buildingSectionID, chapterNumber: "5", title: "General Building Heights and Areas"),
            CodeChapter(id: 201, codeSectionID: plumbingSectionID, chapterNumber: "1", title: "Administration"),
            CodeChapter(id: 202, codeSectionID: plumbingSectionID, chapterNumber: "6", title: "Water Supply and Distribution")
        ]
        model.selectedVersionFileName = version.fileName
        model.selectedJurisdictionKey = "new-york-city"
        model.selectedCodeSectionID = buildingSectionID
        model.statusMessage = nil
        model.initialLoadProgress = 1
        model.isInitialContentLoaded = true
        return model
    }
    #endif

    var selectedVersion: BundledCodeVersion? {
        filteredVersions.first { $0.fileName == selectedVersionFileName }
            ?? availableVersions.first { $0.fileName == selectedVersionFileName }
    }

    var isZoningResolutionSelected: Bool {
        guard let codeVersion = selectedVersion?.codeVersion else { return false }
        return UserContentSyncCodeVersion.server(codeVersion) == UserContentSyncCodeVersion.canonicalNYCZoning
    }

    var filteredVersions: [BundledCodeVersion] {
        guard !selectedJurisdictionKey.isEmpty else { return availableVersions }
        return availableVersions.filter { version in
            jurisdictionKey(for: version) == selectedJurisdictionKey
        }
    }

    func chapters(for codeSectionID: Int64?) -> [CodeChapter] {
        if let authoredCodeStore {
            return authoredCodeStore.chapters(codeSectionID: codeSectionID)
        }

        guard let codeSectionID else { return chapters }
        return chapters.filter { $0.codeSectionID == codeSectionID }
    }

    func reload() {
        versionLoadTask?.cancel()
        contentLoadTask?.cancel()
        statusMessage = "Loading code library..."
        isInitialContentLoaded = false
        initialLoadProgress = 0

        versionLoadTask = Task {
            let availableVersions = await Task.detached(priority: .userInitiated) {
                BundleDatabaseLocator().availableCodeVersions()
            }.value

            guard !Task.isCancelled else { return }

            self.availableVersions = availableVersions
            self.availableJurisdictions = self.buildJurisdictions(from: availableVersions)
            let continuityContext = self.continuityStore.load()
            let storedSelection = continuityContext.selectedVersionFileName.isEmpty ? nil : continuityContext.selectedVersionFileName
            let storedJurisdiction = continuityContext.selectedJurisdictionKey.isEmpty ? nil : continuityContext.selectedJurisdictionKey
            let authoredSelection = availableVersions.first(where: { $0.contentKind == .authored })?.fileName
            let defaultJurisdictionKey = storedJurisdiction
                .flatMap { stored in
                    self.availableJurisdictions.first(where: { $0.id == stored })?.id
                }
                ?? self.availableJurisdictions.first?.id
                ?? ""
            self.selectedJurisdictionKey = defaultJurisdictionKey

            let candidateVersions = self.filteredVersions.isEmpty ? availableVersions : self.filteredVersions
            let authoredResolvedSelection: String?
            if let authoredSelection {
                authoredResolvedSelection = candidateVersions.first(where: { $0.fileName == authoredSelection })?.fileName
            } else {
                authoredResolvedSelection = nil
            }

            let storedResolvedSelection: String?
            if let storedSelection {
                storedResolvedSelection = candidateVersions.first(where: { $0.fileName == storedSelection })?.fileName
            } else {
                storedResolvedSelection = nil
            }

            let resolvedSelection = storedResolvedSelection
                ?? authoredResolvedSelection
                ?? candidateVersions.first?.fileName
                ?? availableVersions.first?.fileName
                ?? ""

            self.selectedVersionFileName = resolvedSelection
            self.persistContinuityContext()
            self.openSelectedContent()
        }
    }

    func updateSelectedJurisdiction(key: String) {
        selectedJurisdictionKey = key
        let candidateVersions = filteredVersions
        if candidateVersions.contains(where: { $0.fileName == selectedVersionFileName }) == false {
            selectedVersionFileName = candidateVersions.first?.fileName ?? ""
        }
        persistContinuityContext()
        openSelectedContent()
    }

    func updateSelectedVersion(fileName: String) {
        selectedVersionFileName = fileName
        persistContinuityContext()
        openSelectedContent()
    }

    func prepareCodeVersionForEvidence(_ codeVersion: String) async -> Bool {
        let canonicalVersion = UserContentSyncCodeVersion.server(codeVersion)
        guard let version = availableVersions.first(where: {
            UserContentSyncCodeVersion.server($0.codeVersion) == canonicalVersion
        }) else {
            statusMessage = "The code book for this saved evidence is not installed."
            return false
        }

        if selectedVersionFileName != version.fileName {
            updateSelectedVersion(fileName: version.fileName)
        }
        await contentLoadTask?.value
        return UserContentSyncCodeVersion.server(selectedVersion?.codeVersion ?? "") == canonicalVersion &&
            isInitialContentLoaded
    }

    // MARK: - Idle preload of last-opened chapter

    func noteChapterOpened(chapter: CodeChapter) {
        persistContinuityContext(lastOpenedChapterID: chapter.id)
        // The chapter is already being opened, so a pending idle preload is stale.
        lastChapterPreloadTask?.cancel()
    }

    func noteSectionOpened(_ detail: ReaderSectionDetail) {
        recordRecentlyViewed(
            RecentlyViewedEntry(
                sectionID: detail.id,
                sectionNumber: detail.sectionNumber,
                title: detail.displayTitle,
                chapterTitle: detail.chapterTitle,
                codeSectionID: detail.codeSectionID,
                codeSectionName: codeSectionName(id: detail.codeSectionID),
                previewText: sectionPreviewSnippet(from: detail.officialText),
                viewedAt: Date()
            )
        )
    }

    func noteSectionOpened(anchor: PublishedHTMLAnchor, chapter: CodeChapter) {
        guard let summary = sectionSummary(sectionNumber: anchor.sectionNumber, codeSectionID: chapter.codeSectionID) else { return }
        let lightweightPreview = anchor.title.isEmpty ? anchor.displayLabel : anchor.title
        recordRecentlyViewed(
            RecentlyViewedEntry(
                sectionID: summary.id,
                sectionNumber: summary.sectionNumber,
                title: summary.displayTitle,
                chapterTitle: chapter.title,
                codeSectionID: chapter.codeSectionID,
                codeSectionName: codeSectionName(id: chapter.codeSectionID),
                previewText: sectionPreviewSnippet(from: lightweightPreview),
                viewedAt: Date()
            )
        )
    }

    func noteProjectOpened(_ folderID: Int64) {
        guard activeProjectID != folderID else { return }
        activeProjectID = folderID
        persistContinuityContext()
    }

    func clearActiveProject(ifMatches folderID: Int64? = nil) {
        if let folderID, activeProjectID != folderID {
            return
        }
        guard activeProjectID != nil else { return }
        activeProjectID = nil
        persistContinuityContext()
    }

    func sectionPreviewSnippet(from officialText: String) -> String {
        let normalized = officialText
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return "" }

        let limit = 120
        if normalized.count <= limit {
            return normalized
        }
        let end = normalized.index(normalized.startIndex, offsetBy: limit)
        return String(normalized[..<end]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    private func recordRecentlyViewed(_ entry: RecentlyViewedEntry) {
        var updated = recentlyViewedSections.filter { $0.sectionID != entry.sectionID }
        updated.insert(entry, at: 0)
        recentlyViewedSections = Array(updated.prefix(20))
        persistRecentlyViewedSections()
    }

    private func persistRecentlyViewedSections() {
        persistContinuityContext()
    }

    private func persistContinuityContext(lastOpenedChapterID: Int64? = nil) {
        continuityStore.update { context in
            context.selectedJurisdictionKey = selectedJurisdictionKey
            context.selectedVersionFileName = selectedVersionFileName
            context.selectedCodeSectionID = selectedCodeSectionID
            if let lastOpenedChapterID {
                context.lastOpenedChapterID = lastOpenedChapterID
            }
            context.activeProjectID = activeProjectID
            // Kept in the continuity payload for compatibility with older app
            // versions. Current clients always expose both reader contexts.
            context.comparisonModeEnabled = true
            context.recentlyViewedSections = recentlyViewedSections
        }
        queueContinuityContextForSync()
    }

    private func queueContinuityContextForSync() {
        let context = continuityStore.load()
        do {
            try userContentRepository?.queueContinuityContext(
                codeVersion: context.selectedVersionFileName,
                values: continuitySyncValues(from: context)
            )
            scheduleUserContentAutoSync()
        } catch {
            #if DEBUG
            print("permitext diagnostics: continuity sync queue failed: \(error.localizedDescription)")
            #endif
        }
    }

    private func continuitySyncValues(from context: ContinuityContext) -> [String: String] {
        var values: [String: String] = [
            "selectedJurisdictionKey": context.selectedJurisdictionKey,
            "selectedVersionFileName": context.selectedVersionFileName,
            "comparisonModeEnabled": context.comparisonModeEnabled ? "true" : "false"
        ]
        if let selectedCodeSectionID = context.selectedCodeSectionID {
            values["selectedCodeSectionID"] = String(selectedCodeSectionID)
        }
        if let lastOpenedChapterID = context.lastOpenedChapterID {
            values["lastOpenedChapterID"] = String(lastOpenedChapterID)
        }
        if let activeProjectID = context.activeProjectID {
            values["activeProjectID"] = String(activeProjectID)
        }
        if let data = try? JSONEncoder().encode(context.recentlyViewedSections),
           let json = String(data: data, encoding: .utf8) {
            values["recentlyViewedSectionsJSON"] = json
        }
        if let data = try? JSONEncoder().encode(recentSearches),
           let json = String(data: data, encoding: .utf8) {
            values["recentSearchesJSON"] = json
        }
        return values
    }

    private func refreshContinuityStateFromStore() {
        let context = continuityStore.load()
        recentlyViewedSections = context.recentlyViewedSections
        recentSearches = Self.loadRecentSearches(defaults: preferencesDefaults)
    }

    #if DEBUG
    private func runStartupDiagnostics() {
        var messages = continuityStore.debugValidationMessages()
        let validDeepLink = URL(string: "https://permitext-sync.vercel.app/open/section/8881")
            .flatMap(Self.deepLinkedSectionID(from:))
        let invalidDeepLink = URL(string: "https://example.com/open/section/8881")
            .flatMap(Self.deepLinkedSectionID(from:))
        if validDeepLink != 8881 || invalidDeepLink != nil {
            messages.append("Shared section link parsing failed")
        }
        let citation = Self.officialSectionCitation(
            codeName: "Building Code",
            sectionNumber: "101.2",
            title: "Scope."
        )
        if citation != "New York City Building Code § 101.2 (2022) — Scope." {
            messages.append("Official section citation formatting failed")
        }
        let diagnosticUserID = "apple:sync-diagnostic"
        let legacyProjectID = "\(diagnosticUserID):project:2022 CONSTRUCTION CODES:2"
        let repeatedProjectID = "\(diagnosticUserID):project:2022 CONSTRUCTION CODES:\(diagnosticUserID):project:2022 CONSTRUCTION CODES:\(legacyProjectID)"
        if UserContentSyncCodeVersion.server("2022 CONSTRUCTION CODES") != UserContentSyncCodeVersion.canonicalNYC2022 ||
            UserContentSyncCodeVersion.local(UserContentSyncCodeVersion.canonicalNYC2022) != "2022 CONSTRUCTION CODES" {
            messages.append("Cross-device code-version normalization failed")
        }
        if UserContentSyncCodeVersion.server("NYC Zoning Resolution") != UserContentSyncCodeVersion.canonicalNYCZoning ||
            UserContentSyncCodeVersion.local(UserContentSyncCodeVersion.canonicalNYCZoning) !=
                UserContentSyncCodeVersion.localNYCZoning {
            messages.append("Cross-device Zoning Resolution normalization failed")
        }
        if UserContentProjectIdentity.stable(repeatedProjectID, userID: diagnosticUserID) != legacyProjectID {
            messages.append("Cross-device project identity normalization failed")
        }
        if let userDataStore = userContentRepository as? UserDataStore {
            do {
                messages.append(contentsOf: try userDataStore.debugSchemaValidationMessages())
                messages.append(contentsOf: try userDataStore.debugSyncQueueLifecycleValidationMessages())
            } catch {
                messages.append("UserDataStore schema validation failed: \(error.localizedDescription)")
            }
        }
        do {
            let report = try syncEngine.previewPendingWork(limit: 25)
            if report.pendingCount > 0 {
                messages.append("Sync queue pending items: \(report.pendingCount) via \(report.backendName)")
            }
        } catch {
            messages.append("Sync queue preview failed: \(error.localizedDescription)")
        }

        if messages.isEmpty {
            print("permitext diagnostics: startup validation passed")
        } else {
            print("permitext diagnostics: " + messages.joined(separator: " | "))
        }
    }
    #endif

    private static func loadRecentlyViewedSections() -> [RecentlyViewedEntry] {
        ContinuityStore.shared.load().recentlyViewedSections
    }

    private func preloadLastOpenedChapterIfNeeded() {
        let storedID = continuityStore.load().lastOpenedChapterID
        guard let chapterID = storedID else { return }
        guard let chapter = chapters.first(where: { $0.id == chapterID }) else { return }

        lastChapterPreloadTask?.cancel()
        lastChapterPreloadTask = Task { [weak self] in
            // Small delay so this does not compete with the first interaction.
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled, let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 8)
        }
    }

    func prewarmCodeSectionForBrowsing(id codeSectionID: Int64?) {
        let targetChapters = chapters(for: codeSectionID)
        guard !targetChapters.isEmpty else { return }

        codeSectionWarmupTask?.cancel()
        codeSectionWarmupTask = Task { [weak self] in
            guard let self else { return }
            for chapter in targetChapters.prefix(4) {
                if Task.isCancelled { return }
                await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 6)
                await Task.yield()
            }
        }
    }

    func prewarmChapterForBrowsing(_ chapter: CodeChapter) {
        guard warmedChapterIDs.contains(chapter.id) == false,
              chapterWarmupTasks[chapter.id] == nil
        else {
            return
        }

        chapterWarmupTasks[chapter.id] = Task { [weak self] in
            guard let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 6)
            guard !Task.isCancelled else { return }
            self.warmedChapterIDs.insert(chapter.id)
            self.chapterWarmupTasks[chapter.id] = nil
        }
    }

    func prewarmChapterForOpening(_ chapter: CodeChapter) {
        guard warmedChapterIDs.contains(chapter.id) == false else { return }

        chapterWarmupTasks[chapter.id]?.cancel()
        chapterWarmupTasks[chapter.id] = Task { [weak self] in
            guard let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 10)
            guard !Task.isCancelled else { return }
            self.warmedChapterIDs.insert(chapter.id)
            self.chapterWarmupTasks[chapter.id] = nil
        }
    }

    func updateSelectedCodeSection(id: Int64?) {
        selectedCodeSectionID = id
        persistContinuityContext()
        guard let authoredCodeStore else { return }
        codeSections = Self.sortedCodeSections(authoredCodeStore.codeSections())
        chapters = authoredCodeStore.chapters(codeSectionID: id)
        searchResults = []
        prewarmCodeSectionForBrowsing(id: id)
    }

    func requestBrowserTabSwitch(to context: BrowserContextID) {
        browserTabSwitchRequest = context
    }

    func syncSelectedCodeSection(from context: BrowserContextID) {
        let codeSectionID: Int64?
        if let stored = BrowserContextID.storedCodeSectionID(for: context) {
            codeSectionID = stored
        } else if context == .primary {
            codeSectionID = selectedCodeSectionID
        } else {
            // First time the secondary reader appears, default it to a
            // different code section than primary,
            // so the two browsers immediately show distinct content. Falls
            // back to the primary selection if only one section exists.
            codeSectionID = defaultSecondaryCodeSectionID()
            BrowserContextID.persistCodeSectionID(codeSectionID, for: .secondary)
        }
        updateSelectedCodeSection(id: codeSectionID)
    }

    /// Picks a code section for the secondary browser that's different from
    /// the primary when possible. Honors the canonical sort order so the
    /// "next" section is predictable (e.g. primary on Building → secondary
    /// on Fuel Gas).
    private func defaultSecondaryCodeSectionID() -> Int64? {
        let ordered = Self.sortedCodeSections(codeSections)
        guard !ordered.isEmpty else { return nil }
        guard let primaryID = selectedCodeSectionID,
              let primaryIndex = ordered.firstIndex(where: { $0.id == primaryID })
        else {
            return ordered.first?.id
        }
        let nextIndex = (primaryIndex + 1) % ordered.count
        return ordered[nextIndex].id
    }

    func codeSectionName(id: Int64?) -> String {
        guard let id,
              let codeSection = codeSections.first(where: { $0.id == id })
        else {
            return "All Sections"
        }
        return Self.displayName(forCodeSectionName: codeSection.name)
    }

    static func displayName(forCodeSectionName name: String) -> String {
        displayName(forLibraryName: name)
    }

    /// Canonical display order for code sections everywhere they appear in a
    /// list. Names not in this table fall back to alphabetical order at the
    /// end. Matching is case-insensitive and tolerates "Code"/"Codes" suffixes
    /// or jurisdiction prefixes (e.g. "NYC Building Code").
    nonisolated private static let codeSectionOrderKeywords: [String] = [
        "general administrative",
        "building",
        "fuel gas",
        "mechanical",
        "plumbing",
        "energy",
        "electrical",
        "fire",
        "housing maintenance",
        "administrative code title",
        "local laws"
    ]

    nonisolated static func codeSectionOrderRank(forName name: String) -> Int {
        let lowered = name.lowercased()
        for (index, keyword) in codeSectionOrderKeywords.enumerated() {
            if lowered.contains(keyword) { return index }
        }
        return Int.max
    }

    nonisolated static func sortedCodeSections(_ sections: [CodeSectionCategory]) -> [CodeSectionCategory] {
        sections.sorted { lhs, rhs in
            let lhsRank = codeSectionOrderRank(forName: lhs.name)
            let rhsRank = codeSectionOrderRank(forName: rhs.name)
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }

    static func displayName(forLibraryName name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return name }
        if trimmed == trimmed.uppercased() {
            return trimmed.localizedCapitalized
        }
        return trimmed
    }

    func accentColor(for codeSectionID: Int64? = nil) -> PlatformColor {
        let resolvedSectionID = codeSectionID ?? selectedCodeSectionID
        let codeSectionName = codeSections
            .first(where: { $0.id == resolvedSectionID })?
            .name
        return CodeSectionThemeProfile(codeSectionName: codeSectionName).accentColor
    }

    func accentHex(for codeSectionID: Int64? = nil, colorScheme: ColorScheme) -> String {
        let resolvedSectionID = codeSectionID ?? selectedCodeSectionID
        let codeSectionName = codeSections
            .first(where: { $0.id == resolvedSectionID })?
            .name
        return CodeSectionThemeProfile(codeSectionName: codeSectionName).accentHex(for: colorScheme)
    }

    func authoredHTMLStore(for chapter: CodeChapter) -> PublishedHTMLContentStore {
        PublishedHTMLContentStore(
            relativeRootPath: selectedVersion?.authoredHTMLBundlePath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
    }

    func sections(for chapter: CodeChapter) -> [CodeSectionSummary] {
        if let authoredCodeStore {
            return authoredCodeStore.sections(chapterID: chapter.id)
        }
        if let cached = sectionsCache[chapter.id] {
            return cached
        }
        do {
            let loadedSections = try codeDatabase?.sections(chapterID: chapter.id) ?? []
            sectionsCache[chapter.id] = loadedSections
            return loadedSections
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func sectionGroups(for chapter: CodeChapter) -> [CodeSectionGroup] {
        if let authoredCodeStore {
            let groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
            if !groups.isEmpty {
                return groups
            }
            if let htmlGroups = htmlSectionGroups(for: chapter) {
                sectionGroupsCache[chapter.id] = htmlGroups
                sectionsCache[chapter.id] = htmlGroups.flatMap(\.sections)
                return htmlGroups
            }
            return []
        }
        if let cached = sectionGroupsCache[chapter.id] {
            return cached
        }
        do {
            let loadedGroups = try codeDatabase?.sectionGroups(chapterID: chapter.id) ?? []
            sectionGroupsCache[chapter.id] = loadedGroups
            return loadedGroups
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func sectionCount(for chapter: CodeChapter) -> Int {
        sections(for: chapter).count
    }

    func firstSectionAsync(for chapter: CodeChapter) async -> CodeSectionSummary? {
        if let cached = firstSection(for: chapter) {
            return cached
        }

        if let authoredCodeStore {
            let authoredSections = authoredCodeStore.sections(chapterID: chapter.id)
            if let firstAuthoredSection = authoredSections.first {
                return firstAuthoredSection
            }
            if let htmlSection = firstHTMLSection(for: chapter) {
                sectionsCache[chapter.id] = [htmlSection]
                return htmlSection
            }
            return nil
        }

        if let cached = sectionsCache[chapter.id] {
            return cached.first
        }

        if let cachedGroups = sectionGroupsCache[chapter.id] {
            return cachedGroups.first?.sections.first
        }

        guard let sqliteChapterLoader else {
            return sections(for: chapter).first
        }

        do {
            let groups = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            sectionsCache[chapter.id] = groups.flatMap(\.sections)
            return groups.first?.sections.first
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func firstSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        if let cached = sectionsCache[chapter.id] {
            return cached.first
        }

        if let cachedGroups = sectionGroupsCache[chapter.id] {
            return cachedGroups.first?.sections.first
        }

        if let authoredCodeStore {
            let groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            sectionsCache[chapter.id] = groups.flatMap(\.sections)
            if let firstSection = sectionsCache[chapter.id]?.first {
                return firstSection
            }
            if let htmlSection = firstHTMLSection(for: chapter) {
                sectionsCache[chapter.id] = [htmlSection]
                return htmlSection
            }
        }

        return nil
    }

    private func htmlSectionGroups(for chapter: CodeChapter) -> [CodeSectionGroup]? {
        guard selectedVersion?.contentKind == .authored,
              let relativeRootPath = selectedVersion?.authoredHTMLBundlePath
        else {
            return nil
        }

        let htmlStore = PublishedHTMLContentStore(
            relativeRootPath: relativeRootPath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
        let anchors = htmlStore.anchors(chapterNumber: chapter.chapterNumber)
        guard !anchors.isEmpty else { return nil }

        let sectionAnchors = anchors.filter { $0.level >= 2 }
        guard !sectionAnchors.isEmpty else { return nil }

        let levelTwoAnchors = sectionAnchors.filter { $0.level == 2 }
        if levelTwoAnchors.isEmpty {
            return [
                CodeSectionGroup(
                    id: "html-\(chapter.chapterNumber)",
                    headerLine: chapter.displayLabel,
                    headingLine: chapter.title,
                    sections: sectionAnchors.map { anchor in
                        CodeSectionSummary(
                            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: anchor.sectionNumber),
                            chapterNumber: chapter.chapterNumber,
                            sectionNumber: anchor.sectionNumber,
                            title: anchor.title
                        )
                    }
                )
            ]
        }

        var groups: [CodeSectionGroup] = []
        for (index, groupAnchor) in levelTwoAnchors.enumerated() {
            let nextGroupAnchor = index < levelTwoAnchors.count - 1 ? levelTwoAnchors[index + 1] : nil
            let childAnchors = sectionAnchors.filter { anchor in
                guard anchor.level > groupAnchor.level else { return false }
                if anchor.sectionNumber.compare(groupAnchor.sectionNumber, options: [.numeric, .caseInsensitive]) != .orderedDescending {
                    return false
                }
                if let nextGroupAnchor {
                    return anchor.sectionNumber.compare(nextGroupAnchor.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
                return true
            }

            groups.append(
                CodeSectionGroup(
                    id: "html-\(chapter.chapterNumber)-\(groupAnchor.sectionNumber)",
                    headerLine: groupAnchor.title,
                    headingLine: nil,
                    sections: childAnchors.map { anchor in
                        CodeSectionSummary(
                            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: anchor.sectionNumber),
                            chapterNumber: chapter.chapterNumber,
                            sectionNumber: anchor.sectionNumber,
                            title: anchor.title
                        )
                    }
                )
            )
        }

        return groups.filter { !$0.sections.isEmpty }
    }

    private func firstHTMLSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        guard selectedVersion?.contentKind == .authored,
              let relativeRootPath = selectedVersion?.authoredHTMLBundlePath
        else {
            return nil
        }

        let htmlStore = PublishedHTMLContentStore(
            relativeRootPath: relativeRootPath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
        guard let chapterURL = htmlStore.chapterURL(chapterNumber: chapter.chapterNumber),
              let firstAnchor = PublishedHTMLContentStore.anchors(in: chapterURL).first
        else {
            return nil
        }

        return CodeSectionSummary(
            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: firstAnchor.sectionNumber),
            chapterNumber: chapter.chapterNumber,
            sectionNumber: firstAnchor.sectionNumber,
            title: firstAnchor.title
        )
    }

    private func authoredCodeSectionSlug(for chapter: CodeChapter) -> String? {
        guard let codeSectionID = chapter.codeSectionID,
              let codeSection = codeSections.first(where: { $0.id == codeSectionID })
        else {
            return nil
        }
        return Self.slug(codeSection.name)
    }

    func loadSectionDetail(sectionID: Int64) -> ReaderSectionDetail? {
        if let cached = cachedSectionDetail(for: sectionID) {
            return cached
        }
        if let authoredCodeStore {
            let detail = authoredCodeStore.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        }
        do {
            let detail = try codeDatabase?.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func chapterBodyNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        let cacheKey = Self.formattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache.object(forKey: cacheKey) {
            return cached
        }

        let attributed = formattedNSAttributedText(for: detail)
        let bodyRange = Self.chapterBodyRange(for: detail, in: attributed.string as NSString)
        let renderedText: NSAttributedString
        if bodyRange.length > 0 {
            renderedText = attributed.attributedSubstring(from: bodyRange)
        } else {
            renderedText = Self.fallbackChapterBodyText(for: detail, formattedText: attributed)
        }

        chapterBodyNSTextCache.setObject(renderedText, forKey: cacheKey, cost: Self.attributedTextMemoryCost(renderedText))
        return renderedText
    }

    func bodyNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        chapterBodyNSText(for: detail)
    }

    func renderPlainTextBlock(_ text: String) -> NSAttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = readerTheme.lineSpacing
        paragraphStyle.paragraphSpacing = readerTheme.paragraphSpacing

        return NSAttributedString(
            string: text,
            attributes: [
                .font: readerTheme.bodyFont,
                .foregroundColor: UIColor.label,
                .paragraphStyle: paragraphStyle
            ]
        )
    }

    func renderHTMLTextBlock(_ html: String, fallbackText: String) -> NSAttributedString {
        let rendered = Self.inlineHTMLTextBlock(
            html: html,
            fallbackText: fallbackText,
            theme: readerTheme
        )
        return rendered.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? renderPlainTextBlock(fallbackText)
            : rendered
    }

    func chapterBodyNSTextAsync(for detail: ReaderSectionDetail) async -> NSAttributedString {
        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(.begin, log: AppSignpost.reader, name: "bodyText", signpostID: signpostID)
        defer { os_signpost(.end, log: AppSignpost.reader, name: "bodyText", signpostID: signpostID) }

        let cacheKey = Self.formattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache.object(forKey: cacheKey) {
            return cached
        }

        let theme = readerTheme
        let renderedBody = await Task.detached(priority: .userInitiated) {
            Self.chapterBodyText(detail: detail, theme: theme)
        }.value
        let renderedText = NSAttributedString(renderedBody)
        chapterBodyNSTextCache.setObject(renderedText, forKey: cacheKey, cost: Self.attributedTextMemoryCost(renderedText))
        return renderedText
    }

    func updateReaderTheme(_ theme: ReaderTheme) {
        let theme = theme.normalized
        guard readerTheme != theme else { return }
        readerTheme = theme
        formattedNSTextCache.removeAllObjects()
        chapterBodyNSTextCache.removeAllObjects()
        readerThemeStore.save(theme)
    }

    /// Mirrors shared account/capability/theme state into a corpus-only Reader
    /// session without giving that session ownership of StoreKit or sync work.
    /// Transient Reader state remains independent.
    func synchronizeIndependentReaderSession(from sharedLibrary: CodeLibraryViewModel) {
        signedInAccount = sharedLibrary.signedInAccount
        currentPlan = sharedLibrary.currentPlan
        currentEntitlementSource = sharedLibrary.currentEntitlementSource
        currentCapabilityContract = sharedLibrary.currentCapabilityContract
        accountAuthorizedStoreKitPlan = sharedLibrary.accountAuthorizedStoreKitPlan
        activeStoreKitResearch = sharedLibrary.activeStoreKitResearch
        isStoreKitResearchActive = sharedLibrary.isStoreKitResearchActive
        hasActiveBackendProEntitlement = sharedLibrary.hasActiveBackendProEntitlement
        activeProjectID = sharedLibrary.activeProjectID
        updateReaderTheme(sharedLibrary.readerTheme)
    }

    /// Reconciles a mutation written by another Reader session. The main app
    /// model owns the single account-sync pipeline; corpus-only sessions only
    /// refresh their local presentation.
    func reconcileExternalSavedWorkChange(scheduleAccountSync: Bool) {
        refreshBookmarks()
        if scheduleAccountSync {
            scheduleUserContentAutoSync()
        }
    }

    func resolveReferences(for detail: ReaderSectionDetail) -> [ResolvedCodeReference] {
        if let authoredCodeStore {
            return referenceResolver.resolveReferences(in: detail.officialText, database: authoredCodeStore)
        }
        guard let codeDatabase else { return [] }
        return referenceResolver.resolveReferences(in: detail.officialText, database: codeDatabase)
    }

    func resolveReferencesAsync(for detail: ReaderSectionDetail) async -> [ResolvedCodeReference] {
        if let authoredCodeStore {
            return await Task.detached(priority: .utility) {
                CodeReferenceResolver().resolveReferences(in: detail.officialText, database: authoredCodeStore)
            }.value
        }
        guard let codeDatabase else { return [] }
        return await Task.detached(priority: .utility) {
            CodeReferenceResolver().resolveReferences(in: detail.officialText, database: codeDatabase)
        }.value
    }

    func chapterBlockSummaries(for chapter: CodeChapter) async -> [ChapterReaderBlockSummary] {
        let groups: [CodeSectionGroup]
        if let authoredCodeStore {
            groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
        } else if let cached = sectionGroupsCache[chapter.id] {
            groups = cached
        } else if let sqliteChapterLoader {
            do {
                let loaded = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
                sectionGroupsCache[chapter.id] = loaded
                groups = loaded
            } catch {
                statusMessage = error.localizedDescription
                return []
            }
        } else {
            groups = []
        }

        let codeSectionName = codeSectionName(id: chapter.codeSectionID)

        return groups.flatMap { group in
            group.sections.enumerated().map { index, section in
                ChapterReaderBlockSummary(
                    id: section.id,
                    sectionNumber: section.sectionNumber,
                    title: section.title,
                    displayTitle: section.displayTitle,
                    kind: section.kind,
                    groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                )
            }
        }
    }

    func chapterBlockDescriptors(for chapter: CodeChapter) async -> [ChapterBlockDescriptor] {
        let codeSectionName = codeSectionName(id: chapter.codeSectionID)

        if let authoredCodeStore {
            return authoredCodeStore.sectionGroups(chapterID: chapter.id).flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                    )
                }
            }
        }

        if let cached = sectionGroupsCache[chapter.id] {
            return cached.flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                    )
                }
            }
        }

        guard let sqliteChapterLoader else { return [] }

        do {
            let groups = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            return groups.flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                    )
                }
            }
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func loadSectionDetailResultAsync(sectionID: Int64) async -> SectionDetailLoadResult {
        if let cached = cachedSectionDetail(for: sectionID) {
            return .loaded(cached)
        }
        if let authoredCodeStore {
            // Move the synchronous JSON read off the MainActor so the
            // scroll/layout thread stays responsive while details warm.
            let detail = await Task.detached(priority: .userInitiated) {
                authoredCodeStore.sectionDetail(sectionID: sectionID)
            }.value
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
                return .loaded(detail)
            }
            return .missing
        }

        if let sqliteChapterLoader {
            do {
                let detail = try await sqliteChapterLoader.sectionDetail(sectionID: sectionID)
                if let detail {
                    storeSectionDetailInCache(detail, sectionID: sectionID)
                    return .loaded(detail)
                }
                return .missing
            } catch {
                statusMessage = error.localizedDescription
                return .failed(error.localizedDescription)
            }
        }

        guard let codeDatabase else { return .missing }
        do {
            let detail = try codeDatabase.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
                return .loaded(detail)
            }
            return .missing
        } catch {
            statusMessage = error.localizedDescription
            return .failed(error.localizedDescription)
        }
    }

    func loadSectionDetailAsync(sectionID: Int64) async -> ReaderSectionDetail? {
        switch await loadSectionDetailResultAsync(sectionID: sectionID) {
        case .loaded(let detail):
            return detail
        case .missing, .failed:
            return nil
        }
    }

    func sectionSummary(sectionNumber: String) -> CodeSectionSummary? {
        let normalized = sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))

        guard !normalized.isEmpty else { return nil }

        if let authoredCodeStore {
            return try? authoredCodeStore.sectionSummary(sectionNumber: normalized)
        }

        do {
            return try codeDatabase?.sectionSummary(sectionNumber: normalized)
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func sectionSummary(sectionNumber: String, codeSectionID: Int64?) -> CodeSectionSummary? {
        let normalized = sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))

        guard !normalized.isEmpty else { return nil }

        if let authoredCodeStore {
            return try? authoredCodeStore.sectionSummary(sectionNumber: normalized, codeSectionID: codeSectionID)
        }

        return sectionSummary(sectionNumber: normalized)
    }

    func recentEntry(for codeSectionID: Int64?) -> RecentlyViewedEntry? {
        guard let codeSectionID else { return recentlyViewedSections.first }
        return recentlyViewedSections.first { entry in
            entry.codeSectionID == codeSectionID
        }
    }

    func chapter(for entry: RecentlyViewedEntry) -> CodeChapter? {
        chapter(forSectionID: entry.sectionID)
    }

    func chapter(forSectionID sectionID: Int64) -> CodeChapter? {
        guard let detail = loadSectionDetail(sectionID: sectionID) else { return nil }
        return chapters(for: detail.codeSectionID).first { chapter in
            chapter.chapterNumber == detail.chapterNumber
        }
    }

    func loadSectionDetailsAsync(sectionIDs: [Int64]) async -> [ReaderSectionDetail] {
        guard !sectionIDs.isEmpty else { return [] }

        var orderedDetails: [Int64: ReaderSectionDetail] = [:]
        var missingIDs: [Int64] = []
        for sectionID in sectionIDs {
            if let cached = cachedSectionDetail(for: sectionID) {
                orderedDetails[sectionID] = cached
            } else {
                missingIDs.append(sectionID)
            }
        }

        if let authoredCodeStore, !missingIDs.isEmpty {
            // Pull all missing details in a single detached batch so we only pay
            // one MainActor hop per chapter open instead of N.
            let loaded = await Task.detached(priority: .userInitiated) { () -> [ReaderSectionDetail] in
                missingIDs.compactMap { authoredCodeStore.sectionDetail(sectionID: $0) }
            }.value
            for detail in loaded {
                storeSectionDetailInCache(detail, sectionID: detail.id)
                orderedDetails[detail.id] = detail
            }
            return sectionIDs.compactMap { orderedDetails[$0] }
        }

        if !missingIDs.isEmpty, let sqliteChapterLoader {
            do {
                let loadedDetails = try await sqliteChapterLoader.sectionDetails(sectionIDs: missingIDs)
                for detail in loadedDetails {
                    storeSectionDetailInCache(detail, sectionID: detail.id)
                    orderedDetails[detail.id] = detail
                }
            } catch {
                statusMessage = error.localizedDescription
            }
        }

        return sectionIDs.compactMap { orderedDetails[$0] ?? cachedSectionDetail(for: $0) }
    }

    func imageURL(fileName: String) -> URL? {
        codeDatabase?.imageURL(fileName: fileName)
    }

    func search(query: String, restrictToSelectedCodeSection: Bool = true) {
        // Cancel both the outer coordination task and the inner work task so
        // concurrent Task.detached bodies don't pile up and saturate the thread
        // pool when the user types quickly.
        searchTask?.cancel()
        activeSearchWorkTask?.cancel()
        activeSearchWorkTask = nil

        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            searchResults = []
            isSearchInProgress = false
            return
        }

        isSearchInProgress = true

        if let authoredCodeStore {
            let selectedCodeSectionID = restrictToSelectedCodeSection ? self.selectedCodeSectionID : nil
            let workTask = Task.detached(priority: .userInitiated) {
                authoredCodeStore.search(
                    query: trimmedQuery,
                    codeSectionID: selectedCodeSectionID,
                    includeSnippets: false
                )
            }
            activeSearchWorkTask = workTask
            searchTask = Task {
                let results = await workTask.value
                guard !Task.isCancelled, !workTask.isCancelled else { return }
                searchResults = results
                isSearchInProgress = false

                // Titles and section numbers are enough to make Search usable
                // immediately. Load passage previews for the first screen in
                // the background instead of blocking every cold search on up
                // to 200 individual prepared-section files.
                guard !results.isEmpty else {
                    activeSearchWorkTask = nil
                    return
                }
                let snippetTask = Task.detached(priority: .utility) {
                    authoredCodeStore.search(
                        query: trimmedQuery,
                        codeSectionID: selectedCodeSectionID,
                        includeSnippets: true,
                        resultLimit: 25
                    )
                }
                activeSearchWorkTask = snippetTask
                let enrichedResults = await snippetTask.value
                guard !Task.isCancelled, !snippetTask.isCancelled else { return }
                let enrichedByID = Dictionary(
                    enrichedResults.map { ($0.id, $0) },
                    uniquingKeysWith: { first, _ in first }
                )
                searchResults = results.map { enrichedByID[$0.id] ?? $0 }
                activeSearchWorkTask = nil
            }
            return
        }

        guard let databaseURL = selectedVersion?.fileURL else {
            searchResults = []
            isSearchInProgress = false
            return
        }

        let workTask: Task<[CodeSearchResult], Never> = Task.detached(priority: .userInitiated) {
            do {
                let database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())
                return (try? database.search(query: trimmedQuery)) ?? []
            } catch {
                return []
            }
        }
        activeSearchWorkTask = workTask
        searchTask = Task {
            let results = await workTask.value
            guard !Task.isCancelled, !workTask.isCancelled else { return }
            searchResults = results
            isSearchInProgress = false
        }
    }

    func notifySearchTabRetap() {
        // Wrap on overflow — this is a sentinel counter, only the change
        // matters, not the absolute value.
        searchTabRetapCount &+= 1
    }

    func handleOpenURL(_ url: URL) {
        if let invitationToken = Self.organizationInvitationToken(from: url) {
            guard PermitextReleaseSurfaceVisibility.firmCollaboration else { return }
            pendingOrganizationInvitationToken = invitationToken
            selectedTab = .research
            return
        }
        guard let sectionID = Self.deepLinkedSectionID(from: url) else { return }
        selectVersionForDeepLinkedSection(sectionID)
        pendingDeepLinkedSectionID = sectionID
        selectedTab = .search
    }

    func openResearchCitation(sectionID: Int64, codeVersion: String?) {
        if let codeVersion {
            let canonicalVersion = UserContentSyncCodeVersion.server(codeVersion)
            if let version = availableVersions.first(where: {
                UserContentSyncCodeVersion.server($0.codeVersion) == canonicalVersion
            }) {
                if version.fileName != selectedVersionFileName {
                    updateSelectedVersion(fileName: version.fileName)
                }
            } else {
                selectVersionForDeepLinkedSection(sectionID)
            }
        } else {
            selectVersionForDeepLinkedSection(sectionID)
        }
        pendingDeepLinkedSectionID = sectionID
        selectedTab = .search
    }

    private func selectVersionForDeepLinkedSection(_ sectionID: Int64) {
        guard let version = Self.codeVersion(containingDeepLinkedSectionID: sectionID, in: availableVersions),
              version.fileName != selectedVersionFileName else {
            return
        }
        updateSelectedVersion(fileName: version.fileName)
    }

    /// Resolves a deep link from the IDs actually published in each bundled
    /// code version. Section IDs are source IDs, not a version namespace; do
    /// not infer a code book from their numeric range.
    static func codeVersion(
        containingDeepLinkedSectionID sectionID: Int64,
        in versions: [BundledCodeVersion]
    ) -> BundledCodeVersion? {
        versions.first { version in
            switch version.contentKind {
            case .authored:
                guard let authoredCodeID = version.authoredCodeID,
                      let jurisdictionID = version.jurisdictionID,
                      let store = try? AuthoredCodeStore(
                        jsonURL: version.fileURL,
                        codeID: authoredCodeID,
                        jurisdictionID: jurisdictionID
                      )
                else {
                    return false
                }
                return store.sectionDetail(sectionID: sectionID) != nil

            case .sqlite:
                guard let database = try? CodeDatabase(
                    databaseURL: version.fileURL,
                    locator: BundleDatabaseLocator()
                ) else {
                    return false
                }
                return (try? database.sectionDetail(sectionID: sectionID)) != nil
            }
        }
    }

    func consumePendingDeepLinkedSectionID() -> Int64? {
        defer { pendingDeepLinkedSectionID = nil }
        return pendingDeepLinkedSectionID
    }

    static func deepLinkedSectionID(from url: URL) -> Int64? {
        guard url.scheme?.lowercased() == "https",
              isAcceptedWebHost(url.host) else {
            return nil
        }
        let components = url.pathComponents.filter { $0 != "/" }
        guard components.count == 3,
              components[0] == "open",
              components[1] == "section",
              let sectionID = Int64(components[2]),
              sectionID > 0 else {
            return nil
        }
        return sectionID
    }

    static func organizationInvitationToken(from url: URL) -> String? {
        guard url.scheme?.lowercased() == "https",
              isAcceptedWebHost(url.host),
              url.path == "/" || url.path.isEmpty,
              let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first(where: { $0.name == "organizationInvite" })?
                .value?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty else {
            return nil
        }
        return token
    }

    static func sharedSectionURL(sectionID: Int64) -> URL {
        URL(string: "https://permitext.com/open/section/\(sectionID)")!
    }

    private static func isAcceptedWebHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        return host == "permitext.com" || host == "permitext-sync.vercel.app"
    }

    static func officialSectionCitation(
        codeName: String,
        sectionNumber: String,
        title: String
    ) -> String {
        let normalizedCodeName = codeName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedSectionNumber = sectionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let reference = [
            "New York City \(normalizedCodeName.isEmpty ? "Code" : normalizedCodeName)",
            normalizedSectionNumber.isEmpty ? "" : "§ \(normalizedSectionNumber)",
            "(2022)"
        ]
        .filter { !$0.isEmpty }
        .joined(separator: " ")
        return normalizedTitle.isEmpty ? reference : "\(reference) — \(normalizedTitle)"
    }

    func recordRecentSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        var updated = recentSearches.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        updated.insert(trimmed, at: 0)
        recentSearches = Array(updated.prefix(10))
        preferencesDefaults.set(recentSearches, forKey: recentSearchesDefaultsKey)
        queueContinuityContextForSync()
    }

    func removeRecentSearch(_ query: String) {
        recentSearches.removeAll { $0.caseInsensitiveCompare(query) == .orderedSame }
        preferencesDefaults.set(recentSearches, forKey: recentSearchesDefaultsKey)
        queueContinuityContextForSync()
    }

    func clearRecentSearches() {
        recentSearches = []
        recentlyViewedSections = []
        preferencesDefaults.removeObject(forKey: recentSearchesDefaultsKey)
        persistRecentlyViewedSections()
        scheduleUserContentAutoSync()
    }

    func pinSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSearchPinned(trimmed) else { return }

        var updated = pinnedSearches.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        updated.insert(trimmed, at: 0)
        pinnedSearches = updated
        persistPinnedSearches()
    }

    func unpinSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        pinnedSearches.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        persistPinnedSearches()
    }

    func isSearchPinned(_ query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return pinnedSearches.contains { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
    }

    private func persistPinnedSearches() {
        preferencesDefaults.set(pinnedSearches, forKey: pinnedSearchesDefaultsKey)
    }

    private static func loadRecentSearches(defaults: UserDefaults) -> [String] {
        (defaults.array(forKey: "recentSearches") as? [String] ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func loadPinnedSearches(defaults: UserDefaults) -> [String] {
        (defaults.array(forKey: "pinnedSearches") as? [String] ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    func refreshBookmarks() {
        // Any caller performing the full Saved/Project presentation refresh
        // has already satisfied a pending debounced note refresh. Cancel it
        // so a quick follow-up edit does not rebuild account-wide Project
        // evidence a second time.
        savedPresentationRefreshTask?.cancel()
        savedPresentationRefreshTask = nil

        guard let selectedVersion, let userContentRepository else {
            let didChange = !bookmarkedSectionIDs.isEmpty || !bookmarks.isEmpty
            bookmarkedSectionIDs = []
            bookmarks = []
            if didChange {
                bookmarkRevision &+= 1
            }
            return
        }

        let previousBookmarkedIDs = bookmarkedSectionIDs
        let previousBookmarks = bookmarks

        do {
            let ids = try userContentRepository.bookmarkedSectionIDs(codeVersion: selectedVersion.codeVersion)
            let noteEntries = try userContentRepository.noteEntries(codeVersion: selectedVersion.codeVersion)
            let tagEntries = (try? userContentRepository.tagsBySectionID(codeVersion: selectedVersion.codeVersion)) ?? [:]
            let annotationEntries = (try? userContentRepository.annotationEntries(codeVersion: selectedVersion.codeVersion)) ?? []
            let bookmarkDates = (try? userContentRepository.bookmarkCreatedAtBySectionID(codeVersion: selectedVersion.codeVersion)) ?? [:]
            bookmarkedSectionIDs = Set(ids)
            let savedSectionIDs = Array(
                Set(ids)
                    .union(noteEntries.keys)
                    .union(tagEntries.keys)
                    .union(annotationEntries.map(\.sectionID))
            ).sorted()
            if let authoredCodeStore {
                bookmarks = authoredCodeStore.savedSections(
                    ids: savedSectionIDs,
                    codeVersion: selectedVersion.codeVersion,
                    bookmarkedSectionIDs: bookmarkedSectionIDs,
                    notesBySectionID: noteEntries,
                    tagsBySectionID: tagEntries,
                    annotationEntries: annotationEntries,
                    bookmarkCreatedAtBySectionID: bookmarkDates
                )
            } else {
                bookmarks = try codeDatabase?.savedSections(
                    ids: savedSectionIDs,
                    codeVersion: selectedVersion.codeVersion,
                    bookmarkedSectionIDs: bookmarkedSectionIDs,
                    notesBySectionID: noteEntries,
                    tagsBySectionID: tagEntries,
                    annotationEntries: annotationEntries,
                    bookmarkCreatedAtBySectionID: bookmarkDates
                ) ?? []
            }
        } catch {
            statusMessage = error.localizedDescription
            bookmarkedSectionIDs = []
            bookmarks = []
        }

        if bookmarkedSectionIDs != previousBookmarkedIDs || bookmarks != previousBookmarks {
            bookmarkRevision &+= 1
        }

        // Folder metadata and current-version membership are cheap enough to
        // reconcile immediately. Account-wide Project evidence is scheduled
        // separately by refreshFolders() so Reader feedback never waits for it.
        refreshFolders()
    }

    // MARK: - Folders

    func refreshFolders() {
        guard let selectedVersion, let userContentRepository else {
            cancelProjectPresentationRefresh()
            folders = []
            folderMembership = [:]
            projectBookmarksByFolderID = [:]
            projectEvidenceRecordCountByFolderID = [:]
            clearActiveProject()
            return
        }

        do {
            let records = try userContentRepository.allFolders()
            folders = records.map { record in
                CodeFolder(
                    id: record.id,
                    clientID: record.clientID,
                    ownerID: record.ownerID.isEmpty ? UserDataDefaults.localOwnerID : record.ownerID,
                    visibility: UserContentVisibility(rawValue: record.visibility) ?? .personal,
                    syncState: UserContentSyncState(rawValue: record.syncState) ?? .localOnly,
                    deletedAt: record.deletedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
                    codeVersion: record.codeVersion,
                    name: record.name,
                    address: record.address,
                    description: record.description,
                    colorHex: record.colorHex,
                    folderType: CodeFolderType(serverValue: record.folderType),
                    sortOrder: record.sortOrder,
                    createdAt: ISO8601DateFormatter().date(from: record.createdAt) ?? Date(),
                    updatedAt: ISO8601DateFormatter().date(from: record.updatedAt) ?? Date()
                )
            }
            folderMembership = (try? userContentRepository.folderMembership(codeVersion: selectedVersion.codeVersion)) ?? [:]
            if let activeProjectID, folders.contains(where: { $0.id == activeProjectID }) == false {
                clearActiveProject(ifMatches: activeProjectID)
            }
            scheduleProjectPresentationRefresh()
        } catch {
            cancelProjectPresentationRefresh()
            statusMessage = error.localizedDescription
            folders = []
            folderMembership = [:]
            projectBookmarksByFolderID = [:]
            projectEvidenceRecordCountByFolderID = [:]
            clearActiveProject()
        }
    }

    private func scheduleProjectPresentationRefresh(delay: Duration = .milliseconds(140)) {
        projectPresentationRefreshGeneration &+= 1
        let generation = projectPresentationRefreshGeneration
        projectPresentationRefreshTask?.cancel()
        projectPresentationRefreshTask = Task { [weak self] in
            let signpostID = OSSignpostID(log: AppSignpost.projects)
            os_signpost(
                .begin,
                log: AppSignpost.projects,
                name: "projectHydration",
                signpostID: signpostID
            )
            defer {
                os_signpost(
                    .end,
                    log: AppSignpost.projects,
                    name: "projectHydration",
                    signpostID: signpostID
                )
            }
            do {
                try await Task.sleep(for: delay)
                guard !Task.isCancelled, let self else { return }
                let snapshot: ProjectPresentationSnapshot
                if let store = self.userContentRepository as? UserDataStore {
                    snapshot = try await self.projectPresentationSnapshotBuilder.build(
                        databaseURL: store.databaseURL,
                        folders: self.folders,
                        availableVersions: self.availableVersions
                    )
                } else {
                    snapshot = try self.projectPresentationSnapshot()
                }
                let presentation = try await self.projectPresentationBuilder.build(snapshot)
                try Task.checkCancellation()
                guard generation == self.projectPresentationRefreshGeneration else { return }
                self.projectBookmarksByFolderID = presentation.rowsByFolderID
                self.projectEvidenceRecordCountByFolderID = presentation.recordCountByFolderID
                self.projectPresentationRefreshTask = nil
            } catch is CancellationError {
                return
            } catch {
                guard let self, generation == self.projectPresentationRefreshGeneration else { return }
                self.projectPresentationRefreshTask = nil
                self.statusMessage = error.localizedDescription
            }
        }
    }

    private func cancelProjectPresentationRefresh() {
        projectPresentationRefreshGeneration &+= 1
        projectPresentationRefreshTask?.cancel()
        projectPresentationRefreshTask = nil
    }

    private func projectPresentationSnapshot() throws -> ProjectPresentationSnapshot {
        guard let userContentRepository else {
            return ProjectPresentationSnapshot(folders: [], versions: [:], catalog: [])
        }
        let fallbackCatalog = locator.availableCodeVersions()
        let catalog = Dictionary(
            (availableVersions + fallbackCatalog).map {
                (UserContentSyncCodeVersion.server($0.codeVersion), $0)
            },
            uniquingKeysWith: { first, _ in first }
        ).values.sorted { $0.fileName < $1.fileName }
        return try ProjectPresentationSnapshotAssembler.build(
            repository: userContentRepository,
            folders: folders,
            catalog: catalog
        )
    }

    @discardableResult
    func createFolder(
        name: String,
        address: String = "",
        description: String = "",
        colorHex: String = CodeFolder.defaultColorHex,
        folderType: CodeFolderType = .project
    ) -> CodeFolder? {
        guard let selectedVersion, let userContentRepository else { return nil }
        do {
            if folderType == .project, currentPlan != .pro {
                let folderCount = try folderCountForEntitlements()
                guard !denyIfNeeded(entitlementService.canCreateProject(currentCount: folderCount)) else {
                    return nil
                }
            }
            let id = try userContentRepository.createFolder(
                name: name,
                address: address,
                description: description,
                colorHex: colorHex,
                folderType: folderType,
                codeVersion: selectedVersion.codeVersion
            )
            refreshFolders()
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
            return folders.first { $0.id == id }
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func updateFolder(_ folder: CodeFolder, name: String, address: String, description: String, colorHex: String) {
        guard let userContentRepository else { return }
        do {
            try userContentRepository.updateFolder(
                id: folder.id,
                name: name,
                address: address,
                description: description,
                colorHex: colorHex,
                folderType: folder.folderType,
                codeVersion: folder.codeVersion
            )
            refreshFolders()
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func deleteFolder(id: Int64) {
        guard let folder = folder(id: id), let userContentRepository else { return }
        do {
            try userContentRepository.deleteFolder(id: id, codeVersion: folder.codeVersion)
            refreshFolders()
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    @discardableResult
    func deleteFolders(ids: Set<Int64>) -> Set<Int64> {
        guard !ids.isEmpty, let userContentRepository else { return [] }
        var deletedIDs = Set<Int64>()
        var firstError: Error?
        for id in ids.sorted() {
            do {
                guard let folder = folder(id: id) else { continue }
                try userContentRepository.deleteFolder(id: id, codeVersion: folder.codeVersion)
                deletedIDs.insert(id)
            } catch {
                if firstError == nil { firstError = error }
            }
        }
        refreshFolders()
        if !deletedIDs.isEmpty {
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
        }
        if let firstError {
            statusMessage = firstError.localizedDescription
        }
        return deletedIDs
    }

    func addSection(_ sectionID: Int64, toFolder folderID: Int64) {
        var destinationIDs = Set(folderMembership[sectionID] ?? [])
        destinationIDs.insert(folderID)
        _ = saveSection(sectionID: sectionID, toFolderIDs: destinationIDs)
    }

    /// Saves one section to one or more destinations without ever exposing an
    /// intermediate unassigned bookmark to the UI or sync queue.
    @discardableResult
    func saveSection(sectionID: Int64, toFolderIDs folderIDs: Set<Int64>) -> Bool {
        guard !folderIDs.isEmpty, let selectedVersion, let userContentRepository else {
            statusMessage = "Choose at least one folder before saving."
            return false
        }
        let destinations = folders.filter { folderIDs.contains($0.id) }
        guard destinations.count == folderIDs.count else {
            statusMessage = "One or more selected folders are no longer available."
            return false
        }
        let existingFolderIDs = Set(folderMembership[sectionID] ?? [])
        let newlyAddedFolderIDs = folderIDs.subtracting(existingFolderIDs)
        if destinations.contains(where: {
            $0.folderType == .project && newlyAddedFolderIDs.contains($0.id)
        }) && !hasProjectAccess {
            requireProjectAccess()
            return false
        }
        if !isBookmarked(sectionID: sectionID), currentPlan != .pro {
            do {
                let bookmarkCount = try bookmarkCountForEntitlements()
                guard !denyIfNeeded(entitlementService.canCreateSavedSection(currentCount: bookmarkCount)) else {
                    return false
                }
            } catch {
                statusMessage = error.localizedDescription
                return false
            }
        }

        let previousBookmarkedSectionIDs = bookmarkedSectionIDs
        let previousBookmarks = bookmarks
        let previousFolderMembership = folderMembership
        let previousProjectBookmarks = projectBookmarksByFolderID
        let previousProjectCounts = projectEvidenceRecordCountByFolderID
        applyOptimisticBookmarkState(
            sectionID: sectionID,
            isBookmarked: true,
            codeVersion: selectedVersion.codeVersion
        )
        applyOptimisticFolderMembership(sectionID: sectionID, folderIDs: folderIDs)

        do {
            try userContentRepository.saveSection(
                sectionID,
                toFolderIDs: folderIDs,
                codeVersion: selectedVersion.codeVersion
            )
            scheduleProjectPresentationRefresh()
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
            return true
        } catch {
            bookmarkedSectionIDs = previousBookmarkedSectionIDs
            bookmarks = previousBookmarks
            folderMembership = previousFolderMembership
            projectBookmarksByFolderID = previousProjectBookmarks
            projectEvidenceRecordCountByFolderID = previousProjectCounts
            bookmarkRevision &+= 1
            statusMessage = error.localizedDescription
            return false
        }
    }

    /// Replaces memberships for an already-saved section. Empty membership is
    /// intentionally rejected; the Reader routes that destructive final
    /// unlink through its explicit delete confirmation instead.
    @discardableResult
    func replaceFolderMembership(sectionID: Int64, folderIDs: Set<Int64>) -> Bool {
        guard isBookmarked(sectionID: sectionID) else { return false }
        return saveSection(sectionID: sectionID, toFolderIDs: folderIDs)
    }

    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64, codeVersion: String? = nil) {
        guard let userContentRepository else { return }
        let targetCodeVersion = codeVersion ?? selectedVersion?.codeVersion
        guard let targetCodeVersion else { return }
        do {
            try userContentRepository.removeSection(
                sectionID,
                fromFolder: folderID,
                codeVersion: targetCodeVersion
            )
            if let selectedVersion,
               UserContentSyncCodeVersion.server(selectedVersion.codeVersion)
                == UserContentSyncCodeVersion.server(targetCodeVersion) {
                let remaining = Set(folderMembership[sectionID] ?? []).subtracting([folderID])
                if remaining.isEmpty {
                    folderMembership.removeValue(forKey: sectionID)
                } else {
                    folderMembership[sectionID] = remaining.sorted()
                }
            }
            projectBookmarksByFolderID[folderID]?.removeAll { $0.id == sectionID }
            projectEvidenceRecordCountByFolderID[folderID] = projectBookmarksByFolderID[folderID]?.count ?? 0
            scheduleProjectPresentationRefresh()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func applyOptimisticFolderMembership(sectionID: Int64, folderIDs: Set<Int64>) {
        let previousFolderIDs = Set(folderMembership[sectionID] ?? [])
        folderMembership[sectionID] = folderIDs.sorted()
        let affectedFolderIDs = previousFolderIDs.union(folderIDs)
        let sectionRows = ProjectEvidenceConsolidator.consolidated(
            bookmarks.filter { $0.id == sectionID }
        )

        for folderID in affectedFolderIDs {
            projectBookmarksByFolderID[folderID, default: []].removeAll { $0.id == sectionID }
            if folderIDs.contains(folderID) {
                projectBookmarksByFolderID[folderID, default: []].append(contentsOf: sectionRows)
            }
            projectEvidenceRecordCountByFolderID[folderID] = projectBookmarksByFolderID[folderID]?.count ?? 0
        }
    }

    /// All folders that currently contain a given section.
    func folders(containing sectionID: Int64) -> [CodeFolder] {
        let memberIDs = Set(folderMembership[sectionID] ?? [])
        guard !memberIDs.isEmpty else { return [] }
        return folders.filter { memberIDs.contains($0.id) }
    }

    func folder(id: Int64) -> CodeFolder? {
        folders.first { $0.id == id }
    }

    var activeProject: CodeFolder? {
        guard let activeProjectID else { return nil }
        return folder(id: activeProjectID)
    }

    func backendProjectID(for folderID: Int64) -> String? {
        guard let folder = folder(id: folderID),
              folder.folderType == .project,
              let signedInAccount
        else { return nil }
        return UserContentProjectIdentity.stable(
            folder.clientID,
            userID: signedInAccount.appUserID
        ) ?? folder.clientID
    }

    var activeBackendProjectID: String? {
        activeProjectID.flatMap(backendProjectID(for:))
    }

    func folder(forBackendProjectID projectID: String?) -> CodeFolder? {
        guard let projectID, let signedInAccount else { return nil }
        return folders.first { folder in
            guard folder.folderType == .project else { return false }
            return (UserContentProjectIdentity.stable(folder.clientID, userID: signedInAccount.appUserID) ?? folder.clientID) == projectID
        }
    }

    func sendToResearch(_ selection: ResearchSelectionRequest) {
        if !pendingResearchSelections.contains(selection) {
            pendingResearchSelections.append(selection)
        }
        selectedTab = .research
    }

    func acknowledgePendingResearchSelections(_ selections: [ResearchSelectionRequest]) {
        guard pendingResearchSelections.starts(with: selections) else { return }
        pendingResearchSelections.removeFirst(selections.count)
    }

    func researchConversations() async throws -> [ResearchConversationSummary] {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.researchConversations(account: signedInAccount)
    }

    func researchConversation(id: String) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.researchConversation(
            account: signedInAccount,
            conversationID: id
        )
    }

    func refreshResearchConversation(id: String) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.refreshResearchConversation(
            account: signedInAccount,
            conversationID: id
        )
    }

    func reviewResearchProjectContext(
        conversationID: String,
        projectID: String,
        facts: [String]
    ) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.reviewResearchProjectContext(
            account: signedInAccount,
            conversationID: conversationID,
            projectID: projectID,
            facts: facts
        )
    }

    func reviewResearchSelection(
        _ selection: ResearchSelectionRequest
    ) async throws -> ResearchSelectionReviewResponse {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.reviewResearchSelection(
            account: signedInAccount,
            selection: selection
        )
    }

    func createResearchConversation(
        selections: [ResearchSelectionRequest],
        projectID: String?
    ) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.createResearchConversation(
            account: signedInAccount,
            projectID: projectID,
            selections: selections
        )
    }

    func addResearchEvidence(
        conversationID: String,
        selections: [ResearchSelectionRequest]
    ) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.addResearchEvidence(
            account: signedInAccount,
            conversationID: conversationID,
            selections: selections
        )
    }

    func sendResearchMessage(
        conversationID: String,
        question: String,
        requestID: String = UUID().uuidString
    ) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.sendResearchMessage(
            account: signedInAccount,
            conversationID: conversationID,
            question: question,
            requestID: requestID
        )
    }

    func renameResearchConversation(id: String, title: String) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.renameResearchConversation(
            account: signedInAccount,
            conversationID: id,
            title: title
        )
    }

    func assignResearchConversation(
        id: String,
        projectID: String?,
        confirmMove: Bool
    ) async throws -> ResearchConversation {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.assignResearchConversation(
            account: signedInAccount,
            conversationID: id,
            projectID: projectID,
            confirmMove: confirmMove
        )
    }

    func deleteResearchConversation(id: String) async throws {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        try await accountBackendClient.deleteResearchConversation(
            account: signedInAccount,
            conversationID: id
        )
    }

    func notebookCards(projectID: String) async throws -> NotebookCardListResponse {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.notebookCards(
            account: signedInAccount,
            projectID: projectID
        )
    }

    func notebookCard(projectID: String, cardID: String) async throws -> NotebookCard {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.notebookCard(
            account: signedInAccount,
            projectID: projectID,
            cardID: cardID
        )
    }

    func saveNotebookCard(
        projectID: String,
        cardID: String?,
        expectedVersion: Int,
        title: String,
        document: NotebookDocument,
        evidenceLinks: [NotebookEvidenceLink]
    ) async throws -> NotebookCard {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.saveNotebookCard(
            account: signedInAccount,
            projectID: projectID,
            cardID: cardID,
            expectedVersion: expectedVersion,
            title: title,
            document: document,
            evidenceLinks: evidenceLinks
        )
    }

    func deleteNotebookCard(projectID: String, cardID: String, expectedVersion: Int) async throws {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        try await accountBackendClient.deleteNotebookCard(
            account: signedInAccount,
            projectID: projectID,
            cardID: cardID,
            expectedVersion: expectedVersion
        )
    }

    func uploadNotebookAsset(
        projectID: String,
        data: Data,
        contentType: String,
        width: Int?,
        height: Int?
    ) async throws -> NotebookImageAsset {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.uploadNotebookAsset(
            account: signedInAccount,
            projectID: projectID,
            data: data,
            contentType: contentType,
            width: width,
            height: height
        )
    }

    func notebookAsset(projectID: String, assetID: String) async throws -> Data {
        guard let signedInAccount else { throw ProjectHubLoadError.signInRequired }
        return try await accountBackendClient.notebookAsset(
            account: signedInAccount,
            projectID: projectID,
            assetID: assetID
        )
    }

    func bookmarks(inFolder folderID: Int64) -> [BookmarkedSection] {
        projectBookmarksByFolderID[folderID] ?? []
    }

    func bookmarkCount(inFolder folderID: Int64) -> Int {
        projectEvidenceRecordCountByFolderID[folderID] ?? bookmarks(inFolder: folderID).count
    }

    func projectHubSnapshot(folderID: Int64) async throws -> ProjectHubSnapshot {
        guard let folder = folder(id: folderID) else {
            throw ProjectHubLoadError.projectUnavailable
        }
        guard let signedInAccount else {
            throw ProjectHubLoadError.signInRequired
        }
        let projectID = UserContentProjectIdentity.stable(
            folder.clientID,
            userID: signedInAccount.appUserID
        ) ?? folder.clientID
        do {
            let snapshot = try await accountBackendClient.projectHub(
                account: signedInAccount,
                projectID: projectID
            )
            try? projectHubOfflineCache.store(
                snapshot,
                accountID: signedInAccount.appUserID,
                projectID: projectID,
                scope: "personal"
            )
            return snapshot
        } catch {
            if let cached = try? projectHubOfflineCache.load(
                ProjectHubSnapshot.self,
                accountID: signedInAccount.appUserID,
                projectID: projectID,
                scope: "personal"
            ) {
                return cached.value.cachedCopy(at: cached.cachedAt)
            }
            throw error
        }
    }

    func refreshOrganizations() async {
        guard let signedInAccount else {
            organizations = []
            return
        }
        guard !isOrganizationWorkspaceLoading else { return }
        isOrganizationWorkspaceLoading = true
        defer { isOrganizationWorkspaceLoading = false }
        do {
            organizations = try await accountBackendClient.organizations(account: signedInAccount)
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = error.localizedDescription
        }
    }

    func acceptPendingOrganizationInvitation() async {
        guard let signedInAccount,
              let invitationToken = pendingOrganizationInvitationToken,
              !invitationToken.isEmpty else {
            statusMessage = signedInAccount == nil
                ? "Sign in before accepting the firm invitation."
                : "This firm invitation is no longer available."
            return
        }
        guard !isOrganizationWorkspaceLoading else { return }
        isOrganizationWorkspaceLoading = true
        defer { isOrganizationWorkspaceLoading = false }
        do {
            let organization = try await accountBackendClient.acceptOrganizationInvitation(
                account: signedInAccount,
                invitationToken: invitationToken
            )
            pendingOrganizationInvitationToken = nil
            organizations = try await accountBackendClient.organizations(account: signedInAccount)
            statusMessage = "Access added to \(organization.name)."
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = error.localizedDescription
        }
    }

    func organizationProjectSnapshot(
        projectID: String
    ) async throws -> BackendOrganizationProjectSnapshotResponse {
        guard let signedInAccount else {
            throw ProjectHubLoadError.signInRequired
        }
        do {
            let snapshot = try await accountBackendClient.organizationProjectSnapshot(
                account: signedInAccount,
                projectID: projectID
            )
            try? projectHubOfflineCache.store(
                snapshot,
                accountID: signedInAccount.appUserID,
                projectID: projectID,
                scope: "organization"
            )
            return snapshot
        } catch {
            if let cached = try? projectHubOfflineCache.load(
                BackendOrganizationProjectSnapshotResponse.self,
                accountID: signedInAccount.appUserID,
                projectID: projectID,
                scope: "organization"
            ) {
                return cached.value
            }
            throw error
        }
    }

    func organizationProjectReportURL(
        projectID: String,
        projectName: String,
        file: ProjectReportFile
    ) async throws -> URL {
        guard let signedInAccount else {
            throw ProjectHubLoadError.signInRequired
        }
        let data = try await accountBackendClient.projectReportFile(
            account: signedInAccount,
            projectID: projectID,
            generatedReportID: file.generatedReportID
        )
        let digest = SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }
            .joined()
        guard digest == file.contentHash else {
            throw URLError(.cannotDecodeContentData)
        }
        let safeName = projectName
            .replacingOccurrences(
                of: #"[^a-zA-Z0-9]+"#,
                with: "-",
                options: .regularExpression
            )
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let fileName = safeName.isEmpty ? "Permitext-Project-Report" : String(safeName.prefix(80))
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(fileName)-\(file.format).pdf")
        try data.write(to: url, options: .atomic)
        return url
    }

    func projectReportPDF(manifestID: String) async throws -> URL {
        guard let signedInAccount else {
            throw ProjectHubLoadError.signInRequired
        }
        let manifest = try await accountBackendClient.projectReportManifest(
            account: signedInAccount,
            manifestID: manifestID
        )
        let rendered = try await Task.detached(priority: .userInitiated) {
            let url = try ProjectReportExportBuilder(manifest: manifest).build()
            return (url, try Data(contentsOf: url))
        }.value
        _ = try await accountBackendClient.saveProjectReportPDF(
            account: signedInAccount,
            projectID: manifest.project.id,
            manifestID: manifest.id,
            data: rendered.1
        )
        return rendered.0
    }

    private func denyIfNeeded(_ decision: EntitlementDecision) -> Bool {
        switch decision {
        case .allowed:
            return false
        case .denied(let requirement):
            entitlementPrompt = requirement
            statusMessage = requirement.message
            return true
        }
    }

    func dismissEntitlementPrompt() {
        entitlementPrompt = nil
    }

    var upgradeCallToActionTitle: String {
        permitextUpgradeCallToActionTitle(
            isStoreKitTestProActive: isStoreKitTestProActive,
            currentPlan: currentPlan,
            proProductDisplayPrice: proProductDisplayPrice,
            isStoreKitBusy: isStoreKitBusy
        )
    }

    var isStoreKitTestProActive: Bool {
        guard accountAuthorizedStoreKitPlan == .pro, !hasActiveBackendProEntitlement else { return false }
        switch storeKitTransactionEnvironment?.lowercased() {
        case "xcode", "sandbox":
            return true
        default:
            return false
        }
    }

    var planBillingLabel: String {
        guard isStoreKitTestProActive else { return currentEntitlementSource.label }
        switch storeKitTransactionEnvironment?.lowercased() {
        case "xcode":
            return "Apple subscription (Xcode test)"
        case "sandbox":
            return "Apple subscription (Sandbox/TestFlight)"
        default:
            return "Apple subscription (test)"
        }
    }

    var hasProjectAccess: Bool {
        hasCapability(.projects)
    }

    var hasResearchAccess: Bool {
        hasCapability(.research)
    }

    func hasCapability(_ capability: PermitextCapabilityID) -> Bool {
        if capability == .research, accountAuthorizedStoreKitPlan == .pro {
            return true
        }
        if accountAuthorizedStoreKitPlan == .pro,
           [.projects, .notebook, .professionalExports, .offlineAccess].contains(capability) {
            return true
        }
        if let currentCapabilityContract {
            return currentCapabilityContract.enables(capability)
        }
        switch capability {
        case .savedWork, .notes:
            return true
        case .projects, .notebook, .professionalExports, .offlineAccess:
            return currentPlan == .pro
        case .research:
            return entitlementService.currentEntitlement.grantsResearch()
        case .evidenceDiscovery, .collaboration, .organizationAdministration:
            return false
        }
    }

    @discardableResult
    func requireProjectAccess() -> Bool {
        guard !hasCapability(.projects) else { return true }
        let requirement = EntitlementRequirement(
            feature: .unlimitedProjects,
            requiredPlan: .pro,
            message: "Upgrade to Pro to create and manage projects."
        )
        entitlementPrompt = requirement
        statusMessage = requirement.message
        return false
    }

    func showUpgradePlaceholder() {
        entitlementPrompt = EntitlementRequirement(
            feature: .unlimitedSavedItems,
            requiredPlan: .pro,
            message: permitextProfessionalWorkspaceRequirementMessage()
        )
    }

    func refreshStoreKitEntitlements() async {
        let snapshot = await storeKitSubscriptionService.snapshot()
        _ = await authorizeStoreKitSnapshot(snapshot, allowsNewTestBinding: false)
    }

    func startStoreKitTransactionObservation() {
        guard storeKitUpdatesTask == nil else { return }
        let service = storeKitSubscriptionService
        storeKitUpdatesTask = Task { [weak self] in
            let updates = await service.transactionUpdates()
            for await snapshot in updates {
                _ = await self?.authorizeStoreKitSnapshot(snapshot, allowsNewTestBinding: false)
            }
        }
    }

    func requestProSubscriptionStore(clerk: Clerk? = nil) async {
        guard await requireSignedInBillingAccount(clerk: clerk, then: .purchasePro) else { return }
        guard currentPlan != .pro else {
            statusMessage = "Pro is already active for this Permitext account."
            return
        }
        guard !isStoreKitBusy else { return }
        storeKitOperationMessage = nil
        isStoreKitBusy = true
        defer { isStoreKitBusy = false }

        do {
            _ = try await storeKitSubscriptionService.proProductForPurchase(refresh: true)
            Self.storeKitPurchaseLogger.info("Presenting Apple's native subscription store.")
            isProSubscriptionStorePresented = true
        } catch {
            statusMessage = error.localizedDescription
            storeKitOperationMessage = error.localizedDescription
            entitlementPrompt = EntitlementRequirement(
                feature: .unlimitedSavedItems,
                requiredPlan: .pro,
                message: error.localizedDescription
            )
        }
    }

    func purchasePro(using purchaseAction: PurchaseAction) async {
        guard let purchasingAccount = signedInAccount else {
            statusMessage = "Sign in or create a Permitext account before purchasing Pro."
            storeKitOperationMessage = statusMessage
            return
        }
        guard !isStoreKitBusy else { return }
        isStoreKitBusy = true
        defer { isStoreKitBusy = false }

        do {
            storeKitOperationMessage = "Preparing the App Store purchase..."
            let preflightSnapshot = try await storeKitSubscriptionService.prepareForPurchase()
            let preflightAuthorized = await authorizeStoreKitSnapshot(
                preflightSnapshot,
                allowsNewTestBinding: false
            )
            if currentPlan == .pro {
                isProSubscriptionStorePresented = false
                statusMessage = isStoreKitTestProActive
                    ? "Pro (Test) is already active on this device."
                    : "Pro is already active."
                storeKitOperationMessage = statusMessage
                return
            }
            if preflightSnapshot.plan == .pro, !preflightAuthorized {
                // An active Apple transaction exists, but this account has not
                // established ownership. Starting another purchase risks a
                // duplicate charge; explicit Restore is the recovery path.
                return
            }

            var product = try await storeKitSubscriptionService.proProductForPurchase(refresh: true)
            let appAccountToken = storeKitAppAccountToken(for: purchasingAccount.appUserID)
            for attempt in 1...2 {
                storeKitOperationMessage = attempt == 1
                    ? "Waiting for Apple to open the purchase confirmation..."
                    : "Refreshing the App Store purchase session..."
                Self.storeKitPurchaseLogger.info(
                    "Starting native StoreKit purchase attempt \(attempt, privacy: .public) for product \(product.id, privacy: .public)."
                )

                guard signedInAccount?.appUserID == purchasingAccount.appUserID else {
                    throw CancellationError()
                }
                guard isProSubscriptionStorePresented else { return }
                if currentPlan == .pro {
                    isProSubscriptionStorePresented = false
                    statusMessage = isStoreKitTestProActive
                        ? "Pro (Test) is already active on this device."
                        : "Pro is already active."
                    storeKitOperationMessage = statusMessage
                    return
                }
                let purchaseResult = try await purchaseAction(
                    product,
                    options: [.appAccountToken(appAccountToken)]
                )
                switch purchaseResult {
                case .success:
                    let snapshot = try await storeKitSubscriptionService.snapshot(after: purchaseResult)
                    guard signedInAccount?.appUserID == purchasingAccount.appUserID else {
                        throw CancellationError()
                    }
                    let authorized = await authorizeStoreKitSnapshot(
                        snapshot,
                        allowsNewTestBinding: true
                    )
                    if authorized, currentPlan == .pro {
                        await storeKitSubscriptionService.finishActiveProTransactions()
                        isProSubscriptionStorePresented = false
                        if isStoreKitTestProActive {
                            statusMessage = "Pro (Test) is active on this device."
                            storeKitOperationMessage = "Apple confirmed Pro (Test) on this device."
                        } else {
                            statusMessage = "Pro is active."
                            storeKitOperationMessage = "Apple confirmed your Pro subscription."
                        }
                        Self.storeKitPurchaseLogger.info("Native StoreKit purchase completed and verified.")
                        return
                    }

                    guard snapshot.plan != .pro else { return }
                    Self.storeKitPurchaseLogger.error(
                        "StoreKit returned an inactive transaction on attempt \(attempt, privacy: .public): \(snapshot.debugSummary, privacy: .public)"
                    )
                    guard attempt == 1 else {
                        let message = "Apple did not open a new purchase. No charge was made. The App Store returned an expired subscription instead of starting checkout."
                        statusMessage = message
                        storeKitOperationMessage = message
                        return
                    }

                    guard isProSubscriptionStorePresented else { return }
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    guard isProSubscriptionStorePresented else { return }
                    let retryPreflightSnapshot = try await storeKitSubscriptionService.prepareForPurchase()
                    _ = await authorizeStoreKitSnapshot(
                        retryPreflightSnapshot,
                        allowsNewTestBinding: false
                    )
                    if currentPlan == .pro {
                        if retryPreflightSnapshot.plan == .pro {
                            await storeKitSubscriptionService.finishActiveProTransactions()
                        }
                        isProSubscriptionStorePresented = false
                        statusMessage = isStoreKitTestProActive
                            ? "Pro (Test) is active on this device."
                            : "Pro is active."
                        storeKitOperationMessage = statusMessage
                        return
                    }
                    if retryPreflightSnapshot.plan == .pro {
                        return
                    }
                    product = try await storeKitSubscriptionService.proProductForPurchase(refresh: true)

                case .userCancelled:
                    statusMessage = "Purchase cancelled."
                    storeKitOperationMessage = "Apple cancelled the purchase. No charge was made."
                    Self.storeKitPurchaseLogger.info("Native StoreKit purchase was cancelled by the user.")
                    return

                case .pending:
                    statusMessage = StoreKitSubscriptionServiceError.pendingApproval.localizedDescription
                    storeKitOperationMessage = StoreKitSubscriptionServiceError.pendingApproval.localizedDescription
                    Self.storeKitPurchaseLogger.info("Native StoreKit purchase is pending approval.")
                    return

                @unknown default:
                    statusMessage = StoreKitSubscriptionServiceError.unknownPurchaseResult.localizedDescription
                    storeKitOperationMessage = StoreKitSubscriptionServiceError.unknownPurchaseResult.localizedDescription
                    Self.storeKitPurchaseLogger.error("Native StoreKit returned an unknown purchase result.")
                    return
                }
            }
        } catch {
            let message = error.localizedDescription
            statusMessage = message
            storeKitOperationMessage = message
            Self.storeKitPurchaseLogger.error(
                "Native StoreKit purchase failed: \(message, privacy: .public)"
            )
        }
    }

    func dismissProSubscriptionStore() {
        isProSubscriptionStorePresented = false
    }

    func restorePurchases(clerk: Clerk? = nil) async {
        guard await requireSignedInBillingAccount(clerk: clerk, then: .restorePurchases) else { return }
        guard !isStoreKitBusy else { return }
        storeKitOperationMessage = nil
        isStoreKitBusy = true
        isStoreKitRestoreInProgress = true
        defer {
            isStoreKitBusy = false
            isStoreKitRestoreInProgress = false
        }

        do {
            let snapshot = try await storeKitSubscriptionService.restorePurchases()
            let authorized = await authorizeStoreKitSnapshot(
                snapshot,
                allowsNewTestBinding: true
            )
            if authorized, currentPlan == .pro {
                await storeKitSubscriptionService.finishActiveProTransactions()
                if isStoreKitTestProActive {
                    statusMessage = "Pro (Test), including Research, was restored on this device. Test purchases cannot activate production web access."
                    storeKitOperationMessage = "Apple restored Pro (Test) on this device."
                } else {
                    statusMessage = "Pro, including Research, was restored."
                    storeKitOperationMessage = "Apple restored your Pro subscription."
                }
            } else if snapshot.plan != .pro {
                statusMessage = "No active Pro subscription found."
                storeKitOperationMessage = "Apple found no active Pro subscription for this App Store account."
            }
        } catch {
            let message = "Apple could not restore purchases: \(error.localizedDescription)"
            statusMessage = message
            storeKitOperationMessage = message
        }
    }

    private func requireSignedInBillingAccount(
        clerk: Clerk?,
        then action: PostClerkAuthenticationAction
    ) async -> Bool {
        if signedInAccount != nil { return true }
        guard let clerk else {
            statusMessage = "Sign in or create a Permitext account before purchasing or restoring Pro."
            return false
        }

        requestClerkAuthentication(then: action)
        statusMessage = "Sign in or create a Permitext account to continue."
        _ = clerk
        return false
    }

    func handleAppleSignIn(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                statusMessage = "Sign in with Apple did not return an Apple ID credential."
                return
            }
            let displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            let identityToken = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) }
            let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            do {
                let backendRecord = try await accountBackendClient.signIn(
                    credential: AccountSignInCredential(
                        provider: .apple,
                        providerUserID: credential.user,
                        displayName: displayName.isEmpty ? nil : displayName,
                        signedInAt: Date(),
                        email: credential.email,
                        identityToken: identityToken,
                        authorizationCode: authorizationCode
                    ),
                    linkFrom: nil
                )
                await completeBackendSignIn(backendRecord)
            } catch {
                statusMessage = error.localizedDescription
            }
        case .failure(let error):
            statusMessage = error.localizedDescription
        }
    }

    func requestClerkAuthentication() {
        requestClerkAuthentication(then: .none)
    }

    private func requestClerkAuthentication(then action: PostClerkAuthenticationAction) {
        guard !isAccountBusy, !isStoreKitBusy else {
            statusMessage = "Finish the current account or App Store operation before changing accounts."
            return
        }
        accountMutationGeneration &+= 1
        clerkAuthenticationAttemptID = UUID()
        postClerkAuthenticationAction = action
        accountAuthenticationMessage = nil
        isClerkAuthenticationPresented = true
    }

    func handleClerkAuthenticationFinished(clerk: Clerk?) async {
        guard let authenticationAttemptID = clerkAuthenticationAttemptID else { return }
        guard let clerk, let session = clerk.session else {
            let pendingAction = postClerkAuthenticationAction
            postClerkAuthenticationAction = .none
            clerkAuthenticationAttemptID = nil
            if pendingAction != .none {
                statusMessage = "Sign in was not completed. No purchase was started."
            }
            return
        }

        // Account sync may be finishing as the OAuth sheet closes. Bound this
        // wait so a stalled sync can never hang sign-in or start a purchase
        // after the user has already retried.
        for _ in 0..<40 where isAccountBusy {
            guard !Task.isCancelled else { return }
            try? await Task.sleep(for: .milliseconds(50))
        }
        guard !isAccountBusy, authenticationAttemptID == clerkAuthenticationAttemptID else {
            statusMessage = "Permitext is still finishing an account operation. Select sign in and try again."
            postClerkAuthenticationAction = .none
            clerkAuthenticationAttemptID = nil
            return
        }

        let pendingAction = postClerkAuthenticationAction
        postClerkAuthenticationAction = .none

        if signedInAccount?.authProvider != .clerk {
            isAccountBusy = true
            accountAuthenticationMessage = "Finishing Permitext sign-in..."
            let sourceAccount = signedInAccount
            let expectedGeneration = accountMutationGeneration

            do {
                Self.accountAuthenticationLogger.info("Clerk native authentication returned an activated session.")
                try await completeClerkBackendSignIn(
                    session: session,
                    linkFrom: sourceAccount,
                    expectedAccountGeneration: expectedGeneration
                )
            } catch {
                let message = Self.accountAuthenticationFailureMessage(for: error)
                accountAuthenticationMessage = message
                statusMessage = message
                Self.accountAuthenticationLogger.error(
                    "Clerk native session reconciliation failed: \(String(describing: error), privacy: .public)"
                )
            }
            isAccountBusy = false
        }
        clerkAuthenticationAttemptID = nil

        guard signedInAccount != nil else { return }
        switch pendingAction {
        case .none:
            break
        case .purchasePro:
            await requestProSubscriptionStore()
        case .restorePurchases:
            await restorePurchases()
        }
    }

    func reconcileClerkSessionIfNeeded(clerk: Clerk?) async {
        guard signedInAccount == nil,
              !isAccountBusy,
              !isClerkAuthenticationPresented,
              clerkAuthenticationAttemptID == nil,
              let clerk,
              clerk.session != nil
        else { return }

        // A locally signed-out Permitext account must stay signed out. Older
        // builds could leave a hydrated Clerk session behind; never turn that
        // stale provider session back into a Permitext account automatically.
        do {
            do {
                try await clerk.auth.signOut()
            } catch {
                try await Clerk.clearAllKeychainItemsAndWait()
            }
        } catch {
            Self.accountAuthenticationLogger.error(
                "Stale Clerk session cleanup failed: \(String(describing: error), privacy: .public)"
            )
        }
    }

    private func completeClerkBackendSignIn(
        session: Session,
        linkFrom sourceAccount: SignedInAccount?,
        expectedAccountGeneration: UInt64
    ) async throws {
        guard let userID = session.user?.id ?? session.publicUserData?.userId else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        guard let sessionToken = try await session.getToken() else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        let backendRecord = try await accountBackendClient.signIn(
            credential: AccountSignInCredential(
                provider: .clerk,
                providerUserID: userID,
                displayName: nil,
                signedInAt: Date(),
                sessionToken: sessionToken
            ),
            linkFrom: sourceAccount
        )
        guard expectedAccountGeneration == accountMutationGeneration else {
            throw CancellationError()
        }
        await completeBackendSignIn(backendRecord)
    }

    private func completeBackendSignIn(_ backendRecord: BackendAccountRecord) async {
        let account = backendRecord.account
        let shouldClaimGuestProfile = signedInAccount == nil
        LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
        activateUserContentScope(
            account: account,
            claimCurrentGuestForNewAccount: shouldClaimGuestProfile
        )
        signedInAccount = account
        accountAuthenticationMessage = nil
        Self.saveSignedInAccount(account)
        prepareCanonicalCodeVersionMigration(for: account)
        refreshUserContentSyncCheckpoint()
        applyBackendEntitlement(backendRecord.entitlement)
        await refreshStoreKitEntitlements()
        await attachLocalDataIfNeeded()
        await pullRemoteUserContentIfPossible()
        await syncPendingUserContentIfPossible()
        await pullRemoteUserContentIfPossible()
        await refreshLifetimeGrant(announcesMissingGrant: false)
        if PermitextReleaseSurfaceVisibility.firmCollaboration {
            await refreshOrganizations()
        }
    }

    private static let accountAuthenticationLogger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.randycodex.permitext",
        category: "AccountAuthentication"
    )

    private static let storeKitPurchaseLogger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.randycodex.permitext",
        category: "StoreKitPurchase"
    )

    private static func accountAuthenticationFailureMessage(for error: Error) -> String {
        if error is CancellationError {
            return "Sign-in was cancelled. Select the button to try again."
        }

        let nsError = error as NSError
        if nsError.domain == ASWebAuthenticationSessionError.errorDomain,
           nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
            return "Sign-in was cancelled. Select the button to try again."
        }

        return "Sign-in could not finish: \(error.localizedDescription)"
    }

    func attachLocalDataIfNeeded() async {
        guard let signedInAccount else { return }
        guard signedInAccount.migrationState == .notStarted else { return }
        do {
            let migrationState = try await accountBackendClient.attachLocalData(account: signedInAccount)
            let migratedAccount = SignedInAccount(
                appUserID: signedInAccount.appUserID,
                authProvider: signedInAccount.authProvider,
                authProviderUserID: signedInAccount.authProviderUserID,
                appleUserID: signedInAccount.appleUserID,
                email: signedInAccount.email,
                publicUsername: signedInAccount.publicUsername,
                displayName: signedInAccount.displayName,
                signedInAt: signedInAccount.signedInAt,
                migrationState: migrationState,
                backendSessionToken: signedInAccount.backendSessionToken
            )
            self.signedInAccount = migratedAccount
            Self.saveSignedInAccount(migratedAccount)
            refreshUserContentSyncCheckpoint()
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = "Signed in. Local data is still only on this device."
        }
    }

    @discardableResult
    func syncPendingUserContentIfPossible() async -> Int {
        guard !isAccountBusy else { return 0 }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let startedAt = Date()
            let report = try await syncEngine.processPendingWork(account: signedInAccount)
            let elapsed = Date().timeIntervalSince(startedAt)
            if report.includesAuthoritativeAccountState {
                applyBackendEntitlement(
                    report.entitlement,
                    capabilityContract: report.capabilityContract
                )
            }
            refreshUserContentSyncCheckpoint()
            if let skippedReason = report.skippedReason {
                statusMessage = skippedReason
            } else if !report.rejectedMutationIDs.isEmpty {
                let rejectionMessage = report.rejectedMutationIDs
                    .compactMap { report.rejectionReasons[$0]?.message }
                    .first
                statusMessage = rejectionMessage ??
                    "Synced \(report.completedCount) of \(report.attemptedCount) local changes. Pull latest changes before retrying the rest."
            } else if report.completedCount > 0 {
                statusMessage = "Synced \(report.completedCount) local changes in \(Self.syncDurationText(elapsed))."
            }
            refreshPendingUserContentSyncCount()
            return report.attemptedCount
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                refreshPendingUserContentSyncCount()
                return 0
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
            refreshPendingUserContentSyncCount()
            scheduleUserContentRetry()
            return 0
        }
    }

    private func scheduleSavedPresentationRefresh() {
        savedPresentationRefreshTask?.cancel()
        savedPresentationRefreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 650_000_000)
            guard !Task.isCancelled, let self else { return }
            self.savedPresentationRefreshTask = nil
            self.refreshBookmarks()
        }
    }

    private func scheduleUserContentAutoSync() {
        guard ownsAccountSync else { return }
        guard signedInAccount != nil else { return }
        // Keep sign-out safety current even when the device is offline and
        // the delayed automatic sync cannot run.
        refreshPendingUserContentSyncCount()
        userContentAutoSyncTask?.cancel()
        userContentAutoSyncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            for _ in 0..<5 {
                guard !Task.isCancelled else { return }
                guard let self else { return }
                if !self.isAccountBusy {
                    await self.performAutomaticUserContentSync()
                    return
                }
                try? await Task.sleep(nanoseconds: 600_000_000)
            }
        }
    }

    private func performAutomaticUserContentSync() async {
        guard signedInAccount != nil, isNetworkAvailable else { return }
        // Prefer the cheap server checkpoint before downloading a full pull payload.
        await pullRemoteUserContentIfPossible(skipIfUnchanged: true)
        let pushedCount = await syncPendingUserContentIfPossible()
        // Trailing pull is only needed after local push work (rejections / concurrent remote
        // events). When the checkpoint already reported no remote changes and nothing was
        // pushed, skip the second pull entirely.
        if pushedCount > 0 {
            await pullRemoteUserContentIfPossible(skipIfUnchanged: false)
        }
    }

    func startForegroundAutomaticSync() {
        guard ownsAccountSync else { return }
        guard isInitialContentLoaded, signedInAccount != nil else {
            stopForegroundAutomaticSync()
            return
        }
        guard foregroundAutomaticSyncTask == nil else { return }
        foregroundAutomaticSyncTask = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                let delay = UInt64(self.foregroundAccountSyncInterval * 1_000_000_000)
                try? await Task.sleep(nanoseconds: delay)
                guard !Task.isCancelled, self.signedInAccount != nil else { return }
                guard self.isNetworkAvailable, !self.isAccountBusy else { continue }
                self.lastForegroundAccountSyncAt = Date()
                await self.performAutomaticUserContentSync()
            }
        }
    }

    func stopForegroundAutomaticSync() {
        foregroundAutomaticSyncTask?.cancel()
        foregroundAutomaticSyncTask = nil
    }

    private func scheduleUserContentRetry() {
        guard signedInAccount != nil else { return }
        userContentAutoSyncTask?.cancel()
        userContentAutoSyncTask = Task { [weak self] in
            guard let self else { return }
            for delay in self.automaticSyncRetryDelays {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                guard !Task.isCancelled, self.signedInAccount != nil else { return }
                guard !self.isAccountBusy else { continue }
                await self.performAutomaticUserContentSync()
                if self.userContentSyncCheckpoint?.lastErrorMessage == nil {
                    return
                }
            }
        }
    }

    private static func syncDurationText(_ interval: TimeInterval) -> String {
        if interval < 1 {
            return "\(Int((interval * 1_000).rounded())) ms"
        }
        return String(format: "%.1f sec", interval)
    }

    func previewRemoteUserContentMergeIfPossible() async -> UserContentMergePlan? {
        guard !isAccountBusy else { return nil }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let report = try await syncEngine.pullRemoteChanges(account: signedInAccount)
            refreshUserContentSyncCheckpoint()
            return report.mergePlan
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                return nil
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func pullRemoteUserContentIfPossible(skipIfUnchanged: Bool = false) async {
        guard !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let report = try await syncEngine.pullRemoteChanges(
                account: signedInAccount,
                applySafeChanges: true,
                skipIfUnchanged: skipIfUnchanged
            )
            if report.includesAuthoritativeAccountState {
                applyBackendEntitlement(
                    report.entitlement,
                    capabilityContract: report.capabilityContract
                )
            }
            if report.appliedRemoteContinuity {
                refreshContinuityStateFromStore()
            }
            if report.appliedCount > 0 {
                refreshBookmarks()
            }
            refreshUserContentSyncCheckpoint()
            // Checkpoint-skipped automatic pulls are silent; only surface meaningful results.
            if report.skippedReason == "No remote changes." {
                return
            }
            if let skippedReason = report.skippedReason {
                statusMessage = skippedReason
            } else if report.appliedCount > 0 {
                statusMessage = "Applied \(report.appliedCount) remote changes."
            } else if report.conflictCount > 0 {
                statusMessage = "\(report.conflictCount) remote changes need review."
            }
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                return
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
        }
    }

    func performStartupAccountSyncIfNeeded() async {
        guard isInitialContentLoaded else { return }
        guard signedInAccount != nil else { return }
        guard !didRunStartupAccountSync else { return }
        didRunStartupAccountSync = true
        lastForegroundAccountSyncAt = Date()
        // A cold launch must refresh the authoritative account state even when
        // the content checkpoint is unchanged. This repairs missing local
        // entitlement data after reinstall, migration, or an interrupted sync.
        await pullRemoteUserContentIfPossible(skipIfUnchanged: false)
        let pushedCount = await syncPendingUserContentIfPossible()
        if pushedCount > 0 {
            await pullRemoteUserContentIfPossible(skipIfUnchanged: false)
        }
    }

    func performForegroundAccountSyncIfNeeded() async {
        guard isInitialContentLoaded else { return }
        guard signedInAccount != nil else { return }
        let now = Date()
        if let lastForegroundAccountSyncAt,
           now.timeIntervalSince(lastForegroundAccountSyncAt) < foregroundAccountSyncInterval {
            return
        }
        lastForegroundAccountSyncAt = now
        await performAutomaticUserContentSync()
    }

    func syncNow() async {
        guard signedInAccount != nil else {
            statusMessage = "Sign in before syncing saved work."
            return
        }
        do {
            try syncEngine.retryFailedItems()
        } catch {
            statusMessage = "Could not prepare failed sync items for retry. \(error.localizedDescription)"
        }
        await performAutomaticUserContentSync()
        refreshPendingUserContentSyncCount()
    }

    private func refreshUserContentSyncCheckpoint() {
        userContentSyncCheckpoint = syncEngine.checkpoint(account: signedInAccount)
        refreshPendingUserContentSyncCount()
    }

    /// Activates the database belonging to the current Permitext account.
    /// Injected repositories used by tests and previews intentionally retain
    /// their existing behavior.
    private func activateUserContentScope(
        account: SignedInAccount?,
        claimCurrentGuestForNewAccount: Bool = false
    ) {
        guard let accountUserDataProfiles else { return }

        userContentAutoSyncTask?.cancel()
        userContentAutoSyncTask = nil
        savedPresentationRefreshTask?.cancel()
        savedPresentationRefreshTask = nil
        cancelProjectPresentationRefresh()

        do {
            let databaseURL = try accountUserDataProfiles.databaseURL(
                accountID: account?.appUserID,
                claimCurrentGuestForNewAccount: claimCurrentGuestForNewAccount
            )
            let currentURL = (userContentRepository as? UserDataStore)?.databaseURL
            if currentURL?.standardizedFileURL != databaseURL.standardizedFileURL {
                let repository = try UserDataStore(databaseURL: databaseURL)
                userContentRepository = repository
                syncEngine = UserContentSyncEngine(
                    repository: repository,
                    backend: userContentSyncBackend,
                    continuityStore: continuityStore
                )
            }
        } catch {
            // Fail closed: an account must never inherit the preceding profile
            // merely because its own database could not be opened.
            userContentRepository = nil
            syncEngine = UserContentSyncEngine(
                repository: nil,
                backend: userContentSyncBackend,
                continuityStore: continuityStore
            )
            statusMessage = "Saved work for this account could not be opened. No other account data was shown."
        }

        didRunStartupAccountSync = false
        lastForegroundAccountSyncAt = nil
        if let account {
            // Checkpoints predate account-scoped local databases. A full pull
            // makes the selected profile authoritative before incremental sync
            // resumes.
            syncEngine.resetCheckpoint(account: account)
        }
        userContentSyncCheckpoint = syncEngine.checkpoint(account: account)
        userContentSyncConflicts = []
        refreshBookmarks()
        refreshPendingUserContentSyncCount()
    }

    private func prepareCanonicalCodeVersionMigration(for account: SignedInAccount?) {
        guard let account else { return }
        // Reconcile once from the complete server state after the project and
        // bulk-clear tombstone repairs. Older event cursors could otherwise
        // remain ahead of those repaired records and preserve stale local data.
        let key = "permitext.sync.full-state-reconciliation.v7.\(account.appUserID)"
        guard !preferencesDefaults.bool(forKey: key) else { return }
        syncEngine.resetCheckpoint(account: account)
        preferencesDefaults.set(true, forKey: key)
    }

    private func refreshPendingUserContentSyncCount() {
        do {
            pendingUserContentSyncCount = try syncEngine.previewPendingWork(limit: 500).pendingCount
            userContentSyncConflicts = try syncEngine.rejectedConflicts(account: signedInAccount)
        } catch {
            pendingUserContentSyncCount = 0
            userContentSyncConflicts = []
        }
    }

    func resolveUserContentSyncConflict(_ conflict: UserContentSyncConflict, keepLocal: Bool) async {
        guard let signedInAccount, !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }
        do {
            try await syncEngine.resolveRejectedConflict(conflict, account: signedInAccount, keepLocal: keepLocal)
            refreshBookmarks()
            refreshPendingUserContentSyncCount()
            refreshUserContentSyncCheckpoint()
            statusMessage = keepLocal ? "Kept this device's version and synced it." : "Applied the server version."
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            refreshUserContentSyncCheckpoint()
            statusMessage = "Could not resolve the sync conflict. \(error.localizedDescription)"
        }
    }

    var syncStatusTitle: String {
        guard signedInAccount != nil else { return "Not signed in" }
        if isAccountBusy { return "Syncing..." }
        if !userContentSyncConflicts.isEmpty { return "\(userContentSyncConflicts.count) change\(userContentSyncConflicts.count == 1 ? "" : "s") need review" }
        if userContentSyncCheckpoint?.lastErrorMessage != nil { return "Sync failed" }
        if pendingUserContentSyncCount > 0 { return "\(pendingUserContentSyncCount) change\(pendingUserContentSyncCount == 1 ? "" : "s") waiting" }
        return "Synced"
    }

    var syncStatusDetail: String {
        guard signedInAccount != nil else {
            return "Sign in to sync saved work across installs and devices."
        }
        if let error = userContentSyncCheckpoint?.lastErrorMessage {
            if !userContentSyncConflicts.isEmpty {
                return "Choose which copy to keep for each server-newer change."
            }
            if Self.isBackendAuthenticationFailureMessage(error) {
                return "Your sync session expired. Sign in again to reconnect saved work."
            }
            return "Last sync failed. Tap Sync Now to retry. \(error)"
        }
        let lastPush = userContentSyncCheckpoint?.lastSuccessfulPushAt
        let lastPull = userContentSyncCheckpoint?.lastSuccessfulPullAt
        let lastSync = [lastPush, lastPull].compactMap { $0 }.max()
        if let lastSync {
            return "Last synced \(lastSync.formatted(date: .abbreviated, time: .shortened))."
        }
        return pendingUserContentSyncCount > 0
            ? "Local changes are queued for upload."
            : "No sync has completed yet."
    }

    var canSyncNow: Bool {
        signedInAccount != nil && !isAccountBusy
    }

    static func normalizedPublicUsername(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutAtPrefix = trimmed.hasPrefix("@") ? String(trimmed.dropFirst()) : trimmed
        let normalized = withoutAtPrefix.lowercased()
        return normalized.isEmpty ? nil : normalized
    }

    static func publicUsernameValidationMessage(_ value: String) -> String? {
        guard let normalized = normalizedPublicUsername(value) else { return nil }
        if normalized.count < 3 {
            return "Use at least 3 characters."
        }
        if normalized.count > 30 {
            return "Use 30 characters or fewer."
        }
        let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_-")
        if normalized.unicodeScalars.contains(where: { !allowedCharacters.contains($0) }) {
            return "Use letters, numbers, hyphens, or underscores."
        }
        return nil
    }

    func updateAccountProfile(publicUsername: String) async {
        guard let signedInAccount else {
            statusMessage = "Sign in before updating your profile."
            return
        }
        guard !isAccountBusy else { return }
        if let validationMessage = Self.publicUsernameValidationMessage(publicUsername) {
            statusMessage = validationMessage
            return
        }

        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let normalizedUsername = Self.normalizedPublicUsername(publicUsername)
            let updatedAccount = try await accountBackendClient.updateProfile(
                account: signedInAccount,
                publicUsername: normalizedUsername,
                displayName: signedInAccount.displayName
            )
            self.signedInAccount = updatedAccount
            Self.saveSignedInAccount(updatedAccount)
            refreshUserContentSyncCheckpoint()
            statusMessage = normalizedUsername == nil ? "Public username cleared." : "Public username saved."
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = error.localizedDescription
        }
    }

    var accountSyncDebugSummary: String {
        let accountText: String
        if let signedInAccount {
            accountText = "\(signedInAccount.authProvider.rawValue): \(signedInAccount.appUserID)"
        } else {
            accountText = "not signed in"
        }

        let checkpointText: String
        if let userContentSyncCheckpoint {
            checkpointText = [
                "last push: \(userContentSyncCheckpoint.lastSuccessfulPushAt?.formatted() ?? "none")",
                "last pull: \(userContentSyncCheckpoint.lastSuccessfulPullAt?.formatted() ?? "none")",
                "last error: \(userContentSyncCheckpoint.lastErrorMessage ?? "none")"
            ].joined(separator: ", ")
        } else {
            checkpointText = "none"
        }

        let backendConfiguration = PermitextBackendConfiguration.load()
        let backendBaseURL = backendConfiguration.apiBaseURLString ?? "none"
        return [
            "Account: \(accountText)",
            "Backend: \(accountBackendClient.name) (\(backendConfiguration.mode.rawValue), base URL: \(backendBaseURL))",
            "Sync checkpoint: \(checkpointText)"
        ].joined(separator: "\n")
    }

    func refreshLifetimeGrant(announcesMissingGrant: Bool = true) async {
        guard let signedInAccount else { return }
        guard !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let result = try await lifetimeGrantLookupClient.lookupLifetimeGrant(appleUserID: signedInAccount.appleUserID)
            if result.hasLifetimeGrant {
                LocalEntitlementService.setLifetimeGrant(
                    userID: result.grantedUserID ?? signedInAccount.appleUserID,
                    defaults: preferencesDefaults
                )
                statusMessage = "Lifetime Pro grant applied."
            } else if result.authoritativelyDeniesGrant && currentEntitlementSource == .lifetimeGrant {
                LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
                statusMessage = "No lifetime Pro grant found for this account."
            } else if result.authoritativelyDeniesGrant && announcesMissingGrant {
                statusMessage = "Signed in. No lifetime Pro grant found for this account."
            }
            refreshCurrentEntitlement()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func signOut(clerk: Clerk?) async {
        guard !isAccountBusy, !isStoreKitBusy else {
            statusMessage = "Finish the current account or App Store operation before signing out."
            return
        }
        accountMutationGeneration &+= 1
        clerkAuthenticationAttemptID = nil
        postClerkAuthenticationAction = .none
        isClerkAuthenticationPresented = false
        completeLocalSignOut()

        isAccountBusy = true
        defer { isAccountBusy = false }

        if let clerk {
            do {
                try await clerk.auth.signOut()
            } catch {
                do {
                    try await Clerk.clearAllKeychainItemsAndWait()
                } catch {
                    let message = "Signed out of Permitext. The previous provider session could not be cleared; reconnect and try again before signing into another account."
                    accountAuthenticationMessage = message
                    statusMessage = message
                    Self.accountAuthenticationLogger.error(
                        "Clerk sign-out and local cleanup failed: \(String(describing: error), privacy: .public)"
                    )
                }
            }
        }
    }

    func signOut() {
        guard !isStoreKitBusy else {
            statusMessage = "Finish the current App Store operation before signing out."
            return
        }
        accountMutationGeneration &+= 1
        clerkAuthenticationAttemptID = nil
        postClerkAuthenticationAction = .none
        isClerkAuthenticationPresented = false
        completeLocalSignOut()
    }

    private func completeLocalSignOut() {
        let account = signedInAccount
        stopForegroundAutomaticSync()
        signedInAccount = nil
        organizations = []
        userContentSyncConflicts = []
        Self.clearSignedInAccount()
        currentCapabilityContract = nil
        LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
        clearAccountAuthorizedStoreKitState()
        applyBackendEntitlement(nil)
        activateUserContentScope(account: nil)
        statusMessage = "Signed out."
        if let account {
            Task {
                try? await accountBackendClient.signOut(account: account)
            }
        }
    }

    var requiresSignOutConfirmation: Bool {
        pendingUserContentSyncCount > 0 || !userContentSyncConflicts.isEmpty
    }

    var hasAppleManagedBillingForAccountDeletion: Bool {
        let entitlement = entitlementService.currentEntitlement
        if entitlement.source.isAppleManagedSubscription { return true }
        return entitlement.addOns?.values.contains(where: {
            $0.source == EntitlementSource.appleSubscription.rawValue ||
                $0.source == EntitlementSource.subscription.rawValue
        }) == true
    }

    var hasWebManagedBillingForAccountDeletion: Bool {
        let entitlement = entitlementService.currentEntitlement
        if entitlement.source == .webSubscription { return true }
        return entitlement.addOns?.values.contains(where: {
            $0.source == EntitlementSource.webSubscription.rawValue
        }) == true
    }

    @discardableResult
    func deleteAccount() async -> Bool {
        guard let account = signedInAccount else { return false }
        guard !isAccountBusy else { return false }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            try await accountBackendClient.deleteAccount(account: account)
        } catch {
            statusMessage = error.localizedDescription
            return false
        }

        stopForegroundAutomaticSync()
        do {
            try userContentRepository?.deleteAllUserData()
        } catch {
            statusMessage = "Your Permitext account was deleted, but some on-device saved data could not be cleared."
        }
        accountUserDataProfiles?.removeAccountProfile(accountID: account.appUserID)
        if preferencesDefaults.string(forKey: AccountDefaults.storeKitTestOwnerUserIDKey) == account.appUserID {
            preferencesDefaults.removeObject(forKey: AccountDefaults.storeKitTestOwnerUserIDKey)
        }
        signedInAccount = nil
        organizations = []
        userContentSyncConflicts = []
        userContentSyncCheckpoint = nil
        currentCapabilityContract = nil
        Self.clearSignedInAccount()
        LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
        clearAccountAuthorizedStoreKitState()
        applyBackendEntitlement(nil)
        activateUserContentScope(account: nil)
        recentSearches = []
        pinnedSearches = []
        recentlyViewedSections = []
        preferencesDefaults.removeObject(forKey: recentSearchesDefaultsKey)
        preferencesDefaults.removeObject(forKey: pinnedSearchesDefaultsKey)
        persistRecentlyViewedSections()
        refreshBookmarks()
        refreshPendingUserContentSyncCount()
        if statusMessage?.contains("on-device") != true {
            statusMessage = "Your Permitext account and synced data were deleted."
        }
        return true
    }

    @discardableResult
    private func handleBackendSessionFailureIfNeeded(_ error: Error) -> Bool {
        guard Self.isBackendAuthenticationFailure(error) else { return false }
        stopForegroundAutomaticSync()
        signedInAccount = nil
        organizations = []
        Self.clearSignedInAccount()
        currentCapabilityContract = nil
        LocalEntitlementService.clearLifetimeGrant(defaults: preferencesDefaults)
        clearAccountAuthorizedStoreKitState()
        applyBackendEntitlement(nil)
        activateUserContentScope(account: nil)
        userContentSyncCheckpoint = nil
        userContentSyncConflicts = []
        refreshPendingUserContentSyncCount()
        statusMessage = "Your sync session expired. Sign in again to reconnect saved work."
        return true
    }

    #if DEBUG
    func runDebugRestoreCheck() async {
        refreshCurrentEntitlement()
        refreshUserContentSyncCheckpoint()
        refreshPendingUserContentSyncCount()
        let storeKitSnapshot = await storeKitSubscriptionService.snapshot()
        _ = await authorizeStoreKitSnapshot(storeKitSnapshot, allowsNewTestBinding: false)

        let accountText = signedInAccount == nil ? "account missing" : "account ok"
        let planText = currentPlan == .pro ? "Pro active" : "Free active"
        let queueText = "\(pendingUserContentSyncCount) pending"
        let checkpointText = userContentSyncCheckpoint?.lastErrorMessage == nil ? "sync ok" : "sync has error"
        let backendText: String
        do {
            let health = try await accountBackendClient.health()
            let storageText = health.storage.map { ", \($0)" } ?? ""
            backendText = health.ok ? "backend ok\(storageText)" : "backend unavailable\(storageText)"
        } catch {
            backendText = "backend failed: \(error.localizedDescription)"
        }
        statusMessage = "Restore check: \(accountText), \(planText), \(queueText), \(checkpointText), \(backendText), StoreKit \(storeKitSnapshot.debugSummary)."
    }

    func setDebugPlan(_ plan: AppPlan) {
        LocalEntitlementService.setDebugPlan(plan)
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
        statusMessage = "Plan set to \(plan.label) for local testing."
    }

    func setDebugLifetimeGrant(enabled: Bool) {
        if enabled {
            LocalEntitlementService.setLifetimeGrant(userID: "debug-lifetime-grant")
        } else {
            LocalEntitlementService.clearLifetimeGrant()
        }
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
        statusMessage = enabled ? "Lifetime Pro grant enabled for local testing." : "Lifetime Pro grant cleared."
    }
    #endif

    private func refreshCurrentEntitlement() {
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
    }

    private func applyBackendEntitlement(
        _ entitlement: AppEntitlement?,
        capabilityContract: PermitextCapabilityContract? = nil
    ) {
        if let capabilityContract {
            currentCapabilityContract = capabilityContract
        }
        let activeBackendEntitlement = entitlement.flatMap { $0.grantsPro() ? $0 : nil }
        hasActiveBackendProEntitlement = activeBackendEntitlement != nil
        if let entitlement {
            LocalEntitlementService.setEntitlement(entitlement)
        } else {
            LocalEntitlementService.clearEntitlement()
        }
        refreshCurrentEntitlement()
    }

    private func applyStoreKitSnapshot(
        _ snapshot: StoreKitSubscriptionSnapshot,
        authorizedForCurrentAccount: Bool
    ) {
        let authorizedPlan: AppPlan = authorizedForCurrentAccount ? snapshot.plan : .free
        accountAuthorizedStoreKitPlan = authorizedPlan
        activeStoreKitResearch = authorizedForCurrentAccount
            && (snapshot.plan == .pro || snapshot.researchActive)
        isStoreKitResearchActive = activeStoreKitResearch
        let entitlement = entitlementService.currentEntitlement
        let resolvedEntitlement: AppEntitlement
        if entitlement.plan == .pro {
            resolvedEntitlement = entitlement
        } else if authorizedPlan == .pro {
            resolvedEntitlement = .appleSubscriptionPro
        } else {
            resolvedEntitlement = entitlement
        }
        currentPlan = resolvedEntitlement.plan
        currentEntitlementSource = resolvedEntitlement.source
        proProductDisplayPrice = snapshot.proDisplayPrice
        researchProductDisplayPrice = snapshot.researchDisplayPrice
        storeKitLoadedProductIDs = snapshot.loadedProductIDs
        storeKitDebugSummary = snapshot.debugSummary
        storeKitTransactionEnvironment = snapshot.transactionEnvironment
    }

    private func clearAccountAuthorizedStoreKitState() {
        accountAuthorizedStoreKitPlan = .free
        activeStoreKitResearch = false
        isStoreKitResearchActive = false
    }

    @discardableResult
    private func authorizeStoreKitSnapshot(
        _ snapshot: StoreKitSubscriptionSnapshot,
        allowsNewTestBinding: Bool
    ) async -> Bool {
        let account = signedInAccount
        let boundTestUserID = preferencesDefaults.string(
            forKey: AccountDefaults.storeKitTestOwnerUserIDKey
        )
        let decision = StoreKitAccountBindingPolicy.decision(
            snapshotPlan: snapshot.plan,
            transactionEnvironment: snapshot.transactionEnvironment,
            hasSignedTransactionInfo: !(snapshot.signedTransactionInfo ?? "").isEmpty,
            signedInUserID: account?.appUserID,
            boundTestUserID: boundTestUserID,
            allowsNewTestBinding: allowsNewTestBinding
        )

        switch decision {
        case .inactive:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
            return false

        case .signInRequired:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
            statusMessage = "Sign in to the Permitext account that owns this Apple subscription, then select Restore Subscription."
            return false

        case .authorizedLocalTest:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: true)
            await storeKitSubscriptionService.finishActiveProTransactions()
            return true

        case .bindLocalTest:
            guard let account else { return false }
            preferencesDefaults.set(
                account.appUserID,
                forKey: AccountDefaults.storeKitTestOwnerUserIDKey
            )
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: true)
            await storeKitSubscriptionService.finishActiveProTransactions()
            return true

        case .explicitRestoreRequired:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
            let message = "Apple found an active test subscription. Select Restore Subscription while signed into the Permitext account that should own it."
            statusMessage = message
            storeKitOperationMessage = message
            return false

        case .ownedByAnotherAccount:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
            let message = "This Apple test subscription is linked to a different Permitext account. Sign into that account to restore Pro."
            statusMessage = message
            storeKitOperationMessage = message
            return false

        case .missingTransactionEvidence:
            applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
            let message = "Apple reported subscription status without a verifiable transaction. Select Restore Subscription and try again."
            statusMessage = message
            storeKitOperationMessage = message
            return false

        case .requiresBackendVerification:
            guard let account,
                  let signedTransactionInfo = snapshot.signedTransactionInfo,
                  !signedTransactionInfo.isEmpty
            else {
                applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
                return false
            }
            do {
                let entitlement = try await accountBackendClient.verifyAppleTransaction(
                    account: account,
                    signedTransactionInfo: signedTransactionInfo
                )
                guard signedInAccount?.appUserID == account.appUserID else {
                    throw CancellationError()
                }
                guard let entitlement, entitlement.grantsPro() else {
                    applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
                    let message = "Apple confirmed the transaction, but Pro is not active for this Permitext account."
                    statusMessage = message
                    storeKitOperationMessage = message
                    return false
                }
                applyBackendEntitlement(entitlement)
                applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: true)
                await storeKitSubscriptionService.finishActiveProTransactions()
                return true
            } catch {
                applyStoreKitSnapshot(snapshot, authorizedForCurrentAccount: false)
                if Self.isApplePurchaseOwnershipConflict(error) {
                    await storeKitSubscriptionService.finishActiveProTransactions()
                    let message = "This Apple subscription is already linked to another Permitext account. Sign into that account to use Pro."
                    statusMessage = message
                    storeKitOperationMessage = message
                    return false
                }
                if handleBackendSessionFailureIfNeeded(error) {
                    storeKitOperationMessage = "Permitext sign-in expired before the Apple transaction could be linked. Sign in and restore the subscription."
                    return false
                }
                let message = "Apple confirmed the purchase, but Permitext could not link it yet: \(error.localizedDescription) Select Restore Subscription to retry."
                statusMessage = message
                storeKitOperationMessage = message
                return false
            }
        }
    }

    private func storeKitAppAccountToken(for appUserID: String) -> UUID {
        let accountDigest = SHA256.hash(data: Data(appUserID.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        let key = AccountDefaults.storeKitAppAccountTokenPrefix + accountDigest
        if let storedValue = preferencesDefaults.string(forKey: key),
           let storedToken = UUID(uuidString: storedValue) {
            return storedToken
        }
        let token = UUID()
        preferencesDefaults.set(token.uuidString, forKey: key)
        return token
    }

    private static func isApplePurchaseOwnershipConflict(_ error: Error) -> Bool {
        guard let backendError = error as? PermitextBackendHTTPError,
              backendError.statusCode == 409,
              let serverMessage = backendError.serverMessage?.lowercased()
        else { return false }
        return serverMessage.contains("apple purchase")
            && serverMessage.contains("another permitext account")
    }

    private static func isBackendAuthenticationFailure(_ error: Error) -> Bool {
        guard let backendError = error as? PermitextBackendHTTPError else { return false }
        return backendError.isAuthenticationFailure
    }

    private static func isBackendAuthenticationFailureMessage(_ message: String) -> Bool {
        let lowercased = message.lowercased()
        return lowercased.contains("session")
            || lowercased.contains("sign in")
            || lowercased.contains("unauthorized")
            || lowercased.contains("forbidden")
    }

    private static func loadSignedInAccount() -> SignedInAccount? {
        guard let data = UserDefaults.standard.data(forKey: AccountDefaults.signedInAccountKey) else { return nil }
        guard let account = try? JSONDecoder().decode(SignedInAccount.self, from: data) else { return nil }
        var token = AccountSessionTokenStore.loadToken(accountUserID: account.appUserID)
        if token == nil,
           let legacyToken = account.backendSessionToken,
           !legacyToken.isEmpty,
           AccountSessionTokenStore.saveToken(legacyToken, accountUserID: account.appUserID) {
            token = legacyToken
            if let sanitizedData = try? JSONEncoder().encode(
                SignedInAccountPersistence.removingBackendSessionToken(from: account)
            ) {
                UserDefaults.standard.set(sanitizedData, forKey: AccountDefaults.signedInAccountKey)
            }
        }
        return SignedInAccount(
            appUserID: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            appleUserID: account.appleUserID,
            email: account.email,
            publicUsername: account.publicUsername,
            displayName: account.displayName,
            signedInAt: account.signedInAt,
            migrationState: account.migrationState,
            backendSessionToken: token ?? account.backendSessionToken
        )
    }

    private static func saveSignedInAccount(_ account: SignedInAccount) {
        guard AccountSessionTokenStore.saveToken(
            account.backendSessionToken,
            accountUserID: account.appUserID
        ) else { return }
        let persistedAccount = SignedInAccountPersistence.removingBackendSessionToken(from: account)
        if let data = try? JSONEncoder().encode(persistedAccount) {
            UserDefaults.standard.set(data, forKey: AccountDefaults.signedInAccountKey)
        }
    }

    private static func clearSignedInAccount() {
        if let account = loadSignedInAccount() {
            AccountSessionTokenStore.deleteToken(accountUserID: account.appUserID)
        }
        UserDefaults.standard.removeObject(forKey: AccountDefaults.signedInAccountKey)
    }

    private func bookmarkCountForEntitlements() throws -> Int {
        try userContentRepository?.totalBookmarkCount() ?? bookmarkedSectionIDs.count
    }

    private func noteCountForEntitlements() throws -> Int {
        try userContentRepository?.totalNoteCount() ?? bookmarks.filter(\.hasNote).count
    }

    private func folderCountForEntitlements() throws -> Int {
        try userContentRepository?.totalFolderCount() ?? folders.count
    }

    func removeSections(_ sections: [BookmarkedSection], fromFolder folderID: Int64) {
        guard !sections.isEmpty, let userContentRepository else { return }
        var removedAnySection = false
        var firstError: Error?

        for section in sections {
            do {
                try userContentRepository.removeSection(
                    section.id,
                    fromFolder: folderID,
                    codeVersion: section.codeVersion
                )
                removedAnySection = true
            } catch {
                if firstError == nil {
                    firstError = error
                }
            }
        }

        if removedAnySection {
            // Publish the final collection once so Project evidence rows keep
            // stable identities instead of disappearing through intermediate
            // account-wide rebuilds while a multi-selection is removed.
            refreshFolders()
            scheduleUserContentAutoSync()
        }
        if let firstError {
            statusMessage = firstError.localizedDescription
        }
    }

    // MARK: - PDF export

    /// Kicks off an async PDF build for the supplied subset of bookmarks.
    /// The caller (BookmarksView) decides what to pass — e.g. the currently
    /// filtered list, all bookmarks, or one folder's contents. State
    /// transitions via `exportState`; the view subscribes for progress
    /// and the final URL.
    func startBookmarkExport(
        bookmarks selection: [BookmarkedSection],
        contextLabel: String?
    ) {
        guard !selection.isEmpty else {
            exportState = .failed("No saved sections to export.")
            return
        }
        guard !denyIfNeeded(entitlementService.canUse(.premiumExports)) else {
            exportState = .idle
            return
        }
        activeExportTask?.cancel()
        exportState = .building(progress: 0, sectionTitle: "Preparing…")

        let codeSectionNameMap: [Int64: String] = Dictionary(
            uniqueKeysWithValues: codeSections.map { ($0.id, $0.name) }
        )
        let codeVersionLabel = selectedVersion.map { Self.displayName(forLibraryName: $0.codeVersion) }
            ?? "NYC Construction Codes"

        // Snapshot bookmarks + lookup so the detached body has no
        // MainActor-isolated references.
        let bookmarksSnapshot = selection
        let context = contextLabel

        // We need an MainActor-safe loader that the detached builder can
        // invoke. loadSectionDetailAsync hops through Task.detached inside
        // already, so this hop is cheap.
        let loader: @Sendable (Int64) async -> String? = { [weak self] sectionID in
            guard let self else { return nil }
            let detail = await self.loadSectionDetailAsync(sectionID: sectionID)
            return detail?.officialText
        }

        let updateExportState: @MainActor @Sendable (BookmarkExportState) -> Void = { [weak self] state in
            self?.exportState = state
        }

        activeExportTask = Task { [weak self] in
            let builder = BookmarkExportBuilder(
                bookmarks: bookmarksSnapshot,
                codeSectionNames: codeSectionNameMap,
                metadata: .init(
                    codeVersionLabel: codeVersionLabel,
                    exportContext: context,
                    exportDate: Date()
                ),
                loadFullBody: loader,
                onProgress: { current, total in
                    let progress = Double(current) / Double(max(total, 1))
                    let title = bookmarksSnapshot.indices.contains(current - 1)
                        ? bookmarksSnapshot[current - 1].displayTitle
                        : "Building PDF…"
                    await updateExportState(.building(progress: progress, sectionTitle: title))
                }
            )
            do {
                let url = try await Task.detached(priority: .userInitiated) {
                    try await builder.build()
                }.value
                await MainActor.run {
                    self?.exportState = .ready(url: url, sectionCount: bookmarksSnapshot.count)
                }
            } catch is CancellationError {
                await MainActor.run { self?.exportState = .idle }
            } catch let error as BookmarkExportBuilder.BuildError {
                await MainActor.run {
                    self?.exportState = .failed(error.localizedDescription)
                }
            } catch {
                await MainActor.run {
                    self?.exportState = .failed(error.localizedDescription)
                }
            }
        }
    }

    /// Cancels an in-flight export. The progress sheet uses this when the
    /// user taps Cancel.
    func cancelBookmarkExport() {
        activeExportTask?.cancel()
        activeExportTask = nil
        exportState = .idle
    }

    /// Resets export state after the share sheet dismisses so the sheet
    /// won't be re-presented by SwiftUI on the next state change.
    func clearBookmarkExportState() {
        activeExportTask = nil
        exportState = .idle
    }

    /// Wipes every folder + membership row. Wired into the existing Settings
    /// clear-data flow so users can reset their organization without losing
    /// the underlying bookmarks.
    func clearAllFolders() {
        guard let userContentRepository else { return }
        do {
            try userContentRepository.clearAllFolders()
            refreshFolders()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    @discardableResult
    func toggleBookmark(sectionID: Int64) -> Bool {
        guard let selectedVersion, let userContentRepository else { return false }
        let wasBookmarked = bookmarkedSectionIDs.contains(sectionID)
        if !wasBookmarked, currentPlan != .pro {
            do {
                let bookmarkCount = try bookmarkCountForEntitlements()
                guard !denyIfNeeded(entitlementService.canCreateSavedSection(currentCount: bookmarkCount)) else {
                    return false
                }
            } catch {
                statusMessage = error.localizedDescription
                return false
            }
        }

        let previousBookmarkedSectionIDs = bookmarkedSectionIDs
        let previousBookmarks = bookmarks
        let previousFolderMembership = folderMembership
        let previousProjectBookmarks = projectBookmarksByFolderID
        let previousProjectCounts = projectEvidenceRecordCountByFolderID
        let newState = !wasBookmarked
        applyOptimisticBookmarkState(
            sectionID: sectionID,
            isBookmarked: newState,
            codeVersion: selectedVersion.codeVersion
        )

        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(
            .begin,
            log: AppSignpost.reader,
            name: "bookmarkMutation",
            signpostID: signpostID,
            "sectionID=%{public}lld",
            sectionID
        )
        defer {
            os_signpost(
                .end,
                log: AppSignpost.reader,
                name: "bookmarkMutation",
                signpostID: signpostID
            )
        }

        do {
            try userContentRepository.toggleBookmark(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)
            scheduleProjectPresentationRefresh()
            scheduleUserContentAutoSync()
            NotificationCenter.default.post(name: .permitextSavedWorkDidChange, object: self)
            return newState
        } catch {
            bookmarkedSectionIDs = previousBookmarkedSectionIDs
            bookmarks = previousBookmarks
            folderMembership = previousFolderMembership
            projectBookmarksByFolderID = previousProjectBookmarks
            projectEvidenceRecordCountByFolderID = previousProjectCounts
            bookmarkRevision &+= 1
            statusMessage = error.localizedDescription
            return bookmarkedSectionIDs.contains(sectionID)
        }
    }

    private func applyOptimisticBookmarkState(
        sectionID: Int64,
        isBookmarked: Bool,
        codeVersion: String
    ) {
        if isBookmarked {
            bookmarkedSectionIDs.insert(sectionID)
        } else {
            bookmarkedSectionIDs.remove(sectionID)
        }

        let newSectionRow: BookmarkedSection?
        if isBookmarked,
           let detail = loadSectionDetail(sectionID: sectionID) {
            newSectionRow = BookmarkedSection(
                id: detail.id,
                codeVersion: codeVersion,
                codeSectionID: detail.codeSectionID,
                codeSectionName: codeSectionName(id: detail.codeSectionID),
                chapterNumber: detail.chapterNumber,
                chapterTitle: detail.chapterTitle,
                sectionNumber: detail.sectionNumber,
                title: detail.title,
                previewText: detail.officialText.evidenceExcerpt(
                    sectionNumber: detail.sectionNumber,
                    title: detail.title
                ),
                kind: detail.kind,
                isBookmarked: true,
                bookmarkedAt: Date()
            )
        } else {
            newSectionRow = nil
        }

        bookmarks = BookmarkPresentationReducer.updatedRows(
            bookmarks,
            sectionID: sectionID,
            isBookmarked: isBookmarked,
            newSectionRow: newSectionRow
        )
        bookmarks = BookmarkSorter.sorted(
            bookmarks,
            mode: .codeOrder,
            codeSectionName: { [weak self] codeSectionID in
                self?.codeSectionName(id: codeSectionID) ?? ""
            }
        )

        if !isBookmarked {
            let affectedFolderIDs = folderMembership.removeValue(forKey: sectionID) ?? []
            for folderID in affectedFolderIDs {
                projectBookmarksByFolderID[folderID]?.removeAll { $0.id == sectionID }
                projectEvidenceRecordCountByFolderID[folderID] = projectBookmarksByFolderID[folderID]?.count ?? 0
            }
        }
        bookmarkRevision &+= 1
    }

    func isBookmarked(sectionID: Int64) -> Bool {
        guard selectedVersion != nil, userContentRepository != nil else { return false }
        return bookmarkedSectionIDs.contains(sectionID)
    }

    func noteBody(sectionID: Int64) -> String {
        guard let selectedVersion, let userContentRepository else { return "" }
        return (try? userContentRepository.noteBody(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)) ?? ""
    }

    func noteBody(sectionID: Int64, blockID: String) -> String {
        guard let selectedVersion, let userContentRepository else { return "" }
        return (try? userContentRepository.noteBody(sectionID: sectionID, blockID: blockID, codeVersion: selectedVersion.codeVersion)) ?? ""
    }

    func noteBlockIDs(sectionID: Int64) -> [String] {
        guard let selectedVersion, let userContentRepository else { return [] }
        return (try? userContentRepository.noteBlockIDs(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)) ?? []
    }

    @discardableResult
    func saveNote(sectionID: Int64, body: String) -> NoteSaveResult {
        saveNote(sectionID: sectionID, blockID: "", body: body)
    }

    @discardableResult
    func saveNote(sectionID: Int64, blockID: String, body: String) -> NoteSaveResult {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let selectedVersion, let userContentRepository else {
            let message = "The note could not be saved because code content is unavailable."
            statusMessage = message
            return .failed(persistedBody: "", message: message)
        }
        do {
            let trimmedBody = body.trimmingCharacters(in: .whitespacesAndNewlines)
            let existingBody = try userContentRepository.noteBody(sectionID: sectionID, blockID: normalizedBlockID, codeVersion: selectedVersion.codeVersion)
            if !trimmedBody.isEmpty && existingBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let noteCount = try noteCountForEntitlements()
                guard !denyIfNeeded(entitlementService.canCreateNote(currentCount: noteCount)) else {
                    return .failed(
                        persistedBody: existingBody,
                        message: statusMessage ?? "The note was not saved."
                    )
                }
            }
            // Persist every edit immediately, but debounce the heavier Saved
            // and Project evidence rebuild until typing pauses. This keeps
            // visible rows, counts, previews, and Reader decorations current
            // without rebuilding them for every keystroke.
            try userContentRepository.saveNote(sectionID: sectionID, blockID: normalizedBlockID, codeVersion: selectedVersion.codeVersion, body: body)
            scheduleSavedPresentationRefresh()
            scheduleUserContentAutoSync()
            return .saved
        } catch {
            statusMessage = error.localizedDescription
            let persistedBody = (try? userContentRepository.noteBody(
                sectionID: sectionID,
                blockID: normalizedBlockID,
                codeVersion: selectedVersion.codeVersion
            )) ?? ""
            return .failed(persistedBody: persistedBody, message: error.localizedDescription)
        }
    }

    func clearAllBookmarks() {
        guard let userContentRepository else { return }
        do {
            try userContentRepository.clearAllBookmarks()
            refreshBookmarks()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func clearAllNotes() {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.clearNotes(codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func openSelectedContent() {
        contentLoadTask?.cancel()
        startupWarmupTask?.cancel()
        clearCaches()
        isInitialContentLoaded = false
        initialLoadProgress = 0
        guard let selectedVersion else {
            codeSections = []
            selectedCodeSectionID = nil
            chapters = []
            searchResults = []
            bookmarks = []
            codeDatabase = nil
            authoredCodeStore = nil
            statusMessage = "Bundle authored content or a generated SQLite database to browse code content."
            initialLoadProgress = 1
            isInitialContentLoaded = true
            return
        }

        searchResults = []
        bookmarks = []
        statusMessage = "Loading \(selectedVersion.displayName)..."

        switch selectedVersion.contentKind {
        case .sqlite:
            authoredCodeStore = nil
            codeSections = []
            selectedCodeSectionID = nil
            contentLoadTask = Task {
                do {
                    let snapshot = try await Task.detached(priority: .userInitiated) {
                        try Self.loadSQLiteContentSnapshot(version: selectedVersion)
                    }.value
                    guard !Task.isCancelled else { return }

                    self.codeDatabase = snapshot.database
                    self.sqliteChapterLoader = snapshot.loader
                    self.initialLoadProgress = 0.35
                    self.chapters = snapshot.chapters
                    self.refreshBookmarks()
                    self.preloadLastOpenedChapterIfNeeded()
                    self.statusMessage = nil
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                    self.startupWarmupTask = Task { [weak self] in
                        guard let self else { return }
                        await self.prewarmSQLiteContent(chapters: snapshot.chapters)
                    }
                } catch {
                    guard !Task.isCancelled else { return }
                    self.codeSections = []
                    self.selectedCodeSectionID = nil
                    self.chapters = []
                    self.searchResults = []
                    self.bookmarks = []
                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = nil
                    self.statusMessage = error.localizedDescription
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                }
            }
        case .authored:
            let selectedCodeSectionID = self.selectedCodeSectionID
                ?? storedCodeSectionID()
            contentLoadTask = Task {
                do {
                    let snapshot = try await Task.detached(priority: .userInitiated) {
                        try Self.loadAuthoredContentSnapshot(
                            version: selectedVersion,
                            selectedCodeSectionID: selectedCodeSectionID
                        )
                    }.value
                    guard !Task.isCancelled else { return }

                    self.initialLoadProgress = 0.35
                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = snapshot.store
                    self.codeSections = snapshot.codeSections
                    self.selectedCodeSectionID = snapshot.resolvedCodeSectionID
                    self.chapters = snapshot.chapters
                    self.searchResults = []
                    self.refreshBookmarks()
                    self.preloadLastOpenedChapterIfNeeded()
                    self.statusMessage = nil
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                    self.startupWarmupTask = Task { [weak self] in
                        guard let self else { return }
                        await self.prewarmAuthoredContent(
                            version: selectedVersion,
                            chapters: snapshot.chapters,
                            store: snapshot.store
                        )
                    }
                } catch {
                    guard !Task.isCancelled else { return }
                    self.codeSections = []
                    self.selectedCodeSectionID = nil
                    self.chapters = []
                    self.searchResults = []
                    self.bookmarks = []
                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = nil
                    self.statusMessage = error.localizedDescription
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                }
            }
        }
    }

    private nonisolated static func loadSQLiteContentSnapshot(
        version: BundledCodeVersion
    ) throws -> SQLiteContentSnapshot {
        let database = try CodeDatabase(databaseURL: version.fileURL, locator: BundleDatabaseLocator())
        let loader = try SQLiteChapterLoader(databaseURL: version.fileURL)
        let chapters = try database.chapters()
        return SQLiteContentSnapshot(database: database, loader: loader, chapters: chapters)
    }

    private nonisolated static func loadAuthoredContentSnapshot(
        version: BundledCodeVersion,
        selectedCodeSectionID: Int64?
    ) throws -> AuthoredContentSnapshot {
        let store = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let availableCodeSections = store.codeSections()
        let resolvedCodeSectionID = availableCodeSections.contains(where: { $0.id == selectedCodeSectionID })
            ? selectedCodeSectionID
            : availableCodeSections.first?.id
        let authoredChapters = store.chapters(codeSectionID: resolvedCodeSectionID)
        let chapters = authoredChapters + Self.htmlOnlyAppendixChapters(
            version: version,
            codeSectionID: resolvedCodeSectionID,
            existingChapters: authoredChapters
        )
        return AuthoredContentSnapshot(
            store: store,
            codeSections: Self.sortedCodeSections(availableCodeSections),
            resolvedCodeSectionID: resolvedCodeSectionID,
            chapters: chapters
        )
    }

    private func storedCodeSectionID() -> Int64? {
        continuityStore.load().selectedCodeSectionID
    }

    private nonisolated static func inlineHTMLTextBlock(
        html: String,
        fallbackText: String,
        theme: ReaderTheme
    ) -> NSAttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = theme.lineSpacing
        paragraphStyle.paragraphSpacing = min(theme.paragraphSpacing, 4)

        let baseAttributes: [NSAttributedString.Key: Any] = [
            .font: theme.bodyFont,
            .foregroundColor: UIColor.label,
            .paragraphStyle: paragraphStyle
        ]
        let attributed = NSMutableAttributedString(string: "", attributes: baseAttributes)
        var styleStack: [(bold: Bool, italic: Bool)] = [(false, false)]
        var cursor = html.startIndex

        while cursor < html.endIndex {
            guard let tagRange = html.range(of: #"<[^>]+>"#, options: .regularExpression, range: cursor..<html.endIndex) else {
                appendHTMLText(String(html[cursor..<html.endIndex]), to: attributed, style: styleStack.last ?? (false, false), theme: theme, paragraphStyle: paragraphStyle)
                break
            }

            appendHTMLText(String(html[cursor..<tagRange.lowerBound]), to: attributed, style: styleStack.last ?? (false, false), theme: theme, paragraphStyle: paragraphStyle)
            let tag = String(html[tagRange])
            let lowercasedTag = tag.lowercased()

            if lowercasedTag.hasPrefix("<br") || lowercasedTag.hasPrefix("</div") || lowercasedTag.hasPrefix("</p") || lowercasedTag.hasPrefix("</li") {
                appendNewlineIfNeeded(to: attributed, attributes: baseAttributes)
            } else if lowercasedTag.hasPrefix("<b") || lowercasedTag.hasPrefix("<strong") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((true, current.italic))
            } else if lowercasedTag.hasPrefix("</b") || lowercasedTag.hasPrefix("</strong") {
                if styleStack.count > 1 { styleStack.removeLast() }
            } else if lowercasedTag.hasPrefix("<i") || lowercasedTag.hasPrefix("<em") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((current.bold, true))
            } else if lowercasedTag.hasPrefix("</i") || lowercasedTag.hasPrefix("</em") {
                if styleStack.count > 1 { styleStack.removeLast() }
            } else if lowercasedTag.contains("font-weight: bold") || lowercasedTag.contains("font-weight:bold") || lowercasedTag.contains("font-style: italic") || lowercasedTag.contains("font-style:italic") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((
                    current.bold || lowercasedTag.contains("font-weight: bold") || lowercasedTag.contains("font-weight:bold"),
                    current.italic || lowercasedTag.contains("font-style: italic") || lowercasedTag.contains("font-style:italic")
                ))
            } else if lowercasedTag.hasPrefix("</span") {
                if styleStack.count > 1 { styleStack.removeLast() }
            }

            cursor = tagRange.upperBound
        }

        normalizeInlineHTMLAttributedText(in: attributed)
        trimWhitespace(in: attributed)
        if attributed.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            attributed.append(NSAttributedString(string: fallbackText, attributes: baseAttributes))
        }
        return attributed
    }

    private nonisolated static func appendHTMLText(
        _ rawText: String,
        to attributed: NSMutableAttributedString,
        style: (bold: Bool, italic: Bool),
        theme: ReaderTheme,
        paragraphStyle: NSParagraphStyle
    ) {
        let decoded = decodeInlineHTMLEntities(rawText)
            .replacingOccurrences(of: #"\r\n?"#, with: "\n", options: .regularExpression)
            .replacingOccurrences(of: #"\n+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[ \t\f]+"#, with: " ", options: .regularExpression)
        guard !decoded.isEmpty else { return }

        let font: UIFont
        if style.bold && style.italic,
           let descriptor = theme.boldFont.fontDescriptor.withSymbolicTraits([.traitBold, .traitItalic]) {
            font = UIFont(descriptor: descriptor, size: theme.fontSize)
        } else if style.bold {
            font = theme.boldFont
        } else if style.italic {
            font = theme.italicFont
        } else {
            font = theme.bodyFont
        }

        attributed.append(
            NSAttributedString(
                string: decoded,
                attributes: [
                    .font: font,
                    .foregroundColor: UIColor.label,
                    .paragraphStyle: paragraphStyle
                ]
            )
        )
    }

    private nonisolated static func normalizeInlineHTMLAttributedText(
        in attributed: NSMutableAttributedString
    ) {
        let fullRange = NSRange(location: 0, length: attributed.length)
        guard fullRange.length > 0 else { return }

        let replacements: [(pattern: String, template: String)] = [
            (#"[ \t]+\n"#, "\n"),
            (#"\n{3,}"#, "\n\n"),
            (#"\n([\.\,\;\:\)])"#, "$1"),
            (#"([\(])\n"#, "$1"),
            (#"([^\n])\n([a-z0-9])"#, "$1 $2"),
            (#" {2,}"#, " ")
        ]

        for (pattern, template) in replacements {
            guard let expression = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            expression.replaceMatches(
                in: attributed.mutableString,
                options: [],
                range: NSRange(location: 0, length: attributed.length),
                withTemplate: template
            )
        }
    }

    private nonisolated static func appendNewlineIfNeeded(
        to attributed: NSMutableAttributedString,
        attributes: [NSAttributedString.Key: Any]
    ) {
        guard !attributed.string.hasSuffix("\n") else { return }
        attributed.append(NSAttributedString(string: "\n", attributes: attributes))
    }

    private nonisolated static func decodeInlineHTMLEntities(_ text: String) -> String {
        var decoded = text
        let replacements = [
            "&nbsp;": " ",
            "&#160;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#39;": "'",
            "&#176;": "°",
            "&#8211;": "-",
            "&#8212;": "-",
            "&#8216;": "'",
            "&#8217;": "'",
            "&#8220;": "\"",
            "&#8221;": "\""
        ]
        for (entity, replacement) in replacements {
            decoded = decoded.replacingOccurrences(of: entity, with: replacement)
        }
        return decoded
    }

    private nonisolated static func trimWhitespace(in attributed: NSMutableAttributedString) {
        while attributed.length > 0,
              let first = attributed.string.first,
              first.isWhitespace {
            attributed.deleteCharacters(in: NSRange(location: 0, length: 1))
        }
        while attributed.length > 0,
              let last = attributed.string.last,
              last.isWhitespace {
            attributed.deleteCharacters(in: NSRange(location: attributed.length - 1, length: 1))
        }
    }

    private nonisolated static func htmlOnlyAppendixChapters(
        version: BundledCodeVersion,
        codeSectionID: Int64?,
        existingChapters: [CodeChapter]
    ) -> [CodeChapter] {
        guard let authoredHTMLBundlePath = version.authoredHTMLBundlePath else { return [] }

        let existingNumbers = Set(existingChapters.map { $0.chapterNumber.uppercased() })
        let chaptersURL = version.fileURL
            .deletingLastPathComponent()
            .appendingPathComponent("chapters", isDirectory: true)
        guard let chapterURLs = try? FileManager.default.contentsOfDirectory(
            at: chaptersURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            _ = authoredHTMLBundlePath
            return []
        }

        return chapterURLs.compactMap { url -> CodeChapter? in
            guard url.pathExtension.lowercased() == "html" else { return nil }
            let chapterNumber = url.deletingPathExtension().lastPathComponent.uppercased()
            guard chapterNumber.rangeOfCharacter(from: .letters) != nil,
                  existingNumbers.contains(chapterNumber) == false
            else {
                return nil
            }

            return CodeChapter(
                id: Self.syntheticChapterID(for: chapterNumber),
                codeSectionID: codeSectionID,
                chapterNumber: chapterNumber,
                title: Self.htmlChapterTitle(in: url, chapterNumber: chapterNumber)
            )
        }
        .sorted {
            $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private nonisolated static func syntheticChapterID(for chapterNumber: String) -> Int64 {
        let value = chapterNumber.unicodeScalars.reduce(Int64(0)) { partial, scalar in
            partial * 31 + Int64(scalar.value)
        }
        return -1_000_000 - value
    }

    private nonisolated static func slug(_ value: String) -> String {
        let lowercased = value.lowercased()
        let replaced = lowercased.replacingOccurrences(
            of: #"[^a-z0-9]+"#,
            with: "-",
            options: .regularExpression
        )
        return replaced.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    private nonisolated static func syntheticSectionID(for chapterNumber: String, sectionNumber: String) -> Int64 {
        let value = "\(chapterNumber):\(sectionNumber)".unicodeScalars.reduce(Int64(0)) { partial, scalar in
            partial * 31 + Int64(scalar.value)
        }
        return -2_000_000 - value
    }

    private nonisolated static func htmlChapterTitle(in url: URL, chapterNumber: String) -> String {
        guard let html = try? String(contentsOf: url, encoding: .utf8),
              let expression = try? NSRegularExpression(
                pattern: #"<div\s+id="[^"]+"[^>]*class="[^"]*Subarticle[^"]*"[^>]*>.*?<h6[^>]*>(.*?)</h6>"#,
                options: [.caseInsensitive, .dotMatchesLineSeparators]
              )
        else {
            return "Appendix \(chapterNumber)"
        }

        let nsHTML = html as NSString
        let range = NSRange(location: 0, length: nsHTML.length)
        guard let match = expression.firstMatch(in: html, range: range),
              match.numberOfRanges > 1
        else {
            return "Appendix \(chapterNumber)"
        }

        let heading = nsHTML.substring(with: match.range(at: 1))
            .replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"^#-+\s*"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let appendixPrefix = "Appendix \(chapterNumber)"
        if heading.localizedCaseInsensitiveCompare(appendixPrefix) == .orderedSame {
            return appendixPrefix
        }
        if heading.lowercased().hasPrefix((appendixPrefix + ":").lowercased()) {
            return heading
                .dropFirst((appendixPrefix + ":").count)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return heading
    }

    private func prewarmAuthoredContent(
        version: BundledCodeVersion,
        chapters: [CodeChapter],
        store: AuthoredCodeStore
    ) async {
        let signpostID = OSSignpostID(log: AppSignpost.startup)
        let beganAt = ProcessInfo.processInfo.systemUptime
        os_signpost(
            .begin,
            log: AppSignpost.startup,
            name: "backgroundWarmup",
            signpostID: signpostID,
            "%{public}s",
            "authored"
        )
        defer {
            let elapsedMilliseconds = max(
                0,
                Int((ProcessInfo.processInfo.systemUptime - beganAt) * 1_000)
            )
            os_signpost(
                .end,
                log: AppSignpost.startup,
                name: "backgroundWarmup",
                signpostID: signpostID,
                "authored milliseconds=%{public}d",
                elapsedMilliseconds
            )
            os_log(
                .info,
                log: AppSignpost.startup,
                "backgroundWarmup authored milliseconds=%{public}d",
                elapsedMilliseconds
            )
        }
        _ = version
        // Warm the search index in the background so the first search doesn't
        // pay the cost of reading + JSON-decoding the 3 MB searchIndex.json on
        // the user's first keystroke.
        await Task.detached(priority: .background) {
            store.warmSearchIndex()
        }.value

        await prewarmStartupPriorityChapters(chapters)
        // Do not sweep the first section of every chapter here. Missing prepared
        // blocks can make that background pass synthesize whole-chapter HTML,
        // keeping the app CPU-bound long after its first usable content appears.
    }

    private func prewarmSQLiteContent(chapters: [CodeChapter]) async {
        let signpostID = OSSignpostID(log: AppSignpost.startup)
        let beganAt = ProcessInfo.processInfo.systemUptime
        os_signpost(
            .begin,
            log: AppSignpost.startup,
            name: "backgroundWarmup",
            signpostID: signpostID,
            "%{public}s",
            "sqlite"
        )
        defer {
            let elapsedMilliseconds = max(
                0,
                Int((ProcessInfo.processInfo.systemUptime - beganAt) * 1_000)
            )
            os_signpost(
                .end,
                log: AppSignpost.startup,
                name: "backgroundWarmup",
                signpostID: signpostID,
                "sqlite milliseconds=%{public}d",
                elapsedMilliseconds
            )
            os_log(
                .info,
                log: AppSignpost.startup,
                "backgroundWarmup sqlite milliseconds=%{public}d",
                elapsedMilliseconds
            )
        }
        await prewarmStartupPriorityChapters(chapters)

        guard let sqliteChapterLoader else { return }
        do {
            let sectionIDs = try await sqliteChapterLoader.firstSectionIDs(chapterIDs: chapters.map(\.id))
            await prewarmSectionDetails(sectionIDs)
        } catch {
            #if DEBUG
            print("permitext diagnostics: SQLite startup warmup failed: \(error.localizedDescription)")
            #endif
        }
    }

    private func prewarmStartupPriorityChapters(_ chapters: [CodeChapter]) async {
        let prioritized = startupPriorityChapters(from: chapters)
        guard !prioritized.isEmpty else { return }

        for chapter in prioritized {
            if Task.isCancelled { return }
            await warmChapterReaderEntry(chapter: chapter, sectionLimit: 8)
            if !isInitialContentLoaded {
                initialLoadProgress = min(0.72, initialLoadProgress + 0.04)
            }
            await Task.yield()
        }
    }

    private func startupPriorityChapters(from chapters: [CodeChapter]) -> [CodeChapter] {
        guard !chapters.isEmpty else { return [] }

        var prioritized: [CodeChapter] = []
        let lastOpenedChapterID = continuityStore.load().lastOpenedChapterID

        func append(_ chapter: CodeChapter?) {
            guard let chapter,
                  prioritized.contains(where: { $0.id == chapter.id }) == false
            else {
                return
            }
            prioritized.append(chapter)
        }

        append(chapters.first { $0.id == lastOpenedChapterID })
        append(chapters.first)
        for chapter in chapters.prefix(4) {
            append(chapter)
        }

        return prioritized
    }

    private func warmChapterReaderEntry(chapter: CodeChapter, sectionLimit: Int) async {
        if let htmlTarget = authoredHTMLWarmupTarget(for: chapter) {
            await Task.detached(priority: .utility) {
                PreparedChapterHTMLCache.preload(
                    chapterURL: htmlTarget.chapterURL,
                    readAccessURL: htmlTarget.readAccessURL
                )
                _ = PublishedHTMLContentStore.anchors(in: htmlTarget.chapterURL)
            }.value
        }

        let descriptors = await chapterBlockDescriptors(for: chapter)
        guard !descriptors.isEmpty else {
            warmedChapterIDs.insert(chapter.id)
            return
        }

        let sectionIDs = Array(descriptors.prefix(sectionLimit).map(\.sectionID))
        let details = await loadSectionDetailsAsync(sectionIDs: sectionIDs)

        if authoredHTMLWarmupTarget(for: chapter) == nil {
            for detail in details {
                if Task.isCancelled { return }
                _ = await chapterBodyNSTextAsync(for: detail)
            }
        }

        warmedChapterIDs.insert(chapter.id)
    }

    private func authoredHTMLWarmupTarget(for chapter: CodeChapter) -> (chapterURL: URL, readAccessURL: URL)? {
        guard selectedVersion?.contentKind == .authored else { return nil }
        let htmlStore = authoredHTMLStore(for: chapter)
        guard let chapterURL = htmlStore.chapterURL(chapterNumber: chapter.chapterNumber),
              let readAccessURL = htmlStore.readAccessURL()
        else {
            return nil
        }
        return (chapterURL, readAccessURL)
    }

    private func prewarmSectionDetails(_ sectionIDs: [Int64]) async {
        guard !sectionIDs.isEmpty else { return }

        let batchSize = 24
        let total = max(sectionIDs.count, 1)
        var loadedCount = 0
        for startIndex in stride(from: 0, to: sectionIDs.count, by: batchSize) {
            if Task.isCancelled { return }
            let endIndex = min(startIndex + batchSize, sectionIDs.count)
            let batch = Array(sectionIDs[startIndex..<endIndex])
            _ = await loadSectionDetailsAsync(sectionIDs: batch)
            loadedCount += batch.count
            let progress = Double(loadedCount) / Double(total)
            if !isInitialContentLoaded {
                initialLoadProgress = min(0.9, 0.55 + (progress * 0.35))
            }
            await Task.yield()
        }
    }

    private func formattedNSAttributedText(for detail: ReaderSectionDetail) -> NSAttributedString {
        NSAttributedString(Self.formattedText(detail: detail, theme: readerTheme))
    }

    private nonisolated static func chapterBodyText(detail: ReaderSectionDetail, theme: ReaderTheme) -> AttributedString {
        let formatted = formattedText(detail: detail, theme: theme)
        let attributed = NSAttributedString(formatted)
        let bodyRange = chapterBodyRange(for: detail, in: attributed.string as NSString)

        guard bodyRange.length > 0 else {
            return AttributedString(fallbackChapterBodyText(for: detail, formattedText: attributed))
        }

        return AttributedString(attributed.attributedSubstring(from: bodyRange))
    }

    private nonisolated static let sharedFormattingEngine = FormattingEngine()

    private nonisolated static func formattedText(detail: ReaderSectionDetail, theme: ReaderTheme) -> AttributedString {
        let formattingEngine = sharedFormattingEngine
        if let richTextOverrideData = detail.richTextOverrideData,
           let richText = formattingEngine.renderRichTextOverride(
            richTextOverrideData,
            theme: theme
           ) {
            return richText
        }

        return formattingEngine.render(
            officialText: detail.officialText,
            spans: detail.textSpans,
            theme: theme
        )
    }

    private nonisolated static func chapterBodyRange(for detail: ReaderSectionDetail, in text: NSString) -> NSRange {
        guard text.length > 0 else {
            return NSRange(location: 0, length: 0)
        }

        var location = 0

        while location < text.length {
            let lineRange = text.lineRange(for: NSRange(location: location, length: 0))
            let trimmedLine = trimmedLine(for: lineRange, in: text)

            if trimmedLine.isEmpty || isSectionMetadataLine(trimmedLine) {
                location = lineRange.location + lineRange.length
                continue
            }

            if isNumberedTitleLine(trimmedLine, detail: detail) {
                location = lineRange.location + lineRange.length
                continue
            }

            break
        }

        while location < text.length {
            let character = text.substring(with: NSRange(location: location, length: 1))
            if character.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                location += 1
            } else {
                break
            }
        }

        return NSRange(location: location, length: max(text.length - location, 0))
    }

    private nonisolated static func trimmedLine(for lineRange: NSRange, in text: NSString) -> String {
        var contentLength = lineRange.length

        while contentLength > 0 {
            let lastCharacterRange = NSRange(location: lineRange.location + contentLength - 1, length: 1)
            let character = text.substring(with: lastCharacterRange)
            if character == "\n" || character == "\r" {
                contentLength -= 1
            } else {
                break
            }
        }

        guard contentLength > 0 else { return "" }
        let contentRange = NSRange(location: lineRange.location, length: contentLength)
        return text.substring(with: contentRange).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private nonisolated static func isSectionMetadataLine(_ line: String) -> Bool {
        let normalized = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }
        if normalized.uppercased().hasPrefix("SECTION BC") {
            return true
        }

        let punctuationTrimmed = normalized.trimmingCharacters(in: CharacterSet(charactersIn: ".:;-"))
        let hasLetters = punctuationTrimmed.unicodeScalars.contains { CharacterSet.letters.contains($0) }
        return hasLetters && punctuationTrimmed == punctuationTrimmed.uppercased() && !punctuationTrimmed.contains(".")
    }

    private nonisolated static func isNumberedTitleLine(_ line: String, detail: ReaderSectionDetail) -> Bool {
        let normalized = normalizedTitleLine(line)
        let expected = normalizedTitleLine("\(detail.sectionNumber) \(detail.displayTitle)")
        return normalized == expected
    }

    private nonisolated static func normalizedTitleLine(_ line: String) -> String {
        line
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;-"))
            .lowercased()
    }

    private nonisolated static func fallbackChapterBodyText(
        for detail: ReaderSectionDetail,
        formattedText: NSAttributedString
    ) -> NSAttributedString {
        if detail.kind == .textBlock || !detail.contentBlocks.isEmpty {
            return formattedText
        }

        let trimmedText = formattedText.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            return NSAttributedString(string: "")
        }

        return formattedText
    }

    private func cachedSectionDetail(for sectionID: Int64) -> ReaderSectionDetail? {
        sectionDetailCache.object(forKey: NSNumber(value: sectionID))?.detail
    }

    private func storeSectionDetailInCache(_ detail: ReaderSectionDetail, sectionID: Int64) {
        sectionDetailCache.setObject(
            CachedReaderSectionDetail(detail),
            forKey: NSNumber(value: sectionID),
            cost: Self.sectionDetailMemoryCost(detail)
        )
    }

    private func clearCaches() {
        lastChapterPreloadTask?.cancel()
        codeSectionWarmupTask?.cancel()
        chapterWarmupTasks.values.forEach { $0.cancel() }
        lastChapterPreloadTask = nil
        codeSectionWarmupTask = nil
        chapterWarmupTasks.removeAll()
        warmedChapterIDs.removeAll()
        sectionsCache.removeAll()
        sectionGroupsCache.removeAll()
        sectionDetailCache.removeAllObjects()
        formattedNSTextCache.removeAllObjects()
        chapterBodyNSTextCache.removeAllObjects()
        bookmarkedSectionIDs.removeAll()
        searchTask?.cancel()
        activeSearchWorkTask?.cancel()
        searchTask = nil
        activeSearchWorkTask = nil
        isSearchInProgress = false
    }

    func suspendReaderWarmups() {
        lastChapterPreloadTask?.cancel()
        codeSectionWarmupTask?.cancel()
        chapterWarmupTasks.values.forEach { $0.cancel() }
        startupWarmupTask?.cancel()
        lastChapterPreloadTask = nil
        codeSectionWarmupTask = nil
        chapterWarmupTasks.removeAll(keepingCapacity: false)
        startupWarmupTask = nil
    }

    func handleMemoryWarning() {
        suspendReaderWarmups()
        sectionDetailCache.removeAllObjects()
        formattedNSTextCache.removeAllObjects()
        chapterBodyNSTextCache.removeAllObjects()
        warmedChapterIDs.removeAll(keepingCapacity: false)
        os_signpost(.event, log: AppSignpost.memory, name: "readerCachesPurged")
    }

    private static func formattedTextCacheKey(sectionID: Int64, theme: ReaderTheme) -> NSString {
        "\(sectionID)|\(theme.hashValue)" as NSString
    }

    private static func sectionDetailMemoryCost(_ detail: ReaderSectionDetail) -> Int {
        var cost = stringMemoryCost(detail.officialText)
            + stringMemoryCost(detail.title)
            + stringMemoryCost(detail.chapterTitle)
        for block in detail.contentBlocks {
            cost += stringMemoryCost(block.html ?? "")
            cost += stringMemoryCost(block.plainText ?? "")
            cost += stringMemoryCost(block.caption ?? "")
        }
        for table in detail.tableBlocks {
            cost += stringMemoryCost(table.caption ?? "")
            cost += table.cells.reduce(0) { $0 + stringMemoryCost($1.plainText) + stringMemoryCost($1.html) }
        }
        return max(cost, 1)
    }

    private static func attributedTextMemoryCost(_ value: NSAttributedString) -> Int {
        max(stringMemoryCost(value.string) * 3, 1)
    }

    private static func stringMemoryCost(_ value: String) -> Int {
        max(value.utf8.count, value.utf16.count * 2)
    }

    private func buildJurisdictions(from versions: [BundledCodeVersion]) -> [BundledJurisdiction] {
        let grouped = Dictionary(grouping: versions) { jurisdictionKey(for: $0) }
        return grouped.keys.sorted().compactMap { key in
            guard let sample = grouped[key]?.first else { return nil }
            return BundledJurisdiction(
                id: key,
                jurisdictionID: sample.jurisdictionID,
                name: sample.jurisdictionName ?? "Bundled Content"
            )
        }
    }

    private func jurisdictionKey(for version: BundledCodeVersion) -> String {
        if let jurisdictionID = version.jurisdictionID {
            return "jurisdiction-\(jurisdictionID)"
        }
        return "legacy-\(version.contentKind.rawValue)"
    }
}

struct ProjectEvidenceVersionSnapshot: Sendable {
    let sectionIDsByFolderID: [Int64: [Int64]]
    let bookmarkedSectionIDs: Set<Int64>
    let notesBySectionID: [Int64: String]
    let tagsBySectionID: [Int64: [String]]
    let annotationEntries: [UserAnnotationEntry]
    let bookmarkCreatedAtBySectionID: [Int64: Date]
}

struct ProjectPresentationSnapshot: Sendable {
    let folders: [CodeFolder]
    let versions: [String: ProjectEvidenceVersionSnapshot]
    let catalog: [BundledCodeVersion]
}

struct ProjectPresentationResult: Sendable, Equatable {
    let rowsByFolderID: [Int64: [BookmarkedSection]]
    let recordCountByFolderID: [Int64: Int]
}

private enum ProjectPresentationSnapshotAssembler {
    static func build(
        repository: UserContentRepository,
        folders: [CodeFolder],
        catalog: [BundledCodeVersion]
    ) throws -> ProjectPresentationSnapshot {
        var sectionIDsByFolderAndVersion: [Int64: [String: [Int64]]] = [:]
        var requiredCodeVersions = Set<String>()
        for folder in folders {
            try Task.checkCancellation()
            let references = try repository.evidenceReferences(inFolder: folder.id)
            for reference in references {
                sectionIDsByFolderAndVersion[folder.id, default: [:]][reference.codeVersion, default: []]
                    .append(reference.sectionID)
                requiredCodeVersions.insert(reference.codeVersion)
            }
        }

        var versions: [String: ProjectEvidenceVersionSnapshot] = [:]
        for codeVersion in requiredCodeVersions {
            try Task.checkCancellation()
            versions[codeVersion] = ProjectEvidenceVersionSnapshot(
                sectionIDsByFolderID: Dictionary(
                    uniqueKeysWithValues: folders.map { folder in
                        let ids = sectionIDsByFolderAndVersion[folder.id]?[codeVersion] ?? []
                        return (folder.id, Array(Set(ids)).sorted())
                    }
                ),
                bookmarkedSectionIDs: Set(try repository.bookmarkedSectionIDs(codeVersion: codeVersion)),
                notesBySectionID: try repository.noteEntries(codeVersion: codeVersion),
                tagsBySectionID: try repository.tagsBySectionID(codeVersion: codeVersion),
                annotationEntries: try repository.annotationEntries(codeVersion: codeVersion),
                bookmarkCreatedAtBySectionID: try repository.bookmarkCreatedAtBySectionID(codeVersion: codeVersion)
            )
        }

        return ProjectPresentationSnapshot(folders: folders, versions: versions, catalog: catalog)
    }
}

actor ProjectPresentationSnapshotBuilder {
    private let locator = BundleDatabaseLocator()
    private var repositoriesByPath: [String: UserDataStore] = [:]

    func build(
        databaseURL: URL,
        folders: [CodeFolder],
        availableVersions: [BundledCodeVersion]
    ) throws -> ProjectPresentationSnapshot {
        try Task.checkCancellation()
        let path = databaseURL.standardizedFileURL.path
        let repository: UserDataStore
        if let cached = repositoriesByPath[path] {
            repository = cached
        } else {
            let loaded = try UserDataStore(readOnlyDatabaseURL: databaseURL)
            repositoriesByPath[path] = loaded
            repository = loaded
        }

        let fallbackCatalog = locator.availableCodeVersions()
        let catalog = Dictionary(
            (availableVersions + fallbackCatalog).map {
                (UserContentSyncCodeVersion.server($0.codeVersion), $0)
            },
            uniquingKeysWith: { first, _ in first }
        ).values.sorted { $0.fileName < $1.fileName }
        return try ProjectPresentationSnapshotAssembler.build(
            repository: repository,
            folders: folders,
            catalog: catalog
        )
    }
}

enum BookmarkPresentationReducer {
    static func updatedRows(
        _ rows: [BookmarkedSection],
        sectionID: Int64,
        isBookmarked: Bool,
        newSectionRow: BookmarkedSection?
    ) -> [BookmarkedSection] {
        var foundSectionLevelRow = false
        var updated = rows.compactMap { row -> BookmarkedSection? in
            guard row.id == sectionID else { return row }
            if row.annotationBlockID.isEmpty {
                foundSectionLevelRow = true
                let hasOtherEvidence = !row.noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || !row.tags.isEmpty
                guard isBookmarked || hasOtherEvidence else { return nil }
            }
            return row.withBookmarkState(isBookmarked)
        }

        if isBookmarked, !foundSectionLevelRow, let newSectionRow {
            updated.append(newSectionRow.withBookmarkState(true))
        }
        return updated
    }
}

private extension BookmarkedSection {
    func withBookmarkState(_ isBookmarked: Bool) -> BookmarkedSection {
        BookmarkedSection(
            id: id,
            annotationBlockID: annotationBlockID,
            annotationLabel: annotationLabel,
            codeVersion: codeVersion,
            codeSectionID: codeSectionID,
            codeSectionName: codeSectionName,
            clientID: clientID,
            ownerID: ownerID,
            visibility: visibility,
            syncState: syncState,
            updatedAt: updatedAt,
            deletedAt: deletedAt,
            chapterNumber: chapterNumber,
            chapterTitle: chapterTitle,
            sectionNumber: sectionNumber,
            title: title,
            previewText: previewText,
            kind: kind,
            isBookmarked: isBookmarked,
            noteBody: noteBody,
            tags: tags,
            bookmarkedAt: isBookmarked ? (bookmarkedAt ?? Date()) : nil
        )
    }
}

actor ProjectPresentationBuilder {
    private let locator = BundleDatabaseLocator()
    private var authoredStoresByCodeVersion: [String: AuthoredCodeStore] = [:]
    private var databasesByCodeVersion: [String: CodeDatabase] = [:]

    func build(_ snapshot: ProjectPresentationSnapshot) throws -> ProjectPresentationResult {
        var rowsByFolderID: [Int64: [BookmarkedSection]] = [:]
        var recordCountByFolderID: [Int64: Int] = [:]
        let catalogByCanonicalVersion = Dictionary(
            snapshot.catalog.map {
                (UserContentSyncCodeVersion.server($0.codeVersion), $0)
            },
            uniquingKeysWith: { first, _ in first }
        )

        for folder in snapshot.folders {
            try Task.checkCancellation()
            var resolved: [BookmarkedSection] = []
            for codeVersion in snapshot.versions.keys.sorted() {
                try Task.checkCancellation()
                guard let evidence = snapshot.versions[codeVersion] else { continue }
                let sectionIDs = evidence.sectionIDsByFolderID[folder.id] ?? []
                guard !sectionIDs.isEmpty else { continue }
                let canonicalVersion = UserContentSyncCodeVersion.server(codeVersion)
                guard let bundledVersion = catalogByCanonicalVersion[canonicalVersion] else { continue }

                switch bundledVersion.contentKind {
                case .authored:
                    let store: AuthoredCodeStore
                    if let cached = authoredStoresByCodeVersion[canonicalVersion] {
                        store = cached
                    } else {
                        let loaded = try AuthoredCodeStore(
                            jsonURL: bundledVersion.fileURL,
                            codeID: bundledVersion.authoredCodeID,
                            jurisdictionID: bundledVersion.jurisdictionID
                        )
                        authoredStoresByCodeVersion[canonicalVersion] = loaded
                        store = loaded
                    }
                    resolved.append(contentsOf: store.savedSections(
                        ids: sectionIDs,
                        codeVersion: codeVersion,
                        bookmarkedSectionIDs: evidence.bookmarkedSectionIDs,
                        notesBySectionID: evidence.notesBySectionID,
                        tagsBySectionID: evidence.tagsBySectionID,
                        annotationEntries: evidence.annotationEntries,
                        bookmarkCreatedAtBySectionID: evidence.bookmarkCreatedAtBySectionID,
                        includeProjectOnlySections: true
                    ))
                case .sqlite:
                    let database: CodeDatabase
                    if let cached = databasesByCodeVersion[canonicalVersion] {
                        database = cached
                    } else {
                        let loaded = try CodeDatabase(databaseURL: bundledVersion.fileURL, locator: locator)
                        databasesByCodeVersion[canonicalVersion] = loaded
                        database = loaded
                    }
                    resolved.append(contentsOf: try database.savedSections(
                        ids: sectionIDs,
                        codeVersion: codeVersion,
                        bookmarkedSectionIDs: evidence.bookmarkedSectionIDs,
                        notesBySectionID: evidence.notesBySectionID,
                        tagsBySectionID: evidence.tagsBySectionID,
                        annotationEntries: evidence.annotationEntries,
                        bookmarkCreatedAtBySectionID: evidence.bookmarkCreatedAtBySectionID,
                        includeProjectOnlySections: true
                    ))
                }
            }

            var seenRowIDs = Set<String>()
            let evidenceRecords = resolved.filter { seenRowIDs.insert($0.rowID).inserted }
            recordCountByFolderID[folder.id] = evidenceRecords.count
            rowsByFolderID[folder.id] = ProjectEvidenceConsolidator.consolidated(evidenceRecords)
        }

        return ProjectPresentationResult(
            rowsByFolderID: rowsByFolderID,
            recordCountByFolderID: recordCountByFolderID
        )
    }
}

private actor SQLiteChapterLoader {
    private let database: CodeDatabase

    init(databaseURL: URL) throws {
        self.database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())
    }

    func sectionGroups(chapterID: Int64) throws -> [CodeSectionGroup] {
        try database.sectionGroups(chapterID: chapterID)
    }

    func sectionDetail(sectionID: Int64) throws -> ReaderSectionDetail? {
        try database.sectionDetail(sectionID: sectionID)
    }

    func sectionDetails(sectionIDs: [Int64]) throws -> [ReaderSectionDetail] {
        try sectionIDs.compactMap { sectionID in
            try database.sectionDetail(sectionID: sectionID)
        }
    }

    func firstSectionIDs(chapterIDs: [Int64]) throws -> [Int64] {
        try database.firstSectionIDs(chapterIDs: chapterIDs)
    }
}

private final class CachedReaderSectionDetail: NSObject {
    let detail: ReaderSectionDetail

    init(_ detail: ReaderSectionDetail) {
        self.detail = detail
    }
}

enum SignedInAccountPersistence {
    static func removingBackendSessionToken(from account: SignedInAccount) -> SignedInAccount {
        SignedInAccount(
            appUserID: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            appleUserID: account.appleUserID,
            email: account.email,
            publicUsername: account.publicUsername,
            displayName: account.displayName,
            signedInAt: account.signedInAt,
            migrationState: account.migrationState,
            backendSessionToken: nil
        )
    }
}

private enum AccountSessionTokenStore {
    private static let service = "com.randycodex.permitext.backend-session"

    static func loadToken(accountUserID: String) -> String? {
        var query = baseQuery(accountUserID: accountUserID)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func saveToken(_ token: String?, accountUserID: String) -> Bool {
        guard let token, let data = token.data(using: .utf8) else {
            deleteToken(accountUserID: accountUserID)
            return true
        }

        let query = baseQuery(accountUserID: accountUserID)
        let update = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
        }
        return status == errSecSuccess
    }

    static func deleteToken(accountUserID: String) {
        SecItemDelete(baseQuery(accountUserID: accountUserID) as CFDictionary)
    }

    private static func baseQuery(accountUserID: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: accountUserID
        ]
    }
}

/// State machine driving the Saved screen's PDF export flow.
enum BookmarkExportState: Equatable {
    case idle
    /// `progress` in [0,1]; `sectionTitle` is the latest bookmark being
    /// processed (so the progress sheet can show a meaningful subtitle).
    case building(progress: Double, sectionTitle: String)
    case ready(url: URL, sectionCount: Int)
    case failed(String)
}
