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
import { generateFailureExplanation } from './generate_failure_explanation';

const createMockExecution = (overrides?: Partial<EsWorkflowExecution>): EsWorkflowExecution =>
  ({
    id: 'exec-1',
    spaceId: 'default',
    workflowId: 'wf-1',
    isTestRun: false,
    status: ExecutionStatus.FAILED,
    yaml: 'steps:\n  - id: step1\n    type: http\n    with:\n      url: https://example.com',
    error: {
      type: 'StepExecutionError',
      message: 'HTTP request failed with status 404',
    },
    context: {},
    workflowDefinition: { steps: [] },
    scopeStack: [],
    createdAt: '2026-01-01T00:00:00Z',
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T00:00:01Z',
    cancelRequested: false,
    duration: 1000,
    ...overrides,
  } as EsWorkflowExecution);

const createMockStepExecution = (
  overrides?: Partial<EsWorkflowStepExecution>
): EsWorkflowStepExecution =>
  ({
    id: 'step-exec-1',
    stepId: 'step1',
    stepType: 'http',
    status: ExecutionStatus.FAILED,
    error: {
      type: 'HttpError',
      message: 'Request failed with status 404',
    },
    input: { url: 'https://example.com' },
    spaceId: 'default',
    workflowRunId: 'exec-1',
    workflowId: 'wf-1',
    startedAt: '2026-01-01T00:00:00Z',
    scopeStack: [],
    topologicalIndex: 0,
    globalExecutionIndex: 0,
    stepExecutionIndex: 0,
    ...overrides,
  } as EsWorkflowStepExecution);

const createMockLogger = (): Logger =>
  ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger);

const createMockRequest = (): KibanaRequest => ({} as unknown as KibanaRequest);

describe('generateFailureExplanation', () => {
  let mockInference: jest.Mocked<InferenceServerStart>;
  let mockChatModel: { invoke: jest.Mock };
  let logger: Logger;
  let request: KibanaRequest;

  beforeEach(() => {
    mockChatModel = {
      invoke: jest.fn().mockResolvedValue({
        content:
          'EXPLANATION: The HTTP step failed because the target URL returned a 404 Not Found.\nSUGGESTED_FIX: Verify the URL is correct and the endpoint exists.',
      }),
    };

    mockInference = {
      getDefaultConnector: jest.fn().mockResolvedValue({ connectorId: 'connector-1' }),
      getChatModel: jest.fn().mockResolvedValue(mockChatModel),
    } as unknown as jest.Mocked<InferenceServerStart>;

    logger = createMockLogger();
    request = createMockRequest();
  });

  it('should return an explanation and suggested fix', async () => {
    const execution = createMockExecution();
    const failedSteps = [createMockStepExecution()];

    const result = await generateFailureExplanation(
      mockInference,
      request,
      execution,
      failedSteps,
      logger
    );

    expect(result).toEqual({
      explanation: 'The HTTP step failed because the target URL returned a 404 Not Found.',
      suggestedFix: 'Verify the URL is correct and the endpoint exists.',
    });
  });

  it('should return undefined when no default connector is available', async () => {
    mockInference.getDefaultConnector.mockResolvedValue(undefined as any);

    const result = await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [],
      logger
    );

    expect(result).toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('No default AI connector configured')
    );
  });

  it('should call getChatModel with correct parameters', async () => {
    await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [createMockStepExecution()],
      logger
    );

    expect(mockInference.getChatModel).toHaveBeenCalledWith({
      connectorId: 'connector-1',
      request,
      chatModelOptions: {
        temperature: 0.3,
        maxRetries: 1,
      },
    });
  });

  it('should include workflow YAML and error in the prompt', async () => {
    const execution = createMockExecution({
      yaml: 'steps:\n  - id: my_step\n    type: http',
      error: { type: 'TestError', message: 'Something went wrong' },
    });

    await generateFailureExplanation(mockInference, request, execution, [], logger);

    const invokeCall = mockChatModel.invoke.mock.calls[0][0];
    const userMessage = invokeCall[1].content;
    expect(userMessage).toContain('steps:\n  - id: my_step\n    type: http');
    expect(userMessage).toContain('TestError');
    expect(userMessage).toContain('Something went wrong');
  });

  it('should include failed step details in the prompt', async () => {
    const failedStep = createMockStepExecution({
      stepId: 'send_email',
      stepType: 'email',
      error: { type: 'EmailError', message: 'Invalid recipient' },
    });

    await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [failedStep],
      logger
    );

    const invokeCall = mockChatModel.invoke.mock.calls[0][0];
    const userMessage = invokeCall[1].content;
    expect(userMessage).toContain('send_email');
    expect(userMessage).toContain('email');
    expect(userMessage).toContain('Invalid recipient');
  });

  it('should handle response without SUGGESTED_FIX marker', async () => {
    mockChatModel.invoke.mockResolvedValue({
      content: 'EXPLANATION: The workflow failed due to a timeout.',
    });

    const result = await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [],
      logger
    );

    expect(result).toEqual({
      explanation: 'The workflow failed due to a timeout.',
      suggestedFix: undefined,
    });
  });

  it('should handle response with N/A suggested fix', async () => {
    mockChatModel.invoke.mockResolvedValue({
      content: 'EXPLANATION: External service is down.\nSUGGESTED_FIX: N/A',
    });

    const result = await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [],
      logger
    );

    expect(result).toEqual({
      explanation: 'External service is down.',
      suggestedFix: undefined,
    });
  });

  it('should return undefined when LLM returns empty content', async () => {
    mockChatModel.invoke.mockResolvedValue({ content: '' });

    const result = await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [],
      logger
    );

    expect(result).toBeUndefined();
  });

  it('should handle non-string LLM response content', async () => {
    mockChatModel.invoke.mockResolvedValue({ content: ['array', 'content'] });

    const result = await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [],
      logger
    );

    expect(result).toBeUndefined();
  });

  it('should only include steps with FAILED status', async () => {
    const failedStep = createMockStepExecution({ stepId: 'failed_step' });
    const completedStep = createMockStepExecution({
      stepId: 'completed_step',
      status: ExecutionStatus.COMPLETED,
    });

    await generateFailureExplanation(
      mockInference,
      request,
      createMockExecution(),
      [failedStep, completedStep],
      logger
    );

    const invokeCall = mockChatModel.invoke.mock.calls[0][0];
    const userMessage = invokeCall[1].content;
    expect(userMessage).toContain('failed_step');
    expect(userMessage).not.toContain('completed_step');
  });
});
