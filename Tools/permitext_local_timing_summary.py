"""Summarize bounded local callback timings; never claim compositor/frame latency."""
import argparse
import json
import math
from pathlib import Path



def summarize_resources(snapshot):
    if 'resourceSamples' not in snapshot:
        return None
    rows = snapshot['resourceSamples']
    if snapshot.get('resourceCapacity') != 600 or snapshot.get('resourceDroppedSamples') != 0 or len(rows) > 600:
        raise ValueError('Invalid or truncated resource capture')
    previous = -1
    active = False
    samples = []
    failures = 0
    transitions = []
    metrics = ('residentBytes', 'residentPeakBytes', 'physicalFootprintBytes')
    for index, row in enumerate(rows, 1):
        timestamp = row['uptimeSeconds']
        if row['sequence'] != index or not math.isfinite(timestamp) or timestamp < previous:
            raise ValueError('Invalid resource ordering/time')
        previous = timestamp
        kind = row['kind']
        if kind in ('active', 'inactive'):
            active = kind == 'active'
            transitions.append({'state': kind, 'uptimeSeconds': timestamp})
            continue
        if kind != 'sample' or not active:
            raise ValueError('Resource sample outside active interval')
        thermal = row.get('thermalState')
        if thermal is not None and (type(thermal) is not int or thermal not in range(4)):
            raise ValueError('Invalid thermal state')
        if row.get('machError') not in (None, 0):
            if any(row.get(key) is not None for key in metrics):
                raise ValueError('Failed resource read must not supply memory values')
            failures += 1
            continue
        for key in metrics:
            value = row.get(key)
            if type(value) is not int or value < 0:
                raise ValueError('Successful resource read missing valid memory values')
        samples.append(row)
    summary = {'sampleCount': len(samples), 'failedReadCount': failures, 'transitions': transitions,
               'boundary': 'Sampled process memory includes recorder overhead. Resident peak spans process lifetime; sampled footprint maximum may miss between-sample peaks. No CPU, frame, stall, or leak attribution.'}
    if samples:
        summary['sampleSpanSeconds'] = samples[-1]['uptimeSeconds'] - samples[0]['uptimeSeconds']
        summary['thermalStates'] = sorted({r['thermalState'] for r in samples if r.get('thermalState') is not None})
        summary['bytes'] = {key: {'first': samples[0][key], 'last': samples[-1][key],
                                 'minimum': min(r[key] for r in samples), 'maximum': max(r[key] for r in samples)} for key in metrics}
    return summary


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
                if name in ([end_name] if isinstance(end_name, str) else end_name):
                    if not invalid and (required is None or required in seen):
                        family_samples.append({'interval': label, 'startSequence': start['sequence'],
                                        'endSequence': event['sequence'], 'endMilestone': name,
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
    windows('chapterOpenRequested', ['nativeChapterContentAppeared', 'nativeChapterRestorationCompleted'],
            {'searchResultOpenRequested'}, 'chapter-request-to-native-visible-callback', 'chapterDestinationPrepared')
    return {'runUUID': snapshot['runUUID'], 'build': expected_build, 'eventCount': len(events),
            'cacheHitEvents': sum(e['milestone'] == 'completedSearchCacheHit' for e in events),
            'samples': samples, 'issues': issues, 'resources': summarize_resources(snapshot),
            'boundary': 'Application callbacks in a profiling build. onAppear is not displayed-frame timing. Search excludes input debounce. Callback samples alone make no CPU/memory or percentile claim. Resource evidence, when present, is reported separately. Inspect visible correctness separately.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--expected-build', required=True)
    args = parser.parse_args()
    print(json.dumps(summarize(json.loads(args.snapshot.read_text()), args.expected_build), indent=2))
