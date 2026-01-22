/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import {
  EuiBadge,
  EuiCard,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
  EuiToolTip,
  useEuiTheme,
} from '@elastic/eui';
import { css } from '@emotion/react';
import React, { useCallback } from 'react';
import { FormattedMessage } from '@kbn/i18n-react';
import type { WorkflowTemplate } from '../../../../common';
import { PLUGIN_ID } from '../../../../common';
import { useKibana } from '../../../hooks/use_kibana';
import { StepIcon } from '../../../shared/ui/step_icons/step_icon';

interface TemplateCardProps {
  template: WorkflowTemplate;
}

const MAX_VISIBLE_ICONS = 5;

export const TemplateCard: React.FC<TemplateCardProps> = ({ template }) => {
  const { euiTheme } = useEuiTheme();
  const { application } = useKibana().services;

  const handleUseTemplate = useCallback(() => {
    // Navigate to workflow editor with template parameter
    application.navigateToApp(PLUGIN_ID, {
      path: `/create?template=${encodeURIComponent(template.id)}`,
    });
  }, [application, template.id]);

  const visibleStepTypes = template.stepTypes.slice(0, MAX_VISIBLE_ICONS);
  const remainingStepsCount = template.stepTypes.length - MAX_VISIBLE_ICONS;

  return (
    <EuiCard
      layout="vertical"
      title={template.name}
      titleSize="xs"
      description=""
      hasBorder
      onClick={handleUseTemplate}
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;

        [class*='euiCard__content'] {
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        [class*='euiCard__titleButton'] {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.5;
          text-align: left;
        }

        cursor: pointer;
        &:hover {
          box-shadow: ${euiTheme.levels.flyout};
        }
      `}
    >
      {/* Description */}
      <EuiText size="s" color="subdued">
        <p
          css={css`
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.5;
            text-align: left;
            min-height: 3em;
            margin: 0 !important;
          `}
        >
          {template.description || (
            <FormattedMessage
              id="workflowsManagement.templateLibrary.noDescription"
              defaultMessage="No description available"
            />
          )}
        </p>
      </EuiText>

      <EuiSpacer size="m" />

      {/* Step Icons */}
      <div
        css={css`
          min-height: 24px;
        `}
      >
        {template.stepTypes.length > 0 ? (
          <EuiFlexGroup gutterSize="xs" alignItems="center" wrap={false} responsive={false}>
            {visibleStepTypes.map((stepType, index) => (
              <EuiFlexItem grow={false} key={`${stepType}-${index}`}>
                <EuiToolTip content={stepType} position="top">
                  <div
                    tabIndex={0}
                    css={css`
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      width: 24px;
                      height: 24px;
                    `}
                  >
                    <StepIcon stepType={stepType} />
                  </div>
                </EuiToolTip>
              </EuiFlexItem>
            ))}
            {remainingStepsCount > 0 && (
              <EuiFlexItem grow={false}>
                <EuiToolTip
                  content={
                    <FormattedMessage
                      id="workflowsManagement.templateLibrary.moreSteps"
                      defaultMessage="{count} more step types"
                      values={{ count: remainingStepsCount }}
                    />
                  }
                  position="top"
                >
                  <EuiText
                    tabIndex={0}
                    size="xs"
                    color="subdued"
                    css={css`
                      font-weight: ${euiTheme.font.weight.medium};
                      white-space: nowrap;
                    `}
                  >
                    {'+'}
                    {remainingStepsCount}
                  </EuiText>
                </EuiToolTip>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        ) : (
          <EuiText size="xs" color="subdued">
            <FormattedMessage
              id="workflowsManagement.templateLibrary.noSteps"
              defaultMessage="No steps available"
            />
          </EuiText>
        )}
      </div>

      <EuiSpacer size="m" />

      {/* Tags */}
      <EuiFlexGroup gutterSize="xs" wrap={false} responsive={false} alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{template.category}</EuiBadge>
        </EuiFlexItem>
        {template.tags.slice(0, 2).map((tag) => (
          <EuiFlexItem grow={false} key={tag}>
            <EuiBadge
              color="default"
              css={css`
                max-width: 100px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              `}
            >
              {tag}
            </EuiBadge>
          </EuiFlexItem>
        ))}
        {template.tags.length > 2 && (
          <EuiFlexItem grow={false}>
            <EuiToolTip
              content={
                <div>
                  {template.tags.slice(2).map((tag) => (
                    <div key={tag}>{tag}</div>
                  ))}
                </div>
              }
              position="top"
            >
              <EuiText
                tabIndex={0}
                size="xs"
                color="subdued"
                css={css`
                  font-weight: ${euiTheme.font.weight.medium};
                  white-space: nowrap;
                `}
              >
                {'+'}
                {template.tags.length - 2}
              </EuiText>
            </EuiToolTip>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </EuiCard>
  );
};
