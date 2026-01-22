/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EuiAccordion, EuiFacetButton, EuiFacetGroup, EuiSpacer, useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import React, { useMemo } from 'react';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n-react';
import type { WorkflowTemplate } from '../../../../common';

interface CategorySidebarProps {
  templates: WorkflowTemplate[];
  selectedCategory: string | null;
  onCategorySelect: (category: string | null) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  templates,
  selectedCategory,
  onCategorySelect,
}) => {
  const { euiTheme } = useEuiTheme();

  // Calculate category counts
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};

    templates.forEach((template) => {
      counts[template.category] = (counts[template.category] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, count]) => ({
        category,
        count,
      }));
  }, [templates]);

  const totalCount = templates.length;

  return (
    <div
      css={css`
        padding: ${euiTheme.size.m} ${euiTheme.size.l};
        height: 100%;
        overflow-y: auto;
      `}
    >
      <EuiAccordion
        id="categoriesWorkflowTemplatesAccordion"
        buttonContent={
          <FormattedMessage
            id="workflowsManagement.templateLibrary.categories"
            defaultMessage="Categories"
          />
        }
        buttonProps={{
          style: {
            fontWeight: euiTheme.font.weight.bold,
          },
        }}
        initialIsOpen={true}
        paddingSize="none"
      >
        <EuiSpacer size="s" />
        <EuiFacetGroup gutterSize="s">
          {/* All templates option */}
          <EuiFacetButton
            isSelected={selectedCategory === null}
            quantity={totalCount}
            onClick={() => onCategorySelect(null)}
            style={{ padding: 0 }}
            aria-label={i18n.translate(
              'workflowsManagement.templateLibrary.allTemplatesAriaLabel',
              {
                defaultMessage:
                  'All templates, {count} {count, plural, one {template} other {templates}}',
                values: { count: totalCount },
              }
            )}
          >
            <FormattedMessage
              id="workflowsManagement.templateLibrary.allTemplates"
              defaultMessage="All templates"
            />
          </EuiFacetButton>

          {/* Individual categories */}
          {categoryData.map(({ category, count }) => (
            <EuiFacetButton
              key={category}
              isSelected={selectedCategory === category}
              quantity={count}
              onClick={() => onCategorySelect(category)}
              style={{ padding: 0 }}
              aria-label={i18n.translate('workflowsManagement.templateLibrary.categoryAriaLabel', {
                defaultMessage:
                  '{category}, {count} {count, plural, one {template} other {templates}}',
                values: { category, count },
              })}
            >
              {category}
            </EuiFacetButton>
          ))}
        </EuiFacetGroup>
      </EuiAccordion>
    </div>
  );
};
