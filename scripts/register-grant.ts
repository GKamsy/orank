#!/usr/bin/env ts-node
import { registerGrant } from "../lib/register-grant";

// ----------------------------------------------------
// Standalone execution entrypoint
// ----------------------------------------------------
if (require.main === module) {
  registerGrant().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
