import { AsyncLocalStorage } from 'node:async_hooks';

const tenantContext = new AsyncLocalStorage();

export const tenantContextMiddleware = (req, res, next) => {
  const tenantId = req.tenant?.id ?? null;

  tenantContext.run({ tenantId }, () => {
    next();
  });
};

export const getCurrentTenantId = () => {
  const store = tenantContext.getStore();
  return store?.tenantId ?? null;
};

export default {
  tenantContext,
  tenantContextMiddleware,
  getCurrentTenantId
};

