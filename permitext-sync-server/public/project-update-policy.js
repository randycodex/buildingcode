// Local eligibility only. This policy never polls or creates network requests.
export function projectUpdateApplyBlocker({ready, visible, online, focusedEditor, dirtyEditor, pendingWrites, conflict, dialogOpen, interacting}) {
  if (!ready || !visible || !online) return 'unavailable';
  if (conflict || dirtyEditor || pendingWrites) return 'review';
  if (dialogOpen || interacting) return 'busy';
  if (focusedEditor) return 'editing';
  return '';
}
