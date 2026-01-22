/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { httpServerMock } from '@kbn/core/server/mocks';
import { loggerMock } from '@kbn/logging-mocks';
import { spacesServiceMock } from '@kbn/spaces-plugin/server/mocks';
import { registerGetWorkflowTemplatesRoute } from './get_workflow_templates';
import { createMockRouter } from './test_utils';
import type { WorkflowTemplate } from '../../../common';

describe('GET /api/workflows/templates', () => {
  const mockTemplates: WorkflowTemplate[] = [
    {
      id: 'workflows_examples_test-workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
      tags: ['test'],
      category: 'examples',
      stepTypes: ['console'],
      yamlContent: 'version: "1"\nname: Test Workflow',
      githubUrl:
        'https://github.com/elastic/workflows/blob/main/workflows/examples/test-workflow.yaml',
      path: 'workflows/examples/test-workflow.yaml',
    },
    {
      id: 'workflows_security_alert-workflow',
      name: 'Alert Workflow',
      description: 'Security alert workflow',
      tags: ['security', 'alert'],
      category: 'security',
      stepTypes: ['slack', 'email'],
      yamlContent: 'version: "1"\nname: Alert Workflow',
      githubUrl:
        'https://github.com/elastic/workflows/blob/main/workflows/security/alert-workflow.yaml',
      path: 'workflows/security/alert-workflow.yaml',
    },
  ];

  it('should return all templates when no filters are applied', async () => {
    const mockApi = {
      getWorkflowTemplates: jest.fn().mockResolvedValue(mockTemplates),
    };

    const { router, routeHandler } = createMockRouter();
    const logger = loggerMock.create();
    const spaces = spacesServiceMock.createStart().spacesService;

    registerGetWorkflowTemplatesRoute({
      router,
      api: mockApi as any,
      logger,
      spaces,
    });

    const request = httpServerMock.createKibanaRequest({
      query: {},
    });

    const response = await routeHandler(request);

    expect(response.status).toBe(200);
    expect(response.payload).toEqual({
      templates: mockTemplates,
      total: 2,
    });
  });

  it('should filter templates by category', async () => {
    const mockApi = {
      getWorkflowTemplates: jest.fn().mockResolvedValue(mockTemplates),
    };

    const { router, routeHandler } = createMockRouter();
    const logger = loggerMock.create();
    const spaces = spacesServiceMock.createStart().spacesService;

    registerGetWorkflowTemplatesRoute({
      router,
      api: mockApi as any,
      logger,
      spaces,
    });

    const request = httpServerMock.createKibanaRequest({
      query: { category: 'security' },
    });

    const response = await routeHandler(request);

    expect(response.status).toBe(200);
    expect(response.payload.templates).toHaveLength(1);
    expect(response.payload.templates[0].category).toBe('security');
  });

  it('should filter templates by search term', async () => {
    const mockApi = {
      getWorkflowTemplates: jest.fn().mockResolvedValue(mockTemplates),
    };

    const { router, routeHandler } = createMockRouter();
    const logger = loggerMock.create();
    const spaces = spacesServiceMock.createStart().spacesService;

    registerGetWorkflowTemplatesRoute({
      router,
      api: mockApi as any,
      logger,
      spaces,
    });

    const request = httpServerMock.createKibanaRequest({
      query: { search: 'alert' },
    });

    const response = await routeHandler(request);

    expect(response.status).toBe(200);
    expect(response.payload.templates).toHaveLength(1);
    expect(response.payload.templates[0].name).toBe('Alert Workflow');
  });

  it('should filter templates by tags', async () => {
    const mockApi = {
      getWorkflowTemplates: jest.fn().mockResolvedValue(mockTemplates),
    };

    const { router, routeHandler } = createMockRouter();
    const logger = loggerMock.create();
    const spaces = spacesServiceMock.createStart().spacesService;

    registerGetWorkflowTemplatesRoute({
      router,
      api: mockApi as any,
      logger,
      spaces,
    });

    const request = httpServerMock.createKibanaRequest({
      query: { tags: ['security'] },
    });

    const response = await routeHandler(request);

    expect(response.status).toBe(200);
    expect(response.payload.templates).toHaveLength(1);
    expect(response.payload.templates[0].tags).toContain('security');
  });

  it('should handle errors gracefully', async () => {
    const mockApi = {
      getWorkflowTemplates: jest.fn().mockRejectedValue(new Error('GitHub API error')),
    };

    const { router, routeHandler } = createMockRouter();
    const logger = loggerMock.create();
    const spaces = spacesServiceMock.createStart().spacesService;

    registerGetWorkflowTemplatesRoute({
      router,
      api: mockApi as any,
      logger,
      spaces,
    });

    const request = httpServerMock.createKibanaRequest({
      query: {},
    });

    const response = await routeHandler(request);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalled();
  });
});
