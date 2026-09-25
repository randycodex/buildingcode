import unittest
from permitext_local_timing_summary import summarize


def capture(names):
    return dict(schemaVersion=1, appBuild='41.17', runUUID='test-run', droppedEvents=0,
                events=[dict(sequence=i+1, uptimeSeconds=i/10, milestone=name) for i, name in enumerate(names)])


class SummaryTests(unittest.TestCase):
    def test_complete_and_partial_search(self):
        good=capture(['allEditionSearchStarted','completedSearchCacheHit','allEditionSearchPublishedComplete','allEditionSearchFinished'])
        result=summarize(good,'41.17')
        self.assertAlmostEqual(result['samples'][0]['milliseconds'],300)
        self.assertEqual(result['cacheHitEvents'],1)
        good['events'][2]['milestone']='allEditionSearchPublishedPartial'
        self.assertEqual(summarize(good,'41.17')['samples'],[])

    def test_result_callbacks_separate(self):
        result=summarize(capture(['searchResultOpenRequested','searchResultDestinationPrepared','passageContentAppeared','passageReferencesReady']),'41.17')
        self.assertEqual(len(result['samples']),2)
        self.assertAlmostEqual(result['samples'][0]['milliseconds'],200)
        self.assertAlmostEqual(result['samples'][1]['milliseconds'],300)

    def test_overlapping_requests_cannot_be_paired(self):
        result=summarize(capture(['searchResultOpenRequested','searchResultOpenRequested','searchResultDestinationPrepared','passageContentAppeared','searchResultOpenRequested','passageContentAppeared']),'41.17')
        self.assertEqual(result['samples'],[])
        self.assertTrue(result['issues'])

    def test_restored_chapter_endpoint(self):
        result=summarize(capture(['chapterOpenRequested','chapterDestinationPrepared','nativeChapterRestorationCompleted']),'41.17')
        self.assertEqual(len(result['samples']),1)
        self.assertEqual(result['samples'][0]['endMilestone'],'nativeChapterRestorationCompleted')

    def test_missing_and_invalid_capture(self):
        data=capture(['chapterOpenRequested'])
        self.assertEqual(summarize(data,'41.17')['samples'],[])
        for change in [dict(droppedEvents=1),dict(appBuild='old')]:
            with self.assertRaises(ValueError): summarize(dict(data,**change),'41.17')
        data['events'][0]['sequence']=2
        with self.assertRaises(ValueError): summarize(data,'41.17')


if __name__=='__main__': unittest.main()
