import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeVideoCost, isValidStateTransition, isDeterministicPreSubmissionError } from '../server';

describe('Veyro.ai Credit System Audit', () => {
  describe('computeVideoCost', () => {
    it('should return 10 for duration <= 20s', () => {
      expect(computeVideoCost(5)).toBe(10);
      expect(computeVideoCost(20)).toBe(10);
    });

    it('should return 15 for 20s < duration <= 35s', () => {
      expect(computeVideoCost(21)).toBe(15);
      expect(computeVideoCost(35)).toBe(15);
    });

    it('should return 20 for duration > 35s', () => {
      expect(computeVideoCost(36)).toBe(20);
      expect(computeVideoCost(60)).toBe(20);
    });

    it('should handle undefined or invalid duration by defaulting to 30s (15 credits)', () => {
      expect(computeVideoCost(undefined)).toBe(15);
      expect(computeVideoCost(NaN)).toBe(15);
    });
  });

  describe('isValidStateTransition', () => {
    it('should allow valid transitions', () => {
      expect(isValidStateTransition('starting', 'processing')).toBe(true);
      expect(isValidStateTransition('processing', 'completed')).toBe(true);
      expect(isValidStateTransition('failed', 'refunded')).toBe(true);
    });

    it('should block invalid transitions (e.g. from completed)', () => {
      expect(isValidStateTransition('completed', 'failed')).toBe(false);
      expect(isValidStateTransition('completed', 'refunded')).toBe(false);
    });

    it('should allow the same state (idempotency)', () => {
      expect(isValidStateTransition('processing', 'processing')).toBe(true);
    });
  });

  describe('isDeterministicPreSubmissionError', () => {
    it('should return true for deterministic client/auth errors', () => {
      expect(isDeterministicPreSubmissionError({ status: 400 })).toBe(true);
      expect(isDeterministicPreSubmissionError({ message: 'Invalid argument' })).toBe(true);
      expect(isDeterministicPreSubmissionError({ status: 403 })).toBe(true);
    });

    it('should return false for ambiguous network/server errors', () => {
      expect(isDeterministicPreSubmissionError({ status: 504 })).toBe(false);
      expect(isDeterministicPreSubmissionError({ message: 'timeout' })).toBe(false);
      expect(isDeterministicPreSubmissionError({ message: 'socket hang up' })).toBe(false);
    });
  });
});
