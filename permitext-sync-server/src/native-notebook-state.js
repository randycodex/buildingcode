// Match BlockNote's presentation defaults to the server's saved document so
// acknowledging a save preserves the live selection and undo history.
export function nativeNotebookDocumentSnapshot(document) {
  const blocks = values => values.map(block => {
    const result = { ...block };
    if (block.props?.lineSpacing === "normal") {
      const { lineSpacing, ...props } = block.props;
      result.props = props;
    }
    if (block.type === "table") {
      result.props = {
        backgroundColor: "default", textColor: "default", textAlignment: "left", ...block.props
      };
    }
    if (Array.isArray(block.children)) result.children = blocks(block.children);
    return result;
  });
  return { ...document, document: blocks(document.document || []) };
}
