export interface GenerateVideoClipInput {
  prompt: string;
  outputPath: string;
  model?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  negativePrompt?: string;
  providerTaskId?: string;
  onProviderTaskCreated?: (details: {
    providerTaskId: string;
    providerRequestId?: string;
    providerRequestPayload?: string;
  }) => Promise<void> | void;
  shouldAbort?: () => Promise<boolean> | boolean;
}

export interface GenerateVideoClipResult {
  provider: string;
  providerTaskId?: string;
  providerRequestId?: string;
  providerRequestPayload?: string;
  providerUnitsConsumed?: string;
  providerTerminalPayload?: string;
  outputPath: string;
}
