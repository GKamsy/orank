// scripts/review.ts
import inquirer from "inquirer";
import chalk from "chalk";
import { reviewProposalCore } from "../lib/review";
import { loadProposals, loadAddresses, promptFeedback } from "../utils";
import { networkName } from "../index";

export async function reviewProposal() {
  const devMode = process.env.DEV_MODE;
  const addresses = await loadAddresses(networkName);

  // ----------------------------
  // Select all active proposals
  // ----------------------------
  const activeProposals = loadProposals(networkName).filter(
    (p) => p.state === "Active" || p.state === "Pending"
  );
  if (!activeProposals.length) {
    console.log(chalk.red("✔ No active proposals to review.\n"));
    return "back";
  }

  // ------------------------------------------
  // Select remaining proposals to review
  // ------------------------------------------
  let reviewerKey = process.env.PRIVATE_KEY!;
  const reviewerKeySlice = `${reviewerKey.slice(0, 6)}...${reviewerKey.slice(-4)}`;
  const remainProposals = activeProposals.filter(
    (p) => !p.reviews?.some((r) => r.reviewer === reviewerKeySlice)
  );
  if (!remainProposals.length && !devMode ) {
    console.log(chalk.red("✔ No proposal remains to review.\n"));
    return "back";
  }

  /*
   * Choices: devMode -> activeProposals, otherwise -> remainProposals
   */
  const sourceProposals = devMode ? activeProposals : remainProposals;
  const { pid } = await inquirer.prompt([
    {
      type: "list",
      name: "pid",
      message: chalk.blue("Select a proposal to review:"),
      choices: sourceProposals.map((p) => ({
        name: p.description,
        value: p.proposalId,
      })),
    },
  ]);
  const proposal = sourceProposals.find((p) => p.proposalId === pid);

  // -------------------------------------
  // Select a key if in DEVELOPER mode
  // -------------------------------------
  if (devMode) {
    const rawKeys = process.env.VOTER_KEYS?.split(",").map((k) => k.trim()) || [];
    if (!rawKeys.length) {
      console.log(chalk.red("✔ Missing VOTER_KEYS.\n"));
      return "back";
    }

    const validReviewers: { name: string; key: string }[] = [];
    for (let i = 0; i < rawKeys.length; i++) {
      const key = rawKeys[i];
      const keySlice = `${key.slice(0, 6)}...${key.slice(-4)}`;
      const existing = proposal.reviews.find((r) => r.reviewer === keySlice);
      if (!existing) validReviewers.push({ name: `Reviewer ${i + 1}: ${keySlice}`, key });
    }

    // -----------------------------
    // Select a voter interactively
    // -----------------------------
    if (validReviewers.length === 0 ) {
      await reviewProposalCore(pid, reviewerKey, 0, "", addresses, networkName);
      console.log(chalk.cyan(`✔ Reviewers exhausted.\n`));
      return "ok";
    }

    const reviewer = await inquirer.prompt([
      {
        type: "list",
        name: "reviewerKey",
        message: chalk.blue("Select a key to use for review:"),
        choices: validReviewers.map((v) => ({
          name: `  ${v.name}`,
          value: v.key,
        })),
      },
    ]);
    reviewerKey = reviewer.reviewerKey;
  }

  // ----------------------
  // Input the rating
  // ----------------------
  const { rating } = await inquirer.prompt([
    {
      type: "number",
      name: "rating",
      message: chalk.blue("Rating (1-5):"),
      validate: (val) => (val >= 1 && val <= 5) || "Must be between 1 and 5",
    },
  ]);

  // ----------------------
  // Input a feedback
  // ----------------------
  const feedback = await promptFeedback();

  // ----------------------
  // Submit the review
  // ----------------------
  const review = await reviewProposalCore(pid, reviewerKey, rating, feedback, addresses, networkName);

  if (review === "successful") {
    console.log(chalk.green("✔ Review added successfully.\n"));
  } else {
    console.log(chalk.red(`✔ Failed to review: ${review}\n`));
  }

  return "ok";
}

if (require.main === module) {
  reviewProposal().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
