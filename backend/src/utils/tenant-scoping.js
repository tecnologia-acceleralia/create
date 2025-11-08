import { getCurrentTenantId } from '../middleware/tenant-context.middleware.js';

const TENANT_COLUMN = 'tenant_id';

function resolveTenantId(options = {}) {
  if (options.tenantId) {
    return options.tenantId;
  }

  return getCurrentTenantId();
}

function applyTenantFilter(options, tenantId) {
  if (!tenantId) {
    return;
  }

  options.where = {
    [TENANT_COLUMN]: tenantId,
    ...(options.where ?? {})
  };
}

export function enableTenantScoping(model) {
  model.addHook('beforeFind', options => {
    if (options.skipTenant) {
      return;
    }
    const tenantId = resolveTenantId(options);
    applyTenantFilter(options, tenantId);
  });

  model.addHook('beforeCount', options => {
    if (options.skipTenant) {
      return;
    }
    const tenantId = resolveTenantId(options);
    applyTenantFilter(options, tenantId);
  });

  model.addHook('beforeCreate', instance => {
    if (instance[TENANT_COLUMN]) {
      return;
    }
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      instance[TENANT_COLUMN] = tenantId;
    }
  });
}

