CREATE TABLE IF NOT EXISTS runtime_role_policies (
  role_id TEXT PRIMARY KEY,
  authority_json TEXT NOT NULL,
  budget_json TEXT NOT NULL,
  escalation_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles_catalog(role_id)
);

INSERT OR REPLACE INTO runtime_role_policies (
  role_id,
  authority_json,
  budget_json,
  escalation_json
) VALUES
  (
    'timeout-recovery-operator',
    json_object(
      'allowedOperatorActions', json_array('advance-timeout'),
      'allowedTenants', json_array('tenant_internal_aep', 'tenant_qa'),
      'allowedServices', json_array('service_control_plane'),
      'requireTraceVerification', 1
    ),
    json_object(
      'maxActionsPerScan', 5,
      'maxActionsPerHour', 30,
      'maxActionsPerTenantPerHour', 10,
      'tokenBudgetDaily', 0,
      'runtimeBudgetMsPerScan', 5000,
      'verificationReadsPerAction', 3
    ),
    json_object(
      'onBudgetExhausted', 'notify-human',
      'onRepeatedVerificationFailure', 'notify-human',
      'onProdTenantAction', 'require-manager-approval'
    )
  ),
  (
    'retry-supervisor',
    json_object(
      'allowedOperatorActions', json_array('advance-timeout'),
      'allowedTenants', json_array('tenant_qa', 'tenant_internal_aep'),
      'allowedServices', json_array('service_control_plane'),
      'requireTraceVerification', 1
    ),
    json_object(
      'maxActionsPerScan', 2,
      'maxActionsPerHour', 10,
      'maxActionsPerTenantPerHour', 5,
      'tokenBudgetDaily', 0,
      'runtimeBudgetMsPerScan', 5000,
      'verificationReadsPerAction', 3
    ),
    json_object(
      'onBudgetExhausted', 'notify-human',
      'onRepeatedVerificationFailure', 'notify-human',
      'onProdTenantAction', 'require-manager-approval'
    )
  ),
  (
    'infra-ops-manager',
    json_object(
      'allowedOperatorActions', json_array('advance-timeout'),
      'allowedTenants', json_array('tenant_internal_aep', 'tenant_qa'),
      'allowedServices', json_array('service_control_plane'),
      'requireTraceVerification', 0
    ),
    json_object(
      'maxActionsPerScan', 0,
      'maxActionsPerHour', 0,
      'maxActionsPerTenantPerHour', 0,
      'tokenBudgetDaily', 0,
      'runtimeBudgetMsPerScan', 5000,
      'verificationReadsPerAction', 0
    ),
    json_object(
      'onBudgetExhausted', 'notify-human',
      'onRepeatedVerificationFailure', 'notify-human',
      'onProdTenantAction', 'require-manager-approval'
    )
  ),
  (
    'reliability-engineer',
    json_object(
      'allowedOperatorActions', json_array('execute-remediation', 'propose-fix'),
      'allowedTenants', json_array('tenant_internal_aep', 'tenant_qa'),
      'allowedServices', json_array('service_control_plane'),
      'requireTraceVerification', 1
    ),
    json_object(
      'maxActionsPerScan', 3,
      'maxActionsPerHour', 15,
      'maxActionsPerTenantPerHour', 5,
      'tokenBudgetDaily', 0,
      'runtimeBudgetMsPerScan', 10000,
      'verificationReadsPerAction', 5
    ),
    json_object(
      'onBudgetExhausted', 'notify-human',
      'onRepeatedVerificationFailure', 'disable-agent',
      'onProdTenantAction', 'require-manager-approval'
    )
  );