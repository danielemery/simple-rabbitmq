import amqp, { Connection, ConfirmChannel } from 'amqplib';

import IRabbitOptions from './rabbit-options';
import ILogger from './logger';
import ConsoleLogger from './console-logger';
import { IQueueReference } from './queue-reference';
import Envelope from './envelope';
import IListenOptions from './listen-options';
import { wait } from './wait';

export interface IConnectOptions {
  retry?: boolean;
  retryWait?: number;
  timeoutMillis?: number;
}

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
   * Note: If already connected this will do nothing.
   */
  public async connect(options?: IConnectOptions) {
    const { retry = false, retryWait = 2000, timeoutMillis = undefined } =
      options || {};
    if (!this.connection) {
      const { user, password, host, port } = this.options;
      const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
      this.logger.info(
        `Connecting to RabbitMQ @ amqp://${user}:***@${host}:${port}`,
      );
      const timeStarted = new Date().getTime();
      let connected = false;
      let first = true;
      do {
        try {
          if (!first) {
            this.logger.info(`Retrying connect after ${retryWait}ms`);
            await wait(retryWait);
          }
          first = false;
          this.connection = await amqp.connect(rabbitUrl);
          connected = true;
        } catch (err) {
          this.logger.error(`Failed to connect to Rabbit`);
        }
      } while (
        retry &&
        (timeoutMillis === undefined ||
          new Date().getTime() < timeStarted + timeoutMillis) &&
        !connected
      );
      if (!this.connection) {
        let error;
        if (retry && timeoutMillis) {
          error = `Failed to connect to RabbitMQ for ${timeoutMillis}ms, giving up`;
        } else {
          error = 'Failed to connect to RabbitMQ';
        }
        throw new Error(error);
      } else {
        this.logger.info('Connection to RabbitMQ established successfully');
        this.channel = await this.connection.createConfirmChannel();
        this.logger.info('RabbitMQ channel opened');
      }
    } else {
      this.logger.warn(
        'Attempting to connect to RabbitMQ when already connected',
      );
    }
  }

  /**
   * Disconnect from the connected rabbit service.
   */
  public async disconnect() {
    try {
      if (this.connection) {
        await this.connection.close();
        this.connection = undefined;
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
          (err) => {
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
    options: IListenOptions,
    onMessage: (message: Envelope<T>) => void,
    onClose: () => void,
  ): Promise<IQueueReference> {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
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

    await this.channel.assertExchange(exchange, 'topic', { durable: false });
    const createdQueue = await this.channel.assertQueue(queue, {
      exclusive,
    });
    await this.channel.bindQueue(createdQueue.queue, exchange, routingKey);
    const { consumerTag } = await this.channel.consume(
      createdQueue.queue,
      (message) => {
        if (message) {
          const data = JSON.parse(message.content.toString());
          onMessage({
            message: data,
            acknowledge: requiresAcknowledge
              ? async () => {
                  if (!this.channel) {
                    throw new Error('No open rabbit connection!');
                  }
                  await this.channel.ack(message);
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
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    if (queue.generated) {
      await this.channel.deleteQueue(queue.name);
    } else {
      await this.channel.cancel(queue.consumerTag);
    }
  }

  /** Delete the exchange with the given name. */
  public async deleteExchange(exchange: string) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.deleteExchange(exchange);
  }

  /** Delete the queue with the given name. */
  public async deleteQueue(queue: string) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.deleteQueue(queue);
  }
}
