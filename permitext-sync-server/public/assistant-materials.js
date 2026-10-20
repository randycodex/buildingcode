// This component saves conversation inputs only. It never submits a question.
export function createAssistantMaterials({ conversation, load, save, create, updated = () => {} }) {
  const root = document.createElement("section");
  root.className = "assistant-materials";
  root.setAttribute("aria-label", "Included material");
  let current = conversation, choices = null, busy = false;
  const state = (dirty = false) => {
    root.dataset.dirty = String(dirty);
    root.dataset.busy = String(busy);
    root.dispatchEvent(new CustomEvent("assistant-material-state", { bubbles: true }));
  };
  const button = (text, action, label = text) => {
    const node = document.createElement("button"); node.type = "button"; node.className = "ghost-button";
    node.textContent = text; node.setAttribute("aria-label", label); node.addEventListener("click", action); return node;
  };
  const draw = () => {
    root.dataset.count = String((current?.sources || []).filter(source => source.kind === "selection").length +
      (current?.assistantScope?.materials || []).length + (current?.assistantScope?.facts || []).length +
      (current?.assistantScope?.includeProjectContext ? 1 : 0));
    root.replaceChildren(); state();
    const heading = document.createElement("h3"); heading.textContent = "Conversation sources";
    root.append(heading);
    const help = document.createElement("p"); help.className = "assistant-material-help";
    help.textContent = "Assistant uses only the material included here and your messages. Add material, then ask a question.";
    root.append(help);
    if (!current) {
      root.append(button("Add material", async event => {
        const trigger = event.currentTarget;
        trigger.disabled = true;
        try { await create(); } catch (error) { help.textContent = error.message; trigger.disabled = false; }
      }));
      return;
    }
    const scope = current.assistantScope || { facts: [], materials: [] };
    const status = document.createElement("p"); status.className = "assistant-material-status";
    status.setAttribute("role", "status");
    const execute = async change => {
      busy = true; state(); root.querySelectorAll("button,input,textarea,select").forEach(node => node.disabled = true);
      status.textContent = "Saving material…";
      try {
        const response = await save({ expectedRevision: current.revision,
          includeProjectContext: scope.includeProjectContext === true,
          factIDs: (scope.facts || []).map(fact => fact.id),
          noteIDs: (scope.materials || []).filter(item => item.kind === "note").map(item => item.cardID), ...change });
        current = response.conversation; choices = response.choices; updated(current);
        busy = false; draw();
      } catch (error) {
        busy = false; state(true); status.textContent = error.message;
        root.querySelectorAll("button,input,textarea,select").forEach(node => node.disabled = false);
      }
    };
    const group = (title, count) => {
      const details = document.createElement("details"); details.className = "assistant-material-group";
      const summary = document.createElement("summary"); summary.textContent = `${title} · ${count}`;
      details.append(summary); root.append(details); return details;
    };
    const item = (parent, title, text, remove) => {
      const details = document.createElement("details"); details.className = "assistant-material-item";
      const summary = document.createElement("summary"); summary.textContent = title;
      const body = document.createElement("div"); const passage = document.createElement("p"); passage.textContent = text;
      body.append(passage, button("Remove", remove, `Remove ${title} from conversation`));
      details.append(summary, body); parent.append(details);
    };
    const passages = (current.sources || []).filter(source => source.kind === "selection");
    const sourceGroup = group("Passages", passages.length); sourceGroup.open = passages.length > 0;
    passages.forEach(source => item(sourceGroup, `${source.codePrefix || ""} ${source.sectionNumber || ""} · ${source.title || "Passage"}`,
      source.selectedText || "Section reference; no passage text selected", () => execute({ removeSourceIDs: [source.id] })));
    if (!passages.length) { const p = document.createElement("p"); p.textContent = "Add passages using Research in Reader or Evidence."; sourceGroup.append(p); }
    const materials = scope.materials || [];
    const notesGroup = group("Notes & comments", materials.length); notesGroup.open = materials.length > 0;
    materials.forEach(material => item(notesGroup, material.title || "Comment", material.text, () => execute({
      removeMaterialID: material.id,
      ...(material.kind === "note" ? { noteIDs: materials.filter(other => other.kind === "note" && other.id !== material.id).map(other => other.cardID) } : {})
    })));
    const projectGroup = group("Project context", scope.includeProjectContext ? "On" : "Off");
    if (scope.includeProjectContext) {
      item(projectGroup, "Description & address", [scope.projectContext?.address, scope.projectContext?.description].filter(Boolean).join("\n\n"),
        () => execute({ includeProjectContext: false }));
    }
    const factsGroup = group("Project facts", (scope.facts || []).length);
    (scope.facts || []).forEach(fact => item(factsGroup, `${fact.label}: ${fact.value}`, fact.text,
      () => execute({ factIDs: scope.facts.filter(other => other.id !== fact.id).map(other => other.id) })));

    const picker = document.createElement("details"); picker.className = "assistant-material-picker";
    const pickerLabel = document.createElement("summary"); pickerLabel.textContent = "Choose material"; picker.append(pickerLabel);
    const form = document.createElement("div"); form.className = "assistant-material-form"; picker.append(form);
    const changed = () => { state(true); status.textContent = "Apply your selection before asking a question."; };
    const checkbox = (label, checked, disabled = false) => {
      const row = document.createElement("label"); const input = document.createElement("input"); input.type = "checkbox";
      input.checked = checked; input.disabled = disabled; input.addEventListener("change", changed);
      row.append(input, document.createTextNode(label)); form.append(row); return input;
    };
    const useContext = checkbox("Include project description and address", scope.includeProjectContext, !choices?.projectContext);
    if (choices?.projectContext) {
      const contextPreview = document.createElement("details"); contextPreview.className = "assistant-material-context-preview";
      const previewLabel = document.createElement("summary"); previewLabel.textContent = "Preview project context";
      const preview = document.createElement("p"); preview.className = "assistant-material-help";
      preview.textContent = [choices.projectContext.address, choices.projectContext.description].filter(Boolean).join("\n\n") || "No project description or address saved.";
      contextPreview.append(previewLabel, preview); form.append(contextPreview);
    }
    const factHeading = document.createElement("h4"); factHeading.textContent = "Project facts"; form.append(factHeading);
    const factInputs = new Map();
    const factActions = document.createElement("div"); factActions.className = "assistant-material-choices";
    factActions.append(button("All", () => { factInputs.forEach(input => input.checked = true); changed(); }),
      button("None", () => { factInputs.forEach(input => input.checked = false); changed(); })); form.append(factActions);
    (choices?.facts || []).forEach(fact => factInputs.set(fact.id,
      checkbox(`${fact.label}: ${fact.value}`, scope.facts.some(selected => selected.id === fact.id))));
    if (!choices?.facts?.length) { const p = document.createElement("p"); p.textContent = "No project facts available."; form.append(p); }
    const noteHeading = document.createElement("h4"); noteHeading.textContent = "Notes"; form.append(noteHeading);
    const noteInputs = new Map();
    (choices?.notes || []).forEach(note => noteInputs.set(note.id,
      checkbox(note.title, materials.some(material => material.cardID === note.id))));
    const comment = document.createElement("textarea"); comment.rows = 3; comment.maxLength = 12000;
    comment.placeholder = "Add a comment or pasted text…"; comment.setAttribute("aria-label", "Comment to include in conversation");
    comment.addEventListener("input", changed); form.append(comment);
    form.append(button("Apply selection", () => execute({ includeProjectContext: useContext.checked,
      factIDs: [...factInputs].filter(([, input]) => input.checked).map(([id]) => id),
      noteIDs: [...noteInputs].filter(([, input]) => input.checked).map(([id]) => id),
      ...(comment.value.trim() ? { comment: comment.value } : {})
    })), button("Cancel", () => draw()));
    root.append(picker, status);
  };
  draw();
  if (current) {
    busy = true; state();
    load().then(response => { current = response.conversation; choices = response.choices; updated(current); busy = false; draw(); })
      .catch(error => { busy = false; draw(); const p = document.createElement("p"); p.textContent = error.message; root.append(p,
        button("Try again", () => { root.replaceWith(createAssistantMaterials({ conversation: current, load, save, create, updated })); })); });
  }
  return root;
}
