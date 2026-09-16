# Connector ACL demo

This branch targets `workflows-shared-acl` (elastic/kibana#290269). It demonstrates reuse of the two shared ACL packages on saved connector instances.

## Demo

1. Give three users connector access in the same space. Sign in with each user to create their profiles.
2. As the owner, create a server-log connector in **Stack Management → Connectors**.
3. Open the connector, select **Access**, change it to **Private**, and add one user as **Executor**.
4. As that Executor, open and test the connector. Configuration and Access are disabled.
5. As the third user, check the connector list. The private connector is absent, and direct reads and execution are denied.
6. As the owner, switch to **Public**. The connector follows the existing RBAC rules again.

The first user to save access becomes the owner. This also supports existing connectors without an owner. Only that owner can change sharing. An ACL never grants missing feature or space privileges.

| Caller | Private connector | Change configuration / delete | Change access |
| --- | --- | --- | --- |
| Owner | View and run | Yes | Yes |
| Executor | View and run | No | No |
| Unlisted user | Denied | No | No |

All operations also require their existing Actions privileges. Public connectors keep the existing RBAC behavior, including configuration changes.

## What is reused

- `@kbn/entity-access-control`: bounded schema, profile-ID entries, timestamps, owner handling, and role checks.
- `@kbn/entity-access-control-ui`: visibility selector, user picker, owner row, and grant removal.

Actions defines one role, `executor`. It stores `owner_id` and `access_control` on the connector saved object, outside the encrypted secret attributes. A model version accepts the new fields. ACL writes use the saved object version and return a conflict if another write occurred; they do not retry.

The Actions client checks reads, listings, bulk reads, edits, deletion, ingress credential rotation, and direct Axios access. The executor checks the ACL before parameter validation and connector execution. It resolves HTTP caller profiles and API-key profiles; missing identity cannot run a private connector. Denial does not request a retry.

Internal routes read/update access and suggest users. Suggestions and new grants require connector read/execute privileges in the space. Unchanged grants and removals do not revalidate other recipients. Runtime RBAC still denies a recipient whose role was removed. Profile suggestions reflect role changes after the profile is refreshed.

## Scope

This is a demo for design review, not a production authorization rollout. It covers saved connectors through the Actions client and executor. Preconfigured and system connectors keep their existing behavior.

Before production use, review Saved Objects management/import/export/copy paths, event-log and SML search exposure, inbound event processing, and concurrent configuration/deletion versus ACL writes. Groups, ownership transfer, and cross-cluster profile migration are outside this demo.

## Validation

Focused Jest tests cover owner/Executor/unlisted access, lists and bulk reads, RBAC denial, grant removal, concurrent ACL writes, request/API-key profile resolution, execution denial, and the access controls in the flyout. The HTTP check uses a temporary space, three native users, and a server-log connector, then deletes those fixtures.
