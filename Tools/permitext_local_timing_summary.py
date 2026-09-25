"""Summarize bounded local callback timings; never claim compositor/frame latency."""
import argparse
import json
import math
from pathlib import Path


def summarize(snapshot, expected_build):
    if snapshot.get('schemaVersion') != 1 or snapshot.get('appBuild') != expected_build:
        raise ValueError('Unexpected schema/build; do not analyze a stale snapshot')
    events = snapshot['events']
    if snapshot['droppedEvents'] != 0 or len(events) > 2048:
        raise ValueError('Truncated capture; relaunch and capture fewer interactions')
    previous_time = -1
    for index, event in enumerate(events, 1):
        timestamp = event['uptimeSeconds']
        if event['sequence'] != index or not math.isfinite(timestamp) or timestamp < previous_time:
            raise ValueError('Missing, unordered, or invalid events')
        previous_time = timestamp
    samples = []
    issues = []
    # No request identifiers are recorded. Accept only isolated sequential windows.
    def windows(start_name, end_name, conflicts, label, required=None):
        family_samples = []
        overlapping = False
        start = None
        invalid = False
        seen = set()
        for event in events:
            name = event['milestone']
            if name == start_name:
                if start is not None:
                    overlapping = True
                    issues.append(label + ': overlapping or incomplete request')
                    invalid = True
                else:
                    invalid = False
                start = event
                seen = set()
            elif start is not None:
                seen.add(name)
                if name in conflicts:
                    invalid = True
                if name == end_name:
                    if not invalid and (required is None or required in seen):
                        family_samples.append({'interval': label, 'startSequence': start['sequence'],
                                        'endSequence': event['sequence'],
                                        'milliseconds': (event['uptimeSeconds'] - start['uptimeSeconds']) * 1000})
                    else:
                        issues.append(label + ': ambiguous, cancelled, failed or incomplete outcome')
                    start = None
        if start is not None:
            issues.append(label + ': missing ending milestone')
        if not overlapping:
            samples.extend(family_samples)
    windows('allEditionSearchStarted', 'allEditionSearchFinished',
            {'allEditionSearchCancelled', 'allEditionSearchFailed', 'allEditionSearchPublishedPartial', 'searchInputScheduled'},
            'search-work-to-finished-callback', 'allEditionSearchPublishedComplete')
    windows('searchResultOpenRequested', 'passageContentAppeared',
            {'chapterOpenRequested', 'searchInputScheduled'}, 'result-request-to-body-onAppear',
            'searchResultDestinationPrepared')
    windows('searchResultOpenRequested', 'passageReferencesReady',
            {'chapterOpenRequested', 'searchInputScheduled'}, 'result-request-to-references-ready',
            'searchResultDestinationPrepared')
    windows('chapterOpenRequested', 'nativeChapterContentAppeared',
            {'searchResultOpenRequested'}, 'chapter-request-to-native-onAppear', 'chapterDestinationPrepared')
    return {'runUUID': snapshot['runUUID'], 'build': expected_build, 'eventCount': len(events),
            'cacheHitEvents': sum(e['milestone'] == 'completedSearchCacheHit' for e in events),
            'samples': samples, 'issues': issues,
            'boundary': 'Application callbacks in a profiling build. onAppear is not displayed-frame timing. Search excludes input debounce. No CPU/memory or percentile claim. Inspect visible correctness separately.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--expected-build', required=True)
    args = parser.parse_args()
    print(json.dumps(summarize(json.loads(args.snapshot.read_text()), args.expected_build), indent=2))
