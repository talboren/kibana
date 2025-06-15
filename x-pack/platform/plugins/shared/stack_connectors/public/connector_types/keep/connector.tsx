/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { KeepServiceFormFields } from '@kbn/keep-endpoint-ui-common';
import { type ActionConnectorFieldsProps } from '@kbn/triggers-actions-ui-plugin/public';
import { useKibana } from '@kbn/triggers-actions-ui-plugin/public';

const KeepAPIConnectorFields: React.FunctionComponent<ActionConnectorFieldsProps> = ({
  isEdit,
}) => {
  const {
    http,
    notifications: { toasts },
  } = useKibana().services;

  return <KeepServiceFormFields http={http} isEdit={isEdit} toasts={toasts} />;
};

// eslint-disable-next-line import/no-default-export
export { KeepAPIConnectorFields as default };
