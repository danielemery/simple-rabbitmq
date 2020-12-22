import ILogger from './logger';
import ConsoleLogger from './console-logger';
import { IQueueReference } from './queue-reference';
import Envelope from './envelope';
import IListenOptions from './listen-options';

import publish from './operations/publish';
import RabbitConnectionManager, {
  IRabbitConnectionDetails,
  IRetryOptions,
} from './modules/RabbitConnectionManager';

export default class Rabbit {
  logger: ILogger;
  connectionManager: RabbitConnectionManager;

  constructor(
    connectionDetails: IRabbitConnectionDetails,
    logger: ILogger = new ConsoleLogger(),
    retryOptions: IRetryOptions = {},
  ) {
    this.logger = logger;
    this.connectionManager = new RabbitConnectionManager(
      connectionDetails,
      logger,
      retryOptions,
    );
  }

  /**
   * Establish a connection and channel with the configured rabbit service.
   *
   * Note: If already connected this will do nothing.
   */
  public async connect() {
    return this.connectionManager.connect();
  }

  /**
   * Disconnect from the connected rabbit service.
   */
  public async disconnect() {
    return this.connectionManager.disconnect();
  }

  /**
   * Publish a message to the connected rabbit service.
   * @param exchange The exchange to publish the message.
   * @param routingKey Optional routing key to route the message.
   * @param payload The message payload.
   *
   * Note: If not connected this will throw.
   */
  public async publish<T>(
    exchange: string,
    routingKey: string = '',
    payload: T,
  ): Promise<boolean> {
    await this.connectionManager.waitUntilConnected();
    const channel = this.connectionManager.getChannel();
    return publish<T>(channel, exchange, routingKey, payload, this.logger);
  }

  /**
   * Listen to the connected rabbit service.
   * @param exchange The exchange to subscribe to.
   * @param routingKey Optional routing key to select messages.
   * @param queue Optional queue name to listen to, if not provided a new temporary exclusive queue will be created.
   * @param onMessage Callback fired when a message is recieved.
   * @param onClose Callback fired when the channel/connection is closed.
   */
  public async listen<T>(
    exchange: string,
    options: IListenOptions,
    onMessage: (message: Envelope<T>) => void,
    onClose: () => void,
  ): Promise<IQueueReference> {
    await this.connectionManager.waitUntilConnected();
    const channel = this.connectionManager.getChannel();
    const {
      queue = '',
      routingKey = '',
      requiresAcknowledge = queue.length > 0,
    } = options;
    const exclusive = queue.length === 0;
    const generated = queue.length === 0;

    this.logger.info('Listening to queue', {
      queue,
      routingKey,
      requiresAcknowledge,
      exclusive,
      generated,
    });

    await channel.assertExchange(exchange, 'topic', { durable: false });
    const createdQueue = await channel.assertQueue(queue, {
      exclusive,
    });
    await channel.bindQueue(createdQueue.queue, exchange, routingKey);
    const { consumerTag } = await channel.consume(
      createdQueue.queue,
      (message) => {
        if (message) {
          const data = JSON.parse(message.content.toString());
          onMessage({
            message: data,
            acknowledge: requiresAcknowledge
              ? async () => {
                  if (!channel) {
                    throw new Error('No open rabbit connection!');
                  }
                  await channel.ack(message);
                }
              : undefined,
          });
        } else if (onClose) onClose();
      },
      {
        noAck: !requiresAcknowledge,
      },
    );
    return {
      name: createdQueue.queue,
      generated,
      exchange,
      routingKey,
      consumerTag,
    };
  }

  /** Stop listening to the queue identified by the given reference. */
  public async unlisten(queue: IQueueReference) {
    await this.connectionManager.waitUntilConnected();
    const channel = this.connectionManager.getChannel();
    if (queue.generated) {
      await channel.deleteQueue(queue.name);
    } else {
      await channel.cancel(queue.consumerTag);
    }
  }

  /** Delete the exchange with the given name. */
  public async deleteExchange(exchange: string) {
    await this.connectionManager.waitUntilConnected();
    const channel = this.connectionManager.getChannel();
    await channel.deleteExchange(exchange);
  }

  /** Delete the queue with the given name. */
  public async deleteQueue(queue: string) {
    await this.connectionManager.waitUntilConnected();
    const channel = this.connectionManager.getChannel();
    await channel.deleteQueue(queue);
  }
}
