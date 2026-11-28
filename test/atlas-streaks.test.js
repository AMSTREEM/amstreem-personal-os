'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateHabitStreak, weekStartFor } = require('../server/atlas-streaks');

test('habit streak allows one recovery day in each Monday-based week', () => {
 const checked = ['2026-11-28','2026-11-27','2026-11-25','2026-11-24','2026-11-23'];
 assert.equal(calculateHabitStreak(checked,'2026-11-28'),5);
 assert.equal(weekStartFor('2026-11-28'),'2026-11-23');
});

test('habit streak stops at the second missed day in one week', () => {
 const checked = ['2026-11-28','2026-11-25','2026-11-24','2026-11-23'];
 assert.equal(calculateHabitStreak(checked,'2026-11-28'),1);
});

test('habit streak starts from yesterday when today is not checked yet', () => {
 assert.equal(calculateHabitStreak(['2026-11-27','2026-11-26'],'2026-11-28'),2);
});

test('habit streak rejects impossible calendar dates', () => { assert.throws(() => calculateHabitStreak([], '2026-02-31'), /YYYY-MM-DD/); });

test('habit streak is zero when there are no recent check-ins', () => {
 assert.equal(calculateHabitStreak([],'2026-11-28'),0);
});
