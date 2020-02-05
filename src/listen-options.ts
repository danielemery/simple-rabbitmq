export default interface IListenOptions {
  /** Optional routing key to filter messages. */
  routingKey?: string;
  /** Optional queue to use a named persistent queue. */
  queue?: string;
  /** Whether or not messaage acknowledgement is enabled. */
  requiresAcknowledge?: boolean;
}
