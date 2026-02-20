// SessionStellar - Scoring Engine (standalone, zero network dependencies)
// Uses DEFAULT_WEIGHTS unless customWeights or weightProvider are passed.
import {
  OrchestrationSignals,
  ScoringMetrics,
  ScoringWeights,
  SessionScore,
} from './types.js';

export type WeightProvider = () => Promise<ScoringWeights | null>;

export class ScoringEngine {
  static readonly DEFAULT_WEIGHTS: ScoringWeights = {
    skillDiversity: 0.2,
    decisionDepth: 0.25,
    errorRecoveryRate: 0.2,
    compoundLearningSignals: 0.2,
    orchestrationMastery: 0.15,
  };

  static async score(
    signals: OrchestrationSignals,
    sessionId: string,
    customWeights?: ScoringWeights,
    weightProvider?: WeightProvider
  ): Promise<SessionScore> {
    let weights: ScoringWeights;

    if (customWeights) {
      weights = customWeights;
    } else if (weightProvider) {
      weights = (await weightProvider()) ?? this.DEFAULT_WEIGHTS;
    } else {
      weights = this.DEFAULT_WEIGHTS;
    }

    const breakdown: ScoringMetrics = {
      skillDiversity: this.calculateSkillDiversity(signals),
      decisionDepth: this.calculateDecisionDepth(signals),
      errorRecoveryRate: this.calculateErrorRecoveryRate(signals),
      compoundLearningSignals: this.calculateCompoundLearningSignals(signals),
      orchestrationMastery: this.calculateOrchestrationMastery(signals),
    };

    const overallScore =
      breakdown.skillDiversity * weights.skillDiversity +
      breakdown.decisionDepth * weights.decisionDepth +
      breakdown.errorRecoveryRate * weights.errorRecoveryRate +
      breakdown.compoundLearningSignals * weights.compoundLearningSignals +
      breakdown.orchestrationMastery * weights.orchestrationMastery;

    return {
      sessionId,
      overallScore: Math.round(overallScore * 10) / 10,
      breakdown,
      weights,
      version: '1.0',
      scoredAt: new Date(),
    };
  }

  static calculateSkillDiversity(signals: OrchestrationSignals): number {
    const uniqueSkills = new Set(signals.skillsInvoked).size;
    const complexity = signals.metadata.complexity || 'moderate';
    const expectedSkills = { simple: 2, moderate: 5, complex: 10 };
    return Math.min((uniqueSkills / expectedSkills[complexity]) * 100, 100);
  }

  static calculateDecisionDepth(signals: OrchestrationSignals): number {
    const decisions = signals.decisionPoints;
    if (decisions.length === 0) return 0;

    const quantityScore = Math.min((decisions.length / 5) * 100, 100);
    const avgTradeoffs = decisions.reduce((sum, d) => sum + d.tradeoffs.length, 0) / decisions.length;
    const depthScore = Math.min((avgTradeoffs / 3) * 100, 100);
    const withChosenPath = decisions.filter(d => d.chosenPath && d.chosenPath !== 'Not specified').length;
    const clarityScore = (withChosenPath / decisions.length) * 100;

    return quantityScore * 0.3 + depthScore * 0.4 + clarityScore * 0.3;
  }

  static calculateErrorRecoveryRate(signals: OrchestrationSignals): number {
    const errors = signals.errorsRecovered;
    if (errors.length === 0) return 70;
    const withRecovery = errors.filter(e => e.recovery && e.recovery !== 'Not specified').length;
    return (withRecovery / errors.length) * 100;
  }

  static calculateCompoundLearningSignals(signals: OrchestrationSignals): number {
    const learnings = signals.compoundLearnings.length;
    if (learnings === 0) return 0;
    return Math.min((learnings / 5) * 100, 100);
  }

  static calculateOrchestrationMastery(signals: OrchestrationSignals): number {
    const agents = signals.agentsSpawned;
    const skills = signals.skillsInvoked;

    if (agents.length === 0) return Math.min((skills.length / 10) * 20, 20);

    const quantityScore = Math.min((agents.length / 5) * 100, 100);
    const agentSkillRatio = agents.length / Math.max(skills.length, 1);
    let qualityScore = 0;
    if (agentSkillRatio >= 0.3 && agentSkillRatio <= 0.7) qualityScore = 100;
    else if (agentSkillRatio < 0.3) qualityScore = (agentSkillRatio / 0.3) * 100;
    else qualityScore = (1 - (agentSkillRatio - 0.7) / 0.3) * 100;

    return Math.max(quantityScore * 0.6 + qualityScore * 0.4, 0);
  }

  static classifyQuality(score: number): {
    tier: 'poor' | 'fair' | 'good' | 'excellent' | 'exceptional';
    description: string;
  } {
    if (score >= 90) return { tier: 'exceptional', description: 'Top 5% — Production-ready orchestration mastery' };
    if (score >= 80) return { tier: 'excellent', description: 'Top 20% — Strong orchestration patterns' };
    if (score >= 70) return { tier: 'good', description: 'Above average — Solid execution' };
    if (score >= 60) return { tier: 'fair', description: 'Functional — Room for improvement' };
    return { tier: 'poor', description: 'Below benchmark — Needs significant refinement' };
  }

  static getExpectedScore(complexity: 'simple' | 'moderate' | 'complex'): { min: number; target: number; excellent: number } {
    const benchmarks = {
      simple: { min: 60, target: 75, excellent: 90 },
      moderate: { min: 70, target: 80, excellent: 92 },
      complex: { min: 75, target: 85, excellent: 95 },
    };
    return benchmarks[complexity];
  }
}

export async function scoreSession(
  signals: OrchestrationSignals,
  sessionId: string,
  customWeights?: ScoringWeights,
  weightProvider?: WeightProvider
): Promise<SessionScore> {
  return ScoringEngine.score(signals, sessionId, customWeights, weightProvider);
}
