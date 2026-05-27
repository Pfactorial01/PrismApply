export type JobSource = "lever" | "greenhouse" | "ashby";

export interface FormFieldPayload {
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface DiscoveredJobPayload {
  source: JobSource;
  jobUrl: string;
  applyUrl: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  formFields: FormFieldPayload[];
  searchQueryId?: number;
}

export interface DiscoveryQuery {
  id: number;
  query: string;
  priority: number;
}

export interface DedupResult {
  newUrls: Array<{ url: string; source: JobSource }>;
  knownCount: number;
}

export interface EmbedStoreResult {
  jobId: string;
  isNew: boolean;
}

export interface SearchGoogleResult {
  urls: Array<{ url: string; source: JobSource }>;
  rawCount: number;
  error?: string;
}

export interface DiscoverTechJobsResult {
  queriesRun: number;
  urlsFound: number;
  knownUrls: number;
  newUrls: number;
  jobsStored: number;
  matchWorkflowsStarted: number;
  errors: number;
}
