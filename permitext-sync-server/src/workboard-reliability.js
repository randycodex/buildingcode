export function boardToRetry(newerPendingBoard, failedBoard) {
  return newerPendingBoard || failedBoard;
}

export function shouldUseRemoteBoard(localBoard, remoteBoard) {
  if (!remoteBoard) return false;
  if (!localBoard) return true;
  if (!localBoard.syncedAt) return false;
  return Date.parse(remoteBoard.updatedAt || 0) >= Date.parse(localBoard.updatedAt || 0);
}

export function localBoardNeedsSync(localBoard, remoteBoard) {
  if (!localBoard) return false;
  if (!localBoard.syncedAt) return true;
  return Date.parse(localBoard.updatedAt || 0) > Date.parse(remoteBoard?.updatedAt || 0);
}
