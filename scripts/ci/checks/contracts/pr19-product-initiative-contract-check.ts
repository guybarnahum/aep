/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRODUCT_INITIATIVE_CONTRACTS,
  PRODUCT_INITIATIVE_KINDS,
  PRODUCT_SURFACES,
  getProductInitiativeContract,
} from "@aep/operator-agent/product/product-initiative-contracts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const initiativeKind of PRODUCT_INITIATIVE_KINDS) {
  const contract = getProductInitiativeContract(initiativeKind);
  assert(
    contract.canonicalContainer === "project",
    `${initiativeKind} must be represented as a canonical project`,
  );
  assert(
    contract.noParallelProductStore === true,
    `${initiativeKind} must deny parallel product stores`,
  );
  assert(
    contract.noDirectImplementation === true,
    `${initiativeKind} must deny direct implementation`,
  );
  assert(
    contract.noExternalStateOwnership === true,
    `${initiativeKind} must deny external state ownership`,
  );
  assert(
    contract.privateCognitionExposureAllowed === false,
    `${initiativeKind} must deny private cognition exposure`,
  );
  assert(
    contract.seedTaskTypes.join(" ") ===
      "project_planning requirements_definition task_graph_planning",
    `${initiativeKind} must bootstrap through canonical planning tasks`,
  );
}

assert(PRODUCT_INITIATIVE_CONTRACTS.length === PRODUCT_INITIATIVE_KINDS.length,
  "Each product initiative kind must have exactly one contract",
);

assert(
  PRODUCT_SURFACES.includes("website_bundle"),
  "PR19A must define website_bundle as a product surface",
);

const projectRouteSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/routes/projects.ts"),
  "utf8",
);
assert(
  projectRouteSource.includes("bootstrapProductInitiativeTasks"),
  "Project creation must bootstrap product initiatives through canonical tasks",
);
assert(
  projectRouteSource.includes("Product initiatives must be owned by team_web_product"),
  "Product initiatives must enforce web-product ownership",
);

const bootstrapSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/product/product-initiative-bootstrap.ts"),
  "utf8",
);
for (const required of ["project_planning", "requirements_definition", "task_graph_planning"]) {
  assert(
    bootstrapSource.includes(`taskType: "${required}"`),
    `Bootstrap must create ${required}`,
  );
}
assert(
  bootstrapSource.includes("createTaskWithDependencies"),
  "Bootstrap must create canonical tasks with dependency support",
);
assert(
  bootstrapSource.includes("createMessageThread") &&
    bootstrapSource.includes("createMessage"),
  "Bootstrap must publish visible coordination trace",
);

const storeTypesSource = readFileSync(
  resolve(process.cwd(), "core/operator-agent/src/lib/store-types.ts"),
  "utf8",
);
for (const field of ["initiativeKind", "productSurface", "externalVisibility"]) {
  assert(storeTypesSource.includes(field), `Project must expose ${field}`);
}

console.log("pr19-product-initiative-contract-check passed", {
  initiativeKinds: PRODUCT_INITIATIVE_KINDS.length,
});
