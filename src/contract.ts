import { initContract } from "@ts-rest/core";
import { z } from "zod";
const c = initContract();
export const contract = c.router({
  internalUpsertTenant: { method: "POST", path: "/internal/tenants" },
  internalAssignCertifiedAttribute: {
    method: "POST",
    path: "/internal/origin/{tOrigin}/externalId/{tExternalId}/attributes/origin/{aOrigin}/externalId/{aExternalId}",
  },
  internalRevokeCertifiedAttribute: {
    method: "DELETE",
    path: "/internal/origin/{tOrigin}/externalId/{tExternalId}/attributes/origin/{aOrigin}/externalId/{aExternalId}",
  },
  m2mUpsertTenant: { method: "POST", path: "/m2m/tenants" },
  m2mRevokeAttribute: {
    method: "DELETE",
    path: "/m2m/origin/{origin}/externalId/{externalId}/attributes/{code}",
  },
  selfcareUpsertTenant: { method: "POST", path: "/selfcare/tenants" },
  getConsumers: { method: "GET", path: "/consumers" },
  getProducers: { method: "GET", path: "/producers" },
  getTenants: { method: "GET", path: "/tenants" },
  getTenantBySelfcareId: {
    method: "GET",
    path: "/tenants/selfcare/{selfcareId}",
  },
  getTenant: { method: "GET", path: "/tenants/{id}" },
  getTenantByExternalId: {
    method: "GET",
    path: "/tenants/origin/{origin}/code/{code}",
  },
  getCertifiedAttributes: {
    method: "GET",
    path: "/tenants/attributes/certified",
  },
  addDeclaredAttribute: {
    method: "POST",
    path: "/tenants/attributes/declared",
  },
  revokeDeclaredAttribute: {
    method: "DELETE",
    path: "/tenants/attributes/declared/{attributeId}",
  },
  verifyVerifiedAttribute: {
    method: "POST",
    path: "/tenants/{tenantId}/attributes/verified",
  },
  updateVerifiedAttribute: {
    method: "POST",
    path: "/tenants/{tenantId}/attributes/verified/{attributeId}",
  },
  revokeVerifiedAttribute: {
    method: "DELETE",
    path: "/tenants/{tenantId}/attributes/verified/{attributeId}",
  },
  updateVerifiedAttributeExtensionDate: {
    method: "POST",
    path: "/tenants/{tenantId}/attributes/verified/{attributeId}/verifier/{verifierId}",
  },
  getStatus: { method: "GET", path: "/status" },
});
