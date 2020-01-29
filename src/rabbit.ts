import amqp, { Connection, ConfirmChannel } from 'amqplib';

import IRabbitOptions from './IRabbitOptions';
import ILogger from './ILogger';
import ConsoleLogger from './consoleLogger';

export default class Rabbit<T> {
  connection?: Connection;
  channel?: ConfirmChannel;
  options: IRabbitOptions;
  logger: ILogger;

  constructor(options: IRabbitOptions, logger: ILogger = new ConsoleLogger()) {
    this.options = options;
    this.logger = logger;
  }

  public async connect() {
    const { user, password, host, port } = this.options;
    const rabbitUrl = `amqp://${user}:${password}@${host}:${port}`;
    this.logger.info(`Connecting to RabbitMQ @ ${rabbitUrl}`);
    this.connection = await amqp.connect(rabbitUrl);
    this.logger.info('Connection to RabbitMQ established successfully');
    this.channel = await this.connection.createConfirmChannel();
    this.logger.info('RabbitMQ channel opened');
  }

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

  public async publish(
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

  public async listen(
    exchange: string,
    routingKey: string = '',
    onMessage: (message: T) => void,
    onClose: () => void,
  ) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.assertExchange(exchange, 'topic', { durable: false });
    const queue = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue.queue, exchange, routingKey);
    this.channel.consume(queue.queue, message => {
      if (message) {
        const data = JSON.parse(message.content.toString());
        onMessage(data);
      } else if (onClose) onClose();
    });
    return queue.queue;
  }

  public async unlisten(queue: string) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.deleteQueue(queue);
  }

  public async deleteExchange(exchange: string) {
    if (!this.channel) {
      throw new Error('No open rabbit connection!');
    }
    await this.channel.deleteExchange(exchange);
  }
}
