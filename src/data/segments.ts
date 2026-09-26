import type { Segment, SegmentId } from './types';

export const SEGMENTS: Record<SegmentId, Segment> = {
  students: {
    id: 'students', name: 'Students', elasticity: 2.0, budget: 11.5, qualityAppeal: 0.0, qualityWeight: 0.3,
    waitTolerance: { lunch: 10, dinner: 10 }, mealLength: { lunch: 25, dinner: 45 }, partySize: 3.0,
    likedTags: ['cheesy', 'spicy', 'meaty'], speedAppealAtLunch: true,
  },
  families: {
    id: 'families', name: 'Families', elasticity: 1.5, budget: 12, qualityAppeal: 0.1, qualityWeight: 0.35,
    waitTolerance: { lunch: 12, dinner: 12 }, mealLength: { lunch: 40, dinner: 40 }, partySize: 3.8,
    likedTags: ['classic', 'kid friendly'], speedAppealAtLunch: false,
  },
  professionals: {
    id: 'professionals', name: 'Professionals', elasticity: 1.0, budget: 16, qualityAppeal: 0.35, qualityWeight: 0.4,
    waitTolerance: { lunch: 8, dinner: 15 }, mealLength: { lunch: 30, dinner: 50 }, partySize: 2.2,
    likedTags: ['classic', 'veggie'], speedAppealAtLunch: true,
  },
  foodies: {
    id: 'foodies', name: 'Foodies', elasticity: 0.6, budget: 28, qualityAppeal: 1.0, qualityWeight: 0.6,
    waitTolerance: { lunch: 20, dinner: 20 }, mealLength: { lunch: 60, dinner: 90 }, partySize: 2.0,
    likedTags: ['artisan', 'seasonal'], speedAppealAtLunch: false,
  },
  seniors: {
    id: 'seniors', name: 'Seniors', elasticity: 1.2, budget: 15, qualityAppeal: 0.3, qualityWeight: 0.4,
    waitTolerance: { lunch: 15, dinner: 15 }, mealLength: { lunch: 50, dinner: 50 }, partySize: 2.0,
    likedTags: ['classic', 'veggie'], speedAppealAtLunch: false,
  },
  tourists: {
    id: 'tourists', name: 'Tourists', elasticity: 0.8, budget: 20, qualityAppeal: 0.5, qualityWeight: 0.35,
    waitTolerance: { lunch: 15, dinner: 15 }, mealLength: { lunch: 45, dinner: 45 }, partySize: 2.5,
    likedTags: ['classic', 'artisan'], speedAppealAtLunch: false,
  },
};

export const SEGMENT_IDS = Object.keys(SEGMENTS) as SegmentId[];
