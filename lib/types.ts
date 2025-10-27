export interface SubmittedGrant {
  id: number;
  name: string;
  description: string;
  targets: string[];
  values: string[];
  calldata: string[];
  state: "Available" | "Proposed" | "Funded";
}

export interface Review {
  reviewer: string;
  rating: number;
  feedback: string;
  timestamp: number;
}

export interface Proposal {
  id: number;
  proposalId: string;
  description: string;
  state: "Pending" | "Active" | "Succeeded" | "Queued" | "Executed";
  targets: string[];
  values: string[];
  calldata: string[];
  reviews: Review[];
  averageScore?: string;
}
