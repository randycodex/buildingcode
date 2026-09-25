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


    def test_resource_samples_and_gap(self):
        data=capture([])
        data.update(resourceCapacity=600,resourceDroppedSamples=0,resourceSamples=[
            dict(sequence=1,uptimeSeconds=1,kind='active'),
            dict(sequence=2,uptimeSeconds=2,kind='sample',thermalState=0,residentBytes=100,residentPeakBytes=120,physicalFootprintBytes=90),
            dict(sequence=3,uptimeSeconds=3,kind='inactive'),
            dict(sequence=4,uptimeSeconds=10,kind='active'),
            dict(sequence=5,uptimeSeconds=11,kind='sample',thermalState=1,residentBytes=110,residentPeakBytes=125,physicalFootprintBytes=95)])
        result=summarize(data,'41.17')['resources']
        self.assertEqual(result['sampleCount'],2)
        self.assertEqual(result['bytes']['physicalFootprintBytes']['maximum'],95)
        self.assertEqual(len(result['transitions']),3)
        data['resourceSamples'][4]['machError']=5
        with self.assertRaises(ValueError): summarize(data,'41.17')
        for key in ('residentBytes','residentPeakBytes','physicalFootprintBytes'): del data['resourceSamples'][4][key]
        self.assertEqual(summarize(data,'41.17')['resources']['failedReadCount'],1)
        data['resourceDroppedSamples']=1
        with self.assertRaises(ValueError): summarize(data,'41.17')

    def test_invalid_resource_state(self):
        data=capture([])
        data.update(resourceCapacity=600,resourceDroppedSamples=0,resourceSamples=[dict(sequence=1,uptimeSeconds=1,kind='sample')])
        with self.assertRaises(ValueError): summarize(data,'41.17')
        self.assertIsNone(summarize(capture([]),'41.17')['resources'])


if __name__=='__main__': unittest.main()
