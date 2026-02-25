/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { EuiCallOut, EuiCodeBlock, EuiSpacer, EuiText } from '@elastic/eui';
import React from 'react';
import { i18n } from '@kbn/i18n';

interface AiFailureCalloutProps {
  aiFailureExplanation: {
    explanation: string;
    suggestedFix?: string;
  };
}

export const AiFailureCallout: React.FC<AiFailureCalloutProps> = React.memo(
  ({ aiFailureExplanation }) => {
    return (
      <EuiCallOut
        title={i18n.translate('workflowsManagement.aiFailureCallout.title', {
          defaultMessage: 'AI Failure Analysis',
        })}
        color="danger"
        iconType="sparkles"
        data-test-subj="aiFailureCallout"
      >
        <EuiText size="s">{aiFailureExplanation.explanation}</EuiText>
        {aiFailureExplanation.suggestedFix && (
          <>
            <EuiSpacer size="s" />
            <EuiText size="xs" color="subdued">
              <strong>
                {i18n.translate('workflowsManagement.aiFailureCallout.suggestedFix', {
                  defaultMessage: 'Suggested fix:',
                })}
              </strong>
            </EuiText>
            <EuiSpacer size="xs" />
            <EuiCodeBlock language="yaml" fontSize="s" paddingSize="s" isCopyable>
              {aiFailureExplanation.suggestedFix}
            </EuiCodeBlock>
          </>
        )}
      </EuiCallOut>
    );
  }
);
AiFailureCallout.displayName = 'AiFailureCallout';
