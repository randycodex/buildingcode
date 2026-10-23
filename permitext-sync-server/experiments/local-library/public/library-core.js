import {searchWords,searchWordForms,matchesSearchWords,searchWordsSnippet} from '/web/search-words.js';
import {searchRelevanceRank,matchingSearchDefinition,initialSearchGroupLimit,prepareSearchRelevance} from '/web/search-relevance.js';
import {offlineSourceScope,offlineSectionMetadata} from '/web/offline-storage.js';
export {searchWords,searchWordForms,offlineSectionMetadata};
export function intersect(lists){
 if(!lists.length)return[];lists.sort((a,b)=>a.length-b.length);
 return lists.slice(1).reduce((left,right)=>{const result=[];let a=0,b=0;while(a<left.length&&b<right.length){if(left[a]===right[b]){result.push(left[a]);a++;b++;}else if(left[a]<right[b])a++;else b++;}return result;},lists[0]);
}
export function documentRecord(section,chapter){
 const plainText=(section.blocks||[]).map(b=>b.plainText||'').join('\n\n').trim();
 return {...section,chapterID:chapter.id,codePrefix:chapter.codePrefix,codeVersion:chapter.codeVersion,
  codeSectionID:chapter.codeSectionID,chapterNumber:chapter.chapterNumber,plainText};
}
export function evaluateSearch(records,url,metadata){
 const query=url.searchParams.get('q')?.trim()||'',mode=url.searchParams.get('match')||'exact';
 const scope=offlineSourceScope(metadata,url),prefixes=new Set((url.searchParams.get('code')||url.searchParams.get('codes')||'').split(',').filter(Boolean));
 const version=url.searchParams.get('version'),resultSource=url.searchParams.has('resultSource')?JSON.parse(url.searchParams.get('resultSource')):null;
 const prepared=prepareSearchRelevance(query),needle=query.replace(/\s+/g,' ');
 const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').split(' ').join('\\s+');
 const phrase=new RegExp(`${/^[\p{L}\p{N}_]/u.test(needle)?'(?<![\\p{L}\\p{N}_])':''}${escaped}${/[\p{L}\p{N}_]$/u.test(needle)?'(?![\\p{L}\\p{N}_])':''}`,'iu');
 const matches=[];
 for(const record of records){
  if(scope&&!scope.permits(record)||prefixes.size&&!prefixes.has(record.codePrefix)||version&&version!=='all'&&record.codeVersion!==version||resultSource&&(record.codePrefix!==resultSource.codePrefix||record.codeVersion!==resultSource.codeVersion))continue;
  const text=[record.sectionNumber,record.title,record.headingLine,record.plainText].filter(Boolean).join(' ');
  if(mode==='words'?!matchesSearchWords(text,query):!phrase.test(text.replace(/\s+/g,' ')))continue;
  const meta=offlineSectionMetadata(record,metadata);
  const result={...meta,sourceChapterID:record.sourceChapterID||record.chapterID,navigationChapterID:record.navigationChapterID||record.chapterID,
   headerLine:record.headerLine||'',headingLine:record.headingLine||'',matchKind:phrase.test(text)?'exact':'words',
   definitionTerm:matchingSearchDefinition(record,query)||undefined,snippet:searchWordsSnippet(record.plainText||record.title,query)};
  matches.push({rank:searchRelevanceRank(record,query,mode,record.plainText,prepared),result});
 }
 matches.sort((a,b)=>a.rank-b.rank||String(a.result.chapterNumber).localeCompare(String(b.result.chapterNumber),undefined,{numeric:true,sensitivity:'base'})||String(a.result.sectionNumber).localeCompare(String(b.result.sectionNumber),undefined,{numeric:true,sensitivity:'base'})||Number(a.result.codeSectionID||0)-Number(b.result.codeSectionID||0)||a.result.id-b.result.id);
 const limit=Math.min(250,Math.max(1,Number(url.searchParams.get('limit'))||25)),offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
 if(url.searchParams.get('grouped')==='true'&&!resultSource){
  const grouped=new Map();for(const {result}of matches){const key=result.codePrefix+'|'+result.codeVersion;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(result);}
  const groups=[],results=[];for(const group of grouped.values()){const page=group.slice(0,initialSearchGroupLimit(grouped.size,limit));results.push(...page);groups.push({codePrefix:group[0].codePrefix,codeVersion:group[0].codeVersion,nextOffset:page.length,nextCandidateOffset:page.length,cursorKind:'offset',hasMore:page.length<group.length,totalResults:group.length});}
  return{query,groups,results,hasMore:groups.some(g=>g.hasMore),limited:groups.some(g=>g.hasMore),totalResults:matches.length};
 }
 const page=matches.slice(offset,offset+limit).map(m=>m.result),nextOffset=offset+page.length;
 return{query,results:page,totalResults:matches.length,hasMore:nextOffset<matches.length,limited:nextOffset<matches.length,nextOffset,nextCandidateOffset:nextOffset,cursorKind:'offset'};
}
