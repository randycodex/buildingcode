/// Tracks application presentation signals, not an OS first-frame timestamp.
/// Instruments App Launch remains the authority for process/first-frame timing.
/// Signals can arrive in either order; secondary Reader models must not feed
/// this gate. A completed startup is reported once, never on subsequent tabs.
struct StartupPresentationMilestones {
    enum Milestone: CaseIterable, Hashable {
        case dataReady
        case rootAppeared
        case splashDismissed
    }

    private var received: Set<Milestone> = []
    private(set) var hasReportedPresentation = false

    mutating func record(_ milestone: Milestone) -> Bool {
        received.insert(milestone)
        guard !hasReportedPresentation,
              received.count == Milestone.allCases.count else { return false }
        hasReportedPresentation = true
        return true
    }
}
