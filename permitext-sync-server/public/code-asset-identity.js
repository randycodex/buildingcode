// Plain paragraphs keep their original shape and transfer size. Only blocks
// that can render figures need a pin; chapters retain the overall identity.
export function withCodeAssetRevision(block, assetRevision) {
  return block?.imageID || /(?:<img\b|assets\/)/i.test(block?.html || "")
    ? { ...block, assetRevision } : block;
}
