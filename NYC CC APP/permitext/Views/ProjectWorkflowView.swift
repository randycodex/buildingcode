import SwiftUI

enum ProjectReviewTab: String, CaseIterable {
    case questions, checklist

    var title: String { self == .questions ? "Questions" : "Checklist" }
}

struct ProjectWorkflowView: View {
    let folderID: Int64
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var tab: ProjectReviewTab
    @State private var editingFolder: CodeFolder?
    @State private var editingSessionID: UUID?
    @State private var questions: [ProjectOpenQuestion] = []
    @State private var records: [ProjectChecklistRecord] = []
    @FocusState private var focusedRowID: String?
    @State private var newRowID: String?
    @State private var saveError: String?
    @State private var initialSyncFinished = false

    init(folderID: Int64, initialTab: ProjectReviewTab) {
        self.folderID = folderID
        _tab = State(initialValue: initialTab)
    }

    private var isQuestions: Bool { tab == .questions }
    private var isEditing: Bool { editingFolder != nil }
    private var folder: CodeFolder? { library.folder(id: folderID) }
    private var savedQuestions: [ProjectOpenQuestion] { folder?.openQuestions ?? [] }
    private var savedRecords: [ProjectChecklistRecord] { folder?.recordsChecklist ?? [] }
    private var needsInitialSync: Bool {
        isQuestions ? folder?.openQuestions == nil : folder?.recordsChecklist == nil
    }
    private var accent: Color {
        Color(uiColor: PlatformColor(hex: folder?.colorHex ?? CodeFolder.defaultColorHex) ?? library.accentColor())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if needsInitialSync {
                    if initialSyncFinished {
                        Text("Connect to load this Project’s \(tab.title.lowercased()) before editing.")
                            .foregroundStyle(.secondary)
                        Button("Try again") { Task { await library.syncNow() } }
                    }
                } else if isQuestions { questionList } else { checklist }
                if let saveError {
                    Text(saveError).font(.subheadline).foregroundStyle(.red)
                        .accessibilityIdentifier("project-workflow-error")
                }
                actions
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .codePinnedTopBar {
            Picker("Review section", selection: $tab) {
                ForEach(ProjectReviewTab.allCases, id: \.self) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .disabled(isEditing)
            .accessibilityIdentifier("project-review-tabs")
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, 8)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(CodeAppBackdrop(accent: accent).ignoresSafeArea())
        .navigationTitle("Review")
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
        .navigationBarBackButtonHidden(isEditing)
        .toolbar {
            if isEditing {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: cancel)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save", action: save).fontWeight(.semibold)
                        .accessibilityIdentifier("project-workflow-save")
                }
            } else {
                EditToolbarItem(
                    label: isQuestions ? "Edit questions" : "Edit checklist",
                    identifier: "project-workflow-edit",
                    isDisabled: folder == nil || (isQuestions ? savedQuestions.isEmpty : savedRecords.isEmpty),
                    action: beginEditing
                )
            }
        }
        .onChange(of: library.privateSessionID) { _, _ in cancel() }
        .onChange(of: folderID) { _, _ in cancel() }
        .onChange(of: tab) { _, selection in
            library.setProjectReviewTab(selection, for: folderID)
        }
        .task(id: tab) {
            initialSyncFinished = false
            if needsInitialSync { await library.syncNow() }
            guard !Task.isCancelled else { return }
            initialSyncFinished = true
        }
    }

    @ViewBuilder private var questionList: some View {
        if isEditing {
            ForEach(Array(questions.enumerated()), id: \.element.id) { index, question in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("What needs to be answered?",
                                      text: draftValue(for: question, in: $questions, field: \.question), axis: .vertical)
                                .font(.headline)
                                .focused($focusedRowID, equals: question.id)
                                .onAppear {
                                    if newRowID == question.id {
                                        focusedRowID = question.id
                                        newRowID = nil
                                    }
                                }
                                .accessibilityLabel("Question \(index + 1)")
                                .accessibilityIdentifier("project-question-text-\(index)")
                            TextField("Add an answer",
                                      text: draftValue(for: question, in: $questions, field: \.answer), axis: .vertical)
                                .accessibilityLabel("Answer \(index + 1)")
                                .accessibilityIdentifier("project-question-answer-\(index)")
                        }
                        Button {
                            questions.removeAll { $0.id == question.id }
                        } label: { Image(systemName: "minus.circle").frame(minWidth: 44, minHeight: 44) }
                            .accessibilityLabel("Remove question \(index + 1)")
                    }
                    Divider()
                }
                .textFieldStyle(.plain)
            }
        } else if savedQuestions.isEmpty {
            Text("No questions yet.").foregroundStyle(.secondary)
        } else {
            ForEach(Array(savedQuestions.enumerated()), id: \.element.id) { index, question in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                    VStack(alignment: .leading, spacing: 8) {
                        Text(question.question.isEmpty ? "Untitled question" : question.question).font(.headline)
                        if !question.answer.isEmpty { Text(question.answer).foregroundStyle(.secondary) }
                    }
                }
                .textSelection(.enabled)
                Divider()
            }
        }
    }

    @ViewBuilder private var checklist: some View {
        if isEditing {
            ForEach(Array(records.enumerated()), id: \.element.id) { index, record in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("Record name",
                                      text: draftValue(for: record, in: $records, field: \.label), axis: .vertical)
                                .font(.headline)
                                .focused($focusedRowID, equals: record.id)
                                .onAppear {
                                    if newRowID == record.id {
                                        focusedRowID = record.id
                                        newRowID = nil
                                    }
                                }
                                .accessibilityLabel("Record \(index + 1)")
                                .accessibilityIdentifier("project-record-label-\(index)")
                            Picker("Status", selection: draftValue(for: record, in: $records, field: \.status)) {
                                ForEach(ProjectRecordStatus.allCases) { status in
                                    Text(status.title).tag(status)
                                }
                            }
                            .pickerStyle(.menu)
                            .accessibilityIdentifier("project-record-status-\(index)")
                            TextField("Source, date, or follow-up",
                                      text: draftValue(for: record, in: $records, field: \.note), axis: .vertical)
                                .accessibilityLabel("Record notes \(index + 1)")
                                .accessibilityIdentifier("project-record-note-\(index)")
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Button {
                            records.removeAll { $0.id == record.id }
                        } label: { Image(systemName: "minus.circle").frame(minWidth: 44, minHeight: 44) }
                            .accessibilityLabel("Remove record \(index + 1)")
                    }
                    Divider()
                }
                .textFieldStyle(.plain)
            }
        } else if savedRecords.isEmpty {
            Text("No records yet.").foregroundStyle(.secondary)
        } else {
            ForEach(Array(savedRecords.enumerated()), id: \.element.id) { index, record in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1).").foregroundStyle(.secondary).monospacedDigit()
                    VStack(alignment: .leading, spacing: 8) {
                        Text(record.label).font(.headline)
                        Text(record.status.title).font(.subheadline).foregroundStyle(.secondary)
                        if !record.note.isEmpty { Text(record.note).foregroundStyle(.secondary) }
                    }
                }
                .textSelection(.enabled)
                Divider()
            }
        }
    }

    private func draftValue<Row: Identifiable, Value>(
        for row: Row, in rows: Binding<[Row]>, field: WritableKeyPath<Row, Value>
    ) -> Binding<Value> {
        let sessionID = editingSessionID
        // A text field can read its binding once more while being removed or resigning focus.
        return Binding {
            rows.wrappedValue.first { $0.id == row.id }?[keyPath: field] ?? row[keyPath: field]
        } set: { value in
            guard isEditing, editingSessionID == sessionID,
                  let index = rows.wrappedValue.firstIndex(where: { $0.id == row.id }) else { return }
            rows.wrappedValue[index][keyPath: field] = value
        }
    }

    private var actions: some View {
        VStack(alignment: .leading, spacing: 20) {
            Button {
                if !isEditing { beginEditing() }
                guard isEditing else { return }
                if isQuestions {
                    let question = ProjectOpenQuestion()
                    newRowID = question.id
                    questions.append(question)
                } else {
                    let record = ProjectChecklistRecord()
                    newRowID = record.id
                    records.append(record)
                }
            } label: { Label(isQuestions ? "Add question" : "Add record", systemImage: "plus") }
                .disabled(folder == nil || needsInitialSync || (isQuestions ? (isEditing ? questions.count : savedQuestions.count) >= 100 : (isEditing ? records.count : savedRecords.count) >= 50))
                .accessibilityIdentifier("project-workflow-add")
            if !isQuestions {
                Button("Add suggested records") {
                    if !isEditing { beginEditing() }
                    guard isEditing else { return }
                    for label in ProjectChecklistRecord.suggestedLabels where records.count < 50 && !records.contains(where: { $0.label == label }) {
                        records.append(ProjectChecklistRecord(label: label))
                    }
                }
                .disabled(folder == nil || needsInitialSync)
                .accessibilityIdentifier("project-checklist-suggested")
            }

        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }

    private func beginEditing() {
        guard let folder, !needsInitialSync else { return }
        questions = folder.openQuestions ?? []
        records = folder.recordsChecklist ?? []
        editingFolder = folder
        editingSessionID = library.privateSessionID
        saveError = nil
    }

    private func cancel() {
        editingFolder = nil
        editingSessionID = nil
        focusedRowID = nil
        newRowID = nil
        questions = []
        records = []
        saveError = nil
    }

    private func save() {
        guard let editingFolder, let editingSessionID else { return }
        let succeeded = library.updateProjectWorkflow(expectedFolder: editingFolder, sessionID: editingSessionID,
            openQuestions: isQuestions ? questions : nil,
            recordsChecklist: isQuestions ? nil : records.map {
                var record = $0
                record.label = record.label.trimmingCharacters(in: .whitespacesAndNewlines)
                record.note = record.note.trimmingCharacters(in: .whitespacesAndNewlines)
                return record
            })
        if succeeded { cancel() }
        else { saveError = library.statusMessage ?? "Changes could not be saved. Try again." }
    }
}
