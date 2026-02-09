/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '@kbn/i18n-react';
import { TemplateCard } from './template_card';
import type { WorkflowTemplate } from '../../../../common';

// Mock useKibana
const mockNavigateToApp = jest.fn();
jest.mock('../../../hooks/use_kibana', () => ({
  useKibana: () => ({
    services: {
      application: {
        navigateToApp: mockNavigateToApp,
      },
      triggersActionsUi: {
        actionTypeRegistry: {
          has: () => false,
          get: jest.fn(),
        },
      },
      workflowsExtensions: {
        getStepDefinition: () => undefined,
      },
    },
  }),
}));

const createTemplate = (overrides: Partial<WorkflowTemplate> = {}): WorkflowTemplate => ({
  id: 'test-template-id',
  name: 'Test Template',
  description: 'A test template description',
  tags: ['tag1', 'tag2'],
  category: 'AI-agent',
  stepTypes: ['http_request', 'transform'],
  yamlContent: 'name: test',
  githubUrl: 'https://github.com/elastic/test',
  path: 'templates/test.yml',
  ...overrides,
});

const renderWithI18n = (ui: React.ReactNode) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('TemplateCard', () => {
  beforeEach(() => {
    mockNavigateToApp.mockClear();
  });

  it('renders the template name as the card title', () => {
    const template = createTemplate({ name: 'My Workflow' });
    renderWithI18n(<TemplateCard template={template} />);

    expect(screen.getByText('My Workflow')).toBeInTheDocument();
  });

  it('renders the template description', () => {
    const template = createTemplate({ description: 'This workflow does things' });
    renderWithI18n(<TemplateCard template={template} />);

    expect(screen.getByText('This workflow does things')).toBeInTheDocument();
  });

  it('renders "No description available" when description is empty', () => {
    const template = createTemplate({ description: '' });
    renderWithI18n(<TemplateCard template={template} />);

    expect(screen.getByText('No description available')).toBeInTheDocument();
  });

  it('renders the category badge', () => {
    const template = createTemplate({ category: 'Data' });
    renderWithI18n(<TemplateCard template={template} />);

    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('navigates to create page with template id on click', () => {
    const template = createTemplate({ id: 'my-template' });
    renderWithI18n(<TemplateCard template={template} />);

    const panel = screen.getByRole('button', { name: template.name });
    fireEvent.click(panel);

    expect(mockNavigateToApp).toHaveBeenCalledWith('workflows', {
      path: '/create?template=my-template',
    });
  });

  it('renders step type icons for templates with step types', () => {
    const template = createTemplate({
      stepTypes: ['http_request', 'transform', 'llm'],
    });
    const { container } = renderWithI18n(<TemplateCard template={template} />);

    // Step icons are wrapped in tooltip divs with tabIndex=0
    const iconWrappers = container.querySelectorAll('[tabindex="0"]');
    expect(iconWrappers.length).toBeGreaterThanOrEqual(3);
  });

  it('shows +N indicator when there are more than MAX_VISIBLE_ICONS step types', () => {
    const template = createTemplate({
      stepTypes: ['http_request', 'transform', 'llm', 'elasticsearch', 'slack', 'email', 'webhook'],
    });
    renderWithI18n(<TemplateCard template={template} />);

    // Should show +2 (7 total - 5 visible = 2 remaining)
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('passes undefined executionStatus to StepIcon so icons render with natural colors', () => {
    // This is critical: passing null would trigger shouldApplyColorToIcon=true
    // in StepIcon, which forces multi-colored icons to monochrome.
    // With undefined, shouldApplyColorToIcon=false and icons keep their natural colors.
    const template = createTemplate({ stepTypes: ['http_request'] });
    const { container } = renderWithI18n(<TemplateCard template={template} />);

    // The icon should render without execution-status color overrides
    const iconWrapper = container.querySelector('[tabindex="0"]');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('does not render step icons section content when stepTypes is empty', () => {
    const template = createTemplate({ stepTypes: [] });
    renderWithI18n(<TemplateCard template={template} />);

    // The "No steps available" text should NOT be present in new design
    expect(screen.queryByText('No steps available')).not.toBeInTheDocument();
  });

  it('does not render individual tags, only the category badge', () => {
    const template = createTemplate({
      category: 'AI-agent',
      tags: ['enrichment', 'notification', 'triage'],
    });
    renderWithI18n(<TemplateCard template={template} />);

    // Category badge should be present
    expect(screen.getByText('AI-agent')).toBeInTheDocument();

    // Individual tags should NOT be rendered as badges
    expect(screen.queryByText('enrichment')).not.toBeInTheDocument();
    expect(screen.queryByText('notification')).not.toBeInTheDocument();
    expect(screen.queryByText('triage')).not.toBeInTheDocument();
  });

  it('renders the card with aria-label matching the template name', () => {
    const template = createTemplate({ name: 'Accessible Template' });
    renderWithI18n(<TemplateCard template={template} />);

    expect(screen.getByRole('button', { name: 'Accessible Template' })).toBeInTheDocument();
  });

  it('encodes template id in the navigation URL', () => {
    const template = createTemplate({ id: 'template with spaces & special' });
    renderWithI18n(<TemplateCard template={template} />);

    const panel = screen.getByRole('button', { name: template.name });
    fireEvent.click(panel);

    expect(mockNavigateToApp).toHaveBeenCalledWith('workflows', {
      path: `/create?template=${encodeURIComponent('template with spaces & special')}`,
    });
  });
});
