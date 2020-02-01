import amqp, { Connection, ConfirmChannel } from 'amqplib';

import IRabbitOptions from './IRabbitOptions';
import ILogger from './ILogger';
import ConsoleLogger from './consoleLogger';
import { IQueueReference } from './IQueueReference';

export default class Rabbit {
  connection?: Connection;
  channel?: ConfirmChannel;
  options: IRabbitOptions;
  logger: ILogger;

  constructor(options: IRabbitOptions, logger: ILogger = new ConsoleLogger()) {
    this.options = options;
    this.logger = logger;
  }

  /**
   * Establish a connection and channel with the configured rabbit service.
   *
   * Note: If already connected this will throw.
   */
  public async connect() {
    if (this.connection) {
      throw new Error('Connection already open on this rabbit instance.');
    }
    const { user, password, host, port } = this.options;
    const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
    this.logger.info(`Connecting to RabbitMQ @ ${rabbitUrl}`);
    this.connection = await amqp.connect(rabbitUrl);
    this.logger.info('Connection to RabbitMQ established successfully');
    this.channel = await this.connection.createConfirmChannel();
    this.logger.info('RabbitMQ channel opened');
  }

  /**
   * Disconnect from the connected rabbit service.
   */
  public async disconnect() {
    try {
      if (this.connection) {
        await this.connection.close();
        this.logger.info('RabbitMQ connection closed successfully');
      } else {
        this.logger.info('No open RabbitMQ connection to close');
      }
    } catch (e) {
      this.logger.error('Error closing RabbitMQ connection and/or channel', e);
      throw e;
    }
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
    try {
      return new Promise(async (resolve, reject) => {
        if (!this.channel) {
          throw new Error('No open rabbit connection!');
        }
        await this.channel.assertExchange(exchange, 'topic', {
          durable: false,
        });
        this.channel.publish(
          exchange,
          routingKey,
          Buffer.from(JSON.stringify(payload)),
          undefined,
          err => {
            if (err) {
              reject(err);
            } else {
              resolve(true);
            }
          },
        );
      });
    } catch (err) {
      this.logger.error(err);
      return false;
    }
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
    routingKey: string = '',
    queue: string = '',
    onMessage: (message: T) => void,
    onClose: () => void,
  ): Promise<IQueueReference> {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: false });
    const createdQueue = await this.channel.assertQueue(queue, {
      exclusive: queue.length > 0,
      durable: queue.length > 0,
    });
    await this.channel.bindQueue(createdQueue.queue, exchange, routingKey);
    this.channel.consume(createdQueue.queue, message => {
      if (message) {
        const data = JSON.parse(message.content.toString());
        onMessage(data);
      } else if (onClose) onClose();
    });
    return {
      name: createdQueue.queue,
      generated: queue.length > 0,
      exchange,
      routingKey,
    };
  }

  public async unlisten(queue: IQueueReference) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    if (queue.generated) {
      await this.channel.deleteQueue(queue.name);
    } else {
      await this.channel.unbindQueue(
        queue.name,
        queue.exchange,
        queue.routingKey,
      );
    }
  }

  public async deleteExchange(exchange: string) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.deleteExchange(exchange);
  }
}
