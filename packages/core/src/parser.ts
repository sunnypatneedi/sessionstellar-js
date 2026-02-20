// SessionStellar - Session File Parser
import { OrchestrationSignals, OrchestrationSignalsSchema, DecisionPoint, ErrorRecovery } from './types.js';

export class SessionParser {
  static parse(content: string, format: 'markdown' | 'text' | 'jsonl'): OrchestrationSignals {
    const signals: OrchestrationSignals = {
      skillsInvoked: [],
      agentsSpawned: [],
      decisionPoints: [],
      errorsRecovered: [],
      compoundLearnings: [],
      metadata: {},
    };

    if (format === 'jsonl') {
      return this.parseJSONL(content);
    }

    signals.skillsInvoked = this.extractSkills(content);
    signals.agentsSpawned = this.extractAgents(content);
    signals.decisionPoints = this.extractDecisions(content);
    signals.errorsRecovered = this.extractErrors(content);
    signals.compoundLearnings = this.extractLearnings(content);
    signals.metadata = this.extractMetadata(content);

    return OrchestrationSignalsSchema.parse(signals);
  }

  private static isValidSkill(token: string): boolean {
    if (token.includes('/') || token.includes('\\')) return false;
    if (/\.(ts|tsx|js|jsx|md|json|sql|css|html|yml|yaml|txt)$/i.test(token)) return false;

    const excludeList = [
      'src', 'lib', 'components', 'app', 'utils', 'pages', 'api',
      'node', 'modules', 'dist', 'build', 'public', 'tests', 'test',
      'docs', 'assets', 'styles', 'hooks', 'types', 'config',
      'skills', 'invoked',
    ];

    return !excludeList.includes(token.toLowerCase());
  }

  private static extractSkills(content: string): string[] {
    const rawSkills = new Set<string>();

    const slashPattern = /\/([a-z][a-z0-9-]+)/gi;
    for (const match of content.matchAll(slashPattern)) rawSkills.add(match[1]);

    const skillPattern = /Skill:\s*([a-z][a-z0-9-]+)/gi;
    for (const match of content.matchAll(skillPattern)) rawSkills.add(match[1]);

    const showcasePattern = /🔧\s*Skill\s+Activation:\s*`?([a-z][a-z0-9-]+)`?/gi;
    for (const match of content.matchAll(showcasePattern)) rawSkills.add(match[1]);

    const invokePattern = /<invoke name="Skill">[\s\S]*?<parameter name="skill">([a-z][a-z0-9-]+)</gi;
    for (const match of content.matchAll(invokePattern)) rawSkills.add(match[1]);

    const skillsSection = /###?\s*🔧?\s*Skills?\s+Invoked[\s\S]*?(?=###|$)/i;
    const sectionMatch = content.match(skillsSection);
    if (sectionMatch) {
      const listPattern = /^[\s-]*([a-z][a-z0-9-]+)/gim;
      for (const match of sectionMatch[0].matchAll(listPattern)) {
        if (match[1] && match[1] !== 'skills' && match[1] !== 'invoked') rawSkills.add(match[1]);
      }
    }

    return Array.from(rawSkills).filter(skill => this.isValidSkill(skill));
  }

  private static extractAgents(content: string): string[] {
    const agents = new Set<string>();

    const taskPattern = /<invoke name="Task">[\s\S]*?<parameter name="subagent_type">([a-z][a-z0-9-]+)</gi;
    for (const match of content.matchAll(taskPattern)) agents.add(match[1]);

    const showcasePattern = /🤖\s*Agent\s+spawned:\s*`?([a-z][a-z0-9-]+)`?/gi;
    for (const match of content.matchAll(showcasePattern)) agents.add(match[1]);

    const spawnPattern = /spawning\s+(?:the\s+)?([a-z][a-z0-9-]+)\s+agent/gi;
    for (const match of content.matchAll(spawnPattern)) agents.add(match[1]);

    const agentsSection = /###?\s*(?:🤖\s*)?(?:Agents?\s+(?:Spawned|Activity)|Agent\s+Activity)[\s\S]*?(?=###|##\s|$)/i;
    const sectionMatch = content.match(agentsSection);
    if (sectionMatch) {
      const numberedPattern = /^\d+\.\s*([a-z][a-z0-9-]+)/gim;
      for (const match of sectionMatch[0].matchAll(numberedPattern)) agents.add(match[1]);

      const bulletPattern = /^[\s-]+([a-z][a-z0-9-]+)\s*\(/gim;
      for (const match of sectionMatch[0].matchAll(bulletPattern)) {
        if (match[1] && match[1] !== 'agents' && match[1] !== 'spawned') agents.add(match[1]);
      }

      const bulletPattern2 = /^\s*[-*]\s*([a-z][a-z0-9-]+)(?:\s|$|\()/gim;
      for (const match of sectionMatch[0].matchAll(bulletPattern2)) {
        if (match[1] && match[1] !== 'agents' && match[1] !== 'spawned' && match[1] !== 'no') agents.add(match[1]);
      }
    }

    return Array.from(agents);
  }

  private static extractDecisions(content: string): DecisionPoint[] {
    const decisions: DecisionPoint[] = [];

    const decisionPattern = /(?:📋\s*)?Decision(?:\s+Point)?:\s*(.+?)(?:\nTradeoffs?:\s*(.+?))?(?:\nChosen(?:\s+Path)?:\s*(.+?))?(?=\n\n|$)/gis;
    for (const match of content.matchAll(decisionPattern)) {
      const description = match[1]?.trim();
      const tradeoffsRaw = match[2]?.trim();
      const chosenPath = match[3]?.trim() || 'Not specified';
      if (description) {
        decisions.push({
          description,
          tradeoffs: tradeoffsRaw ? tradeoffsRaw.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [],
          chosenPath,
        });
      }
    }

    const markdownDecisionPattern = /####\s*Decision\s+\d+:(.+?)\n-\s*\*\*Description\*\*:\s*(.+?)\n-\s*\*\*Tradeoffs\*\*:([\s\S]*?)\n-\s*\*\*Chosen Path\*\*:\s*(.+?)(?=\n\n|####|$)/gis;
    for (const match of content.matchAll(markdownDecisionPattern)) {
      const description = match[2]?.trim();
      const tradeoffsRaw = match[3]?.trim();
      const chosenPath = match[4]?.trim() || 'Not specified';
      if (description) {
        decisions.push({
          description,
          tradeoffs: tradeoffsRaw.split('\n').map(line => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean),
          chosenPath,
        });
      }
    }

    const decisionBlocks = content.split(/###\s*Decision\s+\d+:/i);
    for (let i = 1; i < decisionBlocks.length; i++) {
      const block = decisionBlocks[i];
      const titleMatch = block.match(/^\s*([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const descMatch = block.match(/(?:\*\*)?Description(?:\*\*)?:\s*([^\n]+)/i);
      const description = descMatch ? descMatch[1].trim() : '';
      const tradeoffsMatch = block.match(/(?:\*\*)?Tradeoffs?\s+Considered(?:\*\*)?:\s*\n([\s\S]*?)(?:(?:\*\*)?Chosen Path|###|##|$)/i);
      const tradeoffsBlock = tradeoffsMatch ? tradeoffsMatch[1].trim() : '';
      const tradeoffs = tradeoffsBlock
        ? tradeoffsBlock.split('\n').map(line => line.replace(/^\s*[-*]\s*/, '').trim()).filter(line => line.length > 0 && !line.match(/^(?:\*\*)?(?:Description|Tradeoffs|Chosen)/i))
        : [];
      const chosenMatch = block.match(/(?:\*\*)?Chosen Path(?:\*\*)?:\s*([^\n]+)/i);
      const chosenPath = chosenMatch ? chosenMatch[1].trim() : 'Not specified';
      if (description) {
        decisions.push({ description: title ? `${title}: ${description}` : description, tradeoffs, chosenPath });
      }
    }

    return decisions;
  }

  private static extractErrors(content: string): ErrorRecovery[] {
    const errors: ErrorRecovery[] = [];

    const errorBlocks = content.split(/###\s*Error\s+\d+:/i);
    if (errorBlocks.length > 1) {
      for (let i = 1; i < errorBlocks.length; i++) {
        const block = errorBlocks[i];
        const titleMatch = block.match(/^\s*([^\n]+)/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        const errorMatch = block.match(/(?:\*\*)?Error(?:\*\*)?:\s*([^\n]+)/i);
        const errorText = errorMatch ? errorMatch[1].trim() : '';
        const recoveryMatch = block.match(/(?:\*\*)?Recovery(?:\*\*)?:\s*([^\n]+)/i);
        const recovery = recoveryMatch ? recoveryMatch[1].trim() : 'Not specified';
        if (errorText) errors.push({ error: title ? `${title}: ${errorText}` : errorText, recovery });
      }
    } else {
      const simplePattern = /(?:⚠️\s*)?Error:\s*(.+?)(?:\nRecovery:\s*(.+?))?(?=\n\n|Error:|$)/gis;
      for (const match of content.matchAll(simplePattern)) {
        const error = match[1]?.trim();
        const recovery = match[2]?.trim() || 'Not specified';
        if (error) errors.push({ error, recovery });
      }
    }

    return errors;
  }

  private static extractLearnings(content: string): string[] {
    const learnings = new Set<string>();

    const patternPattern = /Pattern\s+learned:\s*(.+?)(?=\n|$)/gi;
    for (const match of content.matchAll(patternPattern)) learnings.add(match[1].trim());

    const showcasePattern = /🔄\s*Compound\s+Learning:\s*(.+?)(?=\n|$)/gi;
    for (const match of content.matchAll(showcasePattern)) learnings.add(match[1].trim());

    const insightPattern = /Key\s+insight:\s*(.+?)(?=\n|$)/gi;
    for (const match of content.matchAll(insightPattern)) learnings.add(match[1].trim());

    const learningsSection = /###?\s*🔄?\s*Compound\s+Learnings[\s\S]*?(?=###|##\s|$)/i;
    const sectionMatch = content.match(learningsSection);
    if (sectionMatch) {
      const listPattern = /^\d+\.\s*\*\*Pattern\*\*:\s*(.+?)(?=\n|$)/gim;
      for (const match of sectionMatch[0].matchAll(listPattern)) learnings.add(match[1].trim());
    }

    const naturalPattern = /###\s*Learning\s+\d+:\s*(.+?)(?:\n|$)([\s\S]*?)(?=\n###|\n##|$)/gis;
    for (const match of content.matchAll(naturalPattern)) {
      const title = match[1]?.trim();
      const body = match[2]?.trim();
      if (title) {
        const firstSentence = body.split(/\n\n/)[0]?.trim() || '';
        learnings.add(firstSentence ? `${title}: ${firstSentence}` : title);
      }
    }

    return Array.from(learnings);
  }

  private static extractMetadata(content: string): {
    duration?: number;
    projectType?: string;
    complexity?: 'simple' | 'moderate' | 'complex';
  } {
    const metadata: { duration?: number; projectType?: string; complexity?: 'simple' | 'moderate' | 'complex' } = {};

    const durationPattern = /\*\*Duration\*\*:\s*(\d+)\s*(?:minutes?|mins?)|Duration:\s*(\d+)\s*(?:minutes?|mins?)/i;
    const durationMatch = content.match(durationPattern);
    if (durationMatch) metadata.duration = parseInt(durationMatch[1] || durationMatch[2]);

    const projectPattern = /\*\*Project\s+Type\*\*:\s*(.+?)(?=\n|$)|Project(?:\s+Type)?:\s*(.+?)(?=\n|$)/i;
    const projectMatch = content.match(projectPattern);
    if (projectMatch) metadata.projectType = (projectMatch[1] || projectMatch[2]).trim();

    const complexityPattern = /\*\*Complexity\*\*:\s*(simple|moderate|complex)|Complexity:\s*(simple|moderate|complex)/i;
    const complexityMatch = content.match(complexityPattern);
    if (complexityMatch) {
      metadata.complexity = (complexityMatch[1] || complexityMatch[2]).toLowerCase() as 'simple' | 'moderate' | 'complex';
    } else {
      const skillCount = this.extractSkills(content).length;
      const agentCount = this.extractAgents(content).length;
      const decisionCount = this.extractDecisions(content).length;
      const total = skillCount + agentCount + decisionCount;
      metadata.complexity = total < 5 ? 'simple' : total < 15 ? 'moderate' : 'complex';
    }

    return metadata;
  }

  private static parseJSONL(content: string): OrchestrationSignals {
    const signals: OrchestrationSignals = {
      skillsInvoked: [],
      agentsSpawned: [],
      decisionPoints: [],
      errorsRecovered: [],
      compoundLearnings: [],
      metadata: {},
    };

    for (const line of content.split('\n').filter(l => l.trim())) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'skill' && obj.name) signals.skillsInvoked.push(obj.name);
        else if (obj.type === 'agent' && obj.name) signals.agentsSpawned.push(obj.name);
        else if (obj.type === 'decision') signals.decisionPoints.push({ description: obj.description || '', tradeoffs: obj.tradeoffs || [], chosenPath: obj.chosenPath || 'Not specified' });
        else if (obj.type === 'error') signals.errorsRecovered.push({ error: obj.error || '', recovery: obj.recovery || 'Not specified' });
        else if (obj.type === 'learning') signals.compoundLearnings.push(obj.pattern || obj.learning || '');
      } catch {
        continue;
      }
    }

    return OrchestrationSignalsSchema.parse(signals);
  }
}

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export function parseSessionFile(content: string, filename: string): OrchestrationSignals {
  if (content.length > MAX_CONTENT_BYTES) {
    throw new Error('File content exceeds maximum allowed size for parsing (2MB)');
  }
  const format = filename.endsWith('.jsonl') ? 'jsonl' : filename.endsWith('.md') ? 'markdown' : 'text';
  return SessionParser.parse(content, format);
}
