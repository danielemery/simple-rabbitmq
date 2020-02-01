export interface IQueueReference {
  name: string;
  generated: boolean;
  exchange: string;
  routingKey: string;
}
