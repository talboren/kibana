/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { KibanaRequest, Logger } from '@kbn/core/server';
import type { InferenceServerStart } from '@kbn/inference-plugin/server';
import type { EsWorkflowExecution, EsWorkflowStepExecution } from '@kbn/workflows';
import { ExecutionStatus } from '@kbn/workflows';

interface AiFailureExplanation {
  explanation: string;
  suggestedFix?: string;
}

const SYSTEM_PROMPT = `You are an expert in Elastic Workflows automation. Your job is to analyze workflow execution failures and provide clear, actionable explanations.

Elastic Workflows use a YAML-based DSL with steps that execute actions like HTTP requests, data transformations, conditionals, and loops. Each step has a type, inputs, and produces outputs available to subsequent steps via Liquid templating ({{ variable }}).

When analyzing a failure:
1. Identify the root cause from the error type and message
2. Consider common issues: wrong field references, missing variables, HTTP errors, type mismatches, connector misconfiguration
3. Provide a concise explanation (2-3 sentences) of WHY it failed
4. If possible, suggest a concrete fix (corrected YAML snippet or configuration change)

Respond in the following format:
EXPLANATION: <your explanation>
SUGGESTED_FIX: <your suggested fix, or "N/A" if no specific fix can be suggested>`;

function buildUserPrompt(
  execution: EsWorkflowExecution,
  failedSteps: EsWorkflowStepExecution[]
): string {
  const parts: string[] = [];

  parts.push('## Workflow YAML');
  parts.push('```yaml');
  parts.push(execution.yaml);
  parts.push('```');
  parts.push('');

  if (execution.error) {
    parts.push('## Workflow Error');
    parts.push(`Type: ${execution.error.type}`);
    parts.push(`Message: ${execution.error.message}`);
    if (execution.error.details) {
      parts.push(`Details: ${JSON.stringify(execution.error.details, null, 2)}`);
    }
    parts.push('');
  }

  if (failedSteps.length > 0) {
    parts.push('## Failed Steps');
    for (const step of failedSteps) {
      parts.push(`### Step: ${step.stepId} (type: ${step.stepType ?? 'unknown'})`);
      if (step.error) {
        parts.push(`Error Type: ${step.error.type}`);
        parts.push(`Error Message: ${step.error.message}`);
        if (step.error.details) {
          parts.push(`Error Details: ${JSON.stringify(step.error.details, null, 2)}`);
        }
      }
      if (step.input) {
        const inputStr = JSON.stringify(step.input, null, 2);
        if (inputStr.length <= 2000) {
          parts.push(`Input: ${inputStr}`);
        }
      }
      parts.push('');
    }
  }

  parts.push(
    'Please analyze this workflow execution failure and provide an explanation and suggested fix.'
  );

  return parts.join('\n');
}

function parseResponse(content: string): AiFailureExplanation {
  const explanationMatch = content.match(/EXPLANATION:\s*([\s\S]*?)(?=SUGGESTED_FIX:|$)/i);
  const fixMatch = content.match(/SUGGESTED_FIX:\s*([\s\S]*?)$/i);

  const explanation = explanationMatch?.[1]?.trim() || content.trim();
  const suggestedFix = fixMatch?.[1]?.trim();

  return {
    explanation,
    suggestedFix: suggestedFix && suggestedFix !== 'N/A' ? suggestedFix : undefined,
  };
}

export async function generateFailureExplanation(
  inference: InferenceServerStart,
  request: KibanaRequest,
  execution: EsWorkflowExecution,
  failedSteps: EsWorkflowStepExecution[],
  logger: Logger
): Promise<AiFailureExplanation | undefined> {
  const defaultConnector = await inference.getDefaultConnector(request);
  const connectorId = defaultConnector?.connectorId;

  if (!connectorId) {
    logger.debug('[AI Failure Explanation] No default AI connector configured, skipping');
    return undefined;
  }

  const stepsToAnalyze = failedSteps.filter((s) => s.status === ExecutionStatus.FAILED);

  const chatModel = await inference.getChatModel({
    connectorId,
    request,
    chatModelOptions: {
      temperature: 0.3,
      maxRetries: 1,
    },
  });

  const userPrompt = buildUserPrompt(execution, stepsToAnalyze);

  logger.debug('[AI Failure Explanation] Calling LLM to explain failure');
  const modelResponse = await chatModel.invoke([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);

  const responseContent = typeof modelResponse.content === 'string' ? modelResponse.content : '';

  if (!responseContent) {
    logger.warn('[AI Failure Explanation] Empty response from LLM');
    return undefined;
  }

  const result = parseResponse(responseContent);
  logger.debug(
    `[AI Failure Explanation] Generated explanation (${result.explanation.length} chars)`
  );

  return result;
}
