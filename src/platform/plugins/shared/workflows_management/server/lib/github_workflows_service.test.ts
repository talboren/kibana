/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { loggerMock } from '@kbn/logging-mocks';
import { GitHubWorkflowsService } from './github_workflows_service';

describe('GitHubWorkflowsService', () => {
  let service: GitHubWorkflowsService;
  let logger: ReturnType<typeof loggerMock.create>;

  beforeEach(() => {
    logger = loggerMock.create();
    service = new GitHubWorkflowsService(logger);
    // Clear cache before each test
    service.clearCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getWorkflowTemplates', () => {
    it('should fetch and parse workflow templates from GitHub', async () => {
      const mockTreeResponse = {
        tree: [
          {
            path: 'workflows/examples/test-workflow.yaml',
            type: 'blob' as const,
            sha: 'abc123',
            url: 'https://api.github.com/repos/elastic/workflows/git/blobs/abc123',
          },
        ],
        truncated: false,
      };

      const mockYamlContent = `
version: '1'
name: Test Workflow
description: A test workflow
tags: ['test', 'demo']
steps:
  - name: test_step
    type: console
    with:
      message: 'Hello World'
`;

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTreeResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockYamlContent,
        } as Response);

      const templates = await service.getWorkflowTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0]).toMatchObject({
        name: 'Test Workflow',
        description: 'A test workflow',
        tags: ['test', 'demo'],
        category: 'examples',
        stepTypes: ['console'],
      });
    });

    it('should cache results and return cached data on subsequent calls', async () => {
      const mockTreeResponse = {
        tree: [],
        truncated: false,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTreeResponse,
      } as Response);

      // First call
      await service.getWorkflowTemplates();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.getWorkflowTemplates();
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should extract base step types correctly', async () => {
      const mockTreeResponse = {
        tree: [
          {
            path: 'workflows/test/workflow.yaml',
            type: 'blob' as const,
            sha: 'abc123',
            url: 'https://api.github.com/repos/elastic/workflows/git/blobs/abc123',
          },
        ],
        truncated: false,
      };

      const mockYamlContent = `
version: '1'
name: Test Workflow
steps:
  - name: step1
    type: elasticsearch.search
  - name: step2
    type: .jira.create_issue
  - name: step3
    type: slack_api.postMessage
  - name: step4
    type: data.set
`;

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTreeResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockYamlContent,
        } as Response);

      const templates = await service.getWorkflowTemplates();

      expect(templates[0].stepTypes).toEqual(['elasticsearch', 'jira', 'slack', 'data']);
    });

    it('should handle nested steps in conditionals and loops', async () => {
      const mockTreeResponse = {
        tree: [
          {
            path: 'workflows/test/workflow.yaml',
            type: 'blob' as const,
            sha: 'abc123',
            url: 'https://api.github.com/repos/elastic/workflows/git/blobs/abc123',
          },
        ],
        truncated: false,
      };

      const mockYamlContent = `
version: '1'
name: Test Workflow
steps:
  - name: conditional
    type: if
    condition: 'true'
    steps:
      - name: nested_step
        type: http
    else:
      - name: else_step
        type: console
  - name: loop
    type: foreach
    foreach: '[1, 2, 3]'
    steps:
      - name: loop_step
        type: email
`;

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTreeResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockYamlContent,
        } as Response);

      const templates = await service.getWorkflowTemplates();

      expect(templates[0].stepTypes).toEqual(
        expect.arrayContaining(['if', 'http', 'console', 'foreach', 'email'])
      );
    });

    it('should handle GitHub API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(service.getWorkflowTemplates()).rejects.toThrow();
    });

    it('should skip invalid YAML files', async () => {
      const mockTreeResponse = {
        tree: [
          {
            path: 'workflows/test/valid.yaml',
            type: 'blob' as const,
            sha: 'abc123',
            url: 'https://api.github.com/repos/elastic/workflows/git/blobs/abc123',
          },
          {
            path: 'workflows/test/invalid.yaml',
            type: 'blob' as const,
            sha: 'def456',
            url: 'https://api.github.com/repos/elastic/workflows/git/blobs/def456',
          },
        ],
        truncated: false,
      };

      const validYaml = `
version: '1'
name: Valid Workflow
steps:
  - name: test
    type: console
`;

      const invalidYaml = 'invalid: yaml: content: [[[';

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTreeResponse,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => validYaml,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => invalidYaml,
        } as Response);

      const templates = await service.getWorkflowTemplates();

      // Should only return the valid template
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Valid Workflow');
    });
  });
});
