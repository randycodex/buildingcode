import SwiftUI

struct CodeQuestionProjectHubList: View {
    let records: [ProjectCodeQuestionRecord]
    let accent: Color
    let onOpenReport: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if records.isEmpty {
                Text("No Code Questions are synced to this Project yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(records) { record in
                    NavigationLink {
                        CodeQuestionProjectHubDetail(
                            record: record,
                            accent: accent,
                            onOpenReport: onOpenReport
                        )
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 5) {
                                HStack(spacing: 7) {
                                    Text(record.displayID)
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(accent)
                                    Text(record.stateLabel)
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                                Text(record.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .multilineTextAlignment(.leading)
                                if !record.questionText.isEmpty {
                                    Text(record.questionText)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(3)
                                        .multilineTextAlignment(.leading)
                                }
                                HStack(spacing: 8) {
                                    Label(
                                        "Evidence v\(record.latestEvidenceSet?.payload.evidenceSetVersion ?? 0)",
                                        systemImage: "checkmark.seal"
                                    )
                                    if record.analysisIsStale {
                                        Label("Analysis stale", systemImage: "exclamationmark.triangle")
                                    }
                                }
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(record.analysisIsStale ? Color.orange : .secondary)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.tertiary)
                                .padding(.top, 4)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .fill(accent.opacity(0.09))
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("\(record.displayID), \(record.title), \(record.stateLabel)")
                    .accessibilityHint("Opens the read-only Code Question record")
                }
            }

            Text("Code Question review is read-only on iPhone. Define, Evidence, Analysis, Review, and Issue changes remain on Permitext Web until secure mobile mutation recovery is enabled.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct CodeQuestionProjectHubDetail: View {
    let record: ProjectCodeQuestionRecord
    let accent: Color
    let onOpenReport: ((String) -> Void)?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                overview
                definition
                evidence
                analysis
                conclusion
                reviews
                issuedRecord
                supportingLinks
                mobileBoundary
            }
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .background(CodeAppBackdrop(accent: accent).ignoresSafeArea())
        .navigationTitle(record.displayID)
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
    }

    private var overview: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(record.displayID)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
                Spacer(minLength: 8)
                Text(record.stateLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text(record.title)
                .font(.title2.bold())
            Text(record.questionText)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Definition revision \(record.definitionRevision) · Current stage: \(record.stage.label)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .codeQuestionMobileSurface(accent: accent)
    }

    @ViewBuilder
    private var definition: some View {
        codeQuestionSection("Definition", systemImage: "square.and.pencil") {
            labeledValue("Scope", record.question.payload.scope)
            labeledValue("Jurisdiction", record.question.payload.jurisdiction)
            labeledValue("As of", record.question.payload.asOfDate)
            labeledValue("Desired output", record.question.payload.desiredOutput)

            if record.inputs.isEmpty {
                muted("No structured facts, assumptions, or unknowns are recorded.")
            } else {
                ForEach(record.inputs) { input in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(inputLabel(input.payload.inputKind))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(accent)
                        Text(input.payload.statement ?? "")
                            .font(.footnote)
                        Text((input.payload.state ?? "proposed").replacingOccurrences(of: "-", with: " ").capitalized)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .codeQuestionMobileRow(accent: accent)
                }
            }
        }
    }

    @ViewBuilder
    private var evidence: some View {
        codeQuestionSection("Evidence Set", systemImage: "checkmark.seal") {
            if let evidenceSet = record.latestEvidenceSet {
                Text("Version \(evidenceSet.payload.evidenceSetVersion ?? 1) · \(evidenceSet.payload.entries?.count ?? 0) approved snapshots")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                hashLine("Set hash", evidenceSet.payload.contentHash)
                ForEach(record.evidenceSnapshots) { snapshot in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(snapshot.payload.passageLocator ?? snapshot.payload.sourceIdentity ?? "Evidence snapshot")
                            .font(.subheadline.weight(.semibold))
                        if let source = snapshot.payload.sourceIdentity, !source.isEmpty {
                            Text(source)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let quote = snapshot.payload.quotedText, !quote.isEmpty {
                            Text(quote)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(8)
                        }
                        hashLine("Text hash", snapshot.payload.textHash)
                    }
                    .codeQuestionMobileRow(accent: accent)
                }
            } else {
                muted("No approved Evidence Set is available.")
            }
        }
    }

    @ViewBuilder
    private var analysis: some View {
        codeQuestionSection("Analysis", systemImage: "text.magnifyingglass") {
            if let analysis = record.latestAnalysis {
                if record.analysisIsStale {
                    Label("This analysis is stale because its Definition or Evidence Set dependency changed.", systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.orange)
                }
                if let answer = record.researchAnswer {
                    Text(answer.question)
                        .font(.subheadline.weight(.semibold))
                    Text(answer.conclusion)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(answer.evidenceCount) approved sources · \(answer.reviewStatus.replacingOccurrences(of: "-", with: " ").capitalized)")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                } else {
                    muted("The immutable analysis descriptor is available, but its Research answer is not present in this snapshot.")
                }
                labeledValue("Citation validation", analysis.payload.citationValidation)
                labeledValue("Analysis policy", analysis.payload.analysisPolicyID)
                hashLine("Dependency hash", analysis.payload.dependencyHash)
            } else {
                muted("No immutable analysis has been generated.")
            }
        }
    }

    @ViewBuilder
    private var conclusion: some View {
        codeQuestionSection("Professional Conclusion", systemImage: "signature") {
            if let conclusion = record.latestConclusion {
                Text("Revision \(conclusion.payload.revision ?? 1)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
                Text(conclusion.payload.conclusionText ?? "")
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)
                if let reasoning = conclusion.payload.reasoning, !reasoning.isEmpty {
                    labeledValue("Reasoning", reasoning)
                }
                stringList("Citations", conclusion.payload.citations)
                stringList("Assumptions", conclusion.payload.assumptions)
                stringList("Unknowns", conclusion.payload.unknowns)
                labeledValue("AI assistance disclosure", conclusion.payload.aiAssistanceDisclosure)
                Text(record.conclusionApprovals.isEmpty ? "Not approved" : "Approved conclusion revision")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(record.conclusionApprovals.isEmpty ? Color.orange : accent)
            } else {
                muted("No professional conclusion revision is available.")
            }
        }
    }

    @ViewBuilder
    private var reviews: some View {
        codeQuestionSection("Review Requests", systemImage: "person.2.badge.gearshape") {
            if record.reviewRequests.isEmpty {
                muted("No Review Requests are linked to this Code Question.")
            } else {
                ForEach(record.reviewRequests) { request in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(request.payload.title ?? "Review Request")
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 8)
                            Text((request.payload.status ?? "open").capitalized)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(["open", "waiting"].contains(request.payload.status ?? "open") ? accent : .secondary)
                        }
                        Text((request.payload.requestType ?? request.payload.kind ?? "review").replacingOccurrences(of: "-", with: " ").capitalized)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        if let body = request.payload.body, !body.isEmpty {
                            Text(body)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .codeQuestionMobileRow(accent: accent)
                }
            }
        }
    }

    @ViewBuilder
    private var issuedRecord: some View {
        codeQuestionSection("Issued Record", systemImage: "doc.badge.checkmark") {
            if record.issuedRecords.isEmpty {
                muted("No immutable Code Memo has been issued.")
            } else {
                ForEach(record.issuedRecords.reversed()) { issued in
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Code Memo v\(issued.payload.issueVersion ?? 1) · \((issued.payload.status ?? "issued").capitalized)")
                            .font(.subheadline.weight(.semibold))
                        Text(formattedDate(issued.payload.issuedAt ?? issued.envelope.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        hashLine("Manifest", issued.payload.reportManifestID)
                        if let predecessor = issued.payload.predecessorID, !predecessor.isEmpty {
                            hashLine("Predecessor", predecessor)
                        }
                        if let successor = issued.payload.successorID, !successor.isEmpty {
                            hashLine("Successor", successor)
                        }
                        if let reason = issued.payload.supersessionReason, !reason.isEmpty {
                            labeledValue("Supersession reason", reason)
                        }
                        if let manifestID = issued.payload.reportManifestID,
                           issued.id == record.latestIssuedRecord?.id,
                           let onOpenReport {
                            Button {
                                onOpenReport(manifestID)
                            } label: {
                                Label("Open verified report", systemImage: "square.and.arrow.down")
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(accent)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 9)
                                    .background(Capsule(style: .continuous).fill(accent.opacity(0.14)))
                            }
                            .buttonStyle(.plain)
                            .accessibilityHint("Downloads or builds the report identified by this issued manifest")
                        }
                    }
                    .codeQuestionMobileRow(accent: accent)
                }
            }
        }
    }

    @ViewBuilder
    private var supportingLinks: some View {
        codeQuestionSection("Supporting Links", systemImage: "link") {
            if record.promotions.isEmpty {
                muted("No legacy or supporting records are linked as provenance.")
            } else {
                ForEach(record.promotions) { promotion in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(promotion.payload.sourceLabel ?? promotion.payload.sourceID ?? "Supporting record")
                            .font(.subheadline.weight(.semibold))
                        Text((promotion.payload.sourceKind ?? "source").replacingOccurrences(of: "-", with: " ").capitalized)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(accent)
                        Text(promotion.payload.status == "unlinked" ? "Recovery link available on web" : "Linked as provenance only")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .codeQuestionMobileRow(accent: accent)
                }
            }
            Text("Working Notes and the flattened Workboard preview remain in the Project Hub; linked content is not silently promoted into facts or evidence.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var mobileBoundary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Secure mobile boundary", systemImage: "lock.shield")
                .font(.subheadline.weight(.bold))
            Text("This iPhone view preserves synced IDs, ordering, citations, hashes, review state, and version lineage. Mutations are intentionally unavailable until authorization, atomic outbox, conflict, interruption-recovery, and mixed-client gates pass.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .codeQuestionMobileSurface(accent: accent)
    }

    private func codeQuestionSection<Content: View>(
        _ title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            content()
        }
        .codeQuestionMobileSurface(accent: accent)
    }

    @ViewBuilder
    private func labeledValue(_ label: String, _ value: String?) -> some View {
        if let value, !value.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.footnote)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private func hashLine(_ label: String, _ value: String?) -> some View {
        if let value, !value.isEmpty {
            Text("\(label): \(value)")
                .font(.caption2.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .accessibilityLabel("\(label), \(value)")
        }
    }

    @ViewBuilder
    private func stringList(_ label: String, _ values: [String]?) -> some View {
        if let values, !values.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                ForEach(Array(values.enumerated()), id: \.offset) { _, value in
                    Text("• \(value)")
                        .font(.footnote)
                }
            }
        }
    }

    private func muted(_ value: String) -> some View {
        Text(value)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func inputLabel(_ value: String?) -> String {
        switch value {
        case "confirmedFact": return "Confirmed fact"
        case "assumption": return "Assumption"
        case "unknown": return "Unknown"
        default: return "Question input"
        }
    }

    private func formattedDate(_ value: String) -> String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        return date?.formatted(date: .abbreviated, time: .shortened) ?? value
    }
}

private extension View {
    func codeQuestionMobileSurface(accent: Color) -> some View {
        frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemBackground).opacity(0.92))
                    .overlay(alignment: .leading) {
                        Capsule(style: .continuous)
                            .fill(accent)
                            .frame(width: 4)
                            .padding(.vertical, 10)
                    }
            )
    }

    func codeQuestionMobileRow(accent: Color) -> some View {
        frame(maxWidth: .infinity, alignment: .leading)
            .padding(11)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(accent.opacity(0.075))
            )
    }
}
