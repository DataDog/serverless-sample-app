export interface EventBridgeEvent<TDetail> {
  id: string;
  version: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  source: string;
  "detail-type": string;
  detail: TDetail;
  "replay-name"?: string;
}
