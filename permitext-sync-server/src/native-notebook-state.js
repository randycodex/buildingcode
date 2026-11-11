// The server includes these inert table defaults in its saved document, while
// BlockNote's table schema exposes only textColor. Restore missing defaults at
// the native boundary so an acknowledgement cannot manufacture another edit.
export function nativeNotebookDocumentSnapshot(document) {
  const blocks = values => values.map(block => ({
    ...block,
    ...(block.type === "table" ? { props: {
      backgroundColor: "default", textColor: "default", textAlignment: "left",
      ...block.props
    } } : {}),
    ...(Array.isArray(block.children) ? { children: blocks(block.children) } : {})
  }));
  return { ...document, document: blocks(document.document || []) };
}
