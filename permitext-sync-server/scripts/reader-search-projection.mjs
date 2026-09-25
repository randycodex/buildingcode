import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { parseFragment, serialize, serializeOuter } from 'parse5';
import { rewriteStructuredCodeLinks } from '../public/code-references.js';

const functions = [
  'escapeRegExp', 'sectionDisplayTitle', 'normalizeAnnotationBlockID', 'annotatedBlocksForSection',
  'normalizedSpecialtySectionRoot', 'specialtyProvisionMarker',
  'specialtyProvisionHeading', 'specialtyProvisionHTML', 'organizedSpecialtyProvisionBlocks',
  'codeBlockHasVisibleContent', 'splitAnnotatedCodeBlock', 'codeFigureURL', 'rewriteCodeHTML',
  'plainTextFromHTML', 'plainTextForSearchBlock'
];

// This deliberately supports only the DOM operations used by the extracted
// production functions. Unknown selectors fail generation rather than silently
// producing an approximate index. parse5 supplies browser HTML/entity parsing.
function minimalDocument() {
  const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value || '';
  const setAttr = (node, name, value) => {
    const existing = node.attrs.find(item => item.name === name);
    if (existing) existing.value = String(value);
    else node.attrs.push({ name, value: String(value) });
  };
  const text = node => node.nodeName === '#text' ? node.value
    : node.nodeName === '#comment' ? '' : (node.childNodes || []).map(text).join('');
  function wrap(node) {
    return {
      _node: node,
      get id() { return attr(node, 'id'); },
      get className() { return attr(node, 'class'); },
      set className(value) { setAttr(node, 'class', value); },
      get textContent() { return text(node); },
      set textContent(value) {
        node.childNodes = value === '' ? [] : [{ nodeName: '#text', value: String(value), parentNode: node }];
      },
      get innerHTML() { return serialize(node); },
      set innerHTML(value) {
        const fragment = parseFragment(node, String(value));
        node.childNodes = fragment.childNodes;
        node.childNodes.forEach(child => { child.parentNode = node; });
      },
      get outerHTML() { return serializeOuter(node); },
      append(...children) {
        for (const child of children) {
          const raw = child._node;
          if (!raw) throw new Error('Unsupported projection append');
          raw.parentNode = node;
          node.childNodes.push(raw);
        }
      },
      querySelectorAll(selector) {
        if (!['.Normal-Level[id]', '.rbox[id]', 'img, table'].includes(selector)) {
          throw new Error(`Unsupported projection selector: ${selector}`);
        }
        const result = [];
        const visit = current => {
          for (const child of current.childNodes || []) {
            const matches = selector === 'img, table'
              ? ['img', 'table'].includes(child.tagName)
              : child.attrs?.some(item => item.name === 'id') &&
                attr(child, 'class').split(/\s+/).includes(selector.slice(1, -4));
            if (matches) result.push(wrap(child));
            visit(child);
          }
        };
        visit(node);
        return result;
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    };
  }
  return {
    createElement(tagName) {
      return wrap({ nodeName: tagName, tagName, namespaceURI: 'http://www.w3.org/1999/xhtml', attrs: [], childNodes: [], parentNode: null });
    },
    createTextNode(value) { return wrap({ nodeName: '#text', value: String(value), parentNode: null }); }
  };
}

export async function createReaderSearchProjection() {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const extracted = functions.map(name => {
    // Production top-level declarations and their closing braces occupy column 0.
    const match = source.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
    if (!match) throw new Error(`Missing Reader projection function: ${name}`);
    return match[0];
  }).join('\n\n');
  const dependencies = await readFile(new URL('../public/code-references.js', import.meta.url), 'utf8');
  const adapter = await readFile(new URL(import.meta.url), 'utf8');
  const generator = await readFile(new URL('./generate-reader-search-index.mjs', import.meta.url), 'utf8');
  const projectionRevision = createHash('sha256').update(extracted).update(dependencies).update(adapter).update(generator).digest('hex');
  const context = vm.createContext({ document: minimalDocument(), rewriteStructuredCodeLinks,
    zoningCodePrefix: 'ZR', offlineFeatureMetadata: { assetVersion: 'projection' } });
  vm.runInContext(extracted, context);
  return {
    projectionRevision,
    displayTitle(section) { return context.sectionDisplayTitle(section.sectionNumber, section.title); },
    projectSection(section) {
      const blocks = context.annotatedBlocksForSection(section);
      return Array.from(blocks, (block, index) => ({
        blockID: context.normalizeAnnotationBlockID(block?.id || block?.tableID || block?.imageID || `block-${index + 1}`),
        text: context.plainTextForSearchBlock(block).replace(/\s+/g, ' ').trim()
      }));
    }
  };
}
