// SessionStellar Core Types
import { z } from 'zod';

// ============================================================================
// SESSION PARSER
// ============================================================================

export const SessionFileSchema = z.object({
  content: z.string().min(1, 'File content cannot be empty'),
  format: z.enum(['markdown', 'text', 'jsonl']),
  filename: z.string(),
  uploadedAt: z.date().default(() => new Date()),
});

export const DecisionPointSchema = z.object({
  description: z.string(),
  tradeoffs: z.array(z.string()).default([]),
  chosenPath: z.string(),
});

export const ErrorRecoverySchema = z.object({
  error: z.string(),
  recovery: z.string(),
});

export const OrchestrationSignalsSchema = z.object({
  skillsInvoked: z.array(z.string()).default([]),
  agentsSpawned: z.array(z.string()).default([]),
  decisionPoints: z.array(DecisionPointSchema).default([]),
  errorsRecovered: z.array(ErrorRecoverySchema).default([]),
  compoundLearnings: z.array(z.string()).default([]),
  metadata: z.object({
    duration: z.number().optional(),
    projectType: z.string().optional(),
    complexity: z.enum(['simple', 'moderate', 'complex']).optional(),
  }).default({}),
});

export type SessionFile = z.infer<typeof SessionFileSchema>;
export type OrchestrationSignals = z.infer<typeof OrchestrationSignalsSchema>;
export type DecisionPoint = z.infer<typeof DecisionPointSchema>;
export type ErrorRecovery = z.infer<typeof ErrorRecoverySchema>;

// ============================================================================
// SCORER ENGINE
// ============================================================================

export const ScoringMetricsSchema = z.object({
  skillDiversity: z.number().min(0).max(100),
  decisionDepth: z.number().min(0).max(100),
  errorRecoveryRate: z.number().min(0).max(100),
  compoundLearningSignals: z.number().min(0).max(100),
  orchestrationMastery: z.number().min(0).max(100),
});

export const ScoringWeightsSchema = z.object({
  skillDiversity: z.number().default(0.2),
  decisionDepth: z.number().default(0.25),
  errorRecoveryRate: z.number().default(0.2),
  compoundLearningSignals: z.number().default(0.2),
  orchestrationMastery: z.number().default(0.15),
});

export const SessionScoreSchema = z.object({
  sessionId: z.string().uuid(),
  overallScore: z.number().min(0).max(100),
  breakdown: ScoringMetricsSchema,
  weights: ScoringWeightsSchema,
  version: z.string().default('1.0'),
  scoredAt: z.date().default(() => new Date()),
});

export type ScoringMetrics = z.infer<typeof ScoringMetricsSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type SessionScore = z.infer<typeof SessionScoreSchema>;
