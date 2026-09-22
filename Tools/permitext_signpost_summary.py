"""Summarize an xctrace os-signpost XML export without copying message payloads.

Export first with xctrace export --input RUN.trace --xpath
'/trace-toc/run[@number="1"]/data/table[@schema="os-signpost"]' --output RUN.xml.
This reports application boundaries, not OS launch latency or frame presentation.
"""
import argparse
import json
import xml.etree.ElementTree as ET


def summarize(path):
    root = ET.parse(path).getroot()
    references = {element.get('id'): element for element in root.iter() if element.get('id')}

    def resolve(element):
        return references[element.get('ref')] if element.get('ref') else element

    def value(element):
        element = resolve(element)
        return element.get('fmt', element.text or '')

    events = []
    intervals = []
    pending = {}
    for node in root.findall('node'):
        schema = node.find('schema')
        if schema is None or schema.get('name') != 'os-signpost':
            continue
        columns = [column.findtext('mnemonic') for column in schema.findall('col')]
        for row in node.findall('row'):
            cells = dict(zip(columns, row))
            if value(cells['subsystem']) != 'com.nyccc.app':
                continue
            event = {
                'timeNs': int(resolve(cells['time']).text),
                'event': value(cells['event-type']),
                'name': value(cells['name']),
                'category': value(cells['category']),
                'signpostID': value(cells['identifier']),
            }
            events.append(event)
            # Same identifiers in separate processes are independent intervals.
            key = (value(cells['process']), event['category'], event['name'], event['signpostID'])
            if event['event'] == 'Begin':
                pending[key] = event
            elif event['event'] == 'End' and key in pending:
                start = pending.pop(key)
                intervals.append({'name': event['name'], 'category': event['category'],
                                  'startNs': start['timeNs'], 'endNs': event['timeNs'],
                                  'durationMs': (event['timeNs'] - start['timeNs']) / 1_000_000})
    return {'source': str(path), 'events': events, 'intervals': intervals,
            'unmatchedBegins': len(pending),
            'boundary': 'Application signposts; inspect trace completion and rendered correctness separately.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xml', nargs='+')
    args = parser.parse_args()
    for path in args.xml:
        print(json.dumps(summarize(path)))
