import test from 'node:test'
import assert from 'node:assert/strict'
import { recruitmentStatus, campusDay, formatDirectoryDate } from '../src/utils/recruitment.ts'

test('missing, invalid, and reversed dates never enable applications', () => {
    for (const [start, end] of [[null, null], ['2027-08-01', null], ['2027-02-30', '2027-03-01'], ['2027-08-20', '2027-08-10']]) {
        assert.equal(recruitmentStatus(start, end), 'not_announced')
    }
})
test('recruitment stays open through the final day in Asia/Kolkata', () => {
    assert.equal(recruitmentStatus('2027-08-01', '2027-08-12', new Date('2027-07-31T18:29:59Z')), 'upcoming')
    assert.equal(recruitmentStatus('2027-08-01', '2027-08-12', new Date('2027-07-31T18:30:00Z')), 'open')
    assert.equal(recruitmentStatus('2027-08-01', '2027-08-12', new Date('2027-08-12T18:29:59Z')), 'ending_today')
    assert.equal(recruitmentStatus('2027-08-01', '2027-08-12', new Date('2027-08-12T18:30:00Z')), 'closed')
})
test('calendar formatting uses campus dates independent of the client timezone', () => {
    assert.equal(campusDay(new Date('2027-08-01T20:00:00Z')), '2027-08-02')
    assert.match(formatDirectoryDate('2027-08-12')!, /12 Aug 2027/)
    assert.equal(formatDirectoryDate('invalid'), undefined)
})
