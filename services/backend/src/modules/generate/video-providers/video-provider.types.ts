export interface GenerateVideoClipInput {
  prompt: string;
  outputPath: string;
  model?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  mode?: string;
  cfgScale?: number;
  cameraControl?: {
    type?: string;
    config?: {
      horizontal?: number;
      vertical?: number;
      pan?: number;
      tilt?: number;
      roll?: number;
      zoom?: number;
    };
  };
  negativePrompt?: string;
  providerTaskId?: string;
  onProviderTaskCreated?: (details: {
    providerTaskId: string;
    providerRequestId?: string;
    providerRequestPayload?: string;
  }) => Promise<void> | void;
  shouldAbort?: () => Promise<boolean> | boolean;
}

export interface ExtendVideoClipInput {
  videoId: string;
  prompt: string;
  outputPath: string;
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
  providerOutputId?: string;
  providerRequestPayload?: string;
  providerUnitsConsumed?: string;
  providerTerminalPayload?: string;
  outputPath: string;
}
