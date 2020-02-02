export default interface IListenOptions {
  routingKey?: string;
  queue?: string;
  requiresAcknowledge?: boolean;
}
