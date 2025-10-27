import { ContractTransactionReceipt, Interface, ethers } from "ethers";

/**
 * Parse relevant events from a transaction receipt
 */
export function parseEvents(
  receipt: ContractTransactionReceipt,
  iface: Interface,
  names: string[]
) {
  return receipt.logs
    .map(log => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(e => e && names.includes(e.name));
}

/**
 * Capture proposal + escrow state for snapshotting
 */
export async function snapshotProposalState(
  governor: any,
  escrow: any,
  proposalId: string,
  grantId: string
) {
  const state = await governor.state(proposalId);

  let proposalStruct: any = null;
  try {
    proposalStruct = await governor.proposals(proposalId);
  } catch {
    // not all governors expose proposals
  }

  let escrowInfo: any = null;
  try {
    escrowInfo = await escrow.escrows(ethers.id(grantId));
  } catch {
    // optional
  }

  return { state, proposalStruct, escrowInfo };
}

/**
 * Compare two snapshots and log differences
 */
export function compareStates(before: any, after: any) {
  console.log("🔍 Comparing states...");

  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  keys.forEach(key => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      console.log(`⚠️ Changed [${key}]:`);
      console.log("   Before:", beforeVal);
      console.log("   After: ", afterVal);
    }
  });
}
