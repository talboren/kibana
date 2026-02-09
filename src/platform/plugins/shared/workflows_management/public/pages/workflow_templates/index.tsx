/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  EuiCallOut,
  EuiEmptyPrompt,
  EuiFieldSearch,
  EuiFlexGrid,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPageHeader,
  EuiSkeletonRectangle,
  useEuiTheme,
  useIsWithinMaxBreakpoint,
} from '@elastic/eui';
import { css } from '@emotion/react';
import React, { useMemo, useState } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import { useWorkflowTemplates } from '../../entities/workflow_templates/api/use_workflow_templates';
import { CategorySidebar } from '../../features/workflow_templates/ui/category_sidebar';
import { TemplateCard } from '../../features/workflow_templates/ui/template_card';
import { useWorkflowsBreadcrumbs } from '../../hooks/use_workflow_breadcrumbs/use_workflow_breadcrumbs';

export function WorkflowTemplatesPage() {
  const { euiTheme } = useEuiTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Responsive columns - 4 columns on large screens
  const isWithinLargeBreakpoint = useIsWithinMaxBreakpoint('l');
  const isWithinMediumBreakpoint = useIsWithinMaxBreakpoint('m');
  const isWithinSmallBreakpoint = useIsWithinMaxBreakpoint('s');
  const columnCount = isWithinSmallBreakpoint
    ? 1
    : isWithinMediumBreakpoint
    ? 2
    : isWithinLargeBreakpoint
    ? 3
    : 4;

  // Fetch templates
  const { data: allTemplates, isLoading, error } = useWorkflowTemplates();

  // Set breadcrumbs
  useWorkflowsBreadcrumbs(
    i18n.translate('workflowsManagement.templateLibrary.breadcrumb', {
      defaultMessage: 'Template Library',
    })
  );

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    if (!allTemplates) return [];

    let filtered = allTemplates;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((template) => template.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower) ||
          template.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, [allTemplates, selectedCategory, searchTerm]);

  return (
    <EuiFlexGroup
      gutterSize="none"
      alignItems="flexStart"
      css={css`
        height: 100vh;
      `}
    >
      {/* Sidebar */}
      <EuiFlexItem
        grow={false}
        css={css`
          width: 240px;
          min-width: 240px;
          border-right: ${euiTheme.border.thin};
          background-color: ${euiTheme.colors.emptyShade};
        `}
      >
        {allTemplates && (
          <CategorySidebar
            templates={allTemplates}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
          />
        )}
      </EuiFlexItem>

      {/* Main Content */}
      <EuiFlexItem grow={5}>
        <EuiFlexGroup direction="column" gutterSize="none">
          {/* Header */}
          <EuiFlexItem
            grow={false}
            css={css`
              padding: ${euiTheme.size.l} ${euiTheme.size.xl};
              border-bottom: ${euiTheme.border.thin};
            `}
          >
            <EuiPageHeader
              pageTitle={
                <FormattedMessage
                  id="workflowsManagement.templateLibrary.pageTitle"
                  defaultMessage="Workflow Template Library"
                />
              }
              description={
                <FormattedMessage
                  id="workflowsManagement.templateLibrary.pageDescription"
                  defaultMessage="Browse and use pre-built workflow templates from the Elastic community"
                />
              }
              bottomBorder={false}
              restrictWidth={false}
            />
          </EuiFlexItem>

          {/* Search Bar */}
          <EuiFlexItem
            grow={false}
            css={css`
              padding: ${euiTheme.size.m} ${euiTheme.size.xl};
              background-color: ${euiTheme.colors.backgroundBasePlain};
            `}
          >
            <EuiFieldSearch
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              isClearable
              fullWidth
            />
          </EuiFlexItem>

          {/* Content Area */}
          <EuiFlexItem
            grow={1}
            css={css`
              padding: ${euiTheme.size.l} ${euiTheme.size.xl};
              background-color: ${euiTheme.colors.backgroundBasePlain};
              overflow-y: auto;
            `}
          >
            {/* Loading State */}
            {isLoading && (
              <EuiFlexGrid columns={columnCount} gutterSize="m">
                {Array.from({ length: 6 }).map((_, i) => (
                  <EuiFlexItem key={i}>
                    <EuiSkeletonRectangle width="100%" height={204} borderRadius="m" />
                  </EuiFlexItem>
                ))}
              </EuiFlexGrid>
            )}

            {/* Error State */}
            {error && (
              <EuiCallOut
                announceOnMount
                title={
                  <FormattedMessage
                    id="workflowsManagement.templateLibrary.errorTitle"
                    defaultMessage="Failed to load templates"
                  />
                }
                color="danger"
                iconType="error"
              >
                <p>{error.message}</p>
              </EuiCallOut>
            )}

            {/* Empty State */}
            {!isLoading && !error && filteredTemplates.length === 0 && (
              <EuiEmptyPrompt
                iconType="search"
                title={
                  <h2>
                    <FormattedMessage
                      id="workflowsManagement.templateLibrary.noTemplatesTitle"
                      defaultMessage="No templates found"
                    />
                  </h2>
                }
                body={
                  <p>
                    <FormattedMessage
                      id="workflowsManagement.templateLibrary.noTemplatesBody"
                      defaultMessage="Try adjusting your search or filter criteria"
                    />
                  </p>
                }
              />
            )}

            {/* Templates Grid */}
            {!isLoading && !error && filteredTemplates.length > 0 && (
              <EuiFlexGrid columns={columnCount} gutterSize="m">
                {filteredTemplates.map((template) => (
                  <EuiFlexItem
                    key={template.id}
                    css={css`
                      min-width: 0;
                    `}
                  >
                    <TemplateCard template={template} />
                  </EuiFlexItem>
                ))}
              </EuiFlexGrid>
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
