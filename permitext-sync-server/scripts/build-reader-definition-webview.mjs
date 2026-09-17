import {readFile,writeFile} from 'node:fs/promises';
const matcher=await readFile(new URL('../public/definition-matcher.js',import.meta.url),'utf8');
const popup=await readFile(new URL('../public/reader-definition-popover.js',import.meta.url),'utf8');
const css=await readFile(new URL('../public/reader-definition-popover.css',import.meta.url),'utf8');
const strip=source=>source.replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'');
const script=`// Generated from the shared web definition components.\n(()=>{\n${strip(matcher)}\n${strip(popup)}\nwindow.permitextInstallDefinitions=(entries,isDark)=>{\n const style=document.createElement('style');style.textContent=${JSON.stringify(css)}+(isDark?'':'.reader-definition-popover{background:#fff;color:#111;border-color:#ccc}.reader-definition-source,.reader-definition-reference-state{color:#555}.reader-definition-close{background:#eee}');document.head.append(style);\n const blocks=[...document.querySelectorAll('p,li,td,th,.rbox > div')].filter(node=>!node.querySelector('p,li,td,th,.rbox > div'));\n const headings=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];\n for(const block of blocks){\n  const heading=headings.filter(h=>Boolean(h.compareDocumentPosition(block)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);\n  if(heading&&/\\bdefinitions[.:]?\\s*$/i.test(heading.textContent))continue;\n  const sectionNumber=heading?.textContent.trim().match(/^(?:§\\s*|Section\\s+)?(?:[A-Z]+\\s+)?((?:\\d{2}-)?[A-Z]?\\d+(?:\\.\\d+)*)\\b/i)?.[1];\n  installDefinitionLinks(block,entries.filter(entry=>definitionAppliesToSection(entry,sectionNumber)),{sectionNumber});\n }\n};\n})();\n`;
const target=new URL('../../NYC CC APP/permitext/Resources/CodeContent/reader-definition-webview.js',import.meta.url);
if(process.argv.includes('--check')) {
  if(await readFile(target,'utf8')!==script)throw Error('Bundled definition WebView component is stale');
  console.log('Shared definition WebView component matches web sources');
} else {
  await writeFile(target,script);console.log('Wrote shared definition WebView component');
}
