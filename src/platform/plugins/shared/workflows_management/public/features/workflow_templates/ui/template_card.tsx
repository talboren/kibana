/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EuiPanel, EuiText, EuiToolTip, useEuiTheme } from '@elastic/eui';
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
    application.navigateToApp(PLUGIN_ID, {
      path: `/create?template=${encodeURIComponent(template.id)}`,
    });
  }, [application, template.id]);

  const visibleStepTypes = template.stepTypes.slice(0, MAX_VISIBLE_ICONS);
  const remainingStepsCount = template.stepTypes.length - MAX_VISIBLE_ICONS;

  return (
    <EuiPanel
      hasBorder
      hasShadow={false}
      paddingSize="none"
      onClick={handleUseTemplate}
      aria-label={template.name}
      css={css`
        display: flex;
        flex-direction: column;
        padding: ${euiTheme.size.l};
        height: 204px;
        border-radius: ${euiTheme.border.radius.medium};
        cursor: pointer;
        transition: box-shadow ${euiTheme.animation.fast} ease-in-out;

        &:hover {
          box-shadow: 0 0.9px 4px 0 rgba(0, 0, 0, 0.08), 0 2.6px 8px 0 rgba(0, 0, 0, 0.06);
        }
      `}
    >
      {/* Step Icons Row */}
      <div
        css={css`
          display: flex;
          gap: ${euiTheme.size.base};
          align-items: flex-start;
          flex-shrink: 0;
          width: 100%;
        `}
      >
        {visibleStepTypes.map((stepType, index) => (
          <EuiToolTip content={stepType} position="top" key={`${stepType}-${index}`}>
            <div
              tabIndex={0}
              css={css`
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              `}
            >
              <StepIcon stepType={stepType} executionStatus={undefined} />
            </div>
          </EuiToolTip>
        ))}
        {remainingStepsCount > 0 && (
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
              {`+${remainingStepsCount}`}
            </EuiText>
          </EuiToolTip>
        )}
      </div>

      {/* Title & Description - tightly packed below icons */}
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: ${euiTheme.size.xs};
          margin-top: ${euiTheme.size.base};
          flex-shrink: 0;
          width: 100%;
        `}
      >
        {/* Title: 14px semi-bold, single line, clipped */}
        <p
          css={css`
            font-size: 14px;
            font-weight: ${euiTheme.font.weight.semiBold};
            line-height: 20px;
            color: ${euiTheme.colors.textHeading};
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin: 0;
          `}
        >
          {template.name}
        </p>
        {/* Description: 13px regular, subdued, 2 lines max */}
        <p
          css={css`
            font-size: 13px;
            font-weight: ${euiTheme.font.weight.regular};
            line-height: 18px;
            color: ${euiTheme.colors.textSubdued};
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin: 0;
          `}
        >
          {template.description || (
            <FormattedMessage
              id="workflowsManagement.templateLibrary.noDescription"
              defaultMessage="No description available"
            />
          )}
        </p>
      </div>

      {/* Category Badge - pushed to bottom */}
      <div
        css={css`
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          margin-top: auto;
          height: 20px;
          padding: 0 ${euiTheme.size.s};
          background: ${euiTheme.colors.emptyShade};
          border: 1px solid ${euiTheme.colors.lightShade};
          border-radius: 3px;
          font-size: 12px;
          font-weight: ${euiTheme.font.weight.medium};
          line-height: ${euiTheme.size.base};
          color: ${euiTheme.colors.text};
          white-space: nowrap;
          overflow: hidden;
          flex-shrink: 0;
        `}
      >
        {template.category}
      </div>
    </EuiPanel>
  );
};
