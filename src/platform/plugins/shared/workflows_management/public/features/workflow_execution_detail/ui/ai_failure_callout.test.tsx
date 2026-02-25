/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { AiFailureCallout } from './ai_failure_callout';

describe('AiFailureCallout', () => {
  it('should render the explanation text', () => {
    render(
      <AiFailureCallout
        aiFailureExplanation={{
          explanation: 'The HTTP step failed because the URL returned a 404.',
        }}
      />
    );

    expect(screen.getByTestId('aiFailureCallout')).toBeInTheDocument();
    expect(
      screen.getByText('The HTTP step failed because the URL returned a 404.')
    ).toBeInTheDocument();
  });

  it('should render the title', () => {
    render(
      <AiFailureCallout
        aiFailureExplanation={{
          explanation: 'Some explanation',
        }}
      />
    );

    expect(screen.getByText('AI Failure Analysis')).toBeInTheDocument();
  });

  it('should render suggested fix when provided', () => {
    render(
      <AiFailureCallout
        aiFailureExplanation={{
          explanation: 'The step failed.',
          suggestedFix: 'Change the URL to https://correct-url.com',
        }}
      />
    );

    expect(screen.getByText('Suggested fix:')).toBeInTheDocument();
    expect(screen.getByText('Change the URL to https://correct-url.com')).toBeInTheDocument();
  });

  it('should not render suggested fix section when not provided', () => {
    render(
      <AiFailureCallout
        aiFailureExplanation={{
          explanation: 'The step failed.',
        }}
      />
    );

    expect(screen.queryByText('Suggested fix:')).not.toBeInTheDocument();
  });

  it('should not render suggested fix section when suggestedFix is undefined', () => {
    render(
      <AiFailureCallout
        aiFailureExplanation={{
          explanation: 'The step failed.',
          suggestedFix: undefined,
        }}
      />
    );

    expect(screen.queryByText('Suggested fix:')).not.toBeInTheDocument();
  });
});
