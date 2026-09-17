/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiModal,
  EuiModalBody,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalFooter,
  EuiSpacer,
  EuiToolTip,
  useGeneratedHtmlId,
} from '@elastic/eui';
import { AccessControlForm } from '@kbn/entity-access-control-ui';
import type { AccessControlInput } from '@kbn/entity-access-control';
import type { ConnectorAccessResponse } from '@kbn/actions-plugin/common';
import { i18n } from '@kbn/i18n';
import { useQuery } from '@kbn/react-query';
import { useDebouncedValue } from '@kbn/react-hooks';
import { KbnDangerCallout } from '@kbn/ui-callout';
import type { UserProfileWithAvatar } from '@kbn/user-profile-components';
import { useKibana } from '../../../../common/lib/kibana';

const roles = [
  {
    value: 'executor',
    text: i18n.translate('xpack.triggersActionsUI.connectorAccess.executorLabel', {
      defaultMessage: 'Executor',
    }),
  },
] as const;
const accessPath = (id: string) =>
  `/internal/actions/connector/${encodeURIComponent(id)}/access_control`;

export const useConnectorAccess = (id: string, enabled: boolean) => {
  const { http } = useKibana().services;
  return useQuery({
    queryKey: ['connectorAccess', id],
    enabled,
    queryFn: () => http.get<ConnectorAccessResponse>(accessPath(id)),
  });
};

export const ConnectorAccess = ({
  id,
  access,
  canSave,
  onSaved,
}: {
  id: string;
  access?: ConnectorAccessResponse;
  canSave: boolean;
  onSaved: () => void;
}): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <EuiToolTip
        content={
          !access?.permissions.manage
            ? i18n.translate('xpack.triggersActionsUI.connectorAccess.ownerTooltip', {
                defaultMessage: 'Only the owner can change connector access.',
              })
            : undefined
        }
      >
        <EuiButtonEmpty
          iconType="users"
          isDisabled={!canSave || !access?.permissions.manage}
          onClick={() => setIsOpen(true)}
          data-test-subj="connectorAccessButton"
        >
          {i18n.translate('xpack.triggersActionsUI.connectorAccess.accessButtonLabel', {
            defaultMessage: 'Access',
          })}
        </EuiButtonEmpty>
      </EuiToolTip>
      <EuiSpacer size="s" />
      {isOpen && access && (
        <ConnectorAccessModal
          id={id}
          access={access}
          onClose={() => setIsOpen(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
};

const ConnectorAccessModal = ({
  id,
  access,
  onClose,
  onSaved,
}: {
  id: string;
  access: ConnectorAccessResponse;
  onClose: () => void;
  onSaved: () => void;
}): React.ReactElement => {
  const { http, userProfile } = useKibana().services;
  const titleId = useGeneratedHtmlId();
  const [value, setValue] = useState<AccessControlInput<'executor'>>(
    access.access_control ?? { access_mode: 'public', entries: [] }
  );
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const { data: currentProfile, isError: profileError } = useQuery({
    queryKey: ['connectorAccessCurrentProfile'],
    queryFn: () => userProfile.getCurrent<UserProfileWithAvatar['data']>({ dataPath: 'avatar' }),
  });
  const ownerId = access.owner_id ?? currentProfile?.uid;
  const uids = [ownerId, ...(value.entries ?? []).map(({ id: uid }) => uid)].filter(
    (uid): uid is string => !!uid
  );
  const { data: profiles = [], isError: profilesError } = useQuery({
    queryKey: ['connectorAccessProfiles', ...uids],
    enabled: uids.length > 0,
    queryFn: () =>
      userProfile.bulkGet<UserProfileWithAvatar['data']>({
        uids: new Set(uids),
        dataPath: 'avatar',
      }),
  });
  const {
    data: suggestedProfiles = [],
    isFetching,
    isError: searchError,
  } = useQuery({
    queryKey: ['connectorAccessSuggestions', id, debouncedSearch],
    enabled: value.access_mode === 'private',
    queryFn: () =>
      userProfile.suggest<UserProfileWithAvatar['data']>(
        `${accessPath(id)}/_suggest_user_profiles`,
        { name: debouncedSearch, size: 20, dataPath: 'avatar' }
      ),
  });
  const save = async () => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await http.put(accessPath(id), { body: JSON.stringify(value) });
      onSaved();
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <EuiModal onClose={onClose} aria-labelledby={titleId}>
      <EuiModalHeader>
        <EuiModalHeaderTitle id={titleId}>
          {i18n.translate('xpack.triggersActionsUI.connectorAccess.modalTitle', {
            defaultMessage: 'Connector access',
          })}
        </EuiModalHeaderTitle>
      </EuiModalHeader>
      <EuiModalBody>
        {(saveFailed || profileError || profilesError || searchError) && (
          <>
            <KbnDangerCallout
              announceOnMount
              size="s"
              title={i18n.translate('xpack.triggersActionsUI.connectorAccess.saveErrorMessage', {
                defaultMessage:
                  'Could not save access or load users. New recipients need permission to view and run connectors in this space.',
              })}
            />
            <EuiSpacer size="m" />
          </>
        )}
        <AccessControlForm
          value={value}
          onChange={setValue}
          ownerId={ownerId}
          currentUserId={currentProfile?.uid}
          profiles={currentProfile ? [...profiles, currentProfile] : profiles}
          suggestedProfiles={suggestedProfiles}
          onSearch={setSearch}
          roles={roles}
          isSearching={isFetching}
          isDisabled={isSaving}
          allowPublicEntries={false}
          publicDescription={i18n.translate(
            'xpack.triggersActionsUI.connectorAccess.publicDescription',
            {
              defaultMessage:
                'Access follows connector permissions in this space. Private connectors restrict access to the owner and selected Executors. Executors can view and run; feature privileges still apply.',
            }
          )}
        />
      </EuiModalBody>
      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose} isDisabled={isSaving}>
          {i18n.translate('xpack.triggersActionsUI.connectorAccess.cancelButtonLabel', {
            defaultMessage: 'Cancel',
          })}
        </EuiButtonEmpty>
        <EuiButton
          fill
          onClick={save}
          isLoading={isSaving}
          isDisabled={!ownerId}
          data-test-subj="connectorAccessSave"
        >
          {i18n.translate('xpack.triggersActionsUI.connectorAccess.saveButtonLabel', {
            defaultMessage: 'Save',
          })}
        </EuiButton>
      </EuiModalFooter>
    </EuiModal>
  );
};
